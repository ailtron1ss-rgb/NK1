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
console.log('HEXIS_HMX_VALIDITY_BOUNDARIES=PASS');
