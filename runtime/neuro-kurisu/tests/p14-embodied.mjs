import assert from 'node:assert/strict';
import { PerceptionEngine } from '../src/organism/cognition/PerceptionEngine.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const body = (motion, light = 0.5, proximity = 0.5, battery = 0.8, networkOnline = true) => ({
  schemaVersion:1,
  sleep:'awake', awake:true,
  telemetry:{battery01:battery,batteryTemperatureC:30,thermalPressure01:0.1,cpuLoad01:0.1,ramPressure01:0.2,networkOnline,screenInteractive:null,ambientLight01:light,proximity01:proximity,motion01:motion,charging:true,sampledAt:Date.now(),source:'simulated',staleMs:0},
  lastExternalEventAt:Date.now(),lastUserActivityAt:Date.now(),wakeReason:'test',bodyEnergy01:0.8,thermalStrain01:0.1,sensoryFreshness01:1,cognitiveCapacity01:0.9,circadian01:0.7,ttsAvailable:false,sttAvailable:false,cameraAvailable:false,microphoneAvailable:false,
});

const perception = new PerceptionEngine();
const first = perception.perceive({ body:body(0.02) });
assert.equal(first.kind, 'quiet');
const second = perception.perceive({ body:body(0.72) });
assert.equal(second.kind, 'motion');
assert.ok(second.salience > 0.3);
const third = perception.perceive({ body:body(0.72) });
assert.equal(third.kind, 'quiet');
const external = perception.perceive({ externalEvent:{detail:'door opened',importance:0.8} });
assert.equal(external.kind, 'world-surprise');

const store = new MemoryStateStore();
const core = new OrganismCore(store);
await core.init();
const cycle = await core.observe({ embodiment:{bodyEnergy01:0.8,cognitiveCapacity01:0.9,thermalStrain01:0.1,sensoryFreshness01:1,awake:true,battery01:0.8,cpuLoad01:0.1,ramPressure01:0.2}, worldEvent:{type:'motion',importance:0.7}, novelty:0.7, surprise:0.7 });
assert.ok(cycle.state.tick >= 1);
assert.equal(core.perceptionSnapshot().version, 2);
assert.ok(core.snapshot().facets.cognition.perception.eventCount >= 1);

console.log('P14_EMBODIED=PASS');
