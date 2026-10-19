import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map((a,i)=>[a,.3+i*.04]));
const v=(t)=>Array.from({length:64},(_,k)=>.3*Math.sin(k*.07+t*.03)+.12*Math.cos(k*.03-t*.01));
const b=new NeuralExperienceBranch();b.setExperimentalLayerEnabled(true);
for(let t=0;t<700;t++){
  const pressure=t>420?.18:.82;
  b.beforeDecision({tick:t,input:v(t),baseUtilities:base,predictionError01:.28+.12*(t%5===0),novelty01:.24+.16*(t%7===0),uncertainty01:pressure<.4?.66:.31,homeostasis01:.44,identityGap01:.15,goalPressure01:.48,reward01:.55,identityVector:Array(16).fill(.1),embodied:{cpuLoad01:pressure<.4?.88:.26,ramPressure01:pressure<.4?.92:.23,battery01:pressure<.4?.2:.84,sensorFreshness01:.94}});
  const action=actions[t%actions.length];b.afterOutcome({tick:t+1,action,reward01:.62+(t%17===0?.21:0),predictionError01:.27+(t%17===0?.28:0),verified01:t%17===0?1:.76,nextInput:v(t+1),holdout01:t%19===0?1:0,goalPressure01:.48,identityGap01:.15});
}
const d=b.diagnostics();
assert.ok(d.replayCompactions>0,'replay compaction did not activate');
assert.ok(d.replayCompactedTokens>0,'no replay tokens were compacted');
assert.ok(d.replayBuffer.length<=512,'replay buffer grew beyond hard bound');
assert.ok(d.replayBuffer.some(x=>x.input.length===0||x.selectedAssembly.length===0),'no compact replay records exist');
assert.ok(d.unifiedCausalWorldLoop.syntheticReplayUsed>=0);
console.log(`P2750_MOBILE_COMPACTION=PASS compactions=${d.replayCompactions} compacted=${d.replayCompactedTokens} buffer=${d.replayBuffer.length} world=${d.unifiedCausalWorldLoop.worldConfidence01.toFixed(4)}`);
