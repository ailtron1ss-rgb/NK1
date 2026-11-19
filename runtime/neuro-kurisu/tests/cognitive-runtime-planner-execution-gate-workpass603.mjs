import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlanEngine } from '../src/organism/world/PlanEngine.ts';
import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeSource = readFileSync(resolve(packageRoot, 'src/organism/core/OrganismRuntime.ts'), 'utf8');
const planEngineSource = readFileSync(resolve(packageRoot, 'src/organism/world/PlanEngine.ts'), 'utf8');

const environment = new WorldEnvironment();
const before = environment.snapshot();
const preferred = 'verify';
const engine = new PlanEngine(environment);
const fallback = engine.buildBudgetFallback(null, preferred, 'planning-budget-exhausted');
const after = environment.snapshot();

assert.equal(fallback.steps.length, 1,
  'budget fallback must compile exactly one action rather than a multi-step beam search');
assert.equal(fallback.searchDepth, 1);
assert.equal(fallback.beamWidth, 1);
assert.equal(fallback.steps[0].internalAction, preferred);
assert.equal(fallback.steps[0].environmentAction, 'inspect');
assert.match(fallback.steps[0].rationale, /planning-budget-exhausted/);
assert.ok(Number.isFinite(fallback.steps[0].predictedReward));
assert.ok(Number.isFinite(fallback.steps[0].confidence));
assert.ok(Number.isFinite(fallback.expectedValue));
assert.deepEqual(after, before,
  'fallback projection must remain pure and must not commit a world transition');
assert.match(planEngineSource, /buildBudgetFallback\(goal: OrganismGoal \| null, preferred: ActionKind, reason: string\)/);

// Runtime contract: the recorded planning budget decision must actually gate the
// expensive PlanEngine path; otherwise "budget-aware" planner metrics are cosmetic.
assert.match(runtimeSource,
  /const executionPlan = this\.core\.cognitiveExecutionPlanSnapshot\(\);/,
  'the runtime step must read the execution plan produced by core cognition');
assert.match(runtimeSource,
  /const slowCognitionAllowed = executionPlan\?\.run\?\.\['slow-cognition'\] !== false;/,
  'slow cognition must obey the same plan');
assert.match(runtimeSource,
  /const projectAllowed = executionPlan\?\.run\?\.project !== false;/,
  'project gating must be driven by the execution plan');
assert.match(runtimeSource,
  /const planningBudget = projectAllowed\s*\?\s*this\.core\.cognitiveBudgetSpend\('planning',[\s\S]*?:\s*\{ accepted: false \};/,
  'a planner-disabled project operation must not spend planning budget');
assert.match(runtimeSource,
  /const plan = planningBudget\.accepted && projectAllowed\s*\?\s*this\.plans\.build\([\s\S]*?:\s*this\.plans\.buildBudgetFallback\(/,
  'failed or gated planning must choose the one-step fallback rather than beam search');
assert.match(runtimeSource,
  /const worldRolloutAllowed = executionPlan\?\.run\?\.\['world-rollout'\] !== false;/,
  'optional world rollout must obey its explicit execution-plan gate');
assert.match(runtimeSource,
  /const shadowPassAllowed = executionPlan\?\.run\?\.shadow !== false;/,
  'shadow evaluation must obey its explicit execution-plan gate');
assert.match(runtimeSource,
  /const branches = simBudget\.accepted && worldRolloutAllowed && shadowPassAllowed/,
  'expensive counterfactual branches must be gated by both rollout and shadow flags');
assert.match(runtimeSource,
  /const matchedProjections = shadowPassAllowed\s*\?\s*matchedCandidates\.map\([\s\S]*?:\s*\[\];/,
  'matched shadow projections must be skipped when shadow is gated');

console.log('COGNITIVE_RUNTIME_PLANNER_EXECUTION_GATE=PASS', JSON.stringify({
  fallbackSteps: fallback.steps.length,
  fallbackDepth: fallback.searchDepth,
  fallbackBeam: fallback.beamWidth,
  environmentPure: JSON.stringify(before) === JSON.stringify(after),
  projectBudgetGate: true,
  rolloutShadowGates: true,
}));
