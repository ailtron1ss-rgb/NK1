import assert from 'node:assert/strict';
import { MemoryRetentionEconomy } from '../src/organism/system/MemoryRetentionEconomy.ts';
import { BehavioralInfluenceLedger } from '../src/organism/system/BehavioralInfluenceLedger.ts';

const retention=new MemoryRetentionEconomy();
const valuable=retention.assess({tick:1,id:'m1',salience01:.9,identity01:.9,goal01:.8,social01:.5,predictionError01:.7,emotion01:.6,recency01:.9,novelty01:.8,redundancy01:.05,storageCost01:.1});
const weak=retention.assess({tick:2,id:'m2',salience01:.1,identity01:0,goal01:.05,social01:0,predictionError01:.02,emotion01:.02,recency01:.1,novelty01:.02,redundancy01:.9,storageCost01:.8});
assert.equal(valuable.action,'retain');assert.equal(weak.action,'discard-candidate');assert.ok(valuable.score01>weak.score01);
const rt=retention.snapshot(); const retention2=new MemoryRetentionEconomy(); retention2.restore(rt); assert.equal(retention2.snapshot().evaluations,2);
const ledger=new BehavioralInfluenceLedger(); ledger.anchor('e1',{tick:1,action:'explore',score01:.4});
const influence=ledger.observeFuture('e1',{tick:5,action:'verify',score01:.75}); assert.ok(influence); assert.ok(influence.influence01>.3); assert.equal(ledger.snapshot().observations,1);
const led2=new BehavioralInfluenceLedger(); led2.restore(ledger.snapshot()); assert.equal(led2.snapshot().recent.length,1);
console.log(JSON.stringify({pass:163,status:'PASS',retention:retention.snapshot(),influence:ledger.snapshot()},null,2));
