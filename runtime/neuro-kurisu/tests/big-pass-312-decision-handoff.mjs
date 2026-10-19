import assert from 'node:assert/strict';
import { B312ExecutiveDecisionHandoff } from '../src/organism/system/B312ExecutiveDecisionHandoff.ts';

const handoff=new B312ExecutiveDecisionHandoff();
const base={tick:1,policyAction:'explore',policyCredit01:.86,policyMargin01:.06,policyVerifiedUpdates:8,currentAction:'verify',currentCandidateScore01:.54,policyCandidateScore01:.50,externalInput:false,userRequestedAction:null,constitutionalBlocked:false,quorumAccepted:true,repairPressure01:.1,identity01:.9,realityGap01:.08};
const promoted=handoff.evaluate(base);
assert.equal(promoted.promotedAction,'explore');
assert.equal(promoted.applied,true);

handoff.lesion(true);
const lesioned=handoff.evaluate({...base,tick:2});
assert.equal(lesioned.applied,false);
assert.equal(lesioned.reason,'lesioned');
handoff.clearLesion();

const blocked=handoff.evaluate({...base,tick:3,constitutionalBlocked:true});
assert.equal(blocked.applied,false);
assert.equal(blocked.reason,'safety-or-governance-block');

const external=handoff.evaluate({...base,tick:4,externalInput:true,userRequestedAction:'verify'});
assert.equal(external.applied,false);
assert.equal(external.reason,'external-request-protection');

const restored=new B312ExecutiveDecisionHandoff();
restored.restore(handoff.snapshot());
const d=restored.diagnostics();
assert.equal(d.evaluations,4);
assert.equal(d.promotions,1);
assert.ok(d.lastReason==='external-request-protection');
console.log(JSON.stringify({pass:true,promotedReason:promoted.reason,eligibility01:promoted.eligibility01,lesionReason:lesioned.reason,blockedReason:blocked.reason,externalReason:external.reason,restoreEvaluations:d.evaluations,restorePromotions:d.promotions},null,2));
process.exit(0);
