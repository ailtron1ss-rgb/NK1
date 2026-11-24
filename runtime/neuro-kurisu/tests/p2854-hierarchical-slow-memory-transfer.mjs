import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const neutralUtilities=Object.fromEntries(actions.map(a=>[a,.5]));
const vec=(x,phase,warp=0)=>Array.from({length:64},(_,k)=>Math.tanh(x*(.46+((k%13)-6)*.018)+Math.sin(phase*(.09+.004*(k%7))+k*.11+warp)*.04));
const target=(mode,phase)=>{
  if(mode==='A')return .24+.56*(.5+.5*Math.tanh(Math.sin(phase*.19)+.32*Math.cos(phase*.051)));
  if(mode==='B')return .66+.20*Math.tanh(Math.cos(phase*.17)-.2*Math.sin(phase*.043));
  if(mode==='C')return .48+.25*Math.tanh(Math.sin(phase*.083)+.7*Math.cos(phase*.143));
  if(mode==='D')return .32+.44*(.5+.5*Math.tanh(Math.sin(phase*.27)+.65*Math.sin(phase*.049)));
  return .50+.24*Math.tanh(Math.sin(phase*.137)+Math.cos(phase*.061)+Math.sin(phase*.023));
};
const expectedAction={A:'respond',B:'explore',C:'verify',D:'reflect',E:'defer',H:'wait'};
const offset={A:0,B:17,C:31,D:47,E:83,H:121};
const task=(mode,tick)=>{
  const phase=tick+(offset[mode]??0);
  const x=mode==='A'?Math.sin(phase*.19):mode==='B'?Math.cos(phase*.17):mode==='C'?Math.sin(phase*.083)+Math.cos(phase*.143):mode==='D'?Math.sin(phase*.27)+Math.sin(phase*.049):Math.sin(phase*.137)+Math.cos(phase*.061)+Math.sin(phase*.023);
  return {phase,x,y:target(mode,phase)};
};

function train(branch,tick,mode,replay=true){
  const {phase,x,y}=task(mode,tick);
  const action=expectedAction[mode];
  const r=branch.beforeDecision({
    tick,input:vec(x,phase,mode.charCodeAt(0)),baseUtilities:neutralUtilities,
    predictionError01:.32,novelty01:mode==='D'||mode==='E'?.50:.34,uncertainty01:mode==='D'?.34:.25,
    homeostasis01:.20,identityGap01:.12,goalPressure01:.52,
    personalityVector:[.2,.3,.4],identityVector:[.3,.2,.1],
    embodied:{sensorFeatures:vec(x*.72,phase,1),sensors:{vision:{tick,values:[x,.1,-x],freshness01:1,confidence01:1,ageTicks:0,source:'vision'},audio:{tick,values:[x*.7,.05,-x*.3],freshness01:1,confidence01:1,ageTicks:0,source:'audio'}}}
  });
  branch.commitAction(action,r.actionBias);
  branch.afterOutcome({tick,action,reward01:y,predictionError01:Math.abs(y-r.prediction01),verified01:y>.60?1:.45,nextInput:vec(x*.8,phase+1,2),identityGap01:.10,goalPressure01:.50,holdout01:0});
  if(replay && tick%5===0) branch.replay(6);
}

function holdout(mode,start,n=18){
  return Array.from({length:n},(_,i)=>{const tick=start+i,{phase,x,y}=task(mode,tick);return {tick,input:vec(x+.11,phase+.37,5),actual01:y,baseUtilities:neutralUtilities,expectedAction:expectedAction[mode]};});
}
function trainSchedule(branch,replay=true){
  let tick=1;
  for(const mode of ['A','B','C','A','D','E','A']){
    for(let i=0;i<18;i++,tick++) train(branch,tick,mode,replay);
  }
  return tick;
}

