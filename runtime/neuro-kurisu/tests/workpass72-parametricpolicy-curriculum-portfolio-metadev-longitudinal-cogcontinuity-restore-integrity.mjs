import assert from 'node:assert/strict';
import { ParametricPolicyLearner, defaultParametricPolicy } from '../src/organism/learning/ParametricPolicyLearner.ts';
import { PersonalCurriculumEngine, defaultPersonalCurriculum } from '../src/organism/learning/PersonalCurriculumEngine.ts';
import { DevelopmentalPortfolioEngine, defaultDevelopmentalPortfolio } from '../src/organism/learning/DevelopmentalPortfolioEngine.ts';
import { MetaDevelopmentalStrategyEngine, defaultMetaDevelopmental } from '../src/organism/learning/MetaDevelopmentalStrategyEngine.ts';
import { LongitudinalSubjectTransferBattery, defaultLongitudinalSubjectTransfer } from '../src/organism/learning/LongitudinalSubjectTransferBattery.ts';
import { CognitiveOrganismContinuityEngine, defaultCognitiveOrganismContinuity } from '../src/organism/learning/CognitiveOrganismContinuityEngine.ts';

/**
 * WorkPass72 — the learning/development family: parametric policy learner,
 * personal curriculum engine, developmental portfolio engine, meta
 * developmental strategy engine, longitudinal subject transfer battery and the
 * cognitive organism continuity engine. Each merged a persisted snapshot with a
 * bare spread, letting NaN reach policy weights, curriculum threads, portfolio
 * domains, strategy/agenda rows, transfer sessions and the continuity
 * phase/records.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });
const ACTIONS = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];

// --- ParametricPolicyLearner ------------------------------------------------
{
  const m = new ParametricPolicyLearner();
  m.restore({ version: 1, featureNames: [5, 'energy', null], weights: { respond: [9, -9, 'x'], bogus: [1] }, bias: { respond: 99, bogus: 1 }, updates: -1,
    tdAbsMean01: 9, trainRewardMean01: -1, explorationRate01: NaN, lastLoss01: 9, lastTrainedAt: -1, frozen: 'yes' });
  const st = m.snapshot();
  const mPos = new ParametricPolicyLearner();
  mPos.restore({ weights: { respond: [9, -9, 'x'] }, bias: { respond: 99 } });
  const stPos = mPos.snapshot();
  assert.equal(st.updates, 0, 'ppl negative updates -> 0');
  assert.equal(st.tdAbsMean01, 0, 'ppl over-1 td -> default (out of [0,1])');
  assert.equal(st.trainRewardMean01, .5, 'ppl negative reward mean -> default');
  assert.equal(st.explorationRate01, .16, 'ppl NaN exploration -> default');
  assert.equal(st.lastLoss01, 0, 'ppl over-1 loss -> default (out of [0,1])');
  assert.equal(st.lastTrainedAt, 0, 'ppl negative trained-at -> 0');
  assert.equal(st.frozen, false, 'ppl truthy-string frozen -> false');
  assert.deepEqual(Object.keys(st.weights).sort(), [...ACTIONS].sort(), 'ppl weights cover exactly the known actions');
  assert.equal(st.weights.respond.length, 18, 'ppl weight row fixed feature length');
  assert.equal(stPos.weights.respond[0], 4, 'ppl weight clamped to +4');
  assert.equal(stPos.weights.respond[1], -4, 'ppl weight clamped to -4');
  assert.equal(stPos.bias.respond, 4, 'ppl bias clamped to +4');
  assert.doesNotThrow(() => m.restore(hostile('weights')));
  const d = defaultParametricPolicy();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'ppl default round-trips');
}

// --- PersonalCurriculumEngine -----------------------------------------------
{
  const m = new PersonalCurriculumEngine();
  m.restore({ version: 1, cycles: -1, curriculumPressure01: 9, socialLearning01: -1, lastAt: NaN, focusThreadId: 5, focusGoalId: '',
    threads: [{ id: 't1', family: 5, title: 5, source: 'bogus', occurrences: -1, verified: NaN, socialRelevance01: 9, identityRelevance01: -1, status: 'bogus', contextKeys: [5, 'k', ''], lastAt: -1 }, { family: 'x' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'pce negative cycles -> 0');
  assert.equal(st.curriculumPressure01, 1, 'pce over-1 pressure -> 1');
  assert.equal(st.socialLearning01, 0, 'pce negative social -> 0');
  assert.equal(st.lastAt, 0, 'pce NaN lastAt -> 0');
  assert.equal(st.focusThreadId, null, 'pce non-string focus thread -> null');
  assert.equal(st.focusGoalId, null, 'pce empty focus goal -> null');
  assert.equal(st.threads.length, 1, 'pce drops id-less thread');
  assert.equal(st.threads[0].source, 'mixed', 'pce unknown source -> mixed');
  assert.equal(st.threads[0].status, 'emerging', 'pce unknown status -> emerging');
  assert.equal(st.threads[0].occurrences, 0, 'pce negative occurrences -> 0');
  assert.equal(st.threads[0].socialRelevance01, 1, 'pce over-1 social relevance -> 1');
  assert.deepEqual(st.threads[0].contextKeys, ['k'], 'pce keeps only non-empty context keys');
  assert.doesNotThrow(() => m.restore(hostile('threads')));
  const d = defaultPersonalCurriculum();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'pce default round-trips');
}

// --- DevelopmentalPortfolioEngine -------------------------------------------
{
  const m = new DevelopmentalPortfolioEngine();
  m.restore({ version: 1, cycles: -1, selectedDomain: 'bogus', allocation01: 9, lastAt: NaN,
    threads: [{ domain: 'self', pressure01: 9, uncertainty01: -1, observations: -5, priority01: NaN }, { domain: 'bogus' }] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'dpe negative cycles -> 0');
  assert.equal(st.selectedDomain, 'none', 'dpe unknown domain -> none');
  assert.equal(st.allocation01, 1, 'dpe over-1 allocation -> 1');
  assert.equal(st.lastAt, 0, 'dpe NaN lastAt -> 0');
  assert.equal(st.threads.length, 6, 'dpe always emits all canonical domains');
  const self = st.threads.find(t => t.domain === 'self');
  assert.equal(self.pressure01, 1, 'dpe over-1 pressure -> 1');
  assert.equal(self.uncertainty01, 0, 'dpe negative uncertainty -> 0');
  assert.equal(self.observations, 0, 'dpe negative observations -> 0');
  assert.ok(Number.isFinite(self.priority01), 'dpe NaN priority -> finite default');
  assert.doesNotThrow(() => m.restore(hostile('threads')));
  const d = defaultDevelopmentalPortfolio();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'dpe default round-trips');
}

// --- MetaDevelopmentalStrategyEngine ----------------------------------------
{
  const m = new MetaDevelopmentalStrategyEngine();
  m.restore({ version: 1, cycles: -1, focusAction: 'bogus', focusGoalId: 5, metaLearning01: 9, abstraction01: -1, lastAt: NaN,
    strategies: [{ id: 's1', abstraction: 5, components: [5, 'c', ''], preferredActions: ['respond', 'bogus'], status: 'bogus', occurrences: -1, retention01: 9, transfer01: -1, lastAt: NaN }, { abstraction: 'x' }, 'x'],
    agenda: [{ goalId: 'g1', score01: 9, expectedLearning01: -1, reason: 5 }, { score01: 1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'mds negative cycles -> 0');
  assert.equal(st.focusAction, null, 'mds unknown focus action -> null');
  assert.equal(st.focusGoalId, null, 'mds non-string focus goal -> null');
  assert.equal(st.metaLearning01, 1, 'mds over-1 meta learning -> 1');
  assert.equal(st.abstraction01, 0, 'mds negative abstraction -> 0');
  assert.equal(st.strategies.length, 1, 'mds drops id-less strategy');
  assert.equal(st.strategies[0].status, 'candidate', 'mds unknown status -> candidate');
  assert.deepEqual(st.strategies[0].preferredActions, ['respond'], 'mds keeps only known preferred actions');
  assert.deepEqual(st.strategies[0].components, ['c'], 'mds keeps only non-empty components');
  assert.equal(st.strategies[0].retention01, 1, 'mds over-1 retention -> 1');
  assert.equal(st.strategies[0].transfer01, 0, 'mds negative transfer -> 0');
  assert.equal(st.agenda.length, 1, 'mds drops goal-less agenda item');
  assert.equal(st.agenda[0].score01, 1, 'mds over-1 agenda score -> 1');
  assert.equal(st.agenda[0].reason, '', 'mds non-string reason -> empty');
  assert.doesNotThrow(() => m.restore(hostile('strategies')));
  const d = defaultMetaDevelopmental();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'mds default round-trips');
}

// --- LongitudinalSubjectTransferBattery -------------------------------------
{
  const m = new LongitudinalSubjectTransferBattery();
  m.restore({ version: 1, sessions: -1, restarts: NaN, meanRetention01: 9, meanIdentityDelta01: -1,
    sessionsData: [{ id: 'x1', taskFamily: 5, continuity01: 9, identity01: -1, agency01: NaN }, { taskFamily: 'y' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.sessions, 0, 'lstb negative sessions -> 0');
  assert.equal(st.restarts, 0, 'lstb NaN restarts -> 0');
  assert.equal(st.meanRetention01, 1, 'lstb over-1 retention -> 1');
  assert.equal(st.meanIdentityDelta01, 0, 'lstb negative identity delta -> 0');
  assert.equal(st.sessionsData.length, 1, 'lstb drops id-less session');
  assert.equal(st.sessionsData[0].continuity01, 1, 'lstb over-1 continuity -> 1');
  assert.equal(st.sessionsData[0].identity01, 0, 'lstb negative identity -> 0');
  assert.equal(st.sessionsData[0].agency01, 0, 'lstb NaN agency -> 0');
  assert.doesNotThrow(() => m.restore(hostile('sessionsData')));
  const d = defaultLongitudinalSubjectTransfer();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'lstb default round-trips');
}

// --- CognitiveOrganismContinuityEngine --------------------------------------
{
  const m = new CognitiveOrganismContinuityEngine();
  m.restore({ version: 1, cycles: -1, phaseIndex: 9999, activePhase: 'bogus', lastAt: NaN, lastReason: 5,
    domains: { self: 9, bogus: 5 }, agency: { commitments: -1, unfinishedIntentions: NaN, executionReliability01: 9 },
    self: { continuity01: 9, uncertainty01: -1 }, learning: { transfer01: NaN },
    futurePaths: [{ horizon: 'bogus', value01: 9 }, { horizon: 'near', value01: 1 }, 'x'],
    projections: [{ phase: 'bogus', action: 'respond', horizon: 'near' }, { action: 'respond', horizon: 'near', phase: 'integration' }, 'x'],
    outcomes: [{ action: 'bogus' }, { action: 'respond', surprise01: 9 }, 'x'],
    lastAblation: { x: 9, y: -1 } });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'coc negative cycles -> 0');
  assert.equal(st.phaseIndex, 34, 'coc out-of-range phase index clamped');
  assert.equal(st.lastAt, 0, 'coc NaN lastAt -> 0');
  assert.equal(st.lastReason, 'initial', 'coc non-string reason -> default');
  assert.equal(st.domains.self, 1, 'coc over-1 domain -> 1');
  assert.equal(st.agency.commitments, 0, 'coc negative commitments -> 0');
  assert.equal(st.agency.unfinishedIntentions, 0, 'coc NaN intentions -> 0');
  assert.equal(st.agency.executionReliability01, 1, 'coc over-1 agency -> 1');
  assert.equal(st.self.continuity01, 1, 'coc over-1 self continuity -> 1');
  assert.equal(st.self.uncertainty01, 0, 'coc negative self uncertainty -> 0');
  assert.equal(st.learning.transfer01, .5, 'coc NaN learning transfer -> .5 record default');
  assert.equal(st.futurePaths.length, 1, 'coc drops unknown-horizon future path');
  assert.equal(st.futurePaths[0].value01, 1, 'coc over-1 path value -> 1');
  assert.equal(st.projections.length, 1, 'coc drops unknown-phase projection');
  assert.equal(st.outcomes.length, 1, 'coc drops unknown-action outcome');
  assert.equal(st.outcomes[0].surprise01, 1, 'coc over-1 surprise -> 1');
  assert.deepEqual(st.lastAblation, { x: 1, y: 0 }, 'coc clamps ablation record');
  assert.doesNotThrow(() => m.restore(hostile('domains')));
  const d = defaultCognitiveOrganismContinuity();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'coc default round-trips');
}

console.log('WORKPASS72_PARAMETRICPOLICY_CURRICULUM_PORTFOLIO_METADEV_LONGITUDINAL_COGCONTINUITY_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['ParametricPolicyLearner', 'PersonalCurriculumEngine', 'DevelopmentalPortfolioEngine', 'MetaDevelopmentalStrategyEngine', 'LongitudinalSubjectTransferBattery', 'CognitiveOrganismContinuityEngine'] }));
