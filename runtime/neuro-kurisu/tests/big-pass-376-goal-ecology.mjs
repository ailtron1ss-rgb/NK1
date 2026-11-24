import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const vector=t=>Array.from({length:64},(_,i)=>Math.sin((i+t)*.13)*.42+Math.cos((i*0.17+t)*.07)*.21);
const ctx=()=>Object.fromEntries(actions.map((a,i)=>[a,{worldUtility01:.55+(a==='explore'?.12:0)+(a==='verify'?.05:0),worldConfidence01:.78,worldUncertainty01:.22,needRelief01:a==='verify'?.65:.40,predictedCost01:a==='explore'?.28:.24}]));
const goal={candidateId:'self-project-alpha',vector:[.86,.20,.62,-.12,.72,.30,.78,.44],source:'internal',novelty01:.70,confidence01:.83,internalPressure01:.82,homeostaticPressure01:.38,identityContinuity01:.91,autonomy01:.91};
const run=()=>{
  const core=new B365UnifiedNeuroCausalCore();
  const first=core.step({tick:1,vector:vector(1),novelty01:.70,uncertainty01:.60,predictionError01:.28,goalPressure01:.70,autonomy01:.91,goalAuthorship:goal,actionContext:ctx(),learningEnabled:false});
  assert.equal(first.selectedAction!=null,true);
  const initial=core.snapshot().goalEcology;
  assert(initial.activeId==='self-project-alpha','goal must enter ecology');
  const initialProgress=initial.currentProgress01;
  for(let t=2;t<=18;t++){
    const s=core.step({tick:t,vector:vector(t),novelty01:.58,uncertainty01:.32,predictionError01:.12,goalPressure01:.48,autonomy01:.88,actionContext:ctx(),learningEnabled:true});
    core.learnFromOutcome({tick:t,action:s.selectedAction,reward01:.94,predictionError01:.08,verified01:1,externalEvidence01:.92,actualUtility01:.90,actualWorldConfidence01:.86,novelty01:.48,actualStateDelta01:.56});
  }
  const after=core.goalEcologyDiagnostics();
  assert(after.selfContinuationCycles>0,'goal must continue without reseeding candidate every cycle');
  assert(after.completed>=1,'goal ecology must be capable of verified completion');
  assert(after.successorCreations>=1,'completed autonomous goal must create successor');
  assert(after.memories.some(m=>m.status==='completed'),'completed goal must remain in memory');
  assert(after.activeId && after.activeId!=='self-project-alpha','successor must become active after completion');
  const successorId=after.activeId;
  const continuationBefore=after.selfContinuationCycles;
  for(let t=19;t<=22;t++){
    const ss=core.step({tick:t,vector:vector(t),novelty01:.44,uncertainty01:.28,predictionError01:.10,goalPressure01:.40,autonomy01:.94,actionContext:ctx(),learningEnabled:true});
    core.learnFromOutcome({tick:t,action:ss.selectedAction,reward01:.72,predictionError01:.10,verified01:1,externalEvidence01:.90,actualUtility01:.70,actualWorldConfidence01:.84,novelty01:.34,actualStateDelta01:.40});
  }
  const afterSuccessor=core.goalEcologyDiagnostics();
  assert(afterSuccessor.selfContinuationCycles>continuationBefore,'successor must autonomously continue after promotion');
  assert.equal(core.snapshot().goalAuthorship.candidateId,successorId,'successor must become current goal without external reseeding');
  const resumed=core.snapshot();
  const restored=new B365UnifiedNeuroCausalCore(); restored.restore(resumed);
  assert.deepEqual(restored.snapshot().goalEcology,resumed.goalEcology,'goal ecology must persist across restart');

  const off=new B365UnifiedNeuroCausalCore(); off.setGoalEcologyEnabled(false);
  off.setGoalAuthorshipCandidate({tick:1,...goal});
  const b=off.step({tick:1,vector:vector(1),novelty01:.70,uncertainty01:.60,predictionError01:.28,goalPressure01:.70,autonomy01:.91,goalAuthorship:goal,actionContext:ctx(),learningEnabled:false});
  for(let t=2;t<=8;t++){
    const s=off.step({tick:t,vector:vector(t),novelty01:.58,uncertainty01:.32,predictionError01:.12,goalPressure01:.48,autonomy01:.88,actionContext:ctx(),learningEnabled:true});
    off.learnFromOutcome({tick:t,action:s.selectedAction,reward01:.94,predictionError01:.08,verified01:1,externalEvidence01:.92,actualUtility01:.90,actualWorldConfidence01:.86,novelty01:.48,actualStateDelta01:.56});
  }
  assert.equal(off.goalEcologyDiagnostics().completed,0,'ecology OFF must prevent lifecycle completion');
  assert.equal(off.goalEcologyDiagnostics().successorCreations,0,'ecology OFF must prevent successor generation');
  assert(initialProgress<=after.currentProgress01 || after.completed>=1);
  return {pass:true,cycles:22,initialProgress,final:{activeId:after.activeId,completed:after.completed,abandoned:after.abandoned,paused:after.paused,resumed:after.resumed,revisions:after.revisions,autonomousCycles:after.autonomousCycles,selfContinuationCycles:after.selfContinuationCycles,successorCreations:after.successorCreations,persistence01:after.persistence01,competitionEntropy01:after.competitionEntropy01,memory:after.memories.map(m=>({id:m.id,status:m.status,progress01:m.progress01,attempts:m.attempts,successes:m.successes,failures:m.failures}))},restartEqual:JSON.stringify(restored.snapshot().goalEcology)===JSON.stringify(resumed.goalEcology),off:{completed:off.goalEcologyDiagnostics().completed,successorCreations:off.goalEcologyDiagnostics().successorCreations}};
};
console.log(JSON.stringify(run(),null,2));
