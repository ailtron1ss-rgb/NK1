import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const baseCfg={checkpointMaxDirtyCycles:1,checkpointMinIntervalMs:0,performanceProfile:'mobile',cycleResultMode:'operational',predictivePlanningHorizon:3,spineOnly:false,enableCompositionalExecution:false,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,
enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,enablePerception:false,enableLifelongLearning:false};
const emb={awake:true,bodyEnergy01:.88,cognitiveCapacity01:.9,thermalStrain01:.08,sensoryFreshness01:.88,battery01:.92,cpuLoad01:.14,ramPressure01:.12};
function obs(seed,tick){
  const q=(x)=>Math.max(0,Math.min(1,.5+.34*Math.sin((seed+1)*.73+x*.41)));
  return {epistemic:q(tick+.1),autonomy:q(tick+1.7),maintenance:q(tick+3.1),social:.02+q(tick+4.5)*.08,novelty:q(tick+2.6),uncertainty:.22+q(tick+5.2)*.22,embodiment:emb};
}
async function cloneStore(source){ return new MemoryStateStore({initial:await source.load()}); }
async function trainToPrePlanning(seed){
  const store=new MemoryStateStore();
  const c=new OrganismCore(store,{...baseCfg,predictivePlanningMode:'on',predictivePlanningHorizon:3}); await c.init();
  for(let i=0;i<7;i++) await c.observe(obs(seed,i+1),'operational');
  const state=await store.load(); assert(state,'training state must persist');
  const d=c.b283CompetingHypothesisDiagnostics();
  return {state,prePlanTick:state.state.tick,prePlanDiag:d};
}
async function onePlanningCycle(state,seed,mode){
  const store=new MemoryStateStore({initial:state});
  const c=new OrganismCore(store,{...baseCfg,predictivePlanningMode:mode}); await c.init();
  const r=await c.observe(obs(seed,8),'operational');
  return {selected:r.decision.selected?.action??null,diag:c.b283CompetingHypothesisDiagnostics(),store,decision:r.decision};
}
const rows=[];
const seedStart=Math.max(0,Number(process.env.B362_SEED_START??0));
const seedEnd=Math.min(5,Number(process.env.B362_SEED_END??5));
for(let seed=seedStart;seed<seedEnd;seed++){
  const trained=await trainToPrePlanning(seed);
  assert.equal(trained.prePlanTick,7,`seed ${seed+1}: paired state must be tick 7`);
  const [on,off,sham]=await Promise.all([
    onePlanningCycle(trained.state,seed,'on'),
    onePlanningCycle(trained.state,seed,'off'),
    onePlanningCycle(trained.state,seed,'sham'),
  ]);
  assert.equal(on.diag.planningUpdates,trained.prePlanDiag.planningUpdates+1,`seed ${seed+1}: ON planning increment`);
  assert.equal(off.diag.planningUpdates,trained.prePlanDiag.planningUpdates,`seed ${seed+1}: OFF must not plan`);
  assert.equal(sham.diag.planningUpdates,trained.prePlanDiag.planningUpdates+1,`seed ${seed+1}: SHAM planning increment`);
  assert.equal(on.diag.plannedSequence.length,3,`seed ${seed+1}: ON plan length`);
  const onScores=new Map(on.decision.candidates.map(c=>[c.action,c.score]));
  const offScores=new Map(off.decision.candidates.map(c=>[c.action,c.score]));
  const shamScores=new Map(sham.decision.candidates.map(c=>[c.action,c.score]));
  const causalL1=[...offScores.keys()].reduce((sum,action)=>sum+Math.abs((onScores.get(action)??0)-(offScores.get(action)??0)),0);
  const shamL1=[...offScores.keys()].reduce((sum,action)=>sum+Math.abs((shamScores.get(action)??0)-(offScores.get(action)??0)),0);
  const causalVsShamRatio=shamL1>0?causalL1/shamL1:Number.POSITIVE_INFINITY;
  assert(causalL1>=0.30,`seed ${seed+1}: planner causal L1 ${causalL1.toFixed(6)} below 0.30`);
  assert(causalVsShamRatio>=10,`seed ${seed+1}: planner causal/sham ratio ${causalVsShamRatio.toFixed(2)} below 10x`);
  const selectedChanged=on.selected!==off.selected;
  const shamNearOff=sham.selected===off.selected;
  // Restart from ON's persisted checkpoint must recover the endogenous plan state.
  const restartStore=await cloneStore(on.store); const restart=new OrganismCore(restartStore,{...baseCfg,predictivePlanningMode:'on',predictivePlanningHorizon:3}); await restart.init();
  const rd=restart.b283CompetingHypothesisDiagnostics();
  assert.deepEqual(rd.plannedSequence,on.diag.plannedSequence,`seed ${seed+1}: restart plan mismatch`);
  assert(Math.abs(rd.plannedReturn01-on.diag.plannedReturn01)<1e-9,`seed ${seed+1}: restart return mismatch`);
  rows.push({seed:seed+1,selectedON:on.selected,selectedOFF:off.selected,selectedSHAM:sham.selected,plannedSequence:on.diag.plannedSequence,plannedReturn01:on.diag.plannedReturn01,selectedChanged,shamNearOff,causalL1,shamL1,causalVsShamRatio});
}
const changed=rows.filter(r=>r.selectedChanged).length;
const shamDifferent=rows.filter(r=>!r.shamNearOff).length;
assert.equal(rows.length,5,'B362 requires five independent Core seeds');
assert.equal(shamDifferent,0,'B362 SHAM must match OFF on every seed');
assert(changed>=4,'B362 requires final action change on at least 4/5 seeds');

console.log(JSON.stringify({pass:true,status:'CORE_PREDICTIVE_PLANNING_CAUSAL_ON_OFF_SHAM_PASS',seeds:rows.length,changed,shamDifferent,rows},null,2));
