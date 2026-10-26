import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { HexisCanonicalMemoryProjector, isValidHmxApplyReceipt } from '../src/organism/integration/hexis/HexisCanonicalMemoryProjector.mjs';
import { computeHmxStageDigest, refreshHmxStageLifecycleDigest } from '../src/organism/integration/hexis/HexisStageIntegrity.mjs';

const hash = value => createHash('sha256').update(String(value)).digest('hex');
const stage = {
  status: 'applied',
  exportId: 'exp_0123456789abcdef',
  sourceLineageId: 'trusted-lineage-1',
  stagingId: 'stage-1',
  digest: '',
  lifecycleDigest: '',
  applicationAttempts: 1,
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
refreshHmxStageLifecycleDigest(stage);

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
const copiedReceiptStage = { ...stage, application: makeReceipt({ stageId: 'some-other-stage' }), lifecycleDigest: '' };
refreshHmxStageLifecycleDigest(copiedReceiptStage);
assert.throws(
  () => projector.apply(copiedReceiptStage),
  /hmx-applied-receipt-invalid/,
);
// A modified receipt that no longer matches its integrity digest must fail closed.
const tamperedStage = structuredClone(stage);
tamperedStage.application.importedCount = 1;
assert.throws(() => projector.apply(tamperedStage), /hmx-applied-receipt-invalid/);
const malformedReceiptStage = { ...stage, application: { status: 'applied' }, lifecycleDigest: '' };
refreshHmxStageLifecycleDigest(malformedReceiptStage);
assert.throws(
  () => projector.apply(malformedReceiptStage),
  /hmx-applied-receipt-invalid/,
);
assert.throws(
  () => projector.apply({ ...stage, status: 'pending' }),
  /hmx-stage-digest-invalid/,
);
assert.equal(writes, 0);

// WorkPass428: the exported receipt validator is a trust boundary, not only a digest check.
const coherentAppliedStage = {
  ...stage,
  status: 'applied',
  stagingId: 'stage-coherent-non-noop',
  digest: '',
  lifecycleDigest: '',
  applicationAttempts: 1,
  application: undefined,
  stagedSections: {
    memories: [{ ref: stage.exportId + ':mem-1', type: 'semantic', content: 'valid staged memory' }],
  },
};
coherentAppliedStage.digest = computeHmxStageDigest(coherentAppliedStage);
const coherentAppliedReceipt = makeReceipt({
  stageId: coherentAppliedStage.stagingId,
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
coherentAppliedStage.application = coherentAppliedReceipt;
refreshHmxStageLifecycleDigest(coherentAppliedStage);
assert.equal(isValidHmxApplyReceipt(coherentAppliedStage, coherentAppliedReceipt), true,
  'a semantically coherent applied receipt must remain valid');
assert.deepEqual(projector.apply(coherentAppliedStage), coherentAppliedReceipt,
  'a valid applied receipt replays without accessing canonical storage');
const impossibleBase = {
  stageId: coherentAppliedStage.stagingId,
  stageDigest: coherentAppliedStage.digest,
  status: 'applied',
  complete: true,
  candidateMemoryRecords: 1,
  uniqueMemoryRecords: 1,
  importedCount: 1,
  deduplicatedCount: 0,
  projectedRelationships: 0,
  deferredRelationships: 0,
  semanticEdgeIds: [],
  memoryIds: ['memory-1'],
  createdMemoryIds: ['memory-1'],
  deferredSections: {},
};
for (const item of [
  { overrides: { candidateMemoryRecords: 2 }, label: 'candidate rows must match staged memory count' },
  { overrides: { complete: false }, label: 'applied receipt cannot claim incomplete application without deferred sections' },
  { overrides: { status: 'noop' }, label: 'nonempty unique memory count cannot be noop' },
  { overrides: { memoryIds: [''] }, label: 'empty memory identities are invalid' },
  { overrides: { memoryIds: ['   '], createdMemoryIds: ['   '] }, label: 'whitespace-only memory identities are invalid' },
  { overrides: { memoryIds: ['x'.repeat(513)] }, label: 'receipt memory IDs have a bounded size' },
  { overrides: { warnings: ['x'.repeat(2049)] }, label: 'receipt warning text has a bounded size' },
  { overrides: { createdMemoryIds: ['another-memory'] }, label: 'created IDs must be a subset of memory IDs' },
  { overrides: { deduplicatedCount: 1 }, label: 'imported and deduplicated counts must account for unique rows' },
  { overrides: { semanticEdgeIds: [''] }, label: 'empty semantic edge identities are invalid' },
  { overrides: { semanticEdgeIds: ['edge-1'], projectedRelationships: 0 }, label: 'semantic edge IDs cannot exceed projected relationship count' },
]) {
  const forgedReceipt = makeReceipt({ ...impossibleBase, ...item.overrides });
  assert.equal(isValidHmxApplyReceipt(coherentAppliedStage, forgedReceipt), false, item.label);
}
assert.equal(
  isValidHmxApplyReceipt(coherentAppliedStage, makeReceipt({ ...impossibleBase })),
  true,
  'a coherent recomputed receipt remains valid',
);

// applicationAttempts is lifecycle metadata outside the content digest but must bind
// exactly to the persisted receipt attempt.
assert.equal(isValidHmxApplyReceipt(stage, makeReceipt({ attempt: 2 })), false,
  'receipt attempt cannot disagree with the sealed stage counter');

const relationshipStage = {
  ...stage,
  status: 'applied',
  stagingId: 'stage-with-relationship',
  digest: '',
  lifecycleDigest: '',
  applicationAttempts: 1,
  application: undefined,
  stagedSections: {
    relationships: [{ source_ref: 'missing-a', target_ref: 'missing-b', edge_type: 'supports' }],
  },
};
relationshipStage.digest = computeHmxStageDigest(relationshipStage);
const coherentDeferredRelationshipReceipt = makeReceipt({
  stageId: relationshipStage.stagingId,
  stageDigest: relationshipStage.digest,
  status: 'noop',
  complete: false,
  candidateMemoryRecords: 0,
  uniqueMemoryRecords: 0,
  importedCount: 0,
  deduplicatedCount: 0,
  projectedRelationships: 0,
  deferredRelationships: 1,
  semanticEdgeIds: [],
  memoryIds: [],
  createdMemoryIds: [],
  deferredSections: { relationships: 1 },
});
relationshipStage.application = coherentDeferredRelationshipReceipt;
refreshHmxStageLifecycleDigest(relationshipStage);
assert.equal(isValidHmxApplyReceipt(relationshipStage, coherentDeferredRelationshipReceipt), true,
  'a coherent deferred relationship count is accepted even when no memories are imported');

// Rehashed receipts must not claim the same semantic edge twice, even if all counters match.
const twoRelationshipStage = {
  ...relationshipStage,
  stagingId: 'stage-two-relationships',
  digest: '',
  lifecycleDigest: '',
  application: undefined,
  stagedSections: {
    relationships: [
      { source_ref: 'missing-a', target_ref: 'missing-b', edge_type: 'supports' },
      { source_ref: 'missing-c', target_ref: 'missing-d', edge_type: 'causes' },
    ],
  },
};
twoRelationshipStage.digest = computeHmxStageDigest(twoRelationshipStage);
refreshHmxStageLifecycleDigest(twoRelationshipStage);
const duplicateSemanticEdgesReceipt = makeReceipt({
  stageId: twoRelationshipStage.stagingId,
  stageDigest: twoRelationshipStage.digest,
  status: 'noop',
  complete: false,
  candidateMemoryRecords: 0,
  uniqueMemoryRecords: 0,
  importedCount: 0,
  deduplicatedCount: 0,
  projectedRelationships: 2,
  deferredRelationships: 0,
  semanticEdgeIds: ['edge-same', 'edge-same'],
  memoryIds: [],
  createdMemoryIds: [],
  deferredSections: {},
});
assert.equal(isValidHmxApplyReceipt(twoRelationshipStage, duplicateSemanticEdgesReceipt), false,
  'duplicate edge IDs cannot be made valid merely by matching projected relationship counters');
for (const item of [
  { overrides: { deferredSections: { relationships: 0 } }, label: 'zero deferred counters are not valid section evidence' },
  { overrides: { deferredSections: { goals: 1 } }, label: 'receipt cannot invent a deferred section absent from staged input' },
  { overrides: { deferredSections: {} }, label: 'deferred relationship count must also appear in the deferred summary' },
  { overrides: { deferredRelationships: 0 }, label: 'projected and deferred relationship counts must cover the staged relationship array' },
]) {
  const forgedReceipt = makeReceipt({
    stageId: relationshipStage.stagingId,
    stageDigest: relationshipStage.digest,
    status: 'noop',
    complete: false,
    projectedRelationships: 0,
    deferredRelationships: 1,
    deferredSections: { relationships: 1 },
    ...item.overrides,
  });
  assert.equal(isValidHmxApplyReceipt(relationshipStage, forgedReceipt), false, item.label);
}

// Exported validation must reject getter-backed inputs without executing their getters.
let receiptGetterExecuted = false;
const accessorReceipt = { ...receipt };
Object.defineProperty(accessorReceipt, 'status', {
  enumerable: true,
  get() { receiptGetterExecuted = true; throw new Error('receipt getter must not run'); },
});
assert.equal(isValidHmxApplyReceipt(stage, accessorReceipt), false);
assert.equal(receiptGetterExecuted, false, 'receipt validation must not execute accessors');

let stageGetterExecuted = false;
const accessorStage = { ...stage, lifecycleDigest: '' };
Object.defineProperty(accessorStage, 'exportId', {
  enumerable: true,
  get() { stageGetterExecuted = true; throw new Error('stage getter must not run'); },
});
assert.equal(isValidHmxApplyReceipt(accessorStage, receipt), false);
assert.equal(stageGetterExecuted, false, 'stage validation must not execute accessors');

// Section names are external input. "__proto__" must survive as an ordinary deferred key.
const prototypeSectionStage = {
  status: 'accepted',
  exportId: stage.exportId,
  sourceLineageId: stage.sourceLineageId,
  stagingId: 'stage-proto-section',
  digest: '',
  lifecycleDigest: '',
  applicationAttempts: 0,
  intent: 'port',
  strategy: 'additive',
  sectionCounts: {},
  protectedSections: [],
  conflicts: [],
  stagedSections: JSON.parse('{"__proto__":[{"goal":"defer this future section"}]}'),
};
prototypeSectionStage.digest = computeHmxStageDigest(prototypeSectionStage);
refreshHmxStageLifecycleDigest(prototypeSectionStage);
const noWriteMemoryFabric = {
  canonicalSnapshot() { return { items: [] }; },
  encode() { throw new Error('unexpected memory write for no-memory HMX section'); },
  revise() { throw new Error('unexpected memory revision for no-memory HMX section'); },
  forgetById() { throw new Error('unexpected memory deletion for no-memory HMX section'); },
};
const prototypeSectionProjector = new HexisCanonicalMemoryProjector(noWriteMemoryFabric);
const prototypeSectionReceipt = prototypeSectionProjector.apply(prototypeSectionStage);
assert.equal(Object.hasOwn(prototypeSectionReceipt.deferredSections, '__proto__'), true,
  'prototype-named HMX sections must be preserved in the receipt');
assert.equal(prototypeSectionReceipt.deferredSections.__proto__, 1);
assert.equal(prototypeSectionReceipt.status, 'noop');
const prototypeAppliedStage = {
  ...prototypeSectionStage,
  status: 'applied',
  applicationAttempts: prototypeSectionReceipt.attempt,
  application: prototypeSectionReceipt,
  lifecycleDigest: '',
};
refreshHmxStageLifecycleDigest(prototypeAppliedStage);
assert.equal(isValidHmxApplyReceipt(prototypeAppliedStage, prototypeSectionReceipt), true,
  'receipt validation must retain and verify prototype-named deferred sections');

console.log('WorkPass426 HMX application attempt integrity: PASS');
console.log('WorkPass427 HMX apply receipt semantic integrity: PASS');
console.log('WorkPass428 HMX deferred-section and receipt identity integrity: PASS');
console.log('HEXIS_PROJECTOR_IDEMPOTENT_REPLAY=PASS', JSON.stringify({ writes, receiptDigest: receipt.digest }));
