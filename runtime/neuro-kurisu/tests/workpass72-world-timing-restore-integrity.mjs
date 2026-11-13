import assert from 'node:assert/strict';
import { LearnedResidualWorldModel, defaultLearnedResidual } from '../src/organism/world/LearnedResidualWorldModel.ts';
import { PhoneBodyWorldModel, defaultPhoneBodyWorld } from '../src/organism/world/PhoneBodyWorldModel.ts';
import { WorldModelEnsembleController, defaultWorldEnsemble } from '../src/organism/system/WorldModelEnsembleController.ts';
import { CognitiveSpineScheduler, defaultCognitiveSpineSchedule } from '../src/organism/system/CognitiveSpineScheduler.ts';

/**
 * WorkPass72 — world-model / cadence restore integrity. These owners merged the
 * persisted snapshot with a bare (or shallow nested) spread, so NaN reached
 * residual reward corrections, body battery/energy EMAs, ensemble member
 * reliability and the cognitive-spine cadence counters.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);
const OPERATIONS = ['research', 'world-rollout', 'shadow', 'project'];

// --- LearnedResidualWorldModel ---------------------------------------------
{
  const m = new LearnedResidualWorldModel();
  m.restore({ byAction: { explore: { samples: NaN, mean01: NaN, variance01: -1, lastError01: Infinity, lastUpdatedAt: -5 }, ['x'.repeat(200)]: { samples: 1 }, junk: 'nope' }, totalSamples: -3, modelVersion: NaN });
  const st = m.snapshot();
  assert.equal(st.totalSamples, 0, 'residual negative totalSamples -> 0');
  assert.equal(st.modelVersion, 1, 'residual NaN modelVersion -> 1');
  const s = st.byAction.explore;
  finite(s.samples, 'residual samples');
  assert.equal(s.samples, 0, 'residual NaN samples -> 0');
  finite(s.mean01, 'residual mean');
  assert.equal(s.mean01, .5, 'residual NaN mean -> .5');
  assert.equal(s.variance01, 0, 'residual negative variance -> 0');
  finite(s.lastError01, 'residual lastError');
  assert.equal(s.lastUpdatedAt, 0, 'residual negative lastUpdatedAt -> 0');
  assert.ok(!('junk' in st.byAction), 'residual drops non-object rows');
  assert.equal(Object.keys(st.byAction).length, 2, 'residual keeps object rows only');
  const pred = m.predict('explore', .7);
  finite(pred.predicted, 'residual predicted');
  assert.doesNotThrow(() => m.restore({ get byAction() { throw new Error('hostile'); } }));
  const d = defaultLearnedResidual();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'residual default round-trips');
}

// --- PhoneBodyWorldModel ----------------------------------------------------
{
  const b = new PhoneBodyWorldModel();
  b.restore({ version: 1, observations: -2, transitions: NaN, last: { at: -1, battery01: NaN, thermal01: 9, cpu01: NaN, ram01: -1, networkOnline: 'yes', screenInteractive: true, charging: 0, bodyEnergy01: NaN, cognitiveCapacity01: Infinity }, meanDrainPerCycle01: NaN, meanThermalRise01: -1, meanCapacityDrop01: 9, resourceRisk01: NaN, projectedBattery01: 2 });
  const st = b.snapshot();
  assert.equal(st.observations, 0, 'body negative observations -> 0');
  assert.equal(st.transitions, 0, 'body NaN transitions -> 0');
  finite(st.meanDrainPerCycle01, 'body drain');
  assert.equal(st.meanDrainPerCycle01, 0, 'body NaN drain -> 0');
  assert.equal(st.meanThermalRise01, 0, 'body negative thermal -> 0');
  assert.equal(st.meanCapacityDrop01, 1, 'body over-1 capacity -> 1');
  finite(st.resourceRisk01, 'body risk');
  assert.equal(st.projectedBattery01, 1, 'body over-1 battery -> 1');
  const l = st.last;
  finite(l.battery01, 'body last battery');
  assert.equal(l.battery01, .75, 'body NaN battery falls back to projection');
  assert.equal(l.at, 0, 'body negative at -> 0');
  assert.equal(l.networkOnline, null, 'body non-boolean network -> null');
  assert.equal(l.screenInteractive, true, 'body boolean screen preserved');
  assert.equal(l.charging, null, 'body numeric charging -> null');
  assert.doesNotThrow(() => b.restore({ get last() { throw new Error('hostile'); } }));
  const d = defaultPhoneBodyWorld();
  b.restore(d);
  assert.deepEqual(b.snapshot(), d, 'body default round-trips');
}

// --- WorldModelEnsembleController ------------------------------------------
{
  const e = new WorldModelEnsembleController();
  e.restore({ version: 3, predictions: NaN, outcomes: -1, disagreements: Infinity, meanDisagreement01: 5, selected: { worldModel2: NaN, p27: -3 }, members: { worldModel2: { samples: NaN, reliability01: NaN, lastError01: -1, lastAt: -2 }, junk: {} }, pendingPredictions: { ok: { candidates: [] }, bad: { candidates: 'no' }, junk: null }, predictionSequence: NaN, lastDecision: { action: 'x', selected: 'bogus', agreement01: NaN, uncertainty01: 9, at: -1 } });
  const st = e.snapshot();
  assert.equal(st.predictions, 0, 'ensemble NaN predictions -> 0');
  assert.equal(st.outcomes, 0, 'ensemble negative outcomes -> 0');
  assert.equal(st.disagreements, 0, 'ensemble Infinity disagreements -> 0');
  assert.equal(st.meanDisagreement01, 1, 'ensemble over-1 mean -> 1');
  assert.equal(st.selected.worldModel2, 0, 'ensemble NaN selected -> 0');
  assert.equal(st.selected.p27, 0, 'ensemble negative selected -> 0');
  assert.equal(st.predictionSequence, 0, 'ensemble NaN sequence -> 0');
  for (const m of ['worldModel2', 'p27', 'residual', 'contextual']) {
    const s = st.members[m];
    finite(s.reliability01, `ensemble ${m} reliability`);
    finite(s.samples, `ensemble ${m} samples`);
    assert.equal(s.lastAt >= 0, true, `ensemble ${m} lastAt non-negative`);
  }
  assert.equal(st.members.worldModel2.reliability01, .25, 'ensemble NaN reliability -> default');
  assert.equal(st.members.worldModel2.lastError01, 0, 'ensemble negative lastError -> 0');
  assert.equal(Object.keys(st.pendingPredictions).length, 1, 'ensemble keeps only ticket with candidates array');
  assert.equal(st.lastDecision.selected, 'worldModel2', 'ensemble unknown selected member -> default');
  assert.equal(st.lastDecision.at, 0, 'ensemble negative decision at -> 0');
  assert.doesNotThrow(() => e.restore({ get members() { throw new Error('hostile'); } }));
  const d = defaultWorldEnsemble();
  e.restore(d);
  assert.deepEqual(e.snapshot(), d, 'ensemble default round-trips');
}

// --- CognitiveSpineScheduler -----------------------------------------------
{
  const s = new CognitiveSpineScheduler();
  s.restore({ version: 1, mode: 'bogus', lastTick: NaN, lastDecisionAt: -1, runs: { research: NaN, shadow: -2 }, skips: { project: Infinity }, opportunities: {}, savings01: 9, lastReason: 7 });
  const st = s.snapshot();
  assert.equal(st.mode, 'balanced', 'spine unknown mode -> default');
  assert.equal(st.lastTick, 0, 'spine NaN lastTick -> 0');
  assert.equal(st.lastDecisionAt, 0, 'spine negative lastDecisionAt -> 0');
  assert.equal(st.savings01, 1, 'spine over-1 savings -> 1');
  assert.equal(st.lastReason, 'initial', 'spine non-string reason -> default');
  for (const op of OPERATIONS) {
    finite(st.runs[op], `spine runs ${op}`);
    finite(st.skips[op], `spine skips ${op}`);
    finite(st.opportunities[op], `spine opps ${op}`);
  }
  assert.equal(st.runs.research, 0, 'spine NaN run -> 0');
  assert.equal(st.runs.shadow, 0, 'spine negative run -> 0');
  assert.equal(st.skips.project, 0, 'spine Infinity skip -> 0');
  const decision = s.decide({ tick: 1, surprise01: .2, predictionError01: .2, novelty01: .2, goalPressure01: .2, budgetMode: 'balanced', remainingBudget01: .5, externalInput: false, awake: true });
  assert.ok(OPERATIONS.every((op) => typeof decision.run[op] === 'boolean'), 'spine decide stays well-formed after poisoned restore');
  assert.doesNotThrow(() => s.restore({ get runs() { throw new Error('hostile'); } }));
  const d = defaultCognitiveSpineSchedule();
  s.restore(d);
  assert.deepEqual(s.snapshot(), d, 'spine default round-trips');
}

console.log('WORKPASS72_WORLD_TIMING_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['LearnedResidualWorldModel', 'PhoneBodyWorldModel', 'WorldModelEnsembleController', 'CognitiveSpineScheduler'] }));
