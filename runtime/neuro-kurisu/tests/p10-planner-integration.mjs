import assert from 'node:assert/strict';
import { PlanEngine } from '../src/organism/world/PlanEngine.ts';
import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';
import { WorldModel2 } from '../src/organism/developmental/WorldModel2.ts';

const environment=new WorldEnvironment();
const model=new WorldModel2();
let calls=0;
const provider={predict(action,baseReward,context){calls++;assert.ok(context);const p=model.predict(String(action),baseReward,context.uncertainty,context);return {predicted:p.reward,confidence:p.confidence,samples:model.snapshot().learnedTransitions,uncertainty:p.uncertainty,modelReady:p.modelReady};}};
for(let i=0;i<12;i++){
  const before=environment.observationContext();
  const tr=environment.step(i%2===0?'move':'observe');
  model.observeTransition({action:i%2===0?'move':'observe',before,after:tr.after,reward:tr.reward,surprise:tr.surprise,at:tr.at});
}
const plan=new PlanEngine(environment,provider).build(null,'explore',3,3);
assert.ok(calls>0);
assert.ok(plan.steps.length>=1);
assert.ok(plan.steps.every(step=>Number.isFinite(step.predictedReward)&&Number.isFinite(step.confidence)));
console.log(`P10_PLANNER_INTEGRATION=PASS calls=${calls} steps=${plan.steps.length} value=${plan.expectedValue.toFixed(3)}`);
