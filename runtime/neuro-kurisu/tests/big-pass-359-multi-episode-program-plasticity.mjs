import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const EMB={awake:true,bodyEnergy01:.84,cognitiveCapacity01:.82,thermalStrain01:.12,sensoryFreshness01:.82,battery01:.88,cpuLoad01:.18,ramPressure01:.16};
const base={performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:false,enableCompositionalExecution:true,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,
enablePerception:false,enableLifelongLearning:false};
const mk=async(snapshot)=>{const c=new OrganismCore(new MemoryStateStore(snapshot?{initial:snapshot}:undefined),base);await c.init();return c;};
const latent=(seed,shift=0)=>({goalVector:Array.from({length:8},(_,i)=>Math.sin((i+1)*(seed+1)*.31+shift)),selfLatent:Array.from({length:8},(_,i)=>Math.cos((i+2)*(seed+1)*.23+shift)),worldLatent:Array.from({length:8},(_,i)=>Math.sin((i+3)*(seed+2)*.17+shift)),neuralAssembly:Array.from({length:12},(_,i)=>((i*(seed+2)+shift*3)%9)/8)});
const obs=(seed,phase)=>({epistemic:phase===0?.62:.24,autonomy:phase===0?.52:.76,maintenance:.10,social:.05,novelty:.58+.04*seed,uncertainty:phase===0?.48:.32,embodiment:EMB});

const rows=[];
for(let seed=0;seed<5;seed++){
  const c=await mk();
  const L=latent(seed);
  const prop=c.b276LatentProgramPropose({tick:2100+seed,...L,personalityBias:{respond:.04,explore:.03,verify:.02,rest:0,reflect:.02,wait:-.01,defer:0},autonomy01:.64,noveltyNeed01:.69,promotedSkills:[{id:`a${seed}`,actions:['respond','explore'],reliability01:.94},{id:`b${seed}`,actions:['verify','reflect'],reliability01:.91},{id:`c${seed}`,actions:['rest','wait'],reliability01:.87}]});
  c.b276LatentProgramTrial({tick:2110+seed,programId:prop.programId,reward01:.94,independentGain01:.16,predictionError01:.14,robustness01:.88,personalityAlignment01:.86,selfAlignment01:.84});
  const original=c.b276LatentProgramDiagnostics().executionPlan;
  assert(original.length>=3&&original.length<=8);

  // Episode 1: make the second primitive clearly most useful.
  const scores1=[.20,.98,.64];
  for(let step=0;step<3;step++) c.b276LatentProgramExecutionOutcome({tick:2120+seed*10+step,programId:prop.programId,stepIndex:step,primitive:original[step],reward01:scores1[step],success01:scores1[step],predictionError01:1-scores1[step],unseenContext01:.25});
  const ep1=c.b276LatentProgramDiagnostics();
  assert.equal(ep1.activeProgramStructureRevisionCount,1);
  assert.notDeepEqual(ep1.executionPlan,original);
  const revised1=ep1.executionPlan.slice();

  // The revised plan must retain step-credit attribution by primitive, not by stale index.
  const snap1=c.snapshot();
  const r1=await mk(snap1); const r1d=r1.b276LatentProgramDiagnostics();
  assert.deepEqual(r1d.executionPlan,revised1);
  assert.deepEqual(r1d.activeProgramStepCredits01,ep1.activeProgramStepCredits01);

  // Episode 2: reward the primitive that was weakest in episode 1 and force another revision.
  const target=revised1[revised1.length-1];
  const stepRewards=revised1.map((a)=>a===target?.96:(a===revised1[0] ? .61 : .32));
  for(let step=0;step<3;step++) r1.b276LatentProgramExecutionOutcome({tick:2140+seed*10+step,programId:prop.programId,stepIndex:step,primitive:revised1[step],reward01:stepRewards[step],success01:stepRewards[step],predictionError01:1-stepRewards[step],unseenContext01:.82});
  const ep2=r1.b276LatentProgramDiagnostics();
  assert.equal(ep2.activeProgramStructureRevisionCount,2,`seed ${seed} must perform second revision`);
  assert.notDeepEqual(ep2.executionPlan,revised1,`seed ${seed} second episode must change order again`);
  const revised2=ep2.executionPlan.slice();

  // Restart must preserve both learned revisions and their step-credit alignment.
  const r2=await mk(r1.snapshot()); const r2d=r2.b276LatentProgramDiagnostics();
  assert.deepEqual(r2d.executionPlan,revised2);
  assert.equal(r2d.activeProgramStructureRevisionCount,2);
  assert.deepEqual(r2d.activeProgramStepCredits01,ep2.activeProgramStepCredits01);

  // Unseen-context transfer must benefit from the learned program, while a matched sham does not.
  const transfer=r2.b276LatentProgramTransfer({tick:2160+seed,programId:prop.programId,newGoalVector:L.goalVector.map((v,i)=>v*.13+(i===0?.8:0)),selfLatent:L.selfLatent.map(v=>-v),worldLatent:L.worldLatent.map(v=>-v),neuralAssembly:L.neuralAssembly.map((v,i)=>i%2?.12:.88),independentGain01:.18,robustness01:.88});
  assert.equal(transfer.success,true);

  const shamState=structuredClone(r1.snapshot());
  const b=shamState.system.latentActionProgramSynthesizerB276;
  const p=b.programs.find(x=>x.id===prop.programId); assert(p);
  b.executionPlan=original.slice(); b.executionCursor=0; b.programStructureRevisions=0;
  p.stepCredits01=original.map(()=>.5); p.structureRevisionCount=0;
  const sham=await mk(shamState); const sd=sham.b276LatentProgramDiagnostics();
  assert.deepEqual(sd.executionPlan,original);
  assert.equal(sd.activeProgramStructureRevisionCount,0);
  const shamTransfer=sham.b276LatentProgramTransfer({tick:2170+seed,programId:prop.programId,newGoalVector:L.goalVector.map(v=>v*.13),selfLatent:L.selfLatent.map(v=>-v),worldLatent:L.worldLatent.map(v=>-v),neuralAssembly:L.neuralAssembly.map(()=>.2),independentGain01:.04,robustness01:.62});
  assert(transfer.gain01>shamTransfer.gain01,`seed ${seed} trained transfer must exceed sham`);
  rows.push({seed:seed+1,original,revised1,revised2,revisions:r2d.activeProgramStructureRevisionCount,transferGain01:transfer.gain01,shamTransferGain01:shamTransfer.gain01});
}
console.log(JSON.stringify({pass:true,status:'MULTI_EPISODE_PROGRAM_PLASTICITY_UNSEEN_TRANSFER_RESTART_ABLATION_PASS',seeds:rows.length,rows},null,2));
