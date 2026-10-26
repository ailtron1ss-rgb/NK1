import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { HexisCanonicalMemoryProjector } from '../src/organism/integration/hexis/HexisCanonicalMemoryProjector.mjs';
import { calculateHmxStageDigest } from '../src/organism/integration/hexis/HexisHmxReceiptGuard.ts';
import { sha256Stable } from '../src/organism/core/StableSerialization.ts';

const hash = value => createHash('sha256').update(String(value)).digest('hex');
const stage = {
  status: 'applied',
  exportId: 'exp_0123456789abcdef',
  sourceLineageId: 'trusted-lineage-1',
  stagingId: 'stage-1',
  digest: 'persisted-stage-digest',
  intent: 'port',
  strategy: 'additive',
};
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

// New receipts use canonical serialization; the same receipt must remain valid when
// persistence restores identical fields in a different object-key order.
const receiptPayload = Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'digest'));
const canonicalReceipt = {
  ...receiptPayload,
  digest: sha256Stable(receiptPayload, 'legacy'),
};
const reorderedCanonicalReceipt = {
  ...Object.fromEntries(Object.entries(receiptPayload).reverse()),
  digest: canonicalReceipt.digest,
};
assert.deepEqual(
  projector.apply({ ...stage, application: reorderedCanonicalReceipt }),
  reorderedCanonicalReceipt,
  'canonical receipt verification must be independent of JSON object-key order',
);

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
  () => projector.apply({ status: 'applied', application: { status: 'applied' } }),
  /hmx-applied-receipt-invalid/,
);
assert.throws(
  () => projector.apply({ status: 'pending', intent: 'port', strategy: 'additive' }),
  /hmx-stage-must-be-accepted-before-apply/,
);

const acceptedCandidate = {
  status: 'accepted',
  exportId: 'exp_0123456789abcdef',
  sourceLineageId: 'trusted-lineage-1',
  stagingId: 'stage-accepted-1',
  digest: '',
  intent: 'port',
  strategy: 'additive',
  sectionCounts: { memories: 0 },
  protectedSections: [],
  conflicts: [],
  stagedSections: { memories: [] },
};
acceptedCandidate.digest = calculateHmxStageDigest(acceptedCandidate);
assert.equal(typeof acceptedCandidate.digest, 'string');

assert.throws(
  () => projector.apply({ ...acceptedCandidate, stagingId: '' }),
  /hmx-stage-identity-required/,
  'canonical apply must require a stable stage identity and digest',
);
assert.throws(
  () => projector.apply({ ...acceptedCandidate, conflicts: [{ path: 'sections.memories', kind: 'schema' }] }),
  /hmx-stage-has-conflicts/,
  'direct projector callers must not bypass the staging conflict gate',
);
const duplicateCandidate = {
  ...acceptedCandidate,
  stagedSections: {
    memories: [
      { ref: acceptedCandidate.exportId + ':duplicate', type: 'semantic', content: 'Same content.' },
      { ref: acceptedCandidate.exportId + ':duplicate', type: 'procedural', content: 'Same content.' },
    ],
  },
};
duplicateCandidate.digest = calculateHmxStageDigest(duplicateCandidate);
assert.throws(
  () => projector.apply(duplicateCandidate),
  /hmx-apply-duplicate-ref-conflict/,
  'canonical apply must reject duplicate refs even if a caller bypasses stageHmx',
);

const tamperedAcceptedStage = {
  ...acceptedCandidate,
  stagedSections: {
    memories: [{ ref: acceptedCandidate.exportId + ':tampered', type: 'semantic', content: 'Payload changed after staging.' }],
  },
};
assert.throws(
  () => projector.apply(tamperedAcceptedStage),
  /hmx-stage-digest-invalid/,
  'a payload changed after staging must not be applied under the original digest',
);
assert.throws(
  () => projector.apply({ ...acceptedCandidate, application: receipt }),
  /hmx-stage-digest-invalid/,
  'a receipt on a non-applied stage indicates a torn/downgraded transition and must not be replayed as a new apply',
);
assert.equal(writes, 0, 'invalid accepted-stage payloads must fail before reading or writing canonical storage');

console.log('HEXIS_PROJECTOR_IDEMPOTENT_REPLAY=PASS', JSON.stringify({ writes, receiptDigest: receipt.digest }));
