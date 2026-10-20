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
const externalInput={tick:4,taskId:'external-once',action:'reflect',reward01:.7,success01:.7,surprise01:.2,novelty01:.3,traceId:'external-trace-once',provenance:'skill-repair',stateGrounded:false};
assert.ok(stream.recordExternalLearningEvent(externalInput));
assert.equal(stream.recordExternalLearningEvent({...externalInput,reward01:1,success01:1}),null,'external causal events with the same stable trace ID must not receive duplicate credit');

const packet=stream.learningPacket(8);
assert.equal(packet.records.length,2,'the causal packet must include both the verified runtime outcome and the accepted external event');
assert.deepEqual(new Set(packet.records.map(row=>row.traceId)),new Set(['trace-90','external-trace-once']));
assert.ok(packet.meanCausalStrength01>0);
const persisted=stream.snapshot();
const restored=new CausalExperienceStream(16);
restored.restore(persisted);
assert.deepEqual(restored.recent(8),stream.recent(8));
assert.equal(restored.recordExternalLearningEvent({...externalInput,reward01:1,success01:1}),null,'external trace deduplication must survive snapshot restore');
for(let i=0;i<70;i++){
  const nextTrace={...trace,id:`trace-evict-${i}`,tick:i+10,createdAt:1000+i};
  stream.recordOutcome(nextTrace,mkState({tick:i+11}),{reward01:.6,success01:.6,surprise01:.2,novelty01:.2});
}
assert.equal(stream.recent(64).some(row=>row.traceId==='trace-90'),false,'fixture must evict the old outcome from the bounded record window');
assert.equal(stream.recordOutcome(trace,mkState({tick:999}),{reward01:1,success01:1,surprise01:1,novelty01:1}),null,'dedupe history must prevent re-credit after record eviction');
const dedupeRestored=new CausalExperienceStream(64);dedupeRestored.restore(stream.snapshot());
assert.equal(dedupeRestored.recordOutcome(trace,mkState({tick:1000}),{reward01:1,success01:1,surprise01:1,novelty01:1}),null,'dedupe history must survive snapshot and restart');
assert.ok((dedupeRestored.snapshot().recordedTraceIds??[]).length<=4096,'dedupe history must remain bounded');

const consolidated=restored.consolidate(8,1200);
assert.equal(consolidated.length,1);
assert.equal(restored.summary().consolidated,1);
console.log('BIG_PASS_90_CAUSAL_STREAM=PASS');
