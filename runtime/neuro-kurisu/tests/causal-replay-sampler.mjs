import assert from 'node:assert/strict';
import { selectCausalReplayBatch } from '../src/organism/learning/CausalReplaySampler.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const rows=Array.from({length:160},(_,i)=>{
  const features=Array.from({length:18},(_,j)=>(((i*(j+3)+j*11)%101)/100));
  return {id:`cx-${i}`,tick:i,taskId:`task-${Math.floor(i/8)}`,action:actions[(i+Math.floor(i/13))%actions.length],surprise01:i>=128?((i*7)%11)/10:((i*3)%7)/10,causalStrength01:((i*5)%13)/12,learningQuality01:((i*11)%17)/16,replayPriority01:i>=128?((i*7)%11)/10:((i*3)%7)/10,policyFeatures01:features};
});
const batch=selectCausalReplayBatch(rows,{maxBatchSize:32,recentQuota:8});
assert.equal(batch.length,32);
assert.equal(new Set(batch.map(x=>x.id)).size,32);
assert.equal(batch.filter(x=>x.tick>=152).length,8,'recent window must be guaranteed');
assert.ok(batch.some(x=>x.tick<32),'historical samples must remain eligible');
assert.ok(new Set(batch.map(x=>x.action)).size>=5,'action diversity should survive prioritization');
assert.deepEqual(batch,selectCausalReplayBatch(rows,{maxBatchSize:32,recentQuota:8}),'same input/config must be deterministic');
const duplicates=[...rows,{...rows[10],tick:1000,taskId:'tampered-later-copy',replayPriority01:1}];
const deduped=selectCausalReplayBatch(duplicates,{maxBatchSize:32,recentQuota:8});
assert.equal(deduped.filter(x=>x.id==='cx-10').length,1);
assert.equal(deduped.find(x=>x.id==='cx-10').tick,1000,'latest version of a stable experience ID wins');
for(const cap of [0,1,8,32,128,999]){
  const selected=selectCausalReplayBatch(rows,{maxBatchSize:cap,recentQuota:999});
  assert.ok(selected.length>=1&&selected.length<=Math.max(1,Math.min(128,cap)));
  assert.equal(new Set(selected.map(x=>x.id)).size,selected.length);
}
const small=selectCausalReplayBatch(rows.slice(0,12),{maxBatchSize:32,recentQuota:8});
assert.equal(small.length,12,'small valid replay set is preserved');
assert.equal(selectCausalReplayBatch(rows.map(x=>({...x,policyFeatures01:[1,2]}))).length,0,'invalid feature vectors are excluded');
console.log('CAUSAL_REPLAY_SAMPLER=PASS',JSON.stringify({batch:batch.length,recent:batch.filter(x=>x.tick>=152).length,actions:new Set(batch.map(x=>x.action)).size,oldest:Math.min(...batch.map(x=>x.tick))}));
