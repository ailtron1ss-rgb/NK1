import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const EMB={awake:true,bodyEnergy01:.84,cognitiveCapacity01:.82,thermalStrain01:.12,sensoryFreshness01:.82,battery01:.88,cpuLoad01:.18,ramPressure01:.16};
const base={performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:false,enableCompositionalExecution:true,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,
enablePerception:false,enableLifelongLearning:false};
const mk=async(snapshot)=>{const c=new OrganismCore(new MemoryStateStore(snapshot?{initial:snapshot}:undefined),base);await c.init();return c;};
const latent=(seed)=>({goalVector:Array.from({length:8},(_,i)=>Math.sin((i+1)*(seed+1)*.31)),selfLatent:Array.from({length:8},(_,i)=>Math.cos((i+2)*(seed+1)*.23)),worldLatent:Array.from({length:8},(_,i)=>Math.sin((i+3)*(seed+2)*.17)),neuralAssembly:Array.from({length:12},(_,i)=>((i*(seed+2))%9)/8)});
const rewards=[.20,.98,.64];
const rows=[];
for(let seed=0;seed<5;seed++){
  const c=await mk(); const l=latent(seed);
  const prop=c.b276LatentProgramPropose({tick:3000+seed,...l,personalityBias:{respond:.04,explore:.03,verify:.02,rest:0,reflect:.02,wait:-.01,defer:0},autonomy01:.64,noveltyNeed01:.69,promotedSkills:[{id:`a${seed}`,actions:['respond','explore'],reliability01:.94},{id:`b${seed}`,actions:['verify','reflect'],reliability01:.91},{id:`c${seed}`,actions:['rest','wait'],reliability01:.87}]});
  c.b276LatentProgramTrial({tick:3010+seed,programId:prop.programId,reward01:.94,independentGain01:.16,predictionError01:.14,robustness01:.88,personalityAlignment01:.86,selfAlignment01:.84});
  const original=c.b276LatentProgramDiagnostics().executionPlan.slice();
  for(let ep=0;ep<2;ep++){
    const plan=c.b276LatentProgramDiagnostics().executionPlan.slice();
    const target=ep===0?plan[1]:plan[plan.length-1];
    const stepRewards=plan.map((a,i)=>a===target?.97:(i===0?.61:.32));
    for(let step=0;step<3;step++) c.b276LatentProgramExecutionOutcome({tick:3020+seed*100+ep*10+step,programId:prop.programId,stepIndex:step,primitive:plan[step],reward01:stepRewards[step],success01:stepRewards[step],predictionError01:1-stepRewards[step],unseenContext01:ep===0?.25:.82});
  }
  const trained=c.b276LatentProgramDiagnostics();
  assert.equal(trained.activeProgramStructureRevisionCount,2);
  const trainedPlan=trained.executionPlan.slice();
  const snap=c.snapshot();
  const tr=await mk(snap);
  const trd=tr.b276LatentProgramDiagnostics();
  assert.deepEqual(trd.executionPlan,trainedPlan);
  const trainedSelections=[];
  for(let step=0;step<3;step++){
    const d=tr.b276LatentProgramDiagnostics();
    const current=d.executionPlan[d.executionCursor];
    assert(current);
    trainedSelections.push(current);
    tr.b276LatentProgramExecutionOutcome({tick:3050+seed*10+step,programId:prop.programId,stepIndex:d.executionCursor,primitive:current,reward01:.88,success01:.9,predictionError01:.12,unseenContext01:.90});
  }

  // Trajectory-level ablation after the second learned revision.
  const ab=structuredClone(snap);
  const b=ab.system.latentActionProgramSynthesizerB276;
  const p=b.programs.find(x=>x.id===prop.programId); assert(p);
  b.executionPlan=original.slice(); b.executionCursor=0; b.programStructureRevisions=0;
  p.stepCredits01=original.map(()=>.5); p.structureRevisionCount=0;
  const sham=await mk(ab);
  const sd=sham.b276LatentProgramDiagnostics();
  assert.deepEqual(sd.executionPlan,original);
  assert.equal(sd.activeProgramStructureRevisionCount,0);
  const shamSelections=[];
  for(let step=0;step<3;step++){
    const d=sham.b276LatentProgramDiagnostics();
    const current=d.executionPlan[d.executionCursor];
    assert(current);
    shamSelections.push(current);
    sham.b276LatentProgramExecutionOutcome({tick:3060+seed*10+step,programId:prop.programId,stepIndex:d.executionCursor,primitive:current,reward01:.88,success01:.9,predictionError01:.12,unseenContext01:.90});
  }
  const divergence=trainedSelections.reduce((n,a,i)=>n+(a!==shamSelections[i]?1:0),0);
  assert.equal(divergence,3,`seed ${seed} ablation must diverge at all 3 trajectory positions`);
  rows.push({seed:seed+1,original,trainedPlan,trainedSelections,ablationPlan:original,shamSelections,divergence});
}
console.log(JSON.stringify({pass:true,status:'SECOND_REVISION_TRAJECTORY_ABLATION_CAUSAL_PASS',seeds:rows.length,rows},null,2));
