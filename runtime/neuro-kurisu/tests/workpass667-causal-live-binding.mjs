import assert from 'node:assert/strict';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

// The live OrganismCore cycle increments the world tick before it records the
// decision trace, so a real trace carries tick === stateAfter.tick while its
// pre-action snapshot keeps tick-1. The causal stream must accept that binding;
// otherwise every live outcome is silently discarded and no causal learning is
// ever minted. This regresses the WorkPass283 pre-action binding guard without
// reopening the old hole (an unrelated/old trace paired with a newer transition).
const mkState = (tick, overrides = {}) => ({
  tick, at: 1000 + tick, predictionError: .6, attentionBudget: .8, selfPredictionError: .2, autonomyScore: .6,
  needs: { energy: .7, cognitiveLoad: .3, uncertainty: .65, novelty: .7, goalPressure: .6, socialNeed: .4, identityCoherence: .82 },
  ...overrides,
});

const stream = new CausalExperienceStream(16);
const liveTrace = {
  id: 'wp667-live-trace', tick: 1, createdAt: 1000, candidates: [],
  selected: { action: 'explore', goalId: 'goal-1', predictedUtility: .6, confidence: .7, predictedCost: .3, reasons: [] },
  stateBefore: mkState(0), reasoningSignals: {}, userRequestedAction: null, autonomousOverride: true, predictedOutcomes: [],
};
const after = mkState(1, { lastAction: 'explore', lastActionSuccess: .8, needs: { ...mkState(0).needs, energy: .55 } });
const record = stream.recordOutcome(liveTrace, after, { reward01: .8, success01: .8, surprise01: .7, novelty01: .75 });
assert.ok(record, 'a live-cycle trace (tick === stateAfter.tick) must mint causal evidence');
assert.ok(record.causalStrength01 > .3);

// Restore is a persistence trust boundary: accessors and sparse arrays must not
// execute user code or turn malformed vectors into trusted causal outcomes.
const accessorRecord = { ...record, traceId: 'wp667-accessor-record' };
Object.defineProperty(accessorRecord, 'reward01', {
  get() { throw new Error('persisted getter must not execute'); },
});
const sparsePolicyRecord = {
  ...record,
  id: 'cx-sparse-policy',
  traceId: 'wp667-sparse-policy',
  policyFeatures01: new Array(16),
};
const hardenedRestore = new CausalExperienceStream(16);
assert.doesNotThrow(() => hardenedRestore.restore({
  observations: Number.MAX_SAFE_INTEGER + 1,
  records: [record, accessorRecord, sparsePolicyRecord],
  recordedTraceIds: new Array(2),
}));
const hardenedSnapshot = hardenedRestore.snapshot();
assert.equal(hardenedSnapshot.observations, 0, 'unsafe persisted counters must reset');
assert.equal(hardenedSnapshot.records.length, 2, 'accessor-backed records must be dropped while safe rows remain');
assert.equal(hardenedSnapshot.outcomes, 1, 'only bounded runtime-grounded records count as outcomes');
const quarantinedSparse = hardenedSnapshot.records.find((row) => row.traceId === 'wp667-sparse-policy');
assert.ok(quarantinedSparse);
assert.equal(quarantinedSparse.provenance, 'external');
assert.equal(quarantinedSparse.stateGrounded, false);
assert.equal(quarantinedSparse.replayEligible, false);
const throwingSnapshot = {};
Object.defineProperty(throwingSnapshot, 'records', { get() { throw new Error('snapshot getter must not execute'); } });
const emptyRestore = new CausalExperienceStream(16);
assert.doesNotThrow(() => emptyRestore.restore(throwingSnapshot));
assert.equal(emptyRestore.snapshot().records.length, 0);

// The pre-action convention (trace.tick === stateBefore.tick) must keep working.
const replayTrace = { ...liveTrace, id: 'wp667-replay-trace', tick: 0 };
const replayRecord = stream.recordOutcome(replayTrace, mkState(1, { lastAction: 'explore', lastActionSuccess: .8 }), { reward01: .8, success01: .8, surprise01: .7, novelty01: .75 });
assert.ok(replayRecord, 'a pre-action-bound trace must still mint causal evidence');

// A trace from neither the pre-action nor the produced tick is still rejected.
const unrelated = { ...liveTrace, id: 'wp667-unrelated', tick: 7 };
assert.equal(stream.recordOutcome(unrelated, mkState(1, { lastAction: 'explore', lastActionSuccess: .8 }), { reward01: .8, success01: .8, surprise01: .7, novelty01: .75 }), null,
  'a trace outside the observed transition must never be paired with it');

// The state records the observed (unscaled) success while learning may pass a
// scaled success label; the attribution check must compare like-for-like.
const scaledStream = new CausalExperienceStream(16);
const scaled = scaledStream.recordOutcome(
  { ...liveTrace, id: 'wp667-scaled' },
  mkState(1, { lastAction: 'explore', lastActionSuccess: .82 }),
  { reward01: .564, success01: .564, surprise01: .7, novelty01: .75, observedSuccess01: .82 },
);
assert.ok(scaled, 'a learning-scaled success label with the true observed success must be accepted');
assert.equal(scaledStream.recordOutcome(
  { ...liveTrace, id: 'wp667-scaled-mismatch' },
  mkState(1, { lastAction: 'explore', lastActionSuccess: .82 }),
  { reward01: .564, success01: .564, surprise01: .7, novelty01: .75, observedSuccess01: .2 },
), null, 'a label that disagrees with the observed success must be rejected');

// End-to-end: a real organism cycle must actually produce a causal outcome, and
// the outcome must survive checkpoint and restore.
const store = new MemoryStateStore();
const core = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0, checkpointMaxDirtyCycles: 1 });
await core.init();
const cycles = [];
for (let i = 0; i < 3; i++) {
  const cycle = await core.observe({ text: `causal binding cycle ${i}`, surprise: .6, novelty: .65 }, 'operational');
  cycles.push(cycle.decision?.tick);
  await core.feedback({ success: .82, reward: .84, surprise: .28 });
}
const liveSummary = core.causalExperienceSummary();
assert.ok(liveSummary.outcomes >= 1, `the live cycle must mint causal outcomes (got ${liveSummary.outcomes})`);
assert.ok(liveSummary.records >= 1, `the live cycle must retain causal records (got ${liveSummary.records})`);
assert.ok(liveSummary.rolling.causalStrength01 > 0, 'live causal strength must be a real signal, not zero drift');
await core.flush();
const restored = new OrganismCore(new MemoryStateStore({ initial: await store.load() }), { cycleResultMode: 'operational', checkpointMinIntervalMs: 0, checkpointMaxDirtyCycles: 1 });
await restored.init();
assert.ok(restored.causalExperienceSummary().outcomes >= 1, 'live causal outcomes must survive restart');
await restored.flush();

console.log('WORKPASS667_CAUSAL_LIVE_BINDING=PASS', JSON.stringify({
  decisionTicks: cycles,
  liveOutcomes: liveSummary.outcomes,
  liveRecords: liveSummary.records,
  causalStrength01: Number(liveSummary.rolling.causalStrength01.toFixed(4)),
  restoredOutcomes: restored.causalExperienceSummary().outcomes,
}));
