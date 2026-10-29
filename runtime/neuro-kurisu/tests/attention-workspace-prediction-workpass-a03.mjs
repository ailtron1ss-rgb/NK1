import assert from 'node:assert/strict';
import { AttentionAllocator, attend, normalizeAttentionState } from '../src/organism/cognition/AttentionSchema.ts';
import { RecurrentWorkspaceV2, defaultWorkspaceStateV2 } from '../src/organism/cognition/RecurrentWorkspaceV2.ts';
import { updateWorkspaceIgnition, defaultWorkspaceIgnition } from '../src/organism/cognition/WorkspaceIgnitionMetrics.ts';

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


// --- Section 3: bounded working workspace -----------------------------------
function items(n, salienceScale = 1, createdAt = 1) {
  return Array.from({ length: n }, (_, i) => ({ id: `i${i}`, source: i % 2 ? 'memory' : 'decision', content: { i }, salience: ((n - i) / n) * salienceScale, createdAt }));
}

// 3a. Bounded capacity: the coalition never exceeds capacity and duplicates
//     never consume two slots (the pre-fix defect).
const ws = new RecurrentWorkspaceV2();
const wide = ws.compete([...items(12), ...items(12).map(x => ({ ...x, salience: .99 }))], 1);
assert.equal(wide.items.length, 5);
assert.equal(new Set(wide.items.map(x => x.id)).size, wide.items.length);
assert.equal(wide.competitors, 12, 'duplicate ids must collapse to one competitor');
assert.ok(wide.lastCompetition <= 12);

// 3b. Growth is bounded across many cycles even if the caller keeps growing.
let live = [...items(20)];
for (let tick = 2; tick <= 200; tick++) live = [...live, ...items(20).map(x => ({ ...x, id: `${x.id}-${tick}` }))];
const bounded = ws.compete(live, 200);
assert.equal(bounded.items.length, 5);
assert.ok(ws.snapshot().suppressed.length <= 8, 'suppression memory must be bounded');
assert.ok(ws.snapshot().items.length <= ws.snapshot().capacity);

// 3c. Retention: a resident is retained while it stays competitive...
const retainWs = new RecurrentWorkspaceV2();
retainWs.compete(items(5), 1);
const retained = retainWs.compete(items(5).map(x => ({ ...x, salience: x.id === 'i0' ? .5 : .1 })), 2);
assert.ok(retained.lastDecision.retained.includes('i0'), 'a competitive resident must be retained');
// ...and loses its slot once it stops being observed for long enough.
let decayed = retained;
for (let tick = 3; tick <= 400; tick++) decayed = retainWs.compete(items(3).map(x => ({ ...x, id: `new${tick}` })), tick);
assert.ok(!decayed.items.some(x => x.id === 'i0'), 'tenure must be bounded, not permanent');
assert.ok(retained.lastDecision.admitted.length >= 0);

// 3d. Suppression: an item that loses a contested slot cannot immediately
//     re-enter, which prevents single-cycle thrash.
const suppWs = new RecurrentWorkspaceV2();
suppWs.compete(items(8), 1);
const suppressedIds = suppWs.snapshot().lastDecision.suppressed;
assert.ok(suppressedIds.length > 0, 'losing competitors must be recorded as suppressed');
for (let tick = 2; tick <= 3; tick++) {
  const windowed = suppWs.compete(items(8), tick);
  assert.ok(windowed.items.every(item => !suppressedIds.includes(item.id)), 'suppressed ids must not re-enter during their window');
}
const afterWindow = suppWs.compete(items(8), 5);
assert.ok(afterWindow.items.some(item => suppressedIds.includes(item.id)), 'suppression must expire so useful content can return');

// 3e. Removal: explicit removal drops the item and is counted.
const removeWs = new RecurrentWorkspaceV2();
removeWs.compete(items(3), 1);
assert.equal(removeWs.remove('i0'), true);
assert.equal(removeWs.remove('i0'), false);
assert.ok(!removeWs.snapshot().items.some(x => x.id === 'i0'));

