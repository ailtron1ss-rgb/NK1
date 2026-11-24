import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const dir=await mkdtemp(path.join(tmpdir(),'nk-p2867-'));
try {
  const runtime=new OrganismRuntime({
    stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json'),enableLanguage:false,autoRun:false,
    checkpointMinIntervalMs:60_000,checkpointMaxDirtyCycles:12,performanceProfile:'mobile',cycleResultMode:'summary',
  });
  await runtime.init();
  let peakHeap=0,peakRss=0, maxClosure=0, maxClaims=0, maxEmbodied=0, maxReplay=0;
  for(let i=0;i<24;i+=1){
    await runtime.autonomousStep();
    const m=process.memoryUsage(); peakHeap=Math.max(peakHeap,m.heapUsed);peakRss=Math.max(peakRss,m.rss);
    if ((i+1)%4===0) {
      const retention=runtime.core.mobileRetentionDiagnostics();
      maxClosure=Math.max(maxClosure,retention.cognitiveDomainClosureRecentLength);
      maxClaims=Math.max(maxClaims,retention.p40ClaimsLength);
      maxEmbodied=Math.max(maxEmbodied,retention.embodiedTransitionsLogLength);
      maxReplay=Math.max(maxReplay,retention.replayBufferLength);
    }
  }
  const econ=runtime.core.mobileStateEconomyDiagnostics();
  if(global.gc) global.gc();
  const after=process.memoryUsage();
  assert.ok(maxClosure<=16,`closure retention=${maxClosure}`);
  assert.ok(maxClaims<=256,`P40 claims retention=${maxClaims}`);
  assert.ok(maxEmbodied<=64,`embodied transition retention=${maxEmbodied}`);
  assert.ok(maxReplay<=192,`neural replay retention=${maxReplay}`);
  assert.ok(Number.isFinite(econ.lastBytesAfter) && econ.lastBytesAfter>=0,'B301 byte accounting invalid');
  assert.ok(after.heapUsed < 180*1024*1024,`post-GC heap too high: ${after.heapUsed}`);
  console.log(`P2867_MOBILE_RETENTION=PASS peakHeapMB=${(peakHeap/1e6).toFixed(1)} peakRssMB=${(peakRss/1e6).toFixed(1)} postGcHeapMB=${(after.heapUsed/1e6).toFixed(1)} closure=${maxClosure} claims=${maxClaims} embodied=${maxEmbodied} replay=${maxReplay} compactAfterKB=${(econ.lastBytesAfter/1024).toFixed(1)}`);
  await runtime.stop();
} finally { await rm(dir,{recursive:true,force:true}); }
