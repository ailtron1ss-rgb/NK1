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
