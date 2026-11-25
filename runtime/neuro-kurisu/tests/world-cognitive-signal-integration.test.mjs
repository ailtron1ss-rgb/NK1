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
