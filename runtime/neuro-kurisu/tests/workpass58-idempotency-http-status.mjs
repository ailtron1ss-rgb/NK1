import assert from 'node:assert/strict';
import { idempotencyPreflightHttpStatus } from '../src/server/idempotency-response.mjs';

assert.equal(idempotencyPreflightHttpStatus({ idempotencyRequired: true, result: { error: 'idempotency-key-invalid' } }), 400,
    'malformed explicit idempotency key is a bad request, not a missing precondition');
assert.equal(idempotencyPreflightHttpStatus({ idempotencyRequired: true, outcomeClass: 'idempotency-key-required' }), 428,
    'missing stable key is a precondition required response');
assert.equal(idempotencyPreflightHttpStatus({ idempotencyRequired: false, ok: false }), null,
    'ordinary action failure is handled by its endpoint contract');
assert.equal(idempotencyPreflightHttpStatus({ ok: true }), null,
    'successful result does not override endpoint success handling');
console.log('WORKPASS58_IDEMPOTENCY_HTTP_STATUS=PASS', JSON.stringify({ invalidKey: 400, missingKey: 428, ordinaryFailure: 'unchanged' }));
