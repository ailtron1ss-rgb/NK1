import assert from 'node:assert/strict';
import { B2513FutureSelfProjectionField } from '../src/organism/cognition/B2513FutureSelfProjectionField.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const v=(seed)=>Array.from({length:24},(_,i)=>.45+.08*Math.sin(i*.31+seed));
const model=new B2513FutureSelfProjectionField();
const identity=v(.1),semantic=v(.2),self=v(.3),world=v(.4),goal=v(.5);
for(let t=0;t<700;t++){
  const action=t%4===0?'verify':t%4===1?'respond':'explore';
  const frame=model.beforeDecision({tick:t,identityLatent:identity,semanticLatent:semantic,selfLatent:self,worldLatent:world,goalVector:goal,actionValues:Object.fromEntries(actions.map(a=>[a,.5])),uncertainty01:.42,predictionError01:.35,autonomy01:.76,horizon:3});
  const reward=action==='verify'?.92:action==='respond'?.55:.22;
  model.afterOutcome({tick:t,action,reward01:reward,verified01:1,identityContinuity01:frame.identityContinuity01,goalConsistency01:frame.goalConsistency01,predictionError01:Math.abs(reward-frame.actionBias[action])});
}
const d=model.diagnostics();
const learned=d.actionUtility.verify-d.actionUtility.explore;
assert.ok(d.learningUpdates>=700);
assert.ok(learned>.03,`future-self action learning margin ${learned}`);
assert.ok(d.futureCoherence01>.55);
assert.ok(d.predictionError01<.30);
console.log(JSON.stringify({pass:true,status:'B2513_LEARNING_HOLDOUT_PASS',learnedVerifyVsExplore:learned,diagnostics:d},null,2));
