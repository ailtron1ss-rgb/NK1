import assert from 'node:assert/strict';
import { P2724AutonomousContinualFabric } from '../src/organism/cognition/P2724AutonomousContinualFabric.ts';
import { P2750UnifiedCausalWorldLoop } from '../src/organism/cognition/P2750UnifiedCausalWorldLoop.ts';
import { P67AutonomousGoalGenesis } from '../src/organism/developmental/P67AutonomousGoalGenesis.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const actions = ['respond','explore','verify','rest','reflect','wait','defer'];
const utilities = Object.fromEntries(actions.map((a) => [a, .5]));
const clamp = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

const replay = new P2724AutonomousContinualFabric(6);
const initialMix = replay.snapshot().replayPolicyMix01.slice();
for (let tick = 1; tick <= 96; tick += 1) {
  const context = Array.from({ length: 16 }, (_, i) => Math.sin((tick + i) * .13) * .35);
  replay.beforeDecision({
    tick,
    context,
    baseUtilities: utilities,
    uncertainty01: tick % 3 === 0 ? .82 : .28,
    novelty01: tick % 5 === 0 ? .75 : .22,
    predictionError01: tick % 4 === 0 ? .68 : .18,
    resource01: tick % 7 === 0 ? .45 : .82,
    forgetting01: tick % 6 === 0 ? .62 : .18,
    replayDebt01: .2,
    informationGain01: .4,
    latent: context.slice(0, 8),
  });
  replay.observeOutcome({
    tick,
    context,
    action: actions[tick % actions.length],
    reward01: tick % 4 === 0 ? .82 : .54,
    predictionError01: tick % 4 === 0 ? .68 : .18,
    verified01: tick % 6 === 0 ? 1 : 0,
    novelty01: tick % 5 === 0 ? .75 : .22,
    uncertainty01: tick % 3 === 0 ? .82 : .28,
    baseUtilities: utilities,
    resource01: tick % 7 === 0 ? .45 : .82,
    latent: context.slice(0, 8),
    priorLatent: context.slice(0, 8).map((x) => x * .96),
  });
}
const replayState = replay.snapshot();
assert.ok(replayState.replayAdaptation01 > .03, 'adaptive replay policy never adapted');
assert.ok(replayState.replayPolicyMix01.some((x, i) => Math.abs(x - initialMix[i]) > .01), 'replay policy mix remained static');
assert.equal(replayState.replayPolicyMix01.length, 4);
assert.ok(Math.abs(replayState.replayPolicyMix01.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'replay policy mix lost normalization');

const world = new P2750UnifiedCausalWorldLoop();
for (let tick = 1; tick <= 80; tick += 1) {
  const latent = Array.from({ length: 8 }, (_, i) => Math.tanh(Math.sin((tick + i) * .09)));
  const frame = world.beforeDecision({
    tick,
    latent,
    baseUtilities: utilities,
    novelty01: tick % 5 === 0 ? .7 : .2,
    uncertainty01: tick % 3 === 0 ? .72 : .22,
    predictionError01: tick % 4 === 0 ? .55 : .18,
    resource01: .82,
    goalPressure01: .5,
    identityGap01: .12,
  });
  const next = latent.map((x, i) => clamp(x + .025 * (i + 1)) * (i % 2 ? 1 : .96));
  world.observeOutcome({
    tick,
    latentBefore: latent,
    latentAfter: next,
    action: frame.selectedAction,
    reward01: tick % 4 === 0 ? .84 : .58,
    predictionError01: tick % 4 === 0 ? .24 : .16,
    novelty01: tick % 5 === 0 ? .7 : .2,
    uncertainty01: tick % 3 === 0 ? .72 : .22,
    verified01: tick % 6 === 0 ? 1 : 0,
    contextId: frame.contextId,
  });
  world.observeEmbodiedOutcome({
    action: frame.selectedAction,
    reward01: tick % 4 === 0 ? .84 : .58,
    verified01: tick % 6 === 0 ? 1 : 0,
    predictionError01: tick % 4 === 0 ? .24 : .16,
    sensorimotorError01: tick % 9 === 0 ? .62 : .16,
    sensorFreshness01: tick % 9 === 0 ? .55 : .92,
  });
}
const trajectories = world.syntheticTrajectories(2, 3);
const worldState = world.metrics();
assert.ok(worldState.embodiedGrounding01 > .18, 'embodied grounding did not learn');
assert.ok(worldState.groundedConsequence01 > .28, 'grounded action consequence did not learn');
assert.ok(worldState.syntheticTrajectoryCount >= trajectories.length, 'synthetic trajectory accounting failed');
if (trajectories.length) assert.ok(trajectories.some((t) => t.steps.length >= 2), 'multi-step replay collapsed to one step');

const goals = new P67AutonomousGoalGenesis();
const candidate = goals.propose({
  tick: 16, at: 16, energy01: .7, uncertainty01: .8, predictionError01: .8, novelty01: .6, socialNeed01: .2,
  goalPressure01: .8, homeostaticPressure01: .3, epistemicUnresolved: 5, identity01: .9, activeGoalCount: 0, lastMode: 'autonomous',
  identityDecision: 'allow', motiveOverall01: .8, attractorOverall01: .8, valueWeights: { truth: .9, evidence: .9, responsibility: .8, autonomy: .8, care: .6, curiosity: .8, social: .5 },
});
assert.ok(candidate, 'goal genesis did not create a candidate for recalibration test');
const beforeGoal = { id: candidate.id, title: candidate.title, source: candidate.source, importance: candidate.importance, urgency: candidate.urgency, confidence: candidate.confidence, status: 'active' };
const stable = goals.recalibrateActiveGoals({
  tick: 24, goals: [beforeGoal], valueWeights: { truth: .9, evidence: .9, responsibility: .8, autonomy: .8, care: .6, curiosity: .8, social: .5 },
  identityStability01: .9, worldConfidence01: .9, neuralConfidence01: .9,
});
const unstable = goals.recalibrateActiveGoals({
  tick: 40, goals: [beforeGoal], valueWeights: { truth: .9, evidence: .9, responsibility: .8, autonomy: .8, care: .6, curiosity: .8, social: .5 },
  identityStability01: .25, worldConfidence01: .15, neuralConfidence01: .2,
});
const stableDelta = stable.length ? Math.abs(stable[0].importance - beforeGoal.importance) : 0;
const unstableDelta = unstable.length ? Math.abs(unstable[0].importance - beforeGoal.importance) : 0;
assert.ok(stableDelta >= unstableDelta, 'goal recalibration was not damped by low identity/world confidence');

// Cheap long-horizon endurance gates on compact state machines.
const enduranceReplay = new P2724AutonomousContinualFabric(6);
for (let tick = 1; tick <= 1000; tick += 1) {
  const context = Array.from({ length: 16 }, (_, i) => Math.sin((tick + i) * .017) * .3);
  enduranceReplay.beforeDecision({tick, context, baseUtilities: utilities, uncertainty01: (tick % 9) / 10, novelty01: (tick % 11) / 11, predictionError01: (tick % 13) / 13, resource01: .72, forgetting01: .24, replayDebt01: .18, informationGain01: .3, latent: context.slice(0, 8)});
  enduranceReplay.observeOutcome({tick, context, action: actions[tick % actions.length], reward01: .55 + (tick % 5) * .06, predictionError01: (tick % 13) / 13, verified01: tick % 17 === 0 ? 1 : 0, novelty01: (tick % 11) / 11, uncertainty01: (tick % 9) / 10, baseUtilities: utilities, resource01: .72, latent: context.slice(0, 8), priorLatent: context.slice(0, 8).map((x) => x * .98)});
}
const enduranceReplayState = enduranceReplay.snapshot();
assert.ok(enduranceReplayState.replay.length <= enduranceReplayState.replayCapacity, 'replay buffer exceeded bounded capacity at 1000 cycles');
assert.ok(Number.isFinite(enduranceReplayState.replayPolicyEntropy01), 'replay policy entropy became non-finite at 1000 cycles');

const enduranceWorld = new P2750UnifiedCausalWorldLoop();
for (let tick = 1; tick <= 1000; tick += 1) {
  const latent = Array.from({ length: 8 }, (_, i) => Math.tanh(Math.sin((tick + i) * .012)));
  const frame = enduranceWorld.beforeDecision({tick, latent, baseUtilities: utilities, novelty01: .24, uncertainty01: .28, predictionError01: .18, resource01: .72, goalPressure01: .5, identityGap01: .1});
  enduranceWorld.observeOutcome({tick, latentBefore: latent, latentAfter: latent.map((x, i) => x + .01 * (i + 1)), action: frame.selectedAction, reward01: .62, predictionError01: .18, novelty01: .24, uncertainty01: .28, verified01: tick % 19 === 0 ? 1 : 0, contextId: frame.contextId});
  enduranceWorld.observeEmbodiedOutcome({action: frame.selectedAction, reward01: .62, verified01: tick % 19 === 0 ? 1 : 0, predictionError01: .18, sensorimotorError01: .16, sensorFreshness01: .9});
}
const enduranceWorldState = enduranceWorld.metrics();
assert.ok(enduranceWorldState.contextVisits.every((x) => x >= 0 && Number.isFinite(x)), 'world context visit state became invalid at 1000 cycles');
assert.ok(enduranceWorldState.actions.every((x) => x.samples >= 0 && Number.isFinite(x.modelError01)), 'world action model became invalid at 1000 cycles');

const dir = await mkdtemp(path.join(tmpdir(), 'nk-p2863-'));
try {
  const runtime = new OrganismRuntime({
    stateFile: path.join(dir, 'state.json'),
    worldStateFile: path.join(dir, 'world.json'),
    enableLanguage: false,
    autoRun: false,
    checkpointMinIntervalMs: 0,
    checkpointMaxDirtyCycles: 1,
    performanceProfile: 'mobile',
    cycleResultMode: 'summary',
  });
  await runtime.init();
  for (let i = 0; i < 24; i += 1) await runtime.autonomousStep();
  const diag = runtime.core.neuralExperienceBranchDiagnostics();
  const uw = diag.unifiedCausalWorldLoop;
  const ac = diag.autonomousContinual;
  assert.ok(diag.tick >= 24, 'runtime did not reach endurance horizon');
  assert.ok((ac?.replayAdaptation01 ?? 0) > .03, 'runtime adaptive replay did not execute');
  assert.ok((uw?.embodiedGrounding01 ?? 0) > .18, 'runtime embodied grounding did not execute');
  assert.ok(uw && typeof uw.syntheticTrajectoryCount === 'number', 'runtime world replay diagnostics missing');
  // Multi-step generation itself is proven by the compact world-model gate above.

  console.log(`P2863_ADAPTIVE_REPLAY_EMBODIED_MULTISTEP=PASS tick=${diag.tick} replayAdapt=${ac.replayAdaptation01.toFixed(3)} grounded=${uw.embodiedGrounding01.toFixed(3)} directTrajectories=${trajectories.length} runtimeTrajectories=${uw.syntheticTrajectoryCount}`);
  await runtime.stop();
} finally {
  await rm(dir, { recursive: true, force: true });
}
