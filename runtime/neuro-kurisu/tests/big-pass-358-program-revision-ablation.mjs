import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const EMB={awake:true,bodyEnergy01:.84,cognitiveCapacity01:.82,thermalStrain01:.12,sensoryFreshness01:.82,battery01:.88,cpuLoad01:.18,ramPressure01:.16};
const base={performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:false,enableCompositionalExecution:true,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,
enablePerception:false,enableLifelongLearning:false};
const mk=async(snapshot)=>{const c=new OrganismCore(new MemoryStateStore(snapshot?{initial:snapshot}:undefined),base);await c.init();return c;};
const L=(seed)=>({goalVector:Array.from({length:8},(_,i)=>Math.sin((i+1)*(seed+1)*.31)),selfLatent:Array.from({length:8},(_,i)=>Math.cos((i+2)*(seed+1)*.23)),worldLatent:Array.from({length:8},(_,i)=>Math.sin((i+3)*(seed+2)*.17)),neuralAssembly:Array.from({length:12},(_,i)=>((i*(seed+2))%9)/8)});

const rows=[];
for(let seed=0;seed<5;seed++){
  const c=await mk(); const l=L(seed);
  const prop=c.b276LatentProgramPropose({tick:1800+seed,...l,personalityBias:{respond:.04,explore:.03,verify:.02,rest:0,reflect:.02,wait:-.01,defer:0},autonomy01:.64,noveltyNeed01:.69,promotedSkills:[{id:`a${seed}`,actions:['respond','explore'],reliability01:.94},{id:`b${seed}`,actions:['verify','reflect'],reliability01:.91},{id:`c${seed}`,actions:['rest','wait'],reliability01:.87}]});
  c.b276LatentProgramTrial({tick:1810+seed,programId:prop.programId,reward01:.94,independentGain01:.16,predictionError01:.14,robustness01:.88,personalityAlignment01:.86,selfAlignment01:.84});
  const before=c.b276LatentProgramDiagnostics(); const original=before.executionPlan.slice(); assert(original.length>=3);
  // The public API advances through observe(); this avoids inventing a separate executor.
  // Train the three actual steps at the completed execution boundary.
  c.b276LatentProgramExecutionOutcome({tick:1821+seed,programId:prop.programId,stepIndex:0,primitive:original[0],reward01:.15,success01:.2,predictionError01:.7,unseenContext01:0});
  c.b276LatentProgramExecutionOutcome({tick:1822+seed,programId:prop.programId,stepIndex:1,primitive:original[1],reward01:.97,success01:1,predictionError01:.05,unseenContext01:.4});
  c.b276LatentProgramExecutionOutcome({tick:1823+seed,programId:prop.programId,stepIndex:2,primitive:original[2],reward01:.62,success01:.8,predictionError01:.2,unseenContext01:.2});
  const trained=c.b276LatentProgramDiagnostics();
  assert(trained.activeProgramStructureRevisionCount>=1,`seed ${seed} structure revision must occur`);
  assert.notDeepEqual(trained.executionPlan,original,`seed ${seed} learned revision must change order`);
  const snap=c.snapshot();
  const restarted=await mk(snap); const rd=restarted.b276LatentProgramDiagnostics();
  assert.deepEqual(rd.executionPlan,trained.executionPlan,`seed ${seed} revised program must persist across restart`);
  assert.equal(rd.activeProgramStructureRevisionCount,trained.activeProgramStructureRevisionCount);

  // Matched program-ablation: same trained snapshot, but restore the original sequence and erase learned step credits.
  const ablationState=structuredClone(snap);
  const b=ablationState.system.latentActionProgramSynthesizerB276;
  const p=b.programs.find(x=>x.id===prop.programId); assert(p);
  b.executionPlan=original.slice(); b.executionCursor=0;
  p.stepCredits01=original.map(()=>.5); p.structureRevisionCount=0;
  b.programStructureRevisions=Math.max(0,(b.programStructureRevisions??1)-1);
  const sham=await mk(ablationState); const sh=sham.b276LatentProgramDiagnostics();
  assert.deepEqual(sh.executionPlan,original);
  assert.equal(sh.activeProgramStructureRevisionCount,0);
  const nextTrained=rd.executionPlan[0]; const nextSham=sh.executionPlan[0];
  assert.notEqual(nextTrained,nextSham,`seed ${seed} ablation must remove learned next-step preference`);
  rows.push({seed:seed+1,original,trained:trained.executionPlan,revisionCount:trained.activeProgramStructureRevisionCount,afterRestart:rd.executionPlan,ablation:sh.executionPlan});
}

console.log(JSON.stringify({pass:true,status:'PROGRAM_STRUCTURE_REVISION_RESTART_AND_ABLATION_PASS',seeds:rows.length,rows},null,2));
