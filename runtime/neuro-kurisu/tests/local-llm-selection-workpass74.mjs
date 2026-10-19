import assert from 'node:assert/strict';
import { chooseLanguageBackend, LocalLanguageBackendPolicy } from '../src/server/local-language-backend-policy.mjs';

assert.equal(
  chooseLanguageBackend({ localLlamaConfigured: true, ecologyPreferredBackend: 'gemini' }),
  'llama.cpp',
  'configured local llama.cpp must be the first-choice backend even when ecology otherwise prefers cloud',
);
assert.equal(
  chooseLanguageBackend({ localLlamaConfigured: false, ecologyPreferredBackend: 'kobold' }),
  'kobold',
  'without a configured local endpoint the ecology decision remains authoritative',
);
assert.equal(
  chooseLanguageBackend({ localLlamaConfigured: false, ecologyPreferredBackend: 'local-fallback' }),
  'local-fallback',
  'deterministic degraded fallback remains distinguishable from generated output',
);
assert.equal(
  chooseLanguageBackend({ localLlamaConfigured: true, ecologyPreferredBackend: 'local-fallback' }),
  'llama.cpp',
  'a configured local model must not be bypassed by the deterministic fallback',
);
const circuit = new LocalLanguageBackendPolicy({ baseCooldownMs: 1000, maxCooldownMs: 4000 });
assert.equal(circuit.select({ localLlamaConfigured: true, ecologyPreferredBackend: 'gemini', now: 100 }), 'llama.cpp');
circuit.observe({ backend: 'gemini:model', failures: ['llama.cpp:connect-failed'], now: 100 });
assert.equal(circuit.select({ localLlamaConfigured: true, ecologyPreferredBackend: 'kobold', now: 500 }), 'kobold',
  'a failed local endpoint must not be retried before its cooldown expires');
assert.equal(circuit.select({ localLlamaConfigured: true, ecologyPreferredBackend: 'kobold', now: 1100 }), 'llama.cpp',
  'local endpoint may be retried after cooldown');
circuit.observe({ backend: 'llama.cpp:local-model', failures: [], now: 1200 });
assert.equal(circuit.snapshot().consecutiveFailures, 0, 'a real local response clears the failure streak');
assert.equal(circuit.snapshot().cooldownUntil, 0, 'a real local response clears cooldown');
console.log(JSON.stringify({ status: 'PASS', pass: 'local-llm-selection-workpass74', cases: 9 }));
