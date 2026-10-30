import assert from 'node:assert/strict';
import { CanonicalMemoryLifecycleAuthority, defaultCanonicalMemoryLifecycleState } from '../src/organism/memory/CanonicalMemoryLifecycleAuthority.ts';
import { P70MemoryLifecycleGovernor, defaultP70 } from '../src/organism/developmental/P70MemoryLifecycleGovernor.ts';
import { MemoryConsolidationController } from '../src/organism/memory/MemoryConsolidationController.ts';

let maintenanceCalls = 0;
const fabric = {
  maintain(input) { maintenanceCalls++; return { skipped: false, changed: 0, tick: input.tick }; },
  inspect() { return { available: true }; },
};
// P70 is the lifecycle budget authority and must apply the same restore discipline.
const governor = new P70MemoryLifecycleGovernor();
governor.restore({
  version: 1, cycles: -1, maintenanceRuns: Number.MAX_SAFE_INTEGER + 1,
  prunedRecords: '12', compactions: 2.5, meanHotLoad01: Number.NaN,
  meanPressure01: 3, lastAction: 'injected', lastAt: -1, injectedOwner: true,
});
assert.deepEqual(governor.snapshot(), {
  ...defaultP70(), meanPressure01: 1,
});
const inheritedGovernor = Object.assign(Object.create({ cycles: 12, meanPressure01: 0.99, lastAction: 'protect' }), { version: 1 });
governor.restore(inheritedGovernor);
assert.deepEqual(governor.snapshot(), defaultP70(), 'P70 restore must ignore inherited state fields');
const validGovernorState = governor.snapshot();
assert.throws(() => governor.restore({ version: 2 }), /Unsupported P70 memory lifecycle state version/);
assert.deepEqual(governor.snapshot(), validGovernorState);

const makeAuthority = () => new CanonicalMemoryLifecycleAuthority(
  fabric,
  new P70MemoryLifecycleGovernor(),
  new MemoryConsolidationController(),
);

const authority = makeAuthority();
authority.restore(defaultCanonicalMemoryLifecycleState());
assert.deepEqual(authority.snapshot(), defaultCanonicalMemoryLifecycleState());

// Restore is an allow-list projection: malformed counters, labels and unknown
// properties cannot become part of the lifecycle's live state.
authority.restore({
  version: 1,
  cycles: -4,
  maintenanceRuns: Number.MAX_SAFE_INTEGER + 1,
  consolidationRuns: '7',
  lastTick: '12',
  meanPressure01: Number.NaN,
  meanMemoryLoad01: 4,
  injectedOwner: 'not-allowed',
  lastPlan: {
    budgets: { traces: 10, events: 20, goals: 2, memories: 300, semanticItems: 900, injected: 1 },
    action: 'trim', pressure01: 0.7, hotLoad01: 0.4, injected: true,
  },
  lastConsolidation: [
    { id: 'memory-1', route: 'hippocampal', reason: 'verified', priority01: 0.8, plasticity01: 0.7, retention01: 0.9, overconsolidationRisk01: 0.1, reinforcement01: 0.8, injected: true },
    { id: 'bad\u0001id', route: 'defer', reason: 'bad', priority01: 0.1, plasticity01: 0.1, retention01: 0.1, overconsolidationRisk01: 0.1, reinforcement01: 0.1 },
    { id: 'missing-route', reason: 'invalid', priority01: 0.1, plasticity01: 0.1, retention01: 0.1, overconsolidationRisk01: 0.1, reinforcement01: 0.1 },
  ],
});
const restored = authority.snapshot();
assert.equal(restored.cycles, 0);
assert.equal(restored.maintenanceRuns, 0);
assert.equal(restored.consolidationRuns, 0);
assert.equal(restored.lastTick, -1);
assert.equal(restored.meanPressure01, 0.18);
assert.equal(restored.meanMemoryLoad01, 1);
assert.equal(Object.hasOwn(restored, 'injectedOwner'), false);
assert.deepEqual(restored.lastPlan, {
  budgets: { traces: 10, events: 20, goals: 2, memories: 300, semanticItems: 900 },
  action: 'trim', pressure01: 0.7, hotLoad01: 0.4,
});
assert.equal(restored.lastConsolidation.length, 1);
assert.equal(Object.hasOwn(restored.lastConsolidation[0], 'injected'), false);

