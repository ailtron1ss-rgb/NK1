import assert from 'node:assert/strict';
import { choosePhonePolicyDelay } from '../src/organism/system/PhoneRuntimePolicy.ts';
import { P40ModelEcologyEngine } from '../src/organism/learning/P40ModelEcology.ts';
import { RuntimeEvidenceBus } from '../src/organism/system/RuntimeEvidenceBus.ts';

const nominal = choosePhonePolicyDelay({baseIntervalMs:30000,mode:'active',awake:true,battery01:.9,thermalStrain01:.2,ramPressure01:.2,cpuLoad01:.2,lastStepMs:200,previousThermalStrain01:.2,consecutiveActiveCycles:0,maxConsecutiveActiveCycles:3});
const stressed = choosePhonePolicyDelay({baseIntervalMs:30000,mode:'active',awake:true,battery01:.1,thermalStrain01:.8,ramPressure01:.85,cpuLoad01:.92,lastStepMs:25000,previousThermalStrain01:.7,consecutiveActiveCycles:3,maxConsecutiveActiveCycles:3});
assert.ok(stressed.nextDelayMs > nominal.nextDelayMs);
assert.ok(stressed.sampleDelayMs > nominal.sampleDelayMs);
assert.ok(stressed.cognitiveBudget01 < nominal.cognitiveBudget01);

const eco = new P40ModelEcologyEngine();
assert.equal(eco.configure('kobold', true)?.configured, true);
const selected = eco.select({task:'language',urgency01:.5,resourceRisk01:.2,desiredQuality01:.72,allowCloud:false});
assert.ok(['local-fallback','kobold'].includes(selected));
eco.observe(selected, false, .9);
eco.observe(selected, false, .9);
if (selected !== 'local-fallback') assert.equal(eco.profile(selected)?.available, false);

const bus = new RuntimeEvidenceBus();
const prediction = bus.publish({tick:1,kind:'prediction',source:'predictive-core',confidence01:.8,payload:{expected:.7}});
const outcome = bus.publish({tick:1,kind:'outcome',source:'device',confidence01:.95,external01:true,parentIds:[prediction.id],payload:{actual:.4}});
assert.ok(outcome.parentIds.includes(prediction.id));
assert.equal(bus.snapshot().externalCount,1);
assert.equal(bus.snapshot().byKind.prediction,1);
console.log('BIG_PASS_35_HARDENING=PASS');
