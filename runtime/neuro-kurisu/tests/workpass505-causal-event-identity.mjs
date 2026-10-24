import assert from 'node:assert/strict';
import { createRealityEvidenceEventId } from '../src/organism/system/EvidenceEventIdentity.ts';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';

const sourceId = 'wp505-grounded-trace';
const expected = createRealityEvidenceEventId(sourceId, 'learning', 'causal-record');
assert.match(expected, /^nk1-reality:learning:[a-f0-9]{48}$/,
  'canonical reality event IDs retain the persisted format');
assert.equal(expected, createRealityEvidenceEventId(sourceId, 'learning', 'causal-record'),
  'the same source tuple must produce the same identity');
assert.notEqual(expected, createRealityEvidenceEventId(sourceId, 'learning-external', 'causal-record'),
  'trusted runtime outcomes and external hypotheses must occupy separate identity lanes');
assert.throws(() => createRealityEvidenceEventId('bad\nsource', 'learning', 'causal-record'),
  /reality-evidence-event-identity-invalid/, 'control characters must fail closed');

const state = (tick, overrides = {}) => ({
  version: 1,
  tick,
  at: tick * 1000,
  needs: {
    energy: 0.72,
    cognitiveLoad: 0.2,
    uncertainty: 0.58,
    socialNeed: 0.3,
    novelty: 0.42,
    identityCoherence: 0.82,
    goalPressure: 0.48,
  },
  predictionError: 0.54,
  attentionBudget: 0.76,
  selfPredictionError: 0.3,
  lastAction: 'explore',
  lastActionSuccess: null,
  ...overrides,
});
const before = state(7);
const after = state(8, {
  needs: { ...before.needs, uncertainty: 0.22, energy: 0.75, novelty: 0.7 },
  lastAction: 'explore',
  lastActionSuccess: 0.96,
  predictionError: 0.31,
});
const trace = {
  id: sourceId,
  tick: 7,
  selected: { id: 'candidate-1', goalId: 'goal-1', action: 'explore' },
  stateBefore: before,
};
const stream = new CausalExperienceStream();
const grounded = stream.recordOutcome(trace, after, {
  reward01: 0.94, success01: 0.96, surprise01: 0.91, novelty01: 0.82,
});
assert.ok(grounded, 'a valid post-action transition should be recorded');
assert.equal(grounded.evidenceEventId, expected,
  'grounded learning records must use the canonical cross-subsystem identity');

const external = stream.recordExternalLearningEvent({
  tick: 8, taskId: 'wp505-imported-hypothesis', action: 'verify',
  reward01: 0.7, success01: 0.6, surprise01: 0.4, novelty01: 0.3,
  traceId: 'wp505-external-source',
});
assert.ok(external);
assert.equal(external.evidenceEventId,
  createRealityEvidenceEventId(external.traceId, 'learning-external', 'causal-record'),
  'imported observations must use the quarantined external identity namespace');
assert.equal(external.stateGrounded, false);
assert.notEqual(external.evidenceEventId, grounded.evidenceEventId);

const snapshot = stream.snapshot();
snapshot.records = snapshot.records.map(({ evidenceEventId, ...legacy }) => legacy);
const restored = new CausalExperienceStream();
restored.restore(snapshot);
assert.equal(restored.recent(8).find(row => row.traceId === sourceId)?.evidenceEventId, expected,
  'legacy persisted runtime records must reconstruct their canonical event identity');
assert.equal(restored.recent(8).find(row => row.traceId === external.traceId)?.evidenceEventId, external.evidenceEventId,
  'restores must preserve external identity without promoting external evidence');

console.log('WORKPASS505_CAUSAL_EVENT_IDENTITY=PASS');