// Inherited root and nested projection fields are not part of persisted state.
const inheritedBudgets = Object.create({ traces: 10, events: 20, goals: 2, memories: 300, semanticItems: 900 });
const inheritedPlan = Object.create({ budgets: inheritedBudgets, action: 'trim', pressure01: 0.7, hotLoad01: 0.4 });
const inheritedDecision = Object.create({ id: 'memory-prototype', route: 'hippocampal', reason: 'inherited', priority01: 0.8, plasticity01: 0.7, retention01: 0.9, overconsolidationRisk01: 0.1, reinforcement01: 0.8 });
authority.restore(Object.assign(Object.create({ cycles: 12, lastTick: 20, meanPressure01: 0.9 }), {
  version: 1,
  lastPlan: inheritedPlan,
  lastConsolidation: [inheritedDecision],
}));
const inheritedSnapshot = authority.snapshot();
assert.equal(inheritedSnapshot.cycles, 0);
assert.equal(inheritedSnapshot.lastTick, -1);
assert.equal(inheritedSnapshot.meanPressure01, 0.18);
assert.equal(inheritedSnapshot.lastPlan, undefined, 'inherited nested budget fields must not become a lifecycle plan');
assert.deepEqual(inheritedSnapshot.lastConsolidation, [], 'inherited decision fields must not become consolidation evidence');

// Unsupported versions fail closed without replacing the last valid state.
const beforeUnsupported = authority.snapshot();
assert.throws(() => authority.restore({ version: 2 }), /Unsupported canonical memory lifecycle state version/);
assert.deepEqual(authority.snapshot(), beforeUnsupported);

// Tick is a strictly increasing, non-negative safe integer at the lifecycle boundary.
const input = { tick: 5, at: 100, traces: 1, events: 2, goals: 1, memories: 3, semanticItems: 4, workingSet01: 0.3, energy01: 0.8, pressure01: 0.2 };
const result = authority.run(input);
assert.equal(result.maintenance.skipped, false);
assert.equal(authority.snapshot().lastTick, 5);
assert.equal(authority.snapshot().cycles, 1);
assert.equal(maintenanceCalls, 1);
const beforeDuplicate = authority.snapshot();
assert.throws(() => authority.run(input), /strictly increasing/);
assert.deepEqual(authority.snapshot(), beforeDuplicate);
assert.equal(maintenanceCalls, 1);
assert.throws(() => authority.run({ ...input, tick: Number.MAX_SAFE_INTEGER + 1 }), /strictly increasing/);
assert.deepEqual(authority.snapshot(), beforeDuplicate);

// The alternate canonical maintenance entrypoint shares the same tick authority.
authority.maintainCanonical({ tick: 6, pressure01: 0.25 });
assert.equal(authority.snapshot().lastTick, 6);
assert.equal(maintenanceCalls, 2);
const beforeDuplicateMaintenance = authority.snapshot();
const duplicateMaintenance = authority.maintainCanonical({ tick: 6 });
assert.deepEqual(duplicateMaintenance, { skipped: true, changed: 0 });
assert.deepEqual(authority.snapshot(), beforeDuplicateMaintenance);
assert.equal(maintenanceCalls, 2);
assert.throws(() => authority.maintainCanonical({ tick: 5 }), /must not decrease/);
assert.deepEqual(authority.snapshot(), beforeDuplicateMaintenance);
assert.equal(maintenanceCalls, 2);

// Root and nested accessors in persisted state must never execute.
let rootGetterCalled = false;
const getterRoot = { version: 1 };
Object.defineProperty(getterRoot, 'cycles', { enumerable: true, get() { rootGetterCalled = true; return 77; } });
const getterGovernor = new P70MemoryLifecycleGovernor();
getterGovernor.restore(getterRoot);
assert.equal(rootGetterCalled, false);
assert.equal(getterGovernor.snapshot().cycles, 0);

