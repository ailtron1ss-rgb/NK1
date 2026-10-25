import assert from 'node:assert/strict';
import { B273AutonomousGoalLifecycle } from '../src/organism/cognition/B273AutonomousGoalLifecycle.ts';

const net=new B273AutonomousGoalLifecycle();
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
let completed=0,revised=0,skills=0,lastStepInput=null,lastOutcomeInput=null;
for(let t=0;t<220;t++){
  const uncertainty=t<55?.25+(t%6)*.04:t<130?.92-(t%5)*.02:.35+(t%9)*.03;
  const energy=t<150?.78-(t%13)*.012:.34+(t%7)*.02;
  const social=t%17<5?.72:.24;
  const goalVector=Array.from({length:8},(_,i)=>Math.tanh(Math.sin(t*.07+i*.23)+(i===1?uncertainty-.5:0)+(i===6?.55-energy:0)));
  lastStepInput={tick:t,endogenousGoalVector:goalVector,selfLatent:Array.from({length:16},(_,i)=>Math.sin(t*.05+i*.17)),worldLatent:Array.from({length:16},(_,i)=>Math.cos(t*.03+i*.11)),neuralAssembly:Array.from({length:16},(_,i)=>((t+i)%7===0)?.95:.08),needs:{energy01:energy,uncertainty01:uncertainty,novelty01:.35+(t%11)*.035,goalPressure01:.25+uncertainty*.52,socialNeed01:social,autonomy01:.48+.2*Math.sin(t*.04),coherence01:.58+.15*Math.cos(t*.02)},traits:{curiosity:.7,caution:.64,'truth-seeking':.74,'self-reflection':.67,'self-preservation':.69,care:.58,'social-attunement':social>.6?.72:.54,persistence:.73},predictionError01:uncertainty,identityContinuity01:.78+.06*Math.cos(t*.03),autobiographicalContinuity01:.72+.08*Math.sin(t*.04),independentEvaluatorGain01:(t%10===0)?.08:-.01};
  const r=net.step(lastStepInput);
  const reward=r.mode==='recovering' ? (r.action==='rest'?.76:.42) : r.mode==='revising' ? (r.action==='verify'?.77:r.action==='reflect'?.63:.39) : r.action==='explore'?.72:r.action==='respond'?.68:r.action==='reflect'?.64:.52;
  lastOutcomeInput={tick:t,action:r.action,plan:r.plan,reward01:reward,predictionError01:uncertainty,independentGain01:reward-.5+(t>=55&&t<130?-0.10:0),personalityAlignment01:.58,externalEvidence01:t%19===0?1:0};
  const lr=net.learnFromOutcome(lastOutcomeInput);
  completed+=lr.completed?1:0; revised+=lr.revised?1:0; skills+=lr.skillCreated?1:0;
}
const beforeReplay=net.snapshot();
assert.equal(beforeReplay.lastOutcomeTick,219,'B273 must persist the last credited outcome tick');
assert.ok(beforeReplay.outcomeHistory.every(row=>row.plannedAction===row.action),'aligned simulation outcomes must record the planned first action alongside actual action');
assert.throws(()=>net.learnFromOutcome(lastOutcomeInput),/already been credited/);
assert.deepEqual(net.snapshot(),beforeReplay,'replaying an already-credited B273 outcome must not mutate goal progress or learning counters');
const restoredReplay=new B273AutonomousGoalLifecycle(); restoredReplay.restore(beforeReplay);
assert.throws(()=>restoredReplay.learnFromOutcome(lastOutcomeInput),/already been credited/,'restart must preserve the outcome replay guard');
assert.deepEqual(restoredReplay.snapshot(),beforeReplay,'rejected post-restore outcome replay must be mutation-free');
assert.throws(()=>net.step({...lastStepInput,tick:219}),/strictly increase/,'duplicate logical goal tick must be rejected');
assert.deepEqual(net.snapshot(),beforeReplay,'duplicate goal tick must fail before state mutation');
const d=net.diagnostics();
assert.ok(d.goalCreations>1,'B273 did not create multiple goals');
assert.ok(d.hierarchicalGoalRate01>.15,'B273 did not form a hierarchy of subgoals');
assert.ok(d.goalRevisions>0,'B273 never revised a goal after conflict');
assert.ok(d.longHorizonValue01>.2,'B273 long-horizon value stayed inert');
assert.ok(d.autonomy01>.2,'B273 autonomy stayed inert');
assert.ok(d.skillCreations>0,'B273 did not create a behavioral skill');
assert.ok(d.skillUses>0,'B273 did not reuse a learned behavioral skill');
assert.ok(net.snapshot().skills.every(skill=>skill.actions.length===1),'promoted skills must contain only the action actually observed');
assert.ok(d.singleActionSkillCount>0,'B273 did not retain any executable single-action skill primitives');
assert.equal(d.legacySequenceCandidateCount,0,'current learning loop must not create new legacy multi-action plans');
assert.equal(d.planActionMismatchCount,0,'aligned simulator trajectories must not report plan/action mismatches');
assert.equal(d.planActionAlignment01,1,'plan alignment score must be perfect when all stored plan prefixes match executed actions');
assert.ok(new Set(diagnosticsActions(net)).size>=2,'B273 plan/action diversity collapsed');

