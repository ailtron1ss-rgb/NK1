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
    minimumValidationFamilies: 1,
    minimumHoldoutFamilies: 1,
    minimumValidationFamilyTasks: 2,
    minimumHoldoutFamilyTasks: 2,
    maximumValidationTaskRegression01: 0.20,
    maximumValidationFamilyRegression01: 0.10,
    maximumHoldoutRegression01: 0.02,
    maximumHoldoutFamilyRegression01: 0.10,
    minimumValidationFamilySeeds: 3,
    minimumHoldoutFamilySeeds: 3,
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

  // Repeated gate checks after a retry/restart should not skew acceptance rates.
  const duplicate = journal.recordFitnessDecision({ ...base, recordedAt: base.recordedAt + 99 });
  assert.equal(duplicate.sequence, first.sequence);
  assert.equal(duplicate.digest, first.digest);
  assert.equal(journal.readAll().length, 1,
    'a decision with identical fingerprints, policy, reason codes and aggregate metrics must be idempotent');

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

  const diagnostics = journal.snapshotDiagnostics();
  assert.equal(diagnostics.configured, true);
  assert.equal(diagnostics.available, true);
  assert.equal(diagnostics.totalDecisions, 2);
  assert.equal(diagnostics.acceptedDecisions, 1);
  assert.equal(diagnostics.rejectedDecisions, 1);
  assert.equal(diagnostics.acceptanceRate01, 0.5);
  assert.equal(diagnostics.rejectionCounts['validation-family-improvement-confidence-insufficient'], 1);
  assert.equal(diagnostics.meanValidationDelta, 0.12);
  assert.equal(diagnostics.meanHoldoutDelta, 0.07);
  assert.equal(diagnostics.lastSequence, 2);
  assert.equal(diagnostics.chainHead, rejected.digest);
  assert.equal('candidateId' in diagnostics.recent[0], false,
    'dashboard diagnostics must omit candidate identity and all raw evaluation rows');
  assert.throws(() => journal.snapshotDiagnostics(0),
    /learning-fitness-journal-diagnostics-recent-limit-invalid/);

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
    decision: 'fitness-rejected', reasonCodes: ['test-lock-contention'],
  }), /learning-fitness-journal-write-lock-held/);
  assert.equal(existsSync(lockPath), true, 'a competing writer lock must remain untouched');
  rmSync(lockPath, { force: true });

  // Recomputed content without a matching hash is rejected on restore.
  const tamperedPath = join(root, 'tampered.jsonl');
  const tamperedEntry = JSON.parse(serialized.split('\n')[0]);
  tamperedEntry.payloadFingerprint = 'e'.repeat(64);
  writeFileSync(tamperedPath, JSON.stringify(tamperedEntry) + '\n');
  assert.throws(() => new JsonlLearningFitnessJournal(tamperedPath).readAll(),
    /learning-fitness-journal-digest-mismatch/);

  const privacyTampered = JSON.parse(serialized.split('\n')[0]);
  privacyTampered.holdoutPrompt = 'must never enter aggregate journal';
  const privacyPath = join(root, 'privacy-tampered.jsonl');
  writeFileSync(privacyPath, JSON.stringify(privacyTampered) + '\n');
  assert.throws(() => new JsonlLearningFitnessJournal(privacyPath).readAll(),
    /learning-fitness-journal-entry-fields-invalid/,
    'unknown top-level fields must not be accepted as journal payload');
  const nestedPrivacyTampered = JSON.parse(serialized.split('\n')[0]);
  nestedPrivacyTampered.validation.familyName = 'private-family';
  const nestedPrivacyPath = join(root, 'nested-privacy-tampered.jsonl');
  writeFileSync(nestedPrivacyPath, JSON.stringify(nestedPrivacyTampered) + '\n');
  assert.throws(() => new JsonlLearningFitnessJournal(nestedPrivacyPath).readAll(),
    /learning-fitness-journal-input-invalid|learning-fitness-journal-entry-fields-invalid|learning-fitness-journal-digest-mismatch/);

  const truncatedPath = join(root, 'truncated.jsonl');
  writeFileSync(truncatedPath, serialized.trimEnd());
  assert.throws(() => new JsonlLearningFitnessJournal(truncatedPath).readAll(),
    /learning-fitness-journal-truncated-final-line/);

  const blankPath = join(root, 'blank.jsonl');
  writeFileSync(blankPath, serialized.replace('\n', '\n\n'));
  assert.throws(() => new JsonlLearningFitnessJournal(blankPath).readAll(),
    /learning-fitness-journal-blank-line/);

  console.log('WORKPASS405_LEARNING_FITNESS_JOURNAL=PASS chainVerified=true accessorRejected=true lockPreserved=true tamperingRejected=true unknownFieldsRejected=true diagnosticsAggregated=true');
} finally {
  rmSync(root, { recursive: true, force: true });
}
