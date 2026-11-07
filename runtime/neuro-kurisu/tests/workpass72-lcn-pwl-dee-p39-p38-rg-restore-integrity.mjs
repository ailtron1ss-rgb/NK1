import assert from 'node:assert/strict';
import { LifeCourseNavigator, defaultLifeCourseNavigator } from '../src/organism/learning/LifeCourseNavigator.ts';
import { PersonalWorldlineEngine, defaultPersonalWorldline } from '../src/organism/learning/PersonalWorldlineEngine.ts';
import { DevelopmentalExecutiveEngine, defaultDevelopmentalExecutive } from '../src/organism/learning/DevelopmentalExecutiveEngine.ts';
import { P39ContinuousArtificialLifeEngine, defaultP39ContinuousLife } from '../src/organism/learning/P39ContinuousArtificialLife.ts';
import { P38AutonomousCausalResearchEngine, defaultP38Research } from '../src/organism/learning/P38AutonomousCausalResearch.ts';
import { ResearchGradeOrganismEngine, defaultResearchGradeOrganism } from '../src/organism/learning/ResearchGradeOrganismEngine.ts';

/**
 * WorkPass72 — the learning/lifecycle cluster: the life-course navigator,
 * personal worldline engine, developmental executive engine, P39 continuous
 * artificial life engine, P38 autonomous causal research engine and the
 * research-grade organism engine. Each merged a persisted snapshot with a bare
 * spread, letting NaN/negative/hostile values reach projections, worldline
 * threads, executive projects and decisions, life/sleep records, research
 * hypotheses/trials/evidence and the longitudinal/replication/recovery ledgers.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- LifeCourseNavigator -----------------------------------------------------
{
  const m = new LifeCourseNavigator();
  m.restore({ version: 1, cycles: -1, immediate01: 9, near01: -1, focusHorizon: 'bogus', focusGoalId: 5, lastReason: 7, lastAt: -1,
    projections: [{ goalId: 'g1', horizon: 'bogus', value01: 9 }, { horizon: 'near' }, 'x'],
    conflicts: [{ a: 'g1', b: 'g2', conflict01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'lcn negative cycles -> 0');
  assert.equal(st.immediate01, 1, 'lcn over-1 horizon weight -> 1');
  assert.equal(st.near01, 0, 'lcn negative horizon weight -> 0');
  assert.equal(st.focusHorizon, 'none', 'lcn unknown focus horizon -> none');
  assert.equal(st.focusGoalId, null, 'lcn non-string focus goal -> null');
  assert.equal(st.lastReason, 'initial', 'lcn non-string reason -> default');
  assert.equal(st.lastAt, 0, 'lcn negative lastAt -> 0');
  assert.equal(st.projections.length, 1, 'lcn drops id-less and non-object projections');
  assert.equal(st.projections[0].horizon, 'near', 'lcn unknown projection horizon -> near');
  assert.equal(st.projections[0].value01, 1, 'lcn over-1 projection value -> 1');
  assert.equal(st.conflicts.length, 1, 'lcn drops non-object conflict');
  assert.equal(st.conflicts[0].conflict01, 1, 'lcn over-1 conflict -> 1');
  assert.doesNotThrow(() => m.restore(hostile('projections')));
  const d = defaultLifeCourseNavigator();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'lcn default round-trips');
}

// --- PersonalWorldlineEngine -------------------------------------------------
{
  const m = new PersonalWorldlineEngine();
  m.restore({ version: 1, cycles: -1, focusId: 5, focusKind: 'bogus', lastReason: 7, lastAt: -1,
    worldlineStability01: 9, commitmentDebt01: -1,
    threads: [{ id: 'self:worldline', kind: 'bogus', label: 5, episodes: -1, trust01: 9, goalIds: ['g1', 5], contexts: ['c1', 5] }, { kind: 'self' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'pwl negative cycles -> 0');
  assert.equal(st.focusId, null, 'pwl non-string focus id -> null');
  assert.equal(st.focusKind, 'none', 'pwl unknown focus kind -> none');
  assert.equal(st.lastReason, 'initial', 'pwl non-string reason -> default');
  assert.equal(st.lastAt, 0, 'pwl negative lastAt -> 0');
  assert.equal(st.worldlineStability01, 1, 'pwl over-1 stability -> 1');
  assert.equal(st.commitmentDebt01, 0, 'pwl negative debt -> 0');
  assert.equal(st.threads.length, 1, 'pwl drops id-less and non-object threads');
  const t = st.threads[0];
  assert.equal(t.kind, 'entity', 'pwl unknown thread kind -> entity');
  assert.equal(t.label, 'unknown', 'pwl non-string label -> unknown');
  assert.equal(t.episodes, 0, 'pwl negative episodes -> 0');
  assert.equal(t.trust01, 1, 'pwl over-1 trust -> 1');
  assert.deepEqual(t.goalIds, ['g1'], 'pwl thread goal ids filtered');
  assert.deepEqual(t.contexts, ['c1'], 'pwl thread contexts filtered');
  assert.doesNotThrow(() => m.restore(hostile('threads')));
  const d = defaultPersonalWorldline();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'pwl default round-trips');
}

// --- DevelopmentalExecutiveEngine -------------------------------------------
{
  const m = new DevelopmentalExecutiveEngine();
  m.restore({ version: 1, cycles: -1, activeProjectId: 5, lastDecision: 7, lastAt: -1, strategicCoherence01: 9,
    projects: [{ id: 'p1', status: 'bogus', phase: 'bogus', priority01: 9, steps: [{ id: 's1', status: 'bogus', action: 'bogus' }, 'x'], contexts: ['c1', 5] }, { objective: 'no id' }, 'x'],
    decisions: [{ chosenAction: 'bogus', phase: 'bogus', score01: 9, reasons: ['r', 5] }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'dee negative cycles -> 0');
  assert.equal(st.activeProjectId, null, 'dee non-string active project -> null');
  assert.equal(st.lastDecision, 'idle', 'dee non-string last decision -> default');
  assert.equal(st.lastAt, 0, 'dee negative lastAt -> 0');
  assert.equal(st.strategicCoherence01, 1, 'dee over-1 coherence -> 1');
  assert.equal(st.projects.length, 1, 'dee drops id-less and non-object projects');
  const p = st.projects[0];
  assert.equal(p.status, 'active', 'dee unknown status -> active');
  assert.equal(p.phase, 'orient', 'dee unknown phase -> orient');
  assert.equal(p.priority01, 1, 'dee over-1 priority -> 1');
  assert.equal(p.steps.length, 1, 'dee drops non-object steps');
  assert.equal(p.steps[0].status, 'pending', 'dee unknown step status -> pending');
  assert.equal(p.steps[0].action, 'reflect', 'dee unknown step action -> reflect');
  assert.deepEqual(p.contexts, ['c1'], 'dee contexts filtered');
  assert.equal(st.decisions.length, 1, 'dee drops non-object decisions');
  assert.equal(st.decisions[0].chosenAction, 'reflect', 'dee unknown decision action -> reflect');
  assert.equal(st.decisions[0].score01, 1, 'dee over-1 decision score -> 1');
  assert.deepEqual(st.decisions[0].reasons, ['r'], 'dee decision reasons filtered');
  assert.doesNotThrow(() => m.restore(hostile('projects')));
  const d = defaultDevelopmentalExecutive();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'dee default round-trips');
}

// --- P39ContinuousArtificialLifeEngine --------------------------------------
{
  const m = new P39ContinuousArtificialLifeEngine();
  m.restore({ version: 1, lifeTicks: -1, phase: 'bogus', sleepDebtHours: -3, recovery01: 9, maintenanceDue01: -1, birthAt: -1,
    host: { current: 5, history: ['h1', 5], transfers: -1 },
    sleepSessions: [{ startedAt: -1, quality01: 9, reason: 5 }, 'x'],
    maintenance: { runs: -1, compactions: NaN, lastReason: 5 },
    stress: { resourceEvents: -1 },
    events: [{ id: 'e1', type: 'bogus', at: -1, detail: 5 }, 'x'],
    metrics: { daysObserved01: 9, continuityGaps: -1 } });
  const st = m.snapshot();
  assert.equal(st.lifeTicks, 0, 'p39 negative lifeTicks -> 0');
  assert.equal(st.phase, 'wake', 'p39 unknown phase -> wake');
  assert.equal(st.sleepDebtHours, 0, 'p39 negative sleep debt -> 0');
  assert.equal(st.recovery01, 1, 'p39 over-1 recovery -> 1');
  assert.equal(st.maintenanceDue01, 0, 'p39 negative maintenance due -> 0');
  assert.equal(st.birthAt, 0, 'p39 negative birthAt -> 0');
  assert.equal(st.host.current, 'unknown-host', 'p39 non-string host -> default');
  assert.deepEqual(st.host.history, ['h1'], 'p39 host history filtered');
  assert.equal(st.host.transfers, 0, 'p39 negative transfers -> 0');
  assert.equal(st.sleepSessions.length, 1, 'p39 drops non-object sleep session');
  assert.equal(st.sleepSessions[0].startedAt, 0, 'p39 negative session startedAt -> 0');
  assert.equal(st.sleepSessions[0].quality01, 1, 'p39 over-1 session quality -> 1');
  assert.equal(st.maintenance.runs, 0, 'p39 negative maintenance runs -> 0');
  assert.equal(st.maintenance.compactions, 0, 'p39 NaN compactions -> 0');
  assert.equal(st.maintenance.lastReason, '', 'p39 non-string maintenance reason -> default');
  assert.equal(st.stress.resourceEvents, 0, 'p39 negative stress events -> 0');
  assert.equal(st.events.length, 1, 'p39 drops non-object events');
  assert.equal(st.events[0].type, 'phase', 'p39 unknown event type -> phase');
  assert.equal(st.events[0].at, 0, 'p39 negative event at -> 0');
  assert.equal(st.metrics.daysObserved01, 1, 'p39 over-1 days observed -> 1');
  assert.equal(st.metrics.continuityGaps, 0, 'p39 negative continuity gaps -> 0');
  assert.doesNotThrow(() => m.restore(hostile('events')));
  const d = defaultP39ContinuousLife();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p39 default round-trips');
}

// --- P38AutonomousCausalResearchEngine --------------------------------------
{
  const m = new P38AutonomousCausalResearchEngine();
  m.restore({ version: 1, cycles: -1, budget01: 9, currentHypothesisId: 5, lastCycleAt: -1, actionBias: { verify: 9, respond: -9 },
    hypotheses: [{ id: 'h1', area: 'bogus', status: 'bogus', priority01: 9, evidence: ['e1', 5], result01: 9 }, { title: 'no id' }, 'x'],
    trials: [{ id: 't1', delta01: NaN, runs: -1, replicaDeltas: [1, NaN] }, 'x'],
    evidence: [{ id: 'ev1', level: 'bogus', trialIds: ['t1', 5] }, 'x'],
    metrics: { hypothesisQuality01: 9 } });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'p38 negative cycles -> 0');
  assert.equal(st.budget01, 1, 'p38 over-1 budget -> 1');
  assert.equal(st.currentHypothesisId, null, 'p38 non-string current hypothesis -> null');
  assert.equal(st.lastCycleAt, 0, 'p38 negative last cycle -> 0');
  assert.equal(st.actionBias.verify, .5, 'p38 over-range action bias -> .5');
  assert.equal(st.actionBias.respond, -.5, 'p38 under-range action bias -> -.5');
  assert.equal(st.hypotheses.length, 1, 'p38 drops id-less and non-object hypotheses');
  assert.equal(st.hypotheses[0].area, 'policy', 'p38 unknown area -> policy');
  assert.equal(st.hypotheses[0].status, 'proposed', 'p38 unknown status -> proposed');
  assert.equal(st.hypotheses[0].priority01, 1, 'p38 over-1 priority -> 1');
  assert.deepEqual(st.hypotheses[0].evidence, ['e1'], 'p38 hypothesis evidence filtered');
  assert.equal(st.trials.length, 1, 'p38 drops non-object trials');
  assert.equal(st.trials[0].delta01, 0, 'p38 NaN delta -> 0');
  assert.equal(st.trials[0].runs, 0, 'p38 negative runs -> 0');
  assert.deepEqual(st.trials[0].replicaDeltas, [1, 0], 'p38 replica deltas finite');
  assert.equal(st.evidence.length, 1, 'p38 drops non-object evidence');
  assert.equal(st.evidence[0].level, 'sandboxed-observed', 'p38 unknown evidence level -> default');
  assert.deepEqual(st.evidence[0].trialIds, ['t1'], 'p38 evidence trial ids filtered');
  assert.equal(st.metrics.hypothesisQuality01, 1, 'p38 over-1 metric -> 1');
  assert.doesNotThrow(() => m.restore(hostile('hypotheses')));
  const d = defaultP38Research();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p38 default round-trips');
}

// --- ResearchGradeOrganismEngine --------------------------------------------
{
  const m = new ResearchGradeOrganismEngine();
  m.restore({ version: 2, cycles: -1, nextId: -1, lastAt: -1, architectureDigest: 5,
    decisions: [{ id: 'd1', action: 'bogus', predicted01: 9 }, 'x'],
    outcomes: [{ decisionId: 'd1', reward01: NaN, actual01: 9 }, 'x'],
    evidence: [{ id: 'e1', action: 'bogus', evidenceKind: 'bogus', matched: 'yes' }, 'x'],
    intentions: [{ id: 'i1', status: 'bogus', priority01: 9 }, 'x'],
    longitudinal: [{ id: 'l1', endedAt: -1, status: 'bogus' }, 'x'],
    replications: [{ id: 'r1', component: 'bogus', delta01: NaN }, 'x'],
    recovery: [{ id: 'f1', kind: 'bogus', continuity01: 9 }, 'x'],
    production: [{ uptimeMs: -1, eventLoopLagMs: NaN, cpuLoad01: 9 }, 'x'],
    metrics: { closedLoop01: 9 } });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'rg negative cycles -> 0');
  assert.equal(st.nextId, 1, 'rg negative nextId -> 1');
  assert.equal(st.lastAt, 0, 'rg negative lastAt -> 0');
  assert.equal(st.architectureDigest, '', 'rg non-string digest -> default');
  assert.equal(st.decisions.length, 1, 'rg drops non-object decisions');
  assert.equal(st.decisions[0].action, 'reflect', 'rg unknown decision action -> reflect');
  assert.equal(st.decisions[0].predicted01, 1, 'rg over-1 predicted -> 1');
  assert.equal(st.outcomes.length, 1, 'rg drops non-object outcomes');
  assert.equal(st.outcomes[0].reward01, 0, 'rg NaN reward -> 0');
  assert.equal(st.outcomes[0].actual01, 1, 'rg over-1 actual -> 1');
  assert.equal(st.evidence.length, 1, 'rg drops non-object evidence');
  assert.equal(st.evidence[0].evidenceKind, 'manual', 'rg unknown evidence kind -> manual');
  assert.equal(st.evidence[0].matched, true, 'rg non-boolean matched coerced');
  assert.equal(st.intentions.length, 1, 'rg drops non-object intentions');
  assert.equal(st.intentions[0].status, 'open', 'rg unknown intention status -> open');
  assert.equal(st.intentions[0].priority01, 1, 'rg over-1 intention priority -> 1');
  assert.equal(st.longitudinal.length, 1, 'rg drops non-object longitudinal windows');
  assert.equal(st.longitudinal[0].endedAt, 0, 'rg negative endedAt -> 0');
  assert.equal(st.longitudinal[0].status, 'active', 'rg unknown window status -> active');
  assert.equal(st.replications.length, 1, 'rg drops non-object replications');
  assert.equal(st.replications[0].component, 'memory', 'rg unknown component -> memory');
  assert.equal(st.replications[0].delta01, 0, 'rg NaN replication delta -> 0');
  assert.equal(st.recovery.length, 1, 'rg drops non-object recovery events');
  assert.equal(st.recovery[0].kind, 'restart', 'rg unknown fault kind -> restart');
  assert.equal(st.recovery[0].continuity01, 1, 'rg over-1 recovery continuity -> 1');
  assert.equal(st.production.length, 1, 'rg drops non-object production samples');
  assert.equal(st.production[0].uptimeMs, 0, 'rg negative uptime -> 0');
  assert.equal(st.production[0].eventLoopLagMs, 0, 'rg NaN event loop lag -> 0');
  assert.equal(st.production[0].cpuLoad01, 1, 'rg over-1 cpu load -> 1');
  assert.equal(st.metrics.closedLoop01, 1, 'rg over-1 metric -> 1');
  assert.doesNotThrow(() => m.restore(hostile('decisions')));
  const d = defaultResearchGradeOrganism();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'rg default round-trips');
}

console.log('WORKPASS72_LCN_PWL_DEE_P39_P38_RG_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['LifeCourseNavigator', 'PersonalWorldlineEngine', 'DevelopmentalExecutiveEngine', 'P39ContinuousArtificialLifeEngine', 'P38AutonomousCausalResearchEngine', 'ResearchGradeOrganismEngine'] }));
