import assert from 'node:assert/strict';
import { DevelopmentalExecutiveEngine } from '../src/organism/learning/DevelopmentalExecutiveEngine.ts';

const state={version:122,tick:10,at:1000,
  needs:{energy:.85,cognitiveLoad:.12,uncertainty:.72,socialNeed:.2,novelty:.68,identityCoherence:.9,goalPressure:.74},
  predictionError:.6,attentionBudget:.82,lastAction:'none',lastActionSuccess:null,autonomyScore:.8,selfPredictionError:.4,
  predictedNextAction:'none',lastPredictionConfidence:.5,worldContextVersion:1};
const goal={id:'goal-1',title:'Исследовать и проверить новую закономерность',reason:'intrinsic-development',source:'intrinsic',status:'active',importance:.85,urgency:.72,confidence:.8,progress:0,createdAt:1000,updatedAt:1000};
const synthesis={
  macros:[{
    id:'macro:explore>verify>reflect',sequence:['explore','verify','reflect'],components:['a','b'],
    occurrences:10,successes:9,verified:4,independent:3,holdoutTrials:4,holdoutSuccesses:3,distinctContexts:4,
    contextKeys:['a','b','c','d'],success01:.86,holdout01:.78,retention01:.72,transfer01:.66,confidence01:.8,
    counterfactualSupport01:.7,status:'promoted',createdAt:1,lastAt:1,lastOutcome01:.8,lastContext:'d',
    failureStreak:0,delayedSuccesses:2,applications:4,
  }],
  decisions:[],compositionAttempts:1,compositionPromotions:1,promotions:1,blocks:0,rollbackSignals:0,
  applications:2,positiveTransferApplications:1,negativeTransferApplications:0,holdoutGain01:.1,retention01:.72,
  abstraction01:.7,counterfactualRegret01:.2,revisionPressure01:.2,developmentalCoherence01:.8,lastDecision:'promoted',lastAt:1,
};
const p36={currentHypothesisId:'h1',hypotheses:[{id:'h1',area:'world-model'}]};

const ex=new DevelopmentalExecutiveEngine();
ex.syncGoals([goal],1000,synthesis,p36);
let d=ex.decide({tick:10,at:1000,state,goal,synthesis,p36,recentActions:['explore','verify'],contextKey:'goal-1|lab-a'});
assert.equal(d.chosenAction,'explore');
assert.ok(d.projectId);
assert.ok(d.score01>.5);

for(let i=0;i<4;i++) ex.observeOutcome({tick:11+i,at:2000+i*10000,goalId:'goal-1',action:i===0?'explore':i===1?'verify':i===2?'reflect':'respond',outcome01:.82,verified:true,contextKey:`goal-1|ctx-${i}`,delayed:i>=2,transfer:i>=3,revisionPressure01:.08});
const diag=ex.diagnostics();
assert.ok(diag.projects===1);
assert.ok(diag.successfulExecutions>=4);
assert.ok(diag.verifiedExecutions>=4);
assert.ok(diag.longHorizonProgress01>.18);

const snapshot=ex.snapshot();
const restored=new DevelopmentalExecutiveEngine();
restored.restore(snapshot);
assert.deepEqual(restored.snapshot(),snapshot);

for(let i=0;i<3;i++) restored.observeOutcome({tick:20+i,at:50000+i,goalId:'goal-1',action:'reflect',outcome01:.2,verified:true,contextKey:`bad-${i}`,delayed:false,transfer:true,revisionPressure01:.75});
const repaired=restored.diagnostics();
assert.equal(repaired.activeProject?.phase,'repair');
console.log('BIG_PASS_120_DEVELOPMENTAL_EXECUTIVE=PASS');
console.log(JSON.stringify({projects:repaired.projects,active:repaired.activeProjects,completed:repaired.completedProjects,successful:repaired.successfulExecutions,verified:repaired.verifiedExecutions,retention:repaired.activeProject?.retention01??0,transfer:repaired.activeProject?.transfer01??0,phase:repaired.activeProject?.phase??null,revisionPressure:repaired.revisionPressure01},null,2));
