import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map((a,i)=>[a,.24+i*.058]));
const vec=(task,t,seed)=>Array.from({length:64},(_,k)=>{
  const phase=[.1,.9,1.9,3.1,4.3,5.2,6.1][task%7]+seed*.17;
  return .31*Math.sin((k+1)*.071+t*.017+phase)+.16*Math.cos((k+5)*.037-t*.011-phase)+.05*task+.018*Math.sin(t*.053+seed);
});
function run(mode,regime,seed){
  const b=new NeuralExperienceBranch();
  b.setExperimentalLayerEnabled(mode==='full');
  b.setSelfKnowledgeCoresetEnabled(mode==='full');
  b.setTransferSafetySynergyEnabled(mode==='full');
  const total=90;
  for(let t=0;t<total;t++){
    let task;
    if(regime==='ABA') task=t<30?0:t<60?3:0;
    else task=t<23?0:t<46?2:t<68?5:((t+seed)%2?2:0);
    const shift=(t%41===0)||task>=5;
    const err=shift?.64:(task===2?.42:.15+.025*(task%4));
    const novelty=shift?.76:(task===3?.58:.17+.065*(task%5));
    const uncertainty=shift?.70:(task===2?.50:.22+.05*(task%3));
    b.beforeDecision({tick:t,input:vec(task,t,seed),baseUtilities:base,predictionError01:err,novelty01:novelty,uncertainty01:uncertainty,homeostasis01:.45,identityGap01:.1+task*.02,goalPressure01:.3+task*.04,reward01:.5+seed*.01,identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.089+t*.009)+task*.09),embodied:{cpuLoad01:shift?.90:.28,ramPressure01:shift?.82:.24,battery01:shift?.18:.85,sensorFreshness01:.96}});
    const action=task===2?'verify':task===3?'explore':task===5?'verify':'respond';
    const reward=task===0&&action==='respond'?.88:task===2&&action==='verify'?.91:task===3&&action==='explore'?.86:task===5&&action==='verify'?.82:.57;
    b.afterOutcome({tick:t+1,action,reward01:reward,predictionError01:1-reward,verified01:reward>.8?1:.72,nextInput:vec(task,t+1,seed),holdout01:t%17===0?1:0,goalPressure01:.3+task*.04,identityGap01:.1+task*.02});
  }
  const d=b.diagnostics();
  const mass=d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0);
  return {d,mass};
}

let runs=0;
for(const regime of ['ABA','ABBA']){
  for(const seed of [0,1]){
    const full=run('full',regime,seed), ctl=run('control',regime,seed); runs+=2;
    const m=full.d.transferSafetySynergy;
    assert.ok(m.outcomes>=80,`outcomes missing ${regime}/${seed}`);
    assert.ok(m.decisions>=80,`decisions missing ${regime}/${seed}`);
    assert.ok(m.contextCompatibility01>=0&&m.contextCompatibility01<=1);
    assert.ok(m.positiveTransfer01>=0&&m.positiveTransfer01<=1);
    assert.ok(m.negativeTransfer01>=0&&m.negativeTransfer01<=1);
    assert.ok(m.protectedUpdateEvents+m.plasticUpdateEvents>0,`gate inactive ${regime}/${seed}`);
    assert.ok(full.d.selfKnowledgeCoreset.teacherUpdates>=80,`teacher inactive ${regime}/${seed}`);
    assert.ok(full.d.selfKnowledgeCoreset.coresetWrites>=80,`coreset inactive ${regime}/${seed}`);
    assert.ok(Math.abs(full.mass-ctl.mass)>.0005,`no trajectory split ${regime}/${seed}`);
    const snap=full.d,resumed=new NeuralExperienceBranch();resumed.restore(snap);const rd=resumed.diagnostics();
    assert.equal(rd.transferSafetySynergy.outcomes,m.outcomes);
    assert.equal(rd.selfKnowledgeCoreset.teacherUpdates,full.d.selfKnowledgeCoreset.teacherUpdates);
  }
}
console.log(`P2835_TRANSFER_SAFETY_SYNERGY=PASS runs=${runs} regimes=2 seeds=2`);
for(const regime of ['ABA','ABBA']){
  const full=run('full',regime,0),ctl=run('control',regime,0),m=full.d.transferSafetySynergy;
  console.log(`${regime} reward=${full.d.lastExperience?.actual01?.toFixed(4)??'na'} transfer=${m.positiveTransfer01.toFixed(4)} neg=${m.negativeTransfer01.toFixed(4)} safety=${m.orthogonalSafety01.toFixed(4)} `+
    `replayUtility=${m.replayUtility01.toFixed(4)} protected=${m.protectedUpdateEvents} plastic=${m.plasticUpdateEvents} `+
    `teacher=${full.d.selfKnowledgeCoreset.teacherUpdates} coreset=${full.d.selfKnowledgeCoreset.coresetWrites} massDiff=${Math.abs(full.mass-ctl.mass).toFixed(4)}`);
}
