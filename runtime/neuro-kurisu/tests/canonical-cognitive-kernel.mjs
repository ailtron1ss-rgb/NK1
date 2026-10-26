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

 // Old duplicate completion is a replay only when all three canonical records match.
 const totalAfterTickThree=eventFabric.snapshot().total;
 const historicalReplay=kernel.completeCycle({
   anchors:decision.anchors,fallbackTick:99,at:200,
   outcome:stage('outcome.verifier',{success01:0.9,verified:true}),
   learning:stage('learning.update',{updated:true}),
   selfUpdate:stage('self-model.update',{continuity01:0.92}),
 });
 assert.equal(historicalReplay.replayed,true,'a duplicate older completion remains idempotent after later ticks close');
 assert.equal(historicalReplay.completionRecorded,true);
 assert.equal(historicalReplay.outcomeEvent.id,completion.outcomeEvent.id);
 assert.equal(eventFabric.snapshot().total,totalAfterTickThree,'historical replay must not append events');
 assert.equal(cycleLedger.snapshot().cycles,2,'historical replay must not mutate monotonic cycle counters');

 // A previously unfinished old tick must fail before writing outcome/learning/self-update.
 assert.equal(eventFabric.getById('cef:kernel:2:outcome'),null);
 const beforeStaleCompletion=eventFabric.snapshot().total;
 assert.throws(()=>kernel.completeCycle({
   anchors:second.anchors,fallbackTick:2,at:350,
   outcome:stage('outcome.verifier',{success01:0.7,verified:true}),
   learning:stage('learning.update',{updated:true}),
   selfUpdate:stage('self-model.update',{continuity01:0.8}),
 }),/stale-completion/,'late feedback for an already superseded, unfinished tick must fail closed');
 assert.equal(eventFabric.snapshot().total,beforeStaleCompletion,'rejected stale feedback must not leave partial completion events');
 assert.equal(eventFabric.getById('cef:kernel:2:outcome'),null);
 assert.equal(eventFabric.getById('cef:kernel:2:learning'),null);
 assert.equal(eventFabric.getById('cef:kernel:2:self-update'),null);

 // Preflight all decision-stage IDs before writes: a later-stage collision cannot leave a partial cycle.
 const collisionFabric=new CognitiveEventFabric(256);
 const collisionLedger=new UnifiedCognitiveCycle();
 const collisionKernel=new CanonicalCognitiveKernel(collisionFabric,collisionLedger);
 collisionFabric.append({
   id:'cef:kernel:7:plan',tick:7,stage:'plan',source:'planner.plan',
   parentIds:['cef:kernel:7:goal','cef:kernel:7:prediction'],external:false,
   confidence01:0.8,payload:{candidateCount:99},at:700,
 });
 const beforePlanCollision=collisionFabric.snapshot().total;
 assert.throws(()=>collisionKernel.beginDecisionCycle({
   tick:7,at:700,
   observation:stage('sensor.observation',{sourceKind:'user'}),
   prediction:stage('world.predict',{selectedAction:'explore'}),
   appraisal:stage('homeostasis.appraise',{stress01:0.2}),
   attention:stage('workspace.attention',{selectedItems:['curiosity']}),
   memory:stage('memory.retrieve',{memoryIds:['m-1']}),
   goal:stage('motivation.goal',{goalId:'g-1'}),
   plan:stage('planner.plan',{candidateCount:3}),
   action:stage('policy.action',{action:'explore'}),
 }),/conflict/,'a collision on a later decision stage must be found before earlier writes');
 assert.equal(collisionFabric.snapshot().total,beforePlanCollision,'conflicting staged input must be rejected atomically');
 assert.equal(collisionFabric.getById('cef:kernel:7:observation'),null);

 // Non-JSON payloads are rejected while preparing the batch, before the first event is written.
 const circularFabric=new CognitiveEventFabric(256);
 const circularLedger=new UnifiedCognitiveCycle();
 const circularKernel=new CanonicalCognitiveKernel(circularFabric,circularLedger);
 const cyclicPayload={};
 cyclicPayload.self=cyclicPayload;
 assert.throws(()=>circularKernel.beginDecisionCycle({
   tick:8,at:800,
   observation:stage('sensor.observation',cyclicPayload),
   prediction:stage('world.predict',{selectedAction:'explore'}),
   appraisal:stage('homeostasis.appraise',{stress01:0.2}),
   attention:stage('workspace.attention',{selectedItems:['curiosity']}),
   memory:stage('memory.retrieve',{memoryIds:['m-1']}),
   goal:stage('motivation.goal',{goalId:'g-1'}),
   plan:stage('planner.plan',{candidateCount:3}),
   action:stage('policy.action',{action:'explore'}),
 }),/circular/,'non-serializable stage data must fail during preflight');
 assert.equal(circularFabric.snapshot().total,0,'a cyclic later-stage payload must not leave partial decision events');

