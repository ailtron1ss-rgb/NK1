import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map((a,i)=>[a,.30+i*.047]));
const taskVector=(task,t)=>Array.from({length:64},(_,k)=>{
  const base=[
    Math.sin((k+1)*.061+t*.017)*.45,
    Math.cos((k+4)*.073+t*.013)*.42,
    Math.sin((k+7)*.051+t*.021)*.40,
    Math.cos((k+2)*.089+t*.009)*.38
  ][task%4];
  return base + Math.sin(task*1.7+k*.037)*.055;
});
const identity=(task,t)=>Array.from({length:16},(_,k)=>Math.sin(k*.11+t*.01)+task*.19);
const score=(bias,action)=>bias[action]-Math.max(...actions.filter(a=>a!==action).map(a=>bias[a]));

function run(experimental=true){
  const b=new NeuralExperienceBranch();
  b.setExperimentalLayerEnabled(experimental);
  let decisionMargin=0;
  let lowResourceTicks=0;
  for(let t=0;t<180;t++){
    const task=t<36?0:t<72?1:t<108?2:t<144?3:((t/12)|0)%4;
    const low=(t%17===0)||(t%31===0);
    if(low)lowResourceTicks++;
    const r=b.beforeDecision({
      tick:t,input:taskVector(task,t),baseUtilities:utilities,
      predictionError01:task===0?.14:task===1?.28:task===2?.34:.22,
      novelty01:task===0?.18:task===3?.62:.46,
      uncertainty01:task===2?.48:low?.58:.27,
      homeostasis01:.45,
      identityGap01:.16+task*.03,
      goalPressure01:.33+task*.04,
      reward01:.55,
      identityVector:identity(task,t),
      embodied:{cpuLoad01:low?.92:.36,ramPressure01:low?.88:.30,battery01:low?.18:.82,sensorFreshness01:low?.70:.96}
    });
    decisionMargin += score(r.actionBias,task===0||task===3?'respond':'explore');
    const action=task===0||task===3?'respond':task===2?'verify':'explore';
    const reward=(action==='verify'&&task===2)?.84:(action==='respond'&&task===0)?.88:(action==='explore'&&task===1)?.81:.69;
    b.afterOutcome({
      tick:t+1,action,reward01:reward,predictionError01:1-reward,verified01:reward>.78?1:.88,
      nextInput:taskVector(task,t+1),holdout01:t%5===0?1:0,goalPressure01:.33+task*.04,identityGap01:.16+task*.03,
      identityVector:identity(task,t+1)
    });
  }
  for(let t=180;t<212;t++){
    b.microTick({tick:t,input:taskVector(t%4,t),action:t%2?'explore':'respond',reward01:.72,predictionError01:.24,verified01:.9,novelty01:.30,uncertainty01:.34,goalPressure01:.42,identityGap01:.18,worldConfidence01:.66,selfContinuity01:.82});
  }
  const d=b.diagnostics();
  return {b,d,decisionMargin,lowResourceTicks};
}

const exp=run(true),ctl=run(false);
const a=exp.d.autonomousContinual,c=ctl.d.autonomousContinual;

assert.equal(exp.d.version,25);
assert.ok(a.outcomes>=188);
assert.ok(a.taskSwitches>=2,'task-boundary detector did not detect context changes');
assert.ok(a.contextNovelty01>=0 && a.contextNovelty01<=1);
assert.ok(a.boundary01>=0 && a.boundary01<=1);
assert.ok(a.planning.rollouts>0 && a.planning.depth>=1);
assert.ok(a.replay.length>0 && a.replaySeen>=180,'selective replay buffer did not collect experiences');
assert.ok(a.replayUsed>0,'replay was never consumed');
assert.ok(a.replayDiversity01>=0 && a.replayDiversity01<=1);
assert.ok(a.counterfactualConfidence01>0,'counterfactual model remained inert');
assert.ok(a.mobilePressure01>0,'mobile resource controller never observed pressure');
assert.ok(Math.abs(exp.d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0)-ctl.d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0))>.01,'experimental fabric did not alter neural trajectory');
assert.ok(a.contextCounts.filter(x=>x>0).length>=2,'only one context prototype became active');
assert.ok(a.rewireEvents>=0 && a.wakeEvents>=0 && a.pruneEvents>=0);

const snap=exp.b.diagnostics();
const resumed=new NeuralExperienceBranch();
resumed.restore(snap);
const rd=resumed.diagnostics();
assert.equal(rd.version,25);
assert.equal(rd.autonomousContinual.outcomes,a.outcomes);
assert.equal(rd.autonomousContinual.replaySeen,a.replaySeen);
assert.equal(rd.autonomousContinual.replay.length,a.replay.length);

console.log(
  `P2724_AUTONOMOUS_CONTINUAL=PASS outcomes=${a.outcomes} contexts=${a.contextCounts.filter(x=>x>0).length} ` +
  `switches=${a.taskSwitches} novelty=${a.contextNovelty01.toFixed(4)} boundary=${a.boundary01.toFixed(4)} ` +
  `planDepth=${a.planning.depth} rollouts=${a.planning.rollouts} replay=${a.replay.length}/${a.replaySeen} replayUsed=${a.replayUsed} ` +
  `replayDiv=${a.replayDiversity01.toFixed(4)} cfConf=${a.counterfactualConfidence01.toFixed(4)} ` +
  `structuralGain=${a.structuralGain01.toFixed(4)} wake=${a.wakeEvents} prune=${a.pruneEvents} rewire=${a.rewireEvents} ` +
  `mobilePressure=${a.mobilePressure01.toFixed(4)} decisionMargin=${exp.decisionMargin.toFixed(4)} controlMargin=${ctl.decisionMargin.toFixed(4)} ` +
  `trajectoryDiff=${Math.abs(exp.d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0)-ctl.d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0)).toFixed(4)} ` +
  `lowResourceTicks=${exp.lowResourceTicks} restartOutcomes=${rd.autonomousContinual.outcomes}`
);
