import assert from 'node:assert/strict';
import { CrossLayerAdaptiveArbiter } from '../src/organism/cognition/CrossLayerAdaptiveArbiter.ts';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const sources=['neural','causal','embodied','transfer','hierarchical','taskFree','personality','risk','memory','developmental'];
const zero=()=>Object.fromEntries(actions.map(a=>[a,0]));
const biases=Object.fromEntries(sources.map(s=>[s,zero()]));
let reward=0;
const a=new CrossLayerAdaptiveArbiter();
for(let t=1;t<=1600;t++){
  for(const s of sources) for(const x of actions) biases[s][x]=0;
  biases.neural.verify=t%11===0?.05:.005;
  biases.causal.verify=t%7===0?.07:.01;
  biases.embodied.respond=t%13===0?.06:.005;
  biases.transfer.explore=t%17===0?.05:.004;
  biases.memory.reflect=t%19===0?.06:.004;
  biases.developmental.reflect=t%23===0?.05:.003;
  const out=a.fuse({baseUtilities:Object.fromEntries(actions.map(x=>[x,.5])),biases,confidence01:Object.fromEntries(sources.map(s=>[s,.55])),uncertainty01:t%29===0?.9:.25,computeBudget01:.8,risk01:t%31===0?.88:.1});
  const act=actions.slice().sort((x,y)=>(.5+out.actionBias[y])-(.5+out.actionBias[x]))[0];
  const r=act==='verify'&&t%7===0?.9:act==='defer'&&t%31===0?.8:.58;
  a.learn({action:act,reward01:r,verified01:r>.75?1:.7,predictionError01:r<.6?.55:.12,biases,weights:out.weights}); reward+=r;
}
let fixedReward=0; for(let t=1;t<=1600;t++){const act='respond'; fixedReward += (t%31===0?.58:t%7===0?.58:.58);}
const adaptiveGain01=(reward-fixedReward)/Math.max(1,fixedReward);
const m=a.metrics();
assert.ok(m.updates===1600);assert.ok(m.fusionQuality01>.45);assert.ok(m.calibration01>.45);assert.ok(m.correctiveReroutes>0);assert.ok(m.disagreements>0);
const snap=a.snapshot(),restored=new CrossLayerAdaptiveArbiter();restored.restore(snap);assert.deepEqual(restored.snapshot(),snap);
const branch=new NeuralExperienceBranch();
const mk=t=>Array.from({length:64},(_,i)=>Math.sin(t*.071+i*.13)*.5+.5);
for(let t=1;t<=720;t++){
 const u=Object.fromEntries(actions.map((x,i)=>[x,.5+Math.sin(t*.03+i)*.025]));
 const out=branch.beforeDecision({tick:t,input:mk(t),baseUtilities:u,predictionError01:t%17===0?.78:.2,novelty01:.2+(t%10)/30,uncertainty01:.2+(t%19)/38,homeostasis01:.2,identityGap01:.2+(t%8)/50,goalPressure01:.45+(t%9)/40,identityVector:mk(t+2).slice(0,24),personalityVector:mk(t+4).slice(0,24)});
 const act=actions.slice().sort((x,y)=>(u[y]+out.actionBias[y])-(u[x]+out.actionBias[x]))[0];branch.commitAction(act,u);
 branch.afterOutcome({tick:t,action:act,reward01:act==='verify'&&t%17===0?.86:.62,predictionError01:t%17===0?.78:.2,verified01:t%17===0?.82:.72,nextInput:mk(t+1),identityGap01:.2,goalPressure01:.5,identityVector:mk(t+2).slice(0,24)});
}
const bm=branch.continuityMetrics();
assert.ok(bm.crossLayerArbiter.updates>=700,'arbiter not integrated');
assert.ok(bm.crossLayerArbiter.fusionQuality01>.4,'arbiter fusion degraded');
console.log(JSON.stringify({standalone:{updates:m.updates,fusionQuality01:m.fusionQuality01,calibration01:m.calibration01,disagreement01:m.disagreement01,reroutes:m.correctiveReroutes,disagreements:m.disagreements,reward,fixedReward,adaptiveGain01},branch:{cycles:bm.cycles,arbiterUpdates:bm.crossLayerArbiter.updates,fusionQuality01:bm.crossLayerArbiter.fusionQuality01,calibration01:bm.crossLayerArbiter.calibration01,reroutes:bm.crossLayerArbiter.correctiveReroutes}}));