assert.throws(() => kernel.beginDecisionCycle({
  tick: -1, at: 500,
  observation: stage('o'), prediction: stage('p'), appraisal: stage('a'),
  attention: stage('att'), memory: stage('m'), goal: stage('g'),
  plan: stage('pl'), action: stage('act'),
}), /tick/);


 // The shared event fabric must enforce the full stable-ID envelope, not only tick/stage/source.
 const idempotencyFabric = new CognitiveEventFabric(256);
 const canonicalEvent = {
   id: 'cef:external:stable-1',
   tick: 12,
   at: 1200,
   stage: 'tool-outcome',
   source: 'action-gateway',
   parentIds: ['decision-12', 'execution-12'],
   external: true,
   confidence01: 0.85,
   payload: { ok: true, outcome: { status: 'executed' } },
 };
 const appendedEvent = idempotencyFabric.append(canonicalEvent);
 const firstEnvelopeTotal = idempotencyFabric.snapshot().total;
 const replayEvent = idempotencyFabric.append({
   ...canonicalEvent,
   payload: { outcome: { status: 'executed' }, ok: true },
 });
 assert.equal(replayEvent.id, appendedEvent.id, 'key-order-equivalent JSON is an idempotent replay');
 assert.equal(idempotencyFabric.snapshot().total, firstEnvelopeTotal);

 const conflictingEnvelopes = [
   { ...canonicalEvent, payload: { ok: false, outcome: { status: 'executed' } } },
   { ...canonicalEvent, parentIds: ['execution-12', 'decision-12'] },
   { ...canonicalEvent, parentIds: ['decision-12'] },
   { ...canonicalEvent, external: false },
   { ...canonicalEvent, confidence01: 0.2 },
   { ...canonicalEvent, at: 1201 },
   { ...canonicalEvent, stage: 'tool-action' },
   { ...canonicalEvent, source: 'different-source' },
   { ...canonicalEvent, tick: 13 },
 ];
 for (const conflicting of conflictingEnvelopes) {
   assert.throws(
     () => idempotencyFabric.append(conflicting),
     /cognitive-event-id-conflict/,
     'reusing an event ID with different evidence or causal parents must fail closed',
   );
   assert.equal(idempotencyFabric.snapshot().total, firstEnvelopeTotal,
     'conflicting event-ID replay must not mutate the shared ledger');
 }
 const originalEnvelope = idempotencyFabric.getById(canonicalEvent.id);
 assert.deepEqual(originalEnvelope?.payload, canonicalEvent.payload);
 assert.deepEqual(originalEnvelope?.parentIds, canonicalEvent.parentIds);

 // Payload state must be detached from caller-owned nested objects and returned event objects.
 const callerPayload = { nested: { value: 'canonical' } };
 const detached = idempotencyFabric.append({
   ...canonicalEvent,
   id: 'cef:external:detached-payload',
   at: 1202,
   payload: callerPayload,
 });
 callerPayload.nested.value = 'caller-mutated';
 detached.payload.nested.value = 'returned-object-mutated';
 assert.equal(idempotencyFabric.getById('cef:external:detached-payload')?.payload.nested.value, 'canonical');
 assert.equal(idempotencyFabric.snapshot().total, firstEnvelopeTotal + 1);

 // Invalid payloads must fail before append can increment the journal or leave a partial node.
 const cyclicEventPayload = {};
 cyclicEventPayload.self = cyclicEventPayload;
 const beforeCyclicAppend = idempotencyFabric.snapshot().total;
 assert.throws(() => idempotencyFabric.append({
   ...canonicalEvent,
   id: 'cef:external:cyclic-payload',
   tick: 14,
   at: 1400,
   payload: cyclicEventPayload,
 }), /circular/);
 assert.equal(idempotencyFabric.snapshot().total, beforeCyclicAppend);
 assert.equal(idempotencyFabric.getById('cef:external:cyclic-payload'), null);

 let payloadGetterExecuted = false;
 const accessorPayload = {};
 Object.defineProperty(accessorPayload, 'secret', {
   enumerable: true,
   get() { payloadGetterExecuted = true; throw new Error('event payload getter must not run'); },
 });
 const accessorEvent = idempotencyFabric.append({
   ...canonicalEvent,
   id: 'cef:external:accessor-payload',
   at: 1203,
   payload: accessorPayload,
 });
 assert.equal(payloadGetterExecuted, false, 'top-level payload accessors must be omitted without execution');
 assert.deepEqual(accessorEvent.payload, {});


 // Omitted timestamps replay the original decision time instead of generating a conflict.
 const retentionFabric = new CognitiveEventFabric(128);
 const retentionCycle = new UnifiedCognitiveCycle();
 const retentionKernel = new CanonicalCognitiveKernel(retentionFabric, retentionCycle);
 const noTimestampInput = { ...decisionInput(), tick: 21 };
 delete noTimestampInput.at;
 const firstNoTimestampDecision = retentionKernel.beginDecisionCycle(noTimestampInput);
 const totalAfterFirstDecision = retentionFabric.snapshot().total;
 const replayWithoutTimestamp = retentionKernel.beginDecisionCycle(noTimestampInput);
 assert.deepEqual(replayWithoutTimestamp.anchors, firstNoTimestampDecision.anchors);
 assert.equal(retentionFabric.snapshot().total, totalAfterFirstDecision,
   'replaying an existing decision without at must reuse the original decision time');

 const retentionCompletion = retentionKernel.completeCycle({
   anchors:firstNoTimestampDecision.anchors,
   fallbackTick:22,
   at:firstNoTimestampDecision.anchors.at+1,
   outcome:stage('outcome.verifier',{success01:0.8,verified:true}),
   learning:stage('learning.update',{updated:true}),
   selfUpdate:stage('self-model.update',{continuity01:0.8}),
 });
 assert.equal(retentionCompletion.completionRecorded,true);
 const oldDecisionReplay = retentionKernel.beginDecisionCycle(noTimestampInput);
 assert.deepEqual(oldDecisionReplay.anchors, firstNoTimestampDecision.anchors,
   'a completed old tick may be replayed read-only while all stage evidence remains retained');
 const totalBeforeRetentionFill = retentionFabric.snapshot().total;
 assert.equal(totalBeforeRetentionFill, totalAfterFirstDecision + 3);

 // Force the bounded event window to evict the old decision's stages.
 for (let i=0;i<140;i++) {
   retentionFabric.append({
     id:`retention-filler-${i}`,
     tick:1000+i,
     at:10000+i,
     stage:'tool-evidence',
     source:'retention-test',
     payload:{index:i},
   });
 }
 assert.equal(retentionFabric.getById('cef:kernel:21:observation'),null,
   'fixture must actually evict the old observation');
 const beforeStaleDecisionReplay = retentionFabric.snapshot().total;
 assert.throws(
   ()=>retentionKernel.beginDecisionCycle(noTimestampInput),
   /stale-decision/,
   'the kernel must not recreate an already-finalized decision after its stage evidence is evicted',
 );
 assert.equal(retentionFabric.snapshot().total,beforeStaleDecisionReplay,
   'a rejected stale decision replay must not resurrect evicted stages');
 assert.equal(retentionFabric.getById('cef:kernel:21:observation'),null);

// Completion retries that omit 'at' must reuse the original timestamp and remain read-only.
const completionReplayFabric = new CognitiveEventFabric(256);
const completionReplayCycle = new UnifiedCognitiveCycle();
const completionReplayKernel = new CanonicalCognitiveKernel(completionReplayFabric, completionReplayCycle);
const completionReplayDecision = completionReplayKernel.beginDecisionCycle({
  ...decisionInput(),
  tick: 31,
  at: 3100,
});
const noAtCompletionInput = {
  anchors: completionReplayDecision.anchors,
  fallbackTick: 31,
  outcome: stage('outcome.verifier', { success01: 0.84, verified: true }),
  learning: stage('learning.update', { updated: true }),
  selfUpdate: stage('self-model.update', { continuity01: 0.81 }),
};
const firstNoAtCompletion = completionReplayKernel.completeCycle(noAtCompletionInput);
const totalAfterNoAtCompletion = completionReplayFabric.snapshot().total;
const cycleStateAfterNoAtCompletion = completionReplayCycle.snapshot();
const replayNoAtCompletion = completionReplayKernel.completeCycle(noAtCompletionInput);
assert.equal(replayNoAtCompletion.replayed, true,
  'retrying an existing completion without at must be recognized as an idempotent replay');
assert.equal(replayNoAtCompletion.outcomeEvent.at, firstNoAtCompletion.outcomeEvent.at,
  'completion replay must retain the original outcome timestamp');
assert.equal(replayNoAtCompletion.learningEvent.id, firstNoAtCompletion.learningEvent.id);
assert.equal(replayNoAtCompletion.selfUpdateEvent.id, firstNoAtCompletion.selfUpdateEvent.id);
assert.equal(completionReplayFabric.snapshot().total, totalAfterNoAtCompletion,
  'timestamp-omitted completion replay must not append duplicate events');
assert.deepEqual(completionReplayCycle.snapshot(), cycleStateAfterNoAtCompletion,
  'completion replay must not mutate the monotonic cycle ledger');

