import assert from 'node:assert/strict';
import { sanitizeActionAuditValue } from '../src/organism/system/ActionAuditRedaction.ts';

const source = {
  operation: 'upload',
  authorization: 'Bearer top-secret-auth',
  nested: {
    api_key: 'sk-live-abcdefghijklmnop',
    refreshToken: 'refresh-secret',
    note: 'request ?token=private-value and ghp_abcdefghijklmnopqrstuvwx',
    bearer: 'Bearer another-secret-token',
    safe: 'ordinary diagnostic',
  },
  list: [{ password: 'hidden' }, { status: 'ok' }],
};
const sanitized = sanitizeActionAuditValue(source);
assert.equal(sanitized.authorization, '[REDACTED]');
assert.equal(sanitized.nested.api_key, '[REDACTED]');
assert.equal(sanitized.nested.refreshToken, '[REDACTED]');
assert.match(sanitized.nested.note, /\[REDACTED\]/);
assert.doesNotMatch(JSON.stringify(sanitized), /top-secret-auth|abcdefghijklmnop|private-value|refresh-secret|another-secret-token/);
assert.equal(sanitized.nested.safe, 'ordinary diagnostic');
assert.equal(sanitized.list[0].password, '[REDACTED]');

let getterCalls = 0;
const accessor = {};
Object.defineProperty(accessor, 'credential', { enumerable: true, get() { getterCalls++; return 'must-not-run'; } });
const accessorResult = sanitizeActionAuditValue(accessor);
assert.equal(getterCalls, 0);
assert.equal(accessorResult.credential, '[accessor-omitted]');
const arrayAccessor = [];
Object.defineProperty(arrayAccessor, '0', { enumerable: true, get() { getterCalls++; return 'must-not-run'; } });
arrayAccessor.length = 1;
assert.equal(sanitizeActionAuditValue(arrayAccessor)[0], '[accessor-omitted]');
assert.equal(getterCalls, 0);

const cyclic = { label: 'safe' };
cyclic.self = cyclic;
assert.equal(sanitizeActionAuditValue(cyclic).self, '[circular]');
assert.equal(sanitizeActionAuditValue({ huge: 'x'.repeat(5000) }).huge.length, 1200);
const hostileKey = JSON.parse('{"__proto__":{"polluted":true},"safe":"ok"}');
const hostileOutput = sanitizeActionAuditValue(hostileKey);
assert.equal(Object.getPrototypeOf(hostileOutput), null);
assert.equal(hostileOutput.safe, 'ok');
assert.equal(Object.prototype.polluted, undefined);
console.log('ActionGateway audit redaction: PASS');
