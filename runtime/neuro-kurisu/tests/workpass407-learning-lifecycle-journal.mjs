import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonlLearningLifecycleJournal, learningLifecycleJournalPathForStateFile } from '../src/organism/learning/LearningLifecycleJournal.ts';

const root = mkdtempSync(join(tmpdir(), 'nk1-workpass407-lifecycle-'));
assert.equal(learningLifecycleJournalPathForStateFile('/state/organism.json'), '/state/organism.learning-lifecycle.jsonl');
assert.equal(learningLifecycleJournalPathForStateFile('/state/ORGANISM.JSON'), '/state/ORGANISM.learning-lifecycle.jsonl');
assert.equal(learningLifecycleJournalPathForStateFile('/state/organism.state'), '/state/organism.state.learning-lifecycle.jsonl');
assert.throws(() => learningLifecycleJournalPathForStateFile('/state/' + String.fromCharCode(0)),
  /learning-lifecycle-journal-state-path-invalid/);
const base = {
  recordedAt: 1_800_000_000_000,
  attemptId: '1dd2d2b4-8e24-4b1f-81e9-6bf8da0dfb1c',
  candidateId: 'candidate:skill-v2',
  skillId: 'summarization-skill',
  candidateVersion: 2,
  payloadFingerprint: 'a'.repeat(64),
  evaluationFingerprint: 'b'.repeat(64),
  planFingerprint: 'c'.repeat(64),
  environmentFingerprint: 'd'.repeat(64),
};
try {
  const journalPath = join(root, 'learning', 'lifecycle.jsonl');
  const journal = new JsonlLearningLifecycleJournal(journalPath);
  const intent = journal.recordLifecycleEvent({
    ...base, event: 'activation-intent', reasonCodes: [], activatedVersion: null,
  });
  assert.equal(intent.sequence, 1);
  assert.equal(intent.previousDigest, '0'.repeat(64));
  assert.match(intent.digest, /^[a-f0-9]{64}$/);
  assert.equal(journal.snapshotDiagnostics().pendingActivationCount, 1);

  // An identical retry is idempotent; the journal cannot show two activations
  // just because the caller retries after a timeout.
  const duplicateIntent = journal.recordLifecycleEvent({
    ...base, recordedAt: base.recordedAt + 100,
    event: 'activation-intent', reasonCodes: [], activatedVersion: null,
  });
  assert.equal(duplicateIntent.digest, intent.digest);
  assert.equal(journal.readAll().length, 1);

  const confirmed = journal.recordLifecycleEvent({
    ...base, recordedAt: base.recordedAt + 200,
    event: 'activation-confirmed', reasonCodes: [], activatedVersion: 2,
  });
  assert.equal(confirmed.sequence, 2);
  const diagnostic = journal.snapshotDiagnostics();
  assert.equal(diagnostic.eventCount, 2);
  assert.equal(diagnostic.activationIntentCount, 1);
  assert.equal(diagnostic.activationConfirmedCount, 1);
  assert.equal(diagnostic.pendingActivationCount, 0);
  assert.equal(diagnostic.lastSequence, 2);
  assert.equal(diagnostic.chainHead, confirmed.digest);
  assert.equal('payloadFingerprint' in diagnostic.recent[0], false,
    'dashboard summaries must not expose payload or evaluation fingerprints');

  assert.throws(() => journal.recordLifecycleEvent({
    ...base, event: 'activation-failed', reasonCodes: ['skill-store-activation-failed'], activatedVersion: null,
  }), /learning-lifecycle-journal-terminal-attempt|learning-lifecycle-journal-transition-invalid/,
  'an activation attempt cannot have both confirmed and failed terminal events');
  assert.throws(() => journal.recordLifecycleEvent({
    ...base, event: 'activation-confirmed', reasonCodes: [], activatedVersion: 3,
  }), /learning-lifecycle-journal-event-conflict/,
  'a retry cannot rewrite the version recorded by a terminal outcome');

  const rejected = journal.recordLifecycleEvent({
    ...base,
    attemptId: '2cc71b70-5679-4ab9-a047-a3ec84f58477',
    recordedAt: base.recordedAt + 300,
    candidateId: 'candidate:skill-v3',
    candidateVersion: 3,
    event: 'promotion-rejected',
    reasonCodes: ['fitness-gate-rejected'],
    activatedVersion: null,
  });
  assert.equal(rejected.sequence, 3);

  // A store call can fail after a side effect has become durable (for example,
  // when a subsequent diagnostic snapshot fails). Preserve uncertainty rather
  // than incorrectly labelling that attempt as definitely activated or failed.
  const uncertainAttempt = '4cc71b70-5679-4ab9-a047-a3ec84f58477';
  journal.recordLifecycleEvent({
    ...base, attemptId: uncertainAttempt, recordedAt: base.recordedAt + 400,
    candidateId: 'candidate:skill-v4', candidateVersion: 4,
    event: 'activation-intent', reasonCodes: [], activatedVersion: null,
  });
  journal.recordLifecycleEvent({
    ...base, attemptId: uncertainAttempt, recordedAt: base.recordedAt + 401,
    candidateId: 'candidate:skill-v4', candidateVersion: 4,
    event: 'activation-outcome-unknown', reasonCodes: ['activation-result-uncertain'], activatedVersion: null,
  });
  const afterUncertain = journal.snapshotDiagnostics();
  assert.equal(afterUncertain.activationOutcomeUnknownCount, 1);
  assert.equal(afterUncertain.pendingActivationCount, 1,
    'unknown outcome remains pending until the canonical store is consulted');
  const reconciled = journal.recordLifecycleEvent({
    ...base, attemptId: uncertainAttempt, recordedAt: base.recordedAt + 402,
    candidateId: 'candidate:skill-v4', candidateVersion: 4,
    event: 'activation-reconciled-active', reasonCodes: [], activatedVersion: 4,
  });
  assert.equal(reconciled.sequence, 6);
  const afterReconciliation = journal.snapshotDiagnostics();
  assert.equal(afterReconciliation.activationReconciledActiveCount, 1);
  assert.equal(afterReconciliation.pendingActivationCount, 0,
    'an exact store reconciliation closes the pending lifecycle attempt');

  assert.equal(journal.snapshotDiagnostics().promotionRejectedCount, 1);
  assert.throws(() => journal.recordLifecycleEvent({
    ...base,
    attemptId: rejected.attemptId,
    candidateId: rejected.candidateId,
    candidateVersion: rejected.candidateVersion,
    event: 'activation-intent',
    reasonCodes: [],
    activatedVersion: null,
  }), /learning-lifecycle-journal-terminal-attempt|learning-lifecycle-journal-transition-invalid/,
  'a rejected attempt cannot later be turned into an activation');

  // Identity/payload binding is stable within one attempt.
  assert.throws(() => journal.recordLifecycleEvent({
    ...base,
    attemptId: intent.attemptId,
    payloadFingerprint: 'e'.repeat(64),
    event: 'activation-confirmed',
    reasonCodes: [],
    activatedVersion: 2,
  }), /learning-lifecycle-journal-attempt-identity-conflict/);

  // Caller properties must be detached without invoking accessors.
  let getterCalls = 0;
  const hostile = {
    ...base, event: 'promotion-rejected', reasonCodes: ['fitness-gate-rejected'], activatedVersion: null,
  };
  Object.defineProperty(hostile, 'skillId', {
    enumerable: true, configurable: true,
    get() { getterCalls++; return 'forged-skill'; },
  });
  assert.throws(() => journal.recordLifecycleEvent(hostile),
    /learning-lifecycle-journal-input-data-boundary-rejected/);
  assert.equal(getterCalls, 0);

  const serialized = readFileSync(journalPath, 'utf8');
  const tamperPath = join(root, 'tampered.jsonl');
  const tampered = JSON.parse(serialized.split('\n')[0]);
  tampered.evaluationFingerprint = 'f'.repeat(64);
  writeFileSync(tamperPath, JSON.stringify(tampered) + '\n');
  assert.throws(() => new JsonlLearningLifecycleJournal(tamperPath).readAll(),
    /learning-lifecycle-journal-digest-mismatch/);

  const truncatedPath = join(root, 'truncated.jsonl');
  writeFileSync(truncatedPath, serialized.trimEnd());
  assert.throws(() => new JsonlLearningLifecycleJournal(truncatedPath).readAll(),
    /learning-lifecycle-journal-truncated-final-line/);

  const lockPath = journalPath + '.lock';
  writeFileSync(lockPath, 'owned-by-another-writer');
  assert.throws(() => journal.recordLifecycleEvent({
    ...base,
    attemptId: '3cc71b70-5679-4ab9-a047-a3ec84f58477',
    event: 'promotion-rejected', reasonCodes: ['fitness-gate-rejected'], activatedVersion: null,
  }), /learning-lifecycle-journal-write-lock-held/);
  assert.equal(existsSync(lockPath), true, 'a competing writer lock must not be removed');
  rmSync(lockPath, { force: true });

  console.log('WORKPASS407_LEARNING_LIFECYCLE_JOURNAL=PASS pathIsolation=true hashChain=true idempotentIntent=true pendingReconciled=true storeReconciliationTransition=true uncertainOutcomePreserved=true illegalTransitionsRejected=true identityBound=true accessorsRejected=true tamperingRejected=true');
} finally {
  rmSync(root, { recursive: true, force: true });
}
