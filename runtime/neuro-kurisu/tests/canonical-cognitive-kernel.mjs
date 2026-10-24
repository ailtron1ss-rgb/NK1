import assert from 'node:assert/strict';
import { CanonicalCognitiveKernel } from '../src/organism/core/CanonicalCognitiveKernel.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { UnifiedCognitiveCycle } from '../src/organism/system/UnifiedCognitiveCycle.ts';

const eventFabric = new CognitiveEventFabric(256);
const cycleLedger = new UnifiedCognitiveCycle();
const kernel = new CanonicalCognitiveKernel(eventFabric, cycleLedger);
const stage = (source, payload = {}) => ({ source, confidence01: 0.8, payload });

const decisionInput = () => ({
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
const decision = kernel.beginDecisionCycle(decisionInput());

assert.equal(decision.anchors.tick, 1);
assert.equal(decision.anchors.observation, 'cef:kernel:1:observation', 'kernel event IDs must be stable for a logical stage');
const firstDecisionTotal = eventFabric.snapshot().total;
const replayedDecision = kernel.beginDecisionCycle(decisionInput());
assert.deepEqual(replayedDecision.anchors, decision.anchors);
assert.equal(eventFabric.snapshot().total, firstDecisionTotal, 'replaying the same logical tick must not append duplicate stage events');
assert.throws(() => kernel.beginDecisionCycle({
  ...decisionInput(),
  observation: stage('sensor.observation', { sourceKind: 'different-input' }),
}), /conflict/, 'the same tick cannot silently accept different observation evidence');
assert.equal(eventFabric.snapshot().total, firstDecisionTotal, 'conflicting replay must not mutate the ledger');
assert.throws(() => kernel.beginDecisionCycle({
  ...decisionInput(),
  appraisal: { ...stage('homeostasis.appraise', { stress01: 0.2 }), confidence01: 1.01 },
}), /confidence/, 'invalid stage input must fail before any event is appended');
assert.equal(eventFabric.snapshot().total, firstDecisionTotal, 'preflight validation must be atomic');
assert.throws(() => kernel.completeCycle({
  anchors: { ...decision.anchors, at: -1 },
  fallbackTick: 2,
  at: 200,
  outcome: stage('outcome.verifier', { success01: 0.9, verified: true }),
  learning: stage('learning.update', { updated: true }),
  selfUpdate: stage('self-model.update', { continuity01: 0.92 }),
}), /anchor-at/, 'malformed anchor time must fail before completion writes');
assert.equal(eventFabric.snapshot().total, firstDecisionTotal, 'malformed anchors must not append any completion events');
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
assert.equal(completion.replayed, false, 'the first completion is not a replay');
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
const firstCompletionTotal = eventFabric.snapshot().total;
const replayedCompletion = kernel.completeCycle({
  anchors: decision.anchors, fallbackTick: 2, at: 200,
  outcome: stage('outcome.verifier', { success01: 0.9, verified: true }),
  learning: stage('learning.update', { updated: true }),
  selfUpdate: stage('self-model.update', { continuity01: 0.92 }),
});
assert.equal(replayedCompletion.replayed, true);
assert.equal(replayedCompletion.completionRecorded, true, 'replay preserves the already-recorded completion result');
assert.equal(replayedCompletion.outcomeEvent.id, completion.outcomeEvent.id);
assert.equal(replayedCompletion.learningEvent.id, completion.learningEvent.id);
assert.equal(replayedCompletion.selfUpdateEvent.id, completion.selfUpdateEvent.id);
assert.equal(eventFabric.snapshot().total, firstCompletionTotal, 'replayed feedback must not append duplicate outcome/learning events');
assert.equal(cycleLedger.snapshot().cycles, 1, 'replayed feedback must not inflate cycle counts');
assert.throws(() => kernel.completeCycle({
  anchors: decision.anchors, fallbackTick: 2, at: 200,
  outcome: stage('outcome.verifier', { success01: 0.1, verified: false }),
  learning: stage('learning.update', { updated: true }),
  selfUpdate: stage('self-model.update', { continuity01: 0.92 }),
}), /conflict/, 'changed evidence for an existing tick must be rejected');
assert.equal(eventFabric.snapshot().total, firstCompletionTotal, 'conflicting feedback must not change event totals');

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
