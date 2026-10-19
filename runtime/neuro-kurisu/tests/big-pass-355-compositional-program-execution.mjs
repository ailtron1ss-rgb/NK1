import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const EMB={awake:true,bodyEnergy01:.82,cognitiveCapacity01:.78,thermalStrain01:.16,sensoryFreshness01:.74,battery01:.84,cpuLoad01:.22,ramPressure01:.20};
const base={performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:false,enableCompositionalExecution:true,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,
enablePerception:false,enableLifelongLearning:false};
const obs={epistemic:.30,autonomy:.55,maintenance:.08,social:.07,novelty:.76,uncertainty:.42,embodiment:EMB};
async function make(snapshot,cfg=base){const c=new OrganismCore(new MemoryStateStore(snapshot?{initial:snapshot}:undefined),cfg);await c.init();return c;}
const seed=await make();await seed.observe(obs,'operational');await seed.feedback({reward:1,success:1,surprise:.02});
const s=seed.snapshot(); const p=s.system.latentActionProgramSynthesizerB276; const diag=seed.b276LatentProgramDiagnostics();
assert.equal(diag.verifiedPrograms>0,true); assert(diag.executionPlan.length>=3&&diag.executionPlan.length<=8); const plan=[...diag.executionPlan]; const programId=diag.executionProgramId; assert(programId);
p.executionCursor=0;p.executionProgramId=programId;p.activeProgramId=programId;
const enabled=await make(s,{...base,enableCompositionalExecution:true}); const en=await enabled.observe(obs,'operational'); const ed=enabled.b276LatentProgramDiagnostics();
assert.equal(en.decision.selected?.action,plan[0]); assert.equal(ed.executionCursor,1);
const disabled=await make(s,{...base,enableCompositionalExecution:false}); const dn=await disabled.observe(obs,'operational'); const dd=disabled.b276LatentProgramDiagnostics();
assert.equal(dd.executionCursor,0);
console.log(JSON.stringify({pass:true,status:'COMPOSITIONAL_COMMIT_CAUSAL',programId,plan,enabledSelected:en.decision.selected?.action,enabledCursor:ed.executionCursor,disabledSelected:dn.decision.selected?.action,disabledCursor:dd.executionCursor},null,2));
