import assert from 'node:assert/strict';
import {
  isSafeLearningIdentity,
  snapshotPlainDataEnvelope,
} from '../src/organism/learning/LearningTrustBoundary.ts';

assert.equal(isSafeLearningIdentity('learning-source:verified-outcome'), true);
assert.equal(isSafeLearningIdentity('', 256), false);
assert.equal(isSafeLearningIdentity(' padded ', 256), false);
assert.equal(isSafeLearningIdentity('bad\nidentity', 256), false);
assert.equal(isSafeLearningIdentity('ｅvidence', 256), false, 'non-canonical Unicode must not create alternate identities');

let capabilityCalls = 0;
const execute = () => { capabilityCalls++; return 'executed'; };
const envelope = Object.create(null);
Object.defineProperties(envelope, {
  id: { value: 'source-1', enumerable: true },
  evidence: { value: { verified: true, score: 0.9 }, enumerable: true },
  execute: { value: execute, enumerable: true },
});
const result = snapshotPlainDataEnvelope(envelope, ['execute']);
assert.deepEqual({ ...result.data }, { id: 'source-1', evidence: { verified: true, score: 0.9 } });
assert.equal(result.capabilities.execute, execute, 'approved capability identity must be retained');
assert.equal(capabilityCalls, 0, 'snapshotting a capability must never execute it');
assert.equal(Object.getPrototypeOf(result.data), null, 'detached record must not inherit object prototype');
assert.equal(Object.getPrototypeOf(result.capabilities), null, 'capability record must not inherit object prototype');

let getterCalls = 0;
const accessorEnvelope = {};
Object.defineProperty(accessorEnvelope, 'evidence', {
  enumerable: true,
  get() { getterCalls++; return { verified: true }; },
});
assert.throws(() => snapshotPlainDataEnvelope(accessorEnvelope), /learning-trust-envelope-accessor-invalid/);
assert.equal(getterCalls, 0, 'untrusted accessors must be rejected without invocation');
assert.throws(() => snapshotPlainDataEnvelope(new Date()), /learning-trust-envelope-prototype-invalid/);
assert.throws(() => snapshotPlainDataEnvelope({ execute: 42 }, ['execute']), /learning-trust-envelope-capability-invalid/);
const symbolEnvelope = { id: 'source-2' };
symbolEnvelope[Symbol('hidden')] = true;
assert.throws(() => snapshotPlainDataEnvelope(symbolEnvelope), /learning-trust-envelope-symbol-key-invalid/);

console.log(JSON.stringify({ pass: true, safeIdentity: true, capabilityCalls, getterCalls }));
