import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { HexisCanonicalMemoryProjector, isValidHmxApplyReceipt } from '../src/organism/integration/hexis/HexisCanonicalMemoryProjector.mjs';
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

// WorkPass426: lifecycle attempt counters are not in the HMX content digest, but remain trusted state.
for (const invalidAttempts of ['bad', '2', 1.5, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  const malformedAttemptStage = structuredClone(stage);
  malformedAttemptStage.status = 'accepted';
  delete malformedAttemptStage.application;
  malformedAttemptStage.applicationAttempts = invalidAttempts;
  assert.throws(
    () => projector.apply(malformedAttemptStage),
    /hmx-stage-digest-invalid/,
    'malformed applicationAttempts must be rejected before canonical reads/writes',
  );
}
assert.equal(writes, 0, 'invalid attempt counters must not touch canonical storage');
const attemptMismatchStage = structuredClone(stage);
attemptMismatchStage.applicationAttempts = 2;
attemptMismatchStage.application = makeReceipt({ attempt: 1 });
assert.throws(() => projector.apply(attemptMismatchStage), /hmx-applied-receipt-invalid/,
  'a persisted receipt cannot claim a different apply attempt from its stage');
assert.equal(writes, 0, 'attempt mismatches must not re-enter canonical storage');

// WorkPass427: a recomputed digest is not proof that a receipt describes a possible apply.
const semanticallyInvalidReceipts = [
  { overrides: { candidateMemoryRecords: 1 }, label: 'candidate count matches staged memory rows' },
  { overrides: { complete: true }, label: 'noop receipts cannot claim completion' },
  { overrides: { status: 'applied' }, label: 'zero-memory receipts must remain noop' },
  { overrides: { memoryIds: ['memory-1'] }, label: 'memory IDs match unique row count' },
  { overrides: { createdMemoryIds: ['memory-1'] }, label: 'created IDs match imported count' },
  { overrides: { deduplicatedCount: 1 }, label: 'imported and deduplicated counts cover unique rows' },
  { overrides: { semanticEdgeIds: ['edge-1'] }, label: 'receipt edges do not exceed projected relationship count' },
];
for (const item of semanticallyInvalidReceipts) {
  const impossibleStage = { ...stage, application: makeReceipt(item.overrides) };
  assert.throws(() => projector.apply(impossibleStage), /hmx-applied-receipt-invalid/, item.label);
}
assert.equal(writes, 0, 'semantically impossible receipts must fail before canonical storage');

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
  'a semantically coherent non-noop receipt remains replay-compatible');
assert.equal(writes, 0, 'valid receipt replay remains a no-write operation');

const semanticallyInvalidAppliedReceipts = [
  { overrides: { memoryIds: [''] }, label: 'empty memory ID' },
  { overrides: { memoryIds: [' '], createdMemoryIds: [' '] }, label: 'whitespace-only memory identity' },
  { overrides: { createdMemoryIds: ['other-memory'] }, label: 'created IDs must be members of memory IDs' },
  { overrides: { semanticEdgeIds: [''] }, label: 'empty semantic-edge identity' },
];
for (const item of semanticallyInvalidAppliedReceipts) {
  const forged = {
    ...coherentAppliedStage,
    application: makeReceipt({
      stageDigest: coherentAppliedStage.digest,
      status: 'applied',
      complete: true,
      candidateMemoryRecords: 1,
      uniqueMemoryRecords: 1,
      importedCount: 1,
      deduplicatedCount: 0,
      memoryIds: ['memory-1'],
      createdMemoryIds: ['memory-1'],
      ...item.overrides,
    }),
  };
  assert.equal(isValidHmxApplyReceipt(forged, forged.application), false, item.label);
}

// Deferred counters must be an exact projection of the staged sections.
const relationshipStage = {
  status: 'applied',
  exportId: stage.exportId,
  sourceLineageId: stage.sourceLineageId,
  stagingId: 'stage-with-relationship',
  digest: '',
  intent: 'port',
  strategy: 'additive',
  sectionCounts: {},
  protectedSections: [],
  conflicts: [],
  stagedSections: { relationships: [{ source_ref: 'missing-a', target_ref: 'missing-b', edge_type: 'supports' }] },
};
relationshipStage.digest = computeHmxStageDigest(relationshipStage);
const coherentDeferredRelationshipReceipt = makeReceipt({
  stageId: relationshipStage.stagingId,
  stageDigest: relationshipStage.digest,
  status: 'noop',
  complete: false,
  projectedRelationships: 0,
  deferredRelationships: 1,
  deferredSections: { relationships: 1 },
});
assert.equal(isValidHmxApplyReceipt(relationshipStage, coherentDeferredRelationshipReceipt), true,
  'a coherent deferred relationship count is allowed for an empty-memory import');
