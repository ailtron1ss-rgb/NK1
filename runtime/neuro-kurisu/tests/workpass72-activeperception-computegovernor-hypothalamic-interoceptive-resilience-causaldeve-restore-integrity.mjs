import assert from 'node:assert/strict';
import { ActivePerceptionExecutor, defaultActivePerceptionExecutor } from '../src/organism/system/ActivePerceptionExecutor.ts';
import { AdaptiveComputeGovernor, defaultAdaptiveComputeState } from '../src/organism/system/AdaptiveComputeGovernor.ts';
import { HypothalamicHomeostasisController, defaultHypothalamicHomeostasisState } from '../src/organism/system/HypothalamicHomeostasisController.ts';
import { InteroceptiveStateEstimator, defaultInteroceptiveState } from '../src/organism/system/InteroceptiveStateEstimator.ts';
import { AdvancedResilienceEngine, defaultAdvancedResilience } from '../src/organism/learning/AdvancedResilienceEngine.ts';
import { CausalDevelopmentLoop, defaultCausalDevelopmentLoop } from '../src/organism/learning/CausalDevelopmentLoop.ts';

/**
 * WorkPass72 — the system/homeostasis family: active perception executor,
 * adaptive compute governor, hypothalamic homeostasis, interoceptive state
 * estimator, advanced resilience engine and the causal development loop. Each
 * merged a persisted snapshot with a bare spread (or structuredClone), letting
 * NaN reach request/history rows, compute plans, homeostasis frames,
 * interoceptive frames, resilience records and causal samples.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- ActivePerceptionExecutor ------------------------------------------------
{
  const m = new ActivePerceptionExecutor();
  m.restore({ version: 1, proposed: -1, executed: NaN, expired: -1, lastInformationGain01: 9, meanGain01: -1, meanCost01: NaN, lastAt: -1, lastRequest: { id: 'r1', modality: 'bogus', reason: 5, expectedInformationGain01: 9, estimatedCost01: -1, priority01: 9, createdAt: -1, status: 'bogus' }, history: [{ id: 'h1', modality: 'bogus', gain01: 9, cost01: -1, executed: 'yes', at: -1 }, { gain01: 1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.proposed, 0, 'apx negative proposed -> 0');
  assert.equal(st.executed, 0, 'apx NaN executed -> 0');
  assert.equal(st.lastInformationGain01, 1, 'apx over-1 gain -> 1');
  assert.equal(st.meanGain01, 0, 'apx negative mean gain -> 0');
  assert.equal(st.meanCost01, 0, 'apx NaN mean cost -> 0');
  assert.equal(st.lastAt, 0, 'apx negative lastAt -> 0');
  assert.equal(st.lastRequest.modality, 'text', 'apx unknown modality -> text');
  assert.equal(st.lastRequest.reason, '', 'apx non-string reason -> empty');
  assert.equal(st.lastRequest.estimatedCost01, 0, 'apx negative cost -> 0');
  assert.equal(st.lastRequest.createdAt, 0, 'apx negative createdAt -> 0');
  assert.equal(st.lastRequest.status, 'proposed', 'apx unknown status -> proposed');
  assert.equal(st.history.length, 1, 'apx drops id-less history row');
  assert.equal(st.history[0].modality, 'text', 'apx unknown history modality -> text');
  assert.equal(st.history[0].gain01, 1, 'apx over-1 history gain -> 1');
  assert.equal(st.history[0].executed, false, 'apx truthy-string executed -> false');
  assert.equal(st.history[0].at, 0, 'apx negative history at -> 0');
  assert.doesNotThrow(() => m.restore(hostile('history')));
  const d = defaultActivePerceptionExecutor();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'apx default round-trips');
}

// --- AdaptiveComputeGovernor -------------------------------------------------
{
  const m = new AdaptiveComputeGovernor();
  m.restore({ version: 1, cycles: -1, lowBudgetCycles: NaN, highBudgetCycles: -1, estimatedWorkSaved01: 9, meanBudget01: -1, meanSparsity01: NaN, lastPlan: { budget01: 9, sparsity01: -1, workspaceScale01: NaN, maxCandidates: 99, reason: [5, 'ok', ''], estimatedWorkSaved01: 9 } });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'acg negative cycles -> 0');
  assert.equal(st.lowBudgetCycles, 0, 'acg NaN low budget -> 0');
  assert.equal(st.estimatedWorkSaved01, 1, 'acg over-1 saved -> 1');
  assert.equal(st.meanBudget01, 0, 'acg negative mean budget -> 0');
  assert.equal(st.meanSparsity01, .28, 'acg NaN mean sparsity -> default');
  assert.equal(st.lastPlan.budget01, 1, 'acg over-1 plan budget -> 1');
  assert.equal(st.lastPlan.sparsity01, 0, 'acg negative plan sparsity -> 0');
  assert.equal(st.lastPlan.workspaceScale01, 0, 'acg NaN workspace scale -> 0');
  assert.equal(st.lastPlan.maxCandidates, 12, 'acg out-of-range candidates -> 12');
  assert.deepEqual(st.lastPlan.reason, ['ok'], 'acg keeps only non-empty string reasons');
  assert.doesNotThrow(() => m.restore(hostile('lastPlan')));
  const d = defaultAdaptiveComputeState();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'acg default round-trips');
}

// --- HypothalamicHomeostasisController ---------------------------------------
{
  const m = new HypothalamicHomeostasisController();
  m.restore({ version: 1, ticks: -1, protectiveTicks: NaN, recoveryTicks: -1, meanEnergyReserve01: 9, meanThermalStress01: -1, meanAllostaticLoad01: NaN, predictedDemand01: 9, lastFrame: { energyReserve01: 9, thermalStress01: -1, allostaticLoad01: NaN, predictedDemand01: 9, motivationDrive01: -1, computeCap01: 9, plasticityCap01: -1, recoveryDrive01: 9, restorativePriority01: -1, reason: [5, 'ok', ''] } });
  const st = m.snapshot();
  assert.equal(st.ticks, 0, 'hypo negative ticks -> 0');
  assert.equal(st.protectiveTicks, 0, 'hypo NaN protective -> 0');
  assert.equal(st.meanEnergyReserve01, 1, 'hypo over-1 reserve -> 1');
  assert.equal(st.meanThermalStress01, 0, 'hypo negative stress -> 0');
  assert.equal(st.meanAllostaticLoad01, .2, 'hypo NaN load -> default');
  assert.equal(st.lastFrame.energyReserve01, 1, 'hypo over-1 frame reserve -> 1');
  assert.equal(st.lastFrame.thermalStress01, 0, 'hypo negative frame stress -> 0');
  assert.equal(st.lastFrame.motivationDrive01, 0, 'hypo negative motivation -> 0');
  assert.equal(st.lastFrame.computeCap01, 1, 'hypo over-1 compute cap -> 1');
  assert.deepEqual(st.lastFrame.reason, ['ok'], 'hypo keeps only string reasons');
  assert.doesNotThrow(() => m.restore(hostile('lastFrame')));
  const d = defaultHypothalamicHomeostasisState();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'hypo default round-trips');
}

// --- InteroceptiveStateEstimator --------------------------------------------
{
  const m = new InteroceptiveStateEstimator();
  m.restore({ version: 1, ticks: -1, meanPredictionError01: 9, meanUncertainty01: -1, meanConfidence01: NaN, prediction: { energy01: 9, thermal01: -1, load01: NaN, capacity01: 9 }, lastFrame: { latent: { energy01: 9, thermal01: -1, load01: NaN, capacity01: 9, recoveryNeed01: -1 }, predicted: { energy01: 9, thermal01: -1, load01: NaN, capacity01: 9 }, predictionError01: 9, attendedPredictionError01: 'x', uncertainty01: -1, salience01: 9, conflict01: -1, controlPressure01: 9, confidence01: -1, reason: [5, 'ok', ''] } });
  const st = m.snapshot();
  assert.equal(st.ticks, 0, 'intero negative ticks -> 0');
  assert.equal(st.meanPredictionError01, 1, 'intero over-1 error -> 1');
  assert.equal(st.meanUncertainty01, 0, 'intero negative uncertainty -> 0');
  assert.equal(st.meanConfidence01, .68, 'intero NaN confidence -> default');
  assert.equal(st.prediction.energy01, 1, 'intero over-1 prediction -> 1');
  assert.equal(st.prediction.thermal01, 0, 'intero negative prediction -> 0');
  assert.equal(st.lastFrame.latent.energy01, 1, 'intero over-1 latent -> 1');
  assert.equal(st.lastFrame.latent.recoveryNeed01, 0, 'intero negative recovery need -> 0');
  assert.equal(st.lastFrame.predicted.energy01, 1, 'intero over-1 predicted -> 1');
  assert.equal(st.lastFrame.predictionError01, 1, 'intero over-1 frame error -> 1');
  assert.equal(st.lastFrame.attendedPredictionError01, 1, 'intero non-finite attended -> frame error');
  assert.equal(st.lastFrame.salience01, 1, 'intero over-1 salience -> 1');
  assert.equal(st.lastFrame.conflict01, 0, 'intero negative conflict -> 0');
  assert.deepEqual(st.lastFrame.reason, ['ok'], 'intero keeps only string reasons');
  assert.ok(st.lastFrame.precisionAllocation01, 'intero frame keeps precision allocation');
  assert.equal(st.lastFrame.precisionAllocation01.budget01, 1, 'intero over-1 budget -> 1');
  assert.ok(['energy', 'thermal', 'cognitiveLoad', 'sleepPressure', 'none'].includes(st.lastFrame.precisionAllocation01.dominantChannel), 'intero dominant channel whitelisted');
  assert.doesNotThrow(() => m.restore(hostile('lastFrame')));
  const d = defaultInteroceptiveState();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'intero default round-trips');
}

// --- AdvancedResilienceEngine -----------------------------------------------
{
  const m = new AdvancedResilienceEngine();
  m.restore({ version: 1, cycles: -1,
    shadow: { comparisons: -1, divergence01: 9, meanRegret01: -1, lastAt: NaN, recent: [{ at: -1, contextKey: 5, actual: 'bogus', shadowBest: 'bogus', divergence: 9, regret01: -1 }, 'x'] },
    geneBank: { genes: [{ id: 'g1', createdAt: -1, label: 5, source: 'bogus', score01: 9, values: { k: { respond: { value: 9 }, bogus: { value: 1 } } } }, { label: 'x' }], activeGeneId: 5, restores: -1 },
    surpriseFirewall: { inspected: -1, quarantined: NaN, released: -1, rejected: NaN, recent: [{ id: 'q1', at: -1, reason: 5, input: 5, surprise01: 9, status: 'bogus', releasedAt: -1 }, 'x'] },
    evidenceDebt: { records: [{ id: 'e1', claim: 5, evidenceCount: -1, contradictions: NaN, confidence01: 9, priority01: -1, lastUpdatedAt: -1, status: 'bogus' }, 'x'], openCount: -1, verifiedCount: NaN, meanPriority01: 9 },
    modelSwap: { currentModel: 5, catalog: [{ model: 'm1', samples: -1, meanReward01: 9, calibration01: -1, latencyMs: -1, failures: NaN, lastAt: -1 }, 'x'], evaluations: -1, lastEvaluationAt: NaN },
    offlineSurvival: { languageFailures: -1, fallbackCycles: NaN, active: 'yes', lastBackend: 5, lastAt: -1 },
    dreamCompiler: { compiledSkills: [{ id: 's1', pattern: 5, action: 'bogus', uses: -1, meanSuccess01: 9, confidence01: -1, compiledAt: -1 }, 'x'], compilations: -1, lastAt: NaN },
    timeCapsules: { capsules: [{ id: 'c1', at: -1, title: 5, summary: 5, tick: -1, goals: [5, 'g', ''], actions: [5], changes: [5] }, 'x'], lastAt: -1, periodMs: -1 },
    counterfactualForks: { forks: [{ id: 'f1', at: -1, baseTraceId: 5, chosen: 'bogus', alternative: 'bogus', chosenUtility01: 9, alternativeUtility01: -1, predictedAdvantage01: 9 }, 'x'], evaluations: -1, lastAt: NaN } });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'res negative cycles -> 0');
  assert.equal(st.shadow.comparisons, 0, 'res negative comparisons -> 0');
  assert.equal(st.shadow.divergence01, 1, 'res over-1 divergence -> 1');
  assert.equal(st.shadow.lastAt, 0, 'res NaN lastAt -> 0');
  assert.equal(st.shadow.recent.length, 1, 'res drops non-object shadow row');
  assert.equal(st.shadow.recent[0].actual, 'wait', 'res unknown shadow action -> wait');
  assert.equal(st.shadow.recent[0].regret01, 0, 'res negative regret -> 0');
  assert.equal(st.geneBank.genes.length, 1, 'res drops id-less gene');
  assert.equal(st.geneBank.genes[0].source, 'manual', 'res unknown gene source -> manual');
  assert.equal(st.geneBank.genes[0].values.k.respond.value, 1, 'res over-1 gene value -> 1');
  assert.equal(st.geneBank.activeGeneId, null, 'res non-string active gene -> null');
  assert.equal(st.surpriseFirewall.recent.length, 1, 'res drops id-less quarantine');
  assert.equal(st.surpriseFirewall.recent[0].status, 'quarantined', 'res unknown quarantine status -> quarantined');
  assert.equal(st.surpriseFirewall.recent[0].releasedAt, 0, 'res negative releasedAt -> 0');
  assert.equal(st.evidenceDebt.records.length, 1, 'res drops id-less evidence record');
  assert.equal(st.evidenceDebt.records[0].status, 'open', 'res unknown evidence status -> open');
  assert.equal(st.evidenceDebt.meanPriority01, 1, 'res over-1 mean priority -> 1');
  assert.equal(st.modelSwap.currentModel, 'unknown', 'res non-string model -> unknown');
  assert.equal(st.modelSwap.catalog.length, 1, 'res drops model score without model name');
  assert.equal(st.modelSwap.catalog[0].latencyMs, 0, 'res negative latency -> 0');
  assert.equal(st.offlineSurvival.active, false, 'res truthy-string active -> false');
  assert.equal(st.offlineSurvival.lastBackend, 'unknown', 'res non-string backend -> unknown');
  assert.equal(st.dreamCompiler.compiledSkills.length, 1, 'res drops id-less skill');
  assert.equal(st.dreamCompiler.compiledSkills[0].action, 'wait', 'res unknown skill action -> wait');
  assert.equal(st.timeCapsules.capsules.length, 1, 'res drops id-less capsule');
  assert.deepEqual(st.timeCapsules.capsules[0].goals, ['g'], 'res keeps only string goals');
  assert.equal(st.timeCapsules.periodMs, 0, 'res negative period -> 0');
  assert.equal(st.counterfactualForks.forks.length, 1, 'res drops id-less fork');
  assert.equal(st.counterfactualForks.forks[0].chosen, 'wait', 'res unknown fork action -> wait');
  assert.equal(st.counterfactualForks.forks[0].alternativeUtility01, 0, 'res negative fork utility -> 0');
  assert.doesNotThrow(() => m.restore(hostile('geneBank')));
  const d = defaultAdvancedResilience();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'res default round-trips');
}

// --- CausalDevelopmentLoop --------------------------------------------------
{
  const m = new CausalDevelopmentLoop();
  m.restore({ version: 2, cycles: -1, worldLearningEvents: NaN, selfLearningEvents: -1, coupledUpdates: NaN, verifiedUpdates: -1, holdoutBefore01: 9, holdoutAfter01: -1, holdoutDelta01: NaN, transferGain01: 9, skillPromotions: -1, skillBlocks: NaN, rollbackSignals: -1, meanCausalStrength01: 9, meanEvidence01: -1, meanCoupling01: NaN, lastDecision: 5, lastAt: -1,
    samples: [{ id: 's1', at: -1, tick: -1, taskId: 5, action: 'bogus', before: [9, -1], after: [9], outcome01: 9, reward01: -1, surprise01: NaN, causalStrength01: 9, evidenceQuality01: -1, verified: 'yes', independent: 'yes', contextKey: 5 }, { tick: 1 }, 'x'],
    candidates: [{ id: 'c1', action: 'bogus', taskId: 5, contexts: -1, uses: NaN, success01: 9, holdout01: -1, transfer01: NaN, causal01: 9, evidence01: -1, status: 'bogus', lastAt: -1 }, { action: 'respond' }, 'x'],
    behavioralSequences: [{ id: 'b1', sequence: ['respond', 'bogus'], occurrences: -1, successes: NaN, verified: -1, holdoutTrials: NaN, holdoutSuccesses: -1, distinctContexts: NaN, contextKeys: [5, 'k', ''], success01: 9, holdout01: -1, retention01: NaN, confidence01: 9, transfer01: -1, status: 'bogus', promotedAt: -1, lastAt: NaN, lastOutcome01: 9, lastContext: 5, consecutiveFailures: -1, delayedSuccesses: NaN }, 'x'],
    behavioralEpisodes: [{ id: 'e1', taskId: 5, startedAt: -1, lastAt: NaN, steps: [{ tick: -1, at: NaN, taskId: 5, action: 'bogus', before: [9], after: [9, -1], outcome01: 9, verified: 'yes', contextKey: 5 }, 'x'] }, 'x'],
    lastBehavioralActionByTask: { t1: 'bogus', t2: 'respond' },
    behavioralPromotions: -1, behavioralBlocks: NaN, behavioralRollbackSignals: -1, behavioralTransferGain01: 9 });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'cdl negative cycles -> 0');
  assert.equal(st.worldLearningEvents, 0, 'cdl NaN world events -> 0');
  assert.equal(st.holdoutBefore01, 1, 'cdl over-1 holdout before -> 1');
  assert.equal(st.holdoutAfter01, 0, 'cdl negative holdout after -> 0');
  assert.equal(st.holdoutDelta01, 0, 'cdl NaN holdout delta -> 0');
  assert.equal(st.meanCausalStrength01, 1, 'cdl over-1 causal strength -> 1');
  assert.equal(st.meanEvidence01, 0, 'cdl negative evidence -> 0');
  assert.equal(st.meanCoupling01, .5, 'cdl NaN coupling -> default');
  assert.equal(st.lastDecision, 'idle', 'cdl non-string last decision -> default');
  assert.equal(st.lastAt, 0, 'cdl negative lastAt -> 0');
  assert.equal(st.samples.length, 1, 'cdl drops id-less sample');
  assert.equal(st.samples[0].action, 'wait', 'cdl unknown sample action -> wait');
  assert.equal(st.samples[0].before.length, 16, 'cdl sample before fixed length 16');
  assert.equal(st.samples[0].before[0], 1, 'cdl over-1 sample before -> 1');
  assert.equal(st.samples[0].outcome01, 1, 'cdl over-1 outcome -> 1');
  assert.equal(st.samples[0].surprise01, 0, 'cdl NaN surprise -> 0');
  assert.equal(st.samples[0].verified, false, 'cdl truthy-string verified -> false');
  assert.equal(st.samples[0].independent, false, 'cdl truthy-string independent -> false');
  assert.equal(st.candidates.length, 1, 'cdl drops id-less candidate');
  assert.equal(st.candidates[0].action, 'wait', 'cdl unknown candidate action -> wait');
  assert.equal(st.candidates[0].status, 'candidate', 'cdl unknown candidate status -> candidate');
  assert.equal(st.candidates[0].contexts, 0, 'cdl negative candidate contexts -> 0');
  assert.equal(st.behavioralSequences.length, 1, 'cdl drops id-less sequence');
  assert.deepEqual(st.behavioralSequences[0].sequence, ['respond'], 'cdl keeps only known sequence actions');
  assert.deepEqual(st.behavioralSequences[0].contextKeys, ['k'], 'cdl keeps only non-empty string context keys');
  assert.equal(st.behavioralSequences[0].status, 'candidate', 'cdl unknown sequence status -> candidate');
  assert.equal(st.behavioralSequences[0].success01, 1, 'cdl over-1 sequence success -> 1');
  assert.equal(st.behavioralEpisodes.length, 1, 'cdl drops id-less episode');
  assert.equal(st.behavioralEpisodes[0].steps.length, 1, 'cdl drops non-object episode step');
  assert.equal(st.behavioralEpisodes[0].steps[0].action, 'wait', 'cdl unknown step action -> wait');
  assert.equal(st.behavioralEpisodes[0].steps[0].before.length, 16, 'cdl step before fixed length 16');
  assert.equal(st.behavioralEpisodes[0].steps[0].verified, false, 'cdl truthy-string step verified -> false');
  assert.deepEqual(st.lastBehavioralActionByTask, { t1: 'wait', t2: 'respond' }, 'cdl sanitizes per-task actions');
  assert.equal(st.behavioralPromotions, 0, 'cdl negative promotions -> 0');
  assert.equal(st.behavioralTransferGain01, 1, 'cdl over-1 transfer gain -> 1');
  assert.doesNotThrow(() => m.restore(hostile('samples')));
  const d = defaultCausalDevelopmentLoop();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'cdl default round-trips');
}

console.log('WORKPASS72_ACTIVEPERCEPTION_COMPUTEGOVERNOR_HYPOTHALAMIC_INTEROCEPTIVE_RESILIENCE_CAUSALDEV_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['ActivePerceptionExecutor', 'AdaptiveComputeGovernor', 'HypothalamicHomeostasisController', 'InteroceptiveStateEstimator', 'AdvancedResilienceEngine', 'CausalDevelopmentLoop'] }));
