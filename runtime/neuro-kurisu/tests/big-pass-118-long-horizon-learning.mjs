import assert from 'node:assert/strict';
import { CausalDevelopmentLoop } from '../src/organism/learning/CausalDevelopmentLoop.ts';

const loop=new CausalDevelopmentLoop();
const base=(tick)=>({version:122,tick,at:Date.now(),needs:{energy:.76,cognitiveLoad:.18,uncertainty:.34,novelty:.58,socialNeed:.24,identityCoherence:.88,goalPressure:.52},predictionError:.14,attentionBudget:.84,lastAction:'explore',lastActionSuccess:.86,autonomyScore:.78,selfPredictionError:.16,predictedNextAction:'verify',lastPredictionConfidence:.82,worldContextVersion:1});
let at=100000;
for(let episode=0;episode<7;episode++){
  const context=`lab-${episode}|sensor-${episode%3}|condition-${episode%2}`;
  const b=base(episode*2); b.at=at;
  loop.observeOutcome({tick:episode*2,at,taskId:'long-task',action:'explore',before:b,after:{...b,at:at+5000,needs:{...b.needs,uncertainty:.29,energy:.78}},reward01:.88,success01:.9,surprise01:.12,verified:true,independent:true,worldTransition:true,externalEvidence:true,contextKey:context});
  at+=7000;
  const c=base(episode*2+1); c.at=at; c.lastAction='explore';
  loop.observeOutcome({tick:episode*2+1,at,taskId:'long-task',action:'verify',before:c,after:{...c,at:at+3000,needs:{...c.needs,uncertainty:.22,energy:.75}},reward01:.9,success01:.91,surprise01:.1,verified:true,independent:true,worldTransition:true,externalEvidence:true,contextKey:context});
  at+=7000;
}
const diag=loop.behavioralDiagnostics();
assert.ok(diag.sequences>=2);
assert.ok(diag.promoted>=1,JSON.stringify(diag));
const transferState=base(99); transferState.at=at+1000;
loop.observeOutcome({tick:99,at:at+1000,taskId:'transfer-task',action:'explore',before:transferState,after:{...transferState,needs:{...transferState.needs,uncertainty:.31}},reward01:.83,success01:.86,surprise01:.14,verified:true,independent:true,worldTransition:true,externalEvidence:true,contextKey:'transfer-lab'});
const prior=loop.behavioralSkillPrior('verify','transfer-task',transferState);
assert.equal(prior.eligible,true,JSON.stringify(loop.behavioralDiagnostics()));
assert.ok(prior.bias01>0);
const snap=loop.snapshot();
const restored=new CausalDevelopmentLoop(); restored.restore(snap);
assert.equal(restored.behavioralDiagnostics().promoted,diag.promoted);
// A promoted sequence must fail out of influence after two clearly bad delayed outcomes.
for(let i=0;i<2;i++){
  at+=10000;
  const b=base(100+i*2); b.at=at;
  loop.observeOutcome({tick:100+i*2,at,taskId:'long-task',action:'explore',before:b,after:{...b,at:at+2000,needs:{...b.needs,uncertainty:.8,energy:.3}},reward01:.15,success01:.12,surprise01:.7,verified:true,independent:true,worldTransition:true,externalEvidence:true,contextKey:`bad-${i}`});
  at+=3000;
  const c=base(101+i*2); c.at=at;
  loop.observeOutcome({tick:101+i*2,at,taskId:'long-task',action:'verify',before:c,after:{...c,at:at+2000,needs:{...c.needs,uncertainty:.82,energy:.28}},reward01:.14,success01:.11,surprise01:.72,verified:true,independent:true,worldTransition:true,externalEvidence:true,contextKey:`bad-${i}`});
}
assert.ok(loop.behavioralDiagnostics().rollbackSignals>=1);
console.log(`BIG_PASS_118=PASS promoted=${diag.promoted} sequences=${diag.sequences} priorBias=${prior.bias01.toFixed(4)} rollbackSignals=${loop.behavioralDiagnostics().rollbackSignals}`);
