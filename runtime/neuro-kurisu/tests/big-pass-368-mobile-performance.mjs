import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const rt=new OrganismRuntime({stateFile:'/tmp/b368-perf.json',stateStore:new MemoryStateStore(),enableLanguage:false,autoRun:false,performanceProfile:'mobile',intervalMs:30000});
await rt.init();
const samples=[]; const heap=[];
for(let i=0;i<8;i++){ const start=process.hrtime.bigint(); await rt.autonomousStep(); const end=process.hrtime.bigint(); samples.push(Number(end-start)/1e6); heap.push(process.memoryUsage().heapUsed/1024/1024); }
samples.sort((a,b)=>a-b);
const p50=samples[Math.floor(samples.length*.5)]; const p95=samples[Math.min(samples.length-1,Math.floor(samples.length*.95))];
assert.ok(Number.isFinite(p50)&&Number.isFinite(p95));
console.log(JSON.stringify({pass:true,status:'B368_MOBILE_PERFORMANCE_OBSERVED',samplesMs:samples.map(x=>Number(x.toFixed(3))),p50Ms:Number(p50.toFixed(3)),p95Ms:Number(p95.toFixed(3)),heapMaxMiB:Number(Math.max(...heap).toFixed(2)),cycles:8,note:'host runtime only; not physical Android evidence'},null,2));
