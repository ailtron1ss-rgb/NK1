import assert from 'node:assert/strict';
import {
  HMX_EXPORT_EXCLUDED_SECRET_PATTERNS,
  redactHmxExportText,
} from '../src/organism/integration/hexis/HmxExportRedactor.ts';

const privateKey = '-----BEGIN PRIVATE KEY-----\\nfixture-private-key-material\\n-----END PRIVATE KEY-----';
const source = [
  privateKey,
  'Authorization: Bearer nk1-fixture-bearer-token-0123456789',
  'api_key=sk-test-0123456789abcdefghijklmnop',
  'Standalone provider token sk-other-0123456789abcdefghijklmnop',
  'GitHub token github_pat_fixture_0123456789abcdef',
  'AWS key AKIA1234567890ABCDEF',
  'JWT eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.signature-fixture-012345',
  'Database URL https://fixture-user:fixture-pass@example.invalid/db',
  'Contact fixture.person@example.invalid or +1 (555) 123-4567',
  'password: "fixture-password-value"',
].join(' | ');

const redacted = redactHmxExportText(source);
for (const secret of [
  'fixture-private-key-material',
  'nk1-fixture-bearer-token-0123456789',
  'sk-test-0123456789abcdefghijklmnop',
  'sk-other-0123456789abcdefghijklmnop',
  'github_pat_fixture_0123456789abcdef',
  'AKIA1234567890ABCDEF',
  'fixture-user:fixture-pass',
  'fixture.person@example.invalid',
  '+1 (555) 123-4567',
  'fixture-password-value',
]) {
  assert.equal(redacted.includes(secret), false, `export must not retain known secret fixture: ${secret}`);
}
for (const marker of [
  '[redacted:private-key]',
  '[redacted:bearer-token]',
  '[redacted:provider-token]',
  '[redacted:github-token]',
  '[redacted:aws-access-key]',
  '[redacted:credential-url]',
  '[redacted:email-address]',
  '[redacted:phone-number]',
  '[redacted:secret-assignment]',
]) {
  assert.ok(redacted.includes(marker), `expected redaction marker ${marker}`);
}
assert.ok(HMX_EXPORT_EXCLUDED_SECRET_PATTERNS.includes('private-key'));
assert.ok(HMX_EXPORT_EXCLUDED_SECRET_PATTERNS.includes('email-address'));
assert.equal(
  redactHmxExportText('hippocampal replay and synaptic plasticity remain intact'),
  'hippocampal replay and synaptic plasticity remain intact',
  'ordinary research content must survive the pattern screen unchanged',
);
assert.equal(redactHmxExportText('abcdef', 3), 'abc', 'export text must remain bounded');
console.log('HEXIS_HMX_EXPORT_REDACTION=PASS');
