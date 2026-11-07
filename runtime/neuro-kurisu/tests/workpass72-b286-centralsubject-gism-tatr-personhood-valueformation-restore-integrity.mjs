import assert from 'node:assert/strict';
import { B286SelfConflictContinuityCore, defaultB286State } from '../src/organism/cognition/B286SelfConflictContinuityCore.ts';
import { CentralSubjectDynamics, defaultCentralSubjectDynamics } from '../src/organism/cognition/CentralSubjectDynamics.ts';
import { GoalIdentitySkillModulator } from '../src/organism/cognition/GoalIdentitySkillModulator.ts';
import { TaskAgnosticTransferRouter } from '../src/organism/cognition/TaskAgnosticTransferRouter.ts';
import { AutonomousPersonhoodKernel, defaultAutonomousPersonhoodState } from '../src/organism/system/AutonomousPersonhoodKernel.ts';
import { AutonomousValueFormationEngine, defaultAutonomousValue } from '../src/organism/system/AutonomousValueFormationEngine.ts';

/**
 * WorkPass72 — the identity/subject family: B286 self-conflict continuity core,
 * central subject dynamics, goal-identity-skill modulator, task-agnostic
 * transfer router, autonomous personhood kernel and autonomous value formation.
 * Each merged a persisted snapshot with a bare spread (or structuredClone),
 * letting NaN reach identity vectors/matrices, subject samples, action
 * preferences, agenda rows, value maps and revision history.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- B286SelfConflictContinuityCore -----------------------------------------
{
  const m = new B286SelfConflictContinuityCore();
  m.restore({ version: 1, tick: -1, steps: NaN, learningUpdates: -1, identity: [9, -1, 'x'], futureIdentities: [[9, -1]], commitmentWeights: [[9, -1]],
    traitValues: { curiosity: 9, 'bogus-trait': 1 },
    conflicts: [{ trait: 'curiosity', present01: 9, future01: -1, pastCommitment01: NaN, conflict01: 9, resolution01: -1 }, { trait: 'bogus' }, 'x'],
    relations: [{ relationId: 'r1', trust01: 9, attachment01: -1, boundary01: NaN, role01: 9, identityDelta01: -1 }, { trust01: 1 }, 'x'],
    episodes: [{ tick: -1, identity: [9], future: [9], relationId: 5, reward01: 9, importance01: -1, conflict01: NaN }, 'x'],
    commitmentsHistory: [{ tick: -1, trait: 'curiosity', value01: 9, strength01: -1 }, { trait: 'bogus' }, 'x'],
    activeFutureIndex: 99, futureHorizonWeights: [9, -1], selfContinuity01: 9, lastReward01: -1, lastAction: 'bogus' });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b286 negative tick -> 0');
  assert.equal(st.steps, 0, 'b286 NaN steps -> 0');
  assert.equal(st.identity.length, 24, 'b286 identity fixed length 24');
  assert.equal(st.identity[0], 1, 'b286 over-1 identity -> 1');
  assert.equal(st.identity[1], -1, 'b286 signed identity preserved');
  assert.equal(st.futureIdentities.length, 4, 'b286 future identities fixed horizon count');
  assert.equal(st.futureIdentities[0].length, 24, 'b286 future identity row fixed length 24');
  assert.equal(st.commitmentWeights.length, 8, 'b286 commitment matrix fixed trait count');
  assert.equal(st.commitmentWeights[0][0], 1, 'b286 over-1 weight -> 1');
  assert.equal(st.commitmentWeights[0][1], -1, 'b286 signed weight preserved');
  assert.equal(st.traitValues.curiosity, 1, 'b286 over-1 trait -> 1');
  assert.ok(!('bogus-trait' in st.traitValues), 'b286 drops unknown trait');
  assert.equal(st.conflicts.length, 1, 'b286 drops unknown-trait conflict');
  assert.equal(st.conflicts[0].present01, 1, 'b286 over-1 conflict present -> 1');
  assert.equal(st.relations.length, 1, 'b286 drops id-less relation');
  assert.equal(st.relations[0].trust01, 1, 'b286 over-1 trust -> 1');
  assert.equal(st.episodes.length, 1, 'b286 drops non-object episode');
  assert.equal(st.episodes[0].identity.length, 24, 'b286 episode identity fixed length 24');
  assert.equal(st.commitmentsHistory.length, 1, 'b286 drops unknown-trait commitment');
  assert.equal(st.activeFutureIndex, 3, 'b286 future index clamped into horizon range');
  assert.equal(st.futureHorizonWeights.length, 4, 'b286 horizon weights fixed length');
  assert.equal(st.selfContinuity01, 1, 'b286 over-1 continuity -> 1');
  assert.equal(st.lastReward01, 0, 'b286 negative reward -> 0');
  assert.equal(st.lastAction, undefined, 'b286 unknown last action dropped');
  assert.doesNotThrow(() => m.restore(hostile('identity')));
  assert.doesNotThrow(() => m.restore(null));
  const d = defaultB286State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b286 default round-trips');
}

// --- CentralSubjectDynamics -------------------------------------------------
{
  const m = new CentralSubjectDynamics();
  m.restore({ version: 1, samples: -1, outcomes: NaN, meanCoherence01: 9, meanAgency01: -1, coupling01: NaN, phase: 'bogus', phaseChanges: -1, lastCoherence01: 9, lastAgency01: -1,
    recent: [{ tick: -1, coherence01: 9, continuity01: -1, agency01: NaN, integration01: 9, phase: 'bogus' }, 'x'],
    perturbationHistory: [{ id: 'p1', at: -1, target: 5, baseline01: 9, perturbed01: -1, recovery01: NaN, delta01: 9, causalSupport01: -1 }, { at: 1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.samples, 0, 'csd negative samples -> 0');
  assert.equal(st.outcomes, 0, 'csd NaN outcomes -> 0');
  assert.equal(st.meanCoherence01, 1, 'csd over-1 coherence -> 1');
  assert.equal(st.meanAgency01, 0, 'csd negative agency -> 0');
  assert.equal(st.coupling01, .5, 'csd NaN coupling -> default');
  assert.equal(st.phase, 'integrating', 'csd unknown phase -> default');
  assert.equal(st.recent.length, 1, 'csd drops non-object recent row');
  assert.equal(st.recent[0].coherence01, 1, 'csd over-1 recent coherence -> 1');
  assert.equal(st.recent[0].phase, 'integrating', 'csd unknown recent phase -> integrating');
  assert.equal(st.perturbationHistory.length, 1, 'csd drops id-less perturbation');
  assert.equal(st.perturbationHistory[0].target, '', 'csd non-string target -> empty');
  assert.equal(st.perturbationHistory[0].delta01, 1, 'csd over-1 signed delta clamped');
  assert.doesNotThrow(() => m.restore(hostile('recent')));
  const d = defaultCentralSubjectDynamics();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'csd default round-trips');
}

// --- GoalIdentitySkillModulator ---------------------------------------------
{
  const m = new GoalIdentitySkillModulator();
  m.restore({ version: 1, tick: -1, updates: NaN, goalConditioning01: 9, identityConditioning01: -1, drift01: NaN, traitVector: [9, -1, 'x'], actionPreference: { respond: 9, bogus: 5 } });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'gism negative tick -> 0');
  assert.equal(st.updates, 0, 'gism NaN updates -> 0');
  assert.equal(st.goalConditioning01, 1, 'gism over-1 conditioning -> 1');
  assert.equal(st.identityConditioning01, 0, 'gism negative conditioning -> 0');
  assert.equal(st.drift01, 0, 'gism NaN drift -> 0');
  assert.equal(st.traitVector.length, 8, 'gism trait vector fixed length 8');
  assert.equal(st.traitVector[0], 1, 'gism over-1 trait -> 1');
  assert.equal(st.traitVector[1], 0, 'gism negative trait -> 0');
  assert.equal(st.traitVector[2], .55, 'gism non-numeric trait -> default');
  assert.deepEqual(Object.keys(st.actionPreference).sort(), ['defer', 'explore', 'reflect', 'respond', 'rest', 'verify', 'wait'], 'gism action preference covers exactly the known actions');
  assert.equal(st.actionPreference.respond, 1, 'gism over-1 preference clamped to 1');
  assert.equal(st.actionPreference.explore, 0, 'gism missing preference -> 0');
  assert.doesNotThrow(() => m.restore(hostile('actionPreference')));
  m.restore({});
  assert.deepEqual(m.snapshot(), new GoalIdentitySkillModulator().snapshot(), 'gism empty restore matches fresh');
}

// --- TaskAgnosticTransferRouter ---------------------------------------------
{
  const m = new TaskAgnosticTransferRouter();
  m.restore({ version: 1, tick: -1, evaluations: NaN, meanUtility01: 9, calibration01: -1, coverage01: NaN, selectedSkillId: 5, selectedAction: 'bogus', selectedConfidence01: 9, lastTaskFreeScore01: -1 });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'tatr negative tick -> 0');
  assert.equal(st.evaluations, 0, 'tatr NaN evaluations -> 0');
  assert.equal(st.meanUtility01, 1, 'tatr over-1 utility -> 1');
  assert.equal(st.calibration01, 0, 'tatr negative calibration -> 0');
  assert.equal(st.coverage01, 0, 'tatr NaN coverage -> 0');
  assert.equal(st.selectedSkillId, null, 'tatr non-string skill id -> null');
  assert.equal(st.selectedAction, null, 'tatr unknown selected action -> null');
  assert.equal(st.selectedConfidence01, 1, 'tatr over-1 confidence -> 1');
  assert.equal(st.lastTaskFreeScore01, 0, 'tatr negative task-free score -> 0');
  assert.doesNotThrow(() => m.restore(hostile('selectedAction')));
  m.restore({});
  assert.deepEqual(m.snapshot(), new TaskAgnosticTransferRouter().snapshot(), 'tatr empty restore matches fresh');
}

// --- AutonomousPersonhoodKernel ---------------------------------------------
{
  const m = new AutonomousPersonhoodKernel();
  m.restore({ version: 1, ticks: -1, initiatives: NaN, meanInitiative01: 9, externalDependence01: -1, lastMode: 5, lastAt: NaN, lastGeneratedAt: NaN, lesion01: 9,
    agenda: [{ id: 'a1', tick: -1, title: 5, reason: 5, mode: 'bogus', priority01: 9, commitment01: -1, status: 'bogus', createdAt: -1, updatedAt: NaN }, { title: 'x' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.ticks, 0, 'apk negative ticks -> 0');
  assert.equal(st.initiatives, 0, 'apk NaN initiatives -> 0');
  assert.equal(st.meanInitiative01, 1, 'apk over-1 initiative -> 1');
  assert.equal(st.externalDependence01, 0, 'apk negative dependence -> 0');
  assert.equal(st.lastMode, 'observe', 'apk non-string mode -> default');
  assert.equal(st.lastAt, 0, 'apk NaN lastAt -> 0');
  assert.equal(st.lastGeneratedAt, -999, 'apk NaN lastGeneratedAt -> default');
  assert.equal(st.lesion01, 1, 'apk over-1 lesion -> 1');
  assert.equal(st.agenda.length, 1, 'apk drops id-less agenda item');
  assert.equal(st.agenda[0].mode, 'maintenance', 'apk unknown mode -> maintenance');
  assert.equal(st.agenda[0].status, 'active', 'apk unknown status -> active');
  assert.equal(st.agenda[0].priority01, 1, 'apk over-1 priority -> 1');
  assert.equal(st.agenda[0].commitment01, 0, 'apk negative commitment -> 0');
  assert.doesNotThrow(() => m.restore(hostile('agenda')));
  const d = defaultAutonomousPersonhoodState();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'apk default round-trips');
}

// --- AutonomousValueFormationEngine -----------------------------------------
{
  const m = new AutonomousValueFormationEngine();
  m.restore({ version: 1, cycles: -1, revisions: NaN, accepted: -1, stability01: 9, meanEvidence01: -1, lastDomain: 5, lastDecision: 'bogus', values: { autonomy: 9, truthfulness: -1, bogus: 5 },
    history: [{ id: 'h1', domain: 5, delta01: 9, confidence01: -1, reason: 'bogus', evidence01: NaN, reversible: 'yes', at: -1 }, { domain: 'x' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'avfe negative cycles -> 0');
  assert.equal(st.revisions, 0, 'avfe NaN revisions -> 0');
  assert.equal(st.stability01, 1, 'avfe over-1 stability -> 1');
  assert.equal(st.meanEvidence01, 0, 'avfe negative evidence -> 0');
  assert.equal(st.lastDomain, 'none', 'avfe non-string domain -> default');
  assert.equal(st.lastDecision, 'hold', 'avfe unknown decision -> default');
  assert.equal(st.values.autonomy, 1, 'avfe over-1 value clamped');
  assert.equal(st.values.truthfulness, -1, 'avfe signed value preserved');
  assert.equal(st.values.bogus, 1, 'avfe keeps unknown domain values, clamped');
  assert.equal(st.history.length, 1, 'avfe drops id-less revision');
  assert.equal(st.history[0].delta01, 1, 'avfe over-1 revision delta -> 1');
  assert.equal(st.history[0].reason, 'experience', 'avfe unknown reason -> experience');
  assert.equal(st.history[0].evidence01, 0, 'avfe NaN evidence -> 0');
  assert.equal(st.history[0].reversible, false, 'avfe truthy-string reversible -> false');
  assert.equal(st.history[0].at, 0, 'avfe negative at -> 0');
  assert.doesNotThrow(() => m.restore(hostile('history')));
  const d = defaultAutonomousValue();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'avfe default round-trips');
}

console.log('WORKPASS72_B286_CENTRALSUBJECT_GISM_TATR_PERSONHOOD_VALUEFORMATION_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['B286SelfConflictContinuityCore', 'CentralSubjectDynamics', 'GoalIdentitySkillModulator', 'TaskAgnosticTransferRouter', 'AutonomousPersonhoodKernel', 'AutonomousValueFormationEngine'] }));
