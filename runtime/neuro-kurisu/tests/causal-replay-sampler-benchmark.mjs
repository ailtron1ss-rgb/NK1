import assert from 'node:assert/strict';
import { selectCausalReplayBatch } from '../src/organism/learning/CausalReplaySampler.ts';

// Selection-quality proxy only. It does not measure policy/task success.
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const rows=Array.from({length:240},(_,i)=>{
  const context=Math.floor(i/12)%12;
  const features=Array.from({length:18},(_,j)=>(((context*(j+5)+j*7)%31)/30));
  const surprise01=i>=192?((i*7)%11)/10:((i*3)%7)/10;
  return {id:`experience-${i}`,tick:i,taskId:`task-${Math.floor(i/6)}`,action:actions[(i+Math.floor(i/17))%actions.length],surprise01,causalStrength01:((i*5)%13)/12,learningQuality01:((i*11)%17)/16,replayPriority01:.24*surprise01+.2*(((i*5)%13)/12)+.56*(((i*11)%17)/16),policyFeatures01:features};
});
const signature=x=>`${x.action}|${x.policyFeatures01.slice(0,6).map(v=>Math.round(v*3)).join('.')}`;
const metrics=batch=>({size:batch.length,recent:batch.filter(x=>x.tick>=232).length,historical:batch.filter(x=>x.tick<192).length,oldest32:batch.filter(x=>x.tick<32).length,actionDiversity:new Set(batch.map(x=>x.action)).size,strata:new Set(batch.map(signature)).size,meanPriority:batch.reduce((s,x)=>s+x.replayPriority01,0)/batch.length,duplicates:batch.length-new Set(batch.map(x=>x.id)).size});
const recentOnly=rows.slice(-32);
const priorityOnly=rows.slice().sort((a,b)=>b.replayPriority01-a.replayPriority01||b.tick-a.tick).slice(0,32);
const stratified=selectCausalReplayBatch(rows,{maxBatchSize:32,recentQuota:8});
const result={recentOnly:metrics(recentOnly),priorityOnly:metrics(priorityOnly),stratified:metrics(stratified)};
assert.equal(result.stratified.size,32);
assert.equal(result.stratified.recent,8);
assert.equal(result.stratified.duplicates,0);
assert.ok(result.stratified.historical>0);
assert.ok(result.stratified.actionDiversity>=5);
assert.ok(result.stratified.strata>=12);
assert.equal(result.priorityOnly.size,32);
assert.ok(result.priorityOnly.meanPriority>=result.recentOnly.meanPriority);
console.log('CAUSAL_REPLAY_SAMPLER_BENCHMARK=PASS');
console.log(JSON.stringify(result,null,2));
