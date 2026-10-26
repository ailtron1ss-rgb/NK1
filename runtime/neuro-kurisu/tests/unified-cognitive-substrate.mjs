import assert from 'node:assert/strict';
import { OrganismResourceAllocator, defaultOrganismResourceAllocation } from '../src/organism/system/OrganismResourceAllocator.ts';
import { UnifiedCognitiveSubstrate, defaultUnifiedCognitiveSubstrate, resolveUnifiedCognitiveWorkPolicy, resolveUnifiedCognitiveResourceSignals } from '../src/organism/core/UnifiedCognitiveSubstrate.ts';
const alloc=new OrganismResourceAllocator(); alloc.restore(defaultOrganismResourceAllocation());
const a=alloc.decide({battery01:.85,thermal01:.15,ramPressure01:.18,uncertainty01:.7,predictionError01:.65,goalPressure01:.5,novelty01:.8,socialNeed01:.25,grounding01:.55,learningOpportunity01:.75,languageDemand01:0,externalInput:false});
assert.ok(a.computeCapacity01>0.5);
assert.ok(a.allocations.world>a.allocations.language);
const hot=alloc.decide({battery01:.12,thermal01:.9,ramPressure01:.88,uncertainty01:.5,predictionError01:.3,goalPressure01:.2,novelty01:.2,socialNeed01:.1,grounding01:.4,learningOpportunity01:.2,languageDemand01:0,externalInput:false});
assert.ok(hot.computeCapacity01<a.computeCapacity01);
assert.ok(hot.actionBias.rest>a.actionBias.rest);
const substrate=new UnifiedCognitiveSubstrate(); substrate.restore(defaultUnifiedCognitiveSubstrate());
const out=substrate.integrate({tick:1,self:{continuity01:.8,coherence01:.75,agency01:.6,realityAlignment01:.7,mode:'verify',lastAction:'verify'},world:{confidence01:.7,uncertainty01:.3,entityCount:4,eventCount:2,relationCount:3,conflict01:.1,newEntityRate01:.2},prediction:{error01:.2,openCount:2,agingCount:1,expiredCount:0,priority01:.7},resources:{battery01:.8,thermal01:.2,ramPressure01:.2,computeCapacity01:.8,scarcity01:.2,efficiency01:.75},memoryPressure01:.25,evidenceCoverage01:.7,realObservationCoverage01:.5,unknown01:.2});
assert.ok(out.coupling.selfWorld01>.55); assert.ok(out.coupling.predictionGrounding01>.55); assert.ok(substrate.actionBias('verify')>0);

const restoredGuard = new UnifiedCognitiveSubstrate();
const validRestoredState = defaultUnifiedCognitiveSubstrate();
validRestoredState.cycles = 7;
validRestoredState.lastTick = 12;
validRestoredState.self.agency01 = 0.63;
validRestoredState.lastReason = 'restored checkpoint';
restoredGuard.restore(validRestoredState);
const validRestoredSnapshot = restoredGuard.snapshot();
assert.equal(validRestoredSnapshot.cycles, 7);
assert.equal(validRestoredSnapshot.lastTick, 12);
assert.equal(validRestoredSnapshot.self.agency01, 0.63);
assert.equal(validRestoredSnapshot.lastReason, 'restored checkpoint');

// Future schema versions fail closed without replacing the last good state.
assert.throws(
  () => restoredGuard.restore({ ...validRestoredState, version: 2 }),
  /version/,
);
assert.deepEqual(restoredGuard.snapshot(), validRestoredSnapshot);

