import assert from 'node:assert/strict';
import { ContextualWorldModel } from '../src/organism/world/ContextualWorldModel.ts';
const mk=(energy)=>({version:29,tick:1,at:0,needs:{energy,cognitiveLoad:.25,uncertainty:.3,socialNeed:.2,novelty:.5,identityCoherence:.8,goalPressure:.2},predictionError:.15,attentionBudget:.8,lastAction:'none',lastActionSuccess:null,autonomyScore:.5,selfPredictionError:.1,predictedNextAction:'none',lastPredictionConfidence:.5,worldContextVersion:1});
const model=new ContextualWorldModel();
let pre=model.predict(mk(.82),'rest').reward01;
for(let i=0;i<2000;i++){
  const e=.25+((i%50)/100);
  const s=mk(e);
  const reward=e<.5?.9:.15;
  model.observe(s,'rest',{reward01:reward,nextEnergy01:Math.min(1,e+.1),nextLoad01:.18,nextUncertainty01:.3,nextNovelty01:.4});
}
const low=model.predict(mk(.30),'rest').reward01;
const high=model.predict(mk(.72),'rest').reward01;
assert(low>high+0.22,`contextual separation weak: low=${low}, high=${high}`);
assert(Math.abs(.9-low) < .15,`low-context reward calibration weak: pre=${pre}, low=${low}`);
assert(model.snapshot().updates===2000);
console.log(`P26_CONTEXTUAL_WORLD=PASS low=${low.toFixed(3)} high=${high.toFixed(3)} pre=${pre.toFixed(3)}`);
