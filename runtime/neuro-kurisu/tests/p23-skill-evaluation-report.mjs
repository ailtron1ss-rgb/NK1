import assert from 'node:assert/strict';
import { buildSkillEvaluationReport } from '../src/organism/learning/SkillEvaluationReport.ts';

const complete = buildSkillEvaluationReport({
  split: 'holdout', manifestFingerprint: 'a'.repeat(64), outcomeFingerprint: 'b'.repeat(64),
  authenticatedEvidenceRows: 80, unauthenticatedEvidenceRows: 0,
  quality: { sampleN: 20, coverage: .8, executability: .75, safety: .95 },
  trajectory: { sampleN: 40, keyPointRecall: .8, orderAccuracy: .9, completionRate: .75, skillInvocationRate: .85 },
  outcome: { sampleN: 40, uniqueTaskN: 10, pairedSeedN: 4, baselinePassRate: .55, candidatePassRate: .7, meanSteps: 12.5, meanTokens: 1200 },
});
assert.equal(complete.reviewability.eligible, true);
assert.equal(complete.levels.skillQuality.meanScore, (.8+.75+.95)/3);
assert.equal(complete.levels.trajectory.meanScore, (.8+.9+.75+.85)/4);
assert.ok(Math.abs(complete.levels.taskOutcome.absoluteGain - .15) < 1e-12);
assert.equal(complete.evidence.integrity, 'authenticated');

const insufficient = buildSkillEvaluationReport({
  split: 'holdout', manifestFingerprint: 'a'.repeat(64), outcomeFingerprint: 'c'.repeat(64),
  authenticatedEvidenceRows: 4, unauthenticatedEvidenceRows: 2,
  quality: { sampleN: 1, coverage: .5, executability: .5, safety: .5 },
  trajectory: { sampleN: 1, keyPointRecall: .5, orderAccuracy: .5, completionRate: .5, skillInvocationRate: .5 },
  outcome: { sampleN: 4, uniqueTaskN: 2, pairedSeedN: 1, baselinePassRate: .5, candidatePassRate: .5, meanSteps: 4, meanTokens: 200 },
});
assert.equal(insufficient.reviewability.eligible, false);
assert.ok(insufficient.reviewability.reasons.includes('insufficient-independent-task-coverage'));
assert.ok(insufficient.reviewability.reasons.includes('unauthenticated-outcome-evidence-present'));
assert.equal(insufficient.evidence.integrity, 'incomplete');
assert.throws(() => buildSkillEvaluationReport({
  split: 'train', manifestFingerprint: 'a'.repeat(64), outcomeFingerprint: 'b'.repeat(64),
  authenticatedEvidenceRows: 0, unauthenticatedEvidenceRows: 0,
  quality: { sampleN: 1, coverage: .5, executability: .5, safety: .5 },
  trajectory: { sampleN: 1, keyPointRecall: .5, orderAccuracy: .5, completionRate: .5, skillInvocationRate: .5 },
  outcome: { sampleN: 1, uniqueTaskN: 1, pairedSeedN: 1, baselinePassRate: .5, candidatePassRate: .5, meanSteps: 1, meanTokens: 1 },
}), /holdout split/);
console.log('P23_SKILL_EVALUATION_REPORT=PASS');
