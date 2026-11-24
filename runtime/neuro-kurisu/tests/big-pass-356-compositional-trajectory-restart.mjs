import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const EMB={awake:true,bodyEnergy01:.82,cognitiveCapacity01:.80,thermalStrain01:.14,sensoryFreshness01:.78,battery01:.86,cpuLoad01:.20,ramPressure01:.18};
const base={performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:false,enableCompositionalExecution:true,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,
enablePerception:false,enableLifelongLearning:false};
const contexts=[
  {name:'epistemic',obs:{epistemic:.72,autonomy:.48,maintenance:.08,social:.04,novelty:.60,uncertainty:.62,embodiment:EMB}},
  {name:'autonomy',obs:{epistemic:.18,autonomy:.82,maintenance:.06,social:.03,novelty:.66,uncertainty:.28,embodiment:EMB}},
  {name:'maintenance',obs:{epistemic:.10,autonomy:.34,maintenance:.72,social:.02,novelty:.22,uncertainty:.24,embodiment:{...EMB,bodyEnergy01:.42,thermalStrain01:.24}},},
  {name:'mixed',obs:{epistemic:.44,autonomy:.56,maintenance:.26,social:.14,novelty:.74,uncertainty:.47,embodiment:EMB}},
];
async function make(snapshot,cfg=base){const c=new OrganismCore(new MemoryStateStore(snapshot?{initial:snapshot}:undefined),cfg);await c.init();return c;}

const rows=[];
for (let si=0; si<5; si++) {
  const ctx=contexts[si%contexts.length];
  const seed=await make();
  await seed.observe({...ctx.obs,novelty:Math.min(1,ctx.obs.novelty+si*.03)},'operational');
  await seed.feedback({reward:1,success:1,surprise:.01});
  const goalVector=Array.from({length:8},(_,i)=>Math.sin((i+1)*(si+1)*.37));
  const selfLatent=Array.from({length:8},(_,i)=>Math.cos((i+2)*(si+1)*.21));
  const worldLatent=Array.from({length:8},(_,i)=>Math.sin((i+3)*(si+2)*.17));
  const neuralAssembly=Array.from({length:12},(_,i)=>((i*(si+3))%7)/6);
  const personalityBias={respond:.1*si,explore:.06,verify:.02,rest:.01,reflect:.05,wait:-.01,defer:.0};
  const proposal=seed.b276LatentProgramPropose({tick:900+si,goalVector,selfLatent,worldLatent,neuralAssembly,personalityBias,autonomy01:.55+.05*si,noveltyNeed01:.62,promotedSkills:[
    {id:`skill-${si}-a`,actions:['respond','explore'],reliability01:.92},
    {id:`skill-${si}-b`,actions:['verify','reflect'],reliability01:.88},
    {id:`skill-${si}-c`,actions:['rest','wait'],reliability01:.84},
  ]});
  const trial=seed.b276LatentProgramTrial({tick:901+si,programId:proposal.programId,reward01:.94,independentGain01:.18,predictionError01:.20,robustness01:.88,personalityAlignment01:.86,selfAlignment01:.84});
  assert.equal(trial.verified,true,`seed ${si} program must verify`);
  const before=seed.b276LatentProgramDiagnostics();
  const plan=[...before.executionPlan];
  assert(plan.length>=3&&plan.length<=8);
  let snap=seed.snapshot();

  let cursor=0; let commits=0; const selected=[];
  for (let step=0; step<plan.length; step++) {
    const resumed=await make(snap,{...base,enableCompositionalExecution:true});
    const d0=resumed.b276LatentProgramDiagnostics();
    assert.equal(d0.executionCursor,cursor,`seed ${si} restart step ${step}`);
    const out=await resumed.observe(ctx.obs,'operational');
    const d1=resumed.b276LatentProgramDiagnostics();
    assert.equal(out.decision.selected?.action,plan[cursor],`seed ${si} step ${step} selected exact primitive`);
    assert.equal(d1.executionCursor,cursor+1,`seed ${si} step ${step} cursor advanced`);
    commits++; selected.push(out.decision.selected?.action);
    snap=resumed.snapshot(); cursor++;
  }
  assert.equal(cursor,plan.length);
  const done=await make(snap,{...base,enableCompositionalExecution:true});
  const doneDiag=done.b276LatentProgramDiagnostics();
  assert.equal(doneDiag.executionCompletions,1,`seed ${si} completion persisted`);

  const off=await make(seed.snapshot(),{...base,enableCompositionalExecution:false});
  const off0=off.b276LatentProgramDiagnostics();
  const offOut=await off.observe(ctx.obs,'operational');
  const off1=off.b276LatentProgramDiagnostics();
  assert.equal(off1.executionCursor,off0.executionCursor,`seed ${si} OFF must not advance cursor`);
  rows.push({seed:si+1,context:ctx.name,steps:plan.length,plan,selected,completion:doneDiag.executionCompletions,offCursor:off1.executionCursor});
}
console.log(JSON.stringify({pass:true,status:'COMPOSITIONAL_MULTI_STEP_RESTART_CAUSAL_PASS',seeds:rows.length,rows},null,2));
