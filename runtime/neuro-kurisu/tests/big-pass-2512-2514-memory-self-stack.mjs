import assert from 'node:assert/strict';
import { B2512EpistemicSemanticAutobiographicalConsolidator } from '../src/organism/cognition/B2512EpistemicSemanticAutobiographicalConsolidator.ts';
import { B2513FutureSelfProjectionField } from '../src/organism/cognition/B2513FutureSelfProjectionField.ts';
import { B2514MemoryNeedPrioritizer } from '../src/organism/cognition/B2514MemoryNeedPrioritizer.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const vec=(v,n=24)=>Array.from({length:n},(_,i)=>(v + Math.sin(i*0.37)*.04));

const b2512=new B2512EpistemicSemanticAutobiographicalConsolidator();
for(let t=0;t<420;t++){
  const target=t%4===0?'verify':'respond';
  const verified=t%5===0?1:0;
  const reward=target==='verify' ? (t%7===0?.96:.88) : (t%2?.24:.32);
  b2512.beforeDecision({tick:t,uncertainty01:.62,novelty01:t%31===0?1:.24,predictionError01:.48,goalPressure01:.72});
  b2512.afterOutcome({tick:t,action:target,reward01:reward,predictionError01:Math.abs(reward-.55),verified01:verified,autonomous01:t%3===0?1:.3,informationGain01:verified?.72:.05,novelty01:t%31===0?1:.24,uncertainty01:.62,selfLatent:vec(.2),worldLatent:vec(.45),goalLatent:vec(.65),memoryLatent:vec(.15),traitVector:[.8,.7,.6,.5] ,identityRevision:7,source:verified?'external':'runtime'});
}
b2512.consolidate(500,8);
const d12=b2512.diagnostics();
assert.ok(d12.episodes>=190);
assert.ok(d12.rawRetentionCount>=190);
assert.ok(d12.factCount>=2);
assert.ok(d12.memoryIntegrity01>.75,`memory integrity too low ${d12.memoryIntegrity01}`);
assert.ok(d12.semanticConfidence01>.20);
assert.equal(d12.identityRevisionAtStart,7);
assert.equal(d12.identityRevisionObserved,7);
assert.ok(d12.identityFirewall01>.99);
const lesion12=b2512.lesion(.5); assert.ok(lesion12.effect01>.003);

const b2513=new B2513FutureSelfProjectionField();
const identity=vec(.62), semantic=vec(.48), self=vec(.54), world=vec(.50), goal=vec(.70);
let last=null;
for(let t=0;t<80;t++) last=b2513.beforeDecision({tick:t,identityLatent:identity,semanticLatent:semantic,selfLatent:self,worldLatent:world,goalVector:goal,actionValues:Object.fromEntries(actions.map(a=>[a,a==='verify'?.65:.52])),uncertainty01:.34+.2*(t%5)/4,predictionError01:.28,autonomy01:.72,horizon:3});
assert.ok(last?.futureCoherence01>.55);
assert.ok(last?.identityContinuity01>.50);
assert.ok(last?.goalConsistency01>.50);
b2513.afterOutcome({tick:81,action:last.selectedAction,reward01:.91,verified01:1,identityContinuity01:last.identityContinuity01,goalConsistency01:last.goalConsistency01,predictionError01:last.predictionError01});
const d13=b2513.diagnostics();
assert.ok(d13.rollouts>=80*actions.length*3);
assert.ok(d13.learningUpdates>=1);
const lesion13=b2513.lesion(.5); assert.ok(lesion13.effect01>.005);

const b2514=new B2514MemoryNeedPrioritizer();
for(let t=0;t<100;t++){
  b2514.observe({tick:t,key:t%3===0?'surprise-event':`routine-${t%8}`,salience01:t%3===0?.95:.22,surprise01:t%3===0?.98:.05,novelty01:t%3===0?.9:.15,goalRelevance01:t%3===0?.9:.22,identityRelevance01:t%3===0?.85:.25,predictionError01:t%3===0?.9:.08,verified01:t%3===0?1:0});
}
const ranked=b2514.rank(4);
assert.ok(ranked.length===4);
assert.equal(ranked[0].key,'surprise-event');
const d14=b2514.diagnostics();
assert.ok(d14.itemCount>=8);
assert.ok(d14.meanNeed01>.15);
b2514.markAccess(ranked.map(x=>x.key),'replay');
assert.ok(b2514.diagnostics().replaySelections>=4);

console.log(JSON.stringify({pass:true,status:'B2512_B2514_MEMORY_SELF_STACK_PASS',b2512:d12,lesion12,b2513:d13,lesion13,b2514:b2514.diagnostics(),topMemory:ranked[0]},null,2));