// A valid restored counter at the safe-integer ceiling must be rejected before
// completion events are appended, not after outcome/learning writes have occurred.
const exhaustedFabric = new CognitiveEventFabric(256);
const exhaustedCycle = new UnifiedCognitiveCycle();
exhaustedCycle.restore({
  version: 1,
  cycles: Number.MAX_SAFE_INTEGER,
  completeCycles: 0,
  incompleteCycles: Number.MAX_SAFE_INTEGER,
  brokenLineages: 0,
  meanStageCoverage01: 0,
  meanCausalContinuity01: 0,
  lastTick: -1,
  lastComplete: false,
  lastMissingStages: ['observation', 'prediction', 'action', 'outcome', 'learning', 'self-update'],
});
const exhaustedKernel = new CanonicalCognitiveKernel(exhaustedFabric, exhaustedCycle);
const exhaustedDecision = exhaustedKernel.beginDecisionCycle({
  ...decisionInput(),
  tick: 32,
  at: 3200,
});
const eventCountBeforeExhaustedCompletion = exhaustedFabric.snapshot().total;
const cycleStateBeforeExhaustedCompletion = exhaustedCycle.snapshot();
assert.throws(() => exhaustedKernel.completeCycle({
  anchors: exhaustedDecision.anchors,
  fallbackTick: 32,
  at: 3201,
  outcome: stage('outcome.verifier', { success01: 0.7, verified: true }),
  learning: stage('learning.update', { updated: true }),
  selfUpdate: stage('self-model.update', { continuity01: 0.75 }),
}), /safe integer limit/,
'cycle-counter exhaustion must fail before completion mutation');
assert.equal(exhaustedFabric.snapshot().total, eventCountBeforeExhaustedCompletion,
  'cycle-counter exhaustion must not append outcome, learning, or self-update events');
assert.equal(exhaustedFabric.getById('cef:kernel:32:outcome'), null);
assert.equal(exhaustedFabric.getById('cef:kernel:32:learning'), null);
assert.equal(exhaustedFabric.getById('cef:kernel:32:self-update'), null);
assert.deepEqual(exhaustedCycle.snapshot(), cycleStateBeforeExhaustedCompletion,
  'failed cycle advancement must leave restored counters untouched');

console.log('WorkPass352 canonical cognitive kernel: PASS');
// Completion must not attach a current tick to a retained anchor from another tick.
const anchorProvenanceFabric = new CognitiveEventFabric(256);
const anchorProvenanceCycle = new UnifiedCognitiveCycle();
const anchorProvenanceKernel = new CanonicalCognitiveKernel(anchorProvenanceFabric, anchorProvenanceCycle);
const earlierAnchors = anchorProvenanceKernel.beginDecisionCycle({
  ...decisionInput(), tick: 41, at: 4100,
});
const currentAnchors = anchorProvenanceKernel.beginDecisionCycle({
  ...decisionInput(), tick: 42, at: 4200,
});
const anchorProvenanceBefore = anchorProvenanceFabric.snapshot().total;
assert.throws(() => anchorProvenanceKernel.completeCycle({
  anchors: {
    ...currentAnchors.anchors,
    observation: earlierAnchors.anchors.observation,
  },
  fallbackTick: 42,
  at: 4201,
  outcome: stage('outcome.verifier', { success01: 0.6, verified: true }),
  learning: stage('learning.update', { updated: true }),
  selfUpdate: stage('self-model.update', { continuity01: 0.7 }),
}), /anchor-provenance-conflict/,
'completion must reject a retained observation anchor belonging to another tick');
assert.equal(anchorProvenanceFabric.snapshot().total, anchorProvenanceBefore,
  'cross-tick anchor rejection must not append completion events');
assert.equal(anchorProvenanceFabric.getById('cef:kernel:42:outcome'), null);
assert.equal(anchorProvenanceFabric.getById('cef:kernel:42:learning'), null);
assert.equal(anchorProvenanceFabric.getById('cef:kernel:42:self-update'), null);
assert.equal(anchorProvenanceCycle.snapshot().cycles, 0,
  'cross-tick anchor rejection must not advance the cycle ledger');

// Duplicate unknown IDs and non-canonical whitespace IDs must not enter causal parent lists.
const ambiguousAnchorFabric = new CognitiveEventFabric(256);
const ambiguousAnchorCycle = new UnifiedCognitiveCycle();
const ambiguousAnchorKernel = new CanonicalCognitiveKernel(ambiguousAnchorFabric, ambiguousAnchorCycle);
const ambiguousAnchors = ambiguousAnchorKernel.beginDecisionCycle({
  ...decisionInput(), tick: 44, at: 4400,
});
const ambiguousBefore = ambiguousAnchorFabric.snapshot().total;
const duplicateUnknownId = 'retention-missing-anchor';
assert.throws(() => ambiguousAnchorKernel.completeCycle({
  anchors: {
    ...ambiguousAnchors.anchors,
    observation: duplicateUnknownId,
    prediction: duplicateUnknownId,
  },
  fallbackTick: 44,
  at: 4401,
  outcome: stage('outcome.verifier', { success01: 0.5 }),
  learning: stage('learning.update'),
  selfUpdate: stage('self-model.update'),
}), /anchor-provenance-conflict/,
'one missing event ID cannot stand for two distinct cognitive stages');
assert.equal(ambiguousAnchorFabric.snapshot().total, ambiguousBefore,
  'duplicate anchor IDs must be rejected before any completion write');

assert.throws(() => ambiguousAnchorKernel.completeCycle({
  anchors: {
    ...ambiguousAnchors.anchors,
    observation: ` ${ambiguousAnchors.anchors.observation}`,
  },
  fallbackTick: 44,
  at: 4402,
  outcome: stage('outcome.verifier', { success01: 0.5 }),
  learning: stage('learning.update'),
  selfUpdate: stage('self-model.update'),
}), /anchor-provenance-conflict/,
'event lookup normalization must not allow a whitespace-altered causal parent ID');
assert.equal(ambiguousAnchorFabric.snapshot().total, ambiguousBefore,
  'non-canonical anchor IDs must be rejected before any completion write');

assert.throws(() => ambiguousAnchorKernel.completeCycle({
  anchors: {
    ...ambiguousAnchors.anchors,
    observation: 'invalid\u0001anchor-id',
  },
  fallbackTick: 44,
  at: 4403,
  outcome: stage('outcome.verifier', { success01: 0.5 }),
  learning: stage('learning.update'),
  selfUpdate: stage('self-model.update'),
}), /anchor-provenance-conflict/,
'control-character anchor IDs must fail the canonical ID contract');
assert.equal(ambiguousAnchorFabric.snapshot().total, ambiguousBefore,
  'control-character anchor IDs must be rejected before any completion write');

// Missing retained records remain allowed so late outcomes can be recorded as incomplete evidence.
const missingAnchorFabric = new CognitiveEventFabric(256);
const missingAnchorCycle = new UnifiedCognitiveCycle();
const missingAnchorKernel = new CanonicalCognitiveKernel(missingAnchorFabric, missingAnchorCycle);
const missingAnchorCompletion = missingAnchorKernel.completeCycle({
  anchors: {},
  fallbackTick: 43,
  at: 4300,
  outcome: stage('late.outcome', { success01: 0.3 }),
  learning: stage('learning.update', { updated: false }),
  selfUpdate: stage('self-model.update', { continuity01: 0.4 }),
});
assert.equal(missingAnchorCompletion.completionRecorded, false,
  'missing anchors may be retained as incomplete outcome evidence rather than blocking late feedback');
assert.equal(missingAnchorFabric.getById('cef:kernel:43:outcome')?.stage, 'outcome');