// Prototype fields and accessor properties are not trusted, and accessors are never executed.
let restoreGetterCalls = 0;
const accessorSnapshot = {};
Object.defineProperty(accessorSnapshot, 'version', {
  enumerable: true,
  get() { restoreGetterCalls++; return 1; },
});
Object.defineProperty(accessorSnapshot, 'cycles', {
  enumerable: true,
  get() { restoreGetterCalls++; return 900; },
});
const accessorGuard = new UnifiedCognitiveSubstrate();
accessorGuard.restore(accessorSnapshot);
assert.equal(restoreGetterCalls, 0);
assert.equal(accessorGuard.snapshot().cycles, 0);
const inheritedSnapshot = Object.create({ version: 1, cycles: 88, lastTick: 77 });
accessorGuard.restore(inheritedSnapshot);
assert.equal(accessorGuard.snapshot().cycles, 0);
assert.equal(accessorGuard.snapshot().lastTick, 0);

// Corrupt metrics/counters degrade conservatively; extra persisted keys are discarded.
const corruptSnapshot = {
  ...defaultUnifiedCognitiveSubstrate(),
  cycles: -4,
  lastTick: Number.MAX_SAFE_INTEGER + 1,
  self: {
    ...defaultUnifiedCognitiveSubstrate().self,
    continuity01: 1.5,
    agency01: Number.NaN,
    mode: 'bad\u0001'.repeat(90),
  },
  resources: {
    ...defaultUnifiedCognitiveSubstrate().resources,
    thermal01: Number.POSITIVE_INFINITY,
  },
  unexpectedRuntimeField: { dangerous: true },
};
const corruptGuard = new UnifiedCognitiveSubstrate();
corruptGuard.restore(corruptSnapshot);
const sanitized = corruptGuard.snapshot();
assert.equal(sanitized.cycles, 0);
assert.equal(sanitized.lastTick, 0);
assert.equal(sanitized.self.continuity01, 0);
assert.equal(sanitized.self.agency01, 0);
assert.equal(sanitized.resources.thermal01, 1);
assert.ok(sanitized.self.mode.length <= 64);
assert.ok(!Object.hasOwn(sanitized, 'unexpectedRuntimeField'));

const makeValidInput = (tick) => ({
  tick,
  self: {
    continuity01: 0.8, coherence01: 0.75, agency01: 0.6,
    realityAlignment01: 0.7, mode: 'verify', lastAction: 'verify',
  },
  world: {
    confidence01: 0.7, uncertainty01: 0.3, entityCount: 4,
    eventCount: 2, relationCount: 3, conflict01: 0.1, newEntityRate01: 0.2,
  },
  prediction: {
    error01: 0.2, openCount: 2, agingCount: 1, expiredCount: 0, priority01: 0.7,
  },
  resources: {
    battery01: 0.8, thermal01: 0.2, ramPressure01: 0.2,
    computeCapacity01: 0.8, scarcity01: 0.2, efficiency01: 0.75,
  },
  memoryPressure01: 0.25,
  evidenceCoverage01: 0.7,
  realObservationCoverage01: 0.5,
  unknown01: 0.2,
});
const boundaryGuard = new UnifiedCognitiveSubstrate();
const boundaryFirst = boundaryGuard.integrate(makeValidInput(1));
const beforeRejectedInputs = boundaryGuard.snapshot();
assert.deepEqual(boundaryFirst, beforeRejectedInputs);
assert.throws(() => boundaryGuard.integrate(makeValidInput(1)), /monoton/);
assert.deepEqual(boundaryGuard.snapshot(), beforeRejectedInputs);

const outOfRangeInput = makeValidInput(2);
outOfRangeInput.resources.battery01 = 1.5;
assert.throws(() => boundaryGuard.integrate(outOfRangeInput), /resources\.battery01/);
assert.deepEqual(boundaryGuard.snapshot(), beforeRejectedInputs);

const unsafeCounterInput = makeValidInput(2);
unsafeCounterInput.world.eventCount = Number.MAX_SAFE_INTEGER + 1;
assert.throws(() => boundaryGuard.integrate(unsafeCounterInput), /world\.eventCount/);
assert.deepEqual(boundaryGuard.snapshot(), beforeRejectedInputs);

