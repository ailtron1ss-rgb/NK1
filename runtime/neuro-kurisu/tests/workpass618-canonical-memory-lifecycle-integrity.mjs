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
const beforeStale = authority.snapshot();
assert.throws(() => authority.maintainCanonical({ tick: 6 }), /strictly increasing/);
assert.deepEqual(authority.snapshot(), beforeStale);
assert.equal(maintenanceCalls, 2);

console.log('workpass618 canonical memory lifecycle integrity: ok');
