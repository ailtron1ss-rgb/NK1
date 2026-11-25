import assert from 'node:assert/strict';
import { projectSemanticBodyState } from '../src/components/avatar/embodimentUiBridge.ts';
const snapshot={tick:10,emotion:{label:'joy',valence:.8,arousal:.6,dominance:.7,tendency:'approach',cause:'legacy'},affectFrame:{schemaVersion:1,stateVersion:9,tick:9,episodeId:'emo:9:9000:1',feelingId:null,label:'anger',actionTendency:'protect',valence01:.1,arousal01:.9,dominance01:.1,intensity01:.9,confidence01:.8,stress01:.9,sampledAt:9_000,ageMs:100,freshness01:.996,cause:'stale',source:'emotion-appraisal',mood:null},lastOption:'wait'};
const body=projectSemanticBodyState({snapshot,revision:1,monotonicMs:100,headTilt:0,speechPhase:'idle',speechEventId:null,audioTimeMs:0});
assert.equal(body.emotion,'neutral');assert.equal(body.expression,'neutral');
console.log('AFFECT_FRAME_BRIDGE=PASS');
