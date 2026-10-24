import assert from 'node:assert/strict';
import { EmotionAppraisalEngine } from '../src/organism/system/EmotionAppraisalEngine.ts';

const at = Date.now();
const appraisalInput = {
  tick: 1,
  at,
  goalPressure01: 0.3,
  goalCongruence01: 0.7,
  controllability01: 0.7,
  novelty01: 0.3,
  selfRelevance01: 0.5,
  socialMeaning01: 0.2,
  uncertainty01: 0.25,
  predictionError01: 0.1,
  homeostaticPressure01: 0.1,
  energy01: 0.7,
  success01: 0.7,
  external: true,
};

const baseline = new EmotionAppraisalEngine();
const baselineEpisode = baseline.appraise(appraisalInput);

const engine = new EmotionAppraisalEngine();
assert.equal(engine.observeExternalAffectHint({
  emotion: 'sadness',
  valence: -1,
  arousal: 1,
  confidence: 1,
  at,
}), true);
const influencedEpisode = engine.appraise(appraisalInput);

assert.ok(influencedEpisode.arousal01 > baselineEpisode.arousal01,
  'a high-confidence external arousal cue may shift arousal upward');
assert.ok(influencedEpisode.valence01 < baselineEpisode.valence01,
  'a negative local valence cue may shift valence downward');
assert.equal(influencedEpisode.label, baselineEpisode.label,
  'specialist affect may not override the endogenous appraisal label directly');
assert.equal(influencedEpisode.actionTendency, baselineEpisode.actionTendency,
  'specialist affect may not dictate the action tendency directly');

const persisted = engine.snapshot();
assert.equal(persisted.externalAffectHint?.emotion, 'sadness');
assert.equal(persisted.externalAffectHint?.confidence01, 1);
assert.equal(JSON.stringify(persisted).includes('private raw prompt'), false,
  'the affect bridge stores only bounded numeric/label evidence, never input text');

const restored = new EmotionAppraisalEngine();
restored.restore(persisted);
assert.equal(restored.snapshot().externalAffectHint?.emotion, 'sadness',
  'a valid, fresh hint should survive same-process persistence restore');

const expiredEngine = new EmotionAppraisalEngine();
assert.equal(expiredEngine.observeExternalAffectHint({
  emotion: 'joy', valence: 1, arousal: 0.9, confidence: 1, at,
}), true);
const expiredEpisode = expiredEngine.appraise({ ...appraisalInput, at: at + 16001 });
const freshBaseline = new EmotionAppraisalEngine().appraise({ ...appraisalInput, at: at + 16001 });
assert.equal(expiredEpisode.arousal01, freshBaseline.arousal01, 'expired cues must stop influencing appraisals');
assert.equal(expiredEpisode.valence01, freshBaseline.valence01, 'expired cues must stop influencing appraisals');
assert.equal(expiredEngine.snapshot().externalAffectHint, null, 'expired cues are dropped from persisted state');

assert.equal(engine.observeExternalAffectHint({
  emotion: 'sadness', valence: 9, arousal: 1, confidence: 1, at,
}), false, 'out-of-range valence must be rejected');
assert.equal(engine.observeExternalAffectHint({
  emotion: 'diagnosis', valence: 0, arousal: 0.2, confidence: 1, at,
}), false, 'unknown affect labels must be rejected');
assert.equal(engine.observeExternalAffectHint({
  emotion: 'neutral', valence: 0, arousal: 0.2, confidence: 1, at: at - 20000,
}), false, 'stale cues must be rejected before storage');
const invalidRestore = new EmotionAppraisalEngine();
invalidRestore.restore({ externalAffectHint: { emotion: 'diagnosis', valence01: 2, arousal01: -1, confidence01: 5, at } });
assert.equal(invalidRestore.snapshot().externalAffectHint, null, 'untrusted persisted cue fields must be validated on restore');

console.log('LOCAL_AFFECT_APPRAISAL_BRIDGE=PASS', JSON.stringify({
  lowWeightBlend: true,
  endogenousLabelRetained: true,
  shortLifetime: true,
  boundedRestore: true,
  noRawPromptStorage: true,
}));
