import assert from 'node:assert/strict';
import { DeviceEvidenceLedger, defaultDeviceEvidence } from '../src/organism/body/DeviceEvidenceLedger.ts';

const ledger=new DeviceEvidenceLedger();
ledger.restore(defaultDeviceEvidence());
ledger.record({at:Date.now(),status:'HOST_PROBE',capabilities:{battery:false,sensors:false,tts:false,stt:false,camera:false,wifi:false},telemetry:{telemetry:{source:'host-probe',staleMs:0,sampledAt:Date.now()},diagnostics:{sampledAt:Date.now(),commandsAttempted:3,commandsSucceeded:0,commandFailures:3,sensorPayloadValid:false,batteryPayloadValid:false,wifiPayloadValid:false,capabilitySnapshot:{battery:false,sensors:false,tts:false,stt:false,camera:false,wifi:false},source:'host-probe'}}});
const cert=ledger.certification(1);
assert.notEqual(cert.status,'verified');
assert.equal(cert.status,'host-probe');
const freshDevice={telemetry:{source:'android-termux',staleMs:0,sampledAt:Date.now()},diagnostics:{sampledAt:Date.now(),commandsAttempted:3,commandsSucceeded:3,commandFailures:0,sensorPayloadValid:true,batteryPayloadValid:true,wifiPayloadValid:true,capabilitySnapshot:{battery:true,sensors:true,tts:false,stt:false,camera:false,wifi:true},source:'android-termux'}};
ledger.record({at:Date.now(),status:'REAL_DEVICE_VERIFIED',capabilities:{battery:true,sensors:true,tts:false,stt:false,camera:false,wifi:true},telemetry:freshDevice});
const cert2=ledger.certification(1);
assert.equal(cert2.status,'verified');
console.log(JSON.stringify({pass:true,status:'B364_DEVICE_EVIDENCE_BOUNDARY_PASS',host:{status:cert.status,lastStatus:ledger.snapshot().lastStatus},verified:{status:cert2.status,verifiedProbes:cert2.verifiedProbes}},null,2));
