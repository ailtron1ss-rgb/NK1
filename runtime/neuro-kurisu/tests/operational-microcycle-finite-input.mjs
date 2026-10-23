import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { OperationalMicroCycleRuntime, finiteOr } from '../src/organism/core/OperationalMicroCycleRuntime.ts';

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
const runtimeSource = await readFile(new URL('../src/organism/core/OperationalMicroCycleRuntime.ts', import.meta.url), 'utf8');
for (const guardedBoundary of [
  'clamp(finiteOr(body?.bodyEnergy01, state.needs.energy))',
  'clamp(finiteOr(body?.cognitiveCapacity01, 1 - state.needs.cognitiveLoad))',
  'clamp(finiteOr(body?.thermalStrain01, state.needs.cognitiveLoad))',
  'clamp(finiteOr(observation.surprise, state.predictionError))',
  'finiteOr(body?.battery01, state.needs.energy)',
  'finiteOr(body?.sensoryFreshness01, 0.8)',
  'finiteOr(body?.cpuLoad01, state.needs.cognitiveLoad)',
  'finiteOr(body?.ramPressure01, microResource.ramPressure01)',
]) {
  assert.ok(runtimeSource.includes(guardedBoundary), `micro-cycle must normalize ${guardedBoundary}`);
}
// Invalid entry-point payloads must be rejected before host context acquisition/state mutation.
let contextReads = 0;
const guardedRuntime = new OperationalMicroCycleRuntime(() => {
  contextReads++;
  throw new Error('host context must not be requested for invalid observations');
});
for (const invalidObservation of [null, undefined, [], 'invalid', 42, true]) {
  await assert.rejects(
    () => guardedRuntime.run(invalidObservation),
    /cognitive-cycle-observation-must-be-object/,
    'malformed operational observations must fail at the shared boundary',
  );
}
assert.equal(contextReads, 0, 'rejected payloads must not acquire or mutate host runtime state');

console.log('OperationalMicroCycleRuntime boundary wiring passed');
console.log('OperationalMicroCycleRuntime finite input contract passed');
