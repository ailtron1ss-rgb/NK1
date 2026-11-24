import assert from 'node:assert/strict';
import { LifeCourseNavigator } from '../src/organism/learning/LifeCourseNavigator.ts';

const n=new LifeCourseNavigator();
const state={tick:10,at:10,version:1,needs:{energy:.72,cognitiveLoad:.24,uncertainty:.61,socialNeed:.58,novelty:.44,identityCoherence:.86,goalPressure:.55},predictionError:.42,attentionBudget:.82,lastAction:'explore',lastActionSuccess:.6,autonomyScore:.72,selfPredictionError:.28,predictedNextAction:'verify',lastPredictionConfidence:.61,worldContextVersion:1};
const goals=[
{id:'g1',title:'Проверить новую научную гипотезу',reason:'research uncertainty',source:'learned',status:'active',importance:.8,urgency:.52,confidence:.62,progress:.18,createdAt:1,updatedAt:1},
{id:'g2',title:'Поддержать отношения и диалог',reason:'social connection',source:'social',status:'active',importance:.72,urgency:.64,confidence:.58,progress:.25,createdAt:1,updatedAt:1},
{id:'g3',title:'Стабилизировать собственное развитие',reason:'identity continuity and self development',source:'intrinsic',status:'active',importance:.68,urgency:.42,confidence:.71,progress:.33,createdAt:1,updatedAt:1}
];
n.beginCycle(10);
const a=n.assess({state,goals,identity01:.86,identityDrift01:.16,social01:.58,socialError01:.29,learningNeed01:.62,transfer01:.47,portfolioAllocation01:.58,historyUnresolved01:.34,futureMismatch01:.21,resource01:.24,novelty:.44,uncertainty:.61,at:10});
assert.ok(a.focus);
assert.equal(a.projections.length,3);
assert.ok(a.diagnostics.conflictCount>=0);
const bias=n.actionBias('verify')+n.actionBias('reflect')+n.actionBias('explore');
assert.ok(bias>0);
n.recordOutcome({goalId:a.focus.goalId,success01:.82,surprise01:.12,verified01:1,futureMismatch01:.08,social01:.7,at:20});
const snap=n.snapshot(); assert.equal(snap.cycles,1); assert.equal(snap.projections.length,3); assert.ok(snap.learning01>=0 && snap.learning01<=1);
const restored=new LifeCourseNavigator(); restored.restore(snap); assert.deepEqual(restored.snapshot(),snap);
console.log(`BIG_PASS_124=PASS focus=${a.focus.goalId} horizon=${a.focus.horizon} conflicts=${a.conflicts.length} learning=${snap.learning01.toFixed(3)} continuityDebt=${snap.continuityDebt01.toFixed(3)}`);
