import assert from 'node:assert/strict';
import { B385B390AutonomousDevelopmentalOrganismCore } from '../src/organism/system/B385B390AutonomousDevelopmentalOrganismCore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const core=new B385B390AutonomousDevelopmentalOrganismCore();
for(let i=1;i<=40;i++){
  const ctx=Array.from({length:8},(_,j)=>.2+((i+j*3)%60)/100);
  const probs=Object.fromEntries(actions.map((a,j)=>[a,j===1?.30:.116]));
  const forecasts=Object.fromEntries(actions.map((a,j)=>[a,j===1?.78:.45+j*.01]));
  core.beforeDecision({tick:i,context01:ctx,b365ActionProbabilities:probs,b365ForecastUtilities:forecasts,b365NeuralConfidence01:.70,b365PredictionError01:.15,activeGoal:{id:'g',vector:ctx,ownership01:.8,commitment01:.72},novelty01:.62,uncertainty01:.55,energy01:.74,cognitiveLoad01:.24,autonomy01:.83});
  if(i%2===0) core.afterOutcome({tick:i,action:'explore',goalId:'g',context01:ctx,reward01:.88,predictionError01:.12,salience01:.8,verified01:1,independent01:1});
}
const input={tick:100,context01:[.85,.82,.9,.2,.88,.32,.77,.86],b365ActionProbabilities:Object.fromEntries(actions.map(a=>[a,.14])),b365ForecastUtilities:Object.fromEntries(actions.map(a=>[a,.5])),b365NeuralConfidence01:.72,b365PredictionError01:.18,activeGoal:{id:'g',vector:[.85,.82,.9,.2,.88,.32,.77,.86],ownership01:.8,commitment01:.72},novelty01:.7,uncertainty01:.52,energy01:.72,cognitiveLoad01:.2,autonomy01:.82};
const result=core.evaluateKnockout(input);
assert.ok(result.retrievalDelta01>0.001,'retrieval knockout produced no observable delta');
assert.ok(result.causalDelta01>0.001,'integrated knockout produced no causal delta');
console.log(JSON.stringify({pass:true,status:'B385_B390_KNOCKOUT_PASS',causalDelta01:result.causalDelta01,retrievalDelta01:result.retrievalDelta01,actionDelta01:result.actionDelta01,onRetrieval01:result.on.retrieval.strength01,offRetrieval01:result.off.retrieval.strength01},null,2));
