import assert from 'node:assert/strict';
import { AttentionAllocator, attend, normalizeAttentionState } from '../src/organism/cognition/AttentionSchema.ts';
import { RecurrentWorkspaceV2, defaultWorkspaceStateV2 } from '../src/organism/cognition/RecurrentWorkspaceV2.ts';
import { updateWorkspaceIgnition, defaultWorkspaceIgnition } from '../src/organism/cognition/WorkspaceIgnitionMetrics.ts';
import { WorldModelEvidenceGate } from '../src/organism/cognition/WorldModelEvidenceGate.ts';
import { B283CompetingPredictiveHypotheses } from '../src/organism/cognition/B283CompetingPredictiveHypotheses.ts';
import { P81PredictiveAttention } from '../src/organism/cognition/P81PredictiveAttention.ts';

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

// 1j. Thrash resistance: when a caller's candidate identity alternates (the
//     world location flickered between two values), attention must not switch
//     every cycle. The bounded carry also expires, so this is not lock-in.
const thrash = new AttentionAllocator();
let thrashSwitches = 0;
for (let tick = 1; tick <= 20; tick++) {
  const location = tick % 2 ? 'home' : 'lab';
  const state = thrash.allocate({
    tick,
    candidates: [{ target: `world:${location}`, source: 'world', taskRelevance01: .55, urgency01: .3, predictedValue01: .5 }],
    attentionBudget01: .8,
  });
  if (state.decision.switched) thrashSwitches++;
}
assert.ok(thrashSwitches <= 6, `alternating candidate identity caused thrash (${thrashSwitches} switches in 20 cycles)`);
// ...and an absent incumbent does not hold forever: after the carry window the
// only available target takes over.
const expiry = new AttentionAllocator();
expiry.allocate({ tick: 1, candidates: [{ target: 'a', source: 's', taskRelevance01: .5 }], attentionBudget01: .8 });
let expiryTarget = 'a';
for (let tick = 2; tick <= 12; tick++) {
  expiryTarget = expiry.allocate({ tick, candidates: [{ target: 'b', source: 's', taskRelevance01: .5 }], attentionBudget01: .8 }).target;
}
assert.equal(expiryTarget, 'b', 'a carried incumbent must expire so attention can move on');

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

// 3d. Suppression: an item that loses a contested slot stays out for its window
//     even when it later out-ranks the incumbents, then expires and returns.
const suppWs = new RecurrentWorkspaceV2();
suppWs.compete(items(8), 1);
const suppressedIds = suppWs.snapshot().lastDecision.suppressed;
assert.equal(suppressedIds.length, 3, 'the losers of a contested cycle must be recorded as suppressed');
const boosted = items(8).map(x => ({ ...x, salience: suppressedIds.includes(x.id) ? 1 : .1 }));
for (let tick = 2; tick <= 4; tick++) {
  const windowed = suppWs.compete(boosted, tick);
  if (tick <= 3) assert.ok(windowed.items.every(item => !suppressedIds.includes(item.id)), 'suppressed ids must not re-enter during their window');
}
const afterWindow = suppWs.compete(boosted, 5);
assert.ok(afterWindow.items.some(item => suppressedIds.includes(item.id)), 'suppression must expire so a winning item can return');

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


// 3j. Source access guarantee: senders use different salience scales, so a raw
//     salience sort let one source occupy every slot. With minSources>1 the
//     strongest item per source is admitted first, bounded by capacity.
const decisions = Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, source: 'decision', content: {}, salience: .9 - i * .01, createdAt: 1 }));
const weakSignal = { id: 'a1', source: 'attention', content: {}, salience: .2, createdAt: 1 };
const noQuota = new RecurrentWorkspaceV2().compete([...decisions, weakSignal], 1).items.map(i => i.source);
assert.deepEqual([...new Set(noQuota)], ['decision'], 'without a quota a strong source may monopolise the workspace');
const withQuota = new RecurrentWorkspaceV2().compete([...decisions, weakSignal], 1, { minSources: 2 }).items;
assert.ok(withQuota.some(i => i.source === 'attention'), 'a reserved source must reach the coalition');
assert.equal(withQuota.length, 5, 'the quota must not exceed capacity');
assert.equal(new Set(withQuota.map(i => i.id)).size, withQuota.length);

// --- Section 4: predictive processing / competing hypotheses ----------------
const ACTIONS = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const util = () => Object.fromEntries(ACTIONS.map(a => [a, .5]));
const gateArgs = (tick, over = {}) => ({
  tick, baseUtilities: util(),
  continuityReward01: .6, continuityConfidence01: .8, continuityDisagreement01: .2,
  embodiedReward01: .6, embodiedConfidence01: .8, embodiedConsistency01: .8,
  causalSensitivity01: .5, epistemicValue01: .4, computeBudget01: .7,
  continuityActionRewards01: ACTIONS.map(() => .55), embodiedActionRewards01: ACTIONS.map(() => .55),
  embodiedActionConfidence01: ACTIONS.map(() => .6), ...over,
});

