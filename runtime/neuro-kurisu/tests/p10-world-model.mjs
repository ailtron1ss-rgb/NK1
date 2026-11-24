import assert from 'node:assert/strict';
import { WorldModel2 } from '../src/organism/developmental/WorldModel2.ts';
import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';

const model=new WorldModel2();
const env=new WorldEnvironment();
let initial = model.predict('move', .5, .7, env.snapshot());
const firstError=initial.uncertainty;
for(let i=0;i<16;i++){
  const before=env.observationContext();
  model.predict('move', .5, before.uncertainty, before);
  const tr=env.step('move');
  model.observeTransition({action:'move',before,after:tr.after,reward:tr.reward,surprise:tr.surprise,at:tr.at});
  if(i%2===1) env.step('observe');
}
const snap=model.snapshot();
assert.ok(snap.learnedTransitions>=16);
assert.ok(snap.readyForLearning);
assert.ok(Object.keys(snap.transitionHypotheses).length>0);
assert.ok(snap.causal.length>0);
assert.ok(snap.calibration.length>0);
const pred=model.predict('move',.5,.7,env.snapshot());
assert.ok(pred.confidence>=0 && pred.confidence<=1);
assert.ok(pred.modelReady);
assert.ok(pred.confidence !== initial.confidence || pred.uncertainty < firstError);
assert.ok(pred.uncertainty<firstError);
const rollout=model.rollout(['move','inspect','collect'],.5,env.snapshot());
assert.equal(rollout.path.length,3);
assert.ok(rollout.path.every(x=>Number.isFinite(x.reward)&&Number.isFinite(x.uncertainty)));
assert.ok(model.calibrationError()>=0 && model.calibrationError()<=1);
console.log(`P10_WORLD_MODEL=PASS learned=${snap.learnedTransitions} hypotheses=${Object.keys(snap.transitionHypotheses).length} causal=${snap.causal.length} calibration=${snap.calibration.length} confidence=${pred.confidence.toFixed(3)} uncertainty=${pred.uncertainty.toFixed(3)}`);
