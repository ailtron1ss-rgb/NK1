import assert from 'node:assert/strict';
import { EmbodimentSubsystemRuntime } from '../src/organism/core/EmbodimentSubsystemRuntime.ts';
import { sanitizePerceptionRoutingState, defaultPerceptionRoutingState, routePerception } from '../src/organism/body/PerceptionRouter.ts';

// A persisted perception-routing state is written into facets.embodiment on every
// tick but was never restored into the subsystem's live state, so counters reset on
// restart. The restore must rehydrate the exact persisted counters.
const source = new EmbodimentSubsystemRuntime();
source.routePerception({ kind: 'text-input', at: 1, detail: 'hello', salience: 0.9 });
assert.equal(source.perceptionRoutingSnapshot().routedCount, 1);

// Counters must accumulate across ticks. The state is persisted every tick, so a
// literal routedCount: 1 would reset the durable total on the next event. Two events
// must yield routedCount 2, not 1.
source.routePerception({ kind: 'motion', at: 2, detail: 'walk', salience: 0.9 });
assert.equal(source.perceptionRoutingSnapshot().routedCount, 2, 'routed counters must accumulate across ticks');
source.routePerception({ kind: 'quiet', at: 3, detail: 'idle', salience: 0.1 }, { awake: false });
assert.equal(source.perceptionRoutingSnapshot().droppedCount, 1, 'dropped counters must accumulate while asleep');

const persistedFacet = { version: 1, lastRoutedAt: 4242, routedCount: 7, droppedCount: 3, lastRoute: 'workspace' };
const restored = new EmbodimentSubsystemRuntime();
restored.restoreFromPersisted({ embodiment: { perceptionRouting: persistedFacet } });
assert.deepEqual(restored.perceptionRoutingSnapshot(), persistedFacet, 'persisted routing counters must survive restore');
assert.deepEqual(restored.snapshot().perceptionRouting, persistedFacet, 'snapshot must expose the restored routing');

// Malformed persisted values must fail closed.
for (const hostile of [
  null,
  undefined,
  'workspace',
  { version: 1, routedCount: '7', droppedCount: 0, lastRoutedAt: 1, lastRoute: 'workspace' },
  { version: 1, routedCount: 1, droppedCount: -1, lastRoutedAt: 1, lastRoute: 'workspace' },
  { version: 1, routedCount: 1, droppedCount: 0, lastRoutedAt: 1.5, lastRoute: 'workspace' },
  { version: 1, routedCount: 1, droppedCount: 0, lastRoutedAt: 1, lastRoute: 'nowhere' },
  { version: 2, routedCount: 1, droppedCount: 0, lastRoutedAt: 1, lastRoute: 'workspace' },
  Object.create({ ...persistedFacet }),
]) {
  assert.deepEqual(sanitizePerceptionRoutingState(hostile), defaultPerceptionRoutingState());
}

// Null-prototype data records are safe plain records and remain restorable.
const nullPrototypeRecord = Object.assign(Object.create(null), persistedFacet);
assert.deepEqual(sanitizePerceptionRoutingState(nullPrototypeRecord), persistedFacet);

// Accessor properties are rejected without invoking their getters.
let getterCalls = 0;
const accessorRecord = { ...persistedFacet };
Object.defineProperty(accessorRecord, 'routedCount', {
  enumerable: true,
  get() {
    getterCalls += 1;
    throw new Error('persisted getter must not execute');
  },
});
assert.deepEqual(sanitizePerceptionRoutingState(accessorRecord), defaultPerceptionRoutingState());
assert.equal(getterCalls, 0, 'restore must inspect descriptors instead of executing getters');

// Proxy get traps are not needed to inspect own data descriptors.
let getTrapCalls = 0;
const getTrappingProxy = new Proxy(persistedFacet, {
  get() {
    getTrapCalls += 1;
    throw new Error('property get trap must not execute');
  },
});
assert.deepEqual(sanitizePerceptionRoutingState(getTrappingProxy), persistedFacet);
assert.equal(getTrapCalls, 0, 'restore must not use ordinary property reads');

// Hostile reflection and revoked proxies must be contained by the restore boundary.
const reflectionProxy = new Proxy(persistedFacet, {
  getOwnPropertyDescriptor() {
    throw new Error('hostile descriptor trap');
  },
});
assert.deepEqual(sanitizePerceptionRoutingState(reflectionProxy), defaultPerceptionRoutingState());
const revoked = Proxy.revocable({}, {});
revoked.revoke();
assert.deepEqual(sanitizePerceptionRoutingState(revoked.proxy), defaultPerceptionRoutingState());

// Counters saturate instead of overflowing into an invalid unsafe integer.
const maxCounter = routePerception(
  { kind: 'text-input', at: 9, detail: 'counter-boundary', salience: 1 },
  undefined,
  { ...persistedFacet, routedCount: Number.MAX_SAFE_INTEGER },
);
assert.equal(maxCounter.routedCount, Number.MAX_SAFE_INTEGER);
const maxDropped = routePerception(
  { kind: 'quiet', at: 10, detail: 'counter-boundary', salience: 0.1 },
  { awake: false },
  { ...persistedFacet, droppedCount: Number.MAX_SAFE_INTEGER },
);
assert.equal(maxDropped.droppedCount, Number.MAX_SAFE_INTEGER);

console.log('EMBODIMENT_PERCEPTION_ROUTING_RESTORE_INTEGRITY=PASS');
