import assert from 'node:assert/strict';
import { P2702PersistentPersonalityDynamics, defaultP2702PersistentPersonality } from '../src/organism/cognition/P2702PersistentPersonalityDynamics.ts';

const defaults = defaultP2702PersistentPersonality();
const original = new P2702PersistentPersonalityDynamics();
original.beforeDecision({
  tick: 12, novelty01: .8, uncertainty01: .3, goalPressure01: .6, identityGap01: .1,
  reward01: .9, actionUtilities: { respond: .7, explore: .9, verify: .8, rest: .2, reflect: .4, wait: .3, defer: .1 },
  relationshipId: 'user:primary',
});
original.afterOutcome({ tick: 12, reward01: .9, verified01: .95, predictionError01: .1, identityGap01: .1, action: 'explore', relationshipId: 'user:primary' });
const validSnapshot = original.snapshot();
const restored = new P2702PersistentPersonalityDynamics();
restored.restore(validSnapshot);
assert.deepEqual(restored.snapshot(), validSnapshot, 'valid personality state must round-trip exactly');

// Accessors, non-finite values, name/value misalignment and hostile keys must not enter identity state.
const corrupt = Object.create(null);
Object.defineProperty(corrupt, 'tick', { enumerable: true, get() { throw new Error('tick-getter-must-not-run'); } });
corrupt.experienceCount = -4;
corrupt.learningUpdates = Infinity;
corrupt.invariantNames = ['attacker-controlled-invariant'];
corrupt.invariantValues = [1];
corrupt.adaptiveNames = defaults.adaptiveNames.slice();
corrupt.adaptiveValues = [NaN];
corrupt.valueNames = defaults.valueNames.slice();
corrupt.valueWeights = defaults.valueWeights.slice(0, 2);
corrupt.selfBeliefs = [Infinity];
corrupt.selfUncertainty = [NaN];
corrupt.tensionState = [];
corrupt.stability01 = NaN;
corrupt.coherence01 = 4;
corrupt.identityContinuity01 = -1;
corrupt.drift01 = Infinity;
corrupt.lastReward01 = 1.4;
corrupt.relationshipTrust = Object.create(null);
corrupt.relationshipTrust['user:primary'] = 1.4;
Object.defineProperty(corrupt.relationshipTrust, '__proto__', { enumerable: true, value: 1 });
corrupt.relationshipTrust['bad key!'] = .9;
corrupt.actionPreference = Object.create(null);
corrupt.actionPreference.explore = 9;
corrupt.actionPreference.respond = '1';
Object.defineProperty(corrupt.actionPreference, '__proto__', { enumerable: true, value: { verify: 1 } });

const hardened = new P2702PersistentPersonalityDynamics();
hardened.restore(corrupt);
const state = hardened.snapshot();
assert.equal(state.tick, defaults.tick);
assert.equal(state.experienceCount, 0);
assert.equal(state.learningUpdates, 0);
assert.deepEqual(state.invariantNames, defaults.invariantNames);
assert.deepEqual(state.invariantValues, defaults.invariantValues);
assert.deepEqual(state.adaptiveValues, defaults.adaptiveValues);
assert.deepEqual(state.valueWeights, defaults.valueWeights);
assert.deepEqual(state.selfBeliefs, defaults.selfBeliefs);
assert.deepEqual(state.selfUncertainty, defaults.selfUncertainty);
assert.deepEqual(state.tensionState, defaults.tensionState);
assert.equal(state.stability01, defaults.stability01);
assert.equal(state.coherence01, 1);
assert.equal(state.identityContinuity01, 0);
assert.equal(state.drift01, defaults.drift01);
assert.equal(state.lastReward01, 1);
assert.equal(state.relationshipTrust['user:primary'], 1);
assert.equal(Object.keys(state.relationshipTrust).length, 1);
assert.equal(state.actionPreference.explore, 1);
assert.equal(state.actionPreference.respond, 0);

const revoked = Proxy.revocable({}, {});
revoked.revoke();
const proxyRestore = new P2702PersistentPersonalityDynamics();
proxyRestore.restore(revoked.proxy);
assert.deepEqual(proxyRestore.snapshot(), defaults, 'revoked proxies must restore defaults');

console.log(JSON.stringify({ pass: 'p2702-personality-restore-integrity', status: 'PASS', validRoundTrip: true, getterIsolation: true, canonicalNameLock: true, boundedVectors: true, hostileKeyIsolation: true, revokedProxyFallback: true }, null, 2));
