import assert from 'node:assert/strict';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';
import { EmbodiedActionExecutor } from '../src/organism/body/EmbodiedActionExecutor.ts';

const body = new EmbodimentRuntime();
await body.init();
const exec = new EmbodiedActionExecutor(body);

const explore = await exec.execute('explore', { allowCamera:false });
if (explore.source === 'android-termux') {
  assert.equal(explore.status, 'executed');
  assert.equal(explore.consequenceVerification.verified, true);
  assert.equal(explore.consequenceVerification.verificationMode, 'independent-observation');
  assert.equal(explore.realityClass, 'device-observation');
} else {
  assert.equal(explore.status, 'unavailable');
  assert.equal(explore.consequenceVerification.verified, false);
  assert.notEqual(explore.realityClass, 'device-observation');
}

const respond = await exec.execute('respond', { spokenText:'B378 physical action gate check' });
if (respond.source === 'android-termux' && respond.status === 'executed') {
  assert.equal(respond.consequenceVerification.verified, false, 'TTS execution must not be promoted to external-effect verification');
  assert.equal(respond.consequenceVerification.verificationMode, 'actuation-receipt-only');
  assert.equal(respond.realityClass, 'device-actuation');
} else {
  assert.equal(respond.consequenceVerification.verified, false);
}

const rest = await exec.execute('rest');
assert.equal(rest.status, 'executed');
assert.equal(rest.consequenceVerification.verified, false);
assert.equal(rest.consequenceVerification.verificationMode, 'derived-state-transition');
assert.equal(rest.realityClass, 'derived');

console.log(JSON.stringify({
  pass:true,
  status:'B378_DEVICE_ACTION_CONSEQUENCE_GATE_PASS',
  source:explore.source,
  explore:{status:explore.status,verified:explore.consequenceVerification.verified,mode:explore.consequenceVerification.verificationMode,realityClass:explore.realityClass},
  respond:{status:respond.status,verified:respond.consequenceVerification.verified,mode:respond.consequenceVerification.verificationMode,realityClass:respond.realityClass},
  rest:{status:rest.status,verified:rest.consequenceVerification.verified,mode:rest.consequenceVerification.verificationMode,realityClass:rest.realityClass}
},null,2));
