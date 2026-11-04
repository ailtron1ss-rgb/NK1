import assert from 'node:assert/strict';
import { P56IntegratedDevelopmentalMind, defaultP56 } from '../src/organism/developmental/P56IntegratedDevelopmentalMind.ts';
import { P63DevelopmentalOperatingSystem, defaultP63 } from '../src/organism/developmental/P63DevelopmentalOperatingSystem.ts';
import { IntegratedLifeTrajectoryEngine, defaultIntegratedLifeTrajectory } from '../src/organism/learning/IntegratedLifeTrajectoryEngine.ts';
import { VerifiedAutonomousLifeEngine, defaultVerifiedAutonomousLife } from '../src/organism/learning/VerifiedAutonomousLifeEngine.ts';

/**
 * WorkPass72 — developmental control planes + life-trajectory/autonomous-life
 * restore integrity. Each owner merged a persisted snapshot with a bare spread
 * or `structuredClone`, letting NaN reach plan priority, mode counters,
 * trajectory continuity and verified-life metrics.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- P56IntegratedDevelopmentalMind -----------------------------------------
{
  const p = new P56IntegratedDevelopmentalMind();
  p.restore({ version: 1, cycles: -1, assessments: NaN, planned: -1, protectedCycles: NaN, meanIntegrated01: 9, meanRealityGap01: -1, meanStability01: NaN, modeCounts: { observe: -1, bogus: 5 }, lastPlan: { mode: 'bogus', priority01: 9, confidence01: -1, reasons: ['a', 5], nextEvidence: [5] }, lastAt: -1, history: [{ tick: -1, at: -1, mode: 'bogus', priority01: 9, confidence01: -1, realityGap01: 9 }, null] });
  const st = p.snapshot();
  assert.equal(st.cycles, 0, 'p56 negative cycles -> 0');
  assert.equal(st.assessments, 0, 'p56 NaN assessments -> 0');
  assert.equal(st.meanIntegrated01, 1, 'p56 over-1 integrated -> 1');
  assert.equal(st.meanRealityGap01, 0, 'p56 negative reality gap -> 0');
  assert.equal(st.meanStability01, .8, 'p56 NaN stability -> default');
  assert.equal(st.modeCounts.observe, 0, 'p56 negative mode count -> 0');
  assert.ok(!('bogus' in st.modeCounts), 'p56 drops unknown mode key');
  assert.equal(st.lastPlan.mode, 'observe', 'p56 unknown plan mode -> observe');
  assert.equal(st.lastPlan.priority01, 1, 'p56 over-1 plan priority -> 1');
  assert.deepEqual(st.lastPlan.reasons, ['a'], 'p56 drops non-string reasons');
  assert.equal(st.lastAt, 0, 'p56 negative lastAt -> 0');
  assert.equal(st.history.length, 1, 'p56 drops non-object history row');
  assert.equal(st.history[0].mode, 'observe', 'p56 unknown history mode -> observe');
  assert.equal(st.history[0].priority01, 1, 'p56 over-1 history priority -> 1');
  assert.doesNotThrow(() => p.restore(hostile('history')));
  const pDefault = defaultP56();

  p.restore(pDefault);
  assert.deepEqual(p.snapshot(), pDefault, 'p56 default round-trips');
}

// --- P63DevelopmentalOperatingSystem ----------------------------------------
{
  const p = new P63DevelopmentalOperatingSystem();
  p.restore({ version: 2, cycles: -1, modeCounts: { protect: -1, bogus: 9 }, promotionsBlocked: NaN, forcedDiversions: -1, modeStreak: NaN, lastMode: 'bogus', meanDevelopmentBudget01: 9, meanConfidence01: -1, lastPlan: { mode: 'bogus', priority01: 9, confidence01: -1, developmentBudget01: 9, actionBias: { respond: 9, bad: -1 }, reasons: ['a', 5], evidenceRequired: [5] }, history: [{ mode: 'bogus', priority01: 9, confidence01: -1, developmentBudget01: 9, actionBias: {}, reasons: [], evidenceRequired: [] }, null] });
  const st = p.snapshot();
  assert.equal(st.cycles, 0, 'p63 negative cycles -> 0');
  assert.equal(st.promotionsBlocked, 0, 'p63 NaN blocked -> 0');
  assert.equal(st.forcedDiversions, 0, 'p63 negative diversions -> 0');
  assert.equal(st.lastMode, null, 'p63 unknown lastMode -> null');
  assert.equal(st.modeCounts.protect, 0, 'p63 negative mode count -> 0');
  assert.ok(!('bogus' in st.modeCounts), 'p63 drops unknown mode key');
  assert.equal(st.meanDevelopmentBudget01, 1, 'p63 over-1 budget -> 1');
  assert.equal(st.meanConfidence01, 0, 'p63 negative confidence -> 0');
  assert.equal(st.lastPlan.mode, 'observe', 'p63 unknown plan mode -> observe');
  assert.equal(st.lastPlan.actionBias.respond, 1, 'p63 over-1 action bias -> 1');
  assert.equal(st.lastPlan.actionBias.bad, 0, 'p63 negative action bias -> 0');
  assert.deepEqual(st.lastPlan.reasons, ['a'], 'p63 drops non-string reasons');
  assert.equal(st.history.length, 1, 'p63 drops non-object history row');
  assert.equal(st.history[0].mode, 'observe', 'p63 unknown history mode -> observe');
  assert.doesNotThrow(() => p.restore(hostile('history')));
  const pDefault = defaultP63();

  p.restore(pDefault);
  assert.deepEqual(p.snapshot(), pDefault, 'p63 default round-trips');
}

// --- IntegratedLifeTrajectoryEngine -----------------------------------------
{
  const e = new IntegratedLifeTrajectoryEngine();
  e.restore({ version: 1, cycles: -1, focusGoalId: 5, focusDomain: 'bogus', focusHorizon: 'bogus', trajectoryCoherence01: 9, selfContinuity01: -1, socialContinuity01: NaN, goalContinuity01: 9, futureAlignment01: -1, agencyReadiness01: NaN, repairPressure01: 9, commitmentPressure01: -1, learningPressure01: NaN, predictionError01: 9, counterfactualGap01: -1, lastForecast: { action: 'bogus', score01: 9, horizonValues: { immediate: 9, near: -1 }, expectedContinuity01: 9, generatedAt: -1 }, forecasts: [{ action: 'bogus', score01: 9, horizonValues: {}, generatedAt: -1 }, null], outcomes: [{ id: 'o1', action: 'bogus', predicted01: 9, actual01: -1, error01: 9, verified01: NaN, surprise01: -1, contextKey: 5, at: -1 }, { predicted01: 1 }], lastReason: 5, lastAt: -1 });
  const st = e.snapshot();
  assert.equal(st.cycles, 0, 'ilt negative cycles -> 0');
  assert.equal(st.focusGoalId, null, 'ilt non-string focusGoalId -> null');
  assert.equal(st.focusDomain, 'none', 'ilt unknown domain -> none');
  assert.equal(st.focusHorizon, 'near', 'ilt unknown horizon -> near');
  assert.equal(st.trajectoryCoherence01, 1, 'ilt over-1 coherence -> 1');
  assert.equal(st.selfContinuity01, 0, 'ilt negative continuity -> 0');
  assert.equal(st.socialContinuity01, .56, 'ilt NaN continuity -> default');
  assert.equal(st.lastForecast.action, 'wait', 'ilt unknown forecast action -> wait');
  assert.equal(st.lastForecast.horizonValues.immediate, 1, 'ilt over-1 horizon -> 1');
  assert.equal(st.lastForecast.horizonValues.near, 0, 'ilt negative horizon -> 0');
  assert.equal(st.lastForecast.horizonValues.long, .5, 'ilt missing horizon -> .5');
  assert.equal(st.lastForecast.generatedAt, 0, 'ilt negative generatedAt -> 0');
  assert.equal(st.forecasts.length, 1, 'ilt drops non-object forecast');
  assert.equal(st.outcomes.length, 1, 'ilt drops outcome without id');
  assert.equal(st.outcomes[0].action, 'wait', 'ilt unknown outcome action -> wait');
  assert.equal(st.outcomes[0].error01, 1, 'ilt over-1 error -> 1');
  assert.equal(st.outcomes[0].verified01, 0, 'ilt NaN verified -> 0');
  assert.equal(st.outcomes[0].contextKey, '', 'ilt non-string contextKey -> empty');
  assert.equal(st.lastReason, '', 'ilt non-string lastReason -> empty');
  assert.equal(st.lastAt, 0, 'ilt negative lastAt -> 0');
  assert.doesNotThrow(() => e.restore(hostile('forecasts')));
  const eDefault = defaultIntegratedLifeTrajectory();

  e.restore(eDefault);
  assert.deepEqual(e.snapshot(), eDefault, 'ilt default round-trips');
}

// --- VerifiedAutonomousLifeEngine -------------------------------------------
{
  const e = new VerifiedAutonomousLifeEngine();
  e.restore({ version: 1, cycles: -1, lastAt: -1, nextId: NaN, decisions: [{ id: 'd1', cycle: -1, action: 'bogus', predicted01: 9, confidence01: -1, contextKey: 5, at: -1, resolved: 'yes' }, { action: 'wait' }], outcomes: [{ decisionId: 'd1', actual01: 9, error01: -1, reward01: NaN, verified01: 9, causal01: -1, basis: 'bogus', at: -1, stateAfterDigest: 5 }, {}], perceptions: [{ id: 'p1', cycle: -1, mode: 5, expectedGain01: 9, observedGain01: -1, verified01: NaN, at: -1 }, {}], causalLinks: [{ decisionId: 'd1', outcomeId: 'o1', action: 'bogus', effect01: 9, confidence01: -1, evidence01: NaN, at: -1 }, {}], checkpoints: [{ cycle: -1, digest: 5, decisions: -1, outcomes: NaN, at: -1 }], longitudinal: [{ cycle: -1, overall01: 9, loop01: -1, agency01: NaN, prediction01: 9, verification01: -1, recovery01: 9, at: -1 }], metrics: { closedLoop01: 9, integrity01: -1, bogus: 5 }, recoveryCount: -1, lastDecisionId: 5, lastOutcomeAt: -1, lastDigest: 5 });
  const st = e.snapshot();
  assert.equal(st.cycles, 0, 'val negative cycles -> 0');
  assert.equal(st.lastAt, 0, 'val negative lastAt -> 0');
  assert.equal(st.nextId, 1, 'val NaN nextId -> default');
  assert.equal(st.decisions.length, 1, 'val drops decision without id');
  assert.equal(st.decisions[0].action, 'wait', 'val unknown action -> wait');
  assert.equal(st.decisions[0].predicted01, 1, 'val over-1 predicted -> 1');
  assert.equal(st.decisions[0].confidence01, 0, 'val negative confidence -> 0');
  assert.equal(st.decisions[0].resolved, false, 'val non-boolean resolved -> false');
  assert.equal(st.unresolvedDecisions, 1, 'val recomputes unresolved');
  assert.equal(st.outcomes.length, 1, 'val drops outcome without decisionId');
  assert.equal(st.outcomes[0].basis, 'none', 'val unknown basis -> none');
  assert.equal(st.outcomes[0].reward01, 0, 'val NaN reward -> 0');
  assert.equal(st.outcomes[0].error01, 0, 'val negative error -> 0');
  assert.equal(st.perceptions.length, 1, 'val drops perception without id');
  assert.equal(st.perceptions[0].expectedGain01, 1, 'val over-1 expected gain -> 1');
  assert.equal(st.perceptions[0].verified01, 0, 'val NaN verified -> 0');
  assert.equal(st.causalLinks.length, 1, 'val drops causal link missing ids');
  assert.equal(st.causalLinks[0].effect01, 1, 'val over-1 effect -> 1');
  assert.equal(st.checkpoints.length, 1, 'val keeps well-formed checkpoint');
  assert.equal(st.checkpoints[0].digest, '', 'val non-string digest -> empty');
  assert.equal(st.checkpoints[0].outcomes, 0, 'val NaN outcomes -> 0');
  assert.equal(st.longitudinal.length, 1, 'val keeps longitudinal point');
  assert.equal(st.longitudinal[0].overall01, 1, 'val over-1 overall -> 1');
  assert.equal(st.longitudinal[0].agency01, 0, 'val NaN agency -> 0');
  assert.equal(st.metrics.closedLoop01, 1, 'val over-1 metric -> 1');
  assert.equal(st.metrics.integrity01, 0, 'val negative metric -> 0');
  assert.ok(!('bogus' in st.metrics), 'val drops unknown metric key');
  assert.equal(st.recoveryCount, 0, 'val negative recoveryCount -> 0');
  assert.equal(st.lastDecisionId, null, 'val non-string lastDecisionId -> null');
  assert.equal(st.lastOutcomeAt, 0, 'val negative lastOutcomeAt -> 0');
  assert.equal(st.lastDigest, '', 'val non-string lastDigest -> empty');
  assert.doesNotThrow(() => e.restore(hostile('decisions')));
  const eDefault = defaultVerifiedAutonomousLife();

  e.restore(eDefault);
  assert.deepEqual(e.snapshot(), eDefault, 'val default round-trips');
}

console.log('WORKPASS72_DEVELOPMENTAL_CONTROL_LIFETRAJECTORY_AUTOLIFE_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['P56IntegratedDevelopmentalMind', 'P63DevelopmentalOperatingSystem', 'IntegratedLifeTrajectoryEngine', 'VerifiedAutonomousLifeEngine'] }));
