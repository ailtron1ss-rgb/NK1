import assert from 'node:assert/strict';
import { projectAvatarBrainState } from '../src/organism/body/AvatarBrainAffectBridge.ts';
const now=Date.now(),frame={stateVersion:7,episodeId:'emo:7:1:1',sampledAt:now,freshness01:1,valence01:.2,arousal01:.8,dominance01:.3,confidence01:.7,stress01:.8,moodValence01:.7,moodArousal01:.3,moodStress01:.2,moodSocialSafety01:.7,moodSampledAt:now,moodFreshness01:1};
const state={tick:7,needs:{energy:.7,cognitiveLoad:.3,uncertainty:.2,socialNeed:.4,novelty:.5,identityCoherence:.8},predictionError:.2,lastActionSuccess:.6,lastPredictionConfidence:.8,autonomyScore:.6};
const valid=projectAvatarBrainState({state,affect:frame,now});assert.equal(valid.affectEpisodeId,'emo:7:1:1');
const stale=projectAvatarBrainState({state:{...state,tick:8},affect:frame,previous:valid,now});assert.equal(stale.affectEpisodeId,null);assert.equal(stale.stateVersion,8);assert.equal(stale.freshness01,0);
console.log('AVATAR_AFFECT_FRAME_LINEAGE=PASS');
