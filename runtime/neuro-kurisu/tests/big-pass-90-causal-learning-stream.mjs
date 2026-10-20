import assert from 'node:assert/strict';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';

const mkState=(overrides={})=>({
  tick:1,at:1000,predictionError:.6,attentionBudget:.8,selfPredictionError:.2,autonomyScore:.6,
  needs:{energy:.7,cognitiveLoad:.3,uncertainty:.65,novelty:.7,goalPressure:.6,socialNeed:.4,identityCoherence:.82},
  ...overrides,
});
const trace={
  id:'trace-90',tick:1,createdAt:1000,candidates:[],selected:{action:'explore',goalId:'goal-1',predictedUtility:.6,confidence:.7,predictedCost:.3,reasons:[]},
  stateBefore:mkState(),reasoningSignals:{},userRequestedAction:null,autonomousOverride:true,predictedOutcomes:[]
};

const stream=new CausalExperienceStream(16);
stream.observe(trace);
const record=stream.recordOutcome(trace,mkState({tick:2,at:1100,needs:{...mkState().needs,energy:.55,uncertainty:.4,novelty:.75}}),{reward01:.8,success01:.8,surprise01:.7,novelty01:.75});
assert.ok(record);
assert.ok(record.causalStrength01>.3);
assert.ok(stream.summary().rolling.learningOpportunity01>0);
assert.equal(stream.recordOutcome(trace,mkState({tick:3}),{reward01:1,success01:1,surprise01:0,novelty01:0}),null,'a decision trace must not receive causal learning credit twice');
assert.equal(stream.recordOutcome({...trace,id:'  trace-90  '},mkState({tick:3}),{reward01:1,success01:1,surprise01:1,novelty01:1}),null,'whitespace variants of a stable trace ID must not bypass causal deduplication');
const externalInput={tick:4,taskId:'external-once',action:'reflect',reward01:.7,success01:.7,surprise01:.2,novelty01:.3,traceId:'external-trace-once',provenance:'skill-repair',stateGrounded:false};
assert.ok(stream.recordExternalLearningEvent(externalInput));
assert.equal(stream.recordExternalLearningEvent({...externalInput,reward01:1,success01:1}),null,'external causal events with the same stable trace ID must not receive duplicate credit');
assert.equal(stream.recordExternalLearningEvent({...externalInput,traceId:'  external-trace-once  ',reward01:1,success01:1}),null,'normalized external trace IDs must share the same idempotency key');

