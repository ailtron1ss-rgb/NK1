import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonlLearningFitnessJournal } from '../src/organism/learning/LearningFitnessJournal.ts';

const root = mkdtempSync(join(tmpdir(), 'nk1-workpass405-journal-'));
try {
  const path = join(root, 'learning', 'fitness.jsonl');
  const journal = new JsonlLearningFitnessJournal(path);
  const base = {
    recordedAt: 1_800_000_000_000,
    candidateId: 'candidate:memory-v2',
    payloadFingerprint: 'a'.repeat(64),
    evaluationFingerprint: 'b'.repeat(64),
    planFingerprint: 'c'.repeat(64),
    environmentFingerprint: 'd'.repeat(64),
    decision: 'fitness-accepted',
    reasonCodes: [],
    matchedTrialCount: 12,
    matchedValidationTrialCount: 6,
    matchedHoldoutTrialCount: 6,
    minimumPairedSeedsPerFamily: 3,
    confidenceLevel: 0.95,
    bootstrapResamples: 2000,
    validation: {
      familiesEvaluated: 2, familiesWithSufficientSeeds: 2,
      seedCoverageFailures: 0, confidenceBoundFailures: 0,
      meanDelta: 0.12, minimumLowerBound: 0.04, maximumUpperBound: 0.22,
    },
    holdout: {
      familiesEvaluated: 2, familiesWithSufficientSeeds: 2,
      seedCoverageFailures: 0, confidenceBoundFailures: 0,
      meanDelta: 0.07, minimumLowerBound: -0.04, maximumUpperBound: 0.15,
    },
  };
  const first = journal.recordFitnessDecision(base);
  assert.equal(first.sequence, 1);
  assert.equal(first.previousDigest, '0'.repeat(64));
  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.equal(journal.readAll().length, 1);

  const rejected = journal.recordFitnessDecision({
    ...base,
    recordedAt: base.recordedAt + 1,
    decision: 'fitness-rejected',
    reasonCodes: ['validation-family-improvement-confidence-insufficient'],
    validation: { ...base.validation, confidenceBoundFailures: 1, minimumLowerBound: -0.02 },
  });
  assert.equal(rejected.sequence, 2);
  assert.equal(rejected.previousDigest, first.digest);
  assert.deepEqual(journal.readAll().map(row => row.decision), ['fitness-accepted', 'fitness-rejected']);

  // No prompt, raw task identifier, family name or per-task score is persisted.
  const serialized = readFileSync(path, 'utf8');
  assert.equal(serialized.includes('prompt'), false);
  assert.equal(serialized.includes('taskId'), false);
  assert.equal(serialized.includes('family-a'), false);

  let inputGetterCalls = 0;
  const accessorInput = { ...base };
  Object.defineProperty(accessorInput, 'candidateId', {
    enumerable: true,
    configurable: true,
    get() { inputGetterCalls++; return 'candidate:forged'; },
  });
  assert.throws(() => journal.recordFitnessDecision(accessorInput),
    /learning-fitness-journal-input-data-boundary-rejected/);
  assert.equal(inputGetterCalls, 0, 'journal input getters must not execute');

  // A writer that cannot acquire the lock must not delete another writer's lock.
  const lockPath = path + '.lock';
  writeFileSync(lockPath, 'other-process');
  assert.throws(() => journal.recordFitnessDecision({
    ...base, recordedAt: base.recordedAt + 2,
  }), /learning-fitness-journal-write-lock-held/);
  assert.equal(existsSync(lockPath), true, 'a competing writer lock must remain untouched');
  rmSync(lockPath, { force: true });

  // Recomputed content without a matching hash is rejected on restore.
  const tamperedPath = join(root, 'tampered.jsonl');
  writeFileSync(tamperedPath, serialized.replace('fitness-accepted', 'fitness-rejected'));
  assert.throws(() => new JsonlLearningFitnessJournal(tamperedPath).readAll(),
    /learning-fitness-journal-digest-mismatch/);

  const truncatedPath = join(root, 'truncated.jsonl');
  writeFileSync(truncatedPath, serialized.trimEnd());
  assert.throws(() => new JsonlLearningFitnessJournal(truncatedPath).readAll(),
    /learning-fitness-journal-truncated-final-line/);

  const blankPath = join(root, 'blank.jsonl');
  writeFileSync(blankPath, serialized.replace('\n', '\n\n'));
  assert.throws(() => new JsonlLearningFitnessJournal(blankPath).readAll(),
    /learning-fitness-journal-blank-line/);

  console.log('WORKPASS405_LEARNING_FITNESS_JOURNAL=PASS chainVerified=true accessorRejected=true lockPreserved=true tamperingRejected=true');
} finally {
  rmSync(root, { recursive: true, force: true });
}
