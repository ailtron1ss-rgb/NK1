import assert from 'node:assert/strict';
import { B261UnifiedWorldModel, defaultB261UnifiedWorldModel } from '../src/organism/cognition/B261UnifiedWorldModel.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const v=(phase,i)=>Array.from({length:24},(_,j)=>Math.tanh(Math.sin((i+1)*(j+1)*.17+phase*.31)));

function train(runReplay){
  const m=new B261UnifiedWorldModel();
  const hold=[];
  for(let i=0;i<80;i++){
    const before=v(1,i), action=actions[i%actions.length], after=v(2,i+(i%3===0?1:0));
    const reward=(action==='verify'?0.75:action==='explore'?0.60:0.40)+((i%7===0)?0.08:-0.02);
    m.train(before,action,after,Math.max(.05,Math.min(.95,reward)),i,'online');
    if(i%5===0) hold.push({before:v(1,100+i),action,after:v(2,100+i),reward01:reward});
  }
  const before=m.holdout(hold);
  if(runReplay) m.replay(12,100);
  const after=m.holdout(hold);
  const lesion=m.lesion(true);
  return {m,before,after,lesion,diag:m.diagnostics()};
}

const online=train(false), replay=train(true);
assert.equal(online.diag.trainingUpdates,80);
assert.equal(replay.diag.trainingUpdates>80,true);
assert.ok(replay.diag.replayGain01>=0);
assert.ok(Number.isFinite(replay.after.after01));
assert.ok(replay.after.samples>0);
const actionsOut=replay.m.compareActions(v(3,2));
const replayDiag=replay.m.diagnostics();
assert.equal(actionsOut.length,7);
const distinct=new Set(actionsOut.map(x=>x.predictedReward01.toFixed(8))).size;
assert.ok(distinct>1,'action-conditioned model must produce differentiated predictions');
assert.ok(distinct>1,'action-conditioned predictions must differ');
assert.ok(replay.lesion.transitionDrop01>=0);
const state=replay.m.snapshot();
const restored=new B261UnifiedWorldModel(); restored.restore(state);
assert.deepEqual(restored.snapshot(),state,'B261 state must survive restore round-trip');
const zero= new B261UnifiedWorldModel(); zero.restore(defaultB261UnifiedWorldModel());
const d0=zero.diagnostics(); assert.equal(d0.updates,0);
console.log(JSON.stringify({
  ok:true,
  onlineHoldout:online.after,
  replayHoldout:replay.after,
  holdoutGainComparedWithOnline:online.after.after01-replay.after.after01,
  replay:replay.diag.replayGain01,
  transitionError:replay.diag.onlineTransitionError01,
  rewardError:replay.diag.onlineRewardError01,
  actionSensitivity:replay.diag.actionSensitivity01,
  lesion:replay.lesion,
  restorePreserved:true
}));
