import assert from 'node:assert/strict';
import { B385B390AutonomousDevelopmentalOrganismCore } from '../src/organism/system/B385B390AutonomousDevelopmentalOrganismCore.ts';
const core=new B385B390AutonomousDevelopmentalOrganismCore();
for(let i=1;i<=20;i++){
 const ctx=Array.from({length:8},(_,j)=>.25+((i+j)%40)/100);
 core.beforeDecision({tick:i,context01:ctx,b365ActionProbabilities:{respond:.1,explore:.3,verify:.2,rest:.1,reflect:.1,wait:.1,defer:.1},b365ForecastUtilities:{respond:.4,explore:.75,verify:.65,rest:.4,reflect:.52,wait:.4,defer:.42},b365NeuralConfidence01:.7,b365PredictionError01:.16,activeGoal:{id:'g',vector:ctx,ownership01:.7,commitment01:.7},novelty01:.6,uncertainty01:.5,energy01:.8,cognitiveLoad01:.2,autonomy01:.8});
 if(i%2===0) core.afterOutcome({tick:i,action:'explore',goalId:'g',context01:ctx,reward01:.85,predictionError01:.12,salience01:.7,verified01:1,independent01:1});
}
const snap=core.snapshot(); const restored=new B385B390AutonomousDevelopmentalOrganismCore(); restored.restore(snap); restored.markRestartCheck();
const a=core.diagnostics(),b=restored.diagnostics();
assert.equal(b.metrics.verifiedEpisodes,a.metrics.verifiedEpisodes);assert.equal(b.episodes.length,a.episodes.length);assert.equal(b.values.map(v=>v.value01).join(','),a.values.map(v=>v.value01).join(','));
console.log(JSON.stringify({pass:true,status:'B385_B390_RESTART_PERSISTENCE_PASS',verifiedEpisodes:b.metrics.verifiedEpisodes,episodeCount:b.episodes.length,restartChecks:b.metrics.restartChecks,valueVector:b.values.map(v=>v.value01),continuity01:b.self.continuity01},null,2));
