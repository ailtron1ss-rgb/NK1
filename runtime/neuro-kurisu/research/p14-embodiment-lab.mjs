import assert from 'node:assert/strict';
import { PerceptionEngine } from '../src/organism/cognition/PerceptionEngine.ts';

function body({motion=0.02, light=0.5, proximity=0.5, battery=0.8, networkOnline=true, thermal=0.1}={}) {
  const now=Date.now();
  return {schemaVersion:1,sleep:'awake',awake:true,telemetry:{battery01:battery,batteryTemperatureC:30,thermalPressure01:thermal,cpuLoad01:.1,ramPressure01:.2,networkOnline,screenInteractive:null,ambientLight01:light,proximity01:proximity,motion01:motion,charging:true,sampledAt:now,source:'simulated',staleMs:0},lastExternalEventAt:now,lastUserActivityAt:now,wakeReason:'lab',bodyEnergy01:.8,thermalStrain01:thermal,sensoryFreshness01:1,cognitiveCapacity01:.9,circadian01:.7,ttsAvailable:false,sttAvailable:false,cameraAvailable:false,microphoneAvailable:false};
}

const results=[];
for(const [seed,motion] of [[1,.72],[2,.82],[3,.66]]){
  const p=new PerceptionEngine();
  const quiet=p.perceive({body:body({motion:.02})});
  const detected=p.perceive({body:body({motion})});
  const stable=p.perceive({body:body({motion})});
  assert.equal(quiet.kind,'quiet');
  assert.equal(detected.kind,'motion');
  assert.equal(stable.kind,'quiet');
  results.push({seed,detectedKind:detected.kind,detectedSalience:detected.salience,stableKind:stable.kind,eventCount:p.snapshot().eventCount});
}
const network=new PerceptionEngine();
network.perceive({body:body({networkOnline:true})});
const offline=network.perceive({body:body({networkOnline:false})});
assert.equal(offline.kind,'network-change');
const resource=new PerceptionEngine();
resource.perceive({body:body({battery:.8})});
const low=resource.perceive({body:body({battery:.1})});
assert.equal(low.kind,'resource');
console.log(JSON.stringify({P14_EMBODIMENT_LAB:'PASS',results,networkChange:true,resourceChange:true},null,2));