// 4a. Realized error must reorder priorities. Both models stay *confident*, but
//     the continuity model keeps being wrong: its outcome-grounded weight must
//     fall. Before the fix the recorded errors never reached arbitration.
const learningGate = new WorldModelEvidenceGate();
for (let tick = 0; tick < 120; tick++) {
  learningGate.arbitrate(gateArgs(tick));
  learningGate.afterOutcome({ reward01: .8, continuityPred01: .1, embodiedPred01: .78, verified01: 1, causalGain01: .2, transfer01: .5 });
}
const learned = learningGate.metrics();
assert.ok(learned.continuityWeight01 < learned.embodiedWeight01,
  `the repeatedly-wrong model must lose authority (continuity=${learned.continuityWeight01}, embodied=${learned.embodiedWeight01})`);
assert.ok(learned.embodiedWeight01 > .6, 'the accurate model must win the majority of the weight');
assert.ok(Math.abs(learned.continuityWeight01 + learned.embodiedWeight01 - 1) < .02, 'the weight pair must stay normalized');

// 4b. Contradiction handling: if the evidence then reverses, priorities must
//     follow the new evidence rather than staying latched.
for (let tick = 120; tick < 260; tick++) {
  learningGate.arbitrate(gateArgs(tick));
  learningGate.afterOutcome({ reward01: .8, continuityPred01: .78, embodiedPred01: .12, verified01: 1, causalGain01: .2, transfer01: .5 });
}
const recovered = learningGate.metrics();
assert.ok(recovered.continuityWeight01 > learned.continuityWeight01,
  'a model that becomes accurate again must regain weight');

// 4c. Determinism: identical outcome sequences produce identical gate state.
function replayGate() {
  const gate = new WorldModelEvidenceGate();
  for (let tick = 0; tick < 60; tick++) {
    gate.arbitrate(gateArgs(tick));
    gate.afterOutcome({ reward01: .7, continuityPred01: .3, embodiedPred01: .68, verified01: 1, causalGain01: .1, transfer01: .5 });
  }
  return gate.metrics();
}
assert.deepEqual(replayGate(), replayGate(), 'gate arbitration must be deterministic');

