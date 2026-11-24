import assert from 'node:assert/strict';
import { B285NeuralLifeConsolidationCore } from '../src/organism/cognition/B285NeuralLifeConsolidationCore.ts';
const core=new B285NeuralLifeConsolidationCore();
for(let t=1;t<=420;t++){
  const regime=t<210?0:1;
  const self=Array.from({length:24},(_,i)=>Math.sin(i*.19+t*.013+regime*.55));
  const world=Array.from({length:16},(_,i)=>Math.cos(i*.17+t*.011+regime*.41));
  const goal=Array.from({length:8},(_,i)=>Math.sin(i*.37+t*.009+regime*.7));
  const memory=Array.from({length:16},(_,i)=>Math.cos(i*.23+t*.008));
  const relation=Array.from({length:24},(_,i)=>Math.sin(i*.09+(t%4)*.8+regime*.3));
  const reward=regime? .78-.12*Math.cos(t*.07): .58+.10*Math.sin(t*.06);
  core.step({tick:t,selfLatent:self,worldLatent:world,goalVector:goal,memoryLatent:memory,relationshipVector:relation,relationshipId:regime?'future-phase':'early-phase',reward01:reward,predictionError01:.14,agency01:.76,learningEnabled:true,importance01:regime?.76:.45});
}
const d=core.diagnostics();
assert(d.chapterCount>=10);
assert(d.relationshipCount===2);
assert(d.autobiographicalCompression01>.65);
assert(d.futureConsistency01>.55);
assert(d.futureIdentityAlignment01>.5);
const future=core.predictFuture(32);
const replayed=new B285NeuralLifeConsolidationCore(); replayed.restore(core.snapshot());
const before=replayed.diagnostics();
replayed.replay(16);
const after=replayed.diagnostics();
assert(after.replayUpdates>before.replayUpdates);
const ablation=replayed.futureSelfAblation(future); assert(ablation>0.001);
console.log(JSON.stringify({ok:true,d,future32:future,ablation,replayDelta:after.replayUpdates-before.replayUpdates}));
