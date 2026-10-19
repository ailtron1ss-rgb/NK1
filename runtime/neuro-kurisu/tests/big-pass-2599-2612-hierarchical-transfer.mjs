import assert from 'node:assert/strict';
import { TransferableEmbodiedSkillSystem } from '../src/organism/cognition/TransferableEmbodiedSkillSystem.ts';
import { HierarchicalProceduralSkillEngine } from '../src/organism/cognition/HierarchicalProceduralSkillEngine.ts';

const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const low=new TransferableEmbodiedSkillSystem();
for(let t=1;t<=2200;t++){
  const action=A[t%A.length];
  const phase=(t%73)/73;
  const context=Array.from({length:16},(_,i)=>((i*17+t*11)%127)/126*.8+.2*phase);
  const latent=context.slice(0,8);
  const drift=action==='explore'?.12:action==='verify'?.08:action==='reflect'?.05:.025;
  const next=latent.map((v,i)=>Math.max(0,Math.min(1,v+(i%3===0?drift:-drift*.3))));
  low.afterOutcome({tick:t,context,latent,nextLatent:next,action,reward01:action==='explore'?.88:action==='verify'?.83:.62,predictionError01:.12+.03*(t%19===0),verified01:t%4? .75:1});
}
const baseSkills=low.metrics().skills;
assert(baseSkills.length>=7);
const skills=[];
for(const s of baseSkills){
  for(let v=0;v<4;v++)skills.push({...structuredClone(s),id:`${s.id}-v${v}`,contextPrototype:s.contextPrototype.map((x,i)=>Math.max(-1,Math.min(1,x+(v-1.5)*.035*(i%3===0?1:-.4)))),deltaPrototype:s.deltaPrototype.map((x,i)=>Math.max(-1,Math.min(1,x+(v-1.5)*.018*(i%2===0?1:-.5)))),usage:s.usage+v});
}
const h=new HierarchicalProceduralSkillEngine();
for(let t=1;t<=1800;t++){
  const shift=(t%97)/97;
  const context=Array.from({length:16},(_,i)=>((i*19+t*7+13)%131)/130*.76+.24*shift);
  const pre=h.beforeDecision({tick:t,context,skills,actionUtilities:base,goalPressure01:.8,uncertainty01:t%41===0?.78:.28,predictionError01:t%53===0?.71:.14,computeBudget01:t%5===0?.86:.62});
  const action=pre.recoveryAction??pre.selectedAction??A[t%A.length];
  h.afterOutcome({tick:t,context,action,reward01:action==='explore'?.85:action==='verify'?.8:.66,predictionError01:t%53===0?.48:.16,verified01:t%4===0?1:.8,skills});
}
const d=h.metrics();
assert(d.metaSkills.length>=1,'meta-skill hierarchy remained dormant');
assert(d.metaSkillCreations>=1);
assert(d.childAssignments>=3);
assert(d.metaCoverage01>0.05);
assert(d.hierarchyDepth01>0.05);
assert(d.compressionRatio01>0,'hierarchical compression was not measured');
assert(d.searchCost01>0 && d.searchCost01<=1);
const snap=h.snapshot();const restored=new HierarchicalProceduralSkillEngine();restored.restore(snap);const rd=restored.metrics();
assert(rd.metaSkills.length===d.metaSkills.length);
assert(Math.abs(rd.transfer01-d.transfer01)<1e-12);
let holdoutSuccess=0;
for(let t=3001;t<=3160;t++){
  const context=Array.from({length:16},(_,i)=>((i*19+t*7+31)%137)/136*.72+.28*(t%13)/12);
  const action=A[(t*3)%A.length];
  const r=restored.evaluateCrossContext({context,action,reward01:action==='explore'?.82:.74,predictionError01:.24,verified01:.9});
  if(r.success)holdoutSuccess++;
}
assert(holdoutSuccess>20,`hierarchical cross-context holdout too weak: ${holdoutSuccess}`);
console.log('B2599_2612_HIERARCHICAL_TRANSFER_PASS',JSON.stringify({skills:skills.length,baseSkills:baseSkills.length,metaSkills:d.metaSkills.length,metaSkillCreations:d.metaSkillCreations,childAssignments:d.childAssignments,metaCoverage01:d.metaCoverage01,hierarchyDepth01:d.hierarchyDepth01,compressionRatio01:d.compressionRatio01,abstractionGain01:d.abstractionGain01,searchCost01:d.searchCost01,holdoutSuccess,holdoutRate01:holdoutSuccess/160,recoveryRoutes:d.recoveryRoutes,failedRoutes:d.failedRoutes},null,2));
