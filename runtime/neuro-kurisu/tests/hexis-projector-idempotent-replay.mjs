import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { HexisCanonicalMemoryProjector } from '../src/organism/integration/hexis/HexisCanonicalMemoryProjector.mjs';
import { computeHmxStageDigest } from '../src/organism/integration/hexis/HexisStageIntegrity.mjs';

const hash = value => createHash('sha256').update(String(value)).digest('hex');
const stage = {
  status: 'applied',
  exportId: 'exp_0123456789abcdef',
  sourceLineageId: 'trusted-lineage-1',
  stagingId: 'stage-1',
  digest: '',
  intent: 'port',
  strategy: 'additive',
  sectionCounts: {},
  protectedSections: [],
  conflicts: [],
  stagedSections: {},
};
stage.digest = computeHmxStageDigest(stage);
const makeReceipt = (overrides = {}) => {
  const base = {
    version: 1,
    exportId: stage.exportId,
    sourceLineageId: stage.sourceLineageId,
    stageId: stage.stagingId,
    stageDigest: stage.digest,
    attempt: 1,
    appliedAt: 1700000000000,
    status: 'noop',
    complete: false,
    candidateMemoryRecords: 0,
    uniqueMemoryRecords: 0,
    importedCount: 0,
    deduplicatedCount: 0,
    projectedRelationships: 0,
    deferredRelationships: 0,
    semanticEdgeIds: [],
    memoryIds: [],
    createdMemoryIds: [],
    deferredSections: {},
    warnings: ['previously-applied'],
    ...overrides,
  };
  return { ...base, digest: hash(JSON.stringify(base)) };
};
const receipt = makeReceipt();
stage.application = receipt;

let writes = 0;
const memoryFabric = {
  encode() { writes++; throw new Error('unexpected-write-on-replay'); },
  canonicalSnapshot() { writes++; throw new Error('unexpected-read-on-replay'); },
  forgetById() { writes++; throw new Error('unexpected-rollback-on-replay'); },
};
const projector = new HexisCanonicalMemoryProjector(memoryFabric);
const replay = projector.apply(stage);
assert.deepEqual(replay, receipt);
assert.notEqual(replay, receipt, 'replay returns a defensive copy');
assert.notEqual(replay.warnings, receipt.warnings, 'nested receipt data is cloned');
replay.warnings.push('caller-mutation');
assert.deepEqual(receipt.warnings, ['previously-applied']);
assert.equal(writes, 0, 'idempotent replay must not touch canonical storage');

const tamperedPayloadStage = structuredClone(stage);
tamperedPayloadStage.stagedSections.memories = [{ ref: stage.exportId + ':tampered', type: 'semantic', content: 'changed payload' }];
assert.throws(() => projector.apply(tamperedPayloadStage), /hmx-stage-digest-invalid/);
assert.equal(writes, 0, 'tampered stage payload must be rejected before canonical storage is touched');

// A completed stage cannot be downgraded to "accepted" while retaining its
// application receipt; doing so would bypass the no-write replay path.
const downgradedAppliedStage = structuredClone(stage);
downgradedAppliedStage.status = 'accepted';
assert.throws(
  () => projector.apply(downgradedAppliedStage),
  /hmx-stage-digest-invalid/,
  'a persisted application receipt and an accepted lifecycle state are inconsistent',
);
assert.equal(writes, 0, 'lifecycle tampering must be rejected before canonical storage is touched');

