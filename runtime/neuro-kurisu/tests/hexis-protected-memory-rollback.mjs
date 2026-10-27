import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { HexisCanonicalMemoryProjector } from '../src/organism/integration/hexis/HexisCanonicalMemoryProjector.mjs';
import { computeHmxStageDigest, refreshHmxStageLifecycleDigest } from '../src/organism/integration/hexis/HexisStageIntegrity.mjs';

// Ordinary forgetting must continue to protect quarantined records. Transaction
// compensation, however, must be able to remove a row created by a failed HMX apply.
const runtime = new MemorySubsystemRuntime();
const canonicalBaseline = runtime.fabric.canonicalSnapshot().items;
const temporalState = { assertions: [], beliefs: [] };
let failFirstAssertion = true;
let concurrentRowId = null;
const temporalLedger = {
  snapshot() { return structuredClone(temporalState); },
  restore(snapshot) {
    temporalState.assertions = structuredClone(snapshot.assertions);
    temporalState.beliefs = structuredClone(snapshot.beliefs);
    return true;
  },
  recordTemporalAssertion(assertion) {
    temporalState.assertions.push(structuredClone(assertion));
    if (failFirstAssertion) {
      failFirstAssertion = false;
      // Model an interleaved import from the same export while this stage is
      // unwinding. The concurrent row has a distinct stage/attempt and must survive
      // this transaction's reconciliation scan even though its ID was absent from
      // the original beforeIds snapshot.
      concurrentRowId = 'hexis-memory:parallel-stage-import';
      const now = Date.now();
      runtime.fabric.encode({
        id: concurrentRowId,
        content: 'Concurrent Hexis stage row must survive another stage rollback.',
        tags: ['hexis-concurrency-regression'],
        context: {
          hexisExportId: stage.exportId,
          hexisImportStageId: 'stage-concurrent-peer',
          hexisImportAttempt: '1',
          hexisMemoryRef: stage.exportId + ':parallel-peer',
          hexisSourceLineageId: stage.sourceLineageId,
          hexisOriginalType: 'semantic',
        },
        kind: 'concept',
        salience: 0.3,
        emotionalWeight: 0.1,
        identityRelevance: 0.05,
        goalRelevance: 0.05,
        socialRelevance: 0.05,
        predictionError: 0,
        confidence: 0.7,
        epistemicStatus: 'belief',
        source: 'hexis:parallel-peer',
        entities: [],
        semanticLinks: [],
        temporalLinks: [],
        causalLinks: [],
        contradictionLinks: [],
        provenanceClass: 'external',
        sourceAuthority01: 0.5,
        independenceKey: 'hexis-parallel-stage-peer',
        observedAt: now,
        evidenceFreshnessAt: now,
        validFromAt: now,
        validUntilAt: null,
        evidenceSources: [],
      }, { commandId: 'wp433:parallel-stage-injection', forceDistinct: true, syncCompatibility: false });
      throw new Error('injected-quarantined-hmx-temporal-failure');
    }
    return { id: 'quarantine-rollback-assertion:' + temporalState.assertions.length };
  },
  registerOrUpdateBelief(belief) {
    temporalState.beliefs = temporalState.beliefs.filter(item => item.memoryId !== belief.memoryId);
    temporalState.beliefs.push(structuredClone(belief));
    return true;
  },
  removeBeliefProjection(memoryId) {
    temporalState.beliefs = temporalState.beliefs.filter(item => item.memoryId !== memoryId);
    return true;
  },
};

const stage = {
  status: 'accepted',
  exportId: 'exp_0123456789abcdef',
  sourceLineageId: 'rollback-protected-lineage',
  stagingId: 'stage-protected-quarantine-rollback',
  digest: '',
  lifecycleDigest: '',
  applicationAttempts: 1,
  intent: 'port',
  strategy: 'additive',
  sectionCounts: { memories: 1 },
  protectedSections: [],
  conflicts: [],
  stagedSections: {
    memories: [{
      ref: 'exp_0123456789abcdef:quarantined-record',
      type: 'semantic',
      content: 'A quarantined HMX record must be removed when its import transaction fails.',
      status: 'quarantined',
    }],
  },
};
stage.digest = computeHmxStageDigest(stage);
refreshHmxStageLifecycleDigest(stage);

const projector = new HexisCanonicalMemoryProjector(runtime.fabric, undefined, temporalLedger);
assert.throws(
  () => projector.apply(stage),
  /hmx-canonical-apply-failed:injected-quarantined-hmx-temporal-failure/,
  'the injected downstream failure must propagate after compensation',
);
const afterFailedApply = runtime.fabric.canonicalSnapshot().items;
assert.deepEqual(
  afterFailedApply.filter(item => canonicalBaseline.some(base => base.id === item.id)),
  canonicalBaseline,
  'failed HMX application must preserve all pre-existing canonical records');
assert.equal(afterFailedApply.some(item =>
  item.context?.hexisImportStageId === stage.stagingId &&
  item.context?.hexisImportAttempt === '1'), false,
  'the failed stage/attempt must be fully compensated');
