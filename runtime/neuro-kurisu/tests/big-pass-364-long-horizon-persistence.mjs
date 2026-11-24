import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdtemp, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const root = await mkdtemp(join(tmpdir(), 'nk-b364-long-'));
const stateFile = join(root, 'organism.json');
const body = {
  bodyEnergy01:.78, cognitiveCapacity01:.82, thermalStrain01:.18, sensoryFreshness01:.86,
  awake:true, battery01:.78, cpuLoad01:.22, ramPressure01:.20,
};
const timings=[]; const heaps=[]; const milestones={};
let core = new OrganismCore(new FileStateStore(stateFile,{backupEverySaves:2}), {
  performanceProfile:'mobile', cycleResultMode:'operational', checkpointMinIntervalMs:0,
  checkpointMaxDirtyCycles:8, enableTemporalResolutionGovernor:true, operationalPulseEvery:32,
  predictivePlanningHorizon:5,
});
await core.init();
try {
  for(let i=1;i<=1000;i++){
    const started=performance.now();
    const phase = i>=700 && i<760 ? {bodyEnergy01:.42,cognitiveCapacity01:.55,thermalStrain01:.86,battery01:.12,cpuLoad01:.35,ramPressure01:.91} : body;
    const r=await core.observeOperational({
      text:i%173===0?`endurance-probe-${i}`:undefined,
      reward:i%97===0?.66:undefined,
      embodiment:{...phase,sensoryFreshness01:.84,awake:true},
    });
    timings.push(performance.now()-started);
    assert.equal(typeof r.state.tick,'number');
    if(i===100||i===500||i===1000){
      await core.flush();
      const snap=core.snapshot();
      milestones[i]={tick:snap.state.tick,identity01:snap.facets.consciousness.identityContinuity.continuity,
        p39LifeTicks:snap.facets.learning.p39?.lifeTicks??0,p54Cycles:snap.facets.advanced.p54LongHorizonEvidence?.cycles??0,
        planningUpdates:snap.system.competingPredictiveHypothesesB283?.planningUpdates??0,memoryCount:snap.memories?.length??0,
        replaySignature:String(snap.system.replaySignature??'')};
      assert.equal(snap.state.tick,i);
      assert.ok(milestones[i].identity01>0.1);
      if(i<1000){
        core=new OrganismCore(new FileStateStore(stateFile,{backupEverySaves:2}), {
          performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:0,
          checkpointMaxDirtyCycles:8,enableTemporalResolutionGovernor:true,operationalPulseEvery:32,
          predictivePlanningHorizon:5,
        });
        await core.init();
        assert.equal(core.snapshot().state.tick,i,`restart at ${i} did not preserve tick`);
      }
    }
    if(i%100===0) heaps.push({cycle:i,heapMB:process.memoryUsage().heapUsed/1048576});
  }
  await core.flush();
  const final=core.snapshot();
  const fileBytes=(await stat(stateFile)).size;
  const p39=final.facets.learning.p39;
  const temporal=final.system.temporalResolution;
  const median=a=>{const b=[...a].sort((x,y)=>x-y);const m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;};
  const warm=median(timings.slice(300,400)), last=median(timings.slice(-100));
  const sorted=[...timings].sort((a,b)=>a-b), p95=sorted[Math.floor(sorted.length*.95)-1]??sorted.at(-1);
  assert.equal(final.state.tick,1000);
  assert.ok(p39.lifeTicks>=1000);
  assert.ok((p39.stress?.thermalEvents ?? 0) > 0, 'resource stress never reached P39');
  assert.ok((p39.stress?.batteryEvents ?? 0) > 0, 'battery stress never reached P39');
  assert.ok(final.facets.advanced.p54LongHorizonEvidence.cycles>=900);
  assert.ok(String(final.system.replaySignature||'').length>10);
  assert.ok((final.system.competingPredictiveHypothesesB283?.planningUpdates ?? 0) >= 6);
  assert.ok((temporal?.idleCyclesSincePulse ?? 0) >= 0);
  assert.ok(fileBytes < 8_000_000, `state grew too large: ${fileBytes}`);
  assert.ok(final.memories.length<=500);
  assert.ok(last/Math.max(warm,.001)<8,`warm=${warm} last=${last}`);
  assert.ok(p95<250,`p95=${p95}`);
  console.log(JSON.stringify({pass:true,status:'B364_LONG_HORIZON_PERSISTENCE_PASS',cycles:1000,milestones,final:{tick:final.state.tick,identity01:final.facets.consciousness.identityContinuity.continuity,p39LifeTicks:p39.lifeTicks,p39Stress:p39.stress,p54Cycles:final.facets.advanced.p54LongHorizonEvidence.cycles,planningUpdates:final.system.competingPredictiveHypothesesB283?.planningUpdates??0,memoryCount:final.memories.length,temporalResolution:temporal,fileBytes},performance:{warmMs:Number(warm.toFixed(2)),lastMs:Number(last.toFixed(2)),ratio:Number((last/Math.max(warm,.001)).toFixed(3)),p95Ms:Number(p95.toFixed(2))},heap:heaps,fileBytes},null,2));
} finally { await rm(root,{recursive:true,force:true}); }
