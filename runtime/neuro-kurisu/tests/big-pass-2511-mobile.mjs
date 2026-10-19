import assert from 'node:assert/strict';
import { B2511ActiveEpistemicExperimentController } from '../src/organism/cognition/B2511ActiveEpistemicExperimentController.ts';
const c=new B2511ActiveEpistemicExperimentController();
const base={respond:.55,explore:.54,verify:.50,rest:.42,reflect:.46,wait:.40,defer:.39};
const pred={respond:.60,explore:.58,verify:.56,rest:.45,reflect:.50,wait:.42,defer:.40};
const au={respond:.62,explore:.68,verify:.64,rest:.25,reflect:.35,wait:.20,defer:.20};
const samples=[];
for(let i=0;i<2000;i++){
  const t0=process.hrtime.bigint();
  c.beforeDecision({tick:i,baseUtilities:base,predictedUtilities:pred,actionUncertainty:au,counterfactualSpread01:.54,informationGain01:.42,hypothesisEntropy01:.50,uncertainty01:.54,predictionError01:.24,novelty01:.30,goalPressure01:.52,energy01:.78,thermal01:.14,actionCosts:{verify:.32,explore:.48},personalityBias:{verify:.65,explore:.60}});
  samples.push(Number(process.hrtime.bigint()-t0)/1e6);
}
samples.sort((a,b)=>a-b);const p50=samples[Math.floor(samples.length*.50)],p95=samples[Math.floor(samples.length*.95)];
assert.ok(p95<0.5,`p95 too high: ${p95}`);
console.log(JSON.stringify({pass:true,status:'B2511_MOBILE_PASS',p50Ms:p50,p95Ms:p95,maxMs:samples.at(-1)},null,2));
