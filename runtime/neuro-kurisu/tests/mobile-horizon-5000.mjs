import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:60000});
await core.init();
const samples=[]; const N=5000;
for(let i=0;i<N;i++){
  const t=performance.now();
  const r=await core.observeOperational({
    text:i%257===0?`long-horizon-${i}`:undefined,
    reward:i%401===0?.68:undefined,
    embodiment:{bodyEnergy01:.8,thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.8,cpuLoad01:.22,ramPressure01:.2}
  });
  assert.ok(r.decision); samples.push(performance.now()-t);
}
const med=a=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]??0;};
const first=med(samples.slice(500,600)); const last=med(samples.slice(-200));
const sorted=[...samples].sort((a,b)=>a-b); const p95=sorted[Math.floor(sorted.length*.95)-1]??sorted.at(-1);
const snap=core.snapshotLight(); const ratio=last/Math.max(first,.001); const tr=snap.temporalResolution;
assert.ok(ratio<8,`ratio ${ratio}`); assert.ok(p95<260,`p95 ${p95}`); assert.ok(snap.memoryCount<=420,`memory ${snap.memoryCount}`);
assert.ok(tr.microCycles>tr.pulses,`expected mobile micro savings: ${tr.microCycles}/${tr.pulses}`);
console.log(`MOBILE_HORIZON_5000=PASS ratio=${ratio.toFixed(3)} firstMedianMs=${first.toFixed(2)} lastMedianMs=${last.toFixed(2)} p95=${p95.toFixed(2)} memory=${snap.memoryCount} micro=${tr.microCycles} pulses=${tr.pulses}`);
