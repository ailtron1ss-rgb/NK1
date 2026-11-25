import assert from 'node:assert/strict';
import { resolvePresentationEmotion } from '../src/components/avatar/affectFrame.ts';
const legacy={label:'joy',valence:.8,arousal:.6,dominance:.7,tendency:'approach',cause:'legacy'};
const frame={schemaVersion:1,stateVersion:10,tick:9,episodeId:'emo:9:9000:1',feelingId:null,label:'anxiety',actionTendency:'verify',valence01:.25,arousal01:.82,dominance01:.3,intensity01:.7,confidence01:.6,stress01:.8,sampledAt:9_000,ageMs:100,freshness01:.9966666667,cause:'internal-state',source:'emotion-appraisal',mood:{schemaVersion:1,valence01:.9,arousal01:.18,stress01:.1,socialSafety01:.8,deviation01:.1,recoveryRate01:.1,resilience01:.7,resilienceConfidence01:.5,sampledAt:9_500,ageMs:500,freshness01:Math.exp(-500/(24*60*60_000))}};
const valid=resolvePresentationEmotion({tick:10,emotion:legacy,affectFrame:frame},10_000);assert.equal(valid.label,'anxiety');assert.ok(valid.valence>.25&&valid.valence<.4);
const stale=resolvePresentationEmotion({tick:11,emotion:legacy,affectFrame:frame},10_000);assert.equal(stale.cause,'stale-affect-frame');
const expired=resolvePresentationEmotion({tick:10,emotion:legacy,affectFrame:frame},40_000);assert.equal(expired.cause,'stale-affect-frame');
const old=resolvePresentationEmotion({tick:10,emotion:legacy,affectFrame:null},10_000);assert.equal(old.label,'joy');
console.log('AFFECT_FRAME_PRESENTATION=PASS');
