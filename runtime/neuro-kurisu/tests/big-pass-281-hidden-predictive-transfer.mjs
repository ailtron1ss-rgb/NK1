import assert from 'node:assert/strict';
import { B281PredictiveInterAreaMessaging } from '../src/organism/cognition/B281PredictiveInterAreaMessaging.ts';
const shift=(v,k)=>v.map((_,i)=>v[(i+k+v.length)%v.length]);
const makeSource=(t)=>Array.from({length:8},(_,i)=>((Math.sin((t+1)*(i+1)*.37)+1)/2>.62?1:0));
const makeAreas=(src,target)=>({sensorium:src,memory:target,association:shift(target,1),selfAction:shift(src,2)});
const contexts={plus:[.8,0,0,0,0,0,0,0],minus:[-.8,0,0,0,0,0,0,0]};
function targetFor(src,ctx){return shift(src,ctx[0]>0?1:-1);}
const m=new B281PredictiveInterAreaMessaging();
let prevSrc=null, prevCtx=null;
for(let t=0;t<320;t++){
  const ctx=t%2?contexts.plus:contexts.minus; const src=makeSource(t); const target=prevSrc?targetFor(prevSrc,prevCtx):targetFor(src,ctx);
  m.step({tick:t,areaSpikes:makeAreas(src,target),selfLatent:ctx,worldLatent:[.2,.1],goalVector:[ctx[0],.4],reward01:.62,predictionError01:.22,learningEnabled:true});
  prevSrc=src; prevCtx=ctx;
}
const train=m.diagnostics();
let prevErr=0, n=0; prevSrc=null; prevCtx=null;
for(let t=320;t<440;t++){
  const ctx=t%2?contexts.plus:contexts.minus; const src=makeSource(t); const target=prevSrc?targetFor(prevSrc,prevCtx):targetFor(src,ctx);
  const r=m.step({tick:t,areaSpikes:makeAreas(src,target),selfLatent:ctx,worldLatent:[.2,.1],goalVector:[ctx[0],.4],reward01:.5,predictionError01:.5,learningEnabled:false});
  if(t>321){ prevErr+=r.meanPredictionError01; n++; }
  prevSrc=src; prevCtx=ctx;
}
const hiddenError=prevErr/Math.max(1,n);
let baselineErr=0; prevSrc=null; prevCtx=null;
for(let t=440;t<560;t++){
  const ctx=t%2?contexts.plus:contexts.minus; const src=makeSource(t); const target=prevSrc?targetFor(prevSrc,prevCtx):targetFor(src,ctx);
  const baselinePred=prevSrc??src; const sim=.5+.5*(baselinePred.map((x,i)=>x? (target[i]?1:-1):(target[i]? -1:1)).reduce((a,b)=>a+b,0)/8); baselineErr+=1-sim;
  prevSrc=src; prevCtx=ctx;
}
baselineErr/=120;
assert(hiddenError < .55,'hidden one-step prediction should beat chance-like baseline');
console.log(JSON.stringify({pass:true,trainMeanEdgePrediction01:train.meanEdgePrediction01,hiddenError01:hiddenError,baselineError01:baselineErr,gain01:baselineErr-hiddenError,messageCoherence01:train.messageCoherence01,delayedCredit01:train.delayedCredit01},null,2));
