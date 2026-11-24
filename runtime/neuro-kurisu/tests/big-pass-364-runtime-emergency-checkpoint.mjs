import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const root=await mkdtemp(join(tmpdir(),'nk-b364-emergency-'));
const sf=join(root,'organism.json'), wf=join(root,'world.json');
const critical={schemaVersion:1,bodyEnergy01:.12,cognitiveCapacity01:.38,thermalStrain01:.86,sensoryFreshness01:.72,awake:true,sleep:'awake',wakeReason:'test',lastUserActivityAt:Date.now(),lastExternalEventAt:Date.now(),ttsAvailable:false,sttAvailable:false,cameraAvailable:false,microphoneAvailable:false,telemetry:{source:'host-fallback',sampledAt:Date.now(),staleMs:0,battery01:.12,batteryTemperatureC:34,cpuLoad01:.45,ramPressure01:.91,thermalPressure01:.86,networkOnline:false,motion01:0,storagePressure01:.2}};
const nominal={...critical,bodyEnergy01:.78,cognitiveCapacity01:.82,thermalStrain01:.18,awake:true,telemetry:{...critical.telemetry,battery01:.78,ramPressure01:.2,thermalPressure01:.18}};
try {
  const rt=new OrganismRuntime({stateFile:sf,worldStateFile:wf,enableLanguage:false,autoRun:false,intervalMs:999999,checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:32,performanceProfile:'mobile'});
  await rt.init();
  rt.embodiment.sample=async()=>{ rt.embodiment['body']=structuredClone(critical); return structuredClone(critical); };
  await rt.step('endurance-critical-resource-test',{deliberate:false});
  const m1=rt.persistenceMetrics();
  assert.ok(m1.emergencyCheckpoint.count>=1,`expected emergency checkpoint ${JSON.stringify(m1)}`);
  const before=rt.core.snapshot().state.tick;
  assert.ok((await stat(sf)).size>0);
  rt.stop();
  const resumed=new OrganismRuntime({stateFile:sf,worldStateFile:wf,enableLanguage:false,autoRun:false,intervalMs:999999,checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:32,performanceProfile:'mobile'});
  await resumed.init();
  assert.equal(resumed.core.snapshot().state.tick,before);
  await resumed.embodiment.sample();
  assert.ok(resumed.embodimentStatus().telemetry.battery01>=0);
  resumed.stop();
  console.log(JSON.stringify({pass:true,status:'B364_RUNTIME_EMERGENCY_CHECKPOINT_PASS',checkpoint:m1.emergencyCheckpoint,restoredTick:resumed.core.snapshot().state.tick,stateBytes:(await stat(sf)).size},null,2));
} finally { await rm(root,{recursive:true,force:true}); }
