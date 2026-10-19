import assert from 'node:assert/strict';
import { ExternalGroundingAdaptiveController } from '../src/organism/cognition/ExternalGroundingAdaptiveController.ts';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const sensor=(tick,f=.9,c=.8)=>({tick,values:[.2,.4,.8],freshness01:f,confidence01:c,ageTicks:Math.round((1-f)*100),source:'android-termux'});
const c=new ExternalGroundingAdaptiveController();
for(let t=1;t<=1400;t++){
 const sensors=t%37===0?{}:{battery:sensor(t,t%23===0?.2:.92,.82),motion:sensor(t,t%31===0?.35:.88,.76),environment:sensor(t,.84,.72)};
 const b=c.beforeDecision({tick:t,sensors,uncertainty01:t%17===0?.88:.22,novelty01:.3,predictionError01:t%19===0?.78:.18,computeBudget01:.82});
 c.afterOutcome({tick:t,action:b.activeQuery?'verify':'respond',reward01:b.activeQuery?.78:.62,verified01:b.activeQuery?.9:.72,predictionError01:b.activeQuery?.18:.22,sensors,observedContradiction01:t%29===0?.72:.03});
}
const m=c.metrics();assert.ok(m.decisions===1400);assert.ok(m.channelCount===3);assert.ok(m.channelLearningUpdates>0);assert.ok(m.grounding01>.45);assert.ok(m.activeQueries>0);assert.ok(m.contradictions>0);
const snap=c.snapshot(),r=new ExternalGroundingAdaptiveController();r.restore(snap);assert.deepEqual(r.snapshot(),snap);
const branch=new NeuralExperienceBranch();
const mk=t=>Array.from({length:64},(_,i)=>Math.sin(t*.06+i*.11)*.5+.5);
for(let t=1;t<=500;t++){
 const sensors={camera:sensor(t,t%17===0?.25:.9,.78),motion:sensor(t,.86,.74)};
 const u=Object.fromEntries(['respond','explore','verify','rest','reflect','wait','defer'].map((a,i)=>[a,.5+Math.sin(i+t*.02)*.02]));
 const out=branch.beforeDecision({tick:t,input:mk(t),baseUtilities:u,predictionError01:t%17===0?.78:.2,novelty01:.3,uncertainty01:t%19===0?.84:.24,homeostasis01:.2,identityGap01:.2,goalPressure01:.5,identityVector:mk(t).slice(0,24),personalityVector:mk(t+1).slice(0,24),embodied:{sensors,sensorFeatures:mk(t),sensorFreshness01:.82}});
 const act=['respond','explore','verify','rest','reflect','wait','defer'].sort((a,b)=>(u[b]+out.actionBias[b])-(u[a]+out.actionBias[a]))[0];branch.commitAction(act,u);
 branch.afterOutcome({tick:t,action:act,reward01:act==='verify'&&t%17===0?.86:.62,predictionError01:t%17===0?.78:.2,verified01:t%17===0?.84:.72,nextInput:mk(t+1),identityGap01:.2,goalPressure01:.5,identityVector:mk(t).slice(0,24),embodied:{sensors,sensorFreshness01:.82}});
}
const bm=branch.continuityMetrics();assert.ok(bm.externalGrounding.decisions>=500);assert.ok(bm.externalGrounding.channelLearningUpdates>0);assert.ok(bm.crossLayerArbiter.updates>=500);
console.log(JSON.stringify({standalone:{grounding01:m.grounding01,consensus01:m.sensorConsensus01,activeQueries:m.activeQueries,contradictions:m.contradictions,externalTransfer01:m.externalTransfer01},branch:{grounding01:bm.externalGrounding.grounding01,channels:bm.externalGrounding.channelCount,arbiterFusion01:bm.crossLayerArbiter.fusionQuality01,cycles:bm.cycles}}));
