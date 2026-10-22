import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const fabric = new CognitiveEventFabric(256);
const ids = fabric.recordOperationalCycle({
  tick: 321,
  at: 1729000000000,
  observation: { source: 'sensor-fusion', external: true, confidence01: 0.91, payload: { modalityCount: 3 } },
  prediction: { source: 'predictive-world-model', confidence01: 0.82, payload: { hypothesisId: 'hyp-321' } },
  appraisal: { source: 'homeostatic-appraisal', confidence01: 0.79, payload: { uncertainty01: 0.21, curiosity01: 0.63 } },
  attention: { source: 'global-workspace', confidence01: 0.88, payload: { broadcastId: 'gwt-321', selectedCount: 4 } },
  memory: { source: 'active-memory-context', confidence01: 0.86, payload: { retrievedCount: 7, continuity01: 0.91 } },
  goal: { source: 'canonical-goal-selection', confidence01: 0.80, payload: { goalId: 'goal-321' } },
  plan: { source: 'plan-engine', confidence01: 0.77, payload: { stepCount: 3 } },
  action: { source: 'canonical-action-gateway', confidence01: 0.84, payload: { actionId: 'action-321' } },
  outcome: { source: 'verified-outcome', external: true, confidence01: 0.89, payload: { reward01: 0.73 } },
  learning: { source: 'post-feedback-learning', confidence01: 0.81, payload: { updateApplied: true } },
  selfUpdate: { source: 'post-learning-self-model', confidence01: 0.76, payload: { identityUpdateApplied: true } },
});

for (const phase of ['observation', 'prediction', 'appraisal', 'attention', 'memory', 'goal', 'plan', 'action', 'outcome', 'learning', 'selfUpdate']) {
  assert.equal(typeof ids[phase], 'string', 'expected a concrete event id for phase ' + phase);
}
const stageIds = {
  observation: ids.observation,
  prediction: ids.prediction,
  appraisal: ids.appraisal,
  attention: ids.attention,
  memory: ids.memory,
  goal: ids.goal,
  plan: ids.plan,
  action: ids.action,
  outcome: ids.outcome,
  learning: ids.learning,
  'self-update': ids.selfUpdate,
};
const verification = fabric.verifyOperationalCycle(stageIds);
assert.equal(verification.complete, true);
assert.equal(verification.integrity01, 1);
assert.deepEqual(verification.missingStages, []);
assert.deepEqual(verification.invalidStages, []);
assert.deepEqual(verification.missingEdges, []);

const snapshot = fabric.snapshot();
assert.equal(snapshot.danglingParentLinks, 0);
assert.equal(snapshot.cycleCoverage01, 1);
const byId = new Map(snapshot.recent.map(event => [event.id, event]));
const hasParent = (childId, parentId, edge) => {
  const child = byId.get(childId);
  assert.ok(child, 'missing event for ' + edge);
  assert.ok(child.parentIds.includes(parentId), 'missing causal edge ' + edge);
};
hasParent(ids.prediction, ids.observation, 'prediction -> observation');
hasParent(ids.appraisal, ids.observation, 'appraisal -> observation');
hasParent(ids.appraisal, ids.prediction, 'appraisal -> prediction');
hasParent(ids.attention, ids.appraisal, 'attention -> appraisal');
hasParent(ids.attention, ids.prediction, 'attention -> prediction');
hasParent(ids.memory, ids.attention, 'memory -> attention');
hasParent(ids.memory, ids.observation, 'memory -> observation');
hasParent(ids.goal, ids.appraisal, 'goal -> appraisal');
hasParent(ids.goal, ids.memory, 'goal -> memory');
hasParent(ids.plan, ids.goal, 'plan -> goal');
hasParent(ids.plan, ids.prediction, 'plan -> prediction');
hasParent(ids.action, ids.plan, 'action -> plan');
hasParent(ids.action, ids.prediction, 'action -> prediction');
hasParent(ids.action, ids.observation, 'action -> observation');
hasParent(ids.outcome, ids.action, 'outcome -> action');
hasParent(ids.learning, ids.outcome, 'learning -> outcome');
hasParent(ids['self-update'] ?? ids.selfUpdate, ids.learning, 'self-update -> learning');

const restored = new CognitiveEventFabric(256);
restored.restore(snapshot);
assert.equal(restored.snapshot().danglingParentLinks, 0);
assert.equal(restored.verifyOperationalCycle(stageIds).complete, true, 'the extended causal spine must survive persistence roundtrip');

const invalidStage = restored.verifyOperationalCycle({ ...stageIds, goal: 'ghost-goal-event' });
assert.equal(invalidStage.complete, false);
assert.ok(invalidStage.invalidStages.includes('goal:missing-event'));

const legacy = new CognitiveEventFabric(256);
const legacyIds = legacy.recordOperationalCycle({
  tick: 322,
  observation: { source: 'legacy-observation' },
  prediction: { source: 'legacy-prediction' },
  action: { source: 'legacy-action' },
  outcome: { source: 'legacy-outcome' },
  learning: { source: 'legacy-learning' },
  selfUpdate: { source: 'legacy-self-update' },
});
const legacyResult = legacy.verifyOperationalCycle({
  observation: legacyIds.observation,
  prediction: legacyIds.prediction,
  action: legacyIds.action,
  outcome: legacyIds.outcome,
  learning: legacyIds.learning,
  'self-update': legacyIds.selfUpdate,
});
assert.equal(legacyResult.complete, true, 'callers using the original six core phases remain compatible');

console.log('WorkPass321 expanded cognitive phase spine: PASS');
