import assert from 'node:assert/strict';
import { AttentionAllocator, attend, normalizeAttentionState } from '../src/organism/cognition/AttentionSchema.ts';

// --- Section 1: attention allocation over competing targets ------------------
const allocator = new AttentionAllocator();

// 1a. Goal relevance must beat raw task relevance when both are competitive.
const goalVsTask = allocator.allocate({
  tick: 1,
  candidates: [
    { target: 'goal:finish-report', source: 'goal', goalRelevance01: .92, urgency01: .5, predictedValue01: .8 },
    { target: 'sensor:door-noise', source: 'world', taskRelevance01: .6, urgency01: .3 },
  ],
  attentionBudget01: .8,
});
assert.equal(goalVsTask.target, 'goal:finish-report');
assert.equal(goalVsTask.reason, 'select:first-allocation');
assert.ok(goalVsTask.decision.factors.goal >= 0.9, 'the winning factor breakdown must be traceable');

// 1b. A materially larger threat must steal attention (priority change).
const threat = allocator.allocate({
  tick: 2,
  candidates: [
    { target: 'goal:finish-report', source: 'goal', goalRelevance01: .92, urgency01: .5, predictedValue01: .8 },
    { target: 'sensor:door-noise', source: 'world', taskRelevance01: .6, urgency01: 1, emotionalSalience01: .95, novelty01: .9 },
  ],
  attentionBudget01: .8,
});
assert.equal(threat.target, 'sensor:door-noise');
assert.equal(threat.decision.switched, true);
assert.equal(threat.reason, 'switch:challenger-margin');
assert.ok(threat.inhibited.includes('goal:finish-report'), 'the displaced target must be inhibited');

// 1c. A near-equal challenger must NOT cause thrash (hysteresis).
const hold = allocator.allocate({
  tick: 3,
  candidates: [
    { target: 'sensor:door-noise', source: 'world', taskRelevance01: .6, urgency01: .99, emotionalSalience01: .94, novelty01: .9 },
    { target: 'goal:finish-report', source: 'goal', goalRelevance01: .92, urgency01: .5, predictedValue01: .8 },
  ],
  attentionBudget01: .8,
});
assert.equal(hold.target, 'sensor:door-noise', 'near-equal challenger must not displace the incumbent');
assert.equal(hold.decision.switched, false);
assert.ok(hold.decision.dwell >= 1);

// 1d. Resource pressure must narrow attention to urgent targets only.
const starved = allocator.allocate({
  tick: 4,
  candidates: [
    { target: 'goal:finish-report', source: 'goal', goalRelevance01: .95, urgency01: .2 },
    { target: 'body:overheat', source: 'interoception', urgency01: .97, emotionalSalience01: .8 },
  ],
  attentionBudget01: .12,
});
assert.equal(starved.decision.resourceMode, 'minimal');
assert.equal(starved.target, 'body:overheat', 'a starved budget must still attend to the urgent target');
assert.equal(starved.budget, .12);

// 1e. Suppressed candidates can never be selected, and empty input falls back.
const suppressed = new AttentionAllocator().allocate({
  tick: 7,
  candidates: [{ target: 'memory:rumination', source: 'memory', goalRelevance01: 1, suppressed: true }],
  attentionBudget01: .9,
});
assert.notEqual(suppressed.target, 'memory:rumination');
const empty = new AttentionAllocator().allocate({ tick: 1, candidates: [], attentionBudget01: .9 });
assert.equal(empty.reason, 'fallback:no-eligible-candidate');
assert.equal(empty.target, 'internal-state');

// 1f. Corrupt candidate input must not produce NaN or crash allocation.
const garbage = new AttentionAllocator().allocate({
  tick: 1,
  candidates: [
    { target: '   ', source: 'x', urgency01: Number.NaN },
    { target: 'ok\u0001bad', source: 'x' },
    { target: 'valid', source: 'x', urgency01: Number.POSITIVE_INFINITY, novelty01: Number.NaN },
  ],
  attentionBudget01: Number.NaN,
});
assert.equal(garbage.target, 'valid');
assert.ok(Number.isFinite(garbage.confidence) && Number.isFinite(garbage.salience));
assert.equal(garbage.decision.considered, 1);

// 1g. Replay determinism: the same seed state and inputs reproduce byte-identical
//     allocation state (no wall clock, no randomness).
function replay(trace) {
  const a = new AttentionAllocator();
  for (let tick = 1; tick <= 24; tick++) {
    const state = a.allocate({
      tick,
      candidates: [
        { target: 'goal:a', source: 'goal', goalRelevance01: .5 + (tick % 5) * .05, urgency01: .3 },
        { target: 'world:b', source: 'world', taskRelevance01: .4, urgency01: tick % 3 === 0 ? .9 : .2, novelty01: .5 },
      ],
      attentionBudget01: .7,
    });
    trace.push(state);
  }
  return a.snapshot();
}
const traceA = [];
const traceB = [];
assert.deepEqual(replay(traceA), replay(traceB), 'allocation state must be deterministic across replays');
assert.deepEqual(traceA, traceB, 'the emitted attention trace must be deterministic across replays');

// 1h. Persisted allocator state round-trips, and corrupted state does not leak.
const snapshot = allocator.snapshot();
const restored = new AttentionAllocator();
restored.restore(structuredClone(snapshot));
assert.deepEqual(restored.snapshot(), snapshot);
const corrupt = new AttentionAllocator();
corrupt.restore({ target: 42, targetScore: 'x', dwell: -3, inhibition: { nope: { a: 1 }, '5': { 'bad\u0001target': 1, good: 2 } }, switches: -1, lastTick: 3.5 });
const corruptSnapshot = corrupt.snapshot();
assert.equal(corruptSnapshot.target, null);
assert.equal(corruptSnapshot.targetScore, 0);
assert.equal(corruptSnapshot.dwell, 0);
assert.equal(corruptSnapshot.switches, 0);
assert.equal(corruptSnapshot.lastTick, -1);
assert.deepEqual(corruptSnapshot.inhibition, { 5: { good: 2 } });

// 1i. Tick monotonicity is enforced: replay cannot merge two cycles.
assert.throws(() => allocator.allocate({ tick: 4, candidates: [], attentionBudget01: .9 }), /strictly increase/);

// --- Section 2: legacy attention record compatibility -----------------------
const legacy = attend({ target: 'none', reason: 'migration', salience: 0, confidence: .2, budget: .82 });
assert.equal(legacy.switchedAt, 0, 'legacy constructor must not read the wall clock');
assert.equal(legacy.target, 'none');
const normalized = normalizeAttentionState({ target: '  ', salience: 'x', confidence: Number.NaN, inhibited: [1, 'keep', null] });
assert.equal(normalized.target, 'internal-state');
assert.equal(normalized.salience, 0);
assert.equal(normalized.confidence, .2);
assert.deepEqual(normalized.inhibited, ['keep']);

console.log(JSON.stringify({ pass: true, sections: 2, allocations: traceA.length + 6, switches: snapshot.switches }));
