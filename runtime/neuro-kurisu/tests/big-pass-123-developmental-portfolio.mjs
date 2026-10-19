import assert from 'node:assert/strict';
import { DevelopmentalPortfolioEngine } from '../src/organism/learning/DevelopmentalPortfolioEngine.ts';

const state={tick:12,at:1200,lastAction:'explore',needs:{energy:.72,uncertainty:.66,cognitiveLoad:.34,novelty:.61,socialNeed:.7,goalPressure:.58,identityCoherence:.81},predictionError:.49,autonomyScore:.7};
const e=new DevelopmentalPortfolioEngine();
for(let i=0;i<10;i++){
  e.beginCycle();
  e.observe({state,socialError01:.18+Math.min(.2,i*.01),socialTrust01:.72,identity01:.82,identityLearning01:.48,curriculumPressure01:.57,historyUnresolved01:.44,transfer01:.43,worldUncertainty01:.66,worldPredictionError01:.49,skillNeed01:.61,researchNeed01:.55,embodimentCapacity01:.74,embodimentStrain01:.21,goalProgress01:.31,at:1200+i});
}
const goals=[
{id:'g-social',title:'Укреплять отношения и лучше понимать собеседника',reason:'социальное обучение',source:'intrinsic',status:'active',importance:.72,urgency:.55,confidence:.55,progress:.22,createdAt:1,updatedAt:1},
{id:'g-research',title:'Проверять неизвестное и улучшать исследовательскую стратегию',reason:'research evidence',source:'learned',status:'active',importance:.66,urgency:.61,confidence:.51,progress:.18,createdAt:1,updatedAt:1},
{id:'g-self',title:'Развивать автономность и идентичность',reason:'self development',source:'intrinsic',status:'active',importance:.62,urgency:.48,confidence:.58,progress:.28,createdAt:1,updatedAt:1}
];
const ranked=e.rankGoals(goals,{socialNeed01:.7,novelty01:.6,uncertainty01:.66});
assert.equal(ranked.length,3);
assert.ok(ranked[0].score01>0.25);
const selected=ranked[0].domain;
e.recalibrateAfterOutcome({success01:.82,verified01:1,social01:.72,identity01:.84,transfer01:.56,surprise01:.12,at:1300});
const d=e.diagnostics();
assert.ok(d.cycles===10);
assert.ok(d.allocation01>.2);
assert.ok(d.topDomains.length===3);
const b=e.actionBias(selected==='social'?'respond':selected==='research'?'verify':selected==='self'?'reflect':'explore');
assert.ok(b>=0);
const snap=e.snapshot();
const restored=new DevelopmentalPortfolioEngine();restored.restore(snap);
assert.deepEqual(restored.snapshot(),snap);
console.log('BIG_PASS_123_PORTFOLIO=PASS');
console.log(JSON.stringify({cycles:d.cycles,selected:d.selectedDomain,goal:d.selectedGoalId,allocation01:d.allocation01,competition01:d.competition01,coherence01:d.coherence01,historyDriven01:d.historyDriven01,socialDriven01:d.socialDriven01,embodimentDriven01:d.embodimentDriven01,topDomains:d.topDomains},null,2));
