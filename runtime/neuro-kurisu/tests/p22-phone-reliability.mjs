import assert from 'node:assert/strict';
import { choosePhonePolicyDelay, resolvePhonePolicyConfig } from '../src/organism/system/PhoneRuntimePolicy.ts';

const cfg = resolvePhonePolicyConfig({
  NEURO_PHONE_MODE: 'true',
  NEURO_RUNTIME_MODE: 'active',
  NEURO_INTERVAL_MS: '30000',
  NEURO_SENSOR_INTERVAL_MS: '60000',
});
assert.equal(cfg.mode, 'active');
assert.equal(cfg.baseIntervalMs, 30000);
assert.equal(cfg.samplerIntervalMs, 60000);

const nominal = choosePhonePolicyDelay({
  baseIntervalMs: 30000, mode: 'active', awake: true,
  battery01: .9, thermalStrain01: .2, ramPressure01: .3, cpuLoad01: .2,
  lastStepMs: 100, previousThermalStrain01: .2, consecutiveActiveCycles: 0,
});
assert.ok(nominal.nextDelayMs >= 30000);
assert.deepEqual(nominal.reasonCodes, ['nominal']);

const thermal = choosePhonePolicyDelay({
  baseIntervalMs: 30000, mode: 'active', awake: true,
  battery01: .8, thermalStrain01: .74, ramPressure01: .4, cpuLoad01: .3,
  lastStepMs: 100, previousThermalStrain01: .68, consecutiveActiveCycles: 1,
});
assert.ok(thermal.nextDelayMs > nominal.nextDelayMs);
assert.ok(thermal.reasonCodes.includes('thermal-rising'));
assert.ok(thermal.cognitiveBudget01 < 1);

const critical = choosePhonePolicyDelay({
  baseIntervalMs: 30000, mode: 'active', awake: false,
  battery01: .1, thermalStrain01: .85, ramPressure01: .92, cpuLoad01: .95,
  lastStepMs: 30000, previousThermalStrain01: .8, consecutiveActiveCycles: 3,
});
assert.ok(critical.nextDelayMs >= 300000);
assert.ok(critical.reasonCodes.includes('sleep'));
assert.ok(critical.reasonCodes.includes('low-battery'));
assert.ok(critical.reasonCodes.includes('thermal-rising') || critical.reasonCodes.includes('thermal-critical'));
assert.ok(critical.reasonCodes.includes('ram-pressure'));

console.log('P22_PHONE_RELIABILITY=PASS');
