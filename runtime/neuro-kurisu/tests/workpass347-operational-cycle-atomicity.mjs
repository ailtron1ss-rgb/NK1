import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { UnifiedCognitiveCycle } from '../src/organism/system/UnifiedCognitiveCycle.ts';
import { commitOperationalCognitiveCycleAtomically } from '../src/organism/core/CognitiveCycleCommitCoordinator.ts';

const cycleInput = (overrides = {}) => ({
  tick: 41,
  at: 4100,
  observation: { payload: { observed: 'world-state' } },
  prediction: { payload: { predicted: 'next-state' } },
  appraisal: { payload: { urgency: 0.2 } },
  attention: { payload: { focus: 'goal-a' } },
  memory: { payload: { recalled: ['episode-1'] } },
  goal: { payload: { id: 'goal-a' } },
  plan: { payload: { steps: ['step-a'] } },
  action: { payload: { id: 'action-a' } },
  outcome: { external: true, payload: { verified: true } },
  learning: { payload: { candidate: 'skill-a' } },
  selfUpdate: { payload: { confidence01: 0.8 } },
  ...overrides,
});

// Normal cycles keep stage ordering and causal parent links.
const normal = new CognitiveEventFabric(128);
const ids = normal.recordOperationalCycle(cycleInput());
const normalSnapshot = normal.snapshot();
assert.equal(normalSnapshot.total, 11);
for (const [key, id] of Object.entries(ids)) {
  assert.ok(normalSnapshot.recent.some(event => event.id === id), `missing committed event for ${key}`);
}
const byId = new Map(normalSnapshot.recent.map(event => [event.id, event]));
assert.deepEqual(byId.get(ids.prediction).parentIds, [ids.observation]);
assert.deepEqual(byId.get(ids.learning).parentIds, [ids.outcome, ids.action]);
assert.deepEqual(byId.get(ids.selfUpdate).parentIds, [ids.learning, ids.outcome]);

// A malformed payload in the final phase must fail before the first phase is written.
const preflight = new CognitiveEventFabric(128);
const cyclicPayload = {};
cyclicPayload.self = cyclicPayload;
assert.throws(() => preflight.recordOperationalCycle(cycleInput({
  selfUpdate: { payload: cyclicPayload },
})));
assert.equal(preflight.snapshot().total, 0, 'preflight failure must leave the lifetime total unchanged');
assert.equal(preflight.snapshot().recent.length, 0, 'preflight failure must leave the event ledger empty');

// A malformed field in a later phase must be rejected before any earlier event is appended.
const badLateField = new CognitiveEventFabric(128);
assert.throws(
  () => badLateField.recordOperationalCycle(cycleInput({
    selfUpdate: { source: 42, payload: { shouldNotWrite: true } },
  })),
  /invalid-cognitive-event-source/,
);
assert.equal(badLateField.snapshot().total, 0);
assert.equal(badLateField.snapshot().recent.length, 0);

// Roll back if an unexpected append-time error occurs after some phases have been appended.
const rollback = new CognitiveEventFabric(128);
const realAppend = rollback.append.bind(rollback);
let appendCalls = 0;
rollback.append = function(input) {
  appendCalls += 1;
  if (appendCalls === 4) throw new Error('injected-operational-cycle-append-failure');
  return realAppend(input);
};
assert.throws(
  () => rollback.recordOperationalCycle(cycleInput()),
  /injected-operational-cycle-append-failure/,
);
assert.equal(appendCalls, 4);
assert.equal(rollback.snapshot().total, 0, 'unexpected append error must roll back the lifetime total');
assert.equal(rollback.snapshot().recent.length, 0, 'unexpected append error must roll back inserted events');

console.log('WorkPass347 operational-cycle atomicity: PASS');