// Restored event rows must preserve the persisted identity instead of coercing malformed values.
const restoreSourceFabric = new CognitiveEventFabric(128);
const restoreSourceEvent = restoreSourceFabric.append({
  id:'restore:valid-event', tick:55, at:5500, stage:'observation',
  source:'restore-test', parentIds:[], external:false, confidence01:0.8,
  payload:{stable:true},
});
const validRestoreSnapshot = restoreSourceFabric.snapshot();
const validRestoreFabric = new CognitiveEventFabric(128);
validRestoreFabric.restore(validRestoreSnapshot);
assert.equal(validRestoreFabric.getById(restoreSourceEvent.id)?.tick,55,
  'a valid canonical event snapshot must remain restorable');

let nestedRestoreGetterExecuted=false;
const nestedAccessorPayload={stable:true};
Object.defineProperty(nestedAccessorPayload,'hidden',{
  enumerable:true,
  get(){nestedRestoreGetterExecuted=true;throw new Error('nested payload getter must not run');},
});
const malformedRestoreRows = [
  {...restoreSourceEvent,id:' restore:whitespace-id '},
  {...restoreSourceEvent,id:'restore:string-tick',tick:'55'},
  {...restoreSourceEvent,id:'restore:fractional-tick',tick:55.5},
  {...restoreSourceEvent,id:'restore:string-external',external:'false'},
  {...restoreSourceEvent,id:'restore:string-confidence',confidence01:'0.8'},
  {...restoreSourceEvent,id:'restore:malformed-parent',parentIds:[' restore:parent ']},
  {...restoreSourceEvent,id:'restore:nested-accessor-payload',payload:{nested:nestedAccessorPayload}},
];
const cyclicRestorePayload = {};
cyclicRestorePayload.self = cyclicRestorePayload;
malformedRestoreRows.push({...restoreSourceEvent,id:'restore:cyclic-payload',payload:cyclicRestorePayload});
const strictRestoreFabric = new CognitiveEventFabric(128);
strictRestoreFabric.restore({version:1,total:0,recent:malformedRestoreRows});
assert.equal(strictRestoreFabric.snapshot().recent.length,0,
  'malformed IDs, ticks, boolean flags, confidence, parent IDs and cyclic payloads must not become causal events');
assert.equal(nestedRestoreGetterExecuted,false,
  'restoring nested payload objects must not execute accessors while cloning event data');

let restoreGetterExecuted = false;
const accessorRow = {...restoreSourceEvent,id:'restore:accessor-id'};
Object.defineProperty(accessorRow,'id',{
  configurable:true,
  enumerable:true,
  get(){restoreGetterExecuted=true;throw new Error('snapshot event getter must not run');},
});
const accessorRowFabric = new CognitiveEventFabric(128);
accessorRowFabric.restore({version:1,total:0,recent:[accessorRow]});
assert.equal(restoreGetterExecuted,false,'restoring an accessor-backed event field must not execute its getter');
assert.equal(accessorRowFabric.snapshot().recent.length,0,'accessor-backed identity must not be accepted');

let rootGetterExecuted = false;
const accessorSnapshot = {version:1,total:0};
Object.defineProperty(accessorSnapshot,'recent',{
  configurable:true,
  enumerable:true,
  get(){rootGetterExecuted=true;throw new Error('snapshot collection getter must not run');},
});
const accessorRootFabric = new CognitiveEventFabric(128);
const accessorRootBaseline = accessorRootFabric.append({
  id:'restore:root-accessor-baseline',tick:57,at:5700,stage:'observation',
  source:'restore-test',parentIds:[],external:false,confidence01:0.6,payload:{preserve:true},
});
const beforeAccessorRootRestore = accessorRootFabric.snapshot();
assert.throws(()=>accessorRootFabric.restore(accessorSnapshot),/snapshot-field-accessor:recent/,
  'accessor-backed snapshot roots must fail before touching the current ledger');
assert.equal(rootGetterExecuted,false,'restoring the collection field must not execute a snapshot getter');
assert.deepEqual(accessorRootFabric.snapshot(),beforeAccessorRootRestore,
  'unsafe root accessors must leave the existing event ledger unchanged');
assert.equal(accessorRootFabric.getById(accessorRootBaseline.id)?.payload.preserve,true);

const atomicRestoreFabric = new CognitiveEventFabric(128);
const atomicRestoreNode = atomicRestoreFabric.append({
  id:'restore:atomic-baseline',tick:56,at:5600,stage:'observation',
  source:'restore-test',parentIds:[],external:false,confidence01:0.7,payload:{kept:true},
});
const beforeUnsupportedRestore = atomicRestoreFabric.snapshot();
assert.throws(()=>atomicRestoreFabric.restore({version:2,recent:[]}),/unsupported-cognitive-event-fabric-snapshot-version/,
  'unknown event-fabric schemas must be rejected before mutating the current ledger');
assert.deepEqual(atomicRestoreFabric.snapshot(),beforeUnsupportedRestore,
  'rejected schema versions must leave all current event state unchanged');
assert.equal(atomicRestoreFabric.getById(atomicRestoreNode.id)?.payload.kept,true);

console.log('WorkPass354 completion anchor provenance: PASS');
console.log('WorkPass353 canonical completion replay/preflight: PASS');
// Root schema corruption must fail before replacing the live causal ledger.
const rootBoundaryFabric = new CognitiveEventFabric(128);
const rootBoundaryEvent = rootBoundaryFabric.append({
  id:'restore:root-schema-baseline',tick:58,at:5800,stage:'observation',
  source:'restore-test',parentIds:[],external:false,confidence01:0.75,payload:{preserve:'root-schema'},
});
const rootBoundaryBefore = rootBoundaryFabric.snapshot();
const malformedRootSnapshots = [
  {snapshot:{version:undefined,recent:[]},pattern:/unsupported-cognitive-event-fabric-snapshot-version/,label:'a present undefined schema version is not a legacy omission'},
  {snapshot:{version:1,recent:{}},pattern:/field-must-be-an-array:recent/,label:'a present non-array recent field must not erase history'},
  {snapshot:{version:1,recent:[],receiptEvents:null},pattern:/field-must-be-an-array:receiptEvents/,label:'a present malformed receiptEvents field must fail closed'},
  {snapshot:{version:1,recent:[],receiptProjectionIndex:{}},pattern:/field-must-be-an-array:receiptProjectionIndex/,label:'a present non-array receipt index must not be silently discarded'},
  {snapshot:{version:1,recent:[],total:'9'},pattern:/total-must-be-a-safe-integer/,label:'a string total is not a valid persisted event counter'},
  {snapshot:{version:1,recent:[],total:undefined},pattern:/total-must-be-a-safe-integer/,label:'a present undefined total is not equivalent to a missing legacy field'},
  {snapshot:{version:1,recent:[],total:Number.MAX_SAFE_INTEGER+1},pattern:/total-must-be-a-safe-integer/,label:'an unsafe total cannot contaminate event-count telemetry'},
];
for(const item of malformedRootSnapshots) {
  assert.throws(()=>rootBoundaryFabric.restore(item.snapshot),item.pattern,item.label);
  assert.deepEqual(rootBoundaryFabric.snapshot(),rootBoundaryBefore, item.label+'; previous live state must remain equivalent');
}
assert.equal(rootBoundaryFabric.getById(rootBoundaryEvent.id)?.payload.preserve,'root-schema');
const legacyWithoutOptionalRootFields = new CognitiveEventFabric(128);
legacyWithoutOptionalRootFields.restore({recent:[restoreSourceEvent]});
assert.equal(legacyWithoutOptionalRootFields.getById(restoreSourceEvent.id)?.tick,55,
  'legacy snapshots that omit optional version, total and index fields remain readable');
