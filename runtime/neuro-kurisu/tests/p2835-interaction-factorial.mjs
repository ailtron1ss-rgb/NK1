import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map((a,i)=>[a,.24+i*.045]));
const vec=(task,t)=>Array.from({length:64},(_,k)=>.28*Math.sin(k*.073+t*.031+task*.37)+.14*Math.cos(k*.037-t*.017-task*.19)+task*.035);
function run(variant,regime,seed){
  const b=new NeuralExperienceBranch({neurons:96,seed});
  b.setExperimentalLayerEnabled(false);
  b.setSelfKnowledgeCoresetEnabled(variant==='teacher'||variant==='full');
  b.setTransferSafetySynergyEnabled(variant==='transfer'||variant==='full');
  let rewardSum=0;
  for(let t=0;t<30;t++){
    const task=regime==='ABA'?(t<10?0:t<20?3:0):(t<8?0:t<16?2:t<24?5:(t%2?2:0));
    const stress=task>=5||t%13===0;
    b.beforeDecision({tick:t+1,input:vec(task,t),baseUtilities:base,predictionError01:stress?.62:.22,novelty01:stress?.76:.22,uncertainty01:stress?.70:.24,homeostasis01:.46,identityGap01:.11,goalPressure01:.36,reward01:.5,embodied:{cpuLoad01:stress?.82:.28,ramPressure01:stress?.74:.22,battery01:stress?.22:.84,sensorFreshness01:.95}});
    const action=task===2||task===5?'verify':task===3?'explore':'respond';
    const reward=action==='respond'&&task===0?.88:action==='verify'&&task===2?.91:action==='verify'&&task===5?.82:action==='explore'&&task===3?.86:.58;
    rewardSum+=reward;
    b.afterOutcome({tick:t+1,action,reward01:reward,predictionError01:1-reward,verified01:reward>.8?1:.72,nextInput:vec(task,t+1),goalPressure01:.36,identityGap01:.11});
  }
  const d=b.diagnostics();
  const rewardMean=rewardSum/30;
  const mass=d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0);
  return {rewardMean,mass,d};
}
let runs=0;
for(const regime of ['ABA','ABBA']){
  const results={};
  for(const variant of ['control','teacher','transfer','full']){
    let reward=0,mass=0,teacher=0,coreset=0,transfer=0;
    for(const seed of [2805,2817]){
      const r=run(variant,regime,seed); runs++;
      reward+=r.rewardMean; mass+=r.mass; teacher+=r.d.selfKnowledgeCoreset.teacherUpdates; coreset+=r.d.selfKnowledgeCoreset.coresetWrites; transfer+=r.d.transferSafetySynergy.outcomes;
    }
    results[variant]={reward:reward/2,mass:mass/2,teacher:teacher/2,coreset:coreset/2,transfer:transfer/2};
  }
  assert.equal(results.control.teacher,0);
  assert.equal(results.control.transfer,0);
  assert.ok(results.teacher.teacher>=29);
  assert.ok(results.transfer.transfer>=29);
  assert.ok(results.full.teacher>=29 && results.full.transfer>=29);
  assert.ok(Math.abs(results.full.mass-results.control.mass)>.0001);
  console.log(`${regime} controlReward=${results.control.reward.toFixed(4)} teacherReward=${results.teacher.reward.toFixed(4)} transferReward=${results.transfer.reward.toFixed(4)} fullReward=${results.full.reward.toFixed(4)} fullMassDiff=${Math.abs(results.full.mass-results.control.mass).toFixed(4)}`);
}
console.log(`P2835_INTERACTION_FACTORIAL=PASS runs=${runs} regimes=2 variants=4 seeds=2`);
