import assert from 'node:assert/strict';
import { redactHmxExportValue } from '../../src/organism/integration/hexis/HmxImportRedactor.ts';

const source = {
  hmx_version: '1.7',
  export_intent: 'port',
  sections: {
    identity: [{ content: 'Keep the Kurisu research identity label, but remove Contact privacy@example.invalid' }],
    memories: [{
      content: 'Bearer nk1-fixture-bearer-token-0123456789; api_key=assignment-secret-value-0123456789',
      notes: ['Database https://fixture-user:fixture-pass@example.invalid/db', 'Provider key sk-test-0123456789abcdefghijklmnop'],
    }],
    episodes: [{ summary: 'Private key -----BEGIN PRIVATE KEY-----fixture-material-----END PRIVATE KEY-----' }],
    clusters: [{ name: 'Call +1 (555) 123-4567' }],
  },
  counters: { count: 7, enabled: true, empty: null },
};

const redacted = redactHmxExportValue(source);
assert.equal(redacted.hmx_version, '1.7');
assert.equal(redacted.export_intent, 'port');
assert.equal(redacted.counters.count, 7);
assert.equal(redacted.counters.enabled, true);
assert.equal(redacted.counters.empty, null);
assert.match(redacted.sections.identity[0].content, /Kurisu research identity label/);
for (const secret of [
  'privacy@example.invalid',
  'nk1-fixture-bearer-token-0123456789',
  'sk-test-0123456789abcdefghijklmnop',
  'fixture-user:fixture-pass',
  'fixture-material',
  '+1 (555) 123-4567',
]) {
  assert.equal(JSON.stringify(redacted).includes(secret), false, `outbound HMX must redact ${secret}`);
}
for (const marker of [
  '[redacted:email-address]',
  '[redacted:bearer-token]',
  '[redacted:provider-token]',
  '[redacted:credential-url]',
  '[redacted:private-key]',
  '[redacted:phone-number]',
]) {
  assert.ok(JSON.stringify(redacted).includes(marker), `expected marker ${marker}`);
}

let getterCalls = 0;
const hostile = {};
Object.defineProperty(hostile, 'identity', {
  enumerable: true,
  get() { getterCalls += 1; throw new Error('must not execute accessor'); },
});
assert.throws(() => redactHmxExportValue(hostile), /accessor-invalid/);
assert.equal(getterCalls, 0, 'export snapshot must not execute getters');

const cyclic = {};
cyclic.self = cyclic;
assert.throws(() => redactHmxExportValue(cyclic), /cycle/);
assert.throws(() => redactHmxExportValue({ bad: () => 'not data' }), /unsupported-value/);

const bounded = redactHmxExportValue({ content: 'x'.repeat(20_000) });
assert.equal(bounded.content.length, 12_000, 'outbound field text must be bounded');

console.log('HEXIS_HMX_EXPORT_CONTRACT=PASS');
