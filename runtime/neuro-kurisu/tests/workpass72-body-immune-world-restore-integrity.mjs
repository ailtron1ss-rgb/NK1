import assert from 'node:assert/strict';
import { MultimodalSituationModel, defaultMultimodalSituation } from '../src/organism/body/MultimodalSituationModel.ts';
import { CognitiveImmuneSystem, defaultCognitiveImmune } from '../src/organism/cognition/CognitiveImmuneSystem.ts';
import { RegretEngine, defaultRegretState } from '../src/organism/developmental/RegretEngine.ts';
import { SemanticScarEngine, defaultSemanticScarState } from '../src/organism/developmental/SemanticScarEngine.ts';
import { PredictionDebtEngine, defaultPredictionDebt } from '../src/organism/system/PredictionDebt.ts';
import { MetaCognitiveMonitor, defaultMetaCognitiveState } from '../src/organism/cognition/MetaCognitiveMonitor.ts';
import { P81PredictiveAttention, defaultP81 } from '../src/organism/cognition/P81PredictiveAttention.ts';
import { ActiveInferenceEngine, defaultActiveInferenceState } from '../src/organism/world/ActiveInferenceEngine.ts';
import { IdentityContinuityEngine, defaultIdentityContinuity } from '../src/organism/cognition/IdentityContinuity.ts';
import { SelfPredictionBenchmark, defaultSelfPredictionBenchmark } from '../src/organism/system/SelfPredictionBenchmark.ts';