// 3f. Restart determinism: snapshot -> restore -> identical next competition.
const restartWs = new RecurrentWorkspaceV2();
restartWs.compete(items(6), 5);
const restoredWs = new RecurrentWorkspaceV2();
restoredWs.restore(structuredClone(restartWs.snapshot()));
assert.deepEqual(restoredWs.snapshot().items, restartWs.snapshot().items);
assert.deepEqual(restoredWs.compete(items(6), 6), restartWs.compete(items(6), 6));
assert.equal(restoredWs.snapshot().broadcastId, restartWs.snapshot().broadcastId, 'broadcast id must be reproducible');

// 3g. A hostile snapshot cannot make the workspace unbounded or non-finite.
const hostile = new RecurrentWorkspaceV2();
hostile.restore({
  capacity: 1e9, recurrence: 1e9, lastCompetition: -7, ignition01: Number.NaN,
  sourceDiversity01: 4, coalitionStability01: Number.POSITIVE_INFINITY,
  items: Array.from({ length: 400 }, (_, i) => ({ id: `h${i}`, source: 'x', content: {}, salience: 5, createdAt: -1 })),
  suppressed: [{ id: 'ok', ticksRemaining: 1e9 }, { id: 'bad\u0001id', ticksRemaining: 2 }, { ticksRemaining: 2 }],
});
const hostileState = hostile.snapshot();
assert.equal(hostileState.capacity, 24);
assert.ok(hostileState.items.length <= 24);
assert.ok(Number.isFinite(hostileState.recurrence) && hostileState.recurrence <= 1);
assert.ok(Number.isFinite(hostileState.ignition01) && hostileState.ignition01 >= 0);
assert.equal(hostileState.lastCompetition, 0);
assert.equal(hostileState.suppressed.length, 1);
assert.equal(hostileState.suppressed[0].id, 'ok');
assert.equal(hostileState.suppressed[0].ticksRemaining, 64, 'suppression windows must be capped');
assert.deepEqual(defaultWorkspaceStateV2().items, []);

// 3h. Malformed item input is dropped rather than admitted.
const malformed = new RecurrentWorkspaceV2().compete([
  { id: '', salience: 1 }, { id: '   ', salience: 1 }, null, 42, { id: 'ok', source: 'z', content: null, salience: Number.NaN, createdAt: 'x' },
], 1);
assert.equal(malformed.items.length, 1);
assert.equal(malformed.items[0].id, 'ok');
assert.equal(malformed.items[0].salience, 0);
assert.equal(malformed.items[0].createdAt, 1);

// 3i. Ignition metric must be capacity-normalised, not saturated by any
//     non-empty competition (the pre-fix `clamp(lastCompetition)` defect).
const oneOfFive = updateWorkspaceIgnition(defaultWorkspaceIgnition(), { ...defaultWorkspaceStateV2(), items: [items(1)[0]], lastCompetition: 1, recurrence: 0 }, 0);
const fiveOfFive = updateWorkspaceIgnition(defaultWorkspaceIgnition(), { ...defaultWorkspaceStateV2(), items: items(5), lastCompetition: 5, recurrence: 0 }, 0);
assert.ok(oneOfFive.competitionIntensity < .5, 'a single competitor must not read as maximum competition');
assert.ok(fiveOfFive.competitionIntensity > oneOfFive.competitionIntensity, 'more competition must raise the metric');
assert.ok(oneOfFive.limitedCapacity < .05, 'an under-filled workspace must not read as capacity limited');
assert.ok(fiveOfFive.limitedCapacity > .95, 'a full workspace must read as capacity limited');


console.log(JSON.stringify({ pass: true, sections: 3, allocations: traceA.length + 6, workspace: { capacity: bounded.capacity, competitors: bounded.competitors } }));
