import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { HexisCanonicalMemoryProjector, isValidHmxApplyReceipt } from '../src/organism/integration/hexis/HexisCanonicalMemoryProjector.mjs';
import { computeHmxStageDigest, refreshHmxStageLifecycleDigest, isSafeJsonTree } from '../src/organism/integration/hexis/HexisStageIntegrity.mjs';

const hash = value => createHash('sha256').update(String(value)).digest('hex');

const compensationMemoryOS = new MemoryOS2({ embeddingProvider: null });
const compensationState = compensationMemoryOS.snapshot();
compensationState.items = [{
  id: 'signal-rollback-fixture',
  content: 'pre-transaction confidence and provenance',
  kind: 'semantic',
  source: 'hexis:signal-rollback-source',
  epistemicStatus: 'belief',
  createdAt: 1000,
  lastAccessAt: 1000,
  salience: 0.8,
  emotionalWeight: 0.1,
  identityRelevance: 0.2,
  goalRelevance: 0.2,
  socialRelevance: 0.2,
  predictionError: 0,
  temperature01: 0.3,
  confidence: 0.95,
  sourceAuthority01: 0.95,
  tags: ['hexis-import'],
  context: { hexisSourceLineageId: 'signal-test-lineage' },
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  revisionHistory: [{ at: 1000, from: 'belief', to: 'belief', reason: 'fixture-baseline' }],
  validFromAt: 1000,
  validUntilAt: null,
  observedAt: 1000,
  supersedesId: null,
  supersededById: null,
  revisionGroupId: 'signal-rollback-fixture',
  revisionSequence: 1,
  provenanceClass: 'external',
  independenceKey: 'signal-test-source',
  evidenceFreshnessAt: 1000,
  evidenceSources: [{
    source: 'hexis:signal-rollback-source',
    provenanceClass: 'external',
    sourceAuthority01: 0.95,
    independenceKey: 'signal-test-source',
    observedAt: 1000,
    evidenceFreshnessAt: 1000,
  }],
  evidenceLineageKeys: ['hexis:signal-rollback-source'],
  dormant: false,
  retrievalCount: 0,
  semanticVector: [],
}];
compensationMemoryOS.restore(compensationState);
const preSignalMutation = compensationMemoryOS.snapshot().items.find(item => item.id === 'signal-rollback-fixture');
assert.ok(preSignalMutation);
const signalCompensationToken = compensationMemoryOS.captureSignalCompensation('signal-rollback-fixture');
assert.ok(signalCompensationToken);
compensationMemoryOS.updateSignals('signal-rollback-fixture', {
  confidence: 0.2,
  sourceAuthority01: 0.2,
  salience: 0.1,
  evidenceSources: [{
    source: 'hexis:signal-rollback-source',
    provenanceClass: 'external',
    sourceAuthority01: 0.2,
    independenceKey: 'signal-test-source',
    observedAt: 1000,
    evidenceFreshnessAt: 1000,
  }],
}, 'simulated-hmx-authority-cap');
const signalMutation = compensationMemoryOS.snapshot().items.find(item => item.id === 'signal-rollback-fixture');
assert.equal(signalMutation.confidence, 0.2);
assert.equal(signalMutation.sourceAuthority01, 0.2);
assert.notDeepEqual(signalMutation.revisionHistory, preSignalMutation.revisionHistory);
assert.equal(compensationMemoryOS.restoreSignalsForCompensation('signal-rollback-fixture', preSignalMutation), false,
  'a caller-supplied snapshot must not authorize signal restoration');
assert.equal(compensationMemoryOS.restoreSignalsForCompensation('signal-rollback-fixture', signalCompensationToken), true);
assert.deepEqual(
  compensationMemoryOS.snapshot().items.find(item => item.id === 'signal-rollback-fixture'),
  preSignalMutation,
  'HMX compensation must restore authority, confidence, evidence lineage, timestamps and revision history exactly',
);

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

