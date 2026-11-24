import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const root=await mkdtemp(join(tmpdir(),'nk-b364-cadence-'));
const stateFile=join(root,'organism.json');
const body={bodyEnergy01:.78,cognitiveCapacity01:.82,thermalStrain01:.18,sensoryFreshness01:.86,awake:true,battery01:.78,cpuLoad01:.22,ramPressure01:.2};
const timings=[];
let core=new OrganismCore(new FileStateStore(stateFile,{backupEverySaves:2}),{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:8,enableTemporalResolutionGovernor:true,operationalPulseEvery:8,predictivePlanningHorizon:5});
await core.init();
try {
  for(let i=1;i<=100;i++){
    const t=performance.now();
    const r=await core.observeOperational({embodiment:body});
    timings.push(performance.now()-t);
    assert.equal(r.state.tick,i);
  }
  await core.flush();
  const s=core.snapshot();
  assert.equal(s.state.tick,100);
  assert.equal(s.facets.learning.p39.lifeTicks,100);
  assert.equal(s.facets.advanced.p54LongHorizonEvidence.cycles,100);
  assert.ok((s.system.competingPredictiveHypothesesB283?.planningUpdates??0)>=12);
  const sorted=[...timings].sort((a,b)=>a-b);
  const p95=sorted[Math.floor(sorted.length*.95)-1]??sorted.at(-1);
  const avg=timings.reduce((a,b)=>a+b,0)/timings.length;
  assert.ok(p95<400,`p95=${p95}`);
  core=new OrganismCore(new FileStateStore(stateFile,{backupEverySaves:2}),{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:8,enableTemporalResolutionGovernor:true,operationalPulseEvery:8,predictivePlanningHorizon:5});
  await core.init();
  assert.equal(core.snapshot().state.tick,100);
  assert.equal(core.snapshot().facets.learning.p39.lifeTicks,100);
  console.log(JSON.stringify({pass:true,status:'B364_CADENCE_100_FULL_PULSE_PASS',tick:s.state.tick,p39LifeTicks:s.facets.learning.p39.lifeTicks,p54Cycles:s.facets.advanced.p54LongHorizonEvidence.cycles,planningUpdates:s.system.competingPredictiveHypothesesB283?.planningUpdates??0,avgMs:Number(avg.toFixed(2)),p95Ms:Number(p95.toFixed(2))},null,2));
} finally { await rm(root,{recursive:true,force:true}); }
