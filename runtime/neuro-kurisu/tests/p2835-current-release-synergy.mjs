import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map((a,i)=>[a,.25+i*.05]));
const vec=(task,t)=>Array.from({length:64},(_,k)=>.3*Math.sin(k*.071+t*.018+task*.3)+.12*Math.cos(k*.041-t*.013-task*.2)+task*.04);
function run(full,regime){
  const b=new NeuralExperienceBranch(); b.setExperimentalLayerEnabled(full); b.setSelfKnowledgeCoresetEnabled(full); b.setTransferSafetySynergyEnabled(full);
  for(let t=0;t<60;t++){
    const task=regime==='ABA'?(t<20?0:t<40?3:0):(t<15?0:t<30?2:t<45?5:(t%2?2:0));
    const stress=task>=5||t%29===0;
    b.beforeDecision({tick:t,input:vec(task,t),baseUtilities:base,predictionError01:stress?.65:.2,novelty01:stress?.74:.22,uncertainty01:stress?.72:.25,homeostasis01:.45,identityGap01:.1,goalPressure01:.35,reward01:.5,embodied:{cpuLoad01:stress?.9:.3,ramPressure01:stress?.82:.25,battery01:stress?.18:.85,sensorFreshness01:.96}});
    const action=task===2||task===5?'verify':task===3?'explore':'respond';
    const reward=action==='respond'&&task===0?.88:action==='verify'&&task===2?.91:action==='verify'&&task===5?.82:action==='explore'&&task===3?.86:.58;
    b.afterOutcome({tick:t+1,action,reward01:reward,predictionError01:1-reward,verified01:reward>.8?1:.72,nextInput:vec(task,t+1),goalPressure01:.35,identityGap01:.1});
  }
  const d=b.diagnostics(),mass=d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0);
  return {d,mass};
}
let runs=0;
for(const regime of ['ABA','ABBA']){
 const full=run(true,regime),ctl=run(false,regime);runs+=2;
 const m=full.d.transferSafetySynergy;
 assert.ok(m.outcomes>=55);assert.ok(full.d.selfKnowledgeCoreset.teacherUpdates>=55);assert.ok(full.d.selfKnowledgeCoreset.coresetWrites>=55);
 assert.ok(Math.abs(full.mass-ctl.mass)>.0001);
 assert.ok(m.positiveTransfer01>=0&&m.positiveTransfer01<=1);assert.ok(m.negativeTransfer01>=0&&m.negativeTransfer01<=1);
 const resumed=new NeuralExperienceBranch();resumed.restore(full.d);assert.equal(resumed.diagnostics().selfKnowledgeCoreset.teacherUpdates,full.d.selfKnowledgeCoreset.teacherUpdates);
 console.log(`${regime} transfer=${m.positiveTransfer01.toFixed(4)} negative=${m.negativeTransfer01.toFixed(4)} safety=${m.orthogonalSafety01.toFixed(4)} teacher=${full.d.selfKnowledgeCoreset.teacherUpdates} coreset=${full.d.selfKnowledgeCoreset.coresetWrites} massDiff=${Math.abs(full.mass-ctl.mass).toFixed(4)}`);
}
console.log(`P2835_CURRENT_RELEASE_SYNERGY=PASS runs=${runs} regimes=2`);
