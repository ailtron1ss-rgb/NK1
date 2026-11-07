import assert from 'node:assert/strict';
import { BrainstemArousalSleepScheduler, defaultBrainstemArousalState } from '../src/organism/system/BrainstemArousalSleepScheduler.ts';
import { DualTimescaleMemoryBridge, defaultDualTimescaleMemory } from '../src/organism/system/DualTimescaleMemoryBridge.ts';
import { DreamCounterfactualLaboratory, defaultDreamCounterfactual } from '../src/organism/system/DreamCounterfactualLaboratory.ts';
import { LongHorizonAutonomyController, defaultLongHorizonAutonomyState } from '../src/organism/system/LongHorizonAutonomyController.ts';
import { P49TemporalLifeEngine, defaultP49 } from '../src/organism/developmental/P49TemporalLifeEngine.ts';
import { P55DevelopmentalForkUniverse, defaultP55 } from '../src/organism/developmental/P55DevelopmentalForkUniverse.ts';

/**
 * WorkPass72 — the developmental/autonomy family: brainstem arousal-sleep
 * scheduler, dual-timescale memory bridge, dream counterfactual laboratory,
 * long-horizon autonomy controller, P49 temporal life engine and the P55
 * developmental fork universe. Each merged a persisted snapshot with a bare
 * spread (or structuredClone), letting NaN reach arousal frames, timescale
 * scalars, dream candidates, plan/step rows, P49 episodes/beliefs and P55 forks.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- BrainstemArousalSleepScheduler -----------------------------------------
{
  const m = new BrainstemArousalSleepScheduler();
  m.restore({ version: 1, ticks: -1, sleepCycles: NaN, recoveryTicks: -1, protectedTicks: NaN, restorativeTicks: -1, transitions: NaN, mode: 'bogus', arousal01: 9, sleepNeed01: -1, lastFrame: { mode: 'bogus', arousal01: 9, computeScale01: -1, plasticityScale01: NaN, consolidationQuota01: 9, memoryReplayScale01: -1, wakeInhibition01: 9, sleepNeed01: -1, restorative01: NaN, reason: [5, 'ok', ''], transition: 5 } });
  const st = m.snapshot();
  assert.equal(st.ticks, 0, 'brainstem negative ticks -> 0');
  assert.equal(st.sleepCycles, 0, 'brainstem NaN sleep cycles -> 0');
  assert.equal(st.mode, 'wake', 'brainstem unknown mode -> default');
  assert.equal(st.arousal01, 1, 'brainstem over-1 arousal -> 1');
  assert.equal(st.sleepNeed01, 0, 'brainstem negative sleep need -> 0');
  assert.equal(st.lastFrame.mode, 'wake', 'brainstem unknown frame mode -> wake');
  assert.equal(st.lastFrame.arousal01, 1, 'brainstem over-1 frame arousal -> 1');
  assert.equal(st.lastFrame.computeScale01, 0, 'brainstem negative compute scale -> 0');
  assert.equal(st.lastFrame.plasticityScale01, 0, 'brainstem NaN plasticity -> 0');
  assert.equal(st.lastFrame.wakeInhibition01, 1, 'brainstem over-1 wake inhibition -> 1');
  assert.deepEqual(st.lastFrame.reason, ['ok'], 'brainstem keeps only non-empty string reasons');
  assert.equal(st.lastFrame.transition, null, 'brainstem non-string transition -> null');
  assert.doesNotThrow(() => m.restore(hostile('lastFrame')));
  const d = defaultBrainstemArousalState();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'brainstem default round-trips');
}

// --- DualTimescaleMemoryBridge ----------------------------------------------
{
  const m = new DualTimescaleMemoryBridge();
  m.restore({ version: 1, cycles: -1, fast01: 9, slow01: -1, transfer01: NaN, stability01: 9, interference01: -1, consolidations: NaN });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'dual negative cycles -> 0');
  assert.equal(st.fast01, 1, 'dual over-1 fast -> 1');
  assert.equal(st.slow01, 0, 'dual negative slow -> 0');
  assert.equal(st.transfer01, 0, 'dual NaN transfer -> 0');
  assert.equal(st.stability01, 1, 'dual over-1 stability -> 1');
  assert.equal(st.interference01, 0, 'dual negative interference -> 0');
  assert.equal(st.consolidations, 0, 'dual NaN consolidations -> 0');
  assert.doesNotThrow(() => m.restore(hostile('fast01')));
  const d = defaultDualTimescaleMemory();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'dual default round-trips');
}

// --- DreamCounterfactualLaboratory ------------------------------------------
{
  const m = new DreamCounterfactualLaboratory();
  m.restore({ version: 1, cycles: -1, rehearsals: NaN, promoted: -1, meanRobustness01: 9, candidates: [{ id: 'c1', domain: 5, baseline01: 9, counterfactual01: -1, robustness01: NaN, promoted: 'yes', at: -1 }, { domain: 'x' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'dream negative cycles -> 0');
  assert.equal(st.rehearsals, 0, 'dream NaN rehearsals -> 0');
  assert.equal(st.promoted, 0, 'dream negative promoted -> 0');
  assert.equal(st.meanRobustness01, 1, 'dream over-1 robustness -> 1');
  assert.equal(st.candidates.length, 1, 'dream drops id-less candidate');
  assert.equal(st.candidates[0].domain, '', 'dream non-string domain -> empty');
  assert.equal(st.candidates[0].baseline01, 1, 'dream over-1 baseline -> 1');
  assert.equal(st.candidates[0].counterfactual01, 0, 'dream negative counterfactual -> 0');
  assert.equal(st.candidates[0].robustness01, 0, 'dream NaN robustness -> 0');
  assert.equal(st.candidates[0].promoted, false, 'dream truthy-string promoted -> false');
  assert.equal(st.candidates[0].at, 0, 'dream negative at -> 0');
  assert.doesNotThrow(() => m.restore(hostile('candidates')));
  const d = defaultDreamCounterfactual();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'dream default round-trips');
}

// --- LongHorizonAutonomyController ------------------------------------------
{
  const m = new LongHorizonAutonomyController();
  m.restore({ version: 1, ticks: -1, plansCreated: NaN, meanCommitment01: 9, meanExecutionSuccess01: -1, lastPlanId: 5, lastStepId: 5, lastAt: NaN, plans: [{ id: 'p1', goalId: 5, title: 5, reason: 5, mode: 'bogus', commitment01: 9, revisionCount: -1, createdAt: -1, updatedAt: NaN, status: 'bogus', steps: [{ id: 's1', action: 5, title: 5, order: -1, status: 'bogus', utility01: 9, confidence01: -1, createdAt: -1, updatedAt: NaN }, { action: 'respond' }, 'x'], lastOutcome01: 9, lastPredictionError01: -1 }, { title: 'x' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.ticks, 0, 'lha negative ticks -> 0');
  assert.equal(st.plansCreated, 0, 'lha NaN plans -> 0');
  assert.equal(st.meanCommitment01, 1, 'lha over-1 commitment -> 1');
  assert.equal(st.meanExecutionSuccess01, 0, 'lha negative success -> 0');
  assert.equal(st.lastPlanId, null, 'lha non-string plan id -> null');
  assert.equal(st.lastAt, 0, 'lha NaN lastAt -> 0');
  assert.equal(st.plans.length, 1, 'lha drops id-less plan');
  assert.equal(st.plans[0].goalId, null, 'lha non-string goal id -> null');
  assert.equal(st.plans[0].mode, 'stabilize', 'lha unknown mode -> stabilize');
  assert.equal(st.plans[0].status, 'active', 'lha unknown plan status -> active');
  assert.equal(st.plans[0].revisionCount, 0, 'lha negative revision -> 0');
  assert.equal(st.plans[0].lastOutcome01, 1, 'lha over-1 last outcome -> 1');
  assert.equal(st.plans[0].lastPredictionError01, 0, 'lha negative prediction error -> 0');
  assert.equal(st.plans[0].steps.length, 1, 'lha drops id-less step');
  assert.equal(st.plans[0].steps[0].order, 0, 'lha negative step order -> 0');
  assert.equal(st.plans[0].steps[0].status, 'pending', 'lha unknown step status -> pending');
  assert.equal(st.plans[0].steps[0].utility01, 1, 'lha over-1 step utility -> 1');
  assert.equal(st.plans[0].steps[0].confidence01, 0, 'lha negative step confidence -> 0');
  assert.doesNotThrow(() => m.restore(hostile('plans')));
  const d = defaultLongHorizonAutonomyState();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'lha default round-trips');
}

// --- P49TemporalLifeEngine --------------------------------------------------
{
  const m = new P49TemporalLifeEngine();
  m.restore({ version: 1, eventCursor: -1, seenEventIds: [5, 'e1', ''], journalHash: 5, eventsIndexed: NaN, episodesCreated: -1, episodesCompressed: NaN, beliefsReconciled: -1, contradictionsOpen: NaN, sleepConsolidations: -1, lastSleepAt: NaN, memoryPressure01: 9, continuityHealth01: -1, drift01: NaN, episodes: [{ id: 'ep1', startAt: -1, endAt: NaN, eventIds: [5, 'e1', ''], summary: 5, salience: 9, confidence: -1, sources: [5, 's', ''] }, { startAt: 1 }, 'x'], beliefs: [{ id: 'b1', proposition: 5, confidence: 9, evidenceIds: [5, 'e1'], contradictionIds: [5], updates: -1, lastAt: NaN }, { proposition: 'x' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.eventCursor, 0, 'p49 negative cursor -> 0');
  assert.deepEqual(st.seenEventIds, ['e1'], 'p49 keeps only non-empty string event ids');
  assert.equal(st.journalHash, 'GENESIS-P49', 'p49 non-string journal hash -> default');
  assert.equal(st.eventsIndexed, 0, 'p49 NaN events indexed -> 0');
  assert.equal(st.memoryPressure01, 1, 'p49 over-1 memory pressure -> 1');
  assert.equal(st.continuityHealth01, 0, 'p49 negative health -> 0');
  assert.equal(st.drift01, 0, 'p49 NaN drift -> 0');
  assert.equal(st.episodes.length, 1, 'p49 drops id-less episode');
  assert.deepEqual(st.episodes[0].eventIds, ['e1'], 'p49 keeps only non-empty episode event ids');
  assert.equal(st.episodes[0].salience, 1, 'p49 over-1 salience -> 1');
  assert.equal(st.episodes[0].confidence, 0, 'p49 negative confidence -> 0');
  assert.deepEqual(st.episodes[0].sources, ['s'], 'p49 keeps only non-empty sources');
  assert.equal(st.beliefs.length, 1, 'p49 drops id-less belief');
  assert.equal(st.beliefs[0].confidence, 1, 'p49 over-1 belief confidence -> 1');
  assert.deepEqual(st.beliefs[0].evidenceIds, ['e1'], 'p49 keeps only non-empty evidence ids');
  assert.equal(st.beliefs[0].updates, 0, 'p49 negative updates -> 0');
  assert.equal(st.beliefs[0].lastAt, 0, 'p49 NaN belief lastAt -> 0');
  assert.doesNotThrow(() => m.restore(hostile('episodes')));
  const d = defaultP49();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p49 default round-trips');
}

// --- P55DevelopmentalForkUniverse -------------------------------------------
{
  const m = new P55DevelopmentalForkUniverse();
  m.restore({ version: 2, generations: -1, simulated: NaN, promoted: -1, meanDevelopmentalValue01: 9, branchDiversity01: -1, futureCoverage01: NaN, lastWinnerId: 5, lastAppliedForkId: 5, appliedCount: -1, calibration01: 9, actionBiases: { k: 9, j: -1 }, forks: [{ id: 'f1', createdAt: -1, generation: NaN, parentId: 5, style: 'bogus', deltas: { exploration: 9, verification: -1, bogus: 1 }, reason: 5, projectedPredictionError01: 9, projectedSelfPredictionError01: -1, projectedIdentity01: NaN, projectedGrounding01: 9, projectedAgency01: -1, novelty01: 9, stability01: -1, developmentalValue01: NaN, risk01: 9, generalization01: -1, status: 'bogus', outcomeObserved01: 9 }, { reason: 'x' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.generations, 0, 'p55 negative generations -> 0');
  assert.equal(st.simulated, 0, 'p55 NaN simulated -> 0');
  assert.equal(st.meanDevelopmentalValue01, 1, 'p55 over-1 mean value -> 1');
  assert.equal(st.branchDiversity01, .25, 'p55 refresh recomputes diversity from forks');
  assert.ok(st.futureCoverage01 > 0 && st.futureCoverage01 < 1, 'p55 refresh recomputes coverage');
  assert.equal(st.unresolvedForks, 1, 'p55 refresh recomputes unresolved forks');
  assert.equal(st.lastWinnerId, null, 'p55 non-string winner id -> null');
  assert.equal(st.appliedCount, 0, 'p55 negative applied count -> 0');
  assert.equal(st.calibration01, 1, 'p55 over-1 calibration -> 1');
  assert.equal(st.actionBiases.k, 1, 'p55 over-1 action bias -> 1');
  assert.equal(st.actionBiases.j, -1, 'p55 signed action bias preserved');
  assert.equal(st.forks.length, 1, 'p55 drops id-less fork');
  assert.equal(st.forks[0].parentId, null, 'p55 non-string parent id -> null');
  assert.equal(st.forks[0].style, 'balanced', 'p55 unknown style -> balanced');
  assert.equal(st.forks[0].deltas.exploration, 1, 'p55 over-1 delta -> 1');
  assert.equal(st.forks[0].deltas.verification, -1, 'p55 signed delta preserved');
  assert.equal(st.forks[0].deltas.prediction, 0, 'p55 missing delta knob -> 0');
  assert.equal(st.forks[0].status, 'candidate', 'p55 unknown status -> candidate');
  assert.equal(st.forks[0].projectedPredictionError01, 1, 'p55 over-1 projected error -> 1');
  assert.equal(st.forks[0].projectedIdentity01, 0, 'p55 NaN projected identity -> 0');
  assert.equal(st.forks[0].generalization01, 0, 'p55 negative generalization -> 0');
  assert.equal(st.forks[0].outcomeObserved01, 1, 'p55 over-1 outcome -> 1');
  assert.doesNotThrow(() => m.restore(hostile('forks')));
  const d = defaultP55();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p55 default round-trips');
}

console.log('WORKPASS72_BRAINSTEM_DUALTIMESCALE_DREAM_LONGHORIZON_P49_P55_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['BrainstemArousalSleepScheduler', 'DualTimescaleMemoryBridge', 'DreamCounterfactualLaboratory', 'LongHorizonAutonomyController', 'P49TemporalLifeEngine', 'P55DevelopmentalForkUniverse'] }));
