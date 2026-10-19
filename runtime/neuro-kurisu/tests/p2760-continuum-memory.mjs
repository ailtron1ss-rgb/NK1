import assert from 'node:assert/strict';
import { P2750UnifiedCausalWorldLoop } from '../src/organism/cognition/P2750UnifiedCausalWorldLoop.ts';
const latent=t=>Array.from({length:8},(_,k)=>.33*Math.sin(k*.17+t*.031)+.11*Math.cos(k*.11-t*.013));
const utilities={respond:.72,explore:.58,verify:.62,rest:.34,reflect:.55,wait:.30,defer:.28};
function run(resource){
  const c=new P2750UnifiedCausalWorldLoop();
  let last;
  for(let t=0;t<480;t++){
    const l=latent(t), shift=t>160&&t<320;
    last=c.beforeDecision({tick:t,latent:l,baseUtilities:utilities,novelty01:shift?.62:.18,uncertainty01:shift?.58:.24,predictionError01:shift?.53:.16,resource01:resource,goalPressure01:.54,identityGap01:.12});
    const next=l.map((x,k)=>Math.max(-1,Math.min(1,x+.018*Math.sin((k+1)*.23+t*.01)+(shift?.011:0))));
    c.observeOutcome({tick:t+1,latentBefore:l,latentAfter:next,action:last.selectedAction,reward01:.66+(shift?.08:0),predictionError01:shift?.43:.18,novelty01:shift?.58:.19,uncertainty01:shift?.54:.23,verified01:shift?1:.82,contextId:last.contextId});
  }
  return {m:c.metrics(),last};
}
const rich=run(.92),tight=run(.16);
assert.ok(rich.m.fast.scheduledWrites>rich.m.medium.scheduledWrites,'fast memory did not update more frequently');
assert.ok(rich.m.medium.scheduledWrites>rich.m.slow.scheduledWrites,'medium memory did not update more frequently than slow');
assert.ok(tight.m.slow.scheduledWrites<rich.m.slow.scheduledWrites,'resource pressure did not reduce slow-memory writes');
assert.ok(rich.m.medium.bridgeIn01>0&&rich.m.slow.bridgeIn01>0,'cross-timescale bridges stayed inactive');
assert.ok(rich.m.memoryConsensus01>=0&&rich.m.memoryConsensus01<=1,'invalid memory consensus');
assert.ok(rich.m.fast.stableReads>0&&tight.m.slow.stableReads>0,'scheduled read accounting missing');
assert.ok(lastSafe(rich.last.learningScale01),'invalid learning scale');
console.log(`P2760_CONTINUUM_MEMORY=PASS richWrites=${rich.m.fast.scheduledWrites},${rich.m.medium.scheduledWrites},${rich.m.slow.scheduledWrites} `+
`tightSlow=${tight.m.slow.scheduledWrites} bridges=${rich.m.medium.bridgeIn01.toFixed(4)},${rich.m.slow.bridgeIn01.toFixed(4)} `+
`consensus=${rich.m.memoryConsensus01.toFixed(4)} richLearn=${rich.last.learningScale01.toFixed(4)}`);
function lastSafe(x){return Number.isFinite(x)&&x>=.72&&x<=1.12;}