// 4d. A hostile snapshot cannot inject non-finite weights or an unknown model.
const hostileGate = new WorldModelEvidenceGate();
hostileGate.restore({ continuityWeight01: Number.NaN, embodiedWeight01: 9, modelErrors01: [Number.POSITIVE_INFINITY, -3], actionAdvantage01: [Number.NaN, 99], selectedModel: 'gpt' });
const hostileMetrics = hostileGate.metrics();
assert.ok(Number.isFinite(hostileMetrics.continuityWeight01) && hostileMetrics.continuityWeight01 >= 0 && hostileMetrics.continuityWeight01 <= 1);
assert.ok(hostileMetrics.embodiedWeight01 <= 1);
assert.equal(hostileMetrics.modelErrors01.length, 2);
assert.ok(hostileMetrics.modelErrors01.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
assert.equal(hostileMetrics.actionAdvantage01.length, ACTIONS.length);
assert.ok(hostileMetrics.actionAdvantage01.every(v => Number.isFinite(v) && Math.abs(v) <= .2));
assert.equal(hostileMetrics.selectedModel, 'blend');


// 4e. Competing hypotheses: rejection is binding, not advisory.
const hypo = new B283CompetingPredictiveHypotheses();
const latent = Array.from({ length: 16 }, (_, i) => Math.sin(i * .3));
const hypoInput = (tick) => ({ tick, globalLatent: latent, selfLatent: latent, worldLatent: latent, goalVector: latent, memoryLatent: latent, reward01: .5, predictionError01: .2, uncertainty01: .3, autonomy01: .6, learningEnabled: true });
for (let tick = 1; tick <= 20; tick++) hypo.step(hypoInput(tick));
const rejected = hypo.rejectActive();
assert.equal(rejected.rejected, true);
const rejectedId = rejected.hypothesisId;
assert.equal(hypo.snapshot().hypotheses[rejectedId].status, 'rejected');
assert.notEqual(hypo.snapshot().activeHypothesisId, rejectedId, 'the active pointer must move off a rejected hypothesis');
for (let tick = 21; tick <= 40; tick++) {
  const out = hypo.step(hypoInput(tick));
  assert.notEqual(out.hypothesisId, rejectedId, 'a rejected hypothesis must not win the next step');
}
const commitAttempt = hypo.commitActive();
if (commitAttempt.committed) assert.notEqual(commitAttempt.hypothesisId, rejectedId, 'a rejected hypothesis must never be committed');
else assert.ok(['insufficient-evidence', 'hypothesis-not-active'].includes(commitAttempt.reason));

// 4f. Recovery: an explicitly re-opened hypothesis may compete again.
const reopened = hypo.reopenHypothesis(rejectedId);
assert.equal(reopened.reopened, true);
assert.equal(hypo.snapshot().hypotheses[rejectedId].status, 'active');

// 4g. A hostile hypothesis snapshot cannot crash or smuggle an out-of-range pointer.
const hostileHypo = new B283CompetingPredictiveHypotheses();
hostileHypo.restore({
  hypotheses: Array.from({ length: 40 }, () => ({ latent: [1, 2], predictor: 'x', status: 'garbage', posterior01: Number.NaN })),
  activeHypothesisId: 999, committedHypothesisId: -5, previousCommittedHypothesisId: 7.5,
  globalLatent: [Number.NaN], plannedSequence: ['explode'], plannedReturn01: 9,
});
const hostileHypoState = hostileHypo.snapshot();
assert.equal(hostileHypoState.hypotheses.length, 4);
assert.ok(hostileHypoState.activeHypothesisId >= 0 && hostileHypoState.activeHypothesisId < 4);
assert.equal(hostileHypoState.committedHypothesisId, null);
assert.equal(hostileHypoState.previousCommittedHypothesisId, null);
assert.deepEqual(hostileHypoState.plannedSequence, []);
assert.ok(Number.isFinite(hostileHypo.actionBias('explore')), 'action bias must stay finite after a corrupt restore');

// 4i. Prediction-vs-observation: the competitor must score its own forecast
//     against the next observation (previously `predictedNext` was write-only).
const predictor = new B283CompetingPredictiveHypotheses();
const stableLatent = Array.from({ length: 16 }, (_, i) => Math.sin(i * .3));
let firstObservationError = null;
let lastObservationError = null;
for (let tick = 1; tick <= 80; tick++) {
  const out = predictor.step({ tick, globalLatent: stableLatent, selfLatent: stableLatent, worldLatent: stableLatent, goalVector: stableLatent, memoryLatent: stableLatent, reward01: .6, predictionError01: .2, uncertainty01: .3, autonomy01: .6, learningEnabled: true });
  if (tick === 3) firstObservationError = out.observationError01;
  if (tick === 80) lastObservationError = out.observationError01;
  assert.ok(Number.isFinite(out.observationError01) && out.observationError01 >= 0 && out.observationError01 <= 1);
}
assert.ok(firstObservationError !== null && lastObservationError !== null);
assert.ok(predictor.snapshot().predictionComparisons >= 78, 'every step after the first must compare a forecast');
assert.ok(lastObservationError <= firstObservationError, 'a stable observation must not increase forecast error');
const perHypothesis = predictor.snapshot().hypotheses.map(h => h.lastError01);
assert.ok(Math.max(...perHypothesis) - Math.min(...perHypothesis) > .1, 'hypotheses must be scored individually');
assert.ok(Number.isFinite(predictor.snapshot().calibrationError01));
// Forecasts + counters survive a restart.
const predictorRestored = new B283CompetingPredictiveHypotheses();
predictorRestored.restore(structuredClone(predictor.snapshot()));
assert.deepEqual(predictorRestored.snapshot().pendingPredictions, predictor.snapshot().pendingPredictions);
assert.equal(predictorRestored.snapshot().predictionComparisons, predictor.snapshot().predictionComparisons);
const resumed = predictorRestored.step({ tick: 81, globalLatent: stableLatent, selfLatent: stableLatent, worldLatent: stableLatent, goalVector: stableLatent, memoryLatent: stableLatent, reward01: .6, predictionError01: .2, uncertainty01: .3, autonomy01: .6, learningEnabled: true });
assert.ok(resumed.predictionComparisons > predictor.snapshot().predictionComparisons, 'comparison must resume after restart');

// 4h. P81 attention must not crash or emit NaN on malformed candidates.
const p81 = new P81PredictiveAttention();
const p81Out = p81.evaluate({ tick: 1, candidates: [{ action: 'explore', score: Number.NaN, predictedUtility: 1, confidence: 1 }, null, { score: 1 }], uncertainty01: Number.NaN, predictionError01: -4, goalPressure01: Number.NaN, noveltyPressure01: 2, attentionBudget01: Number.NaN, externalInput: false });
assert.equal(p81Out.selectedAction, 'explore');
assert.ok(Number.isFinite(p81Out.expectedInformationGain01));
const emptyP81 = new P81PredictiveAttention().evaluate({ tick: 1, candidates: undefined, uncertainty01: .5, predictionError01: .5, goalPressure01: .5, noveltyPressure01: .5, attentionBudget01: .5, externalInput: false });
assert.equal(emptyP81.selectedAction, 'wait');
p81.restore({ cycles: -3, selectedAction: 7, uncertainty01: Number.NaN, recentFocus: ['ok', 5, null] });
assert.equal(p81.snapshot().cycles, 0);
assert.equal(p81.snapshot().selectedAction, 'wait');
assert.deepEqual(p81.snapshot().recentFocus, ['ok']);
assert.ok(Number.isFinite(p81.actionBias('verify')));


console.log(JSON.stringify({ pass: true, sections: 3, allocations: traceA.length + 6, workspace: { capacity: bounded.capacity, competitors: bounded.competitors } }));