console.log('WorkPass363 event-fabric root schema atomicity: PASS');

// Event append and restore must share one non-coercive data contract.
const appendBoundaryFabric = new CognitiveEventFabric(128);
const appendBaseline = appendBoundaryFabric.append({
  id:'append-boundary:baseline',tick:3,at:300,stage:'observation',source:'append-test',
  parentIds:[],external:false,confidence01:0.7,payload:{stable:{value:1}},
});
const appendBefore = appendBoundaryFabric.snapshot();
let appendNestedGetterExecuted=false;
const appendNestedAccessor={};
Object.defineProperty(appendNestedAccessor,'unsafe',{
  enumerable:true,
  get(){appendNestedGetterExecuted=true;throw new Error('append must not evaluate payload getter');},
});
const malformedAppendInputs = [
  {input:{id:'append-boundary:string-tick',tick:'3',at:301,stage:'observation',source:'append-test'},pattern:/invalid-cognitive-event-tick/,label:'string ticks must not be coerced'},
  {input:{id:'append-boundary:fractional-tick',tick:3.5,at:302,stage:'observation',source:'append-test'},pattern:/invalid-cognitive-event-tick/,label:'fractional ticks must not be rounded'},
  {input:{id:'append-boundary:negative-tick',tick:-1,at:303,stage:'observation',source:'append-test'},pattern:/invalid-cognitive-event-tick/,label:'negative ticks must not be clamped to zero'},
  {input:{id:'append-boundary:unsafe-tick',tick:Number.MAX_SAFE_INTEGER+1,at:304,stage:'observation',source:'append-test'},pattern:/invalid-cognitive-event-tick/,label:'unsafe integer ticks must not enter the ledger'},
  {input:{id:'append-boundary:negative-at',tick:4,at:-1,stage:'observation',source:'append-test'},pattern:/invalid-cognitive-event-timestamp/,label:'negative timestamps must not be recorded and later dropped on restore'},
  {input:{id:'append-boundary:string-at',tick:4,at:'304',stage:'observation',source:'append-test'},pattern:/invalid-cognitive-event-timestamp/,label:'string timestamps must not be replaced with wall-clock time'},
  {input:{id:'append-boundary:invalid-stage',tick:4,at:305,stage:'not-a-cognitive-stage',source:'append-test'},pattern:/invalid-cognitive-event-stage/,label:'unknown stages must not be recorded'},
  {input:{id:'append-boundary:string-external',tick:4,at:306,stage:'observation',source:'append-test',external:'false'},pattern:/invalid-cognitive-event-external-flag/,label:'string false must not become boolean true'},
  {input:{id:'append-boundary:invalid-confidence',tick:4,at:307,stage:'observation',source:'append-test',confidence01:1.1},pattern:/invalid-cognitive-event-confidence/,label:'out-of-range confidence must not be clamped into accepted evidence'},
  {input:{id:'append-boundary:string-parent-list',tick:4,at:308,stage:'observation',source:'append-test',parentIds:'append-boundary:baseline'},pattern:/invalid-cognitive-event-parent-ids/,label:'a string cannot be expanded into causal parent characters'},
  {input:{id:'append-boundary:noncanonical-parent',tick:4,at:309,stage:'observation',source:'append-test',parentIds:[' append-boundary:baseline ']},pattern:/invalid-cognitive-event-parent-ids/,label:'noncanonical parent IDs must be rejected'},
  {input:{id:'append-boundary:nested-accessor',tick:4,at:310,stage:'observation',source:'append-test',payload:{nested:appendNestedAccessor}},pattern:/event-payload-accessor/,label:'nested payload getters must not run during append'},
];
for(const item of malformedAppendInputs) {
  assert.throws(()=>appendBoundaryFabric.append(item.input),item.pattern,item.label);
  assert.deepEqual(appendBoundaryFabric.snapshot(),appendBefore,item.label+'; failed append must not mutate the journal');
}
const accessorInput={tick:4,at:311,stage:'observation',source:'append-test',payload:{}};
let appendInputGetterExecuted=false;
Object.defineProperty(accessorInput,'tick',{
  enumerable:true,
  get(){appendInputGetterExecuted=true;throw new Error('input getter must not run');},
});
assert.throws(()=>appendBoundaryFabric.append(accessorInput),/cognitive-event-input-field-accessor:tick/);
assert.equal(appendInputGetterExecuted,false,'append must not execute accessors on the outer input');
assert.equal(appendNestedGetterExecuted,false,'append must not execute nested payload accessors');
assert.equal(appendBoundaryFabric.getById(appendBaseline.id)?.payload.stable.value,1);
const appendRestore = new CognitiveEventFabric(128);
appendRestore.restore(appendBoundaryFabric.snapshot());
assert.equal(appendRestore.getById(appendBaseline.id)?.payload.stable.value,1,
  'a valid appended event must survive the strict restore projection');
console.log('WorkPass364 event-fabric append ingress: PASS');

// WorkPass365: strict tool-receipt projection, durable fingerprint binding and atomic writes.
const receiptFabric = new CognitiveEventFabric(128);
const receiptDecision = receiptFabric.append({
  id:'receipt-test:decision',tick:10,at:1000,stage:'action',source:'receipt-test',
  parentIds:[],external:false,confidence01:0.8,payload:{intent:'test'},
});
const receiptInput = {
  tick:11,executionId:'receipt-test:execution-1',toolId:'test-tool',decisionId:receiptDecision.id,
  ok:true,verified:true,outcomeClass:'success',confidence01:0.8,verificationBasis:'independent-check',
  externalObservation:true,observationId:'receipt-test:observation-1',
  expectedPostcondition:'  VALUE = 2  ',observedPostcondition:'Value = 2',
  observationIntegrated:true,at:1100,
};
const receiptTrace = receiptFabric.appendToolReceiptTrace(receiptInput);
assert.equal(receiptTrace.replayed,false);
assert.equal(receiptFabric.snapshot().total,4,'one receipt projection must append exactly three causal nodes');
const receiptEvidence = receiptFabric.getById(receiptTrace.evidenceEventId);
assert.equal(typeof receiptEvidence?.payload.projectionHash,'string','receipt fingerprint must be stored in the evidence node');
assert.match(receiptEvidence.payload.projectionHash,/^[a-f0-9]{64}$/);
assert.equal(typeof receiptEvidence.payload.expectedPostconditionHash,'string');
assert.equal(receiptEvidence.payload.expectedPostconditionHash,receiptEvidence.payload.observedPostconditionHash,
  'canonicalized postcondition hashes must be deterministic and locale-independent');
