import assert from 'node:assert/strict';
import { projectVoiceEmotionContext } from '../src/organism/core/OrganismRuntime.ts';
import { buildVoicePlan } from '../src/organism/body/VoiceEmbodiment.ts';
import { defaultBodyState } from '../src/organism/body/EmbodiedBody.ts';

const projected=projectVoiceEmotionContext(
  {facets:{cognition:{cognitiveField:{dominantEmotion:'JOY',valence01:.71,arousal01:.62,dominance01:.12,coherence01:.99}}}},
  {history:[{label:'joy',valence01:.71,arousal01:.62,dominance01:.83}]},
);
assert.deepEqual(projected,{label:'joy',valence01:.71,arousal01:.62,dominance01:.83},'latest appraisal episode must be the source of affective dominance');

const fieldFallback=projectVoiceEmotionContext({facets:{cognition:{cognitiveField:{dominantEmotion:'curiosity',valence01:.9,arousal01:.8,dominance01:.66,coherence01:.99}}}});
assert.equal(fieldFallback.dominance01,.66,'use the affect-specific field only when no appraisal episode is available');

const missingDominance=projectVoiceEmotionContext({facets:{cognition:{cognitiveField:{dominantEmotion:'curiosity',valence01:.9,arousal01:.8,coherence01:.99}}}});
assert.equal(missingDominance.dominance01,.5,'never substitute identity/workspace coherence for missing affective dominance');

const malformed=projectVoiceEmotionContext({facets:{cognition:{cognitiveField:{dominantEmotion:'not-an-emotion',valence01:Infinity,arousal01:'not-finite',dominance01:-4}}}});
assert.deepEqual(malformed,{label:'calm',valence01:.5,arousal01:.22,dominance01:0},'projection must clamp numeric values and reject unknown labels');
assert.deepEqual(projectVoiceEmotionContext(null),{label:'calm',valence01:.5,arousal01:.22,dominance01:.5});

const body=defaultBodyState();
const needs={energy:.7,cognitiveLoad:.4,uncertainty:.3,socialNeed:.3,novelty:.3,identityCoherence:.8,goalPressure:.3};
const plan=(dominance01)=>buildVoicePlan({text:'Объясни результат',action:'respond',needs,body,emotion:{label:'calm',valence01:.5,arousal01:.4,dominance01}});
const lowControl=plan(.1);
const highControl=plan(.9);
assert.ok(lowControl.reason.includes('low-appraisal-control'));
assert.ok(highControl.reason.includes('high-appraisal-control'));
assert.ok(lowControl.prosody.rate<highControl.prosody.rate,'low perceived control should produce more measured delivery');
assert.ok(lowControl.prosody.pauseMs>highControl.prosody.pauseMs,'low perceived control should add a small pause');
assert.ok(lowControl.prosody.emphasis01<highControl.prosody.emphasis01,'low perceived control should reduce emphasis');
assert.ok(lowControl.prosody.rate>=.72 && lowControl.prosody.rate<=1.25);
assert.ok(highControl.prosody.rate>=.72 && highControl.prosody.rate<=1.25);

console.log('AFFECT_VOICE_DOMINANCE_PROJECTION=PASS');
