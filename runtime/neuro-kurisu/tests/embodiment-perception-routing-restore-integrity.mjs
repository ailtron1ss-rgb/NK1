import assert from 'node:assert/strict';
import { EmbodimentSubsystemRuntime } from '../src/organism/core/EmbodimentSubsystemRuntime.ts';
import { sanitizePerceptionRoutingState, defaultPerceptionRoutingState } from '../src/organism/body/PerceptionRouter.ts';

// A persisted perception-routing state is written into facets.embodiment on every
// tick but was never restored into the subsystem's live state, so counters reset on
// restart. The restore must rehydrate the exact persisted counters.
const source = new EmbodimentSubsystemRuntime();
source.routePerception({ kind: 'text-input', at: 1, detail: 'hello', salience: 0.9 });
assert.equal(source.perceptionRoutingSnapshot().routedCount, 1);

// Counters must accumulate across ticks. The state is persisted every tick, so a
// literal `routedCount: 1` would reset the durable total on the next event and make
// the restore below meaningless. Two events must yield routedCount 2, not 1.
source.routePerception({ kind: 'motion', at: 2, detail: 'walk', salience: 0.9 });
assert.equal(source.perceptionRoutingSnapshot().routedCount, 2, 'routed counters must accumulate across ticks');
source.routePerception({ kind: 'quiet', at: 3, detail: 'idle', salience: 0.1 }, { awake: false });
assert.equal(source.perceptionRoutingSnapshot().droppedCount, 1, 'dropped counters must accumulate while asleep');

const persistedFacet = { version: 1, lastRoutedAt: 4242, routedCount: 7, droppedCount: 3, lastRoute: 'workspace' };
const restored = new EmbodimentSubsystemRuntime();
restored.restoreFromPersisted({ embodiment: { perceptionRouting: persistedFacet } });
assert.deepEqual(restored.perceptionRoutingSnapshot(), persistedFacet, 'persisted routing counters must survive restore');
assert.deepEqual(restored.snapshot().perceptionRouting, persistedFacet, 'snapshot must expose the restored routing');

// Malformed / hostile persisted input must fall back to the default, never trust fields.
for (const hostile of [
  null,
  undefined,
  'workspace',
  { version: 1, routedCount: '7', droppedCount: 0, lastRoutedAt: 1, lastRoute: 'workspace' },
  { version: 1, routedCount: 1, droppedCount: -1, lastRoutedAt: 1, lastRoute: 'workspace' },
  { version: 1, routedCount: 1, droppedCount: 0, lastRoutedAt: 1.5, lastRoute: 'workspace' },
  { version: 1, routedCount: 1, droppedCount: 0, lastRoutedAt: 1, lastRoute: 'nowhere' },
  { version: 2, routedCount: 1, droppedCount: 0, lastRoutedAt: 1, lastRoute: 'workspace' },
]) {
  assert.deepEqual(sanitizePerceptionRoutingState(hostile), defaultPerceptionRoutingState(), `hostile routing rejected: ${JSON.stringify(hostile)}`);
}

console.log('EMBODIMENT_PERCEPTION_ROUTING_RESTORE_INTEGRITY=PASS');
