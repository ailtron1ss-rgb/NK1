import assert from 'node:assert/strict';
import { SelfOptimizingAutobiographicalMemory } from '../src/organism/cognition/SelfOptimizingAutobiographicalMemory.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const base={respond:.5,explore:.52,verify:.50,rest:.48,reflect:.49,wait:.47,defer:.46};
const run=adaptive=>{
  const m=adaptive?new SelfOptimizingAutobiographicalMemory():null;
  let reward=0,correct=0,shocks=0;
  for(let t=1;t<=1400;t++){
    const shock=(t%31>=20&&t%31<=25)||(t>800&&t%47<8); if(shock)shocks++;
    const context=Array.from({length:24},(_,i)=>Math.sin((i+2)*(t%41+1)*.057)+((i*11+t*5)%23)/22*.16);
    const identity=Array.from({length:16},(_,i)=>Math.cos((i+3)*(t%29+1)*.049));
    let redirect=null;
    if(m){
      const out=m.beforeDecision({tick:t,context,identityVector:identity,goalPressure01:shock?.84:.62,identityGap01:shock?.74:.22,novelty01:shock?.76:.25,uncertainty01:shock?.82:.20,predictionError01:shock?.79:.13,computeBudget01:shock?.55:.86});
      redirect=out.redirectAction;
    }
    const nominal=(t%7===0?'explore':t%5===0?'verify':'respond');
    const action=adaptive?(redirect??nominal):nominal;
    const outcome=shock?(action==='verify'?.82:action==='reflect'?.70:action==='explore'?.49:.36):(action==='explore'?.80:action==='verify'?.84:action==='reflect'?.77:.65);
    reward+=outcome;
    const expectedBest=shock?outcome>=.70:outcome>=.75; if(expectedBest)correct++;
    if(m)m.afterOutcome({tick:t,context,identityVector:identity,goalPressure01:shock?.84:.62,identityGap01:shock?.74:.22,novelty01:shock?.76:.25,uncertainty01:shock?.82:.20,reward01:outcome,predictionError01:shock?.72:.16,verified01:action==='verify'?1:(t%5===0?1:.82),action,holdout01:t%13===0?1:0});
  }
  return {meanReward:reward/1400,correctRate:correct/1400,metrics:m?.metrics()??null,shocks};
};
const adaptive=run(true),plain=run(false);
const gain=adaptive.meanReward-plain.meanReward;
assert(adaptive.metrics.liveRedirects>100);
assert(adaptive.meanReward>=plain.meanReward-.01,`adaptive underperformed too much: ${adaptive.meanReward} vs ${plain.meanReward}`);
console.log('P2627_2640_ABLATION_PASS',JSON.stringify({adaptiveMeanReward:Number(adaptive.meanReward.toFixed(6)),plainMeanReward:Number(plain.meanReward.toFixed(6)),rewardGain01:Number(gain.toFixed(6)),adaptiveCorrectRate:Number(adaptive.correctRate.toFixed(6)),plainCorrectRate:Number(plain.correctRate.toFixed(6)),shockCount:adaptive.shocks,liveRedirects:adaptive.metrics.liveRedirects,strategyLearning01:adaptive.metrics.strategyLearning01,holdout01:adaptive.metrics.holdout01},null,2));