const packet=stream.learningPacket(8);
assert.equal(packet.records.length,2,'the causal packet must include both the verified runtime outcome and the accepted external event');
assert.deepEqual(new Set(packet.records.map(row=>row.traceId)),new Set(['trace-90','external-trace-once']));
assert.ok(packet.meanCausalStrength01>0);
const persisted=stream.snapshot();
const restored=new CausalExperienceStream(16);
restored.restore(persisted);
assert.deepEqual(restored.recent(8),stream.recent(8));
assert.equal(restored.recordExternalLearningEvent({...externalInput,reward01:1,success01:1}),null,'external trace deduplication must survive snapshot restore');
const legacySnapshot=stream.snapshot();
legacySnapshot.recordedTraceIds=[...(legacySnapshot.recordedTraceIds??[]),'  legacy-external-trace  '];
const legacyExternal=legacySnapshot.records.find(row=>row.traceId==='external-trace-once');
if(legacyExternal) legacyExternal.traceId=' external-trace-once ';
const legacyRestored=new CausalExperienceStream(16);legacyRestored.restore(legacySnapshot);
assert.equal(legacyRestored.recent(8).find(row=>row.traceId==='external-trace-once')?.traceId,'external-trace-once','restore must canonicalize legacy persisted record IDs');
assert.equal(legacyRestored.recordExternalLearningEvent({...externalInput,traceId:'legacy-external-trace'}),null,'restore must canonicalize legacy persisted deduplication IDs');
for(let i=0;i<70;i++){
  const nextTrace={...trace,id:`trace-evict-${i}`,tick:i+10,createdAt:1000+i};
  stream.recordOutcome(nextTrace,mkState({tick:i+11}),{reward01:.6,success01:.6,surprise01:.2,novelty01:.2});
}
assert.equal(stream.recent(64).some(row=>row.traceId==='trace-90'),false,'fixture must evict the old outcome from the bounded record window');
assert.equal(stream.recordOutcome(trace,mkState({tick:999}),{reward01:1,success01:1,surprise01:1,novelty01:1}),null,'dedupe history must prevent re-credit after record eviction');
const dedupeRestored=new CausalExperienceStream(64);dedupeRestored.restore(stream.snapshot());
assert.equal(dedupeRestored.recordOutcome(trace,mkState({tick:1000}),{reward01:1,success01:1,surprise01:1,novelty01:1}),null,'dedupe history must survive snapshot and restart');
assert.ok((dedupeRestored.snapshot().recordedTraceIds??[]).length<=4096,'dedupe history must remain bounded');
const normalizedEvictionStream=new CausalExperienceStream(64);
const paddedTrace={...trace,id:'  normalized-after-eviction  '};
assert.ok(normalizedEvictionStream.recordOutcome(paddedTrace,mkState({tick:2}),{reward01:.7,success01:.7,surprise01:.3,novelty01:.2}));
for(let i=0;i<70;i++){
  normalizedEvictionStream.recordOutcome({...trace,id:`normalized-evict-${i}`,tick:i+20},mkState({tick:i+21}),{reward01:.6,success01:.6,surprise01:.2,novelty01:.2});
}
assert.equal(normalizedEvictionStream.recent(64).some(row=>row.traceId==='normalized-after-eviction'),false,'normalized fixture must evict its original causal record');
assert.equal(normalizedEvictionStream.recordOutcome({...trace,id:'normalized-after-eviction'},mkState({tick:200}),{reward01:1,success01:1,surprise01:1,novelty01:1}),null,'the canonical trace ID must remain deduplicated after a padded ID record is evicted');


// Replay must balance high-value experiences with task/context coverage.
const diverseReplay=new CausalExperienceStream(64);
for(let i=0;i<6;i++){
  const dominant={...trace,id:`replay-dominant-${i}`,tick:300+i,selected:{...trace.selected,goalId:'dominant-task'}};
  diverseReplay.recordOutcome(dominant,mkState({tick:301+i,needs:{...mkState().needs,energy:.25,uncertainty:.9,novelty:.95,goalPressure:.9}}),{reward01:.95,success01:.95,surprise01:.95,novelty01:.95});
}
for(let i=0;i<3;i++){
  const alternate={...trace,id:`replay-alternate-${i}`,tick:400+i,selected:{...trace.selected,goalId:`alternate-task-${i}`}};
  diverseReplay.recordOutcome(alternate,mkState({tick:401+i,needs:{...mkState().needs,energy:.65,uncertainty:.55,novelty:.55,goalPressure:.5}}),{reward01:.7,success01:.7,surprise01:.55,novelty01:.55});
}
const replayBatch=diverseReplay.prioritizedReplayCandidates(5,2000);
assert.equal(replayBatch.length,5);
assert.ok(new Set(replayBatch.map(row=>row.taskId)).size>=2,'replay selection must not let one high-scoring task monopolize the entire batch');
assert.ok(replayBatch[0].replayPriority01>=replayBatch[replayBatch.length-1].replayPriority01,'selected candidates retain their raw priority ordering metadata');

const consolidated=restored.consolidate(8,1200);
assert.equal(consolidated.length,1);
assert.equal(restored.summary().consolidated,1);
assert.ok(consolidated.every(row=>row.stateGrounded),'consolidation must only accept state-grounded experiences');
assert.equal(consolidated.some(row=>row.traceId==='external-trace-once'),false,'high-surprise but ungrounded external feedback must not become consolidated learning');
console.log('BIG_PASS_90_CAUSAL_STREAM=PASS');
