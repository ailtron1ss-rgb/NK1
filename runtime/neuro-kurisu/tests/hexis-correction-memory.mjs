import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CorrectionRuleMemory } from '../src/organism/learning/CorrectionRuleMemory.ts';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';

const sha = value => createHash('sha256').update(value).digest('hex');
const ruleId = sha('rule:avoid-unscoped-destructive-action');
const fingerprint = id => sha('authenticated-review-evidence:' + id);
const makeObservation = (id, overrides = {}) => ({
  schemaVersion: 1,
  ruleId,
  observationId: sha(id),
  reviewerId: 'reviewer:verified-fixture',
  reviewEvidenceFingerprint: fingerprint(id),
  reviewedAt: Number(id.match(/(\d+)$/)?.[1] ?? 1) * 100,
  severity: 'high',
  rootCause: 'context-pressure',
  binaryRule: true,
  correctionApplied: true,
  ...overrides,
});

const memory = new CorrectionRuleMemory(() => true);
const first = memory.record(makeObservation('observation-1'));
assert.equal(first.duplicate, false);
assert.equal(first.rule.stage, 'soft-rule');
assert.equal(first.rule.hardGateActive, false);
assert.equal(first.rule.requiresIndependentApproval, false);

const secondObservation = makeObservation('observation-2');
const second = memory.record(secondObservation);
assert.equal(second.rule.stage, 'gate-candidate',
  'two reviewed high-impact context-pressure violations should propose a gate review');
assert.equal(second.rule.requiresIndependentApproval, true);
assert.equal(second.rule.hardGateActive, false,
  'a recommendation must never silently become an active runtime gate');

const revisionBeforeDuplicate = memory.snapshot().revision;
assert.equal(memory.record(secondObservation).duplicate, true);
assert.equal(memory.snapshot().revision, revisionBeforeDuplicate);
assert.equal(memory.assess(ruleId).observationCount, 2,
  'duplicate delivery must not inflate recurrence evidence');

const ambiguousRuleId = sha('rule:ambiguous-preference');
for (let i = 1; i <= 4; i++) {
  memory.record(makeObservation('ambiguous-' + i, {
    ruleId: ambiguousRuleId,
    severity: 'medium',
    rootCause: 'ambiguous-rule',
    binaryRule: false,
  }));
}
const ambiguous = memory.assess(ambiguousRuleId);
assert.equal(ambiguous.stage, 'reinforced-rule');
assert.equal(ambiguous.recommendation, 'rewrite-rule');
assert.equal(ambiguous.hardGateActive, false,
  'ambiguous instructions should be rewritten, not hardened into brittle hooks');

const criticalRuleId = sha('rule:prevent-critical-data-loss');
const critical = memory.record(makeObservation('critical-1', {
  ruleId: criticalRuleId,
  severity: 'critical',
  rootCause: 'other',
  binaryRule: true,
})).rule;
assert.equal(critical.stage, 'gate-candidate',
  'critical severity may request immediate review after one validated incident');
assert.equal(critical.requiresIndependentApproval, true);
assert.equal(critical.hardGateActive, false);

assert.throws(() => new CorrectionRuleMemory().record(makeObservation('unverified-1')),
  /correction-review-evidence-not-authenticated/,
  'default-deny verifier must reject review claims it cannot authenticate');
assert.throws(() => memory.record(makeObservation('invalid-id', { ruleId: 'not-a-digest' })),
  /invalid-reviewed-correction-observation/);

const roundTrip = new CorrectionRuleMemory(() => true);
roundTrip.restore(memory.snapshot());
assert.deepEqual(roundTrip.snapshot(), memory.snapshot());
assert.deepEqual(roundTrip.rules(), memory.rules());

// A reused observation ID with different content is quarantined, not counted twice.
const conflictId = sha('reused-evidence-id');
const conflictMemory = new CorrectionRuleMemory(() => true);
conflictMemory.record(makeObservation('seed-10', { observationId: conflictId }));
assert.throws(() => conflictMemory.record(makeObservation('seed-11', { observationId: conflictId })),
  /correction-observation-id-conflict/);
assert.ok(conflictMemory.snapshot().quarantinedObservationIds.includes(conflictId));
assert.equal(conflictMemory.rules().length, 0);

// A different observation ID cannot turn the same signed review artifact into repeat evidence.
const reusedEvidenceMemory = new CorrectionRuleMemory(() => true);
const sharedReviewFingerprint = sha('one-review-artifact-used-twice');
reusedEvidenceMemory.record(makeObservation('reused-artifact-1', { reviewEvidenceFingerprint: sharedReviewFingerprint }));
assert.throws(() => reusedEvidenceMemory.record(makeObservation('reused-artifact-2', { reviewEvidenceFingerprint: sharedReviewFingerprint })),
  /correction-review-evidence-reused/);
assert.equal(reusedEvidenceMemory.assess(ruleId).observationCount, 1,
  'the same evidence fingerprint must not escalate a rule twice');

// Restore also quarantines duplicate evidence fingerprints instead of allowing persisted replay.
const restoreFirst = makeObservation('restore-artifact-1', { reviewEvidenceFingerprint: sharedReviewFingerprint });
const restoreReplay = makeObservation('restore-artifact-2', { reviewEvidenceFingerprint: sharedReviewFingerprint });
const restoredReplay = new CorrectionRuleMemory(() => true);
restoredReplay.restore({ schemaVersion: 1, revision: 2, observations: [restoreFirst, restoreReplay], quarantinedObservationIds: [] });
assert.equal(restoredReplay.assess(ruleId).observationCount, 1);
assert.ok(restoredReplay.snapshot().quarantinedObservationIds.includes(restoreReplay.observationId));

// The learning engine persists the correction memory inside its existing snapshot.
const engine = new P23LearningEngine();
assert.throws(() => engine.recordReviewedCorrection(makeObservation('engine-1')),
  /correction-review-evidence-not-authenticated/);
engine.configureCorrectionReviewVerifier(() => true);
engine.recordReviewedCorrection(makeObservation('engine-2'));
const curriculumTargets = engine.correctionLearningTargets();
assert.equal(curriculumTargets.length, 1);
assert.equal(curriculumTargets[0].family, 'correction-context-pressure');
assert.equal(curriculumTargets[0].repairValue01, 0.8);
assert.equal(curriculumTargets[0].blocked, false,
  'a correction is a learning target, not an implicit policy block');
const engineSnapshot = engine.snapshot();
assert.equal(engineSnapshot.correctionRules.observations.length, 1);
const restoredEngine = new P23LearningEngine();
restoredEngine.configureCorrectionReviewVerifier(() => true);
restoredEngine.restore(engineSnapshot);
assert.equal(restoredEngine.snapshot().correctionRules.observations.length, 1);
assert.equal(restoredEngine.correctionRules().length, 1);

// Legacy snapshots without the additive correction-memory field still restore.
const legacy = new P23LearningEngine();
legacy.restore({ version: 1, experiences: [], replayUpdates: [], shadow: [], skills: [], ablations: [], evidenceDebt: [] });
assert.equal(legacy.snapshot().correctionRules.observations.length, 0);

console.log('HEXiS correction-memory and escalation contracts passed');
