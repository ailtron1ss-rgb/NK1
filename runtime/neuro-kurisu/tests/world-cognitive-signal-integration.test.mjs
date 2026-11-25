import assert from 'node:assert/strict';
import test from 'node:test';

import { P81PredictiveAttention } from '../src/organism/cognition/P81PredictiveAttention.ts';
import { EmotionAppraisalEngine } from '../src/organism/system/EmotionAppraisalEngine.ts';
import { WorldSubsystemRuntime } from '../src/organism/core/WorldSubsystemRuntime.ts';
import { defaultGroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';

const candidates = [
  { action: 'respond', score: .60, predictedUtility: .60, confidence: .8 },
  { action: 'verify', score: .60, predictedUtility: .60, confidence: .8 },
  { action: 'explore', score: .60, predictedUtility: .60, confidence: .8 },
];

const baseAttentionInput = {
  tick: 12,
  candidates,
  uncertainty01: .20,
  predictionError01: .10,
  goalPressure01: .10,
  noveltyPressure01: .10,
  attentionBudget01: .80,
  externalInput: false,
};

test('P81 gives world conflicts first-class attention and a bounded verify bias', () => {
  const baseline = new P81PredictiveAttention();
  baseline.evaluate(baseAttentionInput);
  const baselineVerifyBias = baseline.actionBias('verify');

  const attention = new P81PredictiveAttention();
  const result = attention.evaluate({
    ...baseAttentionInput,
    worldState: {
      revision: 17,
      evidenceClass: 'mixed',
      evidenceConfidence01: .55,
      uncertainty01: .35,
      changeMagnitude01: .30,
      conflict01: .80,
      unresolved01: .20,
      modelDisagreement01: .75,
      predictionError01: .40,
    },
  });

  assert.equal(result.attentionFocus, 'world-conflict');
  assert.ok(result.expectedInformationGain01 > baseline.snapshot().expectedInformationGain01 + .04);
  assert.ok(attention.actionBias('verify') > baselineVerifyBias + .02);
  assert.ok(attention.actionBias('verify') - baselineVerifyBias <= .04,
    'world evidence must remain a bounded bias, not a second action selector');
  assert.equal(attention.snapshot().worldRevision, 17);
});

test('world conflict and prediction disagreement modulate appraisal without replacing internal state', () => {
  const common = {
    tick: 13,
    goalPressure01: .10,
    goalCongruence01: .50,
    controllability01: .80,
    novelty01: .10,
    selfRelevance01: .50,
    socialMeaning01: 0,
    uncertainty01: .20,
    predictionError01: .10,
    homeostaticPressure01: .10,
    energy01: .80,
    success01: .50,
  };
  const baseline = new EmotionAppraisalEngine().appraise(common);
  const worldAware = new EmotionAppraisalEngine().appraise({
    ...common,
    worldChange01: .80,
    worldConflict01: .70,
    worldDisagreement01: .60,
    worldUncertainty01: .80,
    worldEvidenceConfidence01: .45,
  });

  assert.ok(worldAware.appraisal.relevance01 > baseline.appraisal.relevance01 + .10);
  assert.ok(worldAware.appraisal.novelty01 > baseline.appraisal.novelty01 + .10);
  assert.ok(worldAware.appraisal.uncertainty01 > baseline.appraisal.uncertainty01 + .10);
  assert.ok(worldAware.confidence01 <= baseline.confidence01,
    'conflicting and weakly grounded world evidence must not inflate appraisal confidence');
});

test('WorldSubsystemRuntime exports a read-only provenance-aware cognitive signal', () => {
  const runtime = new WorldSubsystemRuntime();
  const initial = defaultGroundedWorldState();
  const snapshot = {
    ...initial,
    revision: 17,
    lastAt: 200,
    location: 'lab',
    uncertainty01: .40,
    confidence01: .60,
    entities: [{
      id: 'door-1',
      label: 'door',
      kind: 'object',
      confidence01: .8,
      present01: 1,
      firstSeenAt: 100,
      lastSeenAt: 200,
      modalities: ['vision', 'semantic'],
      trackId: 'door-1',
      trackAliases: [],
      sourceIds: ['capture-17', 'semantic-17'],
      modalityEvidenceKinds: { vision: 'observed', semantic: 'conflict' },
      visibilityKnown: true,
      presenceStatus: 'visible',
      persistence01: .8,
      absenceEvidence01: 0,
      observationCount: 2,
    }],
    events: [{
      id: 'event-17',
      label: 'door-transition',
      confidence01: .7,
      lastAt: 200,
      persistence01: .5,
      evidenceKind: 'conflict',
      modalityEvidenceKinds: { vision: 'observed', predictor: 'conflict' },
    }],
    facts: ['door changed state'],
    provenanceIds: ['capture-17'],
    lastHash: 'world-17',
  };
  runtime.groundedWorld.restore(snapshot);

  assert.equal(typeof runtime.cognitiveAttentionSignal, 'function',
    'the canonical world owner must provide the shared world→cognition signal');

  const before = runtime.groundedWorld.snapshot();
  const signal = runtime.cognitiveAttentionSignal();

  assert.equal(signal.revision, 17);
  assert.equal(signal.evidenceClass, 'mixed');
  assert.ok(signal.conflict01 > .25);
  assert.ok(signal.evidenceConfidence01 >= 0 && signal.evidenceConfidence01 <= 1);
  assert.deepEqual(runtime.groundedWorld.snapshot(), before,
    'reading the cognitive signal must not mutate canonical world state');
  assert.equal(JSON.stringify(signal).includes('door changed state'), false,
    'the signal carries bounded metrics, not raw world text');
});
import { readFileSync } from 'node:fs';
import { B272EndogenousGoalGenesis } from '../src/organism/cognition/B272EndogenousGoalGenesis.ts';
import { B273AutonomousGoalLifecycle } from '../src/organism/cognition/B273AutonomousGoalLifecycle.ts';
import { IntrinsicMotivationEngine } from '../src/organism/cognition/IntrinsicMotivationEngine.ts';
import { IntrinsicMotivationGoalCoupling } from '../src/organism/cognition/IntrinsicMotivationGoalCoupling.ts';
import { PlanEngine } from '../src/organism/world/PlanEngine.ts';
import { CounterfactualEngine } from '../src/organism/world/CounterfactualEngine.ts';
import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';

const endogenousCycle = {
  tick: 1,
  selfLatent: new Array(16).fill(.12),
  worldLatent: new Array(16).fill(.08),
  needs: {
    energy01: .90,
    uncertainty01: .15,
    novelty01: .20,
    goalPressure01: .15,
    socialNeed01: .20,
  },
  traits: {
    curiosity: .65,
    'truth-seeking': .75,
    'self-reflection': .70,
    'self-preservation': .65,
    care: .55,
    'social-attunement': .50,
    persistence: .70,
  },
  predictionError01: .10,
  autobiographicalContinuity01: .90,
  identityContinuity01: .92,
  intrinsicReward01: .30,
  lastAction: null,
  lastReward01: .50,
};

const worldConflictSignal = {
  version: 1,
  revision: 9,
  evidenceClass: 'mixed',
  evidenceConfidence01: .45,
  uncertainty01: .78,
  changeMagnitude01: .55,
  conflict01: .88,
  unresolved01: .58,
  modelDisagreement01: .82,
  predictionError01: .74,
};

const endogenousDrive = {
  uncertainty: .15,
  predictionError: .10,
  novelty: .20,
  goalPressure: .20,
  socialNeed: .10,
  energy: .90,
  lastSuccess: .50,
  worldEvidenceQuality: .75,
};

test('B272 uses world conflict to raise verification need while reducing unsupported goal confidence', () => {
  const run = (worldEvidence) => new IntrinsicMotivationGoalCoupling(
    new IntrinsicMotivationEngine(),
    new B272EndogenousGoalGenesis(),
  ).step({
    cycle: { ...endogenousCycle, ...(worldEvidence ? { worldEvidence } : {}) },
    drive: endogenousDrive,
    driveConfidence01: .8,
  });

  const baseline = run(null);
  const conflicted = run(worldConflictSignal);

  assert.ok(conflicted.goal.selfConflict01 > baseline.goal.selfConflict01 + .05,
    'B272 must represent contradictory world evidence in its candidate conflict');
  assert.ok(conflicted.goal.confidence01 < baseline.goal.confidence01,
    'world disagreement must reduce confidence rather than make an uncertain goal look stronger');
  assert.ok(conflicted.goal.predictedFutureValue01 < baseline.goal.predictedFutureValue01,
    'unsupported world claims must not inflate predicted future value');
});

test('B273 uses world uncertainty to preserve verification in the active goal plan', () => {
  const lifecycleInput = {
    tick: 1,
    endogenousGoalVector: new Array(8).fill(.12),
    selfLatent: new Array(16).fill(.10),
    worldLatent: new Array(16).fill(.08),
    neuralAssembly: new Array(16).fill(.04),
    needs: {
      energy01: .90,
      uncertainty01: .08,
      novelty01: .10,
      goalPressure01: .10,
      socialNeed01: .10,
      autonomy01: .82,
      coherence01: .88,
    },
    traits: {
      curiosity: .25,
      'truth-seeking': .85,
      'self-reflection': .75,
      'self-preservation': .65,
      care: .5,
      persistence: .7,
    },
    predictionError01: .05,
    identityContinuity01: .95,
    autobiographicalContinuity01: .95,
    availableActions: ['explore', 'verify', 'reflect'],
  };
  const baseline = new B273AutonomousGoalLifecycle().step(lifecycleInput);
  const worldAware = new B273AutonomousGoalLifecycle().step({
    ...lifecycleInput,
    worldEvidence: worldConflictSignal,
  });

  assert.ok(worldAware.conflict01 > baseline.conflict01 + .05,
    'B273 must include grounded world conflict in its goal-lifecycle assessment');
  assert.ok(worldAware.confidence01 < baseline.confidence01,
    'B273 must lower confidence when the current world state is unresolved');
  assert.ok(worldAware.plan.includes('verify'),
    'a conflicted world state must retain verification in the active plan');
});

test('model-only world change does not create grounded novelty for endogenous goals', () => {
  const run = (worldEvidence) => new IntrinsicMotivationGoalCoupling(
    new IntrinsicMotivationEngine(),
    new B272EndogenousGoalGenesis(),
  ).step({
    cycle: { ...endogenousCycle, ...(worldEvidence ? { worldEvidence } : {}) },
    drive: endogenousDrive,
    driveConfidence01: .8,
  });

  const baseline = run(null);
  const inferredOnly = run({
    ...worldConflictSignal,
    evidenceClass: 'inferred',
    evidenceConfidence01: .95,
    uncertainty01: 0,
    conflict01: 0,
    unresolved01: 0,
    modelDisagreement01: 0,
    predictionError01: 0,
    changeMagnitude01: 1,
  });

  assert.ok(inferredOnly.goal.novelty01 <= baseline.goal.novelty01 + .001,
    'an inferred-only model change must not be treated as an observed world novelty');
});

test('core sends the same grounded world signal to B272 and B273 before goal admission', () => {
  const coreSource = readFileSync(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');

  assert.match(coreSource,
    /intrinsicMotivationGoalCoupling\.step\(\{\s*cycle:\s*\{[\s\S]*?worldEvidence:\s*earlyWorldCognitiveSignal/,
    'B272 must receive the read-only world signal through the existing intrinsic-motivation coupling');
  assert.match(coreSource,
    /autonomousGoalLifecycleB273\.step\(\{[\s\S]*?worldEvidence:\s*earlyWorldCognitiveSignal/,
    'B273 must receive the same pre-admission world signal');
  assert.match(coreSource,
    /canonicalSelfAgencyAuthority\.admitGoal\(/,
    'world evidence must not bypass canonical self-agency goal admission');
});
test('PlanEngine bounds speculative horizon and confidence when grounded world evidence conflicts', () => {
  const baseline = new PlanEngine(new WorldEnvironment()).build(null, 'explore', 4, 4);
  const worldAware = new PlanEngine(new WorldEnvironment()).build(null, 'explore', 4, 4, worldConflictSignal);

  assert.ok(worldAware.searchDepth < baseline.searchDepth,
    'high world conflict must shorten speculative planning horizon');
  assert.ok(worldAware.steps[0].confidence < baseline.steps[0].confidence,
    'world conflict must lower confidence in predicted plan outcomes');
  assert.equal(worldAware.worldEvidenceRevision, worldConflictSignal.revision,
    'the plan must retain the source world revision for review');
  assert.ok(worldAware.worldVerificationPressure01 >= .6,
    'the plan must expose a bounded verification-pressure diagnostic');
});

test('budget fallback remains one-step and discounts confidence under world conflict', () => {
  const baselineEnvironment = new WorldEnvironment();
  const worldEnvironment = new WorldEnvironment();
  const before = worldEnvironment.snapshot();
  const baseline = new PlanEngine(baselineEnvironment).buildBudgetFallback(null, 'explore', 'test');
  const worldAware = new PlanEngine(worldEnvironment).buildBudgetFallback(null, 'explore', 'test', worldConflictSignal);

  assert.equal(worldAware.steps.length, 1);
  assert.equal(worldAware.searchDepth, 1);
  assert.equal(worldAware.beamWidth, 1);
  assert.ok(worldAware.steps[0].confidence < baseline.steps[0].confidence,
    'fallback must not present an uncertain world projection as high confidence');
  assert.equal(worldAware.worldEvidenceRevision, worldConflictSignal.revision);
  assert.deepEqual(worldEnvironment.snapshot(), before,
    'world-aware fallback must remain a pure projection without committing the environment');
});

test('runtime passes one read-only world signal into both normal and budget-gated planning', () => {
  const coreSource = readFileSync(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
  const runtimeSource = readFileSync(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');

  assert.match(coreSource,
    /worldCognitiveAttentionSignal\(\)\s*\{\s*return this\.worldSubsystem\.cognitiveAttentionSignal\(\);\s*\}/,
    'Core must expose the canonical read-only world signal without a second world owner');
  assert.match(runtimeSource,
    /const worldPlanningSignal = this\.core\.worldCognitiveAttentionSignal\(\);/,
    'the runtime must take one world evidence snapshot for the plan');
  assert.match(runtimeSource,
    /this\.plans\.build\([\s\S]{0,220}worldPlanningSignal/,
    'normal beam planning must consume the world evidence snapshot');
  assert.match(runtimeSource,
    /this\.plans\.buildBudgetFallback\([\s\S]{0,220}worldPlanningSignal/,
    'budget-gated fallback must consume the same world evidence snapshot');
});
test('counterfactual rollout respects zero and one-branch resource limits', () => {
  const environment = new WorldEnvironment();
  const engine = new CounterfactualEngine(environment);
  const before = environment.snapshot();

  const none = engine.imagine('inspect', 2, 0);
  const one = engine.imagine('inspect', 2, 1);
  const three = engine.imagine('inspect', 2, 3);

  assert.equal(none.length, 0,
    'a zero counterfactual branch budget must not be raised to a hidden minimum');
  assert.equal(one.length, 1,
    'a one-branch budget must not silently create two or more paths');
  assert.ok(three.length <= 3,
    'counterfactual output must never exceed the requested branch width');
  assert.ok(one[0].actions.length <= 2,
    'the planning horizon must remain separate from the branch-count budget');
  assert.deepEqual(environment.snapshot(), before,
    'counterfactual search must remain a pure shadow projection');
});

test('runtime sends rollout depth and branch budget to the correct CounterfactualEngine arguments', () => {
  const runtimeSource = readFileSync(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');

  assert.ok(runtimeSource.includes(
    'this.counterfactuals.imagine(plan.steps[0]?.environmentAction, Math.max(1, Math.min(4, plan.searchDepth)), resourceAllocation.maxCounterfactualBranches)'
  ), 'runtime must use plan depth as horizon and resourceAllocation.maxCounterfactualBranches as beam width');
});


const stableLifecycleInput = (tick, worldEvidence) => ({
  tick,
  endogenousGoalVector: [.65, .32, -.18, .12, .44, -.22, .16, .27],
  selfLatent: new Array(16).fill(.10),
  worldLatent: new Array(16).fill(.08),
  neuralAssembly: new Array(16).fill(.04),
  needs: {
    energy01: .90, uncertainty01: .12, novelty01: .25, goalPressure01: .25,
    socialNeed01: .15, autonomy01: .85, coherence01: .86,
  },
  traits: {
    curiosity: .70, 'truth-seeking': .85, 'self-reflection': .70,
    'self-preservation': .65, care: .55, persistence: .75,
  },
  predictionError01: .12,
  identityContinuity01: .92,
  autobiographicalContinuity01: .90,
  availableActions: ['explore', 'verify', 'reflect', 'respond', 'rest', 'wait', 'defer'],
  ...(worldEvidence ? { worldEvidence } : {}),
});

const positiveGoalOutcome = (step, tick, overrides = {}) => ({
  tick,
  goalId: step.goalId,
  action: step.action,
  plannedAction: step.action,
  plan: step.plan,
  outcomeId: `goal-outcome:${tick}:${step.goalId}:${step.action}`,
  reward01: .92,
  predictionError01: .08,
  independentGain01: .35,
  personalityAlignment01: .80,
  externalEvidence01: 0,
  ...overrides,
});

test('B273 credits a multi-step skill only after every planned action has a matching outcome', () => {
  const lifecycle = new B273AutonomousGoalLifecycle();
  const first = lifecycle.step(stableLifecycleInput(1));
  assert.ok(first.plan.length >= 2, 'fixture must produce a multi-step plan');

  const firstOutcome = lifecycle.learnFromOutcome(positiveGoalOutcome(first, 1));
  assert.equal(firstOutcome.skillCreated, false,
    'one successful first step must not certify the unexecuted remainder of a plan');
  assert.equal(lifecycle.snapshot().skills.length, 0);
  assert.equal(lifecycle.snapshot().planExecution.nextIndex, 1);

  const afterFirstStep = lifecycle.snapshot();
  const restored = new B273AutonomousGoalLifecycle();
  restored.restore(afterFirstStep);
  assert.deepEqual(restored.snapshot().planExecution, afterFirstStep.planExecution,
    'an in-flight plan execution must survive restart');

  let next = restored.step(stableLifecycleInput(2));
  assert.equal(next.goalId, first.goalId, 'the same active goal should retain its plan execution');
  assert.deepEqual(next.plan, first.plan.slice(1),
    'the next cycle must execute the remaining suffix, not restart or replace the plan');

  let tick = 2;
  while (restored.snapshot().planExecution && tick < 8) {
    const result = restored.learnFromOutcome(positiveGoalOutcome(next, tick));
    if (restored.snapshot().planExecution === null) {
      assert.equal(result.skillCreated, true,
        'a fully executed and positively evaluated plan may become a skill');
      break;
    }
    tick += 1;
    next = restored.step(stableLifecycleInput(tick));
  }

  const completed = restored.snapshot();
  assert.equal(completed.planExecution, null);
  assert.equal(completed.completedPlanRuns, 1);
  assert.equal(completed.skills.length, 1);
  assert.deepEqual(completed.skills[0].actions, first.plan,
    'learned skill must contain only the exact, fully executed action sequence');
});

test('B273 does not credit a plan-derived skill when governance selects an off-plan action', () => {
  const lifecycle = new B273AutonomousGoalLifecycle();
  const step = lifecycle.step(stableLifecycleInput(10));
  const wrongAction = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer']
    .find(action => action !== step.action);
  const before = lifecycle.snapshot();
  const result = lifecycle.learnFromOutcome(positiveGoalOutcome(step, 10, {
    action: wrongAction,
    outcomeId: `off-plan:10:${step.goalId}`,
  }));
  const after = lifecycle.snapshot();

  assert.equal(result.offPlan, true);
  assert.equal(after.learningUpdates, before.learningUpdates + 1,
    'the actual outcome may inform the same active goal, but not the abandoned plan');
  assert.equal(after.outcomeHistory.length, before.outcomeHistory.length + 1);
  assert.equal(after.outcomeHistory.at(-1).onPlan, false);
  assert.equal(after.skills.length, 0,
    'an off-plan action must never certify the unexecuted planned sequence');
  assert.equal(after.offPlanOutcomes, before.offPlanOutcomes + 1);
  assert.equal(after.planExecution, null);
});

test('B273 outcome credit is idempotent for duplicate outcome IDs and ticks', () => {
  const lifecycle = new B273AutonomousGoalLifecycle();
  const step = lifecycle.step(stableLifecycleInput(20));
  const outcome = positiveGoalOutcome(step, 20);
  const accepted = lifecycle.learnFromOutcome(outcome);
  const afterAccepted = lifecycle.snapshot();
  const duplicate = lifecycle.learnFromOutcome(outcome);
  const afterDuplicate = lifecycle.snapshot();

  assert.equal(accepted.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(afterDuplicate.learningUpdates, afterAccepted.learningUpdates);
  assert.equal(afterDuplicate.outcomeHistory.length, afterAccepted.outcomeHistory.length);
  assert.equal(afterDuplicate.goals.find(g => g.id === step.goalId).progress01,
    afterAccepted.goals.find(g => g.id === step.goalId).progress01);
  assert.equal(afterDuplicate.duplicateOutcomes, afterAccepted.duplicateOutcomes + 1);
});

test('B273 rejects outcomes belonging to a different goal', () => {
  const lifecycle = new B273AutonomousGoalLifecycle();
  const step = lifecycle.step(stableLifecycleInput(30));
  const before = lifecycle.snapshot();
  const result = lifecycle.learnFromOutcome(positiveGoalOutcome(step, 30, {
    goalId: 'foreign-goal',
    outcomeId: 'foreign-goal-outcome',
  }));
  const after = lifecycle.snapshot();

  assert.equal(result.rejected, true);
  assert.equal(after.learningUpdates, before.learningUpdates);
  assert.equal(after.goals.find(g => g.id === step.goalId).progress01,
    before.goals.find(g => g.id === step.goalId).progress01);
  assert.equal(after.offPlanOutcomes, before.offPlanOutcomes);
});

test('B273 aborts an in-flight plan when new world evidence makes verification urgent', () => {
  const lifecycle = new B273AutonomousGoalLifecycle();
  const first = lifecycle.step(stableLifecycleInput(40));
  lifecycle.learnFromOutcome(positiveGoalOutcome(first, 40));
  const pending = lifecycle.snapshot().planExecution;
  assert.ok(pending);

  const conflicted = lifecycle.step(stableLifecycleInput(41, worldConflictSignal));
  const current = lifecycle.snapshot();

  assert.equal(current.planExecution.nextIndex, 0,
    'a high-conflict world update must discard the stale plan suffix');
  assert.equal(conflicted.action, 'verify',
    'high world conflict should make verification the first step of the replacement plan');
  assert.notDeepEqual(conflicted.plan, pending.actions.slice(pending.nextIndex));
});

test('core binds B273 goal outcome credit to the admitted goal and selected action', () => {
  const coreSource = readFileSync(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');

  assert.match(coreSource,
    /autonomousGoalLifecycleB273\.learnFromOutcome\(\{[\s\S]*?goalId:\s*b273Current\.goal\?\.id[\s\S]*?plannedAction:\s*b273Current\.action[\s\S]*?outcomeId:/,
    'real runtime goal learning must carry goal identity, planned action and idempotent outcome key');
  assert.match(coreSource,
    /autonomousGoalLifecycleB273\.learnFromOutcome\(\{[\s\S]*?goalId:\s*b338Lifecycle\.goal\?\.id[\s\S]*?plannedAction:\s*b338Lifecycle\.action[\s\S]*?outcomeId:/,
    'embodied outcome learning must use the same exact-goal attribution contract');
});


test('P81 ignores delayed world snapshots and preserves the newest revision', () => {
  const attention = new P81PredictiveAttention();
  attention.evaluate({
    ...baseAttentionInput,
    worldState: {
      revision: 22, evidenceClass: 'mixed', evidenceConfidence01: .7,
      uncertainty01: .2, changeMagnitude01: .2, conflict01: .8,
      unresolved01: .2, modelDisagreement01: .6, predictionError01: .2,
    },
  });
  const newest = attention.snapshot();
  attention.evaluate({
    ...baseAttentionInput,
    tick: 13,
    worldState: {
      revision: 19, evidenceClass: 'observed', evidenceConfidence01: 1,
      uncertainty01: 0, changeMagnitude01: 0, conflict01: 0,
      unresolved01: 0, modelDisagreement01: 0, predictionError01: 0,
    },
  });
  assert.equal(attention.snapshot().worldRevision, 22,
    'a delayed world snapshot must not roll back the cognitive world revision');
  assert.equal(attention.snapshot().worldEvidenceClass, newest.worldEvidenceClass);
  assert.equal(attention.snapshot().worldConflict01, newest.worldConflict01);
  assert.equal(attention.snapshot().attentionFocus, 'world-conflict',
    'stale input must not erase the active conflict focus');
});

test('P81 rejects malformed world signals instead of treating them as grounded evidence', () => {
  const attention = new P81PredictiveAttention();
  attention.evaluate({
    ...baseAttentionInput,
    worldState: {
      revision: 4, evidenceClass: 'observed', evidenceConfidence01: 1,
      uncertainty01: 0, changeMagnitude01: 1, conflict01: 0,
      unresolved01: 0, modelDisagreement01: 0, predictionError01: 0,
    },
  });
  const before = attention.snapshot();
  attention.evaluate({
    ...baseAttentionInput,
    tick: 13,
    worldState: {
      revision: 5, evidenceClass: 'observed', evidenceConfidence01: 1,
      uncertainty01: 0, changeMagnitude01: Number.NaN, conflict01: 0,
      unresolved01: 0, modelDisagreement01: 0, predictionError01: 0,
    },
  });
  assert.equal(attention.snapshot().worldRevision, before.worldRevision);
  assert.equal(attention.snapshot().worldChange01, before.worldChange01);
  assert.equal(attention.snapshot().worldEvidenceClass, before.worldEvidenceClass);
});


test('P81 sanitizes malformed persisted attention state before it can affect action bias', () => {
  const attention = new P81PredictiveAttention();
  attention.restore({
    cycles: -9,
    selectedAction: { forged: true },
    attentionFocus: 'x'.repeat(5000),
    expectedInformationGain01: Number.NaN,
    exploitation01: -2,
    exploration01: Number.POSITIVE_INFINITY,
    uncertainty01: 3,
    recentFocus: ['ok', 7, 'y'.repeat(5000)],
    worldRevision: -1,
    worldConflict01: Number.NaN,
    worldDisagreement01: 2,
    worldUnresolved01: -1,
    worldChange01: Number.POSITIVE_INFINITY,
  });

  const state = attention.snapshot();
  assert.equal(state.cycles, 0);
  assert.equal(state.selectedAction, 'wait');
  assert.equal(state.attentionFocus, 'none');
  assert.equal(state.expectedInformationGain01, .2);
  assert.equal(state.exploitation01, 0);
  assert.equal(state.exploration01, .5);
  assert.equal(state.uncertainty01, 1);
  assert.deepEqual(state.recentFocus, ['ok']);
  assert.equal(state.worldRevision, 0);
  assert.equal(state.worldConflict01, 0);
  assert.equal(state.worldDisagreement01, 1);
  assert.equal(state.worldUnresolved01, 0);
  assert.equal(state.worldChange01, 0);
  assert.ok(Number.isFinite(attention.actionBias('verify')));
});
