import assert from 'node:assert/strict';
import { HexisAdaptationFabric } from '../src/organism/integration/hexis/HexisAdaptationFabric.ts';
import { HexisCanonicalMemoryProjector } from '../src/organism/integration/hexis/HexisCanonicalMemoryProjector.mjs';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';

// Direct temporal-ledger contract: a finite validity end must actually close the interval.
const ledger = new HexisAdaptationFabric();
const finite = ledger.recordTemporalAssertion({
  memoryId: 'expiring-assertion',
  summary: 'Only valid over the supplied interval.',
  confidence01: 0.7,
  validFrom: 100,
  validUntil: 200,
  source: 'test',
  value: 'finite-interval',
});
assert.equal(finite.validUntil, 200);
assert.equal(ledger.temporalAt('expiring-assertion', 150)?.id, finite.id);
assert.equal(ledger.temporalAt('expiring-assertion', 200), null,
  'the end of a validity interval is exclusive');

// Historical rows may be imported after more recent rows. They must not close or
// erase the future interval just because insertion order differs from event time.
const outOfOrderLedger = new HexisAdaptationFabric();
const recentAssertion = outOfOrderLedger.recordTemporalAssertion({
  memoryId: 'out-of-order-history',
  summary: 'later observation',
  confidence01: 0.8,
  validFrom: 2000,
  source: 'import-late-first',
  value: 'later',
});
const olderAssertion = outOfOrderLedger.recordTemporalAssertion({
  memoryId: 'out-of-order-history',
  summary: 'historical observation',
  confidence01: 0.6,
  validFrom: 1000,
  validUntil: 1500,
  source: 'import-history-second',
  value: 'earlier',
});
assert.equal(olderAssertion.validUntil, 1500);
assert.equal(outOfOrderLedger.temporalAt('out-of-order-history', 1250)?.id, olderAssertion.id);
assert.equal(outOfOrderLedger.temporalAt('out-of-order-history', 1750), null,
  'a known gap between assertions must remain a gap');
assert.equal(outOfOrderLedger.temporalAt('out-of-order-history', 2500)?.id, recentAssertion.id,
  'late insertion of historical data must preserve the newer assertion');

assert.throws(
  () => ledger.recordTemporalAssertion({
    memoryId: 'invalid-interval',
    summary: 'Invalid interval must not be stored.',
    confidence01: 0.5,
    validFrom: 500,
    validUntil: 499,
  }),
  /temporal-valid-until-invalid/,
);
assert.equal(ledger.snapshot().temporal.some(row => row.memoryId === 'invalid-interval'), false);

// End-to-end HMX import: the canonical memory and Hexis temporal ledger must share
// the same validity boundary instead of keeping an expired claim open forever.
const runtime = new MemorySubsystemRuntime();
const hexis = new HexisAdaptationFabric();
const projector = new HexisCanonicalMemoryProjector(runtime.fabric, runtime.semanticMemory, hexis);
hexis.bindCanonicalMemoryApply(stage => projector.apply(stage));
// Staging must reject malformed temporal bounds instead of silently converting
// them to null (which would turn an invalid end date into an unbounded assertion).
const badExportId = 'exp_87654321fedcba10';
const badStage = hexis.stageHmx({
  intent: 'port',
  strategy: 'additive',
  document: {
    hmx_version: '1.7',
    export_id: badExportId,
    export_intent: 'port',
    exported_at: '2026-10-26T12:00:00.000Z',
    source: {
      instance_id: 'validity-test',
      schema_version: '1.7',
      embedding_model: 'test-only',
      embedding_dimension: 1,
      hexis_lineage_id: 'validity-test-lineage',
    },
    sections: {
      memories: [{
        ref: badExportId + ':invalid-interval',
        type: 'semantic',
        content: 'This row must not be partially staged.',
        valid_from: 2000,
        valid_until: 1000,
      }],
    },
  },
});
assert(badStage.conflicts.some(conflict => conflict.path === 'sections.memories[0].valid_until'));
assert.equal(badStage.stagedSections.memories, undefined,
  'a backwards validity interval must poison the entire memory section');
assert.equal(hexis.decideHmx(badStage.stagingId, 'accept')?.status, 'staged');

