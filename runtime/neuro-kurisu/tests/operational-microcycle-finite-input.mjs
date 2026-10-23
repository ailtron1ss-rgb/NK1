import assert from 'node:assert/strict';
import { finiteOr } from '../src/organism/core/OperationalMicroCycleRuntime.ts';

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
console.log('OperationalMicroCycleRuntime finite input contract passed');
