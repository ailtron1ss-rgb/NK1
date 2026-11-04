import assert from 'node:assert/strict';
import { BoredomExplorer, defaultBoredom } from '../src/organism/cognition/BoredomExplorer.ts';
import { ContradictionReservoir, defaultContradictionReservoir } from '../src/organism/cognition/ContradictionReservoir.ts';
import { CognitiveBudgetManager, defaultCognitiveBudget } from '../src/organism/cognition/CognitiveBudgetManager.ts';
import { VerifiedSyntheticTrajectoryGate, defaultVerifiedSyntheticTrajectoryGate } from '../src/organism/cognition/VerifiedSyntheticTrajectoryGate.ts';
import { ModelSwitchBenchmark, defaultModelSwitchBenchmark } from '../src/organism/system/ModelSwitchBenchmark.ts';
import { ModelOlympics, defaultModelOlympics } from '../src/organism/system/ModelOlympics.ts';
import { DerivedWorldPreviewCache, defaultDerivedWorldPreviewCache } from '../src/organism/system/DerivedWorldPreviewCache.ts';
import { CognitiveFieldEngine, defaultCognitiveField } from '../src/organism/cognition/CognitiveField.ts';

/**
 * WorkPass72 — cognition-core and prediction-cache restore integrity. These
 * owners merged persisted snapshots with a bare spread, so NaN reached emotion
 * pressure, cognitive budget modes, boredom cadence, model scores and cached
 * world previews used on the hot decision path.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);
const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- BoredomExplorer --------------------------------------------------------
{
  const b = new BoredomExplorer();
  b.restore({ boredom01: NaN, quietCycles: -3, explorationTriggers: Infinity, lastTriggerAt: -1, lastReason: 5, version: 9 });
  const st = b.snapshot();
  assert.equal(st.boredom01, 0, 'boredom NaN -> 0');
  assert.equal(st.quietCycles, 0, 'boredom negative cycles -> 0');
  assert.equal(st.explorationTriggers, 0, 'boredom Infinity triggers -> 0');
  assert.equal(st.lastTriggerAt, 0, 'boredom negative at -> 0');
  assert.equal(st.lastReason, 'initial', 'boredom non-string reason -> default');
  assert.equal(st.version, 1, 'boredom version pinned');
  assert.doesNotThrow(() => b.restore(hostile('boredom01')));
  b.restore(defaultBoredom());
  assert.deepEqual(b.snapshot(), defaultBoredom(), 'boredom default round-trips');
}

// --- ContradictionReservoir -------------------------------------------------
{
  const cr = new ContradictionReservoir();
  cr.restore({ claims: [{ id: 'c1', claim: 'x', confidence: NaN, status: 'bogus', evidenceIds: ['e', 2], alternatives: ['a', 'a'], createdAt: -1, updatedAt: NaN }, { claim: 'no-id' }, { id: 'c2', claim: '   ' }, null], unresolvedCount: 999 });
  const st = cr.snapshot();
  assert.equal(st.claims.length, 1, 'contradiction drops rows without id/claim');
  assert.equal(st.claims[0].confidence, .5, 'contradiction NaN confidence -> .5');
  assert.equal(st.claims[0].status, 'open', 'contradiction unknown status -> open');
  assert.deepEqual(st.claims[0].evidenceIds, ['e'], 'contradiction drops non-string evidence');
  assert.deepEqual(st.claims[0].alternatives, ['a'], 'contradiction dedups alternatives');
  assert.equal(st.claims[0].createdAt, 0, 'contradiction negative createdAt -> 0');
  assert.equal(st.claims[0].updatedAt, 0, 'contradiction NaN updatedAt -> 0');
  assert.equal(st.unresolvedCount, 1, 'contradiction recount from status, not stored');
  assert.doesNotThrow(() => cr.restore(hostile('claims')));
  cr.restore(defaultContradictionReservoir());
  assert.deepEqual(cr.snapshot(), defaultContradictionReservoir(), 'contradiction default round-trips');
}

// --- CognitiveBudgetManager -------------------------------------------------
{
  const cb = new CognitiveBudgetManager();
  cb.restore({ mode: 'bogus', available01: NaN, estimatedCost01: 9, expectedInformationGain01: -1, rationale: 7, updatedAt: NaN, spent01: 5, remaining01: NaN, operationCount: -2, informationGainRealized01: 4, lastOperation: 'nope', ledger: [{ at: -1, tick: NaN, operation: 'bogus', estimatedCost01: 9, spent01: NaN, informationGain01: -1, accepted: 1, mode: 'bogus', reason: 5 }, null] });
  const st = cb.snapshot();
  assert.equal(st.mode, 'shallow', 'budget unknown mode -> default');
  finite(st.available01, 'budget available');
  assert.equal(st.available01, .78, 'budget NaN available -> default');
  assert.equal(st.estimatedCost01, 1, 'budget over-1 cost -> 1');
  assert.equal(st.expectedInformationGain01, 0, 'budget negative gain -> 0');
  assert.equal(st.rationale, 'default', 'budget non-string rationale -> default');
  assert.equal(st.remaining01, 0, 'budget NaN remaining -> available-spent clamped');
  assert.equal(st.operationCount, 0, 'budget negative opCount -> 0');
  assert.equal(st.lastOperation, undefined, 'budget unknown lastOperation dropped');
  const ledger = cb.ledgerSnapshot();
  assert.equal(ledger.length, 1, 'budget drops null ledger row');
  assert.equal(ledger[0].operation, 'other', 'budget unknown op -> other');
  assert.equal(ledger[0].mode, 'shallow', 'budget ledger unknown mode -> shallow');
  assert.equal(ledger[0].spent01, 0, 'budget ledger NaN spent -> 0');
  assert.equal(ledger[0].at, 0, 'budget ledger negative at -> 0');
  assert.equal(ledger[0].reason, '', 'budget ledger non-string reason -> empty');
  assert.doesNotThrow(() => cb.restore(hostile('mode')));
  cb.restore(defaultCognitiveBudget());
  const { ledger: _l, ...rest } = cb.snapshot();
  assert.deepEqual(rest, defaultCognitiveBudget(), 'budget default round-trips');
}

// --- VerifiedSyntheticTrajectoryGate ---------------------------------------
{
  const g = new VerifiedSyntheticTrajectoryGate();
  g.restore({ version: 1, staged: NaN, confirmations: -1, promotions: Infinity, rejections: -2, expirations: NaN, pending: [{ id: 't1', stagedTick: NaN, contextId: -1, steps: [{ actionIndex: 99, latent: [1, NaN], predictedNext: 'x', reward01: NaN, confidence01: 9, priority01: -1 }], confirmations: -1, verifiedConfirmations: NaN, holdoutConfirmations: Infinity, mismatches: -1, lastObservedTick: NaN, status: 'bogus' }, { steps: [] }], lastPromotionId: 5, lastReason: 9 });
  const st = g.snapshot();
  assert.equal(st.staged, 0, 'vstg NaN staged -> 0');
  assert.equal(st.confirmations, 0, 'vstg negative confirmations -> 0');
  assert.equal(st.promotions, 0, 'vstg Infinity promotions -> 0');
  assert.equal(st.rejections, 0, 'vstg negative rejections -> 0');
  assert.equal(st.lastPromotionId, null, 'vstg non-string promotion id -> null');
  assert.equal(st.lastReason, 'init', 'vstg non-string reason -> default');
  assert.equal(st.pending.length, 1, 'vstg keeps only tickets with id+steps');
  const t = st.pending[0];
  assert.equal(t.stagedTick, 0, 'vstg NaN stagedTick -> 0');
  assert.equal(t.contextId, 0, 'vstg negative contextId -> 0');
  assert.equal(t.status, 'pending', 'vstg unknown status -> pending');
  assert.equal(t.confirmations, 0, 'vstg negative confirmations -> 0');
  assert.equal(t.holdoutConfirmations, 0, 'vstg Infinity holdout -> 0');
  const step = t.steps[0];
  assert.equal(step.actionIndex, 6, 'vstg actionIndex clamped to last action');
  assert.deepEqual(step.latent, [1, 0], 'vstg latent NaN coerced to 0');
  assert.deepEqual(step.predictedNext, [], 'vstg non-array predictedNext -> []');
  assert.equal(step.reward01, 0, 'vstg NaN reward -> 0');
  assert.equal(step.confidence01, 1, 'vstg over-1 confidence -> 1');
  assert.equal(step.priority01, 0, 'vstg negative priority -> 0');
  assert.doesNotThrow(() => g.restore(hostile('pending')));
  g.restore(defaultVerifiedSyntheticTrajectoryGate());
  assert.deepEqual(g.snapshot(), defaultVerifiedSyntheticTrajectoryGate(), 'vstg default round-trips');
}

// --- ModelSwitchBenchmark ---------------------------------------------------
{
  const mb = new ModelSwitchBenchmark();
  mb.restore({ version: 1, trials: NaN, accepted: -1, rejected: Infinity, lastDelta01: 9, history: [{ requestId: 'r1', backendA: 5, latencyAms: -1, latencyBms: NaN, semanticSimilarity01: 9, identityConsistency01: -1, constraintConsistency01: NaN, qualityA01: 9, qualityB01: -1, at: -1 }, { backendA: 'x' }, null] });
  const st = mb.snapshot();
  assert.equal(st.trials, 0, 'switch NaN trials -> 0');
  assert.equal(st.accepted, 0, 'switch negative accepted -> 0');
  assert.equal(st.rejected, 0, 'switch Infinity rejected -> 0');
  assert.equal(st.lastDelta01, 1, 'switch over-1 delta -> 1');
  assert.equal(st.history.length, 1, 'switch drops rows without requestId');
  const h = st.history[0];
  assert.equal(h.backendA, '', 'switch non-string backend -> empty');
  assert.equal(h.latencyAms, 0, 'switch negative latency -> 0');
  assert.equal(h.latencyBms, 0, 'switch NaN latency -> 0');
  assert.equal(h.semanticSimilarity01, 1, 'switch over-1 similarity -> 1');
  assert.equal(h.identityConsistency01, 0, 'switch negative identity -> 0');
  assert.equal(h.qualityA01, 1, 'switch over-1 quality -> 1');
  assert.equal(h.qualityB01, 0, 'switch negative quality -> 0');
  assert.equal(h.at, 0, 'switch negative at -> 0');
  assert.doesNotThrow(() => mb.restore(hostile('history')));
  mb.restore(defaultModelSwitchBenchmark());
  assert.deepEqual(mb.snapshot(), defaultModelSwitchBenchmark(), 'switch default round-trips');
}

// --- ModelOlympics ----------------------------------------------------------
{
  const mo = new ModelOlympics();
  mo.restore({ version: 1, scores: { m1: { correct: -1, total: NaN, brierSum: -5, meanBrier01: 9, accuracy01: -1 }, m2: 'junk' }, rounds: -1, winner: 5, lastAt: NaN });
  const st = mo.snapshot();
  assert.equal(st.rounds, 0, 'olympics negative rounds -> 0');
  assert.equal(st.winner, null, 'olympics non-string winner -> null');
  assert.equal(st.lastAt, 0, 'olympics NaN lastAt -> 0');
  const s = st.scores.m1;
  assert.equal(s.correct, 0, 'olympics negative correct -> 0');
  assert.equal(s.total, 0, 'olympics NaN total -> 0');
  assert.equal(s.brierSum, 0, 'olympics negative brierSum -> 0');
  assert.equal(s.meanBrier01, 1, 'olympics over-1 meanBrier -> 1');
  assert.equal(s.accuracy01, 0, 'olympics negative accuracy -> 0');
  finite(mo.calibrate('m1', .7), 'olympics calibrate stays finite');
  assert.doesNotThrow(() => mo.restore(hostile('scores')));
  mo.restore(defaultModelOlympics());
  assert.deepEqual(mo.snapshot(), defaultModelOlympics(), 'olympics default round-trips');
}

// --- DerivedWorldPreviewCache ----------------------------------------------
{
  const dc = new DerivedWorldPreviewCache();
  dc.restore({ version: 1, lastTick: NaN, lastWorldContextVersion: -1, lastUncertainty01: -1, refreshes: -1, hits: NaN, misses: Infinity, lastFutureAt: -1, lastWorldAt: NaN, worldPreview: { verify: { reward: 9, confidence: NaN, uncertainty: -1 } }, futurePreview: { path: [{ action: 'verify', reward: NaN, uncertainty: 9, confidence: -1 }, 5], expectedReward: NaN, uncertainty: 9, horizon: -1 } });
  const st = dc.snapshot();
  assert.equal(st.lastTick, -1, 'preview NaN lastTick -> default');
  assert.equal(st.lastWorldContextVersion, -1, 'preview negative context version -> default');
  assert.equal(st.refreshes, 0, 'preview negative refreshes -> 0');
  assert.equal(st.hits, 0, 'preview NaN hits -> 0');
  assert.equal(st.misses, 0, 'preview Infinity misses -> 0');
  assert.equal(st.lastFutureAt, 0, 'preview negative lastFutureAt -> 0');
  assert.equal(st.lastWorldAt, 0, 'preview NaN lastWorldAt -> 0');
  assert.equal(st.worldPreview.verify.reward, 1, 'preview over-1 reward -> 1');
  assert.equal(st.worldPreview.verify.confidence, 0, 'preview NaN confidence -> 0');
  assert.equal(st.worldPreview.verify.uncertainty, 0, 'preview negative uncertainty -> 0');
  assert.equal(st.futurePreview.path.length, 1, 'preview drops non-object path steps');
  assert.equal(st.futurePreview.path[0].reward, 0, 'preview NaN step reward -> 0');
  assert.equal(st.futurePreview.path[0].uncertainty, 1, 'preview over-1 step uncertainty -> 1');
  assert.equal(st.futurePreview.expectedReward, 0, 'preview NaN expectedReward -> 0');
  assert.equal(st.futurePreview.horizon, 0, 'preview negative horizon -> 0');
  assert.doesNotThrow(() => dc.restore(hostile('worldPreview')));
  dc.restore(defaultDerivedWorldPreviewCache());
  assert.deepEqual(dc.snapshot(), defaultDerivedWorldPreviewCache(), 'preview default round-trips');
}

// --- CognitiveFieldEngine ---------------------------------------------------
{
  const cf = new CognitiveFieldEngine();
  cf.restore({ arousal01: NaN, valence01: 9, uncertainty01: -1, salience01: NaN, conflict01: 2, socialPressure01: NaN, taskPressure01: -5, fatigue01: Infinity, coherence01: NaN, attentionDebt01: 9, unresolvedCount: -3, pressures: [{ id: 'p1', type: 'bogus', description: 5, level: NaN, decayRate: -1, createdAt: -1, lastActivatedAt: NaN, sourceIds: ['s', 2] }, { type: 'goal' }, null] });
  const st = cf.snapshot();
  assert.equal(st.arousal01, .42, 'field NaN arousal -> default');
  assert.equal(st.valence01, 1, 'field over-1 valence -> 1');
  assert.equal(st.uncertainty01, 0, 'field negative uncertainty -> 0');
  assert.equal(st.salience01, .25, 'field NaN salience -> default');
  assert.equal(st.conflict01, 1, 'field over-1 conflict -> 1');
  assert.equal(st.fatigue01, .18, 'field Infinity fatigue -> default');
  assert.equal(st.attentionDebt01, 1, 'field over-1 debt -> 1');
  assert.equal(st.unresolvedCount, 0, 'field negative unresolved -> 0');
  assert.equal(st.pressures.length, 1, 'field drops pressures without id');
  const p = st.pressures[0];
  assert.equal(p.type, 'curiosity', 'field unknown pressure type -> curiosity');
  assert.equal(p.description, '', 'field non-string description -> empty');
  assert.equal(p.level, 0, 'field NaN level -> 0');
  assert.equal(p.decayRate, 0, 'field negative decay -> 0');
  assert.deepEqual(p.sourceIds, ['s'], 'field drops non-string sourceIds');
  assert.doesNotThrow(() => cf.restore(hostile('pressures')));
  cf.restore(defaultCognitiveField());
  assert.deepEqual(cf.snapshot(), defaultCognitiveField(), 'field default round-trips');
}

console.log('WORKPASS72_COGNITION_CORE_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['BoredomExplorer', 'ContradictionReservoir', 'CognitiveBudgetManager', 'VerifiedSyntheticTrajectoryGate', 'ModelSwitchBenchmark', 'ModelOlympics', 'DerivedWorldPreviewCache', 'CognitiveFieldEngine'] }));