const concurrentPeer = afterFailedApply.find(item => item.id === concurrentRowId);
assert.ok(concurrentPeer, 'a concurrently imported row absent from beforeIds must not be rolled back');
assert.equal(concurrentPeer.context?.hexisExportId, stage.exportId);
assert.equal(concurrentPeer.context?.hexisImportStageId, 'stage-concurrent-peer');
assert.equal(concurrentPeer.context?.hexisImportAttempt, '1');
assert.equal(afterFailedApply.length, canonicalBaseline.length + 1,
  'only the independent concurrent-stage row may remain after rollback');
assert.deepEqual(temporalState, { assertions: [], beliefs: [] },
  'temporal state must be restored to the baseline after the failed apply');

const receiptSnapshot = runtime.fabric.snapshot();
runtime.fabric.restore(structuredClone(receiptSnapshot));
assert.equal(runtime.fabric.inspect().mutationReceiptJournal.corrupt, false,
  'the new rollback-created receipt action must survive receipt-journal validation after restore');

// Match HexisAdaptationFabric's real retry contract: each attempt is sealed with a
// fresh applicationAttempts value, so rollback receipts from the failed attempt cannot alias it.
stage.applicationAttempts = 2;
refreshHmxStageLifecycleDigest(stage);
const retryReceipt = projector.apply(stage);
assert.equal(retryReceipt.status, 'applied');
assert.equal(retryReceipt.attempt, 2);
const afterRetry = runtime.fabric.canonicalSnapshot().items;
assert.equal(afterRetry.length, canonicalBaseline.length + 2,
  'successful retry must preserve the concurrent peer and create exactly one row for its own attempt');
assert.ok(afterRetry.some(item => item.id === concurrentRowId),
  'the concurrent peer row must remain after a subsequent successful retry');
const importedQuarantined = afterRetry.find(item =>
  item.context?.hexisExportId === stage.exportId &&
  item.context?.hexisMemoryRef === 'exp_0123456789abcdef:quarantined-record');
assert.ok(importedQuarantined, 'the successful retry must leave its single canonical import');
assert.equal(importedQuarantined.epistemicStatus, 'quarantined',
  'a successful retry may retain the quarantined record, but only once');
assert.equal(
  runtime.fabric.forgetById(importedQuarantined.id, 'ordinary-forget-protection', {
    commandId: 'wp430:ordinary-forget-protection',
    // Simulate a JS caller passing out-of-contract keys: they must not turn a
    // normal forget request into a transaction rollback.
    action: 'rollback-created',
    exportId: stage.exportId,
    stagingId: stage.stagingId,
    attempt: 2,
  }),
  false,
  'ordinary forgetting must still refuse quarantined records',
);
assert.equal(runtime.fabric.canonicalSnapshot().items.some(item => item.id === importedQuarantined.id), true,
  'ordinary forgetting must not remove the quarantined HMX row');
assert.throws(
  () => runtime.fabric.rollbackHmxCreatedMemory(
    importedQuarantined.id, stage.exportId, 'stage-not-the-origin', 2, 'missing-receipt-id',
  ),
  /memory-lifecycle-hmx-rollback-command-id-required/,
  'compensation must have a journal key before inspecting or mutating canonical state',
);
assert.throws(
  () => runtime.fabric.rollbackHmxCreatedMemory(
    importedQuarantined.id, stage.exportId, 'stage-not-the-origin', 2, 'scope-guard-regression',
    { commandId: 'wp430:scope-guard-regression' },
  ),
  /memory-lifecycle-hmx-rollback-scope-mismatch/,
  'the scoped compensator must not remove a protected import created by a different stage attempt',
);

// JavaScript can provide keys omitted from the TypeScript context type. Those keys
// must not override the authority-bearing positional scope or silently widen rollback.
assert.throws(
  () => runtime.fabric.rollbackHmxCreatedMemory(
    importedQuarantined.id, stage.exportId, 'stage-not-the-origin', 2, 'context-mass-assignment-regression',
    {
      commandId: 'wp430:context-mass-assignment-regression',
      id: importedQuarantined.id,
      exportId: stage.exportId,
      stagingId: stage.stagingId,
      attempt: 2,
      reason: 'overridden-reason',
    },
  ),
  /memory-lifecycle-hmx-rollback-scope-mismatch/,
  'extra context keys must not replace the caller-supplied stage scope',
);
assert.equal(runtime.fabric.canonicalSnapshot().items.some(item => item.id === importedQuarantined.id), true,
  'a mismatched compensation scope must leave the canonical imported record untouched');
assert.equal(temporalState.assertions.length, 1,
  'retry must produce exactly one temporal assertion after the failed attempt was rolled back');

console.log('WorkPass430 protected HMX rollback: PASS', JSON.stringify({
  attempts: [1, retryReceipt.attempt],
  canonicalItems: afterRetry.length,
  status: importedQuarantined.epistemicStatus,
  receiptJournal: runtime.fabric.inspect().mutationReceiptJournal,
}));
