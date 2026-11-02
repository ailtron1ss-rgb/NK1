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

// Adversarial state: a large learned weight with no supporting outcome evidence.
// It must not alter action policy merely because the phenotype itself is mature.
const unsupported = seeded();
unsupported.traitFast11['truth-seeking'] = .95;
unsupported.traitSlow11['truth-seeking'] = .92;
const noEvidence = new B299CausalPersonalityDevelopmentLoop();
noEvidence.restore(unsupported);
const unearnedVerifyBias = noEvidence.actionBias('verify');
assert.equal(unearnedVerifyBias, 0,
  'an unsupported trait weight must not influence action selection');
assert.equal(noEvidence.actionBias('explore'), 0,
  'an unsupported trait must not leak into unrelated action selection');

// Evidence should unlock the same trait gradually, and only for actions to which
// that trait has a declared affinity.
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

assert.ok(partialBias > 0, 'emerging evidence should unlock a bounded trait contribution');
assert.ok(supportedBias > partialBias,
  'stronger evidence must produce stronger trait influence');
assert.equal(supportedLoop.actionBias('explore'), 0,
  'truth-seeking evidence must not leak into unrelated curiosity policy');

// Stable phenotype evidence cannot bypass a missing trait-specific evidence lane.
const actionOnlyEvidence = seeded();
actionOnlyEvidence.traitFast11.curiosity = .95;
actionOnlyEvidence.traitSlow11.curiosity = .92;
const actionOnlyLoop = new B299CausalPersonalityDevelopmentLoop();
actionOnlyLoop.restore(actionOnlyEvidence);
assert.equal(actionOnlyLoop.actionBias('explore'), 0,
  'action-phenotype evidence cannot substitute for trait-specific evidence');

// The gate is symmetric: a learned negative disposition also requires evidence.
const negative = seeded();
negative.traitFast11.caution = -.9;
negative.traitSlow11.caution = -.9;
const negativeLoop = new B299CausalPersonalityDevelopmentLoop();
negativeLoop.restore(negative);
assert.equal(negativeLoop.actionBias('defer'), 0,
  'unsupported negative traits must not suppress action selection');

console.log(JSON.stringify({
  status: 'PASS',
  suite: 'b299-trait-evidence-action-gate',
  unearnedVerifyBias,
  partialBias,
  supportedBias,
  unsupportedNegativeBias: negativeLoop.actionBias('defer'),
}));
