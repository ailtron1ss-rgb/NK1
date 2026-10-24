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
// WorkPass524: malformed external feedback is rejected before any predictor/metric mutation.
const beforeBadDecision=e.snapshot();
assert.throws(()=>e.recordDecision({action:'not-an-action',predicted01:.5,confidence01:.5}),/autonomous-life-decision-action-invalid/);
assert.deepEqual(e.snapshot(),beforeBadDecision,'invalid decision labels must not create prediction records');
assert.throws(()=>e.recordDecision({action:'verify',predicted01:Number.NaN,confidence01:.5}),/autonomous-life-decision-signal-invalid/);
assert.deepEqual(e.snapshot(),beforeBadDecision,'non-finite predictions must not enter the learning loop');
assert.throws(()=>e.recordOutcome({actual01:1.4,verified01:.9,causal01:.8,transfer01:.5,social01:.5,identity01:.5,learning01:.5,surprise01:.2}),/autonomous-life-outcome-signal-invalid/);
assert.deepEqual(e.snapshot(),beforeBadDecision,'out-of-range rewards must not update model metrics or consume a prediction');
let feedbackGetterReads=0;
const hostileOutcome=Object.defineProperties({}, {actual01:{enumerable:true,get(){feedbackGetterReads++;return .9;}}});
assert.throws(()=>e.recordOutcome(hostileOutcome),/autonomous-life-outcome-input-invalid/);
assert.equal(feedbackGetterReads,0,'learning feedback snapshots must not execute caller-owned getters');
assert.deepEqual(e.snapshot(),beforeBadDecision,'rejected object-shaped feedback must leave cognitive state unchanged');
assert.throws(()=>e.addCommitment({action:'not-an-action'}),/autonomous-life-commitment-action-invalid/);
assert.deepEqual(e.snapshot(),beforeBadDecision,'invalid commitments must not change motivational state');
assert.throws(()=>e.addCommitment({action:'verify',dueAt:Number.POSITIVE_INFINITY}),/autonomous-life-commitment-time-invalid/);
assert.deepEqual(e.snapshot(),beforeBadDecision,'invalid commitment deadlines must not enter persistent life state');
// Capped rolling histories must not reuse IDs once the resident window is full.
const idEngine=new AutonomousCognitiveLifeEngine(); idEngine.restore(defaultAutonomousCognitiveLife());
for(let i=0;i<300;i++) idEngine.recordDecision({action:'verify',predicted01:.5,confidence01:.6,contextKey:'same-cycle',at:1000+i});
const predictionIds=idEngine.snapshot().predictions.map(row=>row.id);
assert.equal(predictionIds.length,256);
assert.equal(new Set(predictionIds).size,predictionIds.length,'prediction IDs must stay unique after replay-window eviction');
for(let i=0;i<48;i++) idEngine.addCommitment({action:'verify',goalId:'goal-'+i,dueAt:10000+i,reliability01:.5});
const commitmentIds=idEngine.snapshot().commitments.map(row=>row.id);
assert.equal(commitmentIds.length,32);
assert.equal(new Set(commitmentIds).size,commitmentIds.length,'commitment IDs must stay unique after bounded history eviction');
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
