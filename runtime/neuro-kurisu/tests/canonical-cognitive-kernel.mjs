import assert from 'node:assert/strict';
import { CanonicalCognitiveKernel } from '../src/organism/core/CanonicalCognitiveKernel.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { UnifiedCognitiveCycle } from '../src/organism/system/UnifiedCognitiveCycle.ts';

const eventFabric = new CognitiveEventFabric(256);
const cycleLedger = new UnifiedCognitiveCycle();
const kernel = new CanonicalCognitiveKernel(eventFabric, cycleLedger);
const stage = (source, payload = {}) => ({ source, confidence01: 0.8, payload });

const decision = kernel.beginDecisionCycle({
  tick: 1, at: 100,
  observation: stage('sensor.observation', { sourceKind: 'user' }),
  prediction: stage('world.predict', { selectedAction: 'explore' }),
  appraisal: stage('homeostasis.appraise', { stress01: 0.2 }),
  attention: stage('workspace.attention', { selectedItems: ['curiosity'] }),
  memory: stage('memory.retrieve', { memoryIds: ['m-1'] }),
  goal: stage('motivation.goal', { goalId: 'g-1' }),
  plan: stage('planner.plan', { candidateCount: 3 }),
  action: stage('policy.action', { action: 'explore' }),
});

assert.equal(decision.anchors.tick, 1);
assert.equal(new Set([
  decision.anchors.observation, decision.anchors.prediction, decision.anchors.appraisal,
  decision.anchors.attention, decision.anchors.memory, decision.anchors.goal,
  decision.anchors.plan, decision.anchors.action,
]).size, 8, 'each decision stage must have a distinct event identity');

const completion = kernel.completeCycle({
  anchors: decision.anchors, fallbackTick: 2, at: 200,
  outcome: stage('outcome.verifier', { success01: 0.9, verified: true }),
  learning: stage('learning.update', { updated: true }),
  selfUpdate: stage('self-model.update', { continuity01: 0.92 }),
});
assert.equal(completion.tick, 1, 'late feedback must close the logical decision tick');
assert.equal(completion.cycleLineage.complete, true);
assert.deepEqual(completion.cycleLineage.missingStages, []);
assert.deepEqual(completion.cycleLineage.invalidStages, []);
assert.deepEqual(completion.cycleLineage.missingEdges, []);
assert.equal(completion.cycleResult?.complete, true);
assert.equal(completion.completionRecorded, true);
assert.equal(completion.outcomeEvent.tick, 1);
assert.equal(completion.learningEvent.tick, 1);
assert.equal(completion.selfUpdateEvent.tick, 1);
assert.equal(cycleLedger.snapshot().cycles, 1);
assert.equal(cycleLedger.snapshot().completeCycles, 1);
assert.equal(cycleLedger.snapshot().incompleteCycles, 0);

const byId = new Map(eventFabric.recent(64).map(event => [event.id, event]));
assert.ok(byId.get(decision.anchors.action)?.parentIds.includes(decision.anchors.plan));
assert.ok(byId.get(completion.outcomeEvent.id)?.parentIds.includes(decision.anchors.action));
assert.ok(byId.get(completion.learningEvent.id)?.parentIds.includes(completion.outcomeEvent.id));
assert.ok(byId.get(completion.selfUpdateEvent.id)?.parentIds.includes(completion.learningEvent.id));

const second = kernel.beginDecisionCycle({
  tick: 2, at: 300,
  observation: stage('sensor.observation'),
  prediction: stage('world.predict'),
  appraisal: stage('homeostasis.appraise'),
  attention: stage('workspace.attention'),
  memory: stage('memory.retrieve'),
  goal: stage('motivation.goal'),
  plan: stage('planner.plan'),
  action: stage('policy.action'),
});
assert.equal(second.anchors.tick, 2);
const incomplete = kernel.completeCycle({
  anchors: {}, fallbackTick: 3, at: 400,
  outcome: stage('unmatched.outcome', { success01: 0.2 }),
  learning: stage('learning.update'),
  selfUpdate: stage('self-model.update'),
});
assert.equal(incomplete.cycleResult?.complete, false, 'outcome without linked decision evidence must not pass');
assert.ok(incomplete.cycleLineage.missingStages.includes('observation'));
assert.equal(cycleLedger.snapshot().cycles, 2);
assert.equal(cycleLedger.snapshot().completeCycles, 1);
assert.equal(cycleLedger.snapshot().incompleteCycles, 1);

assert.throws(() => kernel.beginDecisionCycle({
  tick: -1, at: 500,
  observation: stage('o'), prediction: stage('p'), appraisal: stage('a'),
  attention: stage('att'), memory: stage('m'), goal: stage('g'),
  plan: stage('pl'), action: stage('act'),
}), /tick/);

console.log('WorkPass331 canonical cognitive kernel: PASS');