const firstReceiptSnapshot = receiptFabric.snapshot();
const receiptReplay = receiptFabric.appendToolReceiptTrace(receiptInput);
assert.equal(receiptReplay.replayed,true);
assert.equal(receiptReplay.actionEventId,receiptTrace.actionEventId);
assert.equal(receiptFabric.snapshot().total,firstReceiptSnapshot.total,'receipt replay must not append duplicate events');
const receiptRestored = new CognitiveEventFabric(128);
receiptRestored.restore(firstReceiptSnapshot);
const restoredReceiptReplay = receiptRestored.appendToolReceiptTrace(receiptInput);
assert.equal(restoredReceiptReplay.replayed,true,'the receipt fingerprint and causal links must survive restart restore');
assert.equal(restoredReceiptReplay.evidenceEventId,receiptTrace.evidenceEventId);

const tamperedReceiptSnapshot = receiptFabric.snapshot();
tamperedReceiptSnapshot.receiptProjectionIndex[0].projectionHash='f'.repeat(64);
assert.equal(receiptFabric.appendToolReceiptTrace(receiptInput).replayed,true,
  'mutating the exported snapshot must not mutate the live receipt replay index');
const tamperedReceiptRestore = new CognitiveEventFabric(128);
tamperedReceiptRestore.restore(tamperedReceiptSnapshot);
assert.equal(tamperedReceiptRestore.hasToolReceiptTrace(receiptInput.executionId),false,
  'a receipt index whose hash conflicts with its three causal event hashes must not be restored');
const tamperedEvidenceSnapshot = receiptFabric.snapshot();
const tamperedEvidenceNode = tamperedEvidenceSnapshot.recent.find(event=>event.id===receiptTrace.evidenceEventId);
assert.ok(tamperedEvidenceNode);
tamperedEvidenceNode.payload.projectionHash='e'.repeat(64);
const tamperedEvidenceRestore = new CognitiveEventFabric(128);
tamperedEvidenceRestore.restore(tamperedEvidenceSnapshot);
assert.equal(tamperedEvidenceRestore.hasToolReceiptTrace(receiptInput.executionId),false,
  'tampering with an event-bound receipt fingerprint must invalidate the replay index');

const receiptNoMutationFabric = new CognitiveEventFabric(128);
receiptNoMutationFabric.append({id:'receipt-test:anchor',tick:20,at:2000,stage:'action',source:'receipt-test',parentIds:[],payload:{anchor:true}});
const receiptNoMutationBefore = receiptNoMutationFabric.snapshot();
const invalidReceiptCases = [
  {patch:{tick:20.5},pattern:/tool-receipt-tick-invalid/,label:'fractional receipt ticks must be rejected'},
  {patch:{executionId:' receipt-test:bad-id '},pattern:/tool-receipt-execution-id-invalid/,label:'receipt IDs must be canonical without trim/truncate aliasing'},
  {patch:{ok:'false'},pattern:/tool-receipt-ok-must-be-boolean/,label:'string false must not become a successful action receipt'},
  {patch:{verified:0},pattern:/tool-receipt-verified-must-be-boolean/,label:'numeric verification flags must not become booleans'},
  {patch:{externalObservation:'false'},pattern:/tool-receipt-external-observation-must-be-boolean/,label:'string external flags must not become true'},
  {patch:{observationIntegrated:'false'},pattern:/tool-receipt-observation-integrated-must-be-boolean/,label:'string integration flags must not be accepted'},
  {patch:{confidence01:1.01},pattern:/tool-receipt-confidence-invalid/,label:'out-of-range confidence must fail rather than clamp'},
  {patch:{at:-1},pattern:/tool-receipt-timestamp-invalid/,label:'negative receipt timestamp must fail before writes'},
  {patch:{expectedPostcondition:7},pattern:/tool-receipt-expected-postcondition-invalid/,label:'non-string postconditions must be rejected'},
  {patch:{decisionId:'receipt-test:missing-anchor'},pattern:/tool-receipt-decision-anchor-not-found/,label:'a declared decision link must resolve before receipt projection'},
];
for(const item of invalidReceiptCases) {
  assert.throws(()=>receiptNoMutationFabric.appendToolReceiptTrace({...receiptInput,...item.patch}),item.pattern,item.label);
  assert.deepEqual(receiptNoMutationFabric.snapshot(),receiptNoMutationBefore,item.label+'; failed receipt projection must not mutate the ledger');
}
const accessorReceiptInput={...receiptInput,executionId:'receipt-test:accessor'};
let receiptGetterExecuted=false;
Object.defineProperty(accessorReceiptInput,'ok',{enumerable:true,get(){receiptGetterExecuted=true;throw new Error('receipt getter must not run');}});
assert.throws(()=>receiptNoMutationFabric.appendToolReceiptTrace(accessorReceiptInput),/tool-receipt-input-field-accessor:ok/);
assert.equal(receiptGetterExecuted,false,'receipt input accessors must not be evaluated');

const atomicReceiptFabric = new CognitiveEventFabric(128);
const atomicReceiptBefore = atomicReceiptFabric.snapshot();
const originalAtomicAppend=atomicReceiptFabric.append.bind(atomicReceiptFabric);
let atomicAppendCalls=0;
atomicReceiptFabric.append=(eventInput)=>{
  atomicAppendCalls+=1;
  if(atomicAppendCalls===2)throw new Error('injected-receipt-middle-write-failure');
  return originalAtomicAppend(eventInput);
};
assert.throws(()=>atomicReceiptFabric.appendToolReceiptTrace({...receiptInput,executionId:'receipt-test:atomic-failure',decisionId:undefined}),/injected-receipt-middle-write-failure/);
atomicReceiptFabric.append=originalAtomicAppend;
assert.deepEqual(atomicReceiptFabric.snapshot(),atomicReceiptBefore,
  'if a receipt trace fails mid-write, events, total and replay index must roll back atomically');
console.log('WorkPass365 receipt projection fingerprint and atomicity: PASS');

// WorkPass366: provider revisions and external observations use the same strict evidence boundary.
const revisionInput = {
  tick:12,executionId:receiptInput.executionId,toolId:receiptInput.toolId,
  revisionId:'receipt-test:revision-1',revisionNumber:1,
  providerReceiptHash:'a'.repeat(64),revisionFingerprint:'b'.repeat(64),
  outcomeClass:'success',ok:true,verified:true,verificationBasis:'provider-attestation',
  confidence01:0.9,observationId:'receipt-test:observation-1',status:'verified',
  reason:'provider confirms success',at:1200,
};
const revisionResult=receiptFabric.appendToolReceiptRevision(revisionInput);
assert.equal(revisionResult.resolved,true);
assert.equal(revisionResult.replayed,false);
const revisionEvent=receiptFabric.getById(revisionResult.eventId);
assert.equal(revisionEvent?.payload.revisionNumber,1);
assert.match(revisionResult.projectionHash,/^[a-f0-9]{64}$/);
assert.equal(receiptFabric.appendToolReceiptRevision(revisionInput).replayed,true,
  'provider revision replay must be idempotent');
const revisionReplaySnapshot=receiptFabric.snapshot();
const expandedRevisionSnapshot=receiptFabric.snapshot();
const revisionRestored=new CognitiveEventFabric(128);
revisionRestored.restore(expandedRevisionSnapshot);
const restoredRevisionReplay=revisionRestored.appendToolReceiptRevision(revisionInput);
assert.equal(restoredRevisionReplay.resolved,true);
assert.equal(restoredRevisionReplay.replayed,true,'revision IDs/hashes must survive restore');
assert.equal(restoredRevisionReplay.eventId,revisionResult.eventId);

