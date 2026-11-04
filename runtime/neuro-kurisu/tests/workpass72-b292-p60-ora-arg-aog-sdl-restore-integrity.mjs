import assert from 'node:assert/strict';
import { B292CognitiveStateBus, defaultB292CognitiveStateBus } from '../src/organism/system/B292CognitiveStateBus.ts';
import { P60IdentityGuardian, defaultP60 } from '../src/organism/system/P60IdentityGuardian.ts';
import { OrganismResourceAllocator, defaultOrganismResourceAllocation } from '../src/organism/system/OrganismResourceAllocator.ts';
import { AdaptiveReplayGovernor, defaultAdaptiveReplayGovernorState } from '../src/organism/system/AdaptiveReplayGovernor.ts';
import { ActionOwnershipGraph, defaultActionOwnershipState } from '../src/organism/system/ActionOwnershipGraph.ts';
import { SelfDirectedLifeOrchestrator, defaultSelfDirectedLife } from '../src/organism/system/SelfDirectedLifeOrchestrator.ts';

/**
 * WorkPass72 — the executive/system cluster: the bounded cognitive state bus,
 * identity continuity guardian, resource allocator, adaptive replay governor,
 * action ownership graph and self-directed life orchestrator. Each merged a
 * persisted snapshot with a bare spread, letting NaN reach the shared
 * cognitive record, identity guard history, resource allocation maps, replay
 * policy weights/lane counts, ownership checkpoints and life commitments.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });
const ACTIONS = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const DOMAINS = ['perception', 'memory', 'world', 'planning', 'language', 'learning', 'reflection', 'research'];

// --- B292CognitiveStateBus ---------------------------------------------------
{
  const m = new B292CognitiveStateBus();
  m.restore({ version: 1, tick: -1, goalId: 7, goalPressure01: 9, identityContinuity01: -1, energy01: NaN,
    b290Mode: 5, b291Gate01: 9, workingIntent: 9, selectedAction: '', arousal01: 9 });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b292 negative tick -> 0');
  assert.equal(st.goalId, null, 'b292 non-string goal id -> null');
  assert.equal(st.goalPressure01, 1, 'b292 over-1 pressure -> 1');
  assert.equal(st.identityContinuity01, 0, 'b292 negative continuity -> 0');
  assert.equal(st.energy01, .82, 'b292 NaN energy -> default');
  assert.equal(st.b290Mode, 'consolidate', 'b292 non-string mode -> default');
  assert.equal(st.b291Gate01, 1, 'b292 over-1 gate -> 1');
  assert.equal(st.workingIntent, null, 'b292 non-string intent -> null');
  assert.equal(st.selectedAction, null, 'b292 empty action -> null');
  assert.equal(st.arousal01, 1, 'b292 over-1 arousal -> 1');
  assert.doesNotThrow(() => m.restore(hostile('goalPressure01')));
  const d = defaultB292CognitiveStateBus();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b292 default round-trips');
}

// --- P60IdentityGuardian -----------------------------------------------------
{
  const m = new P60IdentityGuardian();
  m.restore({ version: 1, checks: -1, vetoes: NaN, lastDecision: 'bogus', lastReason: 5,
    meanContinuity01: 9, history: [{ at: -1, continuity01: 9, stability01: -1, decision: 'bogus', reason: 7 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.checks, 0, 'p60 negative checks -> 0');
  assert.equal(st.vetoes, 0, 'p60 NaN vetoes -> 0');
  assert.equal(st.lastDecision, 'allow', 'p60 unknown decision -> allow');
  assert.equal(st.lastReason, 'initial', 'p60 non-string reason -> default');
  assert.equal(st.meanContinuity01, 1, 'p60 over-1 continuity -> 1');
  assert.equal(st.history.length, 1, 'p60 drops non-object history entry');
  assert.equal(st.history[0].continuity01, 1, 'p60 over-1 history continuity -> 1');
  assert.equal(st.history[0].stability01, 0, 'p60 negative history stability -> 0');
  assert.equal(st.history[0].decision, 'allow', 'p60 unknown history decision -> allow');
  assert.equal(st.history[0].reason, '', 'p60 non-string history reason -> empty');
  assert.doesNotThrow(() => m.restore(hostile('history')));
  const d = defaultP60();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p60 default round-trips');
}

// --- OrganismResourceAllocator ----------------------------------------------
{
  const m = new OrganismResourceAllocator();
  m.restore({ version: 1, cycles: -1, battery01: 9, thermal01: -1, dominantDomain: 'bogus', lastReason: 5,
    allocations: { planning: 9, memory: -1 }, actionBias: { explore: 9 } });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'ora negative cycles -> 0');
  assert.equal(st.battery01, 1, 'ora over-1 battery -> 1');
  assert.equal(st.thermal01, 0, 'ora negative thermal -> 0');
  assert.equal(st.dominantDomain, 'planning', 'ora unknown dominant domain -> default');
  assert.equal(st.lastReason, 'initial', 'ora non-string reason -> default');
  assert.equal(Object.keys(st.allocations).length, 8, 'ora allocations cover domains');
  assert.equal(st.allocations.planning, 1, 'ora over-1 allocation -> 1');
  assert.equal(st.allocations.memory, 0, 'ora negative allocation -> 0');
  assert.equal(st.allocations.world, 0, 'ora missing allocation -> 0');
  assert.equal(st.actionBias.explore, .18, 'ora over-range action bias -> .18');
  assert.equal(st.actionBias.respond, 0, 'ora missing action bias -> 0');
  assert.doesNotThrow(() => m.restore(hostile('allocations')));
  const d = defaultOrganismResourceAllocation();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'ora default round-trips');
}

// --- AdaptiveReplayGovernor --------------------------------------------------
{
  const m = new AdaptiveReplayGovernor();
  m.restore({ version: 1, cycles: -1, meanPriority01: 9, laneCounts: { fast: -1, medium: NaN, slow: 3 },
    policyWeights: { surprise: 9 }, lastLane: 'bogus', lastBudget: -1, lastTick: -1, recent: [{ id: 'd1', lane: 'bogus' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'arg negative cycles -> 0');
  assert.equal(st.meanPriority01, 1, 'arg over-1 priority -> 1');
  assert.equal(st.laneCounts.fast, 0, 'arg negative lane count -> 0');
  assert.equal(st.laneCounts.medium, 0, 'arg NaN lane count -> 0');
  assert.equal(st.laneCounts.slow, 3, 'arg valid lane count kept');
  const sum = Object.values(st.policyWeights).reduce((s, x) => s + x, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'arg policy weights normalize to 1');
  assert.ok(st.policyWeights.surprise >= .04, 'arg policy weight respects minimum');
  assert.equal(st.lastLane, 'none', 'arg unknown lane -> none');
  assert.equal(st.lastBudget, 0, 'arg negative budget -> 0');
  assert.equal(st.lastTick, 0, 'arg negative last tick -> 0');
  assert.equal(st.recent.length, 1, 'arg drops non-object decision');
  assert.equal(st.recent[0].lane, 'fast', 'arg unknown decision lane -> fast');
  assert.doesNotThrow(() => m.restore(hostile('recent')));
  const d = defaultAdaptiveReplayGovernorState();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'arg default round-trips');
}

// --- ActionOwnershipGraph ----------------------------------------------------
{
  const m = new ActionOwnershipGraph();
  m.restore({ version: 1, cycles: -1, finalOwner: 5, lastSelectedAction: '', unauthorizedAfterFinalizer: NaN,
    checkpoints: [{ tick: -1, stage: 'bogus', changedCandidates: -1, selectedAction: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'aog negative cycles -> 0');
  assert.equal(st.finalOwner, 'governance-finalization', 'aog non-string owner -> default');
  assert.equal(st.lastSelectedAction, null, 'aog empty selected action -> null');
  assert.equal(st.unauthorizedAfterFinalizer, 0, 'aog NaN counter -> 0');
  assert.equal(st.checkpoints.length, 1, 'aog drops non-object checkpoint');
  assert.equal(st.checkpoints[0].tick, 0, 'aog negative checkpoint tick -> 0');
  assert.equal(st.checkpoints[0].stage, 'final', 'aog unknown stage -> final');
  assert.equal(st.checkpoints[0].changedCandidates, 0, 'aog negative changed candidates -> 0');
  assert.equal(st.checkpoints[0].selectedAction, null, 'aog non-string checkpoint action -> null');
  assert.doesNotThrow(() => m.restore(hostile('checkpoints')));
  const d = defaultActionOwnershipState();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'aog default round-trips');
}

// --- SelfDirectedLifeOrchestrator -------------------------------------------
{
  const m = new SelfDirectedLifeOrchestrator();
  m.restore({ version: 1, cycles: -1, initiatives: NaN, meanAgency01: 9, lastDomain: 'bogus', lastReason: 5,
    commitments: [{ id: '', domain: 'bogus', priority01: 9, status: 'bogus', source: 'bogus' }, { id: 'c1', domain: 'learning', progress01: -1, revisions: -1 }, 'x'],
    history: [{ at: -1, domain: 'bogus', score01: 9, autonomous: 'yes' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'sdl negative cycles -> 0');
  assert.equal(st.initiatives, 0, 'sdl NaN initiatives -> 0');
  assert.equal(st.meanAgency01, 1, 'sdl over-1 agency -> 1');
  assert.equal(st.lastDomain, 'maintenance', 'sdl unknown last domain -> maintenance');
  assert.equal(st.lastReason, 'initial', 'sdl non-string reason -> default');
  assert.equal(st.commitments.length, 1, 'sdl drops id-less and non-object commitments');
  const c = st.commitments[0];
  assert.equal(c.domain, 'learning', 'sdl valid commitment domain kept');
  assert.equal(c.progress01, 0, 'sdl negative progress -> 0');
  assert.equal(c.revisions, 0, 'sdl negative revisions -> 0');
  assert.equal(st.history.length, 1, 'sdl drops non-object history entry');
  assert.equal(st.history[0].domain, 'maintenance', 'sdl unknown history domain -> maintenance');
  assert.equal(st.history[0].score01, 1, 'sdl over-1 history score -> 1');
  assert.equal(st.history[0].autonomous, true, 'sdl non-boolean autonomous coerced');
  assert.doesNotThrow(() => m.restore(hostile('commitments')));
  const d = defaultSelfDirectedLife();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'sdl default round-trips');
}

console.log('WORKPASS72_B292_P60_ORA_ARG_AOG_SDL_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['B292CognitiveStateBus', 'P60IdentityGuardian', 'OrganismResourceAllocator', 'AdaptiveReplayGovernor', 'ActionOwnershipGraph', 'SelfDirectedLifeOrchestrator'] }));
