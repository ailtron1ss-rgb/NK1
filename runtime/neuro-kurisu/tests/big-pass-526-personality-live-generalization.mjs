import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

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
const worldTransition = (tick, action) => ({
  action,
  before: {
    tick, location: 'b526-personality-train', energy: 0.82, attention: 0.8,
    uncertainty: 0.46, facts: ['open-hypothesis'], objects: [], events: [],
  },
  after: {
    tick: tick + 1, location: 'b526-personality-train', energy: 0.79, attention: 0.77,
    uncertainty: 0.21, facts: ['open-hypothesis', 'outcome-checked'], objects: [],
    events: ['verified-transition'],
  },
  reward: 0.9,
  surprise: 0.08,
  at: 920000 + tick,
});

const learner = new OrganismCore(new MemoryStateStore(), cfg);
await learner.init();
learner.b299CausalPersonalitySetContext(holdoutContext);
const initialBias = Object.fromEntries(actions.map(action => [action, learner.b299CausalPersonalityBias(action)]));
const actionCounts = Object.fromEntries(actions.map(action => [action, 0]));
const steps = 72;

// No requested action is supplied: train only from the action the live Core actually selects.
// Crucially, every selected action receives its real outcome instead of filtering for "verify".
for (let i = 0; i < steps; i++) {
  learner.b299CausalPersonalitySetContext(trainContext);
  const result = await learner.observe({
    text: 'An uncertain hypothesis remains. Choose the next useful cognitive step from current evidence and goals.',
  });
  const action = result.decision?.selected?.action;
  assert.ok(actions.includes(action), `Core did not return a recognized selected action at tick ${i}: ${action}`);
  actionCounts[action]++;
  await learner.feedback({
    success: 0.92,
    reward: 0.9,
    surprise: 0.08,
    evidenceSource: 'device',
    worldTransition: worldTransition(i, action),
  });
}

learner.b299CausalPersonalitySetContext(holdoutContext);
const diagnostics = learner.b299CausalPersonalityDiagnostics();
const dominantAction = actions.slice().sort((a, b) => actionCounts[b] - actionCounts[a])[0];
const learnedBias = learner.b299CausalPersonalityBias(dominantAction);
assert.equal(diagnostics.learningUpdates, steps, 'not every live selected action produced a personality learning update');
assert.ok(actionCounts[dominantAction] >= Math.ceil(steps / actions.length), 'dominant action count violates coverage bound');
assert.ok(
  Math.abs(learnedBias - initialBias[dominantAction]) > 1e-5,
  `live outcome history did not alter dominant-action personality bias: ${initialBias[dominantAction]} -> ${learnedBias}`,
);
assert.ok(diagnostics.contextCreditAssignments >= steps, 'context credit was not assigned for every live outcome');

// Restart the trained organism from its own snapshot, without editing personality weights.
const trainedSnapshot = learner.snapshot();
const restored = new OrganismCore(new MemoryStateStore({ initial: trainedSnapshot }), cfg);
await restored.init();
restored.b299CausalPersonalitySetContext(holdoutContext);
const restoredBias = restored.b299CausalPersonalityBias(dominantAction);
assert.ok(Math.abs(restoredBias - learnedBias) < 1e-9, 'personality influence changed across restart');

// Compare the same restored state and same holdout observation with B299 enabled vs lesioned.
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
  contextCreditAssignments: diagnostics.contextCreditAssignments,
}, null, 2));
