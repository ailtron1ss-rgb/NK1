import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  UnifiedCognitiveSubstrate,
  defaultUnifiedCognitiveSubstrate,
  resolveUnifiedCognitiveWorkPolicy,
} from '../src/organism/core/UnifiedCognitiveSubstrate.ts';

const initial = new UnifiedCognitiveSubstrate();
assert.deepEqual(initial.snapshot(), defaultUnifiedCognitiveSubstrate());

// Persisted data is untrusted. Missing sections, non-finite numbers, invalid
// counters, inherited values and oversized/control-containing text must not
// leak into the active cognitive frame.
const inheritedSelf = Object.create({ agency01: 1 });
Object.assign(inheritedSelf, {
  continuity01: Number.POSITIVE_INFINITY,
  coherence01: 2,
  realityAlignment01: -1,
  mode: '\u0000explore\nspoof',
  lastAction: 42,
});
const restored = new UnifiedCognitiveSubstrate();
restored.restore({
  cycles: Number.NaN,
  lastTick: -1,
  self: inheritedSelf,
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
assert.equal(restoredState.self.coherence01, 0, 'out-of-range coherence is not treated as positive evidence');
assert.equal(restoredState.self.agency01, 0.5, 'inherited agency is ignored and the documented default remains');
assert.equal(restoredState.self.realityAlignment01, 0);
assert.equal(restoredState.self.mode, 'explore spoof');
assert.equal(restoredState.self.lastAction, 'wait');
assert.equal(restoredState.world.confidence01, 0, 'invalid world confidence is not upgraded to the default prior');
assert.equal(restoredState.world.uncertainty01, 1);
assert.equal(restoredState.world.entityCount, 0);
assert.equal(restoredState.world.eventCount, 0);
assert.equal(restoredState.world.relationCount, 3);
assert.equal(restoredState.world.conflict01, 1, 'invalid conflict telemetry is treated as critical');
assert.equal(restoredState.world.newEntityRate01, 1);
assert.equal(restoredState.resources.battery01, 0, 'malformed resource section is treated as exhausted');
assert.equal(restoredState.resources.thermal01, 1);
assert.equal(restoredState.resources.ramPressure01, 1);
assert.equal(restoredState.resources.scarcity01, 1);
assert.equal(resolveUnifiedCognitiveWorkPolicy(restoredState, 3).maxCounterfactualBranches, 0, 'malformed restored resources must disable optional simulation');
assert.equal(restoredState.coupling.selfWorld01, 0, 'invalid coupling confidence must not receive a positive prior');
assert.equal(restoredState.coupling.actionReadiness01, 0.5);
assert.equal(restoredState.provenance.evidenceCoverage01, 0, 'out-of-range provenance must not claim full evidence');
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
assert.equal(updated.self.agency01, 0, 'invalid agency must not increase action readiness');
assert.equal(updated.self.mode, 'reflect now');
assert.equal(updated.self.lastAction, 'verify receipt');
assert.equal(updated.world.confidence01, 0, 'non-finite confidence uses a conservative fallback');
assert.equal(updated.world.uncertainty01, 1);
assert.equal(updated.world.entityCount, 0);
assert.equal(updated.world.eventCount, 0);
assert.equal(updated.world.relationCount, 2);
assert.equal(updated.world.conflict01, 1, 'out-of-range conflict disables speculative work');
assert.equal(updated.world.newEntityRate01, 1);
assert.equal(updated.prediction.error01, 1, 'invalid prediction error is treated as maximal uncertainty');
assert.equal(updated.prediction.openCount, 0);
assert.equal(updated.prediction.agingCount, 4);
assert.equal(updated.prediction.expiredCount, 0);
assert.equal(updated.prediction.priority01, 1, 'invalid prediction priority does not disappear');
assert.equal(updated.resources.battery01, 0, 'non-finite battery telemetry uses the exhausted fallback');
assert.equal(updated.resources.ramPressure01, 1, 'negative RAM pressure is invalid, not proof of spare capacity');
assert.equal(updated.resources.computeCapacity01, 0, 'wrong-typed compute telemetry disables optimistic capacity assumptions');
assert.equal(updated.coupling.memoryPressure01, 1, 'invalid memory pressure is handled conservatively');
assert.equal(updated.provenance.evidenceCoverage01, 0, 'out-of-range evidence coverage cannot create trust');
assert.equal(updated.provenance.realObservationCoverage01, 0.8);
assert.equal(updated.provenance.unknown01, 1, 'negative unknown ratio is invalid and must not increase trust');
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
assert.throws(() => substrate.integrate({ tick: 2 }), /sections must be objects/);
assert.deepEqual(substrate.snapshot(), beforeRejectedInput, 'malformed sections must not mutate the active frame');
assert.throws(() => substrate.integrate({ tick: 1, self: {}, world: {}, prediction: {}, resources: {} }), /tick must strictly increase/);
assert.deepEqual(substrate.snapshot(), beforeRejectedInput, 'replayed ticks must not mutate the active frame');
assert.throws(() => substrate.integrate({ tick: Number.NaN, self: {}, world: {}, prediction: {}, resources: {} }), /tick must be a non-negative safe integer/);
assert.deepEqual(substrate.snapshot(), beforeRejectedInput, 'invalid ticks must not mutate the active frame');


// Optional-work governance is coupled to the integrated frame. It may
// curtail simulation cost, but cannot choose the actual environment action.
const grounded = new UnifiedCognitiveSubstrate();
const groundedFrame = grounded.integrate({
  tick: 1,
  self: { continuity01: 0.9, coherence01: 0.9, agency01: 0.9, realityAlignment01: 0.9, mode: 'plan', lastAction: 'verify' },
  world: { confidence01: 0.9, uncertainty01: 0.2, entityCount: 8, eventCount: 10, relationCount: 6, conflict01: 0.1, newEntityRate01: 0.2 },
  prediction: { error01: 0.1, openCount: 1, agingCount: 0, expiredCount: 0, priority01: 0.2 },
  resources: { battery01: 0.9, thermal01: 0.2, ramPressure01: 0.2, computeCapacity01: 0.9, scarcity01: 0.1, efficiency01: 0.9 },
  memoryPressure01: 0.2,
  evidenceCoverage01: 0.9,
  realObservationCoverage01: 0.8,
  unknown01: 0.1,
});
const groundedPolicy = resolveUnifiedCognitiveWorkPolicy(groundedFrame, 3);
assert.equal(groundedPolicy.maxCounterfactualBranches, 3);
assert.equal(groundedPolicy.allowMatchedCounterfactual, true);
assert.match(groundedPolicy.reason, /substrate-budget-open/);

const fallbackPolicy = resolveUnifiedCognitiveWorkPolicy(defaultUnifiedCognitiveSubstrate(), 3);
assert.equal(fallbackPolicy.maxCounterfactualBranches, 1, 'unknown evidence must cap optional work');
assert.equal(fallbackPolicy.allowMatchedCounterfactual, false, 'un-grounded state must not create matched credit');

const critical = structuredClone(groundedFrame);
critical.coupling.actionReadiness01 = 0.2;
const criticalPolicy = resolveUnifiedCognitiveWorkPolicy(critical, 3);
assert.equal(criticalPolicy.maxCounterfactualBranches, 0);
assert.equal(criticalPolicy.allowMatchedCounterfactual, false);
assert.match(criticalPolicy.reason, /critical-pressure/);
for (const badBudget of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
  const policy = resolveUnifiedCognitiveWorkPolicy(groundedFrame, badBudget);
  assert.equal(policy.maxCounterfactualBranches, 0);
  assert.equal(policy.allowMatchedCounterfactual, false);
  assert.equal(policy.reason, 'invalid-resource-budget');
}
const malformedPolicyState = resolveUnifiedCognitiveWorkPolicy(null, 3);
assert.equal(malformedPolicyState.maxCounterfactualBranches, 0);
assert.equal(malformedPolicyState.allowMatchedCounterfactual, false);
assert.equal(malformedPolicyState.reason, 'invalid-substrate-state');
const nonFinitePolicyState = structuredClone(groundedFrame);
nonFinitePolicyState.coupling.predictionGrounding01 = Number.NaN;
const nonFinitePolicy = resolveUnifiedCognitiveWorkPolicy(nonFinitePolicyState, 3);
assert.equal(nonFinitePolicy.maxCounterfactualBranches, 0);
assert.equal(nonFinitePolicy.allowMatchedCounterfactual, false);
assert.equal(nonFinitePolicy.reason, 'invalid-substrate-state');

const noBudget = resolveUnifiedCognitiveWorkPolicy(groundedFrame, 0);
assert.equal(noBudget.maxCounterfactualBranches, 0);
assert.equal(noBudget.allowMatchedCounterfactual, false);
assert.equal(noBudget.reason, 'upstream-budget-zero');

// The substrate is part of the actual runtime and durability path—not an
// unreferenced module. Core remains the canonical action arbitration owner.
const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
assert.ok(runtime.includes("import { UnifiedCognitiveSubstrate, type UnifiedCognitiveSubstrateState, resolveUnifiedCognitiveWorkPolicy } from './UnifiedCognitiveSubstrate.ts'"));
assert.match(runtime, /private readonly unifiedCognitiveSubstrate = new UnifiedCognitiveSubstrate\(\)/);
assert.match(runtime, /resolveUnifiedCognitiveWorkPolicy/);
assert.match(runtime, /substrateWorkPolicy\.maxCounterfactualBranches/);
assert.match(runtime, /baseRoutingPolicy\.allowMatchedCounterfactual && substrateWorkPolicy\.allowMatchedCounterfactual/);
assert.match(runtime, /FileStateStore<UnifiedCognitiveSubstrateState>\(\x60\$\{config\.stateFile\}\.cognitive-substrate\.json\x60\)/);
assert.match(runtime, /unifiedCognitiveSubstrate\.restore\(await this\.unifiedCognitiveSubstrateStore\.load\(\) \?\? undefined\)/);
assert.match(runtime, /runtime\.unified-cognitive-substrate\.restore-failed/);
assert.match(runtime, /memoryPressure01: 1 - resourceAllocation\.memory01/);


assert.ok(runtime.includes('const predictionDebt = this.core.predictionDebtSnapshot();'));
assert.ok(!runtime.includes('predictionDebtSnapshot() as Record<string, unknown>'));
assert.ok(runtime.includes('openCount: debtCount(predictionDebt.openCount)'));
assert.ok(runtime.includes('agingCount: debtCount(predictionDebt.agingCount)'));
assert.ok(runtime.includes('expiredCount: debtCount(predictionDebt.expiredCount)'));
assert.ok(runtime.includes('predictionDebtCountsValid'));
assert.ok(runtime.includes('predictionDebt.meanPriority01 <= 1'));
assert.ok(runtime.includes(':\n        1;'), 'malformed prediction debt must normalize to high priority');
assert.ok(runtime.includes('relationCount: this.core.p41PerceptionSnapshot().relations.length'));
assert.ok(!runtime.includes('cycleObservation.vision?.relations'));
const observeAt = runtime.indexOf('const cycle = await this.core.observe(cycleObservation);');
const integrateAt = runtime.indexOf('this.unifiedCognitiveSubstrate.integrate(', observeAt);
const routingAt = runtime.indexOf('resolveCognitiveRoutingPolicy(dependencyState', observeAt);
assert.ok(observeAt >= 0 && integrateAt > observeAt, 'substrate must run after the normalized Core cycle');
assert.ok(routingAt > integrateAt, 'substrate integration must be visible before runtime routing diagnostics');
assert.match(runtime, /this\.unifiedCognitiveSubstrateStore\.save\(substrateState\)/);
assert.match(runtime, /unified-cognitive-substrate\.final-flush-failed/);
console.log('Unified cognitive substrate restore/input/runtime-wiring regression passed');


// Invalid sensor telemetry must not be clamped into healthy-looking values.
// Such faults lower the optional-work budget and must never authorize matched
// counterfactual credit.
const sensorFault = new UnifiedCognitiveSubstrate();
const faultFrame = sensorFault.integrate({
  tick: 1,
  self: { continuity01: 0.8, coherence01: 0.9, agency01: 0.9, realityAlignment01: 0.9, mode: 'plan', lastAction: 'explore' },
  world: { confidence01: 0.9, uncertainty01: 0.1, entityCount: 6, eventCount: 8, relationCount: 4, conflict01: -0.1, newEntityRate01: 0.2 },
  prediction: { error01: 0.1, openCount: 1, agingCount: 0, expiredCount: 0, priority01: 0.1 },
  resources: { battery01: 0.9, thermal01: -0.2, ramPressure01: -0.3, computeCapacity01: 0.9, scarcity01: -0.4, efficiency01: 0.9 },
  memoryPressure01: 0.1,
  evidenceCoverage01: 0.9,
  realObservationCoverage01: 0.9,
  unknown01: 0.1,
});
assert.equal(faultFrame.resources.thermal01, 1);
assert.equal(faultFrame.resources.ramPressure01, 1);
assert.equal(faultFrame.resources.scarcity01, 1);
assert.equal(faultFrame.world.conflict01, 1);
const faultPolicy = resolveUnifiedCognitiveWorkPolicy(faultFrame, 4);
assert.equal(faultPolicy.maxCounterfactualBranches, 0, 'invalid resource/conflict telemetry must fail closed');
assert.equal(faultPolicy.allowMatchedCounterfactual, false);
assert.match(faultPolicy.reason, /critical-pressure/);

// Optional work must consider battery/compute/efficiency explicitly, not only
// a derived readiness scalar; high agency cannot compensate for an exhausted
// or incorrectly reported resource budget.
for (const [metricName, value] of [
  ['battery01', 0.04],
  ['computeCapacity01', 0.08],
  ['efficiency01', 0.08],
]) {
  const lowResource = structuredClone(groundedFrame);
  lowResource.resources[metricName] = value;
  const policy = resolveUnifiedCognitiveWorkPolicy(lowResource, 4);
  assert.equal(policy.maxCounterfactualBranches, 0, metricName + ' below critical floor blocks all optional work');
  assert.equal(policy.allowMatchedCounterfactual, false);
}
const reducedBattery = structuredClone(groundedFrame);
reducedBattery.resources.battery01 = 0.15;
const reducedBatteryPolicy = resolveUnifiedCognitiveWorkPolicy(reducedBattery, 4);
assert.equal(reducedBatteryPolicy.maxCounterfactualBranches, 1, 'low but noncritical battery caps optional branches');
assert.equal(reducedBatteryPolicy.allowMatchedCounterfactual, false, 'low battery cannot authorize matched counterfactual credit');

const invalidBattery = structuredClone(groundedFrame);
invalidBattery.resources.battery01 = Number.NaN;
const invalidBatteryPolicy = resolveUnifiedCognitiveWorkPolicy(invalidBattery, 4);
assert.equal(invalidBatteryPolicy.maxCounterfactualBranches, 0);
assert.equal(invalidBatteryPolicy.reason, 'invalid-substrate-state', 'non-finite battery evidence must fail closed');

// A missing live battery sample is not equivalent to the healthy default used
// for a clean boot or a legacy persisted snapshot. Live sensor gaps fail closed.
const missingBatterySensor = new UnifiedCognitiveSubstrate();
const missingBatteryFrame = missingBatterySensor.integrate({
  tick: 1,
  self: { continuity01: 0.9, coherence01: 0.9, agency01: 0.9, realityAlignment01: 0.9, mode: 'plan', lastAction: 'explore' },
  world: { confidence01: 0.9, uncertainty01: 0.1, entityCount: 6, eventCount: 8, relationCount: 4, conflict01: 0.1, newEntityRate01: 0.2 },
  prediction: { error01: 0.1, openCount: 1, agingCount: 0, expiredCount: 0, priority01: 0.1 },
  resources: { thermal01: 0.2, ramPressure01: 0.2, computeCapacity01: 0.9, scarcity01: 0.1, efficiency01: 0.9 },
  memoryPressure01: 0.1, evidenceCoverage01: 0.9, realObservationCoverage01: 0.9, unknown01: 0.1,
});
assert.equal(missingBatteryFrame.resources.battery01, 0, 'missing live battery data uses the exhausted fallback');
const missingBatteryPolicy = resolveUnifiedCognitiveWorkPolicy(missingBatteryFrame, 4);
assert.equal(missingBatteryPolicy.maxCounterfactualBranches, 0, 'missing live battery telemetry disables optional cognition');
assert.equal(missingBatteryPolicy.allowMatchedCounterfactual, false);

// The shared work policy must validate prediction-debt inputs themselves,
// not trust a plausible derived coupling score when the debt record is corrupt.
const urgentDebt = structuredClone(groundedFrame);
urgentDebt.prediction.priority01 = 0.86;
const urgentDebtPolicy = resolveUnifiedCognitiveWorkPolicy(urgentDebt, 4);
assert.equal(urgentDebtPolicy.maxCounterfactualBranches, 1, 'high prediction debt caps optional branches');
assert.equal(urgentDebtPolicy.allowMatchedCounterfactual, false, 'high prediction debt cannot authorize matched counterfactual credit');
const criticalDebt = structuredClone(groundedFrame);
criticalDebt.prediction.priority01 = 0.99;
const criticalDebtPolicy = resolveUnifiedCognitiveWorkPolicy(criticalDebt, 4);
assert.equal(criticalDebtPolicy.maxCounterfactualBranches, 0, 'critical prediction debt disables optional branches');
assert.match(criticalDebtPolicy.reason, /critical-pressure/);
const malformedDebt = structuredClone(groundedFrame);
malformedDebt.prediction.openCount = -1;
assert.equal(resolveUnifiedCognitiveWorkPolicy(malformedDebt, 4).reason, 'invalid-substrate-state');
const missingDebtSection = structuredClone(groundedFrame);
delete missingDebtSection.prediction;
assert.equal(resolveUnifiedCognitiveWorkPolicy(missingDebtSection, 4).reason, 'invalid-substrate-state');

