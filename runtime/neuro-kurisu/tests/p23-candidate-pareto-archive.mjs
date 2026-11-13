import assert from 'node:assert/strict';
import * as learning from '../src/organism/learning/P23LearningEngine.ts';

assert.equal(
  typeof learning.P23CandidateParetoArchive,
  'function',
  'P23 must expose a deterministic validation-only candidate Pareto archive',
);

const { P23CandidateParetoArchive } = learning;
const digest = character => character.repeat(64);
const tasks = [
  { taskId: 'memory-read-1', taskFamily: 'memory' },
  { taskId: 'tool-use-1', taskFamily: 'tool-use' },
];
function reports(values, { safety = 0, suffix = 'trial' } = {}) {
  return tasks.map((task, index) => ({
    taskId: task.taskId,
    taskFamily: task.taskFamily,
    trialId: `${suffix}-${index}`,
    taskSuccess: { passed: (values.taskSuccess ?? [1, 1])[index] === 1, passRate: (values.taskSuccess ?? [1, 1])[index] === 1 ? 1 : 0 },
    skillQuality: {
      aggregate: values.skill,
      functionalCoverage: values.skill,
      executability: 1,
      safety: safety === 0 ? 1 : 0,
      safetyViolationCount: safety,
      missingCapabilityIds: [],
    },
    trajectoryQuality: {
      aggregate: values.trajectory,
      keyPointRecall: values.trajectory,
      executionOrder: values.trajectory,
      completeness: values.trajectory,
      missingStepIds: [],
      unexpectedStepIds: [],
    },
  }));
}
function input(fingerprint, values, extra = {}) {
  return {
    split: 'validation',
    candidateFingerprint: digest(fingerprint),
    sourceFingerprint: digest('s'),
    variationId: `variation-${fingerprint}`,
    seed: 17,
    validationManifestFingerprint: digest('m'),
    validationPlanFingerprint: digest('p'),
    reports: reports(values, extra),
  };
}

// A is worse in success and trajectory and equal in skill, so B must dominate it.
const archive = new P23CandidateParetoArchive({ maxEntries: 8, maxTaskRows: 32 });
const a = archive.add(input('a', { taskSuccess: [0, 0], skill: .7, trajectory: .7 }));
assert.equal(a.status, 'pareto');
assert.equal(archive.snapshot().length, 1);

const b = archive.add(input('b', { taskSuccess: [1, 1], skill: .7, trajectory: .8 }));
assert.equal(b.status, 'pareto');
assert.deepEqual(archive.snapshot().map(row => row.candidateFingerprint), [digest('b')],
  'a candidate no worse in all validation objectives and better in one must evict its dominated candidate');

// Objective trade-offs remain together in the archive.
const c = archive.add(input('c', { taskSuccess: [1, 0], skill: .95, trajectory: .75 }));
assert.equal(c.status, 'pareto');
assert.equal(archive.snapshot().length, 2,
  'a high skill-quality candidate must not dominate a candidate with better task-success/trajectory balance');

// Duplicates cannot consume additional archive slots.
const duplicate = archive.add(input('b', { taskSuccess: [1, 1], skill: .7, trajectory: .8 }));
assert.equal(duplicate.status, 'duplicate');
assert.equal(archive.snapshot().length, 2);

// Safety is a hard veto, not a score that can be compensated by other objectives.
const unsafe = archive.add(input('u', { taskSuccess: [1, 1], skill: 1, trajectory: 1 }, { safety: 1 }));
assert.equal(unsafe.status, 'safety-rejected');
assert.equal(archive.snapshot().some(row => row.candidateFingerprint === digest('u')), false);

// A candidate from another validation plan cannot be compared to this cohort.
assert.throws(
  () => archive.add({ ...input('x', { skill: .9, trajectory: .9 }), validationPlanFingerprint: digest('q') }),
  /validation-cohort-mismatch/,
);

// Winner selection is deterministic and independent of insertion order.
const first = archive.winner();
const reverse = new P23CandidateParetoArchive({ maxEntries: 8, maxTaskRows: 32 });
reverse.add(input('c', { taskSuccess: [1, 0], skill: .95, trajectory: .75 }));
reverse.add(input('b', { taskSuccess: [1, 1], skill: .7, trajectory: .8 }));
assert.equal(first.candidateFingerprint, reverse.winner().candidateFingerprint);
assert.equal(archive.diagnostics().validationOnly, true);

assert.throws(
  () => new P23CandidateParetoArchive({ maxEntries: 65 }),
  /archive-budget-invalid/,
);
assert.throws(
  () => archive.add({ ...input('h', { skill: .8, trajectory: .8 }), split: 'holdout' }),
  /validation-only-input-required/,
);
assert.throws(
  () => archive.add({ ...input('n', { skill: Number.NaN, trajectory: .8 }) }),
  /validation-report-invalid/,
);

console.log('P23_CANDIDATE_PARETO_ARCHIVE=PASS');
