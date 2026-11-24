import assert from 'node:assert/strict';
import { LocalEmbeddingProvider } from '../src/organism/developmental/LocalEmbeddingProvider.ts';

const sent = [];
const provider = new LocalEmbeddingProvider({
  kind: 'openai-compatible',
  baseUrl: 'https://embeddings.example.test/v1',
  model: 'privacy-fixture',
  allowRemote: true,
  fetchImpl: async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    sent.push(body);
    return { ok: true, status: 200, json: async () => ({ data: body.input.map((_, index) => ({ index, embedding: [1, index + 1, 0] })) }) };
  },
});
const raw = [
  'Contact Alice at alice@example.com; api_key=super_secret_value_123',
  'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature',
  'The dashboard URL is https://service-user:secret-pass@example.com/path?token=very-secret-token',
  'Call +31 6 12345678; reference 123456789012',
  'Science, humour and an open question are useful memories.',
];
const vectors = await provider.embedBatch(raw);
assert.equal(vectors.length, raw.length);
assert.equal(sent.length, 1);
const wire = JSON.stringify(sent);
for (const secret of ['alice@example.com', 'super_secret_value_123', 'eyJhbGciOiJIUzI1NiJ9.payload.signature', 'secret-pass', 'very-secret-token', '+31 6 12345678', '123456789012']) {
  assert.equal(wire.includes(secret), false, `sensitive value leaked to embedding endpoint: ${secret}`);
}
assert.match(wire, /REDACTED_EMAIL/);
assert.match(wire, /REDACTED_CREDENTIAL/);
assert.match(wire, /REDACTED_PHONE/);
assert.match(wire, /REDACTED_LONG_ID/);
assert.match(wire, /Science, humour and an open question/);
assert.ok(provider.diagnostics().redactedInputs >= 4);
console.log('WORKPASS56_EMBEDDING_PRIVACY=PASS', JSON.stringify({ inputs: raw.length, sanitizedInputs: provider.diagnostics().redactedInputs, wirePayloadContainsRawSensitiveValues: false }));
