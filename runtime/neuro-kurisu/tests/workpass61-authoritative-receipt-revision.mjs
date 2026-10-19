import assert from 'node:assert/strict';
import { OutcomeCognitionFabric } from '../src/organism/system/OutcomeCognitionFabric.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const verification = (overrides = {}) => ({
  verified: false, basis: 'none', confidence01: 0, externalObservation: false,
  notes: 'original executor result remained uncertain', ...overrides,
});

// Direct revision contract: the original action/outcome and fingerprint remain immutable.
{
  const fabric = new OutcomeCognitionFabric();
  const original = fabric.project({
    tick: 1, tool: 'device.set-state', ok: false, executionId: 'exec-revision-contract',
    outcomeClass: 'execution-failed', verification: verification(), reason: 'original attempt',
  });
  const before = fabric.snapshot();
  const input = {
    authoritative: true, tick: 2, tool: 'device.set-state', executionId: 'exec-revision-contract',
    providerReceiptId: 'provider-receipt-abc', ok: true, outcomeClass: 'executed-verified',
    verification: verification({
      verified: true, basis: 'external-postcondition', externalObservation: true,
      observationId: 'provider-postcondition-observation', confidence01: 0.94,
      expectedPostcondition: 'relay=on', observedPostcondition: 'relay=on',
    }),
    reason: 'authoritative provider receipt',
  };
  const first = fabric.reviseAuthoritativeReceipt(input);
  assert.equal(first.resolved, true, 'authoritative receipt can revise the same execution without replacing its outcome');
  assert.equal(first.replayed, false);
  assert.equal(first.revision.revisionNumber, 1);
  assert.equal(first.revision.status, 'verified');
  assert.equal(first.revision.executionId, 'exec-revision-contract');
  assert.equal(fabric.snapshot().projectionIndex[0].fingerprint, before.projectionIndex[0].fingerprint, 'original projection fingerprint stays unchanged');
  assert.equal(fabric.snapshot().projectionIndex[0].record.ok, false, 'original receipt record is not rewritten by later provider evidence');
  assert.equal(fabric.snapshot().evidenceRevisions.length, 1);

  const causalBeforeReplay = first.causal.nodes.length;
  const replay = fabric.reviseAuthoritativeReceipt(input);
  assert.equal(replay.resolved, true);
  assert.equal(replay.replayed, true, 'identical provider receipt revision is idempotent');
  assert.equal(replay.causal.nodes.length, causalBeforeReplay, 'revision replay must not create another causal node');

  const conflict = fabric.reviseAuthoritativeReceipt({ ...input, verification: verification({
    verified: false, basis: 'external-postcondition', externalObservation: true,
    observationId: 'provider-postcondition-observation', confidence01: 0.94,
    expectedPostcondition: 'relay=on', observedPostcondition: 'relay=off',
  }), ok: false, outcomeClass: 'executed-contradicted' });
  assert.equal(conflict.resolved, false);
  assert.equal(conflict.reason, 'evidence-revision-conflict', 'same provider receipt ID cannot be rebound to different evidence');
  assert.equal(fabric.snapshot().evidenceRevisions.length, 1);

  const restored = new OutcomeCognitionFabric();
  restored.restore(fabric.snapshot());
  const restoredReplay = restored.reviseAuthoritativeReceipt(input);
  assert.equal(restoredReplay.resolved, true);
  assert.equal(restoredReplay.replayed, true, 'revision idempotency survives snapshot/restore');

  const persisted = migratePersistedOrganism({
    schemaVersion: ORGANISM_STATE_SCHEMA,
    state: { version: ORGANISM_STATE_SCHEMA, tick: 3 },
    system: { outcomeVerification: fabric.snapshot(), causalAccountability: fabric.snapshot().causal },
  });
  assert.equal(persisted.system.outcomeVerification.evidenceRevisions.length, 1, 'schema migration preserves append-only evidence revisions');
  assert.equal(persisted.system.outcomeVerification.evidenceRevisions[0].revisionFingerprint, first.revision.revisionFingerprint);
}

// A provider revision gets its own append-only CEF event, but does not rewrite the original receipt trio.
{
  const cef = new CognitiveEventFabric(256);
  const trace = cef.appendToolReceiptTrace({
    tick: 4, executionId: 'exec-cef-revision', toolId: 'device.set-state', decisionId: 'decision-cef-revision',
    ok: false, verified: false, outcomeClass: 'execution-failed', confidence01: 0,
    verificationBasis: 'none', externalObservation: false, observationIntegrated: false, at: 1000,
  });
  const revision = {
    tick: 5, executionId: 'exec-cef-revision', toolId: 'device.set-state',
    revisionId: 'outcome-revision:cef-rev-001', revisionNumber: 1,
    providerReceiptHash: 'a'.repeat(64), revisionFingerprint: 'b'.repeat(64),
    outcomeClass: 'executed-verified', ok: true, verified: true, verificationBasis: 'external-postcondition',
    confidence01: 0.94, observationId: 'provider-observation', status: 'verified', reason: 'provider confirmed', at: 2000,
  };
  const first = cef.appendToolReceiptRevision(revision);
  assert.equal(first.resolved, true);
  assert.equal(first.replayed, false);
  const snapshot = cef.snapshot();
  assert.equal(snapshot.receiptProjectionIndex[0].actionEventId, trace.actionEventId);
  assert.equal(snapshot.receiptProjectionIndex[0].outcomeEventId, trace.outcomeEventId);
  assert.equal(snapshot.receiptProjectionIndex[0].evidenceEventId, trace.evidenceEventId);
  assert.equal(snapshot.recent.filter(row => row.payload.executionId === 'exec-cef-revision' && ['tool-action', 'tool-outcome', 'tool-evidence'].includes(row.stage)).length, 3, 'revision does not duplicate or rewrite base receipt trio');
  assert.equal(snapshot.recent.filter(row => row.stage === 'tool-reconciliation' && row.payload.revisionId === revision.revisionId).length, 1);
  const after = cef.appendToolReceiptRevision(revision);
  assert.equal(after.resolved, true);
  assert.equal(after.replayed, true);
  assert.equal(cef.snapshot().total, snapshot.total, 'revision replay does not append a duplicate event');
  assert.throws(() => cef.appendToolReceiptRevision({ ...revision, outcomeClass: 'execution-failed' }), /tool-receipt-revision-conflict/);

  const restored = new CognitiveEventFabric(256);
  restored.restore(snapshot);
  assert.equal(restored.hasToolReceiptTrace('exec-cef-revision'), true);
  const restoredSnapshot = restored.snapshot();
  assert.ok([...restoredSnapshot.recent, ...(restoredSnapshot.receiptEvents ?? [])].some(row => row.id === first.eventId), 'revision event is retained in the restored causal snapshot');
  assert.equal(restored.appendToolReceiptRevision(revision).replayed, true, 'revision survives snapshot/restore idempotently');
}

console.log(JSON.stringify({ ok: true, pass: 'workpass61-authoritative-receipt-revision', scenarios: 2, assertions: 'immutable base outcome; revision ledger replay/conflict; restore; append-only causal evidence; immutable CEF receipt trio' }));
