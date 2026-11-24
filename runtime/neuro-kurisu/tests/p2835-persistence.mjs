import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const clamp=(v)=>Math.max(0,Math.min(1,Number(v)));
const branch=new NeuralExperienceBranch({neurons:96, seed:2835});
for(let tick=1;tick<=48;tick++){
  const input=Array.from({length:64},(_,i)=>Math.sin((tick+i)*0.071));
  const action='respond';
  branch.microTick({
    tick,input,baseUtilities:{respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5},
    action:'respond',predictionError01:.31,uncertainty01:.22,novelty01:tick%11===0?.82:.18,
    resource01:.76,verified01:tick%7===0?1:.7,goalPressure01:.56,identityGap01:.24
  });
  branch.commitAction(action, {respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5});
  branch.afterOutcome({tick,action,reward01:tick%5===0?.71:.58,predictionError01:.23,verified01:.75,nextInput:input.map((v,i)=>v*.97+(i===tick%64?.08:0)),goalPressure01:.56,identityGap01:.24});
}
const beforeSnapshot=branch.snapshot();
const restored=new NeuralExperienceBranch({neurons:96, seed:999});
restored.restore(beforeSnapshot);
const afterSnapshot=restored.snapshot();
const after=restored.continuityMetrics();
const self=after.selfKnowledgeCoreset;
const transfer=after.transferSafetySynergy;
const ok=afterSnapshot.tick===beforeSnapshot.tick && self.teacherUpdates>=48 && self.coresetWrites>=48 && transfer.outcomes>=48;
if(!ok){
  console.error(JSON.stringify({beforeTick:before.tick,afterTick:after.tick,self,transfer},null,2));
  process.exit(1);
}
console.log(`P2835_PERSISTENCE=PASS tick=${afterSnapshot.tick} teacher=${self.teacherUpdates} coreset=${self.coresetWrites} transferOutcomes=${transfer.outcomes} restart=1`);
