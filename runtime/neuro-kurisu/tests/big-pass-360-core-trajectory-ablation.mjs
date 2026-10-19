import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const EMB={awake:true,bodyEnergy01:.82,cognitiveCapacity01:.78,thermalStrain01:.16,sensoryFreshness01:.74,battery01:.84,cpuLoad01:.22,ramPressure01:.20};
const base={performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:false,enableCompositionalExecution:true,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,
enablePerception:false,enableLifelongLearning:false};
const OBS={epistemic:.30,autonomy:.55,maintenance:.08,social:.07,novelty:.76,uncertainty:.42,embodiment:EMB};
async function mk(snapshot){const c=new OrganismCore(new MemoryStateStore(snapshot?{initial:snapshot}:undefined),base);await c.init();return c;}
function latent(seed){return {goalVector:Array.from({length:8},(_,i)=>Math.sin((i+1)*(seed+1)*.31)),selfLatent:Array.from({length:8},(_,i)=>Math.cos((i+2)*(seed+1)*.23)),worldLatent:Array.from({length:8},(_,i)=>Math.sin((i+3)*(seed+2)*.17)),neuralAssembly:Array.from({length:12},(_,i)=>((i*(seed+2))%9)/8)};}

const rows=[];
const requestedSeed=process.env.B360_SEED===undefined?null:Number(process.env.B360_SEED);
const seeds=requestedSeed===null?[0,1,2,3,4]:[requestedSeed];
for(const seed of seeds){
  const c=await mk();
  await c.observe(OBS,'operational');
  await c.feedback({reward:1,success:1,surprise:.02});
  const L=latent(seed);
  const d0=c.b276LatentProgramDiagnostics();
  const programId=d0.executionProgramId; assert(programId);
  // Ensure a known program exists and can be trained into two structural revisions.
  const prop=c.b276LatentProgramPropose({tick:4000+seed,...L,personalityBias:{respond:.04,explore:.03,verify:.02,rest:0,reflect:.02,wait:-.01,defer:0},autonomy01:.64,noveltyNeed01:.69,promotedSkills:[{id:`a${seed}`,actions:['respond','explore'],reliability01:.94},{id:`b${seed}`,actions:['verify','reflect'],reliability01:.91},{id:`c${seed}`,actions:['rest','wait'],reliability01:.87}]});
  c.b276LatentProgramTrial({tick:4010+seed,programId:prop.programId,reward01:.94,independentGain01:.16,predictionError01:.14,robustness01:.88,personalityAlignment01:.86,selfAlignment01:.84});
  let plan=c.b276LatentProgramDiagnostics().executionPlan.slice();
  for(let ep=0;ep<2;ep++){
    const target=ep===0?plan[1]:plan[plan.length-1];
    const credits=plan.map((a,i)=>a===target?.97:(i===0?.61:.32));
    for(let step=0;step<3;step++){
      const diag=c.b276LatentProgramDiagnostics();
      // At the decision boundary the program's current primitive must be the committed action.
      const expected=diag.executionPlan[diag.executionCursor]; assert(expected);
      const out=await c.observe({...OBS,novelty: ep===0?.55:.88},'operational');
      assert.equal(out.decision.selected?.action,expected,`seed ${seed} ep ${ep} step ${step} must commit program primitive`);
      const after=c.b276LatentProgramDiagnostics();
      assert.equal(after.executionCursor,diag.executionCursor+1,`seed ${seed} cursor must advance exactly once`);
      await c.feedback({reward:credits[step],success:credits[step],surprise:1-credits[step]});
      plan=c.b276LatentProgramDiagnostics().executionPlan.slice();
    }
  }
  const trained=c.b276LatentProgramDiagnostics();
  assert.equal(trained.activeProgramStructureRevisionCount,2,`seed ${seed} two revisions`);
  const trainedSnapshot=c.snapshot();
  const trainedPlan=trained.executionPlan.slice();
  const trained2=await mk(trainedSnapshot);
  const persisted=trained2.b276LatentProgramDiagnostics(); assert.deepEqual(persisted.executionPlan,trainedPlan);

  // Select the trained trajectory after restart.
  const trainedSelected=[];
  for(let step=0;step<3;step++){
    const d=trained2.b276LatentProgramDiagnostics(); const expected=d.executionPlan[d.executionCursor];
    const out=await trained2.observe({...OBS,novelty:.91},'operational');
    assert.equal(out.decision.selected?.action,expected,`seed ${seed} trained trajectory step ${step}`);
    trainedSelected.push(out.decision.selected?.action);
    await trained2.feedback({reward:.88,success:.9,surprise:.12});
  }

  // Ablate the complete two-episode learned structure and select again.
  const ab=structuredClone(trainedSnapshot);
  const b=ab.system.latentActionProgramSynthesizerB276; const p=b.programs.find(x=>x.id===prop.programId); assert(p);
  // Recover the pre-learning plan from a fresh program with identical proposal inputs.
  const fresh=await mk();
  const fp=fresh.b276LatentProgramPropose({tick:4000+seed,...L,personalityBias:{respond:.04,explore:.03,verify:.02,rest:0,reflect:.02,wait:-.01,defer:0},autonomy01:.64,noveltyNeed01:.69,promotedSkills:[{id:`a${seed}`,actions:['respond','explore'],reliability01:.94},{id:`b${seed}`,actions:['verify','reflect'],reliability01:.91},{id:`c${seed}`,actions:['rest','wait'],reliability01:.87}]});
  const originalPlan=fp.primitivePlan.slice();
  b.executionPlan=originalPlan; b.executionCursor=0; b.programStructureRevisions=0; p.stepCredits01=originalPlan.map(()=>.5); p.structureRevisionCount=0;
  const sham=await mk(ab); // start from the trained snapshot then ablate only program structure/credits
  const shamSelected=[];
  for(let step=0;step<3;step++){
    const d=sham.b276LatentProgramDiagnostics(); const expected=d.executionPlan[d.executionCursor];
    const out=await sham.observe({...OBS,novelty:.91},'operational');
    assert.equal(out.decision.selected?.action,expected,`seed ${seed} sham trajectory step ${step}`);
    shamSelected.push(out.decision.selected?.action);
    await sham.feedback({reward:.88,success:.9,surprise:.12});
  }
  assert.notDeepEqual(trainedSelected,shamSelected,`seed ${seed} full trajectory must change under ablation`);
  assert.equal(trainedSelected.length,3); assert.equal(shamSelected.length,3);
  rows.push({seed:seed+1,originalPlan,trainedPlan,trainedSelected,shamSelected,trainedRevisionCount:trained.activeProgramStructureRevisionCount});
}
console.log(JSON.stringify({pass:true,status:'CORE_TRAJECTORY_SELECTION_AFTER_SECOND_REVISION_ABLATION_PASS',seeds:rows.length,rows},null,2));