const accessorInput = makeValidInput(2);
let inputGetterCalls = 0;
Object.defineProperty(accessorInput.self, 'agency01', {
  enumerable: true,
  get() { inputGetterCalls++; return 0.5; },
});
assert.throws(() => boundaryGuard.integrate(accessorInput), /self\.agency01/);
assert.equal(inputGetterCalls, 0);
assert.deepEqual(boundaryGuard.snapshot(), beforeRejectedInputs);

const invalidInputTick = makeValidInput(Number.MAX_SAFE_INTEGER + 1);
assert.throws(() => boundaryGuard.integrate(invalidInputTick), /tick/);
assert.deepEqual(boundaryGuard.snapshot(), beforeRejectedInputs);


const groundedPolicy = resolveUnifiedCognitiveWorkPolicy(out, 3);
assert.equal(groundedPolicy.maxCounterfactualBranches, 3);
assert.equal(groundedPolicy.allowMatchedCounterfactual, true);
assert.match(groundedPolicy.reason, /substrate-budget-open/);
const fallbackPolicy = resolveUnifiedCognitiveWorkPolicy(defaultUnifiedCognitiveSubstrate(), 3);
assert.equal(fallbackPolicy.maxCounterfactualBranches, 1);
assert.equal(fallbackPolicy.allowMatchedCounterfactual, false);
const criticalPolicyState = structuredClone(out);
criticalPolicyState.coupling.actionReadiness01 = 0.2;
const criticalPolicy = resolveUnifiedCognitiveWorkPolicy(criticalPolicyState, 3);
assert.equal(criticalPolicy.maxCounterfactualBranches, 0);
assert.equal(criticalPolicy.allowMatchedCounterfactual, false);
assert.match(criticalPolicy.reason, /critical-pressure/);
const oversizedBudgetPolicy = resolveUnifiedCognitiveWorkPolicy(out, 99);
assert.equal(oversizedBudgetPolicy.maxCounterfactualBranches, 3);
const invalidBudgetPolicy = resolveUnifiedCognitiveWorkPolicy(out, Number.NaN);
assert.equal(invalidBudgetPolicy.maxCounterfactualBranches, 0);
assert.equal(invalidBudgetPolicy.reason, 'invalid-resource-budget');


const feedbackPrior = defaultUnifiedCognitiveSubstrate();
feedbackPrior.world.uncertainty01 = 0.9;
feedbackPrior.world.newEntityRate01 = 0.8;
feedbackPrior.prediction.error01 = 0.7;
feedbackPrior.prediction.priority01 = 0.8;
const feedbackSignals = resolveUnifiedCognitiveResourceSignals({
  operationalPredictionError01: 0.2,
  operationalAutonomy01: 0.1,
  predictionDebtPriority01: 0.2,
  priorSubstrate: feedbackPrior,
});
assert.ok(Math.abs(feedbackSignals.uncertainty01 - 0.39) < 1e-12);
assert.ok(Math.abs(feedbackSignals.novelty01 - 0.48) < 1e-12);
assert.ok(Math.abs(feedbackSignals.predictionDebt01 - 0.4) < 1e-12);
const damagedFeedback = resolveUnifiedCognitiveResourceSignals({
  operationalPredictionError01: Number.NaN,
  operationalAutonomy01: 0.1,
  predictionDebtPriority01: -2,
  priorSubstrate: { world: { uncertainty01: Number.NaN, newEntityRate01: 2 }, prediction: { error01: Infinity, priority01: -1 } },
});
assert.equal(damagedFeedback.uncertainty01, 1);
assert.ok(Math.abs(damagedFeedback.novelty01 - 0.6) < 1e-12);
assert.ok(Math.abs(damagedFeedback.predictionDebt01 - 1) < 1e-12);

console.log('UNIFIED_SUBSTRATE=PASS',JSON.stringify({capacity:a.computeCapacity01,hotCapacity:hot.computeCapacity01,selfWorld:out.coupling.selfWorld01,predictionGrounding:out.coupling.predictionGrounding01}));