// applicationAttempts is lifecycle metadata, not part of the reviewed HMX content digest;
// malformed values must fail before the projector reads or writes canonical state.
for (const invalidAttempts of ['bad', '2', 1.5, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  const malformedAttemptStage = structuredClone(stage);
  malformedAttemptStage.status = 'accepted';
  delete malformedAttemptStage.application;
  malformedAttemptStage.applicationAttempts = invalidAttempts;
  assert.throws(
    () => projector.apply(malformedAttemptStage),
    /hmx-stage-digest-invalid/,
    `invalid applicationAttempts ${String(invalidAttempts)} must be rejected before apply`,
  );
}
assert.equal(writes, 0, 'invalid applicationAttempts must be rejected before canonical storage is touched');

// A valid content digest cannot authorize a receipt whose attempt mismatches lifecycle state.
const attemptMismatchStage = structuredClone(stage);
attemptMismatchStage.applicationAttempts = 2;
attemptMismatchStage.application = makeReceipt({ attempt: 1 });
assert.throws(() => projector.apply(attemptMismatchStage), /hmx-applied-receipt-invalid/);
assert.equal(writes, 0, 'attempt mismatch must not re-enter canonical storage');

// WorkPass427: a recomputed checksum must not make an impossible apply receipt valid.
const semanticallyInvalidReceipts = [
  { overrides: { candidateMemoryRecords: 1 }, label: 'candidate count must match the staged memory array' },
  { overrides: { complete: true }, label: 'noop receipt cannot claim complete application' },
  { overrides: { status: 'applied' }, label: 'zero-memory receipt must remain noop' },
  { overrides: { memoryIds: ['memory-1'] }, label: 'memory IDs must match unique record count' },
  { overrides: { createdMemoryIds: ['memory-1'] }, label: 'created IDs must match imported count' },
  { overrides: { deduplicatedCount: 1 }, label: 'imported plus deduplicated must account for every unique row' },
  { overrides: { semanticEdgeIds: ['edge-1'] }, label: 'receipt cannot name more distinct edges than projected relationships' },
];
for (const item of semanticallyInvalidReceipts) {
  const impossibleStage = { ...stage, application: makeReceipt(item.overrides) };
  assert.throws(() => projector.apply(impossibleStage), /hmx-applied-receipt-invalid/, item.label);
}
assert.equal(writes, 0, 'semantically impossible receipts must fail before canonical storage is touched');

// Prove the strengthened contract still accepts a coherent non-noop receipt.
const coherentAppliedStage = structuredClone(stage);
coherentAppliedStage.stagedSections.memories = [
  { ref: coherentAppliedStage.exportId + ':mem-1', type: 'semantic', content: 'valid staged memory' },
];
coherentAppliedStage.digest = computeHmxStageDigest(coherentAppliedStage);
coherentAppliedStage.application = makeReceipt({
  stageDigest: coherentAppliedStage.digest,
  status: 'applied',
  complete: true,
  candidateMemoryRecords: 1,
  uniqueMemoryRecords: 1,
  importedCount: 1,
  deduplicatedCount: 0,
  memoryIds: ['memory-1'],
  createdMemoryIds: ['memory-1'],
});
assert.deepEqual(projector.apply(coherentAppliedStage), coherentAppliedStage.application,
  'a semantically coherent applied receipt remains replay-compatible');
assert.equal(writes, 0, 'valid receipt replay must remain a no-write operation');

// A receipt copied from another stage must not be accepted as the result of this stage.
assert.throws(
  () => projector.apply({ ...stage, application: makeReceipt({ stageId: 'some-other-stage' }) }),
  /hmx-applied-receipt-invalid/,
);
// A modified receipt that no longer matches its integrity digest must fail closed.
const tamperedStage = structuredClone(stage);
tamperedStage.application.importedCount = 1;
assert.throws(() => projector.apply(tamperedStage), /hmx-applied-receipt-invalid/);
assert.throws(
  () => projector.apply({ ...stage, application: { status: 'applied' } }),
  /hmx-applied-receipt-invalid/,
);
assert.throws(
  () => projector.apply({ ...stage, status: 'pending' }),
  /hmx-stage-digest-invalid/,
);
assert.equal(writes, 0);

console.log('HEXIS_PROJECTOR_IDEMPOTENT_REPLAY=PASS', JSON.stringify({ writes, receiptDigest: receipt.digest }));
