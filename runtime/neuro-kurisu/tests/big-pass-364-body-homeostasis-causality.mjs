import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const makeBody=(critical)=>critical
  ? {bodyEnergy01:.18,cognitiveCapacity01:.34,thermalStrain01:.88,sensoryFreshness01:.8,awake:true,battery01:.16,cpuLoad01:.82,ramPressure01:.86}
  : {bodyEnergy01:.84,cognitiveCapacity01:.86,thermalStrain01:.18,sensoryFreshness01:.9,awake:true,battery01:.84,cpuLoad01:.18,ramPressure01:.18};
const config={performanceProfile:'balanced',cycleResultMode:'operational',checkpointMinIntervalMs:0,predictivePlanningHorizon:5};
const seed=new OrganismCore(new MemoryStateStore(),config); await seed.init();
for(let i=0;i<12;i++) await seed.observe({novelty:.3,embodiment:makeBody(false),reward:i%4===0?.7:undefined},'operational');
const snap=seed.snapshot();
const run=async(body)=>{const store=new MemoryStateStore({initial:snap});const c=new OrganismCore(store,config);await c.init();return c.observe({novelty:.3,embodiment:body},'operational');};
const nominal=await run(makeBody(false)); const critical=await run(makeBody(true));
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const vec=r=>Object.fromEntries((r.decision?.candidates??[]).map(c=>[c.action,Number(c.score??0)]));
const a=vec(nominal),b=vec(critical);
const l1=actions.reduce((s,x)=>s+Math.abs((a[x]??0)-(b[x]??0)),0);
const restLift=(b.rest??0)-(a.rest??0), deferLift=(b.defer??0)-(a.defer??0), waitLift=(b.wait??0)-(a.wait??0);
assert.ok(l1>.04,`homeostatic causal L1 too small ${l1}`);
assert.ok(Math.max(restLift,deferLift,waitLift)>.015,`no protective action lift ${JSON.stringify({restLift,deferLift,waitLift})}`);
console.log(JSON.stringify({pass:true,status:'B364_BODY_HOMEOSTASIS_CAUSAL_PASS',nominalAction:nominal.state.lastAction,criticalAction:critical.state.lastAction,l1:Number(l1.toFixed(6)),lifts:{rest:Number(restLift.toFixed(6)),defer:Number(deferLift.toFixed(6)),wait:Number(waitLift.toFixed(6))},nominalScores:a,criticalScores:b},null,2));
