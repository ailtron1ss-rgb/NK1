import assert from 'node:assert/strict';
import { MetaDevelopmentalStrategyEngine } from '../src/organism/learning/MetaDevelopmentalStrategyEngine.ts';

const state={version:122,tick:100,at:1000,needs:{energy:.82,cognitiveLoad:.18,uncertainty:.78,socialNeed:.24,novelty:.72,identityCoherence:.91,goalPressure:.68},predictionError:.61,attentionBudget:.8,lastAction:'none',lastActionSuccess:null,autonomyScore:.82,selfPredictionError:.4,predictedNextAction:'none',lastPredictionConfidence:.52,worldContextVersion:1};
const goals=[
{id:'g1',title:'Исследовать новую закономерность',reason:'uncertainty and transfer',source:'intrinsic',status:'active',importance:.86,urgency:.72,confidence:.72,progress:.1,createdAt:1,updatedAt:1},
{id:'g2',title:'Проверить гипотезу о мире',reason:'prediction evidence',source:'learned',status:'active',importance:.75,urgency:.64,confidence:.68,progress:.05,createdAt:1,updatedAt:1},
{id:'g3',title:'Поддержать пользователя',reason:'social responsibility',source:'external',status:'active',importance:.6,urgency:.8,confidence:.7,progress:.15,createdAt:1,updatedAt:1},
];
const synthesis={macros:[{id:'macro:explore>verify>reflect',sequence:['explore','verify','reflect'],status:'promoted',transfer01:.72,retention01:.74,confidence01:.8}],};
const executive={projects:[
{id:'p1',goalId:'g1',status:'completed',progress01:1,retention01:.76,transfer01:.7,expectedGain01:.8,autonomyFit01:.9,lastAction:'reflect',revisionPressure01:.1},
{id:'p2',goalId:'g2',status:'completed',progress01:1,retention01:.71,transfer01:.64,expectedGain01:.75,autonomyFit01:.82,lastAction:'verify',revisionPressure01:.12},
],};
const p36={};
const meta=new MetaDevelopmentalStrategyEngine();
meta.beginCycle();
const agenda=meta.compileAgenda({goals,state,synthesis,executive,p36,identity01:.9,goalPressure01:.68});
assert.equal(agenda.length,3);
assert.equal(meta.diagnostics().focusGoalId,agenda[0].goalId);
assert.ok(meta.diagnostics().learningAllocation01>.2);

for(let i=0;i<9;i++){
  const g=goals[0];
  meta.observeOutcome({goal:g,action:'verify',outcome01:.84,verified:true,contextKey:`ctx-${i}`,delayed:i>=5,transfer:i>=3,at:2000+i});
}
const first=meta.snapshot();
let promoted=first.strategies.find(s=>s.status==='promoted');
assert.ok(promoted,'meta strategy should promote after verified cross-context evidence');
assert.ok(promoted.contexts>=3);
assert.ok(promoted.transfer01>=.5);

meta.compileAgenda({goals,state,synthesis,executive,p36,identity01:.9,goalPressure01:.68});
assert.equal(meta.diagnostics().focusGoalId,agenda[0].goalId);
const bias=meta.actionBias('verify','g1');
assert.ok(bias>0);

for(let i=0;i<3;i++)meta.observeOutcome({goal:goals[0],action:'verify',outcome01:.18,verified:true,contextKey:`bad-${i}`,delayed:false,transfer:true,at:3000+i});
const blocked=meta.snapshot().strategies.find(s=>s.id===promoted.id);
assert.equal(blocked?.status,'blocked');
assert.ok(meta.diagnostics().rollbackSignals>=1);

const restored=new MetaDevelopmentalStrategyEngine(); restored.restore(meta.snapshot());
assert.deepEqual(restored.snapshot(),meta.snapshot());
console.log('BIG_PASS_121_META_DEVELOPMENTAL=PASS');
console.log(JSON.stringify({strategies:restored.snapshot().strategies.length,promoted:restored.snapshot().strategies.filter(s=>s.status==='promoted').length,blocked:restored.snapshot().strategies.filter(s=>s.status==='blocked').length,focusGoalId:restored.snapshot().focusGoalId,focusAction:restored.snapshot().focusAction,metaLearning01:restored.snapshot().metaLearning01,abstraction01:restored.snapshot().abstraction01},null,2));
