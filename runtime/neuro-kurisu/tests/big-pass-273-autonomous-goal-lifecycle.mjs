import assert from 'node:assert/strict';
import { B273AutonomousGoalLifecycle } from '../src/organism/cognition/B273AutonomousGoalLifecycle.ts';

const net=new B273AutonomousGoalLifecycle();
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
let completed=0,revised=0,skills=0;
for(let t=0;t<220;t++){
  const uncertainty=t<55?.25+(t%6)*.04:t<130?.92-(t%5)*.02:.35+(t%9)*.03;
  const energy=t<150?.78-(t%13)*.012:.34+(t%7)*.02;
  const social=t%17<5?.72:.24;
  const goalVector=Array.from({length:8},(_,i)=>Math.tanh(Math.sin(t*.07+i*.23)+(i===1?uncertainty-.5:0)+(i===6?.55-energy:0)));
  const r=net.step({tick:t,endogenousGoalVector:goalVector,selfLatent:Array.from({length:16},(_,i)=>Math.sin(t*.05+i*.17)),worldLatent:Array.from({length:16},(_,i)=>Math.cos(t*.03+i*.11)),neuralAssembly:Array.from({length:16},(_,i)=>((t+i)%7===0)?.95:.08),needs:{energy01:energy,uncertainty01:uncertainty,novelty01:.35+(t%11)*.035,goalPressure01:.25+uncertainty*.52,socialNeed01:social,autonomy01:.48+.2*Math.sin(t*.04),coherence01:.58+.15*Math.cos(t*.02)},traits:{curiosity:.7,caution:.64,'truth-seeking':.74,'self-reflection':.67,'self-preservation':.69,care:.58,'social-attunement':social>.6?.72:.54,persistence:.73},predictionError01:uncertainty,identityContinuity01:.78+.06*Math.cos(t*.03),autobiographicalContinuity01:.72+.08*Math.sin(t*.04),independentEvaluatorGain01:(t%10===0)?.08:-.01});
  const reward=r.mode==='recovering' ? (r.action==='rest'?.76:.42) : r.mode==='revising' ? (r.action==='verify'?.77:r.action==='reflect'?.63:.39) : r.action==='explore'?.72:r.action==='respond'?.68:r.action==='reflect'?.64:.52;
  const lr=net.learnFromOutcome({tick:t,action:r.action,plan:r.plan,reward01:reward,predictionError01:uncertainty,independentGain01:reward-.5+(t>=55&&t<130?-0.10:0),personalityAlignment01:.58,externalEvidence01:t%19===0?1:0});
  completed+=lr.completed?1:0; revised+=lr.revised?1:0; skills+=lr.skillCreated?1:0;
}
const d=net.diagnostics();
assert.ok(d.goalCreations>1,'B273 did not create multiple goals');
assert.ok(d.hierarchicalGoalRate01>.15,'B273 did not form a hierarchy of subgoals');
assert.ok(d.goalRevisions>0,'B273 never revised a goal after conflict');
assert.ok(d.longHorizonValue01>.2,'B273 long-horizon value stayed inert');
assert.ok(d.autonomy01>.2,'B273 autonomy stayed inert');
assert.ok(d.skillCreations>0,'B273 did not create a behavioral skill');
assert.ok(d.skillUses>0,'B273 did not reuse a learned behavioral skill');
assert.ok(new Set(diagnosticsActions(net)).size>=2,'B273 plan/action diversity collapsed');
const snap=net.snapshot(); const restored=new B273AutonomousGoalLifecycle(); restored.restore(snap); assert.deepEqual(restored.snapshot(),snap,'B273 snapshot round-trip failed');
console.log(JSON.stringify({pass:true,diagnostics:d,completed,revised,skills,current:net.current(),actionDiversity:new Set(diagnosticsActions(net)).size},null,2));
function diagnosticsActions(n){return n.snapshot().outcomeHistory.map(x=>x.action).concat(n.current().plan);}
