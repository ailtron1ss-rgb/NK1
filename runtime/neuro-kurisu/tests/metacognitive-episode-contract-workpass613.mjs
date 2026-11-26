import assert from 'node:assert/strict';
import { normalizeMetacognitiveEpisode } from '../src/organism/cognition/MetacognitiveEpisode.ts';

const valid = {
  version: 1,
  id: 'meta-cycle:41',
  cycleId: 'cycle:41',
  cognitiveEventId: 'cef:metacognitive:41',
  tick: 41,
  at: 1_798_000_000_000,
  parentEventIds: ['observation:41','prediction:41','appraisal:41','attention:41','memory:41','goal:41','plan:41','action:41','outcome:41','learning:41','self-update:41'],
  belief: { summary: 'The selected action is likely to improve the current goal.', confidence01: 0.72, uncertainty01: 0.28, provenance: 'inferred' },
  prediction: { summary: 'inspect is expected to improve reward.', expectedOutcome01: 0.68, confidence01: 0.74, provenance: 'inferred' },
  selection: { goalId: 'goal:research', action: 'explore', rationale: ['highest governed utility','within cognitive budget'], consumedFeatures: { score: 0.81, predictedUtility: 0.68, predictedNeedRelief: 0.4, predictedCost: 0.2, confidence: 0.74 } },
  outcome: { observedOutcome01: 0.51, predictionError01: 0.17, provenance: 'simulated', verified: false, independent: false },
  contradictions: [],
  limitations: ['world transition came from shadow simulation'],
  reflection: { status: 'not-evaluated', proposalId: null, disposition: 'none', summary: 'No governed correction proposal was emitted by this cycle.' },
};

const normalized = normalizeMetacognitiveEpisode(valid);
assert.ok(normalized, 'accepts a complete versioned cognitive-cycle episode');
assert.equal(normalized.id, valid.id);
assert.equal(normalized.parentEventIds.length, 11);
assert.equal(normalized.reflection.status, 'not-evaluated');
assert.equal(normalized.outcome.provenance, 'simulated');

let getterCalled = false;
const accessor = { ...valid, belief: Object.defineProperty({}, 'summary', { enumerable: true, get() { getterCalled = true; return 'forged'; } }) };
assert.equal(normalizeMetacognitiveEpisode(accessor), null, 'rejects accessor-backed nested episode fields');
assert.equal(getterCalled, false, 'never invokes a getter while validating an episode');

const sparse = { ...valid, parentEventIds: ['observation:41', , 'prediction:41'] };
assert.equal(normalizeMetacognitiveEpisode(sparse), null, 'rejects sparse causal parent arrays');

const hostile = new Proxy(valid, { ownKeys() { throw new Error('hostile proxy trap'); } });
assert.equal(normalizeMetacognitiveEpisode(hostile), null, 'fails closed when a hostile proxy throws during inspection');

const symbolRoot = { ...valid };
Object.defineProperty(symbolRoot, Symbol('hidden-root-state'), { value: 'must-not-be-ignored' });
assert.equal(normalizeMetacognitiveEpisode(symbolRoot), null, 'rejects unrecognized symbol properties on episode records');

const symbolFeatures = { ...valid.selection.consumedFeatures };
Object.defineProperty(symbolFeatures, Symbol('hidden-feature'), { value: 0.25 });
assert.equal(normalizeMetacognitiveEpisode({
  ...valid,
  selection: { ...valid.selection, consumedFeatures: symbolFeatures },
}), null, 'rejects symbol properties in consumed feature maps');

const symbolParents = [...valid.parentEventIds];
Object.defineProperty(symbolParents, Symbol('hidden-parent'), { value: 'untracked-parent' });
assert.equal(normalizeMetacognitiveEpisode({
  ...valid,
  parentEventIds: symbolParents,
}), null, 'rejects symbol properties in causal parent arrays');


assert.equal(normalizeMetacognitiveEpisode({ ...valid, tick: -1 }), null, 'rejects negative source ticks');
assert.equal(normalizeMetacognitiveEpisode({ ...valid, parentEventIds: ['same','same'] }), null, 'rejects duplicate causal parent references');
assert.equal(normalizeMetacognitiveEpisode({ ...valid, outcome: { ...valid.outcome, predictionError01: 2 } }), null, 'rejects out-of-range prediction error');
assert.equal(normalizeMetacognitiveEpisode({ ...valid, reflection: { ...valid.reflection, status: 'accepted', proposalId: null } }), null, 'does not accept a claimed promotion without a governed proposal reference');

console.log('metacognitive-episode-contract: PASS');
