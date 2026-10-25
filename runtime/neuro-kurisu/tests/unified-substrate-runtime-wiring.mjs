import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  UnifiedCognitiveSubstrate,
  defaultUnifiedCognitiveSubstrate,
} from '../src/organism/core/UnifiedCognitiveSubstrate.ts';

const initial = new UnifiedCognitiveSubstrate();
assert.deepEqual(initial.snapshot(), defaultUnifiedCognitiveSubstrate());

// Persisted data is untrusted. Missing sections, non-finite numbers, invalid
// counters, inherited values and oversized/control-containing text must not
// leak into the active cognitive frame.
const inheritedSelf = Object.create({ agency01: 1 });
inheritedSelf.coherence01 = 2;
const restored = new UnifiedCognitiveSubstrate();
restored.restore({
  cycles: Number.NaN,
  lastTick: -1,
  self: {
    continuity01: Number.POSITIVE_INFINITY,
    coherence01: 2,
    agency01: inheritedSelf.agency01,
    realityAlignment01: -1,
    mode: '\u0000explore\nspoof',
    lastAction: 42,
  },
  world: {
    confidence01: Number.NaN,
    uncertainty01: 2,
    entityCount: -1,
    eventCount: 2.5,
    relationCount: 3,
    conflict01: -1,
    newEntityRate01: 5,
  },
  prediction: null,
  resources: [],
  coupling: { selfWorld01: Number.NaN, actionReadiness01: 0.5 },
  provenance: { evidenceCoverage01: 1.2, realObservationCoverage01: 0.8, unknown01: Number.NaN },
  lastReason: '\n' + 'R'.repeat(400),
});
const restoredState = restored.snapshot();
assert.equal(restoredState.cycles, 0);
assert.equal(restoredState.lastTick, 0);
assert.equal(restoredState.self.continuity01, 0.7);
assert.equal(restoredState.self.coherence01, 1);
assert.equal(restoredState.self.agency01, 0.5);
assert.equal(restoredState.self.realityAlignment01, 0);
assert.equal(restoredState.self.mode, 'explore spoof');
assert.equal(restoredState.self.lastAction, 'wait');
assert.equal(restoredState.world.confidence01, 0.35);
assert.equal(restoredState.world.uncertainty01, 1);
assert.equal(restoredState.world.entityCount, 0);
assert.equal(restoredState.world.eventCount, 0);
assert.equal(restoredState.world.relationCount, 3);
assert.equal(restoredState.world.conflict01, 0);
assert.equal(restoredState.world.newEntityRate01, 1);
assert.equal(restoredState.resources.battery01, 0.82);
assert.equal(restoredState.coupling.selfWorld01, 0.35);
assert.equal(restoredState.coupling.actionReadiness01, 0.5);
assert.equal(restoredState.provenance.evidenceCoverage01, 1);
assert.equal(restoredState.provenance.realObservationCoverage01, 0.8);
assert.equal(restoredState.provenance.unknown01, 1);
assert.equal(restoredState.lastReason.length, 256);
assert.ok(Object.values(restoredState.self).every(value => typeof value === 'string' || (Number.isFinite(value) && value >= 0 && value <= 1)));
assert.throws(() => restored.restore({ version: 2 }), /unsupported unified-cognitive-substrate state version/);

// Own-property reads prevent inherited state values from being treated as
// persisted facts.
const inheritedOnly = Object.create({ agency01: 0.99 });
inheritedOnly.coherence01 = 0.25;
const prototypeGuard = new UnifiedCognitiveSubstrate();
prototypeGuard.restore({ version: 1, self: inheritedOnly });
assert.equal(prototypeGuard.snapshot().self.agency01, 0.5);
assert.equal(prototypeGuard.snapshot().self.coherence01, 0.25);

