import assert from 'node:assert/strict';
import { CognitiveNetworkBus } from '../src/organism/cognition/CognitiveNetworkBus.ts';

const signal = (specialist, score, confidence = 0.9, energyCost = 0.1) => ({
  specialist, score, confidence, target: 'bounded-test', evidence: ['fixture'], energyCost,
});

const bus = new CognitiveNetworkBus();
const valid = signal('memory', 0.9);
const hostile = signal('affect', Symbol('score'), Symbol('confidence'), Symbol('energy-cost'));

assert.doesNotThrow(
  () => bus.stimulate([valid, hostile], 7, 1),
  'hostile numeric plugin fields must be normalized rather than crashing the broadcast',
);
const broadcast = bus.broadcast();
assert.equal(broadcast?.winner, 'memory');
const normalizedHostile = broadcast?.selected.find(item => item.specialist === 'affect');
assert.ok(normalizedHostile, 'the known specialist remains structurally admissible');
assert.equal(normalizedHostile.score, 0);
assert.equal(normalizedHostile.confidence, 0);
assert.equal(normalizedHostile.energyCost, 0);

assert.doesNotThrow(() => bus.updateCapacity(Symbol('capacity')));
assert.equal(bus.snapshot().capacity, 3, 'invalid capacity preserves the last valid capacity');
bus.updateCapacity(99);
assert.equal(bus.snapshot().capacity, 5, 'valid capacity remains bounded');

const hostileSnapshot = {
  tick: Symbol('tick'),
  capacity: Symbol('capacity'),
  lastBroadcast: {
    id: 'restored-hostile',
    tick: Symbol('broadcast-tick'),
    winner: 'memory',
    selected: [signal('memory', Symbol('score'), Symbol('confidence'), Symbol('energy-cost'))],
    inhibited: [],
    broadcastGain: Symbol('gain'),
    recurrentCycles: Symbol('cycles'),
    weights: { memory: Symbol('weight') },
    rationale: [],
  },
  history: [],
  totalIgnitions: Symbol('ignitions'),
};

assert.doesNotThrow(
  () => bus.restore(hostileSnapshot),
  'malformed numeric values in persisted state must not crash restore',
);
const restored = bus.snapshot();
assert.equal(restored.tick, 0);
assert.equal(restored.capacity, 3);
assert.equal(restored.totalIgnitions, 0);
assert.equal(restored.lastBroadcast?.tick, 0);
assert.equal(restored.lastBroadcast?.broadcastGain, 0);
assert.equal(restored.lastBroadcast?.recurrentCycles, 1);
assert.equal(restored.lastBroadcast?.selected[0]?.score, 0);
assert.equal(restored.lastBroadcast?.selected[0]?.confidence, 0);
assert.equal(restored.lastBroadcast?.selected[0]?.energyCost, 0);
assert.equal(restored.lastBroadcast?.weights.memory, 0);

const finite = [
  restored.tick,
  restored.capacity,
  restored.totalIgnitions,
  restored.lastBroadcast?.tick,
  restored.lastBroadcast?.broadcastGain,
  restored.lastBroadcast?.recurrentCycles,
  restored.lastBroadcast?.selected[0]?.score,
  restored.lastBroadcast?.selected[0]?.confidence,
  restored.lastBroadcast?.selected[0]?.energyCost,
  restored.lastBroadcast?.weights.memory,
];
assert.ok(finite.every(Number.isFinite), 'restored numeric state must remain finite');

console.log('NK1_COGNITIVE_NETWORK_BUS_INPUT_INTEGRITY=PASS hostilePluginSymbols=true hostileRestoreSymbols=true capacityFallback=true finiteRestore=true');
