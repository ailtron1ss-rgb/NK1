import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const cfg = {
  performanceProfile: 'mobile',
  cycleResultMode: 'operational',
  enableTemporalResolutionGovernor: false,
  operationalPulseEvery: 1,
  checkpointMaxDirtyCycles: 256,
  checkpointMinIntervalMs: 600000,
};
const actions = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const trainContext = { social: 0, epistemic: 1, autonomy: 0, maintenance: 0 };
const holdoutContext = { social: 1, epistemic: 0, autonomy: 0, maintenance: 0 };
const steps = 72;
const directory = await mkdtemp(path.join(tmpdir(), 'nk-b526-personality-'));
const store = new MemoryStateStore();
const runtime = new OrganismRuntime({
  stateFile: path.join(directory, 'state.json'),
  worldStateFile: path.join(directory, 'world.json'),
  enableLanguage: false,
  performanceProfile: 'mobile',
  stateStore: store,
  worldStateStore: store,
  journal: new BoundedOperationalJournal(),
});
let stopped = false;
const stopRuntime = async () => {
  if (stopped) return;
  stopped = true;
  await runtime.stop();
};

try {
  await runtime.init();
  const learner = runtime.core;
  learner.b299CausalPersonalitySetContext(holdoutContext);
  const initialBias = Object.fromEntries(actions.map(action => [action, learner.b299CausalPersonalityBias(action)]));
  const actionCounts = Object.fromEntries(actions.map(action => [action, 0]));

  // Train through the runtime's normal cycle and outcome path. No chosen action is imposed,
  // and no outcome is manually injected: every sample comes from the action Core actually used.
  for (let i = 0; i < steps; i++) {
    learner.b299CausalPersonalitySetContext(trainContext);
    await runtime.step(i % 9 === 0
      ? 'An uncertain hypothesis remains; inspect the evidence and choose a useful next step.'
      : undefined);
    const action = learner.b299CausalPersonalityDiagnostics().lastAction;
    assert.ok(actions.includes(action), `runtime did not record a recognized selected action at tick ${i}: ${action}`);
    actionCounts[action]++;
  }

  learner.b299CausalPersonalitySetContext(holdoutContext);
  const diagnostics = learner.b299CausalPersonalityDiagnostics();
  const dominantAction = actions.slice().sort((a, b) => actionCounts[b] - actionCounts[a])[0];
  const learnedBias = learner.b299CausalPersonalityBias(dominantAction);
  assert.equal(diagnostics.learningUpdates, steps, 'not every runtime outcome updated personality');
  assert.ok(diagnostics.verifiedUpdates > 0, 'the live runtime produced no verified personality outcomes');
  assert.ok(actionCounts[dominantAction] >= Math.ceil(steps / actions.length), 'dominant action count violates coverage bound');
  assert.ok(
    Math.abs(learnedBias - initialBias[dominantAction]) > 1e-5,
    `live outcome history did not alter dominant-action personality bias: ${initialBias[dominantAction]} -> ${learnedBias}`,
  );
  assert.ok(diagnostics.contextCreditAssignments >= steps, 'context credit was not assigned for every live outcome');

  // Restore the organism's own snapshot without changing any personality weights.
  const trainedSnapshot = learner.snapshot();
  await stopRuntime();

  const restored = new OrganismCore(new MemoryStateStore({ initial: trainedSnapshot }), cfg);
  await restored.init();
  restored.b299CausalPersonalitySetContext(holdoutContext);
  const restoredBias = restored.b299CausalPersonalityBias(dominantAction);
  assert.ok(Math.abs(restoredBias - learnedBias) < 1e-9, 'personality influence changed across restart');

  // Same restored state and holdout context: compare normal personality vs B299 lesion.
  const normal = new OrganismCore(new MemoryStateStore({ initial: trainedSnapshot }), cfg);
  await normal.init();
  normal.b299CausalPersonalitySetContext(holdoutContext);
  const normalResult = await normal.observeOperational();

  const lesioned = new OrganismCore(new MemoryStateStore({ initial: trainedSnapshot }), cfg);
  await lesioned.init();
  lesioned.b299CausalPersonalityLesion(1);
  lesioned.b299CausalPersonalitySetContext(holdoutContext);
  const lesionResult = await lesioned.observeOperational();

  const normalScores = Object.fromEntries((normalResult.decision?.candidates ?? []).map(x => [x.action, Number(x.score)]));
  const lesionScores = Object.fromEntries((lesionResult.decision?.candidates ?? []).map(x => [x.action, Number(x.score)]));
  const l1 = actions.reduce((sum, action) => sum + Math.abs((normalScores[action] ?? 0) - (lesionScores[action] ?? 0)), 0);
  const maxCandidateDelta = Math.max(...actions.map(action => Math.abs((normalScores[action] ?? 0) - (lesionScores[action] ?? 0))));
  const lesionedBias = lesioned.b299CausalPersonalityBias(dominantAction);
  assert.equal(lesionedBias, 0, 'personality lesion did not remove the learned B299 bias');
  assert.ok(l1 > 1e-5 && maxCandidateDelta > 1e-6, 'learned personality did not reach the live Core candidate distribution');

  console.log(JSON.stringify({
    pass: true,
    steps,
    actionCounts,
    dominantAction,
    initialBias: initialBias[dominantAction],
    learnedBias,
    restoredBias,
    lesionedBias,
    candidateL1: l1,
    maxCandidateDelta,
    learningUpdates: diagnostics.learningUpdates,
    verifiedUpdates: diagnostics.verifiedUpdates,
    contextCreditAssignments: diagnostics.contextCreditAssignments,
  }, null, 2));
} finally {
  await stopRuntime();
  await rm(directory, { recursive: true, force: true });
}
