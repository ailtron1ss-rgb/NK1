import assert from 'node:assert/strict';
import { ActivePerceptionNeuralSubstrate } from '../src/organism/cognition/ActivePerceptionNeuralSubstrate.ts';

const model=new ActivePerceptionNeuralSubstrate();
const rows=[];
for(let i=0;i<220;i++){
  const uncertainty=0.25+(i%10)/20;
  const novelty=0.15+(i%7)/14;
  const reliability=0.35+(i%9)/12;
  const freshness=0.3+(i%8)/11;
  const conflict=(i%6)/10;
  const actionability=0.4+(i%5)/10;
  const budget=0.9-(i%4)/20;
  const predicted=model.rank({modalityFeatures:[reliability,freshness,conflict],uncertainty01:uncertainty,novelty01:novelty,actionability01:actionability,budget01:budget,modalityReliability01:reliability,modalityFreshness01:freshness,modalityConflict01:conflict,tick:i,at:i});
  const target=Math.max(0,Math.min(1,0.08+uncertainty*0.25+novelty*0.15+actionability*0.22+freshness*0.15-reliability*0.07-conflict*0.12));
  if(i>=1) model.observeGain(target,predicted.baselineGain01);
  rows.push({target,predicted:predicted.predictedGain01,baseline:predicted.baselineGain01});
}
const holdout=[]; for(let i=0;i<80;i++){
  const uncertainty=0.3+(i%10)/18, novelty=0.12+(i%7)/15, reliability=0.4+(i%9)/13, freshness=0.35+(i%8)/12, conflict=(i%6)/11, actionability=0.45+(i%5)/11, budget=.85-(i%4)/25;
  const predicted=model.rank({modalityFeatures:[reliability,freshness,conflict],uncertainty01:uncertainty,novelty01:novelty,actionability01:actionability,budget01:budget,modalityReliability01:reliability,modalityFreshness01:freshness,modalityConflict01:conflict,tick:1000+i,at:1000+i});
  const target=Math.max(0,Math.min(1,0.08+uncertainty*0.25+novelty*0.15+actionability*0.22+freshness*0.15-reliability*0.07-conflict*0.12));
  holdout.push({target,predicted:predicted.predictedGain01,baseline:predicted.baselineGain01});
}
const mae=a=>a.reduce((s,r)=>s+Math.abs(r.predicted-r.target),0)/a.length;
const bmae=a=>a.reduce((s,r)=>s+Math.abs(r.baseline-r.target),0)/a.length;
const modelMae=mae(holdout),baseMae=bmae(holdout);
const q=model.quality();
assert.equal(q.samples,219);
assert.ok(Number.isFinite(modelMae)&&Number.isFinite(baseMae));
const selection=model.choose([
  {modality:'vision',predictedGain01:.77,cost01:.4,priority01:.8},
  {modality:'audio',predictedGain01:.54,cost01:.2,priority01:.7},
  {modality:'sensor',predictedGain01:.62,cost01:.5,priority01:.65},
]);
assert.equal(selection.selected,'vision');
const snap=model.snapshot(); const restored=new ActivePerceptionNeuralSubstrate(); restored.restore(snap); assert.deepEqual(restored.snapshot(),snap);
console.log(JSON.stringify({samples:q.samples,quality:q,holdoutModelMae:modelMae,holdoutBaselineMae:baseMae,validatedByHoldout:modelMae<baseMae,selected:selection.selected,deterministicRestore:true}));
