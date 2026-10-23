import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonlLearningLifecycleJournal } from '../src/organism/learning/LearningLifecycleJournal.ts';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';

const root = mkdtempSync(join(tmpdir(), 'nk1-workpass408-reconcile-'));
try {
  const journal = new JsonlLearningLifecycleJournal(join(root, 'lifecycle.jsonl'));
  const now = 1_800_000_000_000;
  const rows = [
    {
      attemptId: '1dd2d2b4-8e24-4b1f-81e9-6bf8da0dfb1c',
      candidateId: 'candidate:active', skillId: 'skill-active', candidateVersion: 2,
      payloadFingerprint: 'a'.repeat(64), evaluationFingerprint: 'b'.repeat(64),
      planFingerprint: 'c'.repeat(64), environmentFingerprint: 'd'.repeat(64),
    },
    {
      attemptId: '2dd2d2b4-8e24-4b1f-81e9-6bf8da0dfb1c',
      candidateId: 'candidate:shadow', skillId: 'skill-shadow', candidateVersion: 3,
      payloadFingerprint: 'e'.repeat(64), evaluationFingerprint: 'f'.repeat(64),
      planFingerprint: '1'.repeat(64), environmentFingerprint: '2'.repeat(64),
    },
    {
      attemptId: '3dd2d2b4-8e24-4b1f-81e9-6bf8da0dfb1c',
      candidateId: 'candidate:missing', skillId: 'skill-missing', candidateVersion: 1,
      payloadFingerprint: '3'.repeat(64), evaluationFingerprint: '4'.repeat(64),
      planFingerprint: '5'.repeat(64), environmentFingerprint: '6'.repeat(64),
    },
    {
      attemptId: '4dd2d2b4-8e24-4b1f-81e9-6bf8da0dfb1c',
      candidateId: 'candidate:crash-after-intent', skillId: 'skill-crash-recovery', candidateVersion: 4,
      payloadFingerprint: '7'.repeat(64), evaluationFingerprint: '8'.repeat(64),
      planFingerprint: '9'.repeat(64), environmentFingerprint: 'a'.repeat(64),
    },
  ];
  let timestamp = now;
  for (const row of rows.slice(0, 3)) {
    journal.recordLifecycleEvent({
      ...row, recordedAt: timestamp++, event: 'activation-intent',
      reasonCodes: [], activatedVersion: null,
    });
    journal.recordLifecycleEvent({
      ...row, recordedAt: timestamp++, event: 'activation-outcome-unknown',
      reasonCodes: ['activation-result-uncertain'], activatedVersion: null,
    });
  }
  // Simulate a hard process exit immediately after the durable intent, before an
  // activation-outcome-unknown event could be appended.
  journal.recordLifecycleEvent({
    ...rows[3], recordedAt: timestamp++, event: 'activation-intent',
    reasonCodes: [], activatedVersion: null,
  });

  // This fixture mirrors the authoritative read shape returned by the versioned
  // store. The reconciliation path compares candidate identity AND payload digest.
  const authoritativeSnapshot = {
    schemaVersion: 1,
    revision: 8,
    active: [
      {
        skillId: 'skill-active', version: 2, payload: { kind: 'active' },
        payloadFingerprint: rows[0].payloadFingerprint, proposalId: 'proposal-active', activatedAt: now,
      },
      {
        skillId: 'skill-crash-recovery', version: 4, payload: { kind: 'crash-recovered' },
        payloadFingerprint: rows[3].payloadFingerprint, proposalId: 'proposal-crash', activatedAt: now + 1,
      },
    ],
    candidates: [
      {
        candidateId: rows[0].candidateId, skillId: rows[0].skillId, version: rows[0].candidateVersion,
        payloadFingerprint: rows[0].payloadFingerprint, status: 'active',
      },
      {
        candidateId: rows[1].candidateId, skillId: rows[1].skillId, version: rows[1].candidateVersion,
        payloadFingerprint: rows[1].payloadFingerprint, status: 'shadow',
      },
      {
        candidateId: rows[3].candidateId, skillId: rows[3].skillId, version: rows[3].candidateVersion,
        payloadFingerprint: rows[3].payloadFingerprint, status: 'active',
      },
    ],
  };
  const fakeStore = { snapshot() { return structuredClone(authoritativeSnapshot); } };
  const engine = new P23LearningEngine();
  engine.configureVerifiedSkillLifecycle(fakeStore);
  engine.configureLearningLifecycleJournal(journal);

  const result = engine.reconcileLearningLifecycleOutcomes();
  assert.deepEqual(result, {
    configured: true,
    available: true,
    observedPending: 4,
    observedUnknown: 3,
    reconciledActive: 2,
    reconciledNotCurrentlyActive: 1,
    unresolved: 1,
  });

  const events = journal.readAll();
  const attempts = new Map();
  for (const event of events) {
    const list = attempts.get(event.attemptId) ?? [];
    list.push(event.event);
    attempts.set(event.attemptId, list);
  }
  assert.deepEqual(attempts.get(rows[0].attemptId), [
    'activation-intent', 'activation-outcome-unknown', 'activation-reconciled-active',
  ]);
  assert.deepEqual(attempts.get(rows[1].attemptId), [
    'activation-intent', 'activation-outcome-unknown', 'activation-reconciled-not-currently-active',
  ]);
  assert.deepEqual(attempts.get(rows[2].attemptId), [
    'activation-intent', 'activation-outcome-unknown',
  ], 'unknown candidate lineage must remain pending rather than be guessed');
  assert.deepEqual(attempts.get(rows[3].attemptId), [
    'activation-intent', 'activation-reconciled-active',
  ], 'intent-only crash recovery must reconcile from authoritative active state');

  const diagnostics = journal.snapshotDiagnostics();
  assert.equal(diagnostics.activationReconciledActiveCount, 2);
  assert.equal(diagnostics.activationReconciledNotCurrentlyActiveCount, 1);
  assert.equal(diagnostics.pendingActivationCount, 1);

  // Repeating reconciliation is idempotent and must not append duplicate terminals.
  const repeat = engine.reconcileLearningLifecycleOutcomes();
  assert.equal(repeat.observedPending, 1);
  assert.equal(repeat.observedUnknown, 1);
  assert.equal(repeat.reconciledActive, 0);
  assert.equal(repeat.reconciledNotCurrentlyActive, 0);
  assert.equal(repeat.unresolved, 1);
  assert.equal(journal.readAll().length, events.length);

  console.log('WORKPASS408_LIFECYCLE_STORE_RECONCILIATION=PASS exactActiveMatch=true intentOnlyCrashRecovered=true shadowNotActive=true missingLineageStaysPending=true repeatIdempotent=true');
} finally {
  rmSync(root, { recursive: true, force: true });
}
