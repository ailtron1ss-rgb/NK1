import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'];
const vector=(context,seed=9)=>Array.from({length:64},(_,i)=>Math.max(-1,Math.min(1,((((context+1)*(i+5)+(seed+3)*13)%31)/15)-1)));
const rows=[];
for(let seed=1;seed<=6;seed++){
  const common=new B365UnifiedNeuroCausalCore();
  for(let t=1;t<=36;t++){
    const r=common.step({tick:t,vector:vector(t%3,seed),novelty01:t%5===0?.75:.22,uncertainty01:t%4===0?.6:.2,predictionError01:.15,goalPressure01:.3,learningEnabled:true});
    common.learnFromOutcome({tick:t,action:r.selectedAction,reward01:.52,predictionError01:.12,verified01:t%6===0?1:0,externalEvidence01:t%9===0?1:0});
  }
  const snap=common.snapshot();
  const positive=new B365UnifiedNeuroCausalCore(); positive.restore(snap);
  const negative=new B365UnifiedNeuroCausalCore(); negative.restore(snap);
  const probe=positive.step({tick:37,vector:vector(7,seed),novelty01:.31,uncertainty01:.28,predictionError01:.12,goalPressure01:.4,learningEnabled:false});
  // Train the same neural eligibility with opposite outcome directions on a held-out context.
  for(let t=37;t<61;t++){
    const r=positive.step({tick:t,vector:vector(7,seed),novelty01:.31,uncertainty01:.28,predictionError01:.12,goalPressure01:.4,learningEnabled:true});
    positive.learnFromOutcome({tick:t,action:'rest',reward01:.92,predictionError01:.08,verified01:1,externalEvidence01:1});
    const n=negative.step({tick:t,vector:vector(7,seed),novelty01:.31,uncertainty01:.28,predictionError01:.12,goalPressure01:.4,learningEnabled:true});
    negative.learnFromOutcome({tick:t,action:'rest',reward01:.08,predictionError01:.42,verified01:1,externalEvidence01:1});
  }
  const hp=positive.step({tick:61,vector:vector(8,seed),novelty01:.27,uncertainty01:.34,predictionError01:.11,goalPressure01:.35,learningEnabled:false});
  const hn=negative.step({tick:61,vector:vector(8,seed),novelty01:.27,uncertainty01:.34,predictionError01:.11,goalPressure01:.35,learningEnabled:false});
  const l1=ACTIONS.reduce((s,a)=>s+Math.abs(hp.actionProbabilities[a]-hn.actionProbabilities[a]),0);
  assert.ok(l1>.01,`seed ${seed}: opposite outcome histories failed to separate policy ${l1}`);
  rows.push({seed,l1:Number(l1.toFixed(6)),restPositive:Number(hp.actionProbabilities.rest.toFixed(6)),restNegative:Number(hn.actionProbabilities.rest.toFixed(6)),learningPositive:positive.diagnostics().learningUpdates,learningNegative:negative.diagnostics().learningUpdates});
}
console.log(JSON.stringify({pass:true,status:'B365_NEURAL_OUTCOME_HISTORY_TRANSFER_PASS',seeds:rows.length,minPolicyL1:Math.min(...rows.map(r=>r.l1)),rows},null,2));
