import assert from 'node:assert/strict';
import { MemoryRetentionEconomy } from '../src/organism/system/MemoryRetentionEconomy.ts';
const e=new MemoryRetentionEconomy();
const small=e.assess({tick:1,id:'small',salience01:.85,identity01:.8,goal01:.8,novelty01:.7,recency01:.9,redundancy01:.05,storageCost01:.1,estimatedBytes:256,memoryBytesUsed:500000,memoryByteBudget:524288,provenanceConfidence01:.9});
const huge=e.assess({tick:2,id:'huge',salience01:.85,identity01:.8,goal01:.8,novelty01:.7,recency01:.9,redundancy01:.05,storageCost01:.8,estimatedBytes:20000,memoryBytesUsed:520000,memoryByteBudget:524288,provenanceConfidence01:.9});
assert.ok(small.netValuePerByte01>huge.netValuePerByte01,'small useful memory must have greater net-value density');
assert.ok(e.learnedPolicyDiagnostics().byteBudget>0 && e.learnedPolicyDiagnostics().budgetConstrained>=1);
const plan=e.rankBudget([small,huge],2048); assert.ok(plan.selected.includes('small')); assert.ok(plan.deferred.includes('huge'));
console.log(JSON.stringify({pass:true,smallDensity:small.netValuePerByte01,hugeDensity:huge.netValuePerByte01,plan}));
