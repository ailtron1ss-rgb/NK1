import assert from 'node:assert/strict';
import { HexisCanonicalMemoryProjector } from '../src/organism/integration/hexis/HexisCanonicalMemoryProjector.mjs';

let writes = 0;
const memoryFabric = {
  encode() { writes++; throw new Error('unexpected-write-on-replay'); },
  canonicalSnapshot() { writes++; throw new Error('unexpected-read-on-replay'); },
  forgetById() { writes++; throw new Error('unexpected-rollback-on-replay'); },
};
const projector = new HexisCanonicalMemoryProjector(memoryFabric);
const receipt = {
  version: 1,
  exportId: 'exp_0123456789abcdef',
  status: 'noop',
  complete: false,
  memoryIds: [],
  warnings: ['previously-applied'],
  digest: 'persisted-receipt-digest',
};
const stage = {
  status: 'applied',
  intent: 'port',
  strategy: 'additive',
  application: receipt,
  // Deliberately omit staged sections and identifiers: a retry must use the receipt
  // and must not re-run validation or mutate canonical memory.
};
const replay = projector.apply(stage);
assert.deepEqual(replay, receipt);
assert.notEqual(replay, receipt, 'replay returns a defensive copy');
assert.notEqual(replay.warnings, receipt.warnings, 'nested receipt data is cloned');
replay.warnings.push('caller-mutation');
assert.deepEqual(receipt.warnings, ['previously-applied']);
assert.equal(writes, 0, 'idempotent replay must not touch canonical storage');

assert.throws(
  () => projector.apply({ status: 'pending', intent: 'port', strategy: 'additive' }),
  /hmx-stage-must-be-accepted-before-apply/,
);
assert.equal(writes, 0);

console.log('HEXIS_PROJECTOR_IDEMPOTENT_REPLAY=PASS', JSON.stringify({ writes, receiptDigest: receipt.digest }));
