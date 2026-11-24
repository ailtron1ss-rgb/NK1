import assert from 'node:assert/strict';
import { MemoryBudgetCausalHarness } from '../src/organism/memory/MemoryBudgetCausalHarness.ts';

const items=[];
const queries=[];
for(let i=0;i<40;i++){
  const domain=i%4===0?'reactor':i%4===1?'identity':i%4===2?'workflow':'social';
  const id=`memory-${i}`;
  items.push({id,content:`canonical ${domain} trace ${i} continuity marker ${i%5} with distinctive token ${domain}-${i} ${'payload '.repeat(18)}`,kind:i%5===0?'identity':i%3===0?'procedural':'episodic',source:i%2?'device':'external',tags:[domain,'r24',`trace-${i}`],context:{domain,trace:String(i)},salience:i===3?.98:.18+(i%7)*.04,emotionalWeight:i===7?.78:.22,identityRelevance:i%5===0?.92:.12,goalRelevance:i%4===0?.88:.25,socialRelevance:domain==='social'?.72:.08,predictionError:i%6===0?.62:.18,confidence:.82,epistemicStatus:'fact',entities:[domain,`trace-${i}`],semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],provenanceClass:i%2?'device':'external',sourceAuthority01:i%2?.92:.84});
  if(i%2===0)queries.push({query:`distinctive token ${domain}-${i}`,expectedId:id});
}
const roughBytes=items.slice(0,4).reduce((s,x)=>s+new TextEncoder().encode(JSON.stringify(x)).byteLength,0);
const result=new MemoryBudgetCausalHarness().run({items,queries,budgetBytes:Math.max(16384,Math.floor(roughBytes*1.05))});
assert.equal(result.deterministic,true);
assert.ok(result.evictionCount>0,'treatment must evict under bounded budget');
assert.ok(result.controlHits>0,'retained control must resolve matched queries');
assert.ok(result.budgetHits<=result.controlHits,'treatment cannot outperform retained control on matched exact-id hits');
assert.ok(result.hitLoss01>=0&&result.hitLoss01<=1);
assert.ok(Number.isFinite(result.counterfactualRegret01));
console.log(JSON.stringify({pass:true,...result}));
