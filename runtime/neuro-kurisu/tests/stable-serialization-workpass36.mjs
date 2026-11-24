import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256Stable, stableJson, stableLegacyJson } from '../src/organism/core/StableSerialization.ts';

const a = { z: 2, nested: { y: 3, x: 1 }, first: '東京' };
const b = { first: '東京', nested: { x: 1, y: 3 }, z: 2 };
assert.equal(stableJson(a), stableJson(b), 'JSON-mode keys must be order independent');
assert.equal(sha256Stable(a), sha256Stable(b), 'JSON-mode digests must be order independent');
assert.equal(stableJson({ b: undefined, a: [undefined, null, 1] }), '{"a":[null,null,1]}', 'JSON-mode must retain JSON undefined semantics');
assert.equal(stableJson(new Date('2020-01-01T00:00:00.000Z')), '"2020-01-01T00:00:00.000Z"', 'Date toJSON contract must be preserved');
assert.throws(() => stableJson(undefined), /not JSON-serializable/, 'top-level undefined must be rejected explicitly');
const circular = {}; circular.self = circular;
assert.throws(() => stableJson(circular), /circular|cyclic/i, 'circular payloads must be rejected');

// Verify the legacy encoding preserves byte-level fingerprint compatibility, including its historic undefined token.
const legacyInput = { z: 2, missing: undefined, nested: { b: true, a: [1, 'x'] } };
const expectedLegacy = '{"missing":undefined,"nested":{"a":[1,"x"],"b":true},"z":2}';
assert.equal(stableLegacyJson(legacyInput), expectedLegacy);
assert.equal(sha256Stable(legacyInput, 'legacy'), createHash('sha256').update(expectedLegacy).digest('hex'));
assert.equal(sha256Stable(a, 'legacy'), sha256Stable(b, 'legacy'), 'legacy mode still sorts nested keys');
console.log('STABLE_SERIALIZATION_WORKPASS36=PASS', JSON.stringify({ jsonKeyOrder:'stable', legacyFingerprint:'byte-compatible', undefinedModes:'explicit', circular:'rejected' }));
