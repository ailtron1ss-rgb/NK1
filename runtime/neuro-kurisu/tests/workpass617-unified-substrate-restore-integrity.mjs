import assert from 'node:assert/strict';
import { UnifiedCognitiveSubstrate, defaultUnifiedCognitiveSubstrate } from '../src/organism/core/UnifiedCognitiveSubstrate.ts';

const substrate = new UnifiedCognitiveSubstrate();
substrate.restore(defaultUnifiedCognitiveSubstrate());
assert.deepEqual(substrate.snapshot(), defaultUnifiedCognitiveSubstrate());

// Malformed persisted data must be normalized field-by-field, never spread into live state.
const restored = new UnifiedCognitiveSubstrate();
restored.restore({
  version: 1,
  cycles: -4,
  lastTick: '17',
  self: {
    continuity01: Number.NaN,
    coherence01: Number.POSITIVE_INFINITY,
    agency01: -2,
    realityAlignment01: 3,
    mode: '  ',
    lastAction: 'bad\u0001action',
    injectedOwner: 'not-allowed',
  },
  world: {
    confidence01: 0.8,
    uncertainty01: Number.NaN,
    entityCount: 3.5,
    eventCount: -1,
    relationCount: Number.MAX_SAFE_INTEGER + 1,
    conflict01: 2,
    newEntityRate01: '0.4',
    injectedEntity: true,
  },
  prediction: {
    error01: Number.NEGATIVE_INFINITY,
    openCount: '7',
    agingCount: 1.5,
    expiredCount: 3,
    priority01: -1,
  },
  resources: {
    battery01: -2,
    thermal01: Number.NaN,
    ramPressure01: 0.6,
    computeCapacity01: 2,
    scarcity01: '0.2',
    efficiency01: 0.9,
  },
  coupling: {
    selfWorld01: Number.NaN,
    predictionGrounding01: 0.7,
    memoryPressure01: 2,
    actionReadiness01: Number.POSITIVE_INFINITY,
  },
  provenance: {
    evidenceCoverage01: 0.9,
    realObservationCoverage01: -1,
    unknown01: 2,
    injectedProof: 'not-allowed',
  },
  lastReason: 'bad\u0002reason',
  injectedRoot: true,
});

const safe = restored.snapshot();
assert.equal(safe.cycles, 0);
assert.equal(safe.lastTick, 0);
assert.deepEqual(safe.self, {
  continuity01: 0.7,
  coherence01: 0.7,
  agency01: 0,
  realityAlignment01: 1,
  mode: 'wait',
  lastAction: 'wait',
});
assert.deepEqual(safe.world, {
  confidence01: 0.8,
  uncertainty01: 0.65,
  entityCount: 0,
  eventCount: 0,
  relationCount: 0,
  conflict01: 1,
  newEntityRate01: 0,
});
assert.deepEqual(safe.prediction, {
  error01: 0.5,
  openCount: 0,
  agingCount: 0,
  expiredCount: 3,
  priority01: 0,
});
assert.deepEqual(safe.resources, {
  battery01: 0,
  thermal01: 0.18,
  ramPressure01: 0.6,
  computeCapacity01: 1,
  scarcity01: 0.18,
  efficiency01: 0.9,
});
assert.deepEqual(safe.coupling, {
  selfWorld01: 0.35,
  predictionGrounding01: 0.7,
  memoryPressure01: 1,
  actionReadiness01: 0.4,
});
assert.deepEqual(safe.provenance, {
  evidenceCoverage01: 0.9,
  realObservationCoverage01: 0,
  unknown01: 1,
});
assert.equal(safe.lastReason, 'initial');
assert.equal(Object.hasOwn(safe, 'injectedRoot'), false);
assert.equal(Object.hasOwn(safe.self, 'injectedOwner'), false);
assert.equal(Object.hasOwn(safe.world, 'injectedEntity'), false);
assert.equal(Object.hasOwn(safe.provenance, 'injectedProof'), false);
assert.ok(Number.isFinite(restored.actionBias('verify')));

// Unsupported state versions fail closed and do not partially overwrite a valid state.
assert.throws(
  () => restored.restore({ version: 2 }),
  /unsupported unified cognitive substrate state version/,
);
assert.deepEqual(restored.snapshot(), safe);

// A valid cycle integrates once and advances a strictly monotonic tick.
const input = (tick) => ({
  tick,
  self: { continuity01: 0.8, coherence01: 0.75, agency01: 0.6, realityAlignment01: 0.7, mode: 'verify', lastAction: 'verify' },
  world: { confidence01: 0.7, uncertainty01: 0.3, entityCount: 4, eventCount: 2, relationCount: 3, conflict01: 0.1, newEntityRate01: 0.2 },
  prediction: { error01: 0.2, openCount: 2, agingCount: 1, expiredCount: 0, priority01: 0.7 },
  resources: { battery01: 0.8, thermal01: 0.2, ramPressure01: 0.2, computeCapacity01: 0.8, scarcity01: 0.2, efficiency01: 0.75 },
  memoryPressure01: 0.25,
  evidenceCoverage01: 0.7,
  realObservationCoverage01: 0.5,
  unknown01: 0.2,
});

const cycle = new UnifiedCognitiveSubstrate();
const first = cycle.integrate(input(1));
assert.equal(first.cycles, 1);
assert.equal(first.lastTick, 1);
assert.ok(first.coupling.selfWorld01 > 0.55);
assert.ok(first.coupling.predictionGrounding01 > 0.55);
assert.ok(cycle.actionBias('verify') > 0);
const beforeDuplicate = cycle.snapshot();
assert.throws(() => cycle.integrate(input(1)), /tick must strictly increase/);
assert.deepEqual(cycle.snapshot(), beforeDuplicate, 'rejected duplicate ticks must not mutate substrate state');
assert.throws(() => cycle.integrate(input(0)), /positive safe integer/);
assert.throws(() => cycle.integrate(input(Number.MAX_SAFE_INTEGER + 1)), /positive safe integer/);
assert.equal(cycle.integrate(input(2)).cycles, 2);

// Saturated counters must not wrap or silently lose ordering.
const saturated = new UnifiedCognitiveSubstrate();
saturated.restore({ version: 1, cycles: Number.MAX_SAFE_INTEGER, lastTick: 8 });
assert.throws(() => saturated.integrate(input(9)), /cycle counter reached its safe integer limit/);

const detached = cycle.snapshot();
detached.self.mode = 'mutated-outside';
assert.equal(cycle.snapshot().self.mode, 'verify', 'snapshots must be detached from canonical substrate state');

console.log('ASPECT01_UNIFIED_COGNITIVE_SUBSTRATE_INTEGRITY=PASS', JSON.stringify({
  restoreSanitization: true,
  versionGuard: true,
  monotonicTicks: true,
  overflowGuard: true,
  detachedSnapshot: true,
  cycles: cycle.snapshot().cycles,
}));
