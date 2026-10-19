import assert from 'node:assert/strict';
import { AdaptiveMemoryPolicy } from '../src/organism/developmental/AdaptiveMemoryPolicy.ts';
import { CausalReplayCreditAssigner } from '../src/organism/system/CausalReplayCreditAssigner.ts';
import { MemoryPolicyOutcomeLedger } from '../src/organism/system/MemoryPolicyOutcomeLedger.ts';

const policy=new AdaptiveMemoryPolicy();
const ledger=new MemoryPolicyOutcomeLedger();
const credit=new CausalReplayCreditAssigner();

const chosen=policy.choose({pressure01:.25,goal01:.7,causal01:.9,temporal01:.2,mobile:true},1000);
ledger.register({policy:chosen,contextKey:policy.diagnostics().lastContextKey,query:'why did the causal memory matter',memoryIds:['m1'],at:1000,hit01:1,computeCost01:.18});

const replay=credit.assign({memoryId:'m1',replayEventId:'replay:m1:1000',validationId:'v1',replayAt:1000,validationAt:3*86400000,delayMs:3*86400000,retentionGain01:.62,transferPotential01:.81,interferenceRisk01:.10,learningOpportunity01:.76,priorityAfter01:.82,independentVerified:true});
const outcome=ledger.resolve({memoryId:'m1',validationAt:3*86400000,retentionScore01:.82,transferPotential01:.81,interferenceRisk01:.10,causalCredit01:replay.credit01,independentVerified:true});
assert.ok(outcome);
assert.equal(outcome.policy,chosen);
assert.ok(outcome.delayed01>0.4);
assert.ok(outcome.reward01>0.45);
policy.observeOutcome(chosen,outcome,3*86400000,outcome.contextKey);
const diag=policy.diagnostics();
assert.equal(diag.contextCount,1);
assert.equal(diag.trials[chosen],1);
assert.ok(diag.contextCount===1 && diag.lastContextKey===outcome.contextKey);

const restoredLedger=new MemoryPolicyOutcomeLedger();
restoredLedger.restore(ledger.snapshot());
assert.equal(restoredLedger.diagnostics().resolved,1);
const exact=restoredLedger.register({policy:chosen,contextKey:outcome.contextKey,query:'exact decision routing',memoryIds:['m2'],at:4*86400000,hit01:1,computeCost01:.1});
const exactOutcome=restoredLedger.resolve({decisionId:exact.id,memoryId:'not-the-target',validationAt:4*86400000+1,retentionScore01:.7,transferPotential01:.7,interferenceRisk01:.1,causalCredit01:.5,independentVerified:true});
assert.ok(exactOutcome && exactOutcome.decisionId===exact.id);
assert.equal(restoredLedger.diagnostics().pending,0);

console.log(JSON.stringify({
  ok:true,
  policy:chosen,
  context:outcome.contextKey,
  causalCredit01:Number(replay.credit01.toFixed(4)),
  delayed01:Number(outcome.delayed01.toFixed(4)),
  reward01:Number(outcome.reward01.toFixed(4)),
  resolved:ledger.diagnostics().resolved,
  pending:ledger.diagnostics().pending,
  contextCount:diag.contextCount
},null,2));
