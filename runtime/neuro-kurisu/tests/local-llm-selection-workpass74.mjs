import assert from 'node:assert/strict';
import { chooseLanguageBackend } from '../src/server/local-language-backend-policy.mjs';

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
console.log(JSON.stringify({ status: 'PASS', pass: 'local-llm-selection-workpass74', cases: 4 }));
