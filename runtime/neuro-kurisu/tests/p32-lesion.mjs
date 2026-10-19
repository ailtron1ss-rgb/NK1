import assert from 'node:assert/strict';
import { P32CausalSelfModelEngine } from '../src/organism/cognition/P32CausalSelfModel.ts';
const e=new P32CausalSelfModelEngine();
const s={version:35,tick:1,at:Date.now(),needs:{energy:.8,cognitiveLoad:.2,uncertainty:.2,socialNeed:.2,novelty:.5,identityCoherence:.9,goalPressure:.2},predictionError:.1,attentionBudget:.8,lastAction:'none',lastActionSuccess:null,autonomyScore:.8,selfPredictionError:.1,predictedNextAction:'respond',lastPredictionConfidence:.8,worldContextVersion:1};
e.predict({state:s,action:'respond',autonomy01:.8,p31SelfAccess01:.8,p31Agency01:.8,uncertainty01:.2});
e.observeOutcome({action:'respond',success01:.9,reward01:.9,surprise01:.1,externallyRequested:false,observationId:'obs',state:{...s,tick:2}});
const before=e.snapshot(); const r=e.lesionSelfCausalLinks(); assert.ok(r.delta<=0); assert.deepEqual(e.snapshot(),before); assert.ok(r.edgesAffected>=1);
console.log('P32_LESION=PASS'); console.log(JSON.stringify(r));