const substrate = new UnifiedCognitiveSubstrate();
const updated = substrate.integrate({
  tick: 1,
  self: {
    continuity01: 0.9,
    coherence01: 0.8,
    agency01: Number.POSITIVE_INFINITY,
    realityAlignment01: 0.7,
    mode: 'reflect\nnow',
    lastAction: 'verify\u0000receipt',
  },
  world: {
    confidence01: Number.NaN,
    uncertainty01: 1.5,
    entityCount: -1,
    eventCount: 3.5,
    relationCount: 2,
    conflict01: -0.2,
    newEntityRate01: 1.4,
  },
  prediction: {
    error01: -0.3,
    openCount: Number.NaN,
    agingCount: 4,
    expiredCount: -1,
    priority01: Number.POSITIVE_INFINITY,
  },
  resources: {
    battery01: Number.POSITIVE_INFINITY,
    thermal01: 0.2,
    ramPressure01: -0.5,
    computeCapacity01: '0.8',
    scarcity01: 0.3,
    efficiency01: 0.7,
  },
  memoryPressure01: Number.NaN,
  evidenceCoverage01: 1.2,
  realObservationCoverage01: 0.8,
  unknown01: -0.2,
  reason: '\n' + 'X'.repeat(400),
});
assert.equal(updated.cycles, 1);
assert.equal(updated.lastTick, 1);
assert.equal(updated.self.agency01, 0.5);
assert.equal(updated.self.mode, 'reflect now');
assert.equal(updated.self.lastAction, 'verify receipt');
assert.equal(updated.world.confidence01, 0.35);
assert.equal(updated.world.uncertainty01, 1);
assert.equal(updated.world.entityCount, 0);
assert.equal(updated.world.eventCount, 0);
assert.equal(updated.world.relationCount, 2);
assert.equal(updated.world.conflict01, 0);
assert.equal(updated.world.newEntityRate01, 1);
assert.equal(updated.prediction.error01, 0);
assert.equal(updated.prediction.openCount, 0);
assert.equal(updated.prediction.agingCount, 4);
assert.equal(updated.prediction.expiredCount, 0);
assert.equal(updated.prediction.priority01, 0);
assert.equal(updated.resources.battery01, 0.82);
assert.equal(updated.resources.ramPressure01, 0);
assert.equal(updated.resources.computeCapacity01, 0.82);
assert.equal(updated.coupling.memoryPressure01, 0);
assert.equal(updated.provenance.evidenceCoverage01, 1);
assert.equal(updated.provenance.realObservationCoverage01, 0.8);
assert.equal(updated.provenance.unknown01, 0);
assert.equal(updated.lastReason.length, 256);
assert.ok([
  ...Object.values(updated.self).filter(value => typeof value === 'number'),
  ...Object.values(updated.world).filter(value => typeof value === 'number'),
  ...Object.values(updated.prediction).filter(value => typeof value === 'number'),
  ...Object.values(updated.resources).filter(value => typeof value === 'number'),
  ...Object.values(updated.coupling),
  ...Object.values(updated.provenance),
].every(value => Number.isFinite(value) && value >= 0 && value <= 1 || Number.isSafeInteger(value) && value >= 0));
const beforeRejectedInput = substrate.snapshot();
assert.throws(() => substrate.integrate({ tick: 1 }), /sections must be objects/);
assert.deepEqual(substrate.snapshot(), beforeRejectedInput, 'malformed sections must not mutate the active frame');
assert.throws(() => substrate.integrate({ tick: 1, self: {}, world: {}, prediction: {}, resources: {} }), /tick must strictly increase/);
assert.deepEqual(substrate.snapshot(), beforeRejectedInput, 'replayed ticks must not mutate the active frame');
assert.throws(() => substrate.integrate({ tick: Number.NaN, self: {}, world: {}, prediction: {}, resources: {} }), /tick must be a non-negative safe integer/);
assert.deepEqual(substrate.snapshot(), beforeRejectedInput, 'invalid ticks must not mutate the active frame');

// The substrate is part of the actual runtime and durability path—not an
// unreferenced module. Core remains the canonical action arbitration owner.
const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
assert.match(runtime, /import \{ UnifiedCognitiveSubstrate, type UnifiedCognitiveSubstrateState \} from '\.\/UnifiedCognitiveSubstrate\.ts'/);
assert.match(runtime, /private readonly unifiedCognitiveSubstrate = new UnifiedCognitiveSubstrate\(\)/);
assert.match(runtime, /FileStateStore<UnifiedCognitiveSubstrateState>\(\x60\$\{config\.stateFile\}\.cognitive-substrate\.json\x60\)/);
assert.match(runtime, /unifiedCognitiveSubstrate\.restore\(await this\.unifiedCognitiveSubstrateStore\.load\(\) \?\? undefined\)/);
const observeAt = runtime.indexOf('const cycle = await this.core.observe(cycleObservation);');
const integrateAt = runtime.indexOf('this.unifiedCognitiveSubstrate.integrate(', observeAt);
const routingAt = runtime.indexOf('resolveCognitiveRoutingPolicy(dependencyState', observeAt);
assert.ok(observeAt >= 0 && integrateAt > observeAt, 'substrate must run after the normalized Core cycle');
assert.ok(routingAt > integrateAt, 'substrate integration must be visible before runtime routing diagnostics');
assert.match(runtime, /this\.unifiedCognitiveSubstrateStore\.save\(substrateState\)/);
assert.match(runtime, /unified-cognitive-substrate\.final-flush-failed/);
console.log('Unified cognitive substrate restore/input/runtime-wiring regression passed');
