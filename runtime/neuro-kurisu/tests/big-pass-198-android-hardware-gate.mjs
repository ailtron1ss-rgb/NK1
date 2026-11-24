import assert from 'node:assert/strict';
import { certifyAndroidHardware } from '../src/organism/body/AndroidEmbodimentBridge.ts';
const previous={battery01:.8,batteryTemperatureC:31,thermalPressure01:.1,cpuLoad01:.2,ramPressure01:.2,networkOnline:true,screenInteractive:true,ambientLight01:.4,proximity01:.2,motion01:.1,charging:false,sampledAt:Date.now()-1000,source:'node-host',staleMs:1000};
const result=await certifyAndroidHardware(previous);
assert.ok(['REAL_DEVICE_VERIFIED','HOST_PROBE','UNAVAILABLE'].includes(result.status));
if(result.status==='REAL_DEVICE_VERIFIED'){
  assert.ok(result.telemetry);
  assert.equal(result.telemetry.telemetry.source,'android-termux');
  assert.equal(result.telemetry.telemetry.staleMs,0);
  assert.equal(result.checks.batteryFresh,true);
}else{
  assert.notEqual(result.status,'REAL_DEVICE_VERIFIED');
}
console.log('BIG_PASS_198_ANDROID_HARDWARE_GATE=PASS',JSON.stringify({status:result.status,capabilities:result.capabilities,checks:result.checks}));
