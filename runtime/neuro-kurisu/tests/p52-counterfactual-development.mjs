import assert from 'node:assert/strict';
import { P52CounterfactualDevelopmentMind } from '../src/organism/world/P52CounterfactualDevelopmentMind.ts';
const mind = new P52CounterfactualDevelopmentMind();
const base={version:52,tick:1,at:1000,needs:{energy:.7,cognitiveLoad:.3,uncertainty:.72,socialNeed:.4,novelty:.61,identityCoherence:.8,goalPressure:.4},predictionError:.2,attentionBudget:.8,lastAction:'wait',lastActionSuccess:null,autonomyScore:.2,selfPredictionError:.1,predictedNextAction:'explore',lastPredictionConfidence:.7,worldContextVersion:1};
const goals=[{id:'g1',title:'test',reason:'test',source:'intrinsic',status:'active',importance:.8,urgency:.5,confidence:.7,progress:.2,createdAt:0,updatedAt:0}];
const s=mind.observe({stateBefore:base,stateAfter:{...base,tick:2,at:1100,needs:{...base.needs,uncertainty:.66}},action:'explore',predictedUtility01:.72,success01:.9,reward01:.8,surprise01:.2,predictionConfidence01:.74,selfPredictionError01:.1,goals,p50Alignment01:.73,p51Grounding01:.78,at:1100});
assert.equal(s.samples,1); assert.equal(s.counterfactuals.length,1); assert.ok(s.lastQuestion.includes('instead of explore')); assert.ok(s.developmentalReadiness01>0.25);
const restored=new P52CounterfactualDevelopmentMind(); restored.restore(s); assert.deepEqual(restored.snapshot(),s);
console.log('P52 counterfactual development PASS');
