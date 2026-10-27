import assert from 'node:assert/strict';
import { ParametricPolicyLearner } from '../src/organism/learning/ParametricPolicyLearner.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const mkState=(energy,novelty,uncertainty)=>({
  version:29,tick:1,at:0,
  needs:{energy,cognitiveLoad:.3,uncertainty,socialNeed:.2,novelty,identityCoherence:.8,goalPressure:.25},
  predictionError:.2,attentionBudget:.8,lastAction:'none',lastActionSuccess:null,autonomyScore:.5,
  selfPredictionError:.1,predictedNextAction:'none',lastPredictionConfidence:.5,worldContextVersion:1,
});
const target=(s,a)=>s.needs.energy<.5 ? (a==='rest'?.95:.05) : (a==='respond'?.95:.05);

const learner=new ParametricPolicyLearner();
const train=[];
for(let epoch=0;epoch<8;epoch++) for(let i=0;i<360;i++){
  const energy=.25+((i*37)%70)/100;
  const novelty=((i*19)%100)/100;
  const uncertainty=((i*47)%100)/100;
  const state=mkState(energy,novelty,uncertainty);
  for(const a of actions){train.push({state,action:a,target01:target(state,a),learningRate01:.06});}
}
const before=[];
for(let i=0;i<120;i++){
  const state=mkState(.31+((i*13)%34)/100,.66+((i*7)%30)/100,.58+((i*17)%34)/100);
  const preds=learner.predict(state);
  before.push(Number(preds.slice().sort((a,b)=>b.value-a.value)[0].action==='explore'));
}
learner.trainBatch(train);
let correct=0;
for(let i=0;i<120;i++){
  const energy=i<60 ? .31+((i*17)%17)/100 : .55+((i*13)%40)/100;
  const state=mkState(energy,.2+((i*7)%60)/100,.2+((i*11)%70)/100);
  const expected=energy<.5?'rest':'respond';
  const best=learner.predict(state).slice().sort((a,b)=>b.value-a.value)[0].action;
  if(best===expected) correct++;
}
const learned=correct/120;
assert(learner.snapshot().updates===train.length);
assert(learned>0.90,`held-out generalization too low: ${learned}`);

const hardened=new ParametricPolicyLearner();
hardened.restore({weights:{explore:[NaN,Infinity,-Infinity]},bias:{explore:NaN}});
assert.ok(Object.values(hardened.snapshot().weights).flat().every(Number.isFinite), 'restored policy weights must remain finite');
assert.ok(Object.values(hardened.snapshot().bias).every(Number.isFinite), 'restored policy biases must remain finite');
assert.throws(
  () => hardened.train({state:mkState(.7,.4,.3),action:'explore',target01:.9,learningRate01:NaN,sampleWeight01:NaN}),
  /rate-must-be-finite/,
  'non-finite learning controls must be rejected before any parameter update',
);
assert.ok(Object.values(hardened.snapshot().weights).flat().every(Number.isFinite), 'rejected learning rates must not poison learned weights');
assert.ok(Object.values(hardened.snapshot().bias).every(Number.isFinite), 'rejected sample weights must not poison learned biases');
assert.equal(hardened.snapshot().updates,0);
assert.throws(
  () => hardened.trainFeatures({features:new Array(15).fill(.5),action:'explore',target01:.8,learningRate01:Infinity,sampleWeight01:NaN}),
  /rate-must-be-finite/,
  'feature-level training must reject non-finite controls at the same boundary',
);
assert.ok(Object.values(hardened.snapshot().weights).flat().every(Number.isFinite), 'feature-level rejection must preserve finite weights');
assert.ok(Object.values(hardened.snapshot().bias).every(Number.isFinite), 'feature-level rejection must preserve finite biases');
assert.equal(hardened.snapshot().updates,0);
console.log(`P26_TRUE_LEARNING=PASS updates=${learner.snapshot().updates} heldout=${learned.toFixed(3)} preExplore=${(before.reduce((a,b)=>a+b,0)/before.length).toFixed(3)} finiteGuard=PASS`);
