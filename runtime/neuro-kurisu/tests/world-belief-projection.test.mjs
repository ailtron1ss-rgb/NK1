import assert from 'node:assert/strict';
import testCase from 'node:test';
import { projectWorldCognitiveSignal } from '../src/organism/world/WorldBeliefProjection.ts';
const baseSnapshot = (entityOverrides = {}, snapshotOverrides = {}) => ({
  revision: 7, confidence01: 0.9, uncertainty01: 0.1,
  entities: [{
    id: 'entity-1', confidence01: 0.9, lastSeenAt: 99_000, observationCount: 3,
    modalities: ['vision'], modalityEvidenceKinds: { vision: 'observed' },
    sourceIds: ['camera:front'], presenceStatus: 'visible', absenceEvidence01: 0,
    ...entityOverrides,
  }],
  ...snapshotOverrides,
});
testCase('fresh sourced observations produce an observed, confidence-bearing signal', () => {
  const signal = projectWorldCognitiveSignal({ snapshot: baseSnapshot(), at: 100_000 });
  assert.equal(signal.evidenceClass, 'observed'); assert.ok(signal.evidenceConfidence01 > 0.5);
  assert.ok(signal.uncertainty01 < 0.5); assert.equal(signal.revision, 7);
});
testCase('stale observations lose confidence and become unresolved rather than remaining current facts', () => {
  const signal = projectWorldCognitiveSignal({ snapshot: baseSnapshot({ lastSeenAt: 0 }), at: 3_600_000 });
  assert.equal(signal.evidenceClass, 'unknown'); assert.ok(signal.evidenceConfidence01 < 1e-20,
    'stale evidence confidence should decay to numerical zero');
  assert.ok(signal.unresolved01 > 0.7); assert.ok(signal.uncertainty01 >= 0.65);
});
testCase('model output is inferred evidence and never becomes observed evidence', () => {
  const signal = projectWorldCognitiveSignal({ snapshot: baseSnapshot({ modalityEvidenceKinds: { vision: 'model-output' }, sourceIds: ['model:vision'] }), at: 100_000 });
  assert.equal(signal.evidenceClass, 'inferred'); assert.ok(signal.evidenceConfidence01 > 0);
});
testCase('an observed label without source provenance is downgraded to unresolved', () => {
  const signal = projectWorldCognitiveSignal({ snapshot: baseSnapshot({ sourceIds: [] }), at: 100_000 });
  assert.equal(signal.evidenceClass, 'unknown'); assert.ok(signal.unresolved01 > 0.9); assert.equal(signal.evidenceConfidence01, 0);
});
testCase('conflicting modalities remain explicit and increase epistemic uncertainty', () => {
  const signal = projectWorldCognitiveSignal({ snapshot: baseSnapshot({ modalityEvidenceKinds: { vision: 'observed', audio: 'conflict' } }), at: 100_000 });
  assert.equal(signal.evidenceClass, 'mixed'); assert.ok(signal.conflict01 > 0.2); assert.ok(signal.uncertainty01 > 0.2);
});
testCase('future timestamps beyond the clock-skew allowance cannot create fresh observations', () => {
  const signal = projectWorldCognitiveSignal({ snapshot: baseSnapshot({ lastSeenAt: 900_000 }), at: 100_000 });
  assert.equal(signal.evidenceClass, 'unknown'); assert.equal(signal.evidenceConfidence01, 0); assert.ok(signal.unresolved01 > 0.7);
});
testCase('model disagreement is ignored until at least one model comparison exists', () => {
  const cold = projectWorldCognitiveSignal({ snapshot: baseSnapshot(), learningStats: { observations: 0, modelAgreement01: 0 }, at: 100_000 });
  const measured = projectWorldCognitiveSignal({ snapshot: baseSnapshot(), learningStats: { observations: 2, modelAgreement01: 0.2 }, at: 100_000 });
  assert.equal(cold.modelDisagreement01, 0); assert.ok(measured.modelDisagreement01 > 0.7);
});
testCase('fading entities contribute change pressure without asserting confirmed absence', () => {
  const signal = projectWorldCognitiveSignal({ snapshot: baseSnapshot({ presenceStatus: 'fading', absenceEvidence01: 0.8 }), at: 100_000 });
  assert.ok(signal.changeMagnitude01 > 0.4); assert.equal(signal.evidenceClass, 'observed');
});
testCase('every projected scalar remains finite and bounded for malformed numeric state', () => {
  const signal = projectWorldCognitiveSignal({
    snapshot: baseSnapshot({ confidence01: Number.NaN, lastSeenAt: Number.POSITIVE_INFINITY, observationCount: -1, absenceEvidence01: Number.NaN },
      { confidence01: Number.NaN, uncertainty01: Number.POSITIVE_INFINITY, revision: -1 }),
    learningStats: { observations: Number.NaN, modelAgreement01: Number.NaN, lastPassiveError01: Number.POSITIVE_INFINITY, lastActionError01: -1 },
    latestModelError: Number.NaN, at: 100_000,
  });
  for (const key of ['evidenceConfidence01', 'uncertainty01', 'changeMagnitude01', 'conflict01', 'unresolved01', 'modelDisagreement01', 'predictionError01']) {
    assert.ok(Number.isFinite(signal[key]), key + ' must be finite');
    assert.ok(signal[key] >= 0 && signal[key] <= 1, key + ' must stay within [0, 1]');
  }
  assert.equal(signal.revision, 0);
});
