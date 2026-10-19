import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(A.map(a=>[a,.5]));
const b=new NeuralExperienceBranch();
let biasEnergy=0;
for(let t=1;t<=360;t++){
  const input=Array.from({length:64},(_,i)=>Math.sin(t*.021+i*.13)*.5+.5);
  const r=b.beforeDecision({tick:t,input,baseUtilities:utilities,predictionError01:.18+.12*Math.abs(Math.sin(t*.07)),novelty01:.45+.3*(t%17===0?1:0),uncertainty01:.25+.2*(t%11===0?1:0),homeostasis01:.3,identityGap01:.22,goalPressure01:.55,reward01:.5});
  const selected=A[(t*3)%A.length];
  for(const x of Object.values(r.actionBias))biasEnergy+=Math.abs(Number(x)||0);
  b.commitAction(selected,utilities);
  b.afterOutcome({tick:t,action:selected,reward01:selected==='verify'?.82:.46,predictionError01:selected==='verify'?.18:.54,verified01:selected==='verify'?1:0,nextInput:Array.from({length:64},(_,i)=>Math.cos(t*.018+i*.11)*.5+.5),holdout01:t%7===0?1:0,identityGap01:.2,goalPressure:.55});
  if(t%9===0)b.replay(4);
}
const d=b.diagnostics();
if(!d.causalPlanner || d.causalPlanner.rules.length===0)throw new Error('planner not integrated');
if(d.causalSensitivity01<=0.01)throw new Error(`causalSensitivity too weak ${d.causalSensitivity01}`);
if(d.transfer01<=0.01)throw new Error(`transfer too weak ${d.transfer01}`);
if(biasEnergy<=.1)throw new Error('planner action residual absent');
const snap=b.snapshot();const r=new NeuralExperienceBranch();r.restore(snap);const rd=r.diagnostics();
if(rd.causalPlanner.rules.length!==d.causalPlanner.rules.length)throw new Error('planner rules lost after restart');
if(Math.abs(rd.transfer01-d.transfer01)>1e-6)throw new Error('planner transfer drift after restart');
console.log('B2558_NEURAL_INTEGRATION_PASS');
console.log(JSON.stringify({ticks:d.tick,plannerRules:d.causalPlanner.rules.length,plannerTraces:d.causalPlanner.traces.length,causalSensitivity01:d.causalSensitivity01,transfer01:d.transfer01,foresightQuality01:d.foresightQuality01,biasEnergy,coherence01:d.coherence01,computeCost01:d.computeCost01},null,2));
