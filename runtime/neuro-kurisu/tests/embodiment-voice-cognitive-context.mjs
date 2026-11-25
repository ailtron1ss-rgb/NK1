import assert from 'node:assert/strict';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { projectVoiceEmotionContext } from '../src/organism/core/OrganismRuntime.ts';
import { buildVoicePlan } from '../src/organism/body/VoiceEmbodiment.ts';
import { defaultBodyState } from '../src/organism/body/EmbodiedBody.ts';
import { EmotionAppraisalEngine } from '../src/organism/system/EmotionAppraisalEngine.ts';

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

const eventAt = Date.now() - 100;
const appraisalEngine = new EmotionAppraisalEngine();
const appraisalEpisode = appraisalEngine.appraise({
  tick: 9, at: eventAt, novelty01: .82, uncertainty01: .48,
  predictionError01: .12, homeostaticPressure01: .1, goalPressure01: .28,
  goalCongruence01: .82, controllability01: .84, success01: .86,
});
appraisalEngine.inferFeeling(appraisalEpisode, {
  energy01: .8, cognitiveLoad01: .3, uncertainty01: .48, selfFocus01: .7,
});
const makeRuntimeContext = (snapshot, appraisal) => {
  const context = Object.create(OrganismRuntime.prototype);
  context.core = { snapshot: () => snapshot, emotionAppraisalSnapshot: () => appraisal };
  return context;
};
const resolveRuntimeEmotion = OrganismRuntime.prototype['voiceEmotionContext'];
const mappedEmotion = resolveRuntimeEmotion.call(makeRuntimeContext({
  state: { tick: 9, at: eventAt },
  facets: { cognition: { cognitiveField: {
    dominantEmotion: 'sadness', valence01: .12, arousal01: .18, dominance01: .31,
  } } },
}, appraisalEngine.snapshot()));
assert.equal(mappedEmotion.label, appraisalEpisode.label,
  'speech must use the latest canonical emotion episode rather than unrelated cognitive-field values');
assert.equal(mappedEmotion.episodeId, appraisalEpisode.id);
assert.equal(mappedEmotion.stateVersion, 9);
assert.equal(mappedEmotion.source, 'emotion-appraisal');
assert.equal(mappedEmotion.actionTendency, appraisalEpisode.actionTendency);
assert.equal(mappedEmotion.cause, appraisalEpisode.cause);

const fallbackNow = Date.now();
const fallbackEmotion = resolveRuntimeEmotion.call(makeRuntimeContext({
  state: { tick: 10, at: fallbackNow },
  facets: { cognition: { cognitiveField: { valence01: .2, arousal01: .3 } } },
}, {
  version: 2, lastTick: 10, lastAt: fallbackNow, lastLabel: 'sadness',
  meanValence01: .24, meanArousal01: .39, meanStress01: .34, meanAttentionCapture01: .4,
  history: [], feelings: [], interoception: { predictionCalibration01: .66 },
}));
assert.equal(fallbackEmotion.label, 'sadness');
assert.equal(fallbackEmotion.stateVersion, 10);
assert.equal(fallbackEmotion.source, 'appraisal-summary',
  'restored aggregate appraisal must remain preferred when episode history is empty');
assert.ok(Math.abs(fallbackEmotion.valence01 - .24) < .001);
assert.ok(Math.abs(fallbackEmotion.arousal01 - .39) < .001);

runtime.applyToState(state, { emotion: mappedEmotion });
const appraisalDrivenPlan = runtime.previewVoicePlan('Это интересно, проверим', { action: 'explore' });
assert.ok(appraisalDrivenPlan.reason.includes('affect-curiosity'),
  'canonical emotion appraisal must reach the speech prosody planner');

