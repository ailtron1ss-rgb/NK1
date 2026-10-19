import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map(a=>[a,.5]));
const base=(t)=>Array.from({length:64},(_,i)=>Math.sin(t*.043+i*.071)*.27+(i%9===0?.06:0));
const sensors=(t)=>({
  vision:{tick:t,values:base(t).slice(0,10),freshness01:t%3===0?1:.42,confidence01:.84,ageTicks:t%3===0?0:1,source:'vision'},
  audio:{tick:t,values:base(t).slice(10,18),freshness01:t%4===0?1:.24,confidence01:.70,ageTicks:t%4===0?0:2,source:'audio'},
  interoception:{tick:t,values:base(t).slice(18,26),freshness01:1,confidence01:.91,ageTicks:0,source:'interoception'},
  world:{tick:t,values:base(t).slice(26,34),freshness01:t%5===0?1:.48,confidence01:.79,ageTicks:t%5===0?0:1,source:'world'},
  social:{tick:t,values:base(t).slice(34,42),freshness01:t%7===0?1:.18,confidence01:.64,ageTicks:t%7===0?0:3,source:'social'},
  context:{tick:t,values:base(t).slice(42,50),freshness01:.86,confidence01:.81,ageTicks:0,source:'context'},
});

const branch=new NeuralExperienceBranch();
for(let t=1;t<=768;t++){
  const input=base(t);
  const out=branch.beforeDecision({tick:t,input,baseUtilities:utilities,predictionError01:.15+.55*((t%13)/12),novelty01:.15+.7*((t%17)/16),uncertainty01:.10+.75*((t%19)/18),homeostasis01:.72,identityGap01:.18,goalPressure01:.18+.7*((t%23)/22),reward01:.5,embodied:{sensorFeatures:input,sensors:sensors(t)}});
  const a=out.actionBias.explore>out.actionBias.respond?'explore':actions[(t*5)%actions.length];
  branch.commitAction(a,utilities);
  const next=base(t+1).map((v,i)=>v+(a==='explore'?(i%2?.018:-.018):0));
  branch.afterOutcome({tick:t,action:a,reward01:a==='explore'?.82:.48,predictionError01:.11+.58*((t%11)/10),verified01:t%5===0?1:.35,nextInput:next,holdout01:t%17===0?1:0,identityGap01:.18,goalPressure01:.38,embodied:{nextFeatures:next,sensorFreshness01:t%3===0?.95:.58}});
}
const m=branch.continuityMetrics();
assert.ok(m.causalPlanner.dreamRehearsalCount>0,'dream rehearsal was not integrated into neural branch');
assert.ok(m.causalPlanner.dreamUpdates>0,'dream rehearsal made no policy updates');
assert.ok(m.causalPlanner.conflictCount>0,'conflict-aware learning not exercised');
assert.ok(m.causalPlanner.skillRetention01.some(v=>v>.5),'protected skill retention did not move');
assert.ok(m.embodiedBridge.transitions===768,'embodied transitions mismatch');
assert.ok(m.worldModelGate.observations===768,'evidence gate observation mismatch');
assert.ok(m.transfer01>.3,'integrated transfer too weak');
assert.ok(m.foresightQuality01>.3,'foresight quality collapsed');
const saved=branch.snapshot();const restored=new NeuralExperienceBranch();restored.restore(saved);const rm=restored.continuityMetrics();
assert.equal(rm.causalPlanner.dreamUpdates,m.causalPlanner.dreamUpdates,'dream updates lost on restart');
assert.equal(rm.causalPlanner.conflictCount,m.causalPlanner.conflictCount,'conflict count lost on restart');
console.log('B2575_2586_NEURAL_INTEGRATION_PASS');
console.log(JSON.stringify({cycles:768,dreamRehearsalCount:m.causalPlanner.dreamRehearsalCount,dreamUpdates:m.causalPlanner.dreamUpdates,skillRetention01:m.causalPlanner.skillRetention01,conflictCount:m.causalPlanner.conflictCount,negativeTransfer01:m.causalPlanner.negativeTransfer01,causalSensitivity01:m.causalSensitivity01,transfer01:m.transfer01,foresightQuality01:m.foresightQuality01},null,2));
