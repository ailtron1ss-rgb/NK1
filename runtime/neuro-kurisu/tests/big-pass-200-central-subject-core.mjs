import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const store=new MemoryStateStore();
const core=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'});
await core.init();
for(let i=0;i<64;i++){
  await core.observe({
    text:i%3===0?'Проверяем гипотезу.':'Продолжаем эксперимент.',
    novelty:.22+(i%7)*.06,
    socialSignal:.35+(i%4)*.1,
    success:i%5===0?.75:.62,
    reward:i%5===0?.8:.58,
    embodiment:{bodyEnergy01:.82,cognitiveCapacity01:.86,thermalStrain01:.18,sensoryFreshness01:.88,awake:true,battery01:.8,cpuLoad01:.22,ramPressure01:.2}
  });
}
const d=core.centralSubjectDiagnostics(); assert.ok(d.samples>=64); assert.ok(d.meanCoherence01>0); assert.ok(core.snapshot().facets.cognition.centralSubjectDynamics);
const before=core.centralSubjectSnapshot();
const restored=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile'}); await restored.init();
assert.deepEqual(restored.centralSubjectSnapshot(),before,'central subject persistence');
const device=await restored.deviceHardwareCertification();
assert.ok(['UNAVAILABLE','HOST_PROBE','REAL_DEVICE_VERIFIED'].includes(device.status));
const persisted=restored.snapshot().facets.embodiment.deviceEvidence; assert.ok(persisted?.probes>=1);
console.log('BIG_PASS_200_CORE=PASS',JSON.stringify({cycles:64,samples:d.samples,phase:d.phase,coherence:d.meanCoherence01,coupling:d.coupling01,restored:'PASS',deviceStatus:device.status,deviceProbes:persisted?.probes}));
