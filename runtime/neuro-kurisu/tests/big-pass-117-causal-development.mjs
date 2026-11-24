import assert from 'node:assert/strict';
import { CausalDevelopmentLoop } from '../src/organism/learning/CausalDevelopmentLoop.ts';
const loop=new CausalDevelopmentLoop();
const base=(tick,energy=.72,unc=.42)=>({version:122,tick,at:Date.now(),needs:{energy,cognitiveLoad:.2,uncertainty:unc,novelty:.6,socialNeed:.25,identityCoherence:.86,goalPressure:.45},predictionError:.2,attentionBudget:.8,lastAction:'explore',lastActionSuccess:.8,autonomyScore:.72,selfPredictionError:.2,predictedNextAction:'explore',lastPredictionConfidence:.8,worldContextVersion:1});
for(let i=0;i<12;i++){
  const before=base(i,.68+i*.006,.5-i*.01), after=base(i,.82+i*.004,.34-i*.008);
  loop.observeOutcome({tick:i,at:Date.now(),taskId:'source-task',action:'explore',before,after,reward01:.86,success01:.88,surprise01:.18,verified:true,independent:true,worldTransition:true,externalEvidence:true,contextKey:`lab|room-a|object:${i%3}|e${Math.floor(before.needs.energy*4)}`});
}
const diag=loop.diagnostics();
assert.equal(diag.samples,12);
assert.ok(diag.worldLearningEvents===12);
assert.ok(diag.selfLearningEvents===12);
assert.ok(diag.verifiedUpdates===12);
assert.ok(diag.meanEvidence01>.55);
const prior=loop.actionPrior('explore','new-task',base(100,.76,.4));
assert.equal(prior.eligible,true);
assert.ok(prior.bias01>0);
loop.noteTransfer(prior.bias01,prior.eligible);
const hold=loop.evaluateHoldout(.50,.71);
assert.ok(hold.delta01>.2);
const snap=loop.snapshot(); const restored=new CausalDevelopmentLoop(); restored.restore(snap);
assert.equal(restored.diagnostics().samples,12);
console.log(`BIG_PASS_117=PASS samples=${diag.samples} verified=${diag.verifiedUpdates} transferBias=${prior.bias01.toFixed(4)} holdoutDelta=${hold.delta01.toFixed(3)}`);
