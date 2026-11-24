import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const config={performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:0,predictivePlanningHorizon:5,spineOnly:true};
const makeBody=(stress)=>stress?{bodyEnergy01:.22,cognitiveCapacity01:.42,thermalStrain01:.72,battery01:.25,cpuLoad01:.75,ramPressure01:.68,awake:true}:{bodyEnergy01:.78,cognitiveCapacity01:.78,thermalStrain01:.18,battery01:.82,cpuLoad01:.18,ramPressure01:.2,awake:true};
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const rows=[];
for(let seed=1;seed<=5;seed++){
  const base=new OrganismCore(new MemoryStateStore(),config); await base.init();
  for(let t=0;t<72;t++) await base.observe({novelty:(seed+t)%5/10,uncertainty:t%3/6,embodiment:makeBody(t%4===0),reward:t%3===0?.74:.36},'operational');
  const snap=base.snapshot();
  const on=new OrganismCore(new MemoryStateStore({initial:snap}),config); await on.init();
  const lesionSnap=structuredClone(snap);
  const b=lesionSnap.system.unifiedNeuroCausalCoreB365; for(const s of b.synapses) s.active=false;
  const lesion=new OrganismCore(new MemoryStateStore({initial:lesionSnap}),config); await lesion.init();
  const a=await on.observe({novelty:.41,uncertainty:.35,embodiment:makeBody(seed%2===0)},'operational');
  const l=await lesion.observe({novelty:.41,uncertainty:.35,embodiment:makeBody(seed%2===0)},'operational');
  const av=Object.fromEntries(actions.map(x=>[x,a.decision.candidates.find(c=>c.action===x)?.score??0]));
  const lv=Object.fromEntries(actions.map(x=>[x,l.decision.candidates.find(c=>c.action===x)?.score??0]));
  const l1=actions.reduce((s,x)=>s+Math.abs(av[x]-lv[x]),0);
  assert.ok(l1>.001,`seed ${seed}: Core B365 lesion score shift too small ${l1}`);
  rows.push({seed,on:a.state.lastAction,lesion:l.state.lastAction,l1:Number(l1.toFixed(6)),onScores:av,lesionScores:lv,onB365:on.b365UnifiedNeuroCausalDiagnostics(),lesionB365:lesion.b365UnifiedNeuroCausalDiagnostics()});
}
console.log(JSON.stringify({pass:true,status:'B365_CORE_NEURAL_CAUSAL_SELECTION_PASS',seeds:rows.length,minScoreL1:Math.min(...rows.map(x=>x.l1)),rows},null,2));
