import assert from 'node:assert/strict';
import { EmbodiedRecoveryController, defaultEmbodiedRecoveryState } from '../src/organism/body/EmbodiedRecoveryController.ts';

function step(controller, input){ return controller.record({ artifact:false, verificationMode:'none', sourceStable:true, freshBefore01:1, freshAfter01:1, ...input }); }

// ON: repeated physical failures must produce probe/degraded/blocked states and backoff.
const on = new EmbodiedRecoveryController(defaultEmbodiedRecoveryState());
for(let tick=1; tick<=5; tick++) step(on,{tick,at:tick*1000,action:'explore',status:'failed',realityClass:'derived',source:'android-termux',verified01:0,independent01:0,effect01:0,consequenceError01:1});
const blocked=on.advise('explore',10_000_000);
assert.equal(blocked.allowed,false);
assert.equal(blocked.mode,'blocked');
const failedState=on.snapshot().actionStates.explore;
assert.ok(failedState.failureStreak>=5);
assert.ok(failedState.cooldownUntil>0);

// Recovery after a verified independent observation must clear the streak and cooldown path.
step(on,{tick:6,at:6_000,action:'verify',status:'executed',realityClass:'device-observation',source:'android-termux',verified01:1,independent01:1,effect01:.8,consequenceError01:.1});
step(on,{tick:7,at:7_000,action:'explore',status:'executed',realityClass:'device-observation',source:'android-termux',verified01:1,independent01:1,effect01:.7,consequenceError01:.2});
const recovered=on.snapshot().actionStates.explore;
assert.equal(recovered.failureStreak,0);
assert.equal(on.snapshot().mode,'normal');

// OFF: controller disabled must never veto an action and must not manufacture recovery state.
const offState=defaultEmbodiedRecoveryState(); offState.enabled=false;
const off=new EmbodiedRecoveryController(offState);
for(let tick=1; tick<=20; tick++) step(off,{tick,at:tick*100,action:'explore',status:'failed',realityClass:'derived',source:'node-host',verified01:0,independent01:0,effect01:0,consequenceError01:1});
assert.equal(off.advise('explore',1_000_000).allowed,true);
assert.equal(off.advise('explore',1_000_000).mode,'normal');

// Deterministic long-horizon stress: 5000 mixed cycles with periodic dropout/failure and recovery.
const stress = new EmbodiedRecoveryController();
for(let tick=1;tick<=5000;tick++){
  const action=tick%5===0?'respond':tick%7===0?'wait':'explore';
  const fail=(tick%97===0)||(tick%311===0);
  const dropout=tick%113===0;
  step(stress,{tick,at:tick*1000,action,status:fail?'failed':'executed',realityClass:fail?'device-actuation':'device-observation',source:'android-termux',verified01:fail||dropout?0:1,independent01:fail||dropout?0:1,effect01:fail?0:.4+(tick%11)/20,consequenceError01:fail?1:.08+(tick%9)/100,freshBefore01:dropout?0:1,freshAfter01:dropout?0:1});
}
const ss=stress.snapshot();
assert.equal(ss.totalEpisodes,5000);
assert.ok(ss.episodes.length<=192);
assert.ok(ss.recoveryEvents>0);
assert.ok(ss.verifiedEpisodes>4000);
assert.ok(Number.isFinite(ss.globalReliability01));
const restart=new EmbodiedRecoveryController(ss);
assert.deepEqual(restart.snapshot(),ss);

console.log(JSON.stringify({pass:true,status:'B379_EMBODIED_RECOVERY_CAUSAL_PASS',blocked:{mode:blocked.mode,reliability01:blocked.reliability01,failureStreak:failedState.failureStreak},recovered:{failureStreak:recovered.failureStreak,reliability01:recovered.reliability01},longHorizon:{episodes:ss.totalEpisodes,recoveryEvents:ss.recoveryEvents,verified:ss.verifiedEpisodes,sensorDropouts:ss.sensorDropouts,globalReliability01:ss.globalReliability01},restartEqual:true,off:{allowed:off.advise('explore',1_000_000).allowed,mode:off.advise('explore',1_000_000).mode}},null,2));
