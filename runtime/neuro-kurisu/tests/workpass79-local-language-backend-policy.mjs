import assert from 'node:assert/strict';
import { LocalLanguageBackendPolicy } from '../src/server/local-language-backend-policy.mjs';

const policy = new LocalLanguageBackendPolicy({ baseCooldownMs: 1_000, maxCooldownMs: 8_000 });
const preferred = { localLlamaConfigured: true, ecologyPreferredBackend: 'remote-preferred' };

assert.equal(policy.select({ ...preferred, now: 10_000 }), 'llama.cpp',
  'a configured, healthy local provider should win over an ecology preference');

const firstFailure = policy.observe({
  backend: 'deterministic-policy-fallback',
  failures: ['llama.cpp: ECONNREFUSED'],
  now: 10_000,
});
assert.deepEqual(firstFailure, { consecutiveFailures: 1, cooldownUntil: 11_000, coolingDown: true });
assert.equal(policy.select({ ...preferred, now: 10_500 }), 'remote-preferred',
  'the configured local provider must not be selected while cooling down');
assert.equal(policy.select({ ...preferred, now: 11_000 }), 'llama.cpp',
  'the local provider becomes eligible exactly when cooldown expires');

const secondFailure = policy.observe({
  backend: 'deterministic-policy-fallback',
  failures: ['llama.cpp: timeout'],
  now: 12_000,
});
assert.deepEqual(secondFailure, { consecutiveFailures: 2, cooldownUntil: 14_000, coolingDown: true },
  'consecutive failures should use bounded exponential backoff');
const thirdFailure = policy.observe({
  backend: 'deterministic-policy-fallback',
  failures: ['llama.cpp: timeout'],
  now: 15_000,
});
assert.equal(thirdFailure.cooldownUntil, 19_000);
assert.equal(thirdFailure.consecutiveFailures, 3);

const unrelatedFailure = policy.observe({
  backend: 'remote-provider',
  failures: ['remote-provider: 503'],
  now: 15_500,
});
assert.equal(unrelatedFailure.consecutiveFailures, 3,
  'an unrelated provider failure must not be attributed to llama.cpp');
assert.equal(unrelatedFailure.cooldownUntil, 19_000);

const recovered = policy.observe({
  backend: 'llama.cpp:local-model',
  failures: [],
  now: 20_000,
});
assert.deepEqual(recovered, { consecutiveFailures: 0, cooldownUntil: 0, coolingDown: false },
  'a real successful local response clears the circuit-breaker state');
assert.equal(policy.select({ ...preferred, now: 20_001 }), 'llama.cpp');

const unconfigured = policy.select({
  localLlamaConfigured: false,
  ecologyPreferredBackend: 'remote-preferred',
  now: 20_001,
});
assert.equal(unconfigured, 'remote-preferred');

console.log('WORKPASS79_LOCAL_LANGUAGE_BACKEND_POLICY=PASS', JSON.stringify({
  assertions: 12,
  cooldownSequenceMs: [1_000, 2_000, 4_000],
  unrelatedFailuresDoNotPoisonLocalHealth: true,
  successfulLocalResponseResetsCircuit: true,
}));
