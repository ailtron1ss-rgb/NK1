import assert from 'node:assert/strict';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';
import { P26TrueLearningEngine } from '../src/organism/learning/P26TrueLearningEngine.ts';

const cx=new CausalExperienceStream(128);
const baseFeatures=Array.from({length:16},(_,i)=>i%2?.7:.3);
const add=(id,tick,score,action='explore')=>cx.recordExternalLearningEvent({
  tick,taskId:id,action,reward01:.5,success01:.5,surprise01:score,novelty01:score,
  uncertainty01:score,identityRelevance01:score,goalPressure01:score,causalStrength01:score,
  traceId:id,stateGrounded:true,provenance:'runtime-outcome',evidenceKey:id
});
const high=add('high',1,.98);
const medium=add('medium',2,.52);
const low=add('low',3,.08);
// External records intentionally have no policy vector; inject it through the public snapshot/restore
// to model a grounded policy-learning sample without depending on internal fields.
const snap=cx.snapshot();
for(const r of snap.records) r.policyFeatures01=baseFeatures;
cx.restore(snap);
const first=cx.prioritizedReplayCandidates(2,Date.now()+7*86400000);
assert.equal(first.length,2);
assert.equal(first[0].id,high.id);
assert.ok((first[0].replayPriority01??0)>(first[1].replayPriority01??0));
const p26=new P26TrueLearningEngine();
const before=p26.snapshot().policy.updates;
const trained=p26.replayCausalRecords(first);
assert.ok(trained.updates>0);
assert.ok(p26.snapshot().policy.updates>before);
cx.markReplay([high.id],Date.now());
const second=cx.prioritizedReplayCandidates(3,Date.now());
const highAfter=second.find(x=>x.id===high.id);
assert.ok(highAfter && (highAfter.replayPriority01??1)<(first[0].replayPriority01??0),'replayed item should receive a cooldown/repetition penalty');
console.log('P2699 prioritized hippocampal replay PASS',JSON.stringify({first:first.map(x=>({id:x.id,priority:x.replayPriority01})),highAfter:highAfter?.replayPriority01,secondTop:second[0]?.id,updates:trained.updates}));