let nestedGetterCalled = false;
const getterBudgets = { traces: 1, events: 2, goals: 1, memories: 3, semanticItems: 4 };
Object.defineProperty(getterBudgets, 'memories', { enumerable: true, get() { nestedGetterCalled = true; return 999; } });
const accessorPlanAuthority = makeAuthority();
accessorPlanAuthority.restore({ version: 1, lastPlan: { action: 'trim', budgets: getterBudgets } });
assert.equal(nestedGetterCalled, false);
assert.equal(accessorPlanAuthority.snapshot().lastPlan, undefined);

// Accessor-backed array indexes are rejected without evaluating getters.
let decisionGetterCalled = false;
const decisions = new Array(1);
Object.defineProperty(decisions, '0', { enumerable: true, get() { decisionGetterCalled = true; return { id: 'forged' }; } });
accessorPlanAuthority.restore({ version: 1, lastConsolidation: decisions });
assert.equal(decisionGetterCalled, false);
assert.deepEqual(accessorPlanAuthority.snapshot().lastConsolidation, []);

// If canonical fabric maintenance fails after the governor has planned, roll back
// governor counters so retrying the same tick is safe and does not double-count.
let shouldFail = true;
let retryMaintenanceCalls = 0;
const retryFabric = {
  maintain(input) {
    retryMaintenanceCalls++;
    if (shouldFail) throw new Error('simulated-fabric-maintenance-failure');
    return { skipped: false, changed: 1, tick: input.tick };
  },
  inspect() { return { available: true }; },
};
const retryGovernor = new P70MemoryLifecycleGovernor();
const retryAuthority = new CanonicalMemoryLifecycleAuthority(retryFabric, retryGovernor, new MemoryConsolidationController());
const retryInput = { tick: 1, at: 100, traces: 1, events: 2, goals: 1, memories: 3, semanticItems: 4, workingSet01: 0.3, energy01: 0.8, pressure01: 0.2 };
const governorBeforeFailure = retryGovernor.snapshot();
assert.throws(() => retryAuthority.run(retryInput), /simulated-fabric-maintenance-failure/);
assert.deepEqual(retryGovernor.snapshot(), governorBeforeFailure, 'governor state must rollback when fabric maintenance fails');
assert.equal(retryAuthority.snapshot().cycles, 0);
shouldFail = false;
const retryResult = retryAuthority.run(retryInput);
assert.equal(retryResult.maintenance.changed, 1);
assert.equal(retryGovernor.snapshot().cycles, 1, 'successful retry must count one plan, not two');
assert.equal(retryAuthority.snapshot().cycles, 1);
assert.equal(retryMaintenanceCalls, 2);

// P70 rejects malformed tick/time values before changing its counters.
const invalidPlanGovernor = new P70MemoryLifecycleGovernor();
const invalidPlanInput = { tick: 1, at: 100, traces: 1, events: 2, goals: 1, memories: 3, semanticItems: 4, workingSet01: 0.3, energy01: 0.8, pressure01: 0.2 };
assert.throws(() => invalidPlanGovernor.plan({ ...invalidPlanInput, tick: 1.5 }), /tick must be a non-negative safe integer/);
assert.throws(() => invalidPlanGovernor.plan({ ...invalidPlanInput, at: Number.NaN }), /timestamp must be finite and non-negative/);
assert.equal(invalidPlanGovernor.snapshot().cycles, 0, 'invalid plan inputs must not mutate P70 state');
const boundedBudget = invalidPlanGovernor.plan({
  ...invalidPlanInput,
  experienceHotCount: Number.NaN,
  experienceWarmCount: Number.POSITIVE_INFINITY,
  experienceColdCount: 1.5,
});
assert.ok(Object.values(boundedBudget.budgets).every(Number.isSafeInteger));
assert.ok(Number.isFinite(boundedBudget.pressure01));
const exhaustedGovernor = new P70MemoryLifecycleGovernor();
exhaustedGovernor.restore({ version: 1, cycles: Number.MAX_SAFE_INTEGER });
assert.throws(() => exhaustedGovernor.plan(invalidPlanInput), /cycle counter reached its safe integer limit/);
assert.equal(exhaustedGovernor.snapshot().cycles, Number.MAX_SAFE_INTEGER);

console.log('workpass618 canonical memory lifecycle integrity: ok');