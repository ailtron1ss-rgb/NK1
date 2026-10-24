import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deriveInnerImperative } from '../src/organism/cognition/InnerImperativeController.ts';

// Guard the *live* orchestration path, not just the kernel in isolation.
const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
const core = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');

assert.match(
  runtime,
  /import\s+\{\s*CanonicalCognitiveKernel\s*\}\s+from\s+['"]\.\/CanonicalCognitiveKernel\.ts['"]/,
  'OrganismRuntime must import the canonical cognitive kernel',
);
assert.match(
  runtime,
  /new CanonicalCognitiveKernel\(this\.cognitiveEventFabric,\s*this\.unifiedCycle\)/,
  'the kernel must own the existing runtime ledgers rather than creating a parallel state store',
);
assert.match(runtime, /this\.canonicalCognitiveKernel\.beginDecisionCycle\(/,
  'the live runtime must send decision stages through the canonical kernel');
assert.match(runtime, /this\.canonicalCognitiveKernel\.completeCycle\(/,
  'the live runtime must close the action with outcome, learning and self-update stages');
assert.match(runtime, /const cycleLineage = cycleCompletion\.cycleLineage;/,
  'the runtime must consume causal verification from the same kernel completion');
assert.match(runtime, /cycleCompletion\.cycleResult \?\? \{/,
  'missing kernel completion must fail closed rather than invent a completed cycle');
assert.doesNotMatch(runtime, /this\.cognitiveEventFabric\.recordOperationalCycle\(/,
  'the live path must not retain the parallel manual stage writer');
assert.doesNotMatch(runtime, /this\.unifiedCycle\.evaluate\(/,
  'the live path must not independently evaluate a second cycle');
assert.match(runtime, /const innerIntent = deriveInnerImperative\(/,
  'the live runtime must derive an internal intent before plan construction');
assert.ok(
  runtime.indexOf('const innerIntent = deriveInnerImperative(') < runtime.indexOf('this.plans.build('),
  'internal intent must arbitrate before planning',
);
assert.match(runtime, /const internalAction = innerIntent\.selectedAction;/,
  'the inner intent action must feed the live plan and embodied-action path');
assert.match(runtime, /const selectedCandidate = innerIntent\.overridden \? null : cycle\.decision\.selected;/,
  'a homeostatic override must not credit the original incompatible candidate');
assert.match(runtime, /counterfactualBranchCount:branches\.length/,
  'the canonical future/plan stage must retain the counterfactual availability signal');
assert.match(runtime, /innerIntentId:innerIntent\.id/,
  'the canonical causal cycle must connect the intention to later evidence');
assert.match(runtime, /causalMemoryContext:\s*\{\s*traceId: innerIntent\.id,\s*memoryIds: cycle\.memories\.slice\(0, 12\)\.map\(memory => memory\.id\),\s*attributionEligible: !innerIntent\.overridden/s,
  'the live runtime must pass decision-time memory IDs and attribution eligibility into Core feedback');
assert.match(core, /causalMemoryContext\?: \{ traceId: string; memoryIds: string\[\]; attributionEligible: boolean;/,
  'Core feedback must accept the matching causal memory context');
assert.match(core, /const explicitCausalMemoryIds = \[\.\.\.new Set\(\(outcome\.causalMemoryContext\?\.memoryIds \?\? \[\]\)/,
  'Core feedback must include the exact memory IDs used in this runtime decision');
assert.match(core, /outcome\.causalMemoryContext\?\.attributionEligible === false && explicitCausalMemoryIds\.includes\(memoryId\)/,
  'a redirected action must not assign decision-level causal credit to the current cycle memories');
assert.match(core, /A homeostatic redirect may still update emotional salience below, but must not teach a decision-level causal link/,
  'the no-credit rule must leave outcome/emotion reconsolidation separate from action attribution');
assert.match(runtime, /innerIntentMemoryTrace:\s*\{/,
  'the existing experience event must preserve the intent/outcome trace for autobiographical consolidation');
assert.match(runtime, /retrievedMemoryIds:\s*cycle\.memories\.slice\(0, 12\)\.map\(memory => memory\.id\)/,
  'the trace must retain which canonical memories were available to the decision');
assert.match(runtime, /observation: observationEvidence\.id,\s*prediction: predictionEvidence\.id,\s*action: actionEvidence\.id,\s*outcome: outcomeEvidence\.id/s,
  'the trace must bind intent to the four existing evidence receipts');
assert.match(runtime, /attributionEligible: !innerIntent\.overridden/,
  'a redirected action must not be credited to the original proposal');
assert.match(runtime, /observedReward01: clamp01\(grounded\.reward01\)/,
  'the trace must distinguish outcome from the plan prediction');
assert.match(runtime, /counterfactualBranches: branches\.slice\(0, 6\)\.map\(\(branch, index\)/,
  'the memory trace must retain only a bounded ranked sample of imagined futures');
assert.match(runtime, /counterfactualDisagreesWithPlan: Boolean\(branches\[0\]\?\.actions\[0\]/,
  'the trace must expose when the best simulated future differs from the committed plan');
assert.match(runtime, /These are model predictions and remain explicitly separate from outcome evidence/,
  'counterfactual predictions must not be conflated with grounded outcomes');

const baseInput = {
  tick: 7,
  hasExternalRequest: false,
  spontaneous: true,
  proposedAction: 'explore',
  selectedGoalId: 'goal-7',
  needs: {
    energy01: 0.72, cognitiveLoad01: 0.22, uncertainty01: 0.24,
    novelty01: 0.4, goalPressure01: 0.31, socialNeed01: 0.2,
  },
  embodiment: { awake: true, bodyEnergy01: 0.76, cognitiveCapacity01: 0.82, thermalStrain01: 0.18 },
  predictionError01: 0.22,
};
const normalIntent = deriveInnerImperative(baseInput);
assert.equal(normalIntent.selectedAction, 'explore');
assert.equal(normalIntent.overridden, false);
assert.equal(normalIntent.source, 'endogenous');
assert.equal(normalIntent.motive, 'continuity');
assert.equal(normalIntent.futureReviewRequired, false);
assert.equal(normalIntent.id, 'inner-intent:7');

const lowEnergyIntent = deriveInnerImperative({
  ...baseInput,
  needs: { ...baseInput.needs, energy01: 0.17 },
  embodiment: { ...baseInput.embodiment, bodyEnergy01: 0.16 },
});
assert.equal(lowEnergyIntent.selectedAction, 'rest');
assert.equal(lowEnergyIntent.overridden, true);
assert.equal(lowEnergyIntent.motive, 'homeostatic');
assert.equal(lowEnergyIntent.reason, 'energy-budget-needs-recovery');

const sleepingIntent = deriveInnerImperative({
  ...baseInput,
  embodiment: { ...baseInput.embodiment, awake: false },
});
assert.equal(sleepingIntent.selectedAction, 'wait');
assert.equal(sleepingIntent.reason, 'sleep-boundary-defers-autonomous-action');

const epistemicIntent = deriveInnerImperative({
  ...baseInput,
  needs: { ...baseInput.needs, uncertainty01: 0.81 },
  predictionError01: 0.74,
});
assert.equal(epistemicIntent.motive, 'epistemic-gap');
assert.equal(epistemicIntent.futureReviewRequired, true);
assert.equal(epistemicIntent.selectedAction, 'explore',
  'uncertainty records a review requirement but does not arbitrarily rewrite an otherwise safe action');

const userDirectedIntent = deriveInnerImperative({
  ...baseInput,
  hasExternalRequest: true,
  needs: { ...baseInput.needs, energy01: 0.08 },
  embodiment: { ...baseInput.embodiment, bodyEnergy01: 0.08 },
});
assert.equal(userDirectedIntent.source, 'external');
assert.equal(userDirectedIntent.selectedAction, 'explore',
  'internal homeostasis must not silently rewrite an explicitly user-directed decision');
assert.equal(userDirectedIntent.overridden, false);

const nonAutonomousIntent = deriveInnerImperative({
  ...baseInput,
  spontaneous: false,
  needs: { ...baseInput.needs, energy01: 0.08 },
  embodiment: { ...baseInput.embodiment, bodyEnergy01: 0.08 },
});
assert.equal(nonAutonomousIntent.selectedAction, 'explore',
  'the homeostatic intent gate only overrides autonomous spontaneous actions');
assert.equal(nonAutonomousIntent.source, 'continuity');
assert.throws(() => deriveInnerImperative({ ...baseInput, tick: Number.NaN }), /tick/);
const malformedSignals = deriveInnerImperative({
  ...baseInput,
  needs: { ...baseInput.needs, energy01: Number.NaN },
  embodiment: { ...baseInput.embodiment, bodyEnergy01: Number.POSITIVE_INFINITY },
});
assert.equal(malformedSignals.resourceState.energy01, 0.5);
assert.equal(malformedSignals.resourceState.bodyEnergy01, 0.5);
assert.equal(malformedSignals.selectedAction, 'explore');

console.log('canonical-cognitive-kernel-runtime-wiring + inner-imperative behavior: PASS');
