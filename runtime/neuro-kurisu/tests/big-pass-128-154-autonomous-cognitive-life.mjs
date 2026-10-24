import assert from 'node:assert/strict';
import { AutonomousCognitiveLifeEngine, defaultAutonomousCognitiveLife } from '../src/organism/learning/AutonomousCognitiveLifeEngine.ts';

const mk=(over={})=>({
  state:{tick:1,at:Date.now(),needs:{energy:.72,cognitiveLoad:.2,uncertainty:.62,socialNeed:.55,novelty:.68,identityCoherence:.8,goalPressure:.7},predictionError:.42,selfPredictionError:.31},
  goals:[{id:'g1',title:'research unknown question',reason:'research and future development',status:'active',importance:.9,urgency:.55,progress:.22}],
  activeGoalId:'g1', self01:.78, identityDrift01:.18, autobiographical01:.71, relational01:.65, social01:.67,
  socialError01:.28, goalPressure01:.7, uncertainty01:.62, predictionError01:.42, selfPredictionError01:.31, novelty01:.68,
  energy01:.72, capacity01:.8, thermal01:.12, sensoryFreshness01:.72, transfer01:.44, retention01:.55, curriculumPressure01:.49,
  futureMismatch01:.36, futureIdentityCoherence01:.79, regret01:.22, counterfactualGap01:.3, evidence01:.55, resource01:.7, at:Date.now(), ...over
});
const e=new AutonomousCognitiveLifeEngine(); e.restore(defaultAutonomousCognitiveLife());
const hostileLifeState={...defaultAutonomousCognitiveLife()};
let hostileLifeGetterReads=0;
Object.defineProperty(hostileLifeState,'cycles',{enumerable:true,configurable:true,get(){hostileLifeGetterReads++;return 999;}});
const hostileLifeRestore=new AutonomousCognitiveLifeEngine();
hostileLifeRestore.restore(hostileLifeState);
assert.equal(hostileLifeGetterReads,0,'restore must reject accessors without invoking them');
assert.equal(hostileLifeRestore.snapshot().cycles,0,'invalid life state must restore to safe defaults');
const cyclicLifeState={...defaultAutonomousCognitiveLife()}; cyclicLifeState.activeIntentions=[cyclicLifeState];
const cyclicLifeRestore=new AutonomousCognitiveLifeEngine();cyclicLifeRestore.restore(cyclicLifeState);
assert.equal(cyclicLifeRestore.snapshot().activeIntentions.length,0,'cyclic persistence must fail closed');
for(let i=0;i<18;i++) {
  const t=Date.now()+i*1000;
  const c=mk({at:t,state:{...mk().state,tick:i+1,at:t}});
  e.beginCycle(c); e.integrate(c);
  const top=e.selectPerception(); assert(top,'active perception missing');
  e.recordDecision({action:'verify',predicted01:.58,confidence01:.71,contextKey:`c${i}`,at:c.at});
  e.recordOutcome({action:'verify',actual01:i%3===0?.74:.52,verified01:i%2?.7:.95,causal01:.7,transfer01:.5,social01:.7,identity01:.78,learning01:.6,surprise01:i%3===0?.26:.12,at:c.at});
  const d=e.diagnostics();
  e.appendLongitudinal({overall01:e.benchmark().overall01,autonomy01:d.metrics.autonomy01,self01:d.metrics.selfModel01,social01:d.metrics.socialModel01,learning01:d.metrics.causalLearning01,planning01:d.metrics.planning01,embodied01:d.metrics.embodiedAgency01,verified01:i%2?.7:.95,at:c.at});
}
const d=e.diagnostics(),b=e.benchmark();
assert(d.metrics.closedLoop01>.3);assert(d.metrics.activePerception01>.25);assert(d.metrics.planning01>.3);assert(d.metrics.personalityStability01>.5);assert(b.sampleCount>=18);assert(e.ablate('selfModel').delta01>=0);
e.runResearchTrial({id:'trial-1',hypothesis:'self-model contributes to planning coherence',component:'selfModel',control01:.42,treatment01:.6,confidence01:.82});
const snap=e.snapshot(); const e2=new AutonomousCognitiveLifeEngine();e2.restore(snap); assert.equal(e2.snapshot().predictions.length,snap.predictions.length);assert.equal(e2.snapshot().researchTrials.length,1);
console.log(`BIG_PASS_128_154=PASS cycles=${d.cycles} autonomy=${d.metrics.autonomy01.toFixed(3)} closedLoop=${d.metrics.closedLoop01.toFixed(3)} perception=${d.metrics.activePerception01.toFixed(3)} planning=${d.metrics.planning01.toFixed(3)} longitudinal=${d.longitudinalMean01.toFixed(3)} research=${b.completedResearch}`);