const secondRevisionInput={
  ...revisionInput,revisionId:'receipt-test:revision-2',revisionNumber:2,
  providerReceiptHash:'c'.repeat(64),revisionFingerprint:'d'.repeat(64),
  revisionFingerprint:'d'.repeat(64),reason:'provider signed correction',at:1210,
};
const secondRevisionResult=receiptFabric.appendToolReceiptRevision(secondRevisionInput);
assert.equal(secondRevisionResult.resolved,true);
assert.equal(secondRevisionResult.replayed,false);
const chainedRevisionSnapshot=receiptFabric.snapshot();
const chainedRevisionRestored=new CognitiveEventFabric(128);
chainedRevisionRestored.restore(chainedRevisionSnapshot);
const chainedRevisionReplay=chainedRevisionRestored.appendToolReceiptRevision(secondRevisionInput);
assert.equal(chainedRevisionReplay.resolved,true);
assert.equal(chainedRevisionReplay.replayed,true,
  'an intact monotonic revision chain must preserve idempotency after restore');

// A tampered revision may remain present in the event buffer, but without the parent
// link it must not be promoted to an idempotent trusted revision after restore.
const tamperedRevisionLineageSnapshot=receiptFabric.snapshot();
const tamperedRevisionNode=tamperedRevisionLineageSnapshot.recent.find(event=>event.id===revisionResult.eventId);
assert.ok(tamperedRevisionNode);
tamperedRevisionNode.parentIds=[];
const tamperedRevisionLineageRestored=new CognitiveEventFabric(128);
tamperedRevisionLineageRestored.restore(tamperedRevisionLineageSnapshot);
assert.equal(tamperedRevisionLineageRestored.hasToolReceiptTrace(receiptInput.executionId),true,
  'the canonical receipt trio remains intact even if an ancillary revision was tampered with');
assert.throws(()=>tamperedRevisionLineageRestored.appendToolReceiptRevision(revisionInput),
  /tool-receipt-revision-lineage-conflict/,
  'a deterministic revision event with missing causal parents must not be reported as replayed');

const externalObservationInput = {
  tick:13,executionId:receiptInput.executionId,toolId:receiptInput.toolId,
  observationId:'receipt-test:independent-observation-1',verified:true,confidence01:0.92,
  sourceId:'independent-validator',sourceClass:'independent',channel:'test-harness',
  independenceKey:'sensor-2',expectedPostcondition:'Value = 2',observedPostcondition:'value = 2',
  reason:'independent confirmation',at:1300,
};
const externalObservationResult=receiptFabric.appendToolExternalObservation(externalObservationInput);
assert.equal(externalObservationResult.resolved,true);
assert.equal(externalObservationResult.replayed,false);
const externalObservationEvent=receiptFabric.getById(externalObservationResult.eventId);
assert.equal(externalObservationEvent?.stage,'external-evidence');
assert.equal(externalObservationEvent?.external,true);
assert.equal(externalObservationEvent?.payload.evidenceStatus,'corroborated');
assert.equal(externalObservationEvent?.payload.expectedPostconditionHash,externalObservationEvent?.payload.observedPostconditionHash);
assert.equal(Object.hasOwn(externalObservationEvent?.payload??{},'expectedPostcondition'),false,
  'raw external postcondition text must not be persisted');
assert.equal(receiptFabric.appendToolExternalObservation(externalObservationInput).replayed,true,
  'external observation replay must be idempotent');
const detachedNestedIndexSnapshot=receiptFabric.snapshot();
const detachedNestedIndex=detachedNestedIndexSnapshot.receiptProjectionIndex[0];
assert.ok(detachedNestedIndex?.receiptRevisions?.length);
assert.ok(detachedNestedIndex?.externalObservations?.length);
detachedNestedIndex.receiptRevisions[0].projectionHash='d'.repeat(64);
detachedNestedIndex.externalObservations[0].projectionHash='c'.repeat(64);
assert.equal(receiptFabric.appendToolReceiptRevision(revisionInput).replayed,true,
  'mutating nested exported revision refs must not poison live revision replay guards');
assert.equal(receiptFabric.appendToolExternalObservation(externalObservationInput).replayed,true,
  'mutating nested exported observation refs must not poison live observation replay guards');
const expandedEvidenceSnapshot=receiptFabric.snapshot();
const expandedEvidenceRestored=new CognitiveEventFabric(128);
expandedEvidenceRestored.restore(expandedEvidenceSnapshot);
assert.equal(expandedEvidenceRestored.appendToolReceiptRevision(revisionInput).replayed,true);
assert.equal(expandedEvidenceRestored.appendToolExternalObservation(externalObservationInput).replayed,true,
  'receipt revision and observation idempotency references must survive restart');

const tamperedObservationLineageSnapshot=receiptFabric.snapshot();
const tamperedObservationNode=tamperedObservationLineageSnapshot.recent.find(event=>event.id===externalObservationResult.eventId);
assert.ok(tamperedObservationNode);
tamperedObservationNode.parentIds=[];
const tamperedObservationLineageRestored=new CognitiveEventFabric(128);
tamperedObservationLineageRestored.restore(tamperedObservationLineageSnapshot);
assert.equal(tamperedObservationLineageRestored.hasToolReceiptTrace(receiptInput.executionId),true,
  'external observation damage must not invalidate the independent canonical receipt trio');
assert.throws(()=>tamperedObservationLineageRestored.appendToolExternalObservation(externalObservationInput),
  /external-observation-lineage-conflict/,
  'an observation without its receipt-outcome parent must not be accepted as an idempotent replay');

const invalidRevisionCases = [
  {patch:{tick:12.5},reason:'revision-tick-invalid'},
  {patch:{revisionNumber:0},reason:'revision-number-invalid'},
  {patch:{providerReceiptHash:17},reason:'revision-hash-invalid'},
  {patch:{ok:'false'},reason:'revision-ok-must-be-boolean'},
  {patch:{verified:'false'},reason:'revision-verified-must-be-boolean'},
  {patch:{status:'untrusted'},reason:'revision-status-invalid'},
  {patch:{confidence01:1.01},reason:'revision-confidence-invalid'},
  {patch:{at:-1},reason:'revision-timestamp-invalid'},
  {patch:{executionId:' '+receiptInput.executionId+' '},reason:'execution-id-invalid'},
  {patch:{observationId:' receipt-test:observation-1 '},reason:'revision-observation-id-invalid'},
  {patch:{reason:'too-long'.repeat(30)},reason:'revision-reason-invalid'},
  {patch:{revisionId:'receipt-test:revision-duplicate-number',revisionNumber:1},reason:'revision-number-not-increasing'},
];
const beforeInvalidRevision=receiptFabric.snapshot();
for(const item of invalidRevisionCases){
  const result=receiptFabric.appendToolReceiptRevision({...revisionInput,...item.patch});
  assert.equal(result.resolved,false,item.reason);
  assert.equal(result.reason,item.reason);
  assert.deepEqual(receiptFabric.snapshot(),beforeInvalidRevision,
    item.reason+'; rejected provider revision must not mutate the journal');
}
const accessorRevisionInput={...revisionInput,revisionId:'receipt-test:revision-accessor'};
let revisionGetterExecuted=false;
Object.defineProperty(accessorRevisionInput,'verified',{enumerable:true,get(){revisionGetterExecuted=true;throw new Error('revision getter must not run');}});
assert.equal(receiptFabric.appendToolReceiptRevision(accessorRevisionInput).resolved,false);
assert.equal(revisionGetterExecuted,false,'revision input accessors must not execute');