// The public safe-tree validator owns its recursion budget; callers cannot weaken depth/node limits.
let overDepthTree = { leaf: true };
for (let depth = 0; depth < 65; depth++) overDepthTree = { next: overDepthTree };
assert.equal(isSafeJsonTree(overDepthTree), false, 'trees beyond the public depth limit must fail');
assert.equal(isSafeJsonTree(overDepthTree, new Set(), -1000, { nodes: -1000 }), false,
  'extra JavaScript arguments cannot weaken the validator depth or node budget');
assert.equal(isSafeJsonTree('x'.repeat(1_000_001)), false,
  'a single unbounded JSON string must fail the structural validation budget');
const wideTree = Object.fromEntries(Array.from({ length: 4097 }, (_, index) => ['field-' + index, index]));
assert.equal(isSafeJsonTree(wideTree), false,
  'a single object cannot bypass the tree budget with an excessive number of own keys');
assert.equal(isSafeJsonTree({ [ 'k'.repeat(4097) ]: true }), false,
  'oversized JSON object keys must fail structural validation');
const primitiveHeavyTree = Object.fromEntries(Array.from({ length: 100 }, (_, index) =>
  ['list-' + index, Array.from({ length: 1000 }, () => true)]));
assert.equal(isSafeJsonTree(primitiveHeavyTree), false,
  'primitive leaf values must count toward the aggregate node budget');

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
  { overrides: { warnings: ['unsafe' + String.fromCharCode(7) + 'warning'] }, label: 'receipt warning control characters are invalid' },
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

// Padded identity fields must fail even when an attacker recomputes both digests.
for (const field of ['sourceLineageId', 'stagingId']) {
  const paddedIdentityStage = structuredClone(coherentAppliedStage);
  paddedIdentityStage[field] = ' ' + paddedIdentityStage[field] + ' ';
  paddedIdentityStage.digest = computeHmxStageDigest(paddedIdentityStage);
  paddedIdentityStage.lifecycleDigest = '';
  paddedIdentityStage.application = undefined;
  const paddedIdentityReceipt = makeReceipt({
    exportId: paddedIdentityStage.exportId,
    sourceLineageId: paddedIdentityStage.sourceLineageId,
    stageId: paddedIdentityStage.stagingId,
    stageDigest: paddedIdentityStage.digest,
    status: 'applied',
    complete: true,
    candidateMemoryRecords: 1,
    uniqueMemoryRecords: 1,
    importedCount: 1,
    deduplicatedCount: 0,
    projectedRelationships: 0,
    deferredRelationships: 0,
    memoryIds: ['memory-1'],
    createdMemoryIds: ['memory-1'],
    semanticEdgeIds: [],
    deferredSections: {},
  });
  paddedIdentityStage.application = paddedIdentityReceipt;
  refreshHmxStageLifecycleDigest(paddedIdentityStage);
  assert.equal(isValidHmxApplyReceipt(paddedIdentityStage, paddedIdentityReceipt), false,
    field + ' must be canonical even when stage and receipt digests are recomputed');
}

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
const persistedPrototypeReceipt = JSON.parse(JSON.stringify(prototypeSectionReceipt));
assert.equal(Object.hasOwn(persistedPrototypeReceipt.deferredSections, '__proto__'), true,
  'the __proto__ deferred key must survive JSON persistence as an own data property');
const prototypeAppliedStage = {
  ...prototypeSectionStage,
  status: 'applied',
  applicationAttempts: persistedPrototypeReceipt.attempt,
  application: persistedPrototypeReceipt,
  lifecycleDigest: '',
};
refreshHmxStageLifecycleDigest(prototypeAppliedStage);
assert.equal(isValidHmxApplyReceipt(prototypeAppliedStage, persistedPrototypeReceipt), true,
  'receipt validation must retain and verify prototype-named deferred sections after JSON round-trip');

