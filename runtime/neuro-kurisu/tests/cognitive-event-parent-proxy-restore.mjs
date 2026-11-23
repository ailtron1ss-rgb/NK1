import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const event = (overrides = {}) => ({
  id: 'restore:proxy-parent',
  tick: 12,
  at: 1200,
  stage: 'observation',
  source: 'parent-proxy-restore-regression',
  parentIds: ['parent:one'],
  external: false,
  confidence01: 0.75,
  payload: { restored: true },
  ...overrides,
});

// Before the fix, restore read parentIds.length directly. A Proxy get trap could
// execute and supply a false length, silently discarding causal parent lineage.
let getTrapCalls = 0;
const proxiedParents = new Proxy(['parent:one'], {
  get(target, property, receiver) {
    if (property === 'length') {
      getTrapCalls += 1;
      return 0; // This must never be used as the trusted array length.
    }
    if (property === '0') {
      getTrapCalls += 1;
      throw new Error('parent slot must not be read through a proxy get trap');
    }
    return Reflect.get(target, property, receiver);
  },
});

const fabric = new CognitiveEventFabric(16);
fabric.restore({ recent: [event({ parentIds: proxiedParents })], total: 1 });
assert.equal(getTrapCalls, 0, 'parent lineage restore must not execute proxy get traps');
assert.deepEqual(
  fabric.getById('restore:proxy-parent')?.parentIds,
  ['parent:one'],
  'the true descriptor-backed parent lineage must be preserved',
);
assert.equal(fabric.snapshot().total, 1);

// If a proxy cannot provide own descriptors, the malformed row is skipped without
// reserving its ID, and a later valid row with that ID can still recover.
let ownKeysCalls = 0;
const uninspectableParents = new Proxy(['parent:untrusted'], {
  ownKeys() {
    ownKeysCalls += 1;
    throw new Error('parent descriptor enumeration failed');
  },
});
const recovering = new CognitiveEventFabric(16);
recovering.restore({
  recent: [
    event({ id: 'restore:recover-after-parent-proxy', parentIds: uninspectableParents }),
    event({ id: 'restore:recover-after-parent-proxy', parentIds: ['parent:valid'] }),
  ],
  total: 2,
});
assert.equal(ownKeysCalls, 1, 'descriptor failure is caught rather than escaping restore');
assert.deepEqual(
  recovering.getById('restore:recover-after-parent-proxy')?.parentIds,
  ['parent:valid'],
  'a malformed parent proxy must not reserve a stable event ID',
);
assert.equal(recovering.snapshot().total, 2);

console.log('Cognitive event parent proxy restore: PASS');
