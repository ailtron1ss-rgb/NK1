import assert from 'node:assert/strict';
import { B385B390AutonomousDevelopmentalOrganismCore } from '../src/organism/system/B385B390AutonomousDevelopmentalOrganismCore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const core=new B385B390AutonomousDevelopmentalOrganismCore();
for(let i=1;i<=48;i++){
  const ctx=Array.from({length:8},(_,j)=>Math.max(0,Math.min(1,.18+((i*13+j*7)%71)/100)));
  const probs=Object.fromEntries(actions.map((a,j)=>[a,j===1?.42:j===2?.18:.08]));
  const forecasts=Object.fromEntries(actions.map((a,j)=>[a,j===1?.78:j===2?.64:.45+j*.005]));
  const d=core.beforeDecision({tick:i,context01:ctx,b365ActionProbabilities:probs,b365ForecastUtilities:forecasts,b365NeuralConfidence01:.72,b365PredictionError01:.18,activeGoal:{id:'goal:knowledge',vector:ctx,ownership01:.74,commitment01:.68},novelty01:.6,uncertainty01:.52,energy01:.76,cognitiveLoad01:.22,autonomy01:.82});
  assert.equal(Object.keys(d.actionBias).length,7);
  if(i%2===0) core.afterOutcome({tick:i,action:i%3===0?'verify':'explore',goalId:'goal:knowledge',context01:ctx,reward01:i%4===0?.22:.86,predictionError01:.16,salience01:.72,verified01:1,independent01:1,outcomeSignature01:ctx});
}
const d=core.diagnostics();
assert.ok(d.metrics.verifiedEpisodes>=24);
assert.ok(d.episodes.length>=24);
assert.ok(d.metrics.valueRevisions>0);
assert.ok(d.metrics.selfRevisions>=0);
assert.ok(d.metrics.predictionUpdates>0);
assert.ok(d.last.retrievedTicks.length>0);
console.log(JSON.stringify({pass:true,status:'B385_B390_AUTONOMOUS_DEVELOPMENTAL_ORGANISM_PASS',verifiedEpisodes:d.metrics.verifiedEpisodes,retrievals:d.metrics.retrievals,valueRevisions:d.metrics.valueRevisions,selfRevisions:d.metrics.selfRevisions,predictionUpdates:d.metrics.predictionUpdates,lastRetrievalStrength01:d.metrics.lastRetrievalStrength01,continuity01:d.self.continuity01,longHorizon01:d.prediction.longHorizon01},null,2));
