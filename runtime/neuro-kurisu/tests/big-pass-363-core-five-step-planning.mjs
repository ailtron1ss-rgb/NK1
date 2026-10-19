import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const cfg={checkpointMaxDirtyCycles:1,checkpointMinIntervalMs:0,performanceProfile:'mobile',cycleResultMode:'operational',predictivePlanningMode:'on',predictivePlanningHorizon:5,spineOnly:false,enableCompositionalExecution:false,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,
enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,enablePerception:false,enableLifelongLearning:false};
const emb={awake:true,bodyEnergy01:.9,cognitiveCapacity01:.91,thermalStrain01:.07,sensoryFreshness01:.89,battery01:.93,cpuLoad01:.13,ramPressure01:.11};
const rows=[];
for(let seed=0;seed<5;seed++){
  const store=new MemoryStateStore(); const c=new OrganismCore(store,cfg); await c.init();
  for(let i=0;i<8;i++){const q=.5+.33*Math.sin((seed+1)*.73+(i+1)*.41); await c.observe({epistemic:q,autonomy:.62+.06*q,maintenance:.1,social:.03,novelty:.6+.12*q,uncertainty:.27+.1*(1-q),embodiment:emb},'operational');}
  const d=c.b283CompetingHypothesisDiagnostics();
  assert.equal(d.plannedSequence.length,5,`seed ${seed+1}: Core must persist 5-step plan`);
  assert.equal(d.planningSteps,5,`seed ${seed+1}: Core must count five planning steps`);
  assert(d.plannedReturn01>=0&&d.plannedReturn01<=1);
  const snap=await store.load(); const restartStore=new MemoryStateStore({initial:snap}); const restart=new OrganismCore(restartStore,cfg); await restart.init(); const rd=restart.b283CompetingHypothesisDiagnostics();
  assert.deepEqual(rd.plannedSequence,d.plannedSequence); assert(Math.abs(rd.plannedReturn01-d.plannedReturn01)<1e-9);
  rows.push({seed:seed+1,sequence:d.plannedSequence,return01:d.plannedReturn01,selectedLast:(await restartStore.load())?.state?.lastAction??null});
}
console.log(JSON.stringify({pass:true,status:'CORE_FIVE_STEP_PLANNING_RESTART_PASS',seeds:rows.length,rows},null,2));
