import assert from 'node:assert/strict';
import { MemoryRetentionEconomy } from '../src/organism/system/MemoryRetentionEconomy.ts';

const e=new MemoryRetentionEconomy();
let first;
for(let i=0;i<96;i++){
  first=e.assess({tick:i,id:`m:${i}`,salience01:i%2?.2:.8,identity01:.7,goal01:.65,social01:.2,predictionError01:.5,emotion01:.2,recency01:.6,novelty01:.4,redundancy01:.05,storageCost01:.1,pressure01:.1});
  e.observeOutcome({score01:first.score01,observedUtility01:i%2?.05:.95,features:first.utility,learningRate01:.06});
}
const d=e.learnedPolicyDiagnostics();
assert.ok(d.samples===96);
assert.ok(d.meanUtilityGap01>0);
const after=e.assess({tick:100,id:'probe',salience01:.8,identity01:.7,goal01:.65,social01:.2,predictionError01:.5,emotion01:.2,recency01:.6,novelty01:.4,redundancy01:.05,storageCost01:.1,pressure01:.1});
assert.ok(Number.isFinite(after.score01));
const restored=new MemoryRetentionEconomy(); restored.restore(e.snapshot());
assert.deepEqual(restored.learnedPolicyDiagnostics(),e.learnedPolicyDiagnostics());
console.log(JSON.stringify({ok:true,samples:d.samples,meanUtilityGap01:d.meanUtilityGap01,scoreAfter:after.score01,weights:d.weights}));
