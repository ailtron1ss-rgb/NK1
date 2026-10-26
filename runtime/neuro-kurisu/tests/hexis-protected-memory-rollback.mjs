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
assert.deepEqual(runtime.fabric.canonicalSnapshot().items, canonicalBaseline,
  'failed HMX application must not leave a quarantined record that ordinary forgetting refuses to delete');
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
assert.equal(afterRetry.length, canonicalBaseline.length + 1);
assert.equal(afterRetry[0].epistemicStatus, 'quarantined',
  'a successful retry may retain the quarantined record, but only once');
assert.equal(temporalState.assertions.length, 1,
  'retry must produce exactly one temporal assertion after the failed attempt was rolled back');

console.log('WorkPass430 protected HMX rollback: PASS', JSON.stringify({
  attempts: [1, retryReceipt.attempt],
  canonicalItems: afterRetry.length,
  status: afterRetry[0].epistemicStatus,
  receiptJournal: runtime.fabric.inspect().mutationReceiptJournal,
}));
