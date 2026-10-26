import assert from 'node:assert/strict';
import { HexisAdaptationFabric } from '../src/organism/integration/hexis/HexisAdaptationFabric.ts';
import { CANONICAL_MEMORY_CAPACITY } from '../src/organism/memory/CanonicalMemoryCapacity.ts';
import { HexisCanonicalMemoryProjector } from '../src/organism/integration/hexis/HexisCanonicalMemoryProjector.mjs';

const exportId = 'exp_1234567890abcdef';
const existing = Array.from({ length: CANONICAL_MEMORY_CAPACITY - 1 }, (_, index) => ({
  id: 'existing-' + index,
  source: 'user',
  content: 'existing canonical memory ' + index,
}));
let writeCalls = 0;
let rollbackCalls = 0;
const memoryFabric = {
  canonicalSnapshot() { return { items: existing }; },
  encode() { writeCalls++; throw new Error('capacity-preflight-was-bypassed'); },
  forgetById() { rollbackCalls++; return true; },
};
const owner = new HexisAdaptationFabric();
const projector = new HexisCanonicalMemoryProjector(memoryFabric);
owner.bindCanonicalMemoryApply(stage => projector.apply(stage));

const stage = owner.stageHmx({
  intent: 'port',
  strategy: 'additive',
  document: {
    hmx_version: '1.7',
    export_id: exportId,
    export_intent: 'port',
    exported_at: '2026-10-26T12:00:00.000Z',
    source: {
      instance_id: 'capacity-test',
      schema_version: '1.7',
      embedding_model: 'test-only',
      embedding_dimension: 1,
      hexis_lineage_id: 'capacity-test-lineage',
    },
    sections: {
      memories: [
        { ref: exportId + ':memory-one', type: 'semantic', content: 'new memory one' },
        { ref: exportId + ':memory-two', type: 'semantic', content: 'new memory two' },
      ],
    },
  },
});
assert.deepEqual(stage.conflicts, []);
assert.equal(owner.decideHmx(stage.stagingId, 'accept')?.status, 'accepted');
assert.throws(
  () => owner.decideHmx(stage.stagingId, 'apply'),
  error => error instanceof Error &&
    error.message === 'hmx-apply-canonical-memory-capacity-exceeded:' +
      (CANONICAL_MEMORY_CAPACITY + 1) + '/' + CANONICAL_MEMORY_CAPACITY,
);
assert.equal(writeCalls, 0, 'capacity rejection must happen before any canonical write');
assert.equal(rollbackCalls, 0, 'preflight rejection must not need compensation');
assert.equal(owner.getHmxStage(stage.stagingId)?.status, 'accepted',
  'a rejected capacity preflight must leave the reviewed stage retryable');
assert.equal(owner.getHmxStage(stage.stagingId)?.applicationAttempts, 1);
console.log('HEXIS_HMX_CAPACITY_PREFLIGHT=PASS');
