import assert from 'node:assert/strict';
import { PersonalWorldlineEngine } from '../src/organism/learning/PersonalWorldlineEngine.ts';
const e=new PersonalWorldlineEngine();
const state={tick:1,at:1,version:1,needs:{energy:.7,cognitiveLoad:.2,uncertainty:.55,socialNeed:.65,novelty:.5,identityCoherence:.85,goalPressure:.6},predictionError:.35,attentionBudget:.8,lastAction:'explore',lastActionSuccess:.6,autonomyScore:.7,selfPredictionError:.2,predictedNextAction:'verify',lastPredictionConfidence:.65,worldContextVersion:1};
const goals=[{id:'g1',title:'Научное исследование',reason:'research',source:'intrinsic',status:'active',importance:.8,urgency:.5,confidence:.6,progress:.2,createdAt:1,updatedAt:1}];
for(let i=0;i<8;i++) e.beginCycle(i+1), e.observeContext({state,goals,personLabel:'user',entityLabels:['lab','hypothesis'],contextKey:`ctx-${i%4}`,identity01:.84,social01:.68,socialError01:.18,goalPressure01:.62,worldUncertainty01:.5,predictionError01:.35,at:i+1});
for(let i=0;i<4;i++) e.recordOutcome({action:'verify',goalId:'g1',personLabel:'user',contextKey:`ctx-${i}`,success01:.82,verified01:1,surprise01:.12,identity01:.84,social01:.72,causal01:.65,commitment01:.2,counterfactualGap01:.15,at:20+i});
const s=e.snapshot(); assert.ok(s.threads.length>=3); assert.ok(s.worldlineStability01>0); assert.ok(s.learningPressure01>0); const r=new PersonalWorldlineEngine(); r.restore(s); assert.deepEqual(r.snapshot(),s); assert.ok(r.actionBias('verify')>=0);
console.log(`BIG_PASS_125=PASS threads=${s.threads.length} focus=${s.focusKind}:${s.focusId} stability=${s.worldlineStability01.toFixed(3)} learning=${s.learningPressure01.toFixed(3)} debt=${s.commitmentDebt01.toFixed(3)}`);
