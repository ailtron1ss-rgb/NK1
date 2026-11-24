import assert from 'node:assert/strict';
import { LocalLanguageBackendPolicy } from '../src/server/local-language-backend-policy.mjs';

const policy = new LocalLanguageBackendPolicy();
assert.equal(
  policy.select({ localLlamaConfigured: true, ecologyPreferredBackend: 'gemini', now: 100 }),
  'llama.cpp',
  'configured local llama.cpp must be first choice when not cooling down',
);
assert.equal(
  policy.select({ localLlamaConfigured: false, ecologyPreferredBackend: 'kobold', now: 100 }),
  'kobold',
  'without a configured local endpoint the ecology decision remains authoritative',
);
assert.equal(
  policy.select({ localLlamaConfigured: false, ecologyPreferredBackend: 'local-fallback', now: 100 }),
  'local-fallback',
  'deterministic degraded fallback remains distinguishable from generated output',
);
assert.equal(
  policy.select({ localLlamaConfigured: true, ecologyPreferredBackend: 'local-fallback', now: 100 }),
  'llama.cpp',
  'a configured model must not be bypassed by deterministic fallback',
);

const circuit = new LocalLanguageBackendPolicy({ baseCooldownMs: 1000, maxCooldownMs: 2500 });
assert.equal(circuit.select({ localLlamaConfigured: true, ecologyPreferredBackend: 'gemini', now: 1000 }), 'llama.cpp');
let state = circuit.observe({ backend: 'gemini:model', failures: ['llama.cpp:connect-failed'], now: 1000 });
assert.deepEqual(state, { consecutiveFailures: 1, cooldownUntil: 2000, coolingDown: true });
assert.equal(circuit.select({ localLlamaConfigured: true, ecologyPreferredBackend: 'kobold', now: 1999 }), 'kobold',
  'failed local endpoint must not be retried before cooldown expiry');
assert.equal(circuit.select({ localLlamaConfigured: true, ecologyPreferredBackend: 'kobold', now: 2000 }), 'llama.cpp',
  'local endpoint may be retried exactly at cooldown expiry');

state = circuit.observe({ backend: 'kobold', failures: ['llama.cpp:timeout'], now: 2000 });
assert.deepEqual(state, { consecutiveFailures: 2, cooldownUntil: 4000, coolingDown: true },
  'consecutive failures must double the cooldown');
state = circuit.observe({ backend: 'kobold', failures: ['llama.cpp:timeout'], now: 4000 });
assert.deepEqual(state, { consecutiveFailures: 3, cooldownUntil: 6500, coolingDown: true },
  'cooldown must stop growing at the configured maximum');
assert.equal(circuit.snapshot({ now: 6500 }).coolingDown, false, 'cooldown status must be deterministic at the deadline');
circuit.observe({ backend: 'llama.cpp:local-model', failures: [], now: 6600 });
assert.deepEqual(circuit.snapshot({ now: 6600 }), { consecutiveFailures: 0, cooldownUntil: 0, coolingDown: false },
  'a successful local response clears failure streak and cooldown');
circuit.observe({ backend: 'kobold', failures: ['kobold:timeout'], now: 7000 });
assert.deepEqual(circuit.snapshot({ now: 7000 }), { consecutiveFailures: 0, cooldownUntil: 0, coolingDown: false },
  'unrelated provider failures must not alter the local endpoint circuit');

console.log(JSON.stringify({ status: 'PASS', pass: 'local-llm-selection-workpass74', cases: 13 }));
