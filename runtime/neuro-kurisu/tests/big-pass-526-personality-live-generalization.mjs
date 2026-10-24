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
const steps = 72;
const worldTransition = (tick, action, reward) => ({
  action,
  before: {
    tick, location: 'b526-personality-train', energy: 0.82, attention: 0.8,
    uncertainty: 0.44, facts: [`${action}-probe`], objects: [], events: [],
  },
  after: {
    tick: tick + 1, location: 'b526-personality-train', energy: 0.79, attention: 0.77,
    uncertainty: reward > 0.55 ? 0.22 : 0.8,
    facts: [`${action}-probe`, `reward-${reward}`], objects: [],
    events: ['verified-transition'],
  },
  reward,
  surprise: reward > 0.55 ? 0.05 : 0.65,
  at: 920000 + tick,
});

const learner = new OrganismCore(new MemoryStateStore(), cfg);
await learner.init();
learner.b299CausalPersonalitySetContext(holdoutContext);
const initialBias = Object.fromEntries(actions.map(action => [action, learner.b299CausalPersonalityBias(action)]));
const actionCounts = Object.fromEntries(actions.map(action => [action, 0]));
const magnitude = map => Object.values(map).reduce((sum, value) => sum + Math.abs(value), 0);

// Follow the established B299/B341 integration seam: ask live Core to select an action,
// then attach feedback to that exact selection. Every action is trained; no forced "verify".
for (let i = 0; i < steps; i++) {
  learner.b299CausalPersonalitySetContext(trainContext);
  const result = await learner.observe({
    text: 'An uncertain hypothesis remains. Inspect evidence and choose a useful next cognitive step.',
  });
  const action = result.decision?.selected?.action;
  assert.ok(actions.includes(action), `Core did not return a recognized selected action at tick ${i}: ${action}`);
  actionCounts[action]++;
  await learner.feedback({
    success: 0.92,
    reward: 0.9,
    surprise: 0.08,
    evidenceSource: 'device',
    worldTransition: worldTransition(i, action, 0.9),
  });
}

learner.b299CausalPersonalitySetContext(holdoutContext);
const diagnostics = learner.b299CausalPersonalityDiagnostics();
const afterBias = Object.fromEntries(actions.map(action => [action, learner.b299CausalPersonalityBias(action)]));
const beforeMagnitude = magnitude(initialBias);
const afterMagnitude = magnitude(afterBias);
const dominantAction = actions.slice().sort((a, b) => actionCounts[b] - actionCounts[a])[0];
assert.equal(diagnostics.learningUpdates, steps, 'not every observed outcome updated personality');
assert.ok(diagnostics.verifiedUpdates > 0, 'live Core produced no verified personality outcomes');
assert.ok(actionCounts[dominantAction] >= Math.ceil(steps / actions.length), 'dominant action count violates coverage bound');
assert.ok(afterMagnitude > beforeMagnitude + 1e-5,
  `live experience did not increase measurable personality action influence: ${beforeMagnitude} -> ${afterMagnitude}`);
assert.ok(diagnostics.contextCreditAssignments >= steps, 'context credit was not assigned for every live outcome');

// Restore the organism's own state, without editing personality fields, and compare in holdout.
const trainedSnapshot = learner.snapshot();
const restored = new OrganismCore(new MemoryStateStore({ initial: trainedSnapshot }), cfg);
await restored.init();
restored.b299CausalPersonalitySetContext(holdoutContext);
const restoredBias = Object.fromEntries(actions.map(action => [action, restored.b299CausalPersonalityBias(action)]));
for (const action of actions) {
  assert.ok(Math.abs(restoredBias[action] - afterBias[action]) < 1e-9,
    `personality influence changed across restart for ${action}`);
}

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
assert.equal(lesioned.b299CausalPersonalityBias(dominantAction), 0,
  'personality lesion did not remove the learned B299 bias');
assert.ok(l1 > 1e-5 && maxCandidateDelta > 1e-6,
  'learned personality did not reach the live Core candidate distribution');

console.log(JSON.stringify({
  pass: true,
  steps,
  actionCounts,
  dominantAction,
  beforeMagnitude,
  afterMagnitude,
  biasDelta: afterMagnitude - beforeMagnitude,
  initialBias,
  afterBias,
  restoredBias,
  candidateL1: l1,
  maxCandidateDelta,
  learningUpdates: diagnostics.learningUpdates,
  verifiedUpdates: diagnostics.verifiedUpdates,
  contextCreditAssignments: diagnostics.contextCreditAssignments,
}, null, 2));