const invalidExternalObservationCases = [
  {patch:{tick:13.25},reason:'observation-tick-invalid'},
  {patch:{verified:'false'},reason:'observation-verified-must-be-boolean'},
  {patch:{confidence01:NaN},reason:'observation-confidence-invalid'},
  {patch:{executionId:' '+receiptInput.executionId+' '},reason:'execution-id-invalid'},
  {patch:{observationId:' invalid observation '},reason:'observation-id-invalid'},
  {patch:{toolId:'test-tool '},reason:'tool-id-invalid'},
  {patch:{expectedPostcondition:23},reason:'observation-expected-postcondition-invalid'},
  {patch:{at:'1300'},reason:'observation-timestamp-invalid'},
  {patch:{reason:'too-long'.repeat(30)},reason:'observation-reason-invalid'},
];
const beforeInvalidObservation=receiptFabric.snapshot();
for(const item of invalidExternalObservationCases){
  const result=receiptFabric.appendToolExternalObservation({...externalObservationInput,...item.patch});
  assert.equal(result.resolved,false,item.reason);
  assert.equal(result.reason,item.reason);
  assert.deepEqual(receiptFabric.snapshot(),beforeInvalidObservation,
    item.reason+'; rejected external observation must not mutate the journal');
}
const accessorExternalObservation={...externalObservationInput,observationId:'receipt-test:observation-accessor'};
let observationGetterExecuted=false;
Object.defineProperty(accessorExternalObservation,'verified',{enumerable:true,get(){observationGetterExecuted=true;throw new Error('observation getter must not run');}});
assert.equal(receiptFabric.appendToolExternalObservation(accessorExternalObservation).resolved,false);
assert.equal(observationGetterExecuted,false,'external observation accessors must not execute');

console.log('WorkPass366 provider revision and external observation ingress: PASS');

// WorkPass367: receipt trust requires an actual same-execution causal chain, not stage names alone.
const lineageGuardFabric = new CognitiveEventFabric(128);
const lineageGuardInput={...receiptInput,executionId:'receipt-lineage:guard-case',decisionId:undefined};
const lineageGuardTrace=lineageGuardFabric.appendToolReceiptTrace(lineageGuardInput);
assert.equal(lineageGuardFabric.hasToolReceiptTrace(lineageGuardInput.executionId),true);
assert.equal(lineageGuardFabric.hasToolReceiptTrace(' '+lineageGuardInput.executionId+' '),false,
  'lookup must not normalize arbitrary caller IDs into an existing evidence key');
assert.equal(lineageGuardFabric.hasToolReceiptTrace(42),false,
  'receipt lookup must not stringify non-string identifiers');
const decoyOutcome=lineageGuardFabric.append({
  id:'receipt-lineage:decoy-outcome',tick:12,at:1201,stage:'tool-outcome',source:'test-decoy',
  parentIds:[],external:false,confidence01:0.8,
  payload:{executionId:lineageGuardInput.executionId,tool:lineageGuardInput.toolId,ok:true,verified:true},
});
const decoyEvidence=lineageGuardFabric.append({
  id:'receipt-lineage:decoy-evidence',tick:12,at:1202,stage:'tool-evidence',source:'test-decoy',
  parentIds:[],external:false,confidence01:0.8,
  payload:{executionId:lineageGuardInput.executionId,tool:lineageGuardInput.toolId,externalObservation:false},
});
const lineageIndex=lineageGuardFabric.receiptProjectionIndex.get(lineageGuardInput.executionId);
assert.ok(lineageIndex);
lineageGuardFabric.receiptProjectionIndex.set(lineageGuardInput.executionId,{
  ...lineageIndex,outcomeEventId:decoyOutcome.id,evidenceEventId:decoyEvidence.id,
});
assert.equal(lineageGuardFabric.hasToolReceiptTrace(lineageGuardInput.executionId),false,
  'same-stage nodes with matching execution IDs but missing causal edges are not a valid receipt');
lineageGuardFabric.receiptProjectionIndex.set(lineageGuardInput.executionId,lineageIndex);
assert.equal(lineageGuardFabric.hasToolReceiptTrace(lineageGuardInput.executionId),true,
  'restoring the original replay index must restore valid lineage');
lineageGuardFabric.receiptProjectionIndex.set(lineageGuardInput.executionId,{
  ...lineageIndex,projectionHash:'a'.repeat(64),
});
assert.equal(lineageGuardFabric.hasToolReceiptTrace(lineageGuardInput.executionId),false,
  'receipt index hashes must match the event-bound fingerprint');
lineageGuardFabric.receiptProjectionIndex.set(lineageGuardInput.executionId,lineageIndex);
const lineageGuardRestored=new CognitiveEventFabric(128);
lineageGuardRestored.restore(lineageGuardFabric.snapshot());
assert.equal(lineageGuardRestored.hasToolReceiptTrace(lineageGuardInput.executionId),true,
  'valid event-bound receipt lineage remains valid after restore');
console.log('WorkPass367 trusted receipt lineage verification: PASS');

// WorkPass368: an existing revision/observation cannot replay once its causal parent edge is severed.
const tamperedRevisionLineageSnapshot368=receiptFabric.snapshot();
const tamperedRevisionNode368=tamperedRevisionLineageSnapshot368.recent.find(event=>event.id===revisionResult.eventId);
assert.ok(tamperedRevisionNode368);
tamperedRevisionNode368.parentIds=[];
const tamperedRevisionRestored368=new CognitiveEventFabric(128);
tamperedRevisionRestored368.restore(tamperedRevisionLineageSnapshot368);
assert.equal(tamperedRevisionRestored368.hasToolReceiptTrace(receiptInput.executionId),true);
assert.throws(()=>tamperedRevisionRestored368.appendToolReceiptRevision(revisionInput),
  /tool-receipt-revision-lineage-conflict/,
  'a same-ID provider revision without its outcome parent cannot be trusted as replay');

const tamperedObservationLineageSnapshot368=receiptFabric.snapshot();
const tamperedObservationNode368=tamperedObservationLineageSnapshot368.recent.find(event=>event.id===externalObservationResult.eventId);
assert.ok(tamperedObservationNode368);
tamperedObservationNode368.parentIds=[];
const tamperedObservationRestored368=new CognitiveEventFabric(128);
tamperedObservationRestored368.restore(tamperedObservationLineageSnapshot368);
assert.equal(tamperedObservationRestored368.hasToolReceiptTrace(receiptInput.executionId),true);
assert.throws(()=>tamperedObservationRestored368.appendToolExternalObservation(externalObservationInput),
  /external-observation-lineage-conflict/,
  'a same-ID external observation without its outcome parent cannot be trusted as replay');
console.log('WorkPass368 receipt reference causal lineage: PASS');
console.log('WorkPass362 event-fabric restore boundary: PASS');