for (const item of [
  { overrides: { deferredSections: { relationships: 0 } }, label: 'zero deferred-section counters are not evidence of deferral' },
  { overrides: { deferredSections: { goals: 1 } }, label: 'a receipt cannot invent a deferred section absent from the stage' },
  { overrides: { deferredSections: {} }, label: 'deferred relationships must also appear in the section summary' },
  { overrides: { deferredRelationships: 0, projectedRelationships: 1 }, label: 'projected relationship counts cannot exceed the staged set' },
]) {
  const forged = {
    ...relationshipStage,
    application: makeReceipt({
      stageId: relationshipStage.stagingId,
      stageDigest: relationshipStage.digest,
      status: 'noop',
      complete: false,
      projectedRelationships: 0,
      deferredRelationships: 1,
      deferredSections: { relationships: 1 },
      ...item.overrides,
    }),
  };
  assert.equal(isValidHmxApplyReceipt(forged, forged.application), false, item.label);
}

// Exported receipt validation must fail closed without evaluating accessors.
let receiptGetterExecuted = false;
const accessorReceipt = { ...receipt };
Object.defineProperty(accessorReceipt, 'status', {
  enumerable: true,
  get() { receiptGetterExecuted = true; throw new Error('receipt getter must not run'); },
});
assert.equal(isValidHmxApplyReceipt(stage, accessorReceipt), false);
assert.equal(receiptGetterExecuted, false, 'receipt validator must never execute accessor-backed fields');
let stageGetterExecuted = false;
const accessorStage = structuredClone(stage);
Object.defineProperty(accessorStage, 'exportId', {
  enumerable: true,
  get() { stageGetterExecuted = true; throw new Error('stage getter must not run'); },
});
assert.equal(isValidHmxApplyReceipt(accessorStage, receipt), false);
assert.equal(stageGetterExecuted, false, 'receipt validator must not execute stage accessors');

console.log('WorkPass426 HMX application attempt integrity: PASS');
console.log('WorkPass427 HMX apply receipt semantic integrity: PASS');
console.log('WorkPass428 HMX deferred-section and receipt identity integrity: PASS');

// Future section keys must remain visible, even if they collide with Object.prototype names.
const prototypeSectionStage = {
  status: 'accepted',
  exportId: stage.exportId,
  sourceLineageId: stage.sourceLineageId,
  stagingId: 'stage-proto-section',
  digest: '',
  intent: 'port',
  strategy: 'additive',
  sectionCounts: {},
  protectedSections: [],
  conflicts: [],
  stagedSections: JSON.parse('{"__proto__":[{"goal":"defer this future section"}]}'),
};
prototypeSectionStage.digest = computeHmxStageDigest(prototypeSectionStage);
const noWriteMemoryFabric = {
  canonicalSnapshot() { return { items: [] }; },
  encode() { throw new Error('unexpected-memory-write-for-empty-section'); },
  revise() { throw new Error('unexpected-memory-revision-for-empty-section'); },
  forgetById() { throw new Error('unexpected-memory-delete-for-empty-section'); },
};
const prototypeSectionProjector = new HexisCanonicalMemoryProjector(noWriteMemoryFabric);
const prototypeSectionReceipt = prototypeSectionProjector.apply(prototypeSectionStage);
assert.equal(Object.hasOwn(prototypeSectionReceipt.deferredSections, '__proto__'), true,
  'special section names must be retained as own deferred metadata');
assert.equal(prototypeSectionReceipt.deferredSections.__proto__, 1);
assert.equal(prototypeSectionReceipt.status, 'noop');
const prototypeAppliedStage = {
  ...prototypeSectionStage,
  status: 'applied',
  applicationAttempts: prototypeSectionReceipt.attempt,
  application: prototypeSectionReceipt,
};
assert.equal(isValidHmxApplyReceipt(prototypeAppliedStage, prototypeSectionReceipt), true,
  'the applied receipt must preserve special deferred-section keys across validation');

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
