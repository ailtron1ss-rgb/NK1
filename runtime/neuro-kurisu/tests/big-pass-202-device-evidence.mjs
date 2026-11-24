import assert from 'node:assert/strict';
import { DeviceEvidenceLedger, defaultDeviceEvidence } from '../src/organism/body/DeviceEvidenceLedger.ts';
const ledger=new DeviceEvidenceLedger(); ledger.restore(defaultDeviceEvidence());
const caps={battery:true,sensors:true,tts:true,stt:true,camera:true,wifi:true};
const telemetry=(status)=> status==='UNAVAILABLE'?null:{telemetry:{battery01:.8,batteryTemperatureC:30,thermalPressure01:.1,cpuLoad01:.2,ramPressure01:.3,networkOnline:true,screenInteractive:true,ambientLight01:.2,proximity01:.1,motion01:.1,charging:false,sampledAt:1,source:'android-termux',staleMs:0},diagnostics:{sampledAt:1,commandsAttempted:3,commandsSucceeded:3,commandFailures:0,sensorPayloadValid:true,batteryPayloadValid:true,wifiPayloadValid:true,capabilitySnapshot:caps,source:'android-termux'}};
ledger.record({at:1,status:'HOST_PROBE',capabilities:caps,telemetry:telemetry('HOST_PROBE')}); ledger.record({at:2,status:'REAL_DEVICE_VERIFIED',capabilities:caps,telemetry:telemetry('REAL_DEVICE_VERIFIED')}); ledger.record({at:3,status:'REAL_DEVICE_VERIFIED',capabilities:caps,telemetry:telemetry('REAL_DEVICE_VERIFIED')});
const cert=ledger.certification(2); assert.equal(cert.status,'verified');
const snap=ledger.snapshot(); const r=new DeviceEvidenceLedger(); r.restore(snap); assert.deepEqual(r.snapshot(),snap);
console.log('BIG_PASS_202_DEVICE_EVIDENCE=PASS',JSON.stringify({probes:snap.probes,verified:snap.verifiedProbes,host:snap.hostProbes,status:cert.status,restore:'PASS'}));
