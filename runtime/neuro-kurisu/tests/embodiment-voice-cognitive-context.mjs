import assert from 'node:assert/strict';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const runtime = new EmbodimentRuntime();
const state = {
  needs: {
    energy: 0.44,
    cognitiveLoad: 0.88,
    uncertainty: 0.91,
    socialNeed: 0.84,
    novelty: 0.72,
    identityCoherence: 0.43,
    goalPressure: 0.86,
  },
  attentionBudget: 0.42,
};

runtime.applyToState(state, {
  continuity01: 0.38,
  grounding01: 0.32,
  emotion: { label: 'anxiety', valence01: 0.22, arousal01: 0.91, dominance01: 0.28 },
});
const cached = runtime.voiceCognitiveContextSnapshot();
assert.equal(cached.needs.uncertainty, state.needs.uncertainty);
assert.equal(cached.needs.socialNeed, state.needs.socialNeed);
assert.equal(cached.needs.goalPressure, state.needs.goalPressure);
assert.equal(cached.continuity01, 0.38);
assert.equal(cached.grounding01, 0.32);
assert.equal(cached.emotion.label, 'anxiety');

const livePlan = runtime.previewVoicePlan('Давай проверим гипотезу', { action: 'verify', mode: 'learn' });
assert.ok(livePlan.reason.includes('high-cognitive-load'), 'voice must reflect live cognitive load');
assert.ok(livePlan.reason.includes('high-uncertainty'), 'voice must reflect live uncertainty');
assert.ok(livePlan.reason.includes('social-need'), 'voice must reflect live social need');
assert.ok(livePlan.reason.includes('continuity-uncertainty'), 'voice must reflect low identity continuity');
assert.ok(livePlan.reason.includes('low-grounding'), 'voice must reflect weak grounding');
assert.ok(livePlan.reason.includes('affect-anxiety-deescalation'), 'voice must use cached appraisal emotion');
assert.ok(livePlan.prosody.rate < 1, 'high load and anxiety should slow delivery');

const overridePlan = runtime.previewVoicePlan('Отлично, получилось!', {
  action: 'respond',
  needs: { ...state.needs, cognitiveLoad: 0.12, uncertainty: 0.08, socialNeed: 0.22 },
  emotion: { label: 'joy', valence01: 0.94, arousal01: 0.62 },
});
assert.ok(overridePlan.reason.includes('affect-joy'), 'per-utterance affect should override cached state');
assert.equal(overridePlan.reason.includes('affect-anxiety-deescalation'), false);
assert.equal(runtime.voiceCognitiveContextSnapshot().emotion.label, 'anxiety',
  'one-off overrides must not mutate persistent cognitive context');

const defaultPlan = runtime.previewVoicePlan('Краткий ответ');
assert.equal(defaultPlan.tone, livePlan.tone === 'focused' ? 'focused' : defaultPlan.tone);
assert.ok(defaultPlan.prosody.rate >= 0.72 && defaultPlan.prosody.rate <= 1.25);
assert.ok(defaultPlan.prosody.pitch >= 0.72 && defaultPlan.prosody.pitch <= 1.28);

const appraisalEpisode = {
  id: 'emo:9:9009:9', tick: 9, at: 9009, label: 'curiosity',
  valence01: .91, arousal01: .78, dominance01: .84,
};
const resolveRuntimeEmotion = OrganismRuntime.prototype['voiceEmotionContext'];
const mappedEmotion = resolveRuntimeEmotion.call({
  core: {
    snapshot: () => ({ facets: { cognition: { cognitiveField: {
      dominantEmotion: 'calm', valence01: .12, arousal01: .18, coherence01: .31,
    } } } }),
    emotionAppraisalSnapshot: () => ({
      history: [appraisalEpisode], lastLabel: 'calm', meanValence01: .5, meanArousal01: .2,
    }),
  },
});
assert.deepEqual(mappedEmotion, {
  label: 'curiosity', valence01: .91, arousal01: .78, dominance01: .84,
}, 'speech must use the latest canonical emotion episode rather than unrelated cognitive-field coherence');

const fallbackEmotion = resolveRuntimeEmotion.call({
  core: {
    snapshot: () => ({ facets: { cognition: { cognitiveField: { valence01: .2, arousal01: .3 } } } }),
    emotionAppraisalSnapshot: () => ({
      history: [], lastLabel: 'sadness', meanValence01: .24, meanArousal01: .39,
    }),
  },
});
assert.deepEqual(fallbackEmotion, {
  label: 'sadness', valence01: .24, arousal01: .39, dominance01: .5,
}, 'restored aggregate appraisal must remain usable when no episode is available');

runtime.applyToState(state, { emotion: mappedEmotion });
const appraisalDrivenPlan = runtime.previewVoicePlan('Это интересно, проверим', { action: 'explore' });
assert.ok(appraisalDrivenPlan.reason.includes('affect-curiosity'),
  'canonical emotion appraisal must reach the speech prosody planner');

console.log('EMBODIMENT_VOICE_COGNITIVE_CONTEXT=PASS', JSON.stringify({
  liveReasons: livePlan.reason,
  liveRate: livePlan.prosody.rate,
  overrideReasons: overridePlan.reason,
  cacheIsolated: true,
}));
