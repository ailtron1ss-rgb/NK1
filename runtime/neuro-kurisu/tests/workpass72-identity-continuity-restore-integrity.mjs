import assert from 'node:assert/strict';
import { IdentityContinuityGuard, defaultIdentityContinuityGuard } from '../src/organism/system/IdentityContinuityGuard.ts';

/**
 * WorkPass72 — identity-continuity restore integrity.
 *
 * `IdentityContinuityGuard.restore` previously spread the persisted snapshot
 * straight into live state. Because `meanContinuity01` feeds a multiplicative EMA
 * (`meanContinuity01*.93 + stability*.07`), a single NaN in the snapshot poisons
 * identity continuity forever. A hostile accessor on the snapshot also threw out
 * of restore. This asserts the sanitized contract.
 */

const guard = new IdentityContinuityGuard();
const fallback = defaultIdentityContinuityGuard();

// 1. NaN / Infinity / negative / non-numeric fields are rejected to defaults.
guard.restore({
  version: 1,
  checks: NaN,
  stable: -5,
  rejected: Infinity,
  revisionWindows: 'not-a-number',
  meanContinuity01: NaN,
  meanBoundarySafety01: 42,
  lastReason: '   ',
  lastAt: -100,
});
const sanitized = guard.snapshot();
assert.ok(Number.isFinite(sanitized.meanContinuity01), 'meanContinuity01 must stay finite');
assert.equal(sanitized.meanContinuity01, fallback.meanContinuity01, 'NaN continuity must fall back to default');
assert.ok(Number.isFinite(sanitized.meanBoundarySafety01) && sanitized.meanBoundarySafety01 <= 1, 'boundary safety clamped');
assert.ok(sanitized.checks >= 0 && Number.isFinite(sanitized.checks), 'checks must be a non-negative finite count');
assert.equal(sanitized.stable, 0, 'negative count must clamp to 0');
assert.ok(Number.isFinite(sanitized.rejected) && sanitized.rejected >= 0, 'Infinity count must clamp to finite');
assert.equal(sanitized.revisionWindows, fallback.revisionWindows, 'non-numeric count must fall back');
assert.equal(sanitized.lastReason, fallback.lastReason, 'blank reason must fall back');
assert.equal(sanitized.lastAt, 0, 'negative timestamp must clamp to 0');

// 2. The continuity EMA must stay finite after a poisoned restore.
const evaluated = guard.evaluate({ at: 10, identity01: .9, valueStability01: .9, narrative01: .9, projectContinuity01: .9, externalPressure01: .1, proposedRevision01: .2, verifiedEvidence01: .7 });
assert.ok(Number.isFinite(evaluated.continuity01), 'evaluate must produce finite continuity');
assert.ok(Number.isFinite(guard.snapshot().meanContinuity01), 'EMA must remain finite after a poisoned restore');

// 3. A hostile accessor must not throw out of restore.
const hostile = { version: 1, get checks() { throw new Error('hostile getter'); } };
assert.doesNotThrow(() => guard.restore(hostile), 'restore must survive a throwing accessor');
assert.ok(Number.isFinite(guard.snapshot().meanContinuity01), 'state must remain valid after hostile input');

// 4. Null / undefined / primitives fall back to a clean default.
for (const bad of [null, undefined, 7, 'x', []]) {
  guard.restore(bad);
  const s = guard.snapshot();
  assert.equal(s.meanContinuity01, fallback.meanContinuity01);
  assert.equal(s.checks, fallback.checks);
}

// 5. A valid snapshot round-trips exactly.
const valid = { version: 1, checks: 12, stable: 9, rejected: 3, revisionWindows: 2, meanContinuity01: .64, meanBoundarySafety01: .71, lastReason: 'identity-coherent', lastAt: 12345 };
guard.restore(valid);
assert.deepEqual(guard.snapshot(), valid, 'valid snapshot must round-trip unchanged');

console.log('WORKPASS72_IDENTITY_CONTINUITY_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, sanitized: true, roundTrip: true }));
