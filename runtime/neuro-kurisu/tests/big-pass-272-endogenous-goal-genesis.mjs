import assert from 'node:assert/strict';
import { B272EndogenousGoalGenesis } from '../src/organism/cognition/B272EndogenousGoalGenesis.ts';

const net=new B272EndogenousGoalGenesis();
const rewards={explore:.72,verify:.68,respond:.61,reflect:.57,rest:.48,wait:.43,defer:.41};
const goals=[]; let accepted=0;
for(let t=0;t<360;t++){
  const reward= t<180 ? rewards.explore : (t%5===0?rewards.verify:rewards.reflect);
  const predictionError=t<140?.30:(t<220?.55:.18);
  const r=net.step({tick:t,selfLatent:Array.from({length:16},(_,i)=>Math.tanh(Math.sin(t*.07+i*.11))),worldLatent:Array.from({length:16},(_,i)=>Math.sin(t*.03+i*.17)),needs:{energy01:.72-(t%17)*.006,uncertainty01:predictionError,novelty01:.34+(t%11)*.035,goalPressure01:.28+predictionError*.55,socialNeed01:.22+(t%7)*.035},traits:{curiosity:.68,caution:.58,'truth-seeking':.71,'self-reflection':.63,'self-preservation':.66,care:.57,'social-attunement':.54,persistence:.70},predictionError01:predictionError,autobiographicalContinuity01:.70+.08*Math.sin(t*.05),identityContinuity01:.76+.06*Math.cos(t*.03),intrinsicReward01:.60,lastAction:rAction(net),lastReward01:reward});
  goals.push(r.goalId);
  const lr=net.learnFromOutcome({tick:t,action:r.action,reward01:reward,predictionError01:predictionError,externalEvidence01:t%23===0?1:0,independentEvaluatorGain01:reward-.5,acceptedExternalGoal:reward>.56});
  if(lr.accepted)accepted++;
}
const d=net.diagnostics();
assert.ok(d.learningUpdates>=340,'B272 did not learn enough');
assert.ok(d.generatedGoals>=340,'B272 did not generate goals');
assert.ok(d.goalEntropy01>.15,'goal generation collapsed to one fixed representation');
assert.ok(d.prototypeDiversity01>.05,'action prototypes never differentiated');
assert.ok(d.goalNovelty01>.2,'goal novelty inactive');
assert.ok(d.agency01>.2,'endogenous agency stayed inert');
assert.ok(accepted>40,'too few endogenous goals accepted by outcome gate');
const before=net.currentGoal();
const snap=net.snapshot();
const restored=new B272EndogenousGoalGenesis(); restored.restore(snap);
assert.deepEqual(restored.currentGoal(),before,'B272 goal state did not round-trip');
const actionCounts=new Map();
for(const g of goals.slice(-120))actionCounts.set(g,(actionCounts.get(g)||0)+1);
assert.ok(actionCounts.size>3,'goal identities collapsed');
console.log(JSON.stringify({pass:true,diagnostics:d,accepted,uniqueRecentGoals:actionCounts.size,currentGoal:before},null,2));
function rAction(n){return n.currentGoal().action;}
