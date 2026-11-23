import assert from 'node:assert/strict';
import { ActiveInformationGainController } from '../src/organism/cognition/ActiveInformationGainController.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];

// The exploration gate must reopen under a strong epistemic signal, but remain closed
// when evidence is weak even if resources are available.
const gate = new ActiveInformationGainController();
const neutral = { tick: 1, baseUtilities: baseUtilities(), uncertainty01: 0.1,
  predictionError01: 0.1, novelty01: 0.1, computeBudget01: 0.8,
  risk01: 0.1, grounding01: 0.9, consensus01: 0.9 };
assert.equal(gate.beforeDecision(neutral).selectedAction, null,
  'weak epistemic evidence must not start an experiment');
const strong = gate.beforeDecision({ ...neutral, tick: 2, uncertainty01: 0.9,
  predictionError01: 0.9, novelty01: 0.9, grounding01: 0.6 });
assert.ok(strong.selectedAction === 'explore' || strong.selectedAction === 'verify',
  'strong epistemic evidence with safe resources must reopen an experiment');

const baseUtilities=()=>Object.fromEntries(actions.map(action=>[action,.5]));
const decision=(controller,tick)=>controller.beforeDecision({
  tick,baseUtilities:baseUtilities(),uncertainty01:.96,predictionError01:.91,novelty01:.92,
  computeBudget01:.9,risk01:.04,grounding01:.2,consensus01:.25,externalQuery:'sensor:front-camera',
});
const outcome=(tick,action,hypothesisId)=>({
  tick,action,reward01:.9,verified01:.95,predictionError01:.08,
  observedChange01:.8,contradiction01:.02,hypothesisId,
});

// A matching decision/action pair may close once and update its own hypothesis.
const matched=new ActiveInformationGainController();
const first=decision(matched,1);
assert.ok(first.selectedAction==='explore'||first.selectedAction==='verify');
const restoredPending=new ActiveInformationGainController();
restoredPending.restore(matched.snapshot());
assert.equal(restoredPending.afterOutcome(outcome(1,first.selectedAction,first.selectedHypothesis)),true);
let matchedMetrics=restoredPending.metrics();
assert.equal(matchedMetrics.acceptedOutcomes,1);
assert.equal(matchedMetrics.observations,1);
assert.equal(matchedMetrics.modelUpdates,1);
assert.equal(matchedMetrics.hypotheses[0].evidence,1);

// A different action can train its own action value, but cannot inherit the
// selected experiment's hypothesis credit.
const mismatch=new ActiveInformationGainController();
const chosen=decision(mismatch,2);
const other=chosen.selectedAction==='verify'?'explore':'verify';
assert.equal(mismatch.afterOutcome(outcome(2,other,chosen.selectedHypothesis)),true);
const mismatchMetrics=mismatch.metrics();
assert.equal(mismatchMetrics.observations,1);
assert.equal(mismatchMetrics.modelUpdates,0);
assert.equal(mismatchMetrics.hypotheses[0].evidence,0);

// Non-finite receipts are rejected without consuming the pending decision.
const malformed=new ActiveInformationGainController();
const malformedPick=decision(malformed,7);
assert.equal(malformed.afterOutcome({...outcome(7,malformedPick.selectedAction,malformedPick.selectedHypothesis),reward01:NaN}),false);
assert.equal(malformed.metrics().observations,0);
assert.equal(malformed.snapshot().pendingDecision.tick,7);
assert.equal(malformed.afterOutcome(outcome(7,malformedPick.selectedAction,malformedPick.selectedHypothesis)),true);
assert.equal(malformed.metrics().observations,1);

// Late and duplicate outcomes cannot change policy evidence or action counts.
const replay=new ActiveInformationGainController();
const selected=decision(replay,10);
assert.equal(replay.afterOutcome(outcome(9,selected.selectedAction,selected.selectedHypothesis)),false);
assert.equal(replay.metrics().observations,0);
assert.equal(replay.metrics().modelUpdates,0);
assert.equal(replay.afterOutcome(outcome(10,selected.selectedAction,selected.selectedHypothesis)),true);
const afterAccepted=replay.metrics();
assert.equal(replay.afterOutcome(outcome(10,selected.selectedAction,selected.selectedHypothesis)),false);
assert.equal(replay.metrics().observations,afterAccepted.observations);
assert.equal(replay.metrics().modelUpdates,afterAccepted.modelUpdates);
assert.equal(replay.metrics().rejectedOutcomes,2);

// Restored malformed state is normalized instead of poisoning the selector.
const hostile=new ActiveInformationGainController();
hostile.restore({
  tick:-4,decisions:NaN,experiments:Infinity,observations:-1,
  acceptedOutcomes:NaN,rejectedOutcomes:-8,informationGain01:Infinity,
  actionValue:{explore:NaN,verify:4,respond:-2},
  actionUncertainty:{verify:Infinity},
  actionCounts:{explore:-1,verify:3,unknown:900},
  actionWins:{explore:99,verify:4},
  hypotheses:[
    {id:'same',belief01:NaN,uncertainty01:2,evidence:-3,reward01:-1,predictionError01:Infinity,lastTick:-1},
    {id:'same',belief01:0,uncertainty01:0,evidence:0,reward01:0,predictionError01:0,lastTick:0},
    {id:'   ',belief01:0},
  ],
  pendingDecision:{tick:-2,selectedAction:'launch',selectedHypothesis:'not-valid'},
});
const safe=hostile.snapshot();
assert.equal(safe.tick,0);
assert.equal(safe.decisions,0);
assert.equal(safe.experiments,0);
assert.equal(safe.informationGain01,.15);
assert.equal(safe.actionCounts.explore,0);
assert.equal(safe.actionWins.verify,3);
assert.equal(safe.hypotheses.length,1);
assert.equal(safe.hypotheses[0].belief01,.5);
assert.equal(safe.pendingDecision,null);
assert.equal(hostile.afterOutcome(outcome(0,'respond',null)),false);

console.log(JSON.stringify({
  ok:true,
  matchedEvidence:matchedMetrics.modelUpdates,
  wrongActionEvidence:mismatchMetrics.modelUpdates,
  replayRejected:replay.metrics().rejectedOutcomes,
  restoreGuard:true,
}));