/**
 * WorkPass72 — body / immune / developmental / world restore integrity. Each
 * owner merged a persisted snapshot with a bare spread, so NaN and unbounded
 * counters reached modality reliability, immune trust, regret history, semantic
 * scars, prediction debt, metacognition, attention selection and identity
 * continuity anchors.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);
const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- MultimodalSituationModel ----------------------------------------------
{
  const m = new MultimodalSituationModel();
  m.restore({ version: 1, situations: NaN, last: { version: 1, at: -1, modalities: ['text', 'bogus'], features: [1, NaN], confidence01: 9, uncertainty01: -1, conflict01: NaN, novelty01: 9, summary: 5 }, modalityReliability: { text: 9, vision: -1, bogus: 1 }, crossModalAgreements: -1, crossModalConflicts: NaN });
  const st = m.snapshot();
  assert.equal(st.situations, 0, 'situation NaN count -> 0');
  assert.equal(st.crossModalAgreements, 0, 'situation negative agreements -> 0');
  assert.equal(st.crossModalConflicts, 0, 'situation NaN conflicts -> 0');
  assert.equal(st.modalityReliability.text, 1, 'situation over-1 reliability -> 1');
  assert.equal(st.modalityReliability.vision, 0, 'situation negative reliability -> 0');
  assert.equal(st.modalityReliability.sensor, .55, 'situation missing modality -> default');
  assert.deepEqual(st.last.modalities, ['text'], 'situation drops unknown modality');
  assert.deepEqual(st.last.features, [1, 0], 'situation coerces NaN feature');
  assert.equal(st.last.confidence01, 1, 'situation over-1 confidence -> 1');
  assert.equal(st.last.uncertainty01, 0, 'situation negative uncertainty -> 0');
  assert.equal(st.last.summary, '', 'situation non-string summary -> empty');
  assert.doesNotThrow(() => m.restore(hostile('last')));
  m.restore(defaultMultimodalSituation());
  assert.deepEqual(m.snapshot(), defaultMultimodalSituation(), 'situation default round-trips');
}

// --- CognitiveImmuneSystem --------------------------------------------------
{
  const ci = new CognitiveImmuneSystem();
  ci.restore({ trustedSources: { system: 9, model: -1 }, quarantine: [{ id: 'q1', source: 5, reason: 5, payloadHash: 5, at: -1 }, { source: 'x' }], rejectedCount: -1, validatedCount: NaN, reviewQueue: [{ id: 'r1', status: 'bogus', confidence01: 9, evidence01: -1, contradiction01: NaN, identityCritical: 1, at: -1 }, { status: 'review' }], reviewedCount: Infinity });
  const st = ci.snapshot();
  assert.equal(st.trustedSources.system, 1, 'immune over-1 trust -> 1');
  assert.equal(st.trustedSources.model, 0, 'immune negative trust -> 0');
  assert.equal(st.trustedSources.user, .72, 'immune preserves default trust');
  assert.equal(st.quarantine.length, 1, 'immune drops quarantine without id');
  assert.equal(st.quarantine[0].source, 'unknown', 'immune non-string source -> unknown');
  assert.equal(st.quarantine[0].at, 0, 'immune negative at -> 0');
  assert.equal(st.rejectedCount, 0, 'immune negative rejected -> 0');
  assert.equal(st.validatedCount, 0, 'immune NaN validated -> 0');
  assert.equal(st.reviewedCount, 0, 'immune Infinity reviewed -> 0');
  assert.equal(st.reviewQueue.length, 1, 'immune drops review without id');
  assert.equal(st.reviewQueue[0].status, 'review', 'immune unknown status -> review');
  assert.equal(st.reviewQueue[0].confidence01, 1, 'immune over-1 confidence -> 1');
  assert.equal(st.reviewQueue[0].evidence01, 0, 'immune negative evidence -> 0');
  assert.doesNotThrow(() => ci.restore(hostile('trustedSources')));
  ci.restore(defaultCognitiveImmune());
  assert.deepEqual(ci.snapshot(), defaultCognitiveImmune(), 'immune default round-trips');
}

// --- RegretEngine -----------------------------------------------------------
{
  const r = new RegretEngine();
  r.restore({ records: [{ id: 'r1', at: -1, chosen: 5, alternative: 5, chosenOutcome: 9, counterfactualOutcome: -1, regret: NaN, learning: 5 }, { at: 1 }], meanRegret: 9, lastAt: NaN, version: 9 });
  const st = r.snapshot();
  assert.equal(st.records.length, 1, 'regret drops rows without id');
  assert.equal(st.records[0].at, 0, 'regret negative at -> 0');
  assert.equal(st.records[0].chosenOutcome, 1, 'regret over-1 outcome -> 1');
  assert.equal(st.records[0].counterfactualOutcome, 0, 'regret negative outcome -> 0');
  assert.equal(st.records[0].regret, 0, 'regret NaN -> 0');
  assert.equal(st.records[0].learning, '', 'regret non-string learning -> empty');
  assert.equal(st.meanRegret, 1, 'regret over-1 mean -> 1');
  assert.equal(st.lastAt, 0, 'regret NaN lastAt -> 0');
  assert.equal(st.version, 1, 'regret version pinned');
  assert.doesNotThrow(() => r.restore(hostile('records')));
  r.restore(defaultRegretState());
  assert.deepEqual(r.snapshot(), defaultRegretState(), 'regret default round-trips');
}

// --- SemanticScarEngine -----------------------------------------------------
{
  const s = new SemanticScarEngine();
  s.restore({ scars: [{ id: 's1', trigger: 'x', policy: 5, confidence: 9, createdAt: -1, uses: -3 }, { id: 's2', trigger: '   ' }, { trigger: 'no-id' }], version: 9 });
  const st = s.snapshot();
  assert.equal(st.scars.length, 1, 'scar drops rows without id/trigger');
  assert.equal(st.scars[0].policy, '', 'scar non-string policy -> empty');
  assert.equal(st.scars[0].confidence, 1, 'scar over-1 confidence -> 1');
  assert.equal(st.scars[0].createdAt, 0, 'scar negative createdAt -> 0');
  assert.equal(st.scars[0].uses, 0, 'scar negative uses -> 0');
  assert.equal(st.version, 1, 'scar version pinned');
  assert.doesNotThrow(() => s.restore(hostile('scars')));
  s.restore(defaultSemanticScarState());
  assert.deepEqual(s.snapshot(), defaultSemanticScarState(), 'scar default round-trips');
}

// --- PredictionDebtEngine ---------------------------------------------------
{
  const pd = new PredictionDebtEngine();
  pd.restore({ version: 1, records: [{ predictionId: 'p1', kind: 'bogus', createdTick: -1, dueTick: NaN, priority01: 9, status: 'bogus', resolvedAt: -1, ageTicks: -1 }, { kind: 'reward' }], openCount: 999, agingCount: 999, expiredCount: 999, meanPriority01: 9, lastAt: NaN });
  const st = pd.snapshot();
  assert.equal(st.records.length, 1, 'debt drops rows without predictionId');
  assert.equal(st.records[0].kind, 'reward', 'debt unknown kind -> reward');
  assert.equal(st.records[0].status, 'open', 'debt unknown status -> open');
  assert.equal(st.records[0].createdTick, 0, 'debt negative createdTick -> 0');
  assert.equal(st.records[0].dueTick, 0, 'debt NaN dueTick -> 0');
  assert.equal(st.records[0].priority01, 1, 'debt over-1 priority -> 1');
  assert.equal(st.records[0].resolvedAt, 0, 'debt negative resolvedAt -> 0');
  assert.equal(st.openCount, 1, 'debt recount open from records, not stored');
  assert.equal(st.agingCount, 0, 'debt recount aging from records');
  assert.equal(st.expiredCount, 0, 'debt recount expired from records');
  finite(st.meanPriority01, 'debt mean priority');
  assert.equal(st.lastAt, 0, 'debt NaN lastAt -> 0');
  assert.doesNotThrow(() => pd.restore(hostile('records')));
  pd.restore(defaultPredictionDebt());
  assert.deepEqual(pd.snapshot(), defaultPredictionDebt(), 'debt default round-trips');
}

// --- MetaCognitiveMonitor ---------------------------------------------------
{
  const mc = new MetaCognitiveMonitor();
  mc.restore({ version: 1, confidenceOfConfidence: NaN, uncertaintyAboutDecision: 9, predictionCalibration: -1, metacognitiveAccuracy: NaN, knownUnknowns: 5, revisionReadiness: NaN, samples: -3, updatedAt: NaN });
  const st = mc.snapshot();
  assert.equal(st.confidenceOfConfidence, .5, 'metacog NaN -> default');
  assert.equal(st.uncertaintyAboutDecision, 1, 'metacog over-1 -> 1');
  assert.equal(st.predictionCalibration, 0, 'metacog negative -> 0');
  assert.equal(st.metacognitiveAccuracy, .5, 'metacog NaN accuracy -> default');
  assert.equal(st.samples, 0, 'metacog negative samples -> 0');
  assert.equal(st.updatedAt, 0, 'metacog NaN updatedAt -> 0');
  finite(mc.snapshot().confidenceOfConfidence, 'metacog c-of-c');
  assert.doesNotThrow(() => mc.restore(hostile('samples')));
  mc.restore(defaultMetaCognitiveState());
  assert.deepEqual(mc.snapshot(), defaultMetaCognitiveState(), 'metacog default round-trips');
}

// --- P81PredictiveAttention -------------------------------------------------
{
  const p = new P81PredictiveAttention();
  p.restore({ version: 1, cycles: -1, selectedAction: 'bogus', attentionFocus: 5, expectedInformationGain01: NaN, exploitation01: 9, exploration01: -1, uncertainty01: NaN, recentFocus: ['a', 5, null] });
  const st = p.snapshot();
  assert.equal(st.cycles, 0, 'p81 negative cycles -> 0');
  assert.equal(st.selectedAction, 'wait', 'p81 unknown action -> default');
  assert.equal(st.attentionFocus, 'none', 'p81 non-string focus -> default');
  assert.equal(st.expectedInformationGain01, .2, 'p81 NaN eig -> default');
  assert.equal(st.exploitation01, 1, 'p81 over-1 exploitation -> 1');
  assert.equal(st.exploration01, 0, 'p81 negative exploration -> 0');
  assert.deepEqual(st.recentFocus, ['a'], 'p81 drops non-string focus entries');
  assert.doesNotThrow(() => p.restore(hostile('cycles')));
  p.restore(defaultP81());
  assert.deepEqual(p.snapshot(), defaultP81(), 'p81 default round-trips');
}

// --- ActiveInferenceEngine --------------------------------------------------
{
  const a = new ActiveInferenceEngine();
  a.restore({ version: 1, lastAction: 'bogus', lastScore: NaN, epistemicWeight: 9, pragmaticWeight: -1, updatedAt: -1 });
  const st = a.snapshot();
  assert.equal(st.lastAction, 'none', 'active-inference unknown action -> none');
  assert.equal(st.lastScore, 0, 'active-inference NaN score -> 0');
  assert.equal(st.epistemicWeight, 1, 'active-inference over-1 weight -> 1');
  assert.equal(st.pragmaticWeight, 0, 'active-inference negative weight -> 0');
  assert.equal(st.updatedAt, 0, 'active-inference negative updatedAt -> 0');
  assert.doesNotThrow(() => a.restore(hostile('epistemicWeight')));
  a.restore(defaultActiveInferenceState());
  assert.deepEqual(a.snapshot(), defaultActiveInferenceState(), 'active-inference default round-trips');
}

// --- IdentityContinuityEngine ----------------------------------------------
{
  const ic = new IdentityContinuityEngine();
  ic.restore({ version: 1, continuity: NaN, stability: 9, drift: -1, selfNarrativeFingerprint: 5, valueDistance: NaN, goalContinuity: 9, memoryContinuity: -1, authorshipContinuity: NaN, lastAt: -1, samples: -3, anchorValues: [NaN, 9, -1], anchorGoals: ['a', 5, ''], anchorMemories: ['m', 5] });
  const st = ic.snapshot();
  assert.equal(st.continuity, .88, 'identity NaN continuity -> default');
  assert.equal(st.stability, 1, 'identity over-1 stability -> 1');
  assert.equal(st.drift, 0, 'identity negative drift -> 0');
  assert.equal(st.selfNarrativeFingerprint, '', 'identity non-string fingerprint -> default');
  assert.equal(st.authorshipContinuity, .5, 'identity NaN authorship -> default');
  assert.equal(st.lastAt, 0, 'identity negative lastAt -> 0');
  assert.equal(st.samples, 0, 'identity negative samples -> 0');
  assert.deepEqual(st.anchorValues, [0, 1, 0], 'identity clamps anchor values');
  assert.deepEqual(st.anchorGoals, ['a'], 'identity drops non-string/empty goals');
  assert.deepEqual(st.anchorMemories, ['m'], 'identity drops non-string memories');
  assert.doesNotThrow(() => ic.restore(hostile('anchorValues')));
  ic.restore(defaultIdentityContinuity());
  assert.deepEqual(ic.snapshot(), defaultIdentityContinuity(), 'identity default round-trips');
}

// --- SelfPredictionBenchmark ------------------------------------------------
{
  const sp = new SelfPredictionBenchmark();
  sp.restore({ version: 2, samples: -1, accuracy01: NaN, meanBrier01: 9, calibrationGap01: -1, recentErrors: [NaN, 9, -1], horizonCounts: { next: -1, 'x': NaN }, lastAt: NaN, pending: [{ createdTick: -1, dueTick: NaN, predicted: 'x', confidence01: 9, horizon: 5, createdAt: -1 }, { confidence01: 1 }] });
  const st = sp.snapshot();
  assert.equal(st.version, 2, 'self-pred version pinned');
  assert.equal(st.samples, 0, 'self-pred negative samples -> 0');
  assert.equal(st.accuracy01, .5, 'self-pred NaN accuracy -> default');
  assert.equal(st.meanBrier01, 1, 'self-pred over-1 brier -> 1');
  assert.equal(st.calibrationGap01, 0, 'self-pred negative gap -> 0');
  assert.deepEqual(st.recentErrors, [0, 1, 0], 'self-pred clamps recent errors');
  assert.equal(st.horizonCounts.next, 0, 'self-pred negative horizon count -> 0');
  assert.equal(st.horizonCounts.x, 0, 'self-pred NaN horizon count -> 0');
  assert.equal(st.lastAt, 0, 'self-pred NaN lastAt -> 0');
  assert.equal(st.pending.length, 1, 'self-pred drops pending without predicted string');
  assert.equal(st.pending[0].createdTick, 0, 'self-pred negative createdTick -> 0');
  assert.equal(st.pending[0].dueTick, 0, 'self-pred NaN dueTick -> 0');
  assert.equal(st.pending[0].confidence01, 1, 'self-pred over-1 confidence -> 1');
  assert.equal(st.pending[0].horizon, '1', 'self-pred non-string horizon -> default');
  assert.doesNotThrow(() => sp.restore(hostile('pending')));
  sp.restore(defaultSelfPredictionBenchmark());
  assert.deepEqual(sp.snapshot(), defaultSelfPredictionBenchmark(), 'self-pred default round-trips');
}

console.log('WORKPASS72_BODY_IMMUNE_WORLD_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['MultimodalSituationModel', 'CognitiveImmuneSystem', 'RegretEngine', 'SemanticScarEngine', 'PredictionDebtEngine', 'MetaCognitiveMonitor', 'P81PredictiveAttention', 'ActiveInferenceEngine', 'IdentityContinuityEngine', 'SelfPredictionBenchmark'] }));