console.log('WorkPass426 HMX application attempt integrity: PASS');
console.log('WorkPass427 HMX apply receipt semantic integrity: PASS');
console.log('WorkPass428 HMX deferred-section and receipt identity integrity: PASS');
// WorkPass428: an exception after canonical write and graph projection must compensate all stores.
const priorRollbackMemory = {
  id: 'hexis-memory:prior-baseline',
  content: 'Old HMX content',
  source: 'hexis:prior-source-key',
  epistemicStatus: 'belief',
  kind: 'semantic',
  tags: ['hexis-import'],
  confidence: 0.7,
  sourceAuthority01: 0.7,
  evidenceSources: [],
  evidenceLineageKeys: [],
  salience: 0.5,
  emotionalWeight: 0.1,
  identityRelevance: 0.05,
  goalRelevance: 0.05,
  socialRelevance: 0.05,
  predictionError: 0,
  dormant: false,
  lastAccessAt: 1000,
  temperature01: 0.2,
  revisionHistory: [],
  context: {
    hexisExportId: 'exp_aaaaaaaaaaaaaaaa',
    hexisSourceLineageId: stage.sourceLineageId,
    hexisMemoryRef: 'exp_aaaaaaaaaaaaaaaa:rollback-memory',
    hexisOriginalType: 'semantic',
    hexisGraphSourceKey: 'hexis:prior-graph-key',
  },
};
const priorRollbackDuplicate = {
  id: 'hexis-memory:duplicate-baseline',
  content: 'Existing duplicate content',
  source: 'hexis:duplicate-source-key',
  epistemicStatus: 'unknown',
  kind: 'semantic',
  tags: ['hexis-import'],
  confidence: 0.95,
  sourceAuthority01: 0.95,
  evidenceSources: [{
    source: 'hexis:duplicate-source-key',
    provenanceClass: 'external',
    sourceAuthority01: 0.95,
    independenceKey: 'duplicate-source',
    observedAt: 1000,
    evidenceFreshnessAt: 1000,
  }],
  evidenceLineageKeys: ['hexis:duplicate-source-key'],
  salience: 0.65,
  emotionalWeight: 0.1,
  identityRelevance: 0.05,
  goalRelevance: 0.05,
  socialRelevance: 0.05,
  predictionError: 0,
  dormant: false,
  lastAccessAt: 1000,
  temperature01: 0.4,
  revisionHistory: [{ at: 1000, from: 'unknown', to: 'unknown', reason: 'pre-import' }],
  context: {
    hexisExportId: 'exp_aaaaaaaaaaaaaaaa',
    hexisSourceLineageId: stage.sourceLineageId,
    hexisMemoryRef: 'exp_aaaaaaaaaaaaaaaa:rollback-duplicate',
    hexisOriginalType: 'semantic',
    hexisGraphSourceKey: 'hexis:duplicate-graph-key',
  },
};
const rollbackCanonicalItems = [structuredClone(priorRollbackMemory), structuredClone(priorRollbackDuplicate)];
const rollbackMemoryBaseline = structuredClone(rollbackCanonicalItems);
const rollbackSignalReceipts = new Map();
const signalFields = [
  'salience', 'emotionalWeight', 'identityRelevance', 'goalRelevance', 'socialRelevance',
  'predictionError', 'confidence', 'sourceAuthority01', 'evidenceSources', 'evidenceLineageKeys',
  'dormant', 'lastAccessAt', 'temperature01', 'revisionHistory',
];
const rollbackMemoryFabric = {
  canonicalSnapshot() { return { items: structuredClone(rollbackCanonicalItems) }; },
  encode(input) {
    const record = structuredClone(input);
    rollbackCanonicalItems.push(record);
    return structuredClone(record);
  },
  forgetById(id) {
    const index = rollbackCanonicalItems.findIndex(item => item.id === id);
    if (index >= 0) rollbackCanonicalItems.splice(index, 1);
    return index >= 0;
  },
  revise(id, epistemicStatus) {
    const item = rollbackCanonicalItems.find(candidate => candidate.id === id);
    if (item) item.epistemicStatus = epistemicStatus;
    return item ?? null;
  },
  updateSignals(id, patch, reason, context = {}) {
    const item = rollbackCanonicalItems.find(candidate => candidate.id === id);
    if (!item) return null;
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'sourceAuthority01') item.sourceAuthority01 = Math.min(item.sourceAuthority01 ?? 0.45, value);
      else if (key === 'evidenceSources') {
        item.evidenceSources = value.map(evidence => ({
          ...evidence,
          sourceAuthority01: Math.min(evidence.sourceAuthority01 ?? 0.45, patch.sourceAuthority01 ?? 1),
        }));
      } else item[key] = structuredClone(value);
    }
    item.lastAccessAt = 2000;
    item.temperature01 = 0.9;
    item.revisionHistory = [...(item.revisionHistory ?? []), {
      at: 2000, from: item.epistemicStatus, to: item.epistemicStatus, reason,
    }];
    if (context.commandId) rollbackSignalReceipts.set(context.commandId, { action: 'update-signals', id });
    return structuredClone(item);
  },
  restoreSignalsForCompensation(id, snapshot, reason, context = {}) {
    assert.equal(reason, 'hexis-hmx-apply-rollback');
    const item = rollbackCanonicalItems.find(candidate => candidate.id === id);
    if (!item) return false;
    for (const key of signalFields) {
      if (snapshot[key] === undefined) delete item[key];
      else item[key] = structuredClone(snapshot[key]);
    }
    for (const sourceCommandId of context.sourceCommandIds ?? []) rollbackSignalReceipts.delete(sourceCommandId);
    return true;
  },
};
const rollbackGraphState = {
  nodes: [{ id: 'rollback-graph:prior', label: 'old hmx content', type: 'concept', sourceKey: 'hexis:prior-graph-key' }],
  edges: [],
};
const rollbackGraphBaseline = structuredClone(rollbackGraphState);
const rollbackSemanticGraph = {
  snapshot() { return structuredClone(rollbackGraphState); },
  restore(snapshot) {
    rollbackGraphState.nodes = structuredClone(snapshot.nodes);
    rollbackGraphState.edges = structuredClone(snapshot.edges);
    return true;
  },
  upsertNode(label, type, salience, sourceKey) {
    const prior = rollbackGraphState.nodes.find(node =>
      node.label === String(label).toLowerCase() && node.type === type && node.sourceKey === sourceKey);
    if (prior) return prior;
    const node = { id: 'rollback-graph:' + (rollbackGraphState.nodes.length + 1), label: String(label).toLowerCase(), type, salience, sourceKey };
    rollbackGraphState.nodes.push(node);
    return node;
  },
  connect(from, to, relation, weight) {
    const edge = { id: 'rollback-edge:' + (rollbackGraphState.edges.length + 1), from, to, relation, weight };
    rollbackGraphState.edges.push(edge);
    return edge;
  },
};
const rollbackTemporalState = {
  assertions: [],
  beliefs: [{ memoryId: priorRollbackMemory.id, epistemicStatus: 'belief', source: 'preexisting-history' }],
};
const rollbackTemporalBaseline = structuredClone(rollbackTemporalState);
let failFirstTemporalAssertion = true;
const rollbackTemporalLedger = {
  snapshot() { return structuredClone(rollbackTemporalState); },
  restore(snapshot) {
    rollbackTemporalState.assertions = structuredClone(snapshot.assertions);
    rollbackTemporalState.beliefs = structuredClone(snapshot.beliefs);
    return true;
  },
  recordTemporalAssertion(assertion) {
    rollbackTemporalState.assertions.push(structuredClone(assertion));
    if (failFirstTemporalAssertion) {
      failFirstTemporalAssertion = false;
      throw new Error('injected-hmx-temporal-write-failure');
    }
    return { id: 'rollback-temporal:' + rollbackTemporalState.assertions.length };
  },
  registerOrUpdateBelief(belief) {
    rollbackTemporalState.beliefs = rollbackTemporalState.beliefs.filter(item => item.memoryId !== belief.memoryId);
    rollbackTemporalState.beliefs.push(structuredClone(belief));
    return true;
  },
  removeBeliefProjection(memoryId) {
    rollbackTemporalState.beliefs = rollbackTemporalState.beliefs.filter(item => item.memoryId !== memoryId);
    return true;
  },
};
const rollbackStage = {
  ...stage,
  status: 'accepted',
  stagingId: 'stage-atomic-rollback',
  digest: '',
  lifecycleDigest: '',
  applicationAttempts: 0,
  application: undefined,
  sectionCounts: { memories: 2 },
  stagedSections: {
    memories: [
      {
        ref: stage.exportId + ':rollback-memory',
        type: 'semantic',
        content: 'Atomic HMX rollback fixture',
        status: 'belief',
      },
      {
        ref: stage.exportId + ':rollback-duplicate',
        type: 'semantic',
        content: 'Existing duplicate content',
        status: 'unknown',
        trust_level: 0.2,
      },
    ],
  },
};
rollbackStage.digest = computeHmxStageDigest(rollbackStage);
refreshHmxStageLifecycleDigest(rollbackStage);
const rollbackProjector = new HexisCanonicalMemoryProjector(
  rollbackMemoryFabric, rollbackSemanticGraph, rollbackTemporalLedger,
);
assert.throws(
  () => rollbackProjector.apply(rollbackStage),
  /hmx-canonical-apply-failed:injected-hmx-temporal-write-failure/,
  'a failure after canonical write and graph projection must propagate after compensation',
);
assert.deepEqual(rollbackMemoryFabric.canonicalSnapshot().items, rollbackMemoryBaseline,
  'canonical memory and prior epistemic status must return to baseline after a downstream temporal failure');
