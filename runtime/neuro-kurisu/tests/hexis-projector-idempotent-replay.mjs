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
