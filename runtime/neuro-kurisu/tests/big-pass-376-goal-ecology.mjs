import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
import { P68GoalEcology } from '../src/organism/developmental/P68GoalEcology.ts';
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

// Persistent-goal governance is also a trust boundary: malformed live control data
// must not advance the lifecycle, and hostile restore must fail closed.
const p68=new P68GoalEcology();
const p68Goal={id:'goal-evidence',title:'Inspect evidence lineage',reason:'Resolve a repeated unknown',source:'learned',status:'active',importance:.8,urgency:.7,confidence:.8,progress:.4,createdAt:100,updatedAt:100};
const p68Result=p68.tick({tick:1,at:1000,goals:[p68Goal],lastAction:'explore',lastSuccess:.8,mode:'observe',homeostaticPressure01:.2,identity01:.8});
assert.equal(p68Result.activeCount,1);
assert.ok(p68Goal.progress>.4,'valid goal progress remains visible to the canonical caller');
const p68BeforeHostile=p68.snapshot();
let p68GetterReads=0;
const p68Hostile={tick:2,at:2000,goals:[],lastAction:'wait',lastSuccess:null,mode:'observe',homeostaticPressure01:.2,identity01:.8};
Object.defineProperty(p68Hostile,'tick',{enumerable:true,configurable:true,get(){p68GetterReads++;return 2;}});
assert.throws(()=>p68.tick(p68Hostile),/p68-goal-input-invalid/);
assert.equal(p68GetterReads,0);
assert.deepEqual(p68.snapshot(),p68BeforeHostile,'rejected P68 input must not advance lifecycle state');
const p68RestoreHostile={...p68.snapshot()};
let p68RestoreGetterReads=0;
Object.defineProperty(p68RestoreHostile,'cycles',{enumerable:true,configurable:true,get(){p68RestoreGetterReads++;return 999;}});
const p68RestoredHostile=new P68GoalEcology();p68RestoredHostile.restore(p68RestoreHostile);
assert.equal(p68RestoreGetterReads,0);
assert.equal(p68RestoredHostile.snapshot().cycles,0,'ambiguous P68 restore should fail closed');
const p68CorruptedRestore=new P68GoalEcology();
p68CorruptedRestore.restore({...p68.snapshot(),cycles:Number.POSITIVE_INFINITY,history:[{id:'bad',title:'Bad',status:'forged',vitality01:2,staleness01:0,conflict01:0,progress01:0}]});
assert.equal(p68CorruptedRestore.snapshot().cycles,0);
assert.equal(p68CorruptedRestore.snapshot().history.length,0);

console.log(JSON.stringify(run(),null,2));