assert.deepEqual(rollbackSemanticGraph.snapshot(), rollbackGraphBaseline,
  'semantic graph nodes and edges must return to their pre-existing baseline after temporal projection fails');
assert.deepEqual(rollbackTemporalLedger.snapshot(), rollbackTemporalBaseline,
  'partially written temporal assertions and withdrawn prior beliefs must be rolled back');
const rollbackRetryReceipt = rollbackProjector.apply(rollbackStage);
assert.equal(rollbackRetryReceipt.status, 'applied',
  'the same staged HMX import must be retryable after a successful compensation');
const rollbackAfterRetry = rollbackMemoryFabric.canonicalSnapshot().items;
assert.equal(rollbackAfterRetry.length, 3,
  'the retry must preserve both pre-existing rows and create exactly one new canonical memory');
const rollbackOriginalIds = new Set(rollbackMemoryBaseline.map(item => item.id));
const newRollbackMemory = rollbackAfterRetry.find(item => !rollbackOriginalIds.has(item.id));
const supersededRollbackMemory = rollbackAfterRetry.find(item => item.id === priorRollbackMemory.id);
const reconciledRollbackDuplicate = rollbackAfterRetry.find(item => item.id === priorRollbackDuplicate.id);
assert.ok(newRollbackMemory);
assert.equal(newRollbackMemory.epistemicStatus, 'belief');
assert.equal(supersededRollbackMemory.epistemicStatus, 'quarantined',
  'successful retry must supersede the old belief without erasing historical memory');
