import assert from 'node:assert/strict';
import {
  B299CausalPersonalityDevelopmentLoop,
  defaultB299State,
} from '../src/organism/system/B299CausalPersonalityDevelopmentLoop.ts';

const original = new B299CausalPersonalityDevelopmentLoop();
original.setContext({ social: .72, epistemic: .18, autonomy: .08, maintenance: .02 });
for (let tick = 1; tick <= 5; tick++) {
  original.observeOutcome({
    tick, action: tick % 2 ? 'verify' : 'respond',
    reward01: .82, predictionError01: .14, causalConfidence01: .86,
    identityContinuity01: .91, externalEvidence01: .88,
    worldTransition: true, independent: true, autonomous: tick % 2 === 0,
    predictedUtility01: .78, context: { social: .6, epistemic: .4 },
  });
}
const canonical = original.snapshot();
const validRestore = new B299CausalPersonalityDevelopmentLoop();
validRestore.restore(canonical);
assert.deepEqual(validRestore.snapshot(), canonical,
  'a valid v1 B299 snapshot must round-trip without personality drift');

let rootGetterInvoked = false;
const accessorRoot = {};
Object.defineProperty(accessorRoot, 'traitEvidence01', {
  enumerable: true,
  get() {
    rootGetterInvoked = true;
    return canonical.traitEvidence01;
  },
});
const accessorNested = {};
Object.defineProperty(accessorNested, 'curiosity', {
  enumerable: true,
  get() {
    rootGetterInvoked = true;
    return .99;
  },
});

const corrupt = {
  ...canonical,
  version: 999,
  cycles: '999',
  learningUpdates: Number.POSITIVE_INFINITY,
  verifiedUpdates: -12,
  lastAction: 'rewrite-personality',
  lastPredictionError01: '0.01',
  personalityInfluence01: Number.NaN,
  personalityStability01: 1.7,
  selfAuthoredDevelopment01: -2,
  causalIntegrity01: .8,
  lesion01: 2,
  actionPhenotypes: [
    {
      ...canonical.actionPhenotypes.find((row) => row.action === 'verify'),
      action: 'verify',
      evidence01: '0.99',
      samples: '500',
      preference11: Number.POSITIVE_INFINITY,
      contextPreference11: { social: '.9', epistemic: .2, autonomy: Number.NaN, maintenance: .1 },
    },
    { action: 'unknown', evidence01: 1 },
    { action: 'verify', evidence01: 1 },
  ],
  history: [
    ...canonical.history,
    { tick: 900, action: 'verify', reward01: '0.99', predictionError01: .2,
      verified: true, independent: true, autonomous: true, bias11: .6, learningRate01: .04 },
    { tick: Number.NaN, action: 'respond', reward01: .7, predictionError01: .2,
      verified: true, independent: true, autonomous: false, bias11: .1, learningRate01: .04 },
    { tick: 901, action: 'not-a-real-action', reward01: .7, predictionError01: .2,
      verified: true, independent: true, autonomous: false, bias11: .1, learningRate01: .04 },
  ],
  traitFast11: { curiosity: '0.98', 'truth-seeking': .8, unknown: 1 },
  traitSlow11: { curiosity: Number.NaN, 'truth-seeking': -.8 },
  traitEvidence01: { curiosity: accessorNested, 'truth-seeking': '0.98', caution: 1.4 },
  maturity01: '0.99',
  developmentalStage: 'instant-transcendence',
  developmentalEvidence01: Number.POSITIVE_INFINITY,
  developmentalDiversity01: -.4,
  unknownInjectedField: { authority: true },
};

const restored = new B299CausalPersonalityDevelopmentLoop();
restored.restore(corrupt);
const state = restored.snapshot();

assert.equal(state.version, 1);
assert.equal(state.cycles, 0, 'numeric-string counters must not be trusted');
assert.equal(state.learningUpdates, 0, 'non-finite counters must use defaults');
assert.equal(state.verifiedUpdates, 0, 'negative counters must use defaults');
assert.equal(state.lastAction, null, 'unknown actions must not be retained');
assert.equal(state.lastPredictionError01, .3, 'numeric strings must not be coerced');
assert.equal(state.personalityInfluence01, 0);
assert.equal(state.personalityStability01, 1);
assert.equal(state.selfAuthoredDevelopment01, 0);
assert.equal(state.causalIntegrity01, .8);
assert.equal(state.lesion01, 1);
assert.equal(state.actionPhenotypes.length, 7, 'restore must rebuild exactly the canonical action set');
const verify = state.actionPhenotypes.find((row) => row.action === 'verify');
assert.equal(verify.evidence01, 0, 'numeric-string action evidence must not be trusted');
assert.equal(verify.samples, 0, 'numeric-string counters must not be trusted');
assert.equal(verify.preference11, 0, 'non-finite preferences must use safe defaults');
assert.equal(verify.contextPreference11.social, 0);
assert.equal(verify.contextPreference11.epistemic, .2);
assert.equal(state.history.length, canonical.history.length,
  'malformed history entries must be rejected rather than persisted');
assert.equal(state.traitFast11.curiosity, 0, 'numeric-string trait values must not be coerced');
assert.equal(state.traitFast11['truth-seeking'], .8);
assert.equal(state.traitSlow11.curiosity, 0);
assert.equal(state.traitSlow11['truth-seeking'], -.8);
assert.equal(state.traitEvidence01.curiosity, 0, 'accessor-backed trait evidence must fail closed');
assert.equal(state.traitEvidence01['truth-seeking'], 0);
assert.equal(state.traitEvidence01.caution, 1);
assert.equal(state.maturity01, 0);
assert.equal(state.developmentalStage, 'nascent');
assert.equal(state.developmentalEvidence01, 0);
assert.equal(state.developmentalDiversity01, 0);
assert.equal('unknownInjectedField' in state, false, 'unknown fields must not cross the restore boundary');
assert.equal(rootGetterInvoked, false, 'restore must never invoke accessor-backed root or nested fields');

// Accessor roots, inherited records and proxies must fail closed.
for (const invalid of [
  null,
  [],
  'state',
  24,
  new Proxy({}, {}),
  Object.assign(Object.create({ cycles: 999 }), { learningUpdates: 999 }),
  accessorRoot,
]) {
  const loop = new B299CausalPersonalityDevelopmentLoop();
  loop.restore(invalid);
  const snapshot = loop.snapshot();
  assert.equal(snapshot.cycles, 0);
  assert.equal(snapshot.learningUpdates, 0);
  assert.equal(snapshot.traitEvidence01.curiosity, 0);
}

// Proxied arrays and proxy-backed phenotype records are dropped without executing traps.
const proxyHistory = new Proxy(canonical.history, {});
const proxyPhenotype = new Proxy(canonical.actionPhenotypes[0], {});
const proxyState = {
  ...canonical,
  history: proxyHistory,
  actionPhenotypes: [proxyPhenotype],
};
const proxyRestored = new B299CausalPersonalityDevelopmentLoop();
proxyRestored.restore(proxyState);
assert.equal(proxyRestored.snapshot().history.length, 0);
assert.equal(proxyRestored.snapshot().actionPhenotypes.length, 7);

console.log(JSON.stringify({
  status: 'PASS',
  suite: 'b299-personality-restore-integrity',
  validRoundTrip: true,
  invalidCountersRejected: true,
  invalidRowsRejected: true,
  accessorNotInvoked: !rootGetterInvoked,
  proxyInputsRejected: true,
  unknownFieldsDropped: true,
}));