const mismatchedNet=new B273AutonomousGoalLifecycle();
const mismatchProposal=mismatchedNet.step({...lastStepInput,tick:0});
assert.ok(mismatchProposal.plan.length>=2,'fixture must produce a multi-action plan');
const wrongActualAction=actions.find(action=>action!==mismatchProposal.plan[0]);
assert.ok(wrongActualAction,'fixture must choose an action different from the planned first action');
const mismatchedOutcome=mismatchedNet.learnFromOutcome({
  tick:0,
  action:wrongActualAction,
  plan:mismatchProposal.plan,
  reward01:.98,
  predictionError01:.1,
  independentGain01:.8,
  personalityAlignment01:.8,
  externalEvidence01:0,
});
assert.equal(mismatchedOutcome.accepted,true,'the positive actual outcome should still update goal progress');
assert.equal(mismatchedOutcome.skillCreated,true,'an accepted result for the actual action may train an atomic primitive even when the plan differed');
const mismatchSnapshot=mismatchedNet.snapshot();
assert.equal(mismatchSnapshot.skills.length,1,'mismatched plan/action must train only one observed primitive, not the proposed plan');
assert.deepEqual(mismatchSnapshot.skills[0].actions,[wrongActualAction],'the primitive must contain only the action that actually ran');
assert.notDeepEqual(mismatchSnapshot.skills[0].actions,mismatchProposal.plan,'the unexecuted plan must not be promoted as the learned skill');
assert.equal(mismatchSnapshot.outcomeHistory.at(-1).action,wrongActualAction);
assert.equal(mismatchSnapshot.outcomeHistory.at(-1).plannedAction,mismatchProposal.plan[0]);
assert.equal(mismatchedNet.diagnostics().planActionMismatchCount,1,'the mismatch should remain visible in diagnostics');
assert.equal(mismatchedNet.diagnostics().planActionAlignment01,0,'a lone mismatched plan/action outcome should score zero alignment');


const primitiveNet=new B273AutonomousGoalLifecycle();
const primitiveProposal=primitiveNet.step({...lastStepInput,tick:0});
const primitiveOutcome=primitiveNet.learnFromOutcome({
  tick:0,action:primitiveProposal.action,plan:primitiveProposal.plan,reward01:.98,predictionError01:.1,
  independentGain01:.8,personalityAlignment01:.8,externalEvidence01:0,
});
assert.equal(primitiveOutcome.accepted,true);
assert.equal(primitiveOutcome.skillCreated,true,'aligned successful action should create an atomic skill primitive');
assert.deepEqual(primitiveNet.snapshot().skills.map(skill=>skill.actions),[[primitiveProposal.action]],
  'the system must not promote imagined future steps as executed skill actions');

const legacySequenceState=mismatchedNet.snapshot();
legacySequenceState.skills=[{
  id:'legacy-multi-step-plan',actions:['respond','explore'],support01:.95,success01:.99,expectedGain01:.95,
  uses:4,createdTick:0,lastUsedTick:0,goalFingerprint:legacySequenceState.activeGoalId,
}];
const legacyWithSequence=new B273AutonomousGoalLifecycle(); legacyWithSequence.restore(legacySequenceState);
const legacyBaselineState=structuredClone(legacySequenceState); legacyBaselineState.skills=[];
const legacyBaseline=new B273AutonomousGoalLifecycle(); legacyBaseline.restore(legacyBaselineState);
assert.equal(legacyWithSequence.diagnostics().legacySequenceCandidateCount,1,
  'old multi-action skill must be retained as an inert legacy candidate');
assert.equal(legacyWithSequence.diagnostics().singleActionSkillCount,0,
  'old multi-action skill must not become an active primitive');
for(const action of actions){
  assert.equal(legacyWithSequence.actionBias(action),legacyBaseline.actionBias(action),
    'legacy multi-action sequences must not influence live action policy before trajectory verification');
}

const snap=net.snapshot(); const restored=new B273AutonomousGoalLifecycle(); restored.restore(snap); assert.deepEqual(restored.snapshot(),snap,'B273 snapshot round-trip failed');
console.log(JSON.stringify({pass:true,diagnostics:d,completed,revised,skills,current:net.current(),actionDiversity:new Set(diagnosticsActions(net)).size},null,2));
function diagnosticsActions(n){return n.snapshot().outcomeHistory.map(x=>x.action).concat(n.current().plan);}
