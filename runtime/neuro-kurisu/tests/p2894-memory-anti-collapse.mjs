import assert from 'node:assert/strict';
import { MemoryRetentionEconomy } from '../src/organism/system/MemoryRetentionEconomy.ts';

const e=new MemoryRetentionEconomy();
for(let i=0;i<512;i++){
  const high=i%3===0;
  const a=e.assess({tick:i,id:`m:${i}`,salience01:high?.96:.08,identity01:high?.08:.92,goal01:i%5===0?.88:.12,social01:.2,predictionError01:i%7===0?.82:.18,emotion01:.2,recency01:.65,novelty01:i%11===0?.9:.25,redundancy01:.08,storageCost01:.12,pressure01:.04});
  const target=i%4===0?.94:(i%4===1?.06:(i%4===2?.62:.38));
  e.observeOutcome({score01:a.score01,observedUtility01:target,features:a.utility,learningRate01:.045});
}
const d=e.learnedPolicyDiagnostics();
assert.equal(d.samples,512);
assert.ok(d.weightEntropy01>.88,`entropy=${d.weightEntropy01}`);
assert.ok(d.maxPositiveToMean01<2.1,`maxToMean=${d.maxPositiveToMean01}`);
assert.ok(Math.abs((Object.entries(d.weights).filter(([k])=>['salience','identity','goal','social','prediction','emotion','recency','novelty'].includes(k)).reduce((s,[,v])=>s+v,0))-1)<.02);
const r=new MemoryRetentionEconomy();r.restore(e.snapshot());
assert.deepEqual(r.learnedPolicyDiagnostics(),d);
console.log(JSON.stringify({pass:true,samples:d.samples,entropy01:d.weightEntropy01,maxPositiveToMean01:d.maxPositiveToMean01,weights:d.weights}));