assert.ok(reconciledRollbackDuplicate);
assert.equal(reconciledRollbackDuplicate.confidence, 0.2,
  'a successful retry still applies the incoming confidence cap to a duplicate');
assert.equal(reconciledRollbackDuplicate.sourceAuthority01, 0.2,
  'a successful retry still applies the incoming authority cap to a duplicate');
assert.equal(rollbackSemanticGraph.snapshot().nodes.length, 1,
  'the retry must leave exactly one active semantic projection after removing the prior version');
assert.notEqual(rollbackSemanticGraph.snapshot().nodes[0].sourceKey, 'hexis:prior-graph-key');
assert.equal(rollbackTemporalLedger.snapshot().assertions.length, 1,
  'the retry must create exactly one new temporal assertion');
assert.equal(rollbackTemporalLedger.snapshot().beliefs.length, 1,
  'the retry must register exactly one new belief projection');
assert.equal(rollbackTemporalLedger.snapshot().beliefs[0].memoryId, newRollbackMemory.id,
  'the new belief is active and the superseded prior belief remains withdrawn');

// Known HMX sections have strict array contracts and must fail before canonical storage is touched.
let malformedKnownSectionStorageTouched = false;
const noTouchMemoryFabric = {
  canonicalSnapshot() { malformedKnownSectionStorageTouched = true; return { items: [] }; },
  encode() { malformedKnownSectionStorageTouched = true; throw new Error('unexpected-encode'); },
  revise() { malformedKnownSectionStorageTouched = true; throw new Error('unexpected-revise'); },
  forgetById() { malformedKnownSectionStorageTouched = true; throw new Error('unexpected-forget'); },
};
const noTouchProjector = new HexisCanonicalMemoryProjector(noTouchMemoryFabric);
for (const [field, value] of [
  ['memories', 'this must not be silently interpreted as no memories'],
  ['relationships', 'this must not be silently interpreted as no relationships'],
]) {
  const malformedSectionStage = {
    ...stage,
    status: 'accepted',
    stagingId: 'stage-invalid-' + field + '-section',
    digest: '',
    lifecycleDigest: '',
    applicationAttempts: 0,
    application: undefined,
    stagedSections: { [field]: value },
  };
  malformedSectionStage.digest = computeHmxStageDigest(malformedSectionStage);
  refreshHmxStageLifecycleDigest(malformedSectionStage);
  assert.throws(
    () => noTouchProjector.apply(malformedSectionStage),
    new RegExp('hmx-apply-known-section-must-be-array:' + field),
    field + ' must obey its declared array contract',
  );
  assert.equal(malformedKnownSectionStorageTouched, false,
    'malformed ' + field + ' sections must fail before canonical reads or writes');
}

