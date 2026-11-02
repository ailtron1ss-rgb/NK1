import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

const key = 'workpass647:restore-boundary:v1';
const options = { idempotencyKey: key };
const makeGateway = () => {
  const gateway = new ActionGateway();
  gateway.setExecutionLedgerPersister(async () => {});
  gateway.registerTool({
    id: 'catalog.update',
    capability: 'catalog.write',
    destructive: false,
    requiresIdempotencyKey: true,
    execute: async input => ({ ok: true, key: input.key }),
  });
  return gateway;
};

const source = makeGateway();
const executed = await source.executeTool('catalog.update', { key: 'safe-key' }, 'restore-boundary', options);
assert.equal(executed.ok, true);
const validSnapshot = source.snapshotExecutionLedger();
assert.equal(validSnapshot.records.length, 1);

const target = makeGateway();
target.restoreExecutionLedger(validSnapshot);
const before = target.snapshotExecutionLedger();
let rootGetterCalls = 0;
const rootGetter = { version: 1 };
Object.defineProperty(rootGetter, 'records', {
  enumerable: true,
  get() { rootGetterCalls += 1; return validSnapshot.records; },
});
assert.throws(() => target.restoreExecutionLedger(rootGetter), /action-ledger-snapshot-invalid/);
assert.equal(rootGetterCalls, 0, 'root snapshot accessors must be rejected without invocation');
assert.deepEqual(target.snapshotExecutionLedger(), before, 'invalid restore must not partially replace live ledger state');

let rowGetterCalls = 0;
const unsafeRow = { ...validSnapshot.records[0] };
Object.defineProperty(unsafeRow, 'keyHash', {
  enumerable: true,
  get() { rowGetterCalls += 1; return validSnapshot.records[0].keyHash; },
});
assert.throws(() => target.restoreExecutionLedger({ ...validSnapshot, records: [unsafeRow] }), /action-ledger-snapshot-invalid/);
assert.equal(rowGetterCalls, 0, 'ledger row accessors must be rejected without invocation');
assert.deepEqual(target.snapshotExecutionLedger(), before);

let proxyGetCalls = 0;
const proxySnapshot = new Proxy({ version: 1, records: validSnapshot.records }, {
  get(_target, property) {
    proxyGetCalls += 1;
    if (property === 'records') throw new Error('proxy-get-trap-must-not-run');
    return Reflect.get(_target, property);
  },
});
assert.throws(() => target.restoreExecutionLedger(proxySnapshot), /action-ledger-snapshot-invalid/);
assert.equal(proxyGetCalls, 0, 'proxy snapshots must be rejected before property access');
assert.deepEqual(target.snapshotExecutionLedger(), before);

const sparseRecords = new Array(1);
assert.throws(() => target.restoreExecutionLedger({ version: 1, records: sparseRecords }), /action-ledger-snapshot-invalid/);
assert.deepEqual(target.snapshotExecutionLedger(), before);

const cyclicSnapshot = { version: 1, records: [] };
cyclicSnapshot.self = cyclicSnapshot;
assert.throws(() => target.restoreExecutionLedger(cyclicSnapshot), /action-ledger-snapshot-invalid/);
assert.deepEqual(target.snapshotExecutionLedger(), before);

const replay = await target.executeTool('catalog.update', { key: 'safe-key' }, 'valid-replay', options);
assert.equal(replay.idempotentReplay, true, 'valid restored receipts remain replayable');
assert.equal(replay.ok, true);

console.log('NK1_ACTION_GATEWAY_RESTORE_SNAPSHOT_BOUNDARY=PASS');