const badTimestampExportId = 'exp_87654321fedcba11';
const badTimestampStage = hexis.stageHmx({
  intent: 'port',
  strategy: 'additive',
  document: {
    hmx_version: '1.7',
    export_id: badTimestampExportId,
    export_intent: 'port',
    exported_at: '2026-10-26T12:00:00.000Z',
    source: {
      instance_id: 'validity-test',
      schema_version: '1.7',
      embedding_model: 'test-only',
      embedding_dimension: 1,
      hexis_lineage_id: 'validity-test-lineage',
    },
    sections: {
      memories: [{
        ref: badTimestampExportId + ':invalid-timestamp',
        type: 'semantic',
        content: 'Invalid date must not become an open-ended assertion.',
        valid_until: 'not-a-date',
      }],
    },
  },
});
assert(badTimestampStage.conflicts.some(conflict => conflict.path === 'sections.memories[0].valid_until'));
assert.equal(badTimestampStage.stagedSections.memories, undefined);
assert.equal(hexis.decideHmx(badTimestampStage.stagingId, 'accept')?.status, 'staged');

const exportId = 'exp_87654321fedcba09';
const stage = hexis.stageHmx({
  intent: 'port',
  strategy: 'additive',
  document: {
    hmx_version: '1.7',
    export_id: exportId,
    export_intent: 'port',
    exported_at: '2026-10-26T12:00:00.000Z',
    source: {
      instance_id: 'validity-test',
      schema_version: '1.7',
      embedding_model: 'test-only',
      embedding_dimension: 1,
      hexis_lineage_id: 'validity-test-lineage',
    },
    sections: {
      memories: [{
        ref: exportId + ':expiring-memory',
        type: 'semantic',
        content: 'This imported statement expires at the explicit timestamp.',
        valid_from: 1000,
        valid_until: 2000,
      }],
    },
  },
});
assert.deepEqual(stage.conflicts, []);
assert.equal(hexis.decideHmx(stage.stagingId, 'accept')?.status, 'accepted');
const applied = hexis.decideHmx(stage.stagingId, 'apply');
assert.equal(applied?.status, 'applied');
const memoryId = applied?.application?.createdMemoryIds[0];
assert(memoryId);
const canonical = runtime.fabric.canonicalSnapshot().items.find(item => item.id === memoryId);
assert.equal(canonical?.validFromAt, 1000);
assert.equal(canonical?.validUntilAt, 2000);
const importedAssertion = hexis.temporalAt(memoryId, 1500);
assert(importedAssertion);
assert.equal(importedAssertion.validUntil, 2000);
assert.equal(hexis.temporalAt(memoryId, 2000), null,
  'Hexis temporal retrieval must not treat an expired HMX memory as current');

// Re-export the same lineage/reference/content with a different export ID. The memory
// must deduplicate and the already-expired temporal interval must not be appended again.
const repeatedExportId = 'exp_87654321fedcba08';
const repeatedStage = hexis.stageHmx({
  intent: 'port',
  strategy: 'additive',
  document: {
    hmx_version: '1.7',
    export_id: repeatedExportId,
    export_intent: 'port',
    exported_at: '2026-10-27T12:00:00.000Z',
    source: {
      instance_id: 'validity-test',
      schema_version: '1.7',
      embedding_model: 'test-only',
      embedding_dimension: 1,
      hexis_lineage_id: 'validity-test-lineage',
    },
    sections: {
      memories: [{
        ref: repeatedExportId + ':expiring-memory',
        type: 'semantic',
        content: 'This imported statement expires at the explicit timestamp.',
        valid_from: 1000,
        valid_until: 2000,
      }],
    },
  },
});
assert.deepEqual(repeatedStage.conflicts, []);
assert.equal(hexis.decideHmx(repeatedStage.stagingId, 'accept')?.status, 'accepted');
const temporalCountBeforeRepeatedImport = hexis.snapshot().temporal.length;
const repeatedApplied = hexis.decideHmx(repeatedStage.stagingId, 'apply');
assert.equal(repeatedApplied?.application?.importedCount, 0);
assert.equal(repeatedApplied?.application?.deduplicatedCount, 1);
assert.equal(hexis.snapshot().temporal.length, temporalCountBeforeRepeatedImport,
  'replaying an already-expired temporal assertion must remain idempotent across export IDs');
assert.equal(runtime.fabric.canonicalSnapshot().items.filter(item => item.id === memoryId).length, 1);
console.log('HEXIS_HMX_VALIDITY_BOUNDARIES=PASS');