// Non-array/object future HMX sections must not disappear from deferred-section accounting.
const scalarDeferredStage = {
  ...stage,
  status: 'accepted',
  stagingId: 'stage-scalar-deferred-section',
  digest: '',
  lifecycleDigest: '',
  applicationAttempts: 0,
  application: undefined,
  stagedSections: { goals: 'future-goal-payload' },
};
scalarDeferredStage.digest = computeHmxStageDigest(scalarDeferredStage);
refreshHmxStageLifecycleDigest(scalarDeferredStage);
const scalarDeferredProjector = new HexisCanonicalMemoryProjector(noWriteMemoryFabric);
const scalarDeferredReceipt = scalarDeferredProjector.apply(scalarDeferredStage);
assert.equal(scalarDeferredReceipt.status, 'noop');
assert.equal(scalarDeferredReceipt.deferredSections.goals, 1,
  'a non-empty scalar future section must remain visible as deferred work');
const scalarDeferredAppliedStage = {
  ...scalarDeferredStage,
  status: 'applied',
  applicationAttempts: scalarDeferredReceipt.attempt,
  application: scalarDeferredReceipt,
  lifecycleDigest: '',
};
refreshHmxStageLifecycleDigest(scalarDeferredAppliedStage);
assert.equal(isValidHmxApplyReceipt(scalarDeferredAppliedStage, scalarDeferredReceipt), true,
  'receipt validation must agree with scalar-section deferral semantics');

console.log('WorkPass428 HMX scalar deferred-section integrity: PASS');

console.log('HEXIS_PROJECTOR_IDEMPOTENT_REPLAY=PASS', JSON.stringify({ writes, receiptDigest: receipt.digest }));
