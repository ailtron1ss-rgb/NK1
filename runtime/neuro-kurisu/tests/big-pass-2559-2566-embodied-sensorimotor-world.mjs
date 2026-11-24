import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map(a=>[a,.5]));
const baseObs=(t)=>Array.from({length:64},(_,i)=>Math.sin(t*.07+i*.13)*.35 + (i%7===0 ? .08 : 0));
const sensors=(t)=>({vision:{tick:t,values:baseObs(t).slice(0,12),freshness01:t%3===0?1:.35,confidence01:.82,ageTicks:t%3===0?0:1,source:'vision'},audio:{tick:t,values:baseObs(t).slice(12,20),freshness01:t%4===0?1:.2,confidence01:.72,ageTicks:t%4===0?0:2,source:'audio'},interoception:{tick:t,values:baseObs(t).slice(20,28),freshness01:1,confidence01:.9,ageTicks:0,source:'interoception'},world:{tick:t,values:baseObs(t).slice(28,36),freshness01:t%5===0?1:.4,confidence01:.78,ageTicks:t%5===0?0:1,source:'world'},social:{tick:t,values:baseObs(t).slice(36,44),freshness01:t%7===0?1:.15,confidence01:.65,ageTicks:t%7===0?0:3,source:'social'},context:{tick:t,values:baseObs(t).slice(44,52),freshness01:.8,confidence01:.8,ageTicks:0,source:'context'}});
const branch=new NeuralExperienceBranch();
for(let t=1;t<=900;t++){
  const features=baseObs(t);
  const frame=branch.beforeDecision({tick:t,input:features,baseUtilities:utilities,predictionError01:.2+.2*((t%17)/16),novelty01:.2+.7*((t%19)/18),uncertainty01:.12+.75*((t%23)/22),homeostasis01:.7,identityGap01:.2,goalPressure01:.15+.7*((t%29)/28),reward01:.5,embodied:{sensorFeatures:features,sensors:sensors(t)}});
  const action=actions[(t*5+(t%7))%actions.length];
  branch.commitAction(action,utilities);
  const next=baseObs(t+1);
  branch.afterOutcome({tick:t,action,reward01:.35+.6*((t%11)/10),predictionError01:.12+.55*((t%13)/12),verified01:t%4===0?1:0,nextInput:next,holdout01:t%9===0?1:0,identityGap01:.2,goalPressure01:.4,embodied:{nextFeatures:next,sensorFreshness01:.55+.4*(t%3===0?1:0)}});
}
const m=branch.continuityMetrics();
assert.equal(m.embodiedBridge.transitions,900);
assert.ok(m.embodiedBridge.transfer01>0.4,'transfer too low');
assert.ok(m.embodiedBridge.predictionConsistency01>0.45,'prediction consistency too low');
assert.ok(m.embodiedBridge.activePerception01>0.4,'active perception too low');
assert.ok(m.embodiedBridge.epistemicValue01>0,'epistemic signal missing');
const saved=branch.snapshot();const restored=new NeuralExperienceBranch();restored.restore(saved);const rm=restored.continuityMetrics();assert.equal(rm.embodiedBridge.transitions,m.embodiedBridge.transitions);assert.ok(Math.abs(rm.embodiedBridge.transfer01-m.embodiedBridge.transfer01)<1e-9);
console.log('B2559_2566_EMBODIED_SENSORIMOTOR_WORLD_PASS');
console.log(JSON.stringify({transitions:m.embodiedBridge.transitions,transfer01:m.embodiedBridge.transfer01,causalSensitivity01:m.embodiedBridge.causalSensitivity01,predictionConsistency01:m.embodiedBridge.predictionConsistency01,closedLoopGain01:m.embodiedBridge.closedLoopGain01,activePerception01:m.embodiedBridge.activePerception01,epistemicValue01:m.embodiedBridge.epistemicValue01,activeNeuronFraction01:m.embodiedBridge.activeNeuronFraction01,computeCost01:m.embodiedBridge.computeCost01,asyncSensorPenalty01:m.embodiedBridge.asyncSensorPenalty01},null,2));
