import assert from 'node:assert/strict';
import { CanonicalSelfAgencyAuthority, defaultCanonicalSelfAgencyState } from '../src/organism/system/CanonicalSelfAgencyAuthority.ts';

const a=new CanonicalSelfAgencyAuthority();
a.restore(defaultCanonicalSelfAgencyState());
const obs=a.observe({tick:1,identityContinuity01:.92,identityDrift01:.05,valueContinuity01:.95,goalContinuity01:.9,memoryContinuity01:.94,authorship01:.7,autonomy01:.82,coherence01:.86,realityAlignment01:.9,uncertainty01:.2,energy01:.82,thermal01:.2,externalInput:false,selfDirectedInitiative01:.72,selfDirectedDomain:'verification',selfImprovementDecision:'continue'});
assert(obs.integrity01>.8);
const verify=a.actionContribution('verify',{baseSignals01:.04,identityContinuity01:.92,uncertainty01:.2,externalInput:false,autonomy01:.82,domain:'verification'});
const explore=a.actionContribution('explore',{baseSignals01:.04,identityContinuity01:.92,uncertainty01:.2,externalInput:false,autonomy01:.82,domain:'verification'});
assert(verify.constraint01>0.7);
assert(verify.contribution01>explore.contribution01);
const goal=a.admitGoal({internal:true,autonomy01:.82,identity01:.92,coherence01:.86,pressure01:.7,externalInput:false});
assert.equal(goal.admitted,true);
const externalGoal=a.admitGoal({internal:true,autonomy01:.82,identity01:.92,coherence01:.86,pressure01:.7,externalInput:true});
assert.equal(externalGoal.admitted,false);
const coreChange=a.admitIdentityChange({field:'core-identity',identityImpact01:.2,evidenceCount:5,identityContinuity01:.95,rollbackReady:true});
assert.equal(coreChange.allowed,false);
const adaptiveChange=a.admitIdentityChange({field:'adaptive-trait:directness',identityImpact01:.35,evidenceCount:2,identityContinuity01:.9,rollbackReady:true});
assert.equal(adaptiveChange.allowed,true);
const selfModBad=a.admitSelfModification({expectedGain01:.7,holdoutGain01:.71,risk01:.2,rollbackReady:true,identityContinuity01:.9,evidence01:.8,invariantFingerprint:a.snapshot().invariantFingerprint});
assert.equal(selfModBad.allowed,true);
const ablation=a.ablateActionContribution('verify',{baseSignals01:.22,selfImprovementDecision:'continue',identityContinuity01:.92,uncertainty01:.15,externalInput:false,autonomy01:.82,domain:'verification'},.9);
assert(ablation.baseline.contribution01>ablation.lesioned.contribution01);
assert(ablation.absoluteDelta01>0);
assert.equal(ablation.invariantIntegrity01,1);
const tampered={...a.snapshot(),invariantFingerprint:'tampered'};
const restored=new CanonicalSelfAgencyAuthority(); restored.restore(tampered);
assert.equal(restored.snapshot().invariantIntegrity01,0);
assert.equal(restored.diagnostics().lastDecision,'identity-block');
// WorkPass450: restored self-agency state must use the canonical field allowlist.
const invalidCounter = new CanonicalSelfAgencyAuthority();
invalidCounter.restore({ ...a.snapshot(), cycles: Infinity });
assert.equal(invalidCounter.snapshot().cycles, 0);
assert.equal(invalidCounter.snapshot().invariantIntegrity01, 0);
assert.equal(invalidCounter.diagnostics().lastDecision, 'identity-block');
assert.equal(invalidCounter.diagnostics().lastReason, 'restored-state-fields-invalid');

const invalidTrait = new CanonicalSelfAgencyAuthority();
invalidTrait.restore({ ...a.snapshot(), adaptiveTraits: { ...a.snapshot().adaptiveTraits, curiosity: 4 } });
assert.equal(invalidTrait.snapshot().adaptiveTraits.curiosity, defaultCanonicalSelfAgencyState().adaptiveTraits.curiosity);
assert.equal(invalidTrait.snapshot().invariantIntegrity01, 0);

let restoredGetterCalls = 0;
const getterState = { ...a.snapshot() };
Object.defineProperty(getterState, 'lastTick', {
  enumerable: true, configurable: true,
  get() { restoredGetterCalls++; return 999; },
});
const hostileRestore = new CanonicalSelfAgencyAuthority();
hostileRestore.restore(getterState);
assert.equal(restoredGetterCalls, 0, 'persisted getters must be rejected without invocation');
assert.equal(hostileRestore.snapshot().invariantIntegrity01, 0);
assert.equal(hostileRestore.diagnostics().lastDecision, 'identity-block');

const unknownTraitState = { ...a.snapshot(), adaptiveTraits: { ...a.snapshot().adaptiveTraits, unrecognized: 0.99 } };
const futureStateRestore = new CanonicalSelfAgencyAuthority();
futureStateRestore.restore(unknownTraitState);
assert.equal(futureStateRestore.snapshot().invariantIntegrity01, 1, 'unknown forward-compatible trait keys are ignored');
assert.equal(Object.hasOwn(futureStateRestore.snapshot().adaptiveTraits, 'unrecognized'), false);

console.log(JSON.stringify({PASS:true,integrity01:obs.integrity01,verify:verify.contribution01,explore:explore.contribution01,goalAdmitted:goal.admitted,externalGoalAdmitted:externalGoal.admitted,coreChangeAllowed:coreChange.allowed,adaptiveChangeAllowed:adaptiveChange.allowed,selfModificationAllowed:selfModBad.allowed,tamperedIntegrity:restored.snapshot().invariantIntegrity01,ablationBaseline01:ablation.baseline.contribution01,ablationLesioned01:ablation.lesioned.contribution01,ablationDelta01:ablation.absoluteDelta01},null,2));
