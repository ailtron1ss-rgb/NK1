import assert from 'node:assert/strict';
import {
  B299CausalPersonalityDevelopmentLoop,
  defaultB299State,
} from '../src/organism/system/B299CausalPersonalityDevelopmentLoop.ts';

const seeded = () => {
  const state = defaultB299State();
  for (const phenotype of state.actionPhenotypes) {
    phenotype.evidence01 = 1;
    phenotype.causalConfidence01 = 1;
    phenotype.stability01 = 1;
  }
  for (const trait of Object.keys(state.traitFast11)) {
    state.traitFast11[trait] = 0;
    state.traitSlow11[trait] = 0;
    state.traitEvidence01[trait] = 0;
  }
  return state;
};

// An action can have mature phenotype evidence, but an unsupported trait must
// still contribute exactly zero to the action bias.
const unsupported = seeded();
unsupported.traitFast11['truth-seeking'] = .95;
unsupported.traitSlow11['truth-seeking'] = .92;
const noEvidence = new B299CausalPersonalityDevelopmentLoop();
noEvidence.restore(unsupported);
assert.equal(noEvidence.actionBias('verify'), 0,
  'unsupported trait weights must not influence action selection');
assert.equal(noEvidence.actionBias('explore'), 0,
  'a truth-seeking trait must not leak into unrelated curiosity action selection');

const partial = structuredClone(unsupported);
partial.traitEvidence01['truth-seeking'] = .16;
const partialLoop = new B299CausalPersonalityDevelopmentLoop();
partialLoop.restore(partial);
const partialBias = partialLoop.actionBias('verify');

const supported = structuredClone(unsupported);
supported.traitEvidence01['truth-seeking'] = .32;
const supportedLoop = new B299CausalPersonalityDevelopmentLoop();
supportedLoop.restore(supported);
const supportedBias = supportedLoop.actionBias('verify');
assert.ok(partialBias > 0, 'partial trait evidence must unlock a bounded contribution');
assert.ok(supportedBias > partialBias, 'stronger trait evidence must increase only its supported contribution');
assert.equal(supportedLoop.actionBias('explore'), 0,
  'truth-seeking evidence must not alter unrelated curiosity action selection');

const negative = seeded();
negative.traitFast11.caution = -.9;
negative.traitSlow11.caution = -.9;
const negativeLoop = new B299CausalPersonalityDevelopmentLoop();
negativeLoop.restore(negative);
assert.equal(negativeLoop.actionBias('defer'), 0,
  'unsupported negative dispositions must not suppress action selection');

// Valid state remains round-trip stable; malformed untrusted state is rebuilt
// from the canonical schema without executing property getters.
const original = new B299CausalPersonalityDevelopmentLoop();
original.restore(supported);
const canonical = original.snapshot();
const roundTrip = new B299CausalPersonalityDevelopmentLoop();
roundTrip.restore(canonical);
assert.deepEqual(roundTrip.snapshot(), canonical, 'valid B299 state must round-trip without personality drift');

let getterInvoked = false;
const nestedAccessor = {};
Object.defineProperty(nestedAccessor, 'curiosity', {
  enumerable: true,
  get() { getterInvoked = true; return .99; },
});
const hostile = {
  ...canonical,
  cycles: '900',
  traitEvidence01: nestedAccessor,
};
Object.defineProperty(hostile, 'learningUpdates', {
  enumerable: true,
  get() { getterInvoked = true; return 900; },
});
const hostileLoop = new B299CausalPersonalityDevelopmentLoop();
hostileLoop.restore(hostile);
const safe = hostileLoop.snapshot();
assert.equal(getterInvoked, false, 'restore must never invoke root or nested getters');
assert.equal(safe.cycles, 0, 'numeric-string counters must not be coerced');
assert.equal(safe.learningUpdates, 0, 'accessor-backed counters must fall back to defaults');
assert.equal(safe.traitEvidence01.curiosity, 0, 'accessor-backed trait evidence must fail closed');

let proxyTrapInvoked = false;
const hostileProxy = new Proxy({}, {
  getPrototypeOf() { proxyTrapInvoked = true; return Object.prototype; },
  ownKeys() { proxyTrapInvoked = true; return []; },
  getOwnPropertyDescriptor() { proxyTrapInvoked = true; return undefined; },
});
const proxyLoop = new B299CausalPersonalityDevelopmentLoop();
proxyLoop.restore(hostileProxy);
assert.equal(proxyTrapInvoked, false, 'root Proxy traps must not execute during restore');
assert.equal(proxyLoop.snapshot().cycles, 0);

const nestedProxy = new Proxy({ curiosity: .99 }, {
  getPrototypeOf() { proxyTrapInvoked = true; return Object.prototype; },
  ownKeys() { proxyTrapInvoked = true; return ['curiosity']; },
  getOwnPropertyDescriptor() { proxyTrapInvoked = true; return { value: .99, enumerable: true, configurable: true }; },
});
proxyTrapInvoked = false;
const nestedProxyState = { ...canonical, traitEvidence01: nestedProxy };
const nestedProxyLoop = new B299CausalPersonalityDevelopmentLoop();
nestedProxyLoop.restore(nestedProxyState);
assert.equal(proxyTrapInvoked, false, 'nested Proxy traps must not execute during restore');
assert.equal(nestedProxyLoop.snapshot().traitEvidence01.curiosity, 0);

console.log(JSON.stringify({
  status: 'PASS',
  suite: 'b299-personality-boundary-consolidation',
  unsupportedTraitBias: noEvidence.actionBias('verify'),
  partialBias,
  supportedBias,
  accessorNotInvoked: !getterInvoked,
  proxyTrapsNotInvoked: !proxyTrapInvoked,
}));
