import assert from 'node:assert/strict';
import { P66InteroceptiveHomeostasis } from '../src/organism/cognition/P66InteroceptiveHomeostasis.ts';
import { P67AutonomousGoalGenesis } from '../src/organism/developmental/P67AutonomousGoalGenesis.ts';
import { P68GoalEcology } from '../src/organism/developmental/P68GoalEcology.ts';

const h = new P66InteroceptiveHomeostasis();
const r = h.observe({tick:1,at:Date.now(),energy01:.18,thermal01:.88,capacity01:.22,load01:.8,awake:true,uncertainty01:.8,predictionError01:.7,novelty01:.3});
assert.equal(r.mode,'recover');
assert.ok(r.pressure01>.4);

const g = new P67AutonomousGoalGenesis();
const candidate = g.propose({tick:32,at:Date.now(),energy01:.2,uncertainty01:.2,predictionError01:.3,novelty01:.4,socialNeed01:.1,goalPressure01:.4,homeostaticPressure01:r.pressure01,epistemicUnresolved:2,identity01:.95,activeGoalCount:0,lastMode:'protect',identityDecision:'allow'});
assert.ok(candidate);
assert.notEqual(candidate.source,'intrinsic');
const veto = g.propose({tick:64,at:Date.now(),energy01:.8,uncertainty01:.9,predictionError01:.8,novelty01:.9,socialNeed01:.2,goalPressure01:.9,homeostaticPressure01:.2,epistemicUnresolved:9,identity01:.95,activeGoalCount:0,lastMode:'explore',identityDecision:'veto'});
assert.equal(veto,null);

const goals = [{id:candidate.id,title:candidate.title,reason:candidate.reason,source:candidate.source,status:'active',importance:candidate.importance,urgency:candidate.urgency,confidence:candidate.confidence,progress:0,createdAt:Date.now()-1000*60*60*24,updatedAt:Date.now()-1000*60*60}];
const e = new P68GoalEcology();
const s1 = e.tick({tick:1,at:Date.now(),goals,lastAction:'verify',lastSuccess:.9,mode:'protect',homeostaticPressure01:.55,identity01:.96});
assert.equal(s1.activeCount,1);
assert.equal(goals[0].progress>0,true);
const s2 = e.tick({tick:2,at:Date.now(),goals,lastAction:'verify',lastSuccess:.9,mode:'engage',homeostaticPressure01:.1,identity01:.96});
assert.ok(s2.goalPressure01>=0);
const snap = e.snapshot();
const e2 = new P68GoalEcology(); e2.restore(snap);
assert.equal(e2.summary().cycles,e.summary().cycles);
console.log(JSON.stringify({homeostasis:r,goal:candidate,ecology:e.summary()}));
