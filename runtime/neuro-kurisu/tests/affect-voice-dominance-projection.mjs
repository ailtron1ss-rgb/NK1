import assert from 'node:assert/strict';
import { projectVoiceEmotionContext } from '../src/organism/core/OrganismRuntime.ts';

const projected=projectVoiceEmotionContext({facets:{cognition:{cognitiveField:{
  dominantEmotion:'JOY',valence01:.71,arousal01:.62,dominance01:.83,coherence01:.12,
}}}});
assert.deepEqual(projected,{label:'joy',valence01:.71,arousal01:.62,dominance01:.83},'voice must receive affective dominance, not identity/workspace coherence');

const missingDominance=projectVoiceEmotionContext({facets:{cognition:{cognitiveField:{
  dominantEmotion:'curiosity',valence01:.9,arousal01:.8,coherence01:.99,
}}}});
assert.equal(missingDominance.dominance01,.5,'missing dominance must use a neutral fallback rather than borrowing coherence');

const malformed=projectVoiceEmotionContext({facets:{cognition:{cognitiveField:{
  dominantEmotion:'not-an-emotion',valence01:Infinity,arousal01:'not-finite',dominance01:-4,
}}}});
assert.deepEqual(malformed,{label:'calm',valence01:.5,arousal01:.22,dominance01:0},'projection must clamp numeric values and reject unknown labels');
assert.deepEqual(projectVoiceEmotionContext(null),{label:'calm',valence01:.5,arousal01:.22,dominance01:.5});

console.log('AFFECT_VOICE_DOMINANCE_PROJECTION=PASS');
