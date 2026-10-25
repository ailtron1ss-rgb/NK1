import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { finiteOr, normalizeOperationalMicroCycleSensors } from '../src/organism/core/OperationalMicroCycleRuntime.ts';

assert.equal(finiteOr(0.4, 0.2), 0.4);
assert.equal(finiteOr('0.7', 0.2), 0.7);
for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null, undefined, true, false, '', '   ', 'nope']) {
  assert.equal(finiteOr(invalid, 0.2), 0.2, `invalid value ${String(invalid)} should use fallback`);
}
assert.equal(finiteOr('0', 0.2), 0);
assert.equal(finiteOr(-2, 0.2), -2);
for (const invalidFallback of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
  assert.equal(finiteOr(null, invalidFallback), 0, 'invalid fallback must not leak a non-finite value');
  assert.equal(finiteOr('bad', invalidFallback), 0, 'invalid fallback must remain safe for invalid inputs');
}

const fallback = { energy: 0.4, cognitiveLoad: 0.3, ramPressure: 0.2 };
assert.deepEqual(normalizeOperationalMicroCycleSensors(null, fallback), {
  awake: true,
  bodyEnergy01: 0.4,
  cognitiveCapacity01: 0.7,
  thermalStrain01: 0.3,
  battery01: 0.4,
  sensoryFreshness01: 0.8,
  cpuLoad01: 0.3,
  ramPressure01: 0.2,
});

const bounded = normalizeOperationalMicroCycleSensors({
  awake: false,
  bodyEnergy01: 1.4,
  cognitiveCapacity01: -0.5,
  thermalStrain01: 0.66,
  battery01: Number.NaN,
  sensoryFreshness01: -2,
  cpuLoad01: '0.7',
  ramPressure01: 22,
}, fallback);
assert.deepEqual(bounded, {
  awake: false,
  bodyEnergy01: 1,
  cognitiveCapacity01: 0,
  thermalStrain01: 0.66,
  battery01: 0.4,
  sensoryFreshness01: 0,
  cpuLoad01: 0.7,
  ramPressure01: 1,
});

const fieldFallbacks = {
  bodyEnergy01: 0.4,
  cognitiveCapacity01: 0.7,
  thermalStrain01: 0.3,
  battery01: 0.4,
  sensoryFreshness01: 0.8,
  cpuLoad01: 0.3,
  ramPressure01: 0.2,
};
const invalidSensorValues = [
  Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
  null, undefined, true, false, '', '   ', 'not-a-number', {}, [],
];
for (const [field, expected] of Object.entries(fieldFallbacks)) {
  for (const invalid of invalidSensorValues) {
    const actual = normalizeOperationalMicroCycleSensors({ [field]: invalid }, fallback);
    assert.equal(actual[field], expected, 'invalid ' + field + '=' + String(invalid) + ' should use its safe fallback');
  }
}
for (const invalidAwake of [null, undefined, 0, 1, 'false', {}, []]) {
  assert.equal(normalizeOperationalMicroCycleSensors({ awake: invalidAwake }, fallback).awake, true);
}

const inheritedSensors = Object.create({ awake: false, battery01: 0.01, bodyEnergy01: 0.01 });
assert.equal(normalizeOperationalMicroCycleSensors(inheritedSensors, fallback).awake, true);
assert.equal(normalizeOperationalMicroCycleSensors(inheritedSensors, fallback).battery01, fallback.energy);
assert.equal(normalizeOperationalMicroCycleSensors(inheritedSensors, fallback).bodyEnergy01, fallback.energy);

const throwingSensor = {};
Object.defineProperty(throwingSensor, 'battery01', {
  enumerable: true,
  get() { throw new Error('sensor getter must not escape the boundary'); },
});
assert.equal(normalizeOperationalMicroCycleSensors(throwingSensor, fallback).battery01, fallback.energy);
assert.equal(normalizeOperationalMicroCycleSensors(Object.assign([], { battery01: 0.01 }), fallback).battery01, fallback.energy);

const invalidFallbacks = normalizeOperationalMicroCycleSensors({
  bodyEnergy01: 'bad',
  cognitiveCapacity01: 'bad',
  thermalStrain01: 'bad',
  battery01: 'bad',
  cpuLoad01: 'bad',
  ramPressure01: 'bad',
}, { energy: Number.NaN, cognitiveLoad: Number.POSITIVE_INFINITY, ramPressure: Number.NaN });
assert.deepEqual(invalidFallbacks, {
  awake: true,
  bodyEnergy01: 0,
  cognitiveCapacity01: 1,
  thermalStrain01: 0,
  battery01: 0,
  sensoryFreshness01: 0.8,
  cpuLoad01: 0,
  ramPressure01: 0,
});

const runtimeSource = await readFile(new URL('../src/organism/core/OperationalMicroCycleRuntime.ts', import.meta.url), 'utf8');
for (const guardedBoundary of [
  "assertCognitiveCycleBoundaryInput(observation, 'operational');",
  "normalizeOperationalMicroCycleSensors(ownSensorValue(observation, 'embodiment')",
  'const targetEnergy = sensors.bodyEnergy01;',
  'const targetCapacity = sensors.cognitiveCapacity01;',
  'const thermal = sensors.thermalStrain01;',
  'awake: sensors.awake,',
  'battery01: sensors.battery01,',
  'thermal01: sensors.thermalStrain01,',
  'stress01: 1 - targetCapacity,',
  'sensors.battery01,',
  'sensors.sensoryFreshness01,',
  'sensors.cpuLoad01,',
  'sensors.ramPressure01,',
  'sensorFreshness01: sensors.sensoryFreshness01,',
]) {
  assert.ok(runtimeSource.includes(guardedBoundary), 'micro-cycle must use normalized boundary value ' + guardedBoundary);
}
const validationAt = runtimeSource.indexOf("assertCognitiveCycleBoundaryInput(observation, 'operational');");
const hostAt = runtimeSource.indexOf('const host = this.contextProvider();');
assert.ok(validationAt >= 0 && hostAt > validationAt, 'observation validation must precede host access and state mutation');
assert.ok(!runtimeSource.includes('battery01: body?.battery01'), 'raw battery input must never reach life-continuity engine');
assert.ok(!runtimeSource.includes('thermal01: body?.thermalStrain01'), 'raw thermal input must never reach life-continuity engine');
assert.ok(!runtimeSource.includes('awake: body?.awake'), 'raw awake input must never reach life-continuity engine');

console.log('OperationalMicroCycleRuntime boundary wiring passed');
console.log('OperationalMicroCycleRuntime finite input contract passed');
