import assert from 'node:assert/strict';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const oldBody = {
  schemaVersion: 1, awake:true, sleep:'awake',
  telemetry:{battery01:.7,batteryTemperatureC:null,thermalPressure01:.1,cpuLoad01:.1,ramPressure01:.2,networkOnline:null,screenInteractive:null,ambientLight01:null,proximity01:null,motion01:null,charging:null,sampledAt:1,source:'simulated',staleMs:0},
  lastExternalEventAt:1,lastUserActivityAt:1,wakeReason:'test',bodyEnergy01:.8,thermalStrain01:.1,sensoryFreshness01:1,cognitiveCapacity01:.9,circadian01:.7,ttsAvailable:false,sttAvailable:false,cameraAvailable:false,microphoneAvailable:false,
};
const migrated = migratePersistedOrganism({
  schemaVersion:16,
  state:{version:16,tick:7,needs:{energy:0.7}},
  facets:{
    cognition:{cognitiveField:{},contradictions:{},budget:{},immune:{},sources:{},skills:{},scientific:{},residualWorld:{}},
    embodiment:{body:oldBody,bodyEvents:[],sleepSessions:[],lastSensorAt:1,sensorFailures:0}
  }
});
assert.equal(migrated.schemaVersion, RELEASE_CONTRACT.stateSchema);
assert.equal(migrated.facets.cognition.perception.version, 2);
assert.equal(migrated.facets.embodiment.perceptionRouting.version, 1);
console.log('P14_MIGRATION=PASS');
