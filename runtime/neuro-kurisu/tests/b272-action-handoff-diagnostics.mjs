import assert from 'node:assert/strict';
import { B272EndogenousGoalGenesis } from '../src/organism/cognition/B272EndogenousGoalGenesis.ts';

const input=(tick)=>({
  tick,
  selfLatent:Array.from({length:16},(_,i)=>Math.tanh(Math.sin(tick*.07+i*.11))),
  worldLatent:Array.from({length:16},(_,i)=>Math.cos(tick*.05+i*.13)),
  needs:{energy01:.72,uncertainty01:.43,novelty01:.58,goalPressure01:.44,socialNeed01:.31},
  traits:{curiosity:.72,'truth-seeking':.76,'self-reflection':.68,'self-preservation':.7,care:.59,'social-attunement':.57,persistence:.73},
  predictionError01:.36,autobiographicalContinuity01:.78,identityContinuity01:.82,
  intrinsicReward01:.61,lastAction:null,lastReward01:.5,
});

const net=new B272EndogenousGoalGenesis();
const goal0=net.step(input(0));
const mismatchedAction=goal0.action==='wait'?'explore':'wait';
const rejectedHandoff=net.recordActionHandoff({tick:0,goalId:goal0.goalId,generatedAction:goal0.action,selectedAction:mismatchedAction});
assert.equal(rejectedHandoff.recorded,true);
assert.equal(rejectedHandoff.matched,false);
assert.equal(net.diagnostics().actionHandoffObservations,1);
assert.equal(net.diagnostics().actionHandoffMatches,0);
assert.equal(net.diagnostics().actionHandoffMismatches,1);
assert.equal(net.diagnostics().actionHandoffMismatchRate01,1);

const beforeBadCredit=net.snapshot();
assert.throws(()=>net.learnFromOutcome({tick:0,action:mismatchedAction,reward01:.9,predictionError01:.1,externalEvidence01:0}),/action must match/);
assert.deepEqual(net.snapshot(),beforeBadCredit,'a mismatched executed action must not receive B272 credit');
assert.throws(()=>net.recordActionHandoff({tick:0,goalId:goal0.goalId,generatedAction:goal0.action,selectedAction:goal0.action}),/already been recorded/);
assert.deepEqual(net.snapshot(),beforeBadCredit,'duplicate handoff recording must be rejected without mutation');

const restored0=new B272EndogenousGoalGenesis();
restored0.restore(beforeBadCredit);
assert.deepEqual(restored0.diagnostics(),net.diagnostics(),'handoff diagnostics/history must survive restore');

const goal1=restored0.step(input(1));
const matched=restored0.recordActionHandoff({tick:1,goalId:goal1.goalId,generatedAction:goal1.action,selectedAction:goal1.action});
assert.equal(matched.matched,true);
restored0.learnFromOutcome({tick:1,action:goal1.action,reward01:.74,predictionError01:.18,externalEvidence01:.1,independentEvaluatorGain01:.08,acceptedExternalGoal:true});
const final=restored0.diagnostics();
assert.equal(final.actionHandoffObservations,2);
assert.equal(final.actionHandoffMatches,1);
assert.equal(final.actionHandoffMismatches,1);
assert.equal(final.actionHandoffMatchRate01,.5);
assert.equal(final.actionHandoffMismatchRate01,.5);
assert.equal(final.learningUpdates,1,'only the action bound to the generated goal can update B272');
assert.equal(final.lastActionHandoffTick,1);

const finalRestored=new B272EndogenousGoalGenesis();
finalRestored.restore(restored0.snapshot());
assert.deepEqual(finalRestored.diagnostics(),final,'counters and bounded handoff history must round-trip');

// Long-run action-handoff calibration: every generated goal is paired with the
// action actually selected by the runtime. A deterministic 1-in-7 mismatch rate
// must remain visible in diagnostics and must never receive B272 outcome credit.
const longRun = new B272EndogenousGoalGenesis();
let longRunMatches = 0;
let longRunMismatches = 0;
for (let tick = 0; tick < 140; tick++) {
  const goal = longRun.step(input(tick));
  const intentionallyMismatched = tick % 7 === 0;
  const selectedAction = intentionallyMismatched
    ? (goal.action === 'wait' ? 'explore' : 'wait')
    : goal.action;
  const handoff = longRun.recordActionHandoff({
    tick,
    goalId: goal.goalId,
    generatedAction: goal.action,
    selectedAction,
  });
  assert.equal(handoff.matched, !intentionallyMismatched);
  if (handoff.matched) {
    longRunMatches++;
    longRun.learnFromOutcome({
      tick,
      action: selectedAction,
      reward01: .62,
      predictionError01: .2,
      externalEvidence01: tick % 11 === 0 ? .5 : 0,
      independentEvaluatorGain01: .03,
      acceptedExternalGoal: true,
    });
  } else {
    longRunMismatches++;
    const beforeRejectedCredit = longRun.snapshot();
    assert.throws(() => longRun.learnFromOutcome({
      tick,
      action: selectedAction,
      reward01: .99,
      predictionError01: 0,
      externalEvidence01: 1,
      acceptedExternalGoal: true,
    }), /action must match/);
    assert.deepEqual(longRun.snapshot(), beforeRejectedCredit,
      'a long-run action mismatch must not mutate the learner or gain false credit');
  }
}
const longRunDiagnostics = longRun.diagnostics();
assert.equal(longRunDiagnostics.actionHandoffObservations, 140);
assert.equal(longRunDiagnostics.actionHandoffMatches, longRunMatches);
assert.equal(longRunDiagnostics.actionHandoffMismatches, longRunMismatches);
assert.equal(longRunMatches + longRunMismatches, 140);
assert.ok(Math.abs(longRunDiagnostics.actionHandoffMatchRate01 - longRunMatches / 140) < 1e-12);
assert.ok(Math.abs(longRunDiagnostics.actionHandoffMismatchRate01 - longRunMismatches / 140) < 1e-12);
assert.equal(longRunDiagnostics.learningUpdates, longRunMatches,
  'only correctly handed-off actions may contribute learning over the long run');
const longRunRestored = new B272EndogenousGoalGenesis();
longRunRestored.restore(longRun.snapshot());
assert.deepEqual(longRunRestored.diagnostics(), longRunDiagnostics,
  'long-run match/mismatch telemetry must survive restore');
console.log('B272_ACTION_HANDOFF_DIAGNOSTICS=PASS (single-step, 140-cycle calibration, strict credit binding, idempotency, restore)');
