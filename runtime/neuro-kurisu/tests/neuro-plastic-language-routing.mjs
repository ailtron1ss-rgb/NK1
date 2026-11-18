import assert from 'node:assert/strict';
import { neuroPlasticRouteForDecision } from '../src/organism/language/LanguageOrgan.ts';

const state = {
  needs: { uncertainty: 0.2, cognitiveLoad: 0.3 },
  selfPredictionError: 0.1,
};
assert.deepEqual(
  neuroPlasticRouteForDecision({ action: 'respond', confidence: 0.9 }, state),
  { domain: 'language', confidence01: 0.9, risk01: 0.2 },
);
assert.deepEqual(
  neuroPlasticRouteForDecision({ action: 'verify', confidence: 0.84 }, state),
  { domain: 'reasoning', confidence01: 0.84, risk01: 0.2 },
);
assert.deepEqual(
  neuroPlasticRouteForDecision({ action: 'reflect', confidence: 0.78 }, state),
  { domain: 'reasoning', confidence01: 0.78, risk01: 0.2 },
);
assert.deepEqual(
  neuroPlasticRouteForDecision({ action: 'explore', confidence: 0.8 }, state),
  { domain: 'exploration', confidence01: 0.8, risk01: 0.2 },
);
assert.equal(neuroPlasticRouteForDecision({ action: 'wait', confidence: 0.99 }, state), null);
assert.equal(neuroPlasticRouteForDecision({ action: 'defer', confidence: 0.99 }, state), null);
assert.equal(neuroPlasticRouteForDecision(null, state), null);
assert.equal(neuroPlasticRouteForDecision({ action: 'respond', confidence: 0.4 }, state).confidence01, 0.4);

const highRisk = neuroPlasticRouteForDecision(
  { action: 'respond', confidence: 0.96 },
  { needs: { uncertainty: 0.88, cognitiveLoad: 0.9 }, selfPredictionError: 0.45 },
);
assert.deepEqual(highRisk, { domain: 'language', confidence01: 0.96, risk01: 0.88 },
  'uncertainty must be forwarded so the registry can keep the adapter disabled for risky cycles');

const missingState = neuroPlasticRouteForDecision(
  { action: 'verify', confidence: 0.9 },
  { needs: {}, selfPredictionError: 0.1 },
);
assert.equal(missingState.risk01, 1, 'missing cognitive risk signals must fail closed');

console.log('NEURO_PLASTIC_LANGUAGE_ROUTING=PASS canonicalActionDomains=4 unsupportedActions=2 risk=fail-closed');
