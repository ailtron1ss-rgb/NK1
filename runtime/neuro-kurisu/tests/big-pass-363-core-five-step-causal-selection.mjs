import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const baseCfg={checkpointMaxDirtyCycles:1,checkpointMinIntervalMs:0,performanceProfile:'mobile',cycleResultMode:'operational',predictivePlanningHorizon:5,spineOnly:false,enableCompositionalExecution:false,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,
enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,enablePerception:false,enableLifelongLearning:false};
const emb={awake:true,bodyEnergy01:.88,cognitiveCapacity01:.9,thermalStrain01:.08,sensoryFreshness01:.88,battery01:.92,cpuLoad01:.14,ramPressure01:.12};
function obs(seed,tick){const q=.5+.34*Math.sin((seed+1)*.73+tick*.41);return {epistemic:q,autonomy:.55+.15*q,maintenance:.08,social:.03,novelty:.55+.18*q,uncertainty:.22+.18*(1-q),embodiment:emb};}
async function train(seed){const store=new MemoryStateStore();const c=new OrganismCore(store,{...baseCfg,predictivePlanningMode:'on'});await c.init();for(let i=0;i<7;i++)await c.observe(obs(seed,i+1),'operational');const state=await store.load();assert(state?.state?.tick===7);return state;}
async function runMode(state,seed,mode){const store=new MemoryStateStore({initial:state});const c=new OrganismCore(store,{...baseCfg,predictivePlanningMode:mode});await c.init();const r=await c.observe(obs(seed,8),'operational');return {r,diag:c.b283CompetingHypothesisDiagnostics(),store};}
const rows=[];
const seedStart=Math.max(0,Number(process.env.B363_SEED_START??0));
const seedEnd=Math.min(5,Number(process.env.B363_SEED_END??5));
for(let seed=seedStart;seed<seedEnd;seed++){
 const state=await train(seed);const [on,off,sham]=await Promise.all([runMode(state,seed,'on'),runMode(state,seed,'off'),runMode(state,seed,'sham')]);
 assert.equal(on.diag.plannedSequence.length,5);assert.equal(on.diag.planningSteps,5);assert.equal(off.diag.planningUpdates,on.diag.planningUpdates-1);assert.equal(sham.diag.planningUpdates,on.diag.planningUpdates);
 const om=new Map(on.r.decision.candidates.map(c=>[c.action,c.score]));const fm=new Map(off.r.decision.candidates.map(c=>[c.action,c.score]));const sm=new Map(sham.r.decision.candidates.map(c=>[c.action,c.score]));
 const causalL1=[...fm.keys()].reduce((a,k)=>a+Math.abs((om.get(k)??0)-(fm.get(k)??0)),0);const shamL1=[...fm.keys()].reduce((a,k)=>a+Math.abs((sm.get(k)??0)-(fm.get(k)??0)),0);const ratio=shamL1>0?causalL1/shamL1:Infinity;
 assert(causalL1>=.20,`seed ${seed+1}: five-step Core causal L1 ${causalL1}`);assert(ratio>=10,`seed ${seed+1}: five-step Core causal/sham ${ratio}`);assert.equal(sham.r.decision.selected?.action,off.r.decision.selected?.action,`seed ${seed+1}: SHAM must match OFF`);
 const restartStore=new MemoryStateStore({initial:await on.store.load()});const restart=new OrganismCore(restartStore,{...baseCfg,predictivePlanningMode:'on'});await restart.init();const rd=restart.b283CompetingHypothesisDiagnostics();assert.deepEqual(rd.plannedSequence,on.diag.plannedSequence);assert(Math.abs(rd.plannedReturn01-on.diag.plannedReturn01)<1e-9);
 rows.push({seed:seed+1,selectedON:on.r.decision.selected?.action??null,selectedOFF:off.r.decision.selected?.action??null,selectedSHAM:sham.r.decision.selected?.action??null,sequence:on.diag.plannedSequence,return01:on.diag.plannedReturn01,causalL1,shamL1,ratio,selectedChanged:on.r.decision.selected?.action!==off.r.decision.selected?.action});
}
console.log(JSON.stringify({pass:true,status:'CORE_FIVE_STEP_PREDICTIVE_CAUSAL_ON_OFF_SHAM_PASS',seeds:rows.length,changed:rows.filter(x=>x.selectedChanged).length,rows},null,2));