const projectionNow = Date.now();
const joyEngine = new EmotionAppraisalEngine();
const joyEpisode = joyEngine.appraise({
  tick: 20, at: projectionNow - 50, socialMeaning01: .9, goalCongruence01: .92,
  controllability01: .82, success01: .94, novelty01: .55, uncertainty01: .1,
});
const projected = projectVoiceEmotionContext(
  {state:{tick:20,at:projectionNow},facets:{cognition:{cognitiveField:{dominantEmotion:'sadness',valence01:.1,arousal01:.9,dominance01:.12,coherence01:.99}}}},
  joyEngine.snapshot(),
  projectionNow,
);
assert.equal(projected.label, joyEpisode.label, 'latest canonical episode must own the voice emotion projection');
assert.equal(projected.episodeId, joyEpisode.id);
assert.equal(projected.source, 'emotion-appraisal');
assert.equal(projected.stateVersion, 20);
assert.ok(Math.abs(projected.dominance01 - joyEpisode.dominance01) < .01);

const fieldNow = Date.now();
const fieldFallback = projectVoiceEmotionContext({
  state:{tick:21,at:fieldNow},
  facets:{cognition:{cognitiveField:{dominantEmotion:'curiosity',valence01:.9,arousal01:.8,dominance01:.66,coherence01:.99}}},
}, undefined, fieldNow);
assert.equal(fieldFallback.source,'cognitive-field-fallback');
assert.equal(fieldFallback.dominance01,.66,'use affect-specific dominance when no episode is available');

const missingDominance = projectVoiceEmotionContext({
  state:{tick:22,at:fieldNow},
  facets:{cognition:{cognitiveField:{dominantEmotion:'curiosity',valence01:.9,arousal01:.8,coherence01:.99}}},
}, undefined, fieldNow);
assert.equal(missingDominance.dominance01,.5,'never substitute cognitive coherence for missing affective dominance');

const malformed = projectVoiceEmotionContext({
  state:{tick:23,at:fieldNow},
  facets:{cognition:{cognitiveField:{dominantEmotion:'not-an-emotion',valence01:Infinity,arousal01:'not-finite',dominance01:-4}}},
}, undefined, fieldNow);
assert.equal(malformed.source,'default');
assert.equal(malformed.label,'calm');
assert.equal(malformed.valence01,.5);
assert.equal(malformed.arousal01,.22);
assert.equal(malformed.dominance01,.5);
const emptyProjection = projectVoiceEmotionContext(null, undefined, fieldNow);
assert.equal(emptyProjection.source,'default');
assert.equal(emptyProjection.label,'calm');
assert.equal(emptyProjection.dominance01,.5);

const body = defaultBodyState();
const needs = {energy:.7,cognitiveLoad:.4,uncertainty:.3,socialNeed:.3,novelty:.3,identityCoherence:.8,goalPressure:.3};
const dominancePlan = dominance01 => buildVoicePlan({
  text:'Объясни результат',action:'respond',needs,body,
  emotion:{label:'calm',valence01:.5,arousal01:.4,dominance01},
});
const lowControl = dominancePlan(.1);
const highControl = dominancePlan(.9);
assert.ok(lowControl.reason.includes('low-appraisal-control'));
assert.ok(highControl.reason.includes('high-appraisal-control'));
assert.ok(lowControl.prosody.rate<highControl.prosody.rate);
assert.ok(lowControl.prosody.pauseMs>highControl.prosody.pauseMs);
assert.ok(lowControl.prosody.emphasis01<highControl.prosody.emphasis01);
assert.ok(lowControl.prosody.rate>=.72 && lowControl.prosody.rate<=1.25);
assert.ok(highControl.prosody.rate>=.72 && highControl.prosody.rate<=1.25);
console.log('AFFECT_VOICE_DOMINANCE_PROJECTION=PASS');

console.log('EMBODIMENT_VOICE_COGNITIVE_CONTEXT=PASS', JSON.stringify({
  liveReasons: livePlan.reason,
  liveRate: livePlan.prosody.rate,
  overrideReasons: overridePlan.reason,
  cacheIsolated: true,
}));
