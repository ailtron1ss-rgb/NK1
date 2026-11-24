import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';
import { EmbodiedActionExecutor } from '../src/organism/body/EmbodiedActionExecutor.ts';

const core = new B365UnifiedNeuroCausalCore();
const initial = core.diagnostics();
const high = core.planActivePerception({tick:1,uncertainty01:.9,predictionError01:.82,novelty01:.8,forceHighValueCheck:true});
assert.ok(high.priority01 > .6,'high uncertainty did not produce high perception priority');
assert.ok(high.requestedSensors.includes('battery'),'high-value plan omitted battery');
assert.ok(high.requestedSensors.some(x=>['motion','light','proximity'].includes(x)),'high-value plan omitted exteroceptive sensors');
core.recordGroundedObservation({tick:1,source:'world',freshness01:1,sensorConfidence01:.92,verified01:1,energy01:.8,thermal01:.25,motion01:.1,light01:.6,proximity01:.4,network01:1});
const low = core.planActivePerception({tick:2,uncertainty01:.05,predictionError01:.03,novelty01:.02,forceHighValueCheck:false});
assert.ok(low.requestedSensors.length >= 1,'routine plan did not request a sensor');
core.recordPerceptionPlanResult({tick:2,observedSensors:['battery','motion'],fulfilled01:.8});
const diag = core.diagnostics();
assert.equal(diag.activePerceptionPlan.lastObservedSensors.length,2);
assert.ok(diag.activePerceptionStats.plans >= 2);
const snap = core.snapshot();
const restored = new B365UnifiedNeuroCausalCore();
restored.restore(snap);
const restoredDiag = restored.diagnostics();
assert.deepEqual(restoredDiag.grounding,diag.grounding);
assert.deepEqual(restoredDiag.activePerceptionPlan,diag.activePerceptionPlan);

const embodiment = new EmbodimentRuntime();
await embodiment.init();
const exec = new EmbodiedActionExecutor(embodiment);
const result = await exec.execute('explore',{allowCamera:false});
assert.ok(result.consequenceVerification);
if (result.source !== 'android-termux') {
  assert.equal(result.consequenceVerification.verified,false,'host action was incorrectly verified as physical device');
  assert.notEqual(result.realityClass,'device-observation');
}
const rest = await exec.execute('rest');
assert.ok(rest.consequenceVerification);
assert.equal(rest.consequenceVerification.verified,false,'derived rest transition must not be promoted to physical evidence');
console.log(JSON.stringify({
  pass:true,
  status:'B371_ACTIVE_PERCEPTION_CONSEQUENCE_PASS',
  highPlan:{priority01:Number(high.priority01.toFixed(6)),expectedInformationGain01:Number(high.expectedInformationGain01.toFixed(6)),requestedSensors:high.requestedSensors},
  lowPlan:{priority01:Number(low.priority01.toFixed(6)),requestedSensors:low.requestedSensors},
  perceptionStats:diag.activePerceptionStats,
  hostExplore:{status:result.status,source:result.source,verified:result.consequenceVerification.verified,realityClass:result.realityClass},
  rest:{status:rest.status,verified:rest.consequenceVerification.verified,realityClass:rest.realityClass}
},null,2));
