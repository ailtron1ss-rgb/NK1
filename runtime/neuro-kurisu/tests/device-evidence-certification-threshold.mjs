import assert from 'node:assert/strict';
import { DeviceEvidenceLedger, defaultDeviceEvidence } from '../src/organism/body/DeviceEvidenceLedger.ts';

const caps={battery:true,sensors:true,tts:false,stt:false,camera:false,wifi:true};
const live={telemetry:{source:'android-termux',staleMs:0,sampledAt:10},diagnostics:{commandsAttempted:2,commandsSucceeded:2}};
const ledger=new DeviceEvidenceLedger();
ledger.restore(defaultDeviceEvidence());

// Empty evidence cannot be certified by zero, negative, fractional or non-finite thresholds.
for(const threshold of [0,-1,1.5,NaN,Infinity,65]){
  const result=ledger.certification(threshold);
  assert.equal(result.status,'unavailable',`threshold ${String(threshold)} must fail closed`);
  assert.equal(result.criteria.verifiedProbes,false);
  assert.equal(result.criteria.freshTelemetry,false);
  assert.equal(result.criteria.thresholdValid,false);
}

// A host probe remains diagnostic-only even when its telemetry is fresh.
ledger.record({at:10,status:'HOST_PROBE',capabilities:caps,telemetry:live});
assert.equal(ledger.certification(1).status,'host-probe');

// Two distinct physical-device records satisfy the default positive threshold.
ledger.record({at:11,status:'REAL_DEVICE_VERIFIED',capabilities:caps,telemetry:live});
const partial = ledger.certification(2);
assert.equal(partial.status,'host-probe',
  'one physical record is below threshold; host evidence remains diagnostic-only');
assert.equal(partial.criteria.verifiedProbes,false);
assert.equal(partial.criteria.freshTelemetry,false);
ledger.record({at:12,status:'REAL_DEVICE_VERIFIED',capabilities:caps,telemetry:live});
assert.equal(ledger.certification(2).status,'verified');

// Restored duplicate IDs cannot be counted as two independent device observations.
const snapshot=ledger.snapshot();
snapshot.records=[snapshot.records[0],{...snapshot.records[0]}];
const restored=new DeviceEvidenceLedger();
restored.restore(snapshot);
assert.equal(restored.certification(2).criteria.freshTelemetry,false);
assert.equal(restored.certification(2).status,'host-probe',
  'duplicate physical records must not certify; the existing host probe remains diagnostic-only');

console.log(JSON.stringify({pass:true,thresholdCases:6,hostProbeExcluded:true,distinctPhysicalRecordsRequired:true}));
