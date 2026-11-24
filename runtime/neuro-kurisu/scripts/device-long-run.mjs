import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const base = String(process.env.NK_URL || 'http://127.0.0.1:3000').replace(/\/$/,'');
const hours = Math.max(0.1, Number(process.env.NK_DURATION_HOURS || 24));
const intervalMs = Math.max(5_000, Number(process.env.NK_PROBE_INTERVAL_MS || 60_000));
const outDir = path.resolve(process.env.NK_GATE_DIR || 'state/device-gate');
await mkdir(outDir, { recursive:true });
const startedAt = Date.now();
const deadline = startedAt + hours*3600_000;
const samples=[];
let failures=0;
let consecutiveFailures=0;

async function probe(pathname){
  const started=Date.now();
  const res=await fetch(`${base}${pathname}`, { signal:AbortSignal.timeout(10_000) });
  const text=await res.text();
  return { status:res.status, latencyMs:Date.now()-started, body:text.length?JSON.parse(text):null };
}

console.log(`P21_DEVICE_GATE begin hours=${hours} intervalMs=${intervalMs} url=${base}`);
while(Date.now()<deadline){
  const at=new Date().toISOString();
  try{
    const [health,metrics,adaptive,temporal]=await Promise.all([probe('/api/health'),probe('/api/metrics'),probe('/api/organism/adaptive-development'),probe('/api/organism/time')]);
    const sample={
      at,
      healthStatus:health.status,
      metricsStatus:metrics.status,
      adaptiveStatus:adaptive.status,
      temporalStatus:temporal.status,
      healthLatencyMs:health.latencyMs,
      metricsLatencyMs:metrics.latencyMs,
      adaptiveLatencyMs:adaptive.latencyMs,
      tick:metrics.body?.tick,
      uptimeSec:health.body?.uptimeSec,
      ramPressure01:metrics.body?.body?.ramPressure01,
      battery01:metrics.body?.body?.battery01,
      thermalPressure01:metrics.body?.body?.thermalPressure01,
      behaviorEntropy01:adaptive.body?.adaptiveDevelopment?.behaviorEntropy01,
      actionCoverage:Object.keys(adaptive.body?.adaptiveDevelopment?.actionCounts??{}).length,
      diversityPressure01:adaptive.body?.adaptiveDevelopment?.diversityPressure01,
      gapSincePreviousMs:temporal.body?.offlineSinceLastCheckpointMs,
      currentIso:temporal.body?.current?.iso,
      sessionCount:temporal.body?.sessionCount,
    };
    samples.push(sample); consecutiveFailures=0; console.log(JSON.stringify(sample));
    await writeFile(path.join(outDir,'latest.json'),JSON.stringify({startedAt,deadline,hours,samples:samples.slice(-256)},null,2));
  }catch(error){
    failures++; consecutiveFailures++; const sample={at,error:String(error?.message||error),consecutiveFailures}; samples.push(sample); console.error(JSON.stringify(sample));
    if(consecutiveFailures>=5){ console.error('P21_DEVICE_GATE=FAIL consecutive probe failures'); process.exitCode=2; break; }
  }
  const remaining=deadline-Date.now(); if(remaining<=0) break; await new Promise(r=>setTimeout(r,Math.min(intervalMs,remaining)));
}
const result={ok:failures===0||consecutiveFailures<5,startedAt,endedAt:Date.now(),hours,samples: samples.length,failures,last:samples.at(-1)};
await writeFile(path.join(outDir,'result.json'),JSON.stringify(result,null,2));
console.log(`P21_DEVICE_GATE=${result.ok?'PASS':'FAIL'} samples=${result.samples} failures=${result.failures}`);
if(!result.ok)process.exit(2);
