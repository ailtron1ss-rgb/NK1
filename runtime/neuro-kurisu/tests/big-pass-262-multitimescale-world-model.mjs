import assert from 'node:assert/strict';
import { B262MultiTimescaleWorldModel } from '../src/organism/cognition/B262MultiTimescaleWorldModel.ts';

const model = new B262MultiTimescaleWorldModel();
const truth = (before, action, t) => before.map((v,i)=>Math.tanh(v*.58 + Math.sin((i+1)*.07+t*.11 + action.length)*.08));
const samples=[];
for(let i=0;i<72;i++){
  const before=Array.from({length:24},(_,j)=>Math.sin(i*.13+j*.17));
  const actions=['respond','explore','verify','rest','reflect','wait','defer'];
  const action=actions[i%actions.length];
  const after=truth(before,action,i); const reward=.2+.6*((i%9)/8);
  model.train(before,action,after,reward,i,true); if(i%12===0) samples.push({before,action,after,reward01:reward});
}
const before=Array.from({length:24},(_,i)=>Math.cos(i*.21));
const short=model.predict(before,'verify',1), mid=model.predict(before,'verify',4), long=model.predict(before,'verify',8);
const plan=model.plan(before,4);
const cf=model.counterfactual(before,'verify','explore');
const hold=model.holdout(samples);
const replay=model.replay(16,100);
const lesion=model.lesion('long');
const snapshot=model.snapshot(); const restored=new B262MultiTimescaleWorldModel(); restored.restore(snapshot);
assert.ok(model.diagnostics().updates>=72);
assert.equal(plan.steps.length,4);
assert.ok(plan.alternatives.length>=1);
assert.ok(Number.isFinite(cf.rewardDelta01));
assert.equal(hold.samples,samples.length);
assert.ok(replay.episodes>0);
assert.ok(replay.delayedHorizonUpdates>0,'replay must perform delayed multi-timescale updates');
assert.equal(restored.snapshot().updates,snapshot.updates);
assert.ok(Number.isFinite(lesion.drop01));
console.log(JSON.stringify({ok:true,updates:model.diagnostics().updates,shortError01:model.diagnostics().shortError01,midError01:model.diagnostics().midError01,longError01:model.diagnostics().longError01,horizonGain01:model.diagnostics().horizonGain01,replayEpisodes:replay.episodes,replayGain01:model.diagnostics().replayGain01,holdout:hold,planningScore:plan.score,planningDepth:plan.depth,planningAdvantage01:plan.planningAdvantage01,counterfactualRewardDelta01:cf.rewardDelta01,stateDistance01:cf.stateDistance01,delayedHorizonUpdates:replay.delayedHorizonUpdates,lesionLongDrop01:lesion.drop01,restorePreserved:true,uncertainty01:model.diagnostics().uncertainty01}));
