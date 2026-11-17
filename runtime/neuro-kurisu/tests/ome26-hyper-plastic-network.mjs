import assert from 'node:assert/strict';
import * as backendPolicy from '../src/server/local-language-backend-policy.mjs';

// Regression contract: a backend that has not explicitly advertised LoRA
// support must stay on the ordinary model path, even when a candidate exists.
assert.equal(
  typeof backendPolicy.resolveHyperPlasticAdapterRoute,
  'function',
  'the language backend boundary must expose the fail-closed Hyper-Plastic route resolver',
);

const route = backendPolicy.resolveHyperPlasticAdapterRoute({
  backendCapabilities: { supportsLowRankAdapters: false },
  baseModelFingerprint: 'base-model-sha256',
  adapter: { fingerprint: 'adapter-sha256', baseModelFingerprint: 'base-model-sha256' },
  promotionPermit: { eligible: true },
});

assert.deepEqual(route, {
  mode: 'baseline',
  reason: 'backend-adapter-capability-unavailable',
});
console.log('OME26_HYPER_PLASTIC_NETWORK=PASS', JSON.stringify({ route: route.mode, reason: route.reason }));