const full=new NeuralExperienceBranch();
const noReplay=new NeuralExperienceBranch();
const noHierarchy=new NeuralExperienceBranch();
noHierarchy.setHierarchicalSlowMemoryEnabled(false);
let tick=trainSchedule(full,true);
trainSchedule(noReplay,false);
trainSchedule(noHierarchy,true);

const holdouts=['A','D','E','H'];
const result=(branch)=>Object.fromEntries(holdouts.map(mode=>[mode,branch.evaluateHoldout(holdout(mode,tick))]));
const fullResult=result(full),noReplayResult=result(noReplay),noHierarchyResult=result(noHierarchy);

const stableBefore=JSON.stringify(full.snapshot());
const repeated=full.evaluateHoldout(holdout('H',tick+50));
const stableAfter=JSON.stringify(full.snapshot());
assert.equal(stableBefore,stableAfter,'holdout probe mutated the trained branch');
assert(repeated.error01>=0 && repeated.error01<=1,'holdout returned invalid error');

const metrics=full.continuityMetrics();
const hierarchy=metrics.hierarchicalSlowMemory;
assert(hierarchy.updates>0,'hierarchical slow memory never updated');
assert(hierarchy.retrievals>0,'hierarchical slow memory never retrieved');
assert(hierarchy.schemaUpdates>0,'schema level never consolidated');
assert(hierarchy.consolidationCycles>0,'hierarchical consolidation never cycled');
assert(hierarchy.estimatedBytes<=40000,'hierarchical slow memory exceeded fixed mobile budget');
assert(metrics.offlineConsolidation.cycles>0,'offline consolidation never ran');
assert(metrics.replayLearning.weightUpdates>0,'replay did not update neural weights');

const forwardD=(noReplayResult.D.error01-fullResult.D.error01)/Math.max(.001,noReplayResult.D.error01);
const forwardE=(noReplayResult.E.error01-fullResult.E.error01)/Math.max(.001,noReplayResult.E.error01);
const returnA=(noReplayResult.A.error01-fullResult.A.error01)/Math.max(.001,noReplayResult.A.error01);
const actionTransferD=fullResult.D.actionSuccess01-noReplayResult.D.actionSuccess01;
const taskTransferD=fullResult.D.taskSuccess01-noReplayResult.D.taskSuccess01;
const taskHierarchyD=fullResult.D.taskSuccess01-noHierarchyResult.D.taskSuccess01;
const actionTransferE=fullResult.E.actionSuccess01-noReplayResult.E.actionSuccess01;
const hierarchyActionD=fullResult.D.actionSuccess01-noHierarchyResult.D.actionSuccess01;
const hierarchyErrorD=(noHierarchyResult.D.error01-fullResult.D.error01)/Math.max(.001,noHierarchyResult.D.error01);

assert(forwardD>-.20,'D transfer collapsed by more than 20%');
assert(forwardE>-.20,'E transfer collapsed by more than 20%');
assert(returnA>-.20,'long-horizon A retention collapsed by more than 20%');
assert(actionTransferD>-.35 && actionTransferE>-.35,'replay caused severe action-policy degradation');
assert(taskTransferD>-.35,'replay caused severe task-success degradation');
assert(taskHierarchyD>-.35,'hierarchical memory caused severe task-success degradation');
assert(hierarchyActionD>-.35,'hierarchical memory caused severe action-policy degradation');
assert(hierarchyErrorD>-.25,'hierarchical slow memory caused severe D regression');

console.log(JSON.stringify({
  ok:true,
  holdouts:fullResult,
  noReplay:noReplayResult,
  noHierarchy:noHierarchyResult,
  gains:{forwardD,forwardE,returnA,actionTransferD,actionTransferE,taskTransferD,taskHierarchyD,hierarchyActionD,hierarchyErrorD},
  hierarchy,
  memoryEstimateBytes:full.estimateNeuralMemoryBytes(),
  memoryEstimateKB:full.estimateNeuralMemoryBytes()/1024
},null,2));
