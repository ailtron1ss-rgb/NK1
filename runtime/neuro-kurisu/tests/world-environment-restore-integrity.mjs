import assert from 'node:assert/strict';
import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';

const source = new WorldEnvironment();
source.step('observe');
source.step('move');
const valid = source.persisted();

const restored = new WorldEnvironment();
restored.restore(valid);
assert.deepEqual(restored.persisted(), valid, 'valid persisted state must round-trip');

const legacy = { snapshot: valid.snapshot, transitions: valid.transitions };
const legacyRestored = new WorldEnvironment();
legacyRestored.restore(legacy);
assert.deepEqual(legacyRestored.persisted(), valid, 'legacy snapshots without schemaVersion remain readable');

function assertRejectedWithoutMutation(input) {
  const target = new WorldEnvironment();
  const before = target.persisted();
  target.restore(input);
  assert.deepEqual(target.persisted(), before, 'invalid restore must leave snapshot and history unchanged');
}

assertRejectedWithoutMutation({ ...valid, schemaVersion: 2 });
assertRejectedWithoutMutation({ ...valid, snapshot: { ...valid.snapshot, energy: Number.NaN } });
assertRejectedWithoutMutation({ ...valid, snapshot: { ...valid.snapshot, tick: -1 } });

const malformedHistory = structuredClone(valid);
malformedHistory.transitions[1].after.energy = Number.POSITIVE_INFINITY;
assertRejectedWithoutMutation(malformedHistory);

const duplicateObjects = structuredClone(valid);
duplicateObjects.snapshot.objects[1] = { ...duplicateObjects.snapshot.objects[0] };
assertRejectedWithoutMutation(duplicateObjects);

const sparseFacts = new Array(1);
assertRejectedWithoutMutation({ ...valid, snapshot: { ...valid.snapshot, facts: sparseFacts } });

const extraFacts = [...valid.snapshot.facts];
extraFacts.extra = 'unexpected';
assertRejectedWithoutMutation({ ...valid, snapshot: { ...valid.snapshot, facts: extraFacts } });

let getterCalls = 0;
const accessorSnapshot = { ...valid.snapshot };
Object.defineProperty(accessorSnapshot, 'energy', {
  enumerable: true,
  configurable: true,
  get() {
    getterCalls += 1;
    return 0.8;
  },
});
assertRejectedWithoutMutation({ ...valid, snapshot: accessorSnapshot });
assert.equal(getterCalls, 0, 'restore must inspect descriptors without executing accessors');

let proxyTrapCalls = 0;
const proxy = new Proxy(valid, {
  getPrototypeOf() {
    proxyTrapCalls += 1;
    throw new Error('proxy trap must not run');
  },
  ownKeys() {
    proxyTrapCalls += 1;
    throw new Error('proxy trap must not run');
  },
});
assertRejectedWithoutMutation(proxy);
assert.equal(proxyTrapCalls, 0, 'proxy snapshots must be rejected before traps execute');

const revoked = Proxy.revocable(valid, {});
revoked.revoke();
assertRejectedWithoutMutation(revoked.proxy);

let arrayProxyTrapCalls = 0;
const factsProxy = new Proxy([...valid.snapshot.facts], {
  getPrototypeOf() {
    arrayProxyTrapCalls += 1;
    throw new Error('array proxy trap must not run');
  },
  ownKeys() {
    arrayProxyTrapCalls += 1;
    throw new Error('array proxy trap must not run');
  },
});
assertRejectedWithoutMutation({ ...valid, snapshot: { ...valid.snapshot, facts: factsProxy } });
assert.equal(arrayProxyTrapCalls, 0, 'proxy arrays must be rejected before traps execute');

const legacyWithoutHistory = new WorldEnvironment();
legacyWithoutHistory.restore({ snapshot: valid.snapshot });
assert.deepEqual(legacyWithoutHistory.snapshot(), valid.snapshot, 'legacy snapshots without history remain readable');
assert.deepEqual(legacyWithoutHistory.history(), []);

// Restored history is newest-first and must be a contiguous causal chain
// ending at the exact current snapshot, not merely a list of valid-shaped rows.
const detachedSnapshot = structuredClone(valid);
detachedSnapshot.snapshot.energy = 0.7;
assertRejectedWithoutMutation(detachedSnapshot);

const detachedHistory = structuredClone(valid);
detachedHistory.transitions[1].after.energy = 0.7;
assertRejectedWithoutMutation(detachedHistory);

const reversedHistory = structuredClone(valid);
reversedHistory.transitions.reverse();
assertRejectedWithoutMutation(reversedHistory);

console.log('WORLD_ENVIRONMENT_RESTORE_INTEGRITY=PASS cases=17');
