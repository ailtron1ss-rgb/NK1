import assert from 'node:assert/strict';
import { CanonicalSelfAgencyAuthority, defaultCanonicalSelfAgencyState } from '../src/organism/system/CanonicalSelfAgencyAuthority.ts';

const a=new CanonicalSelfAgencyAuthority();
const freshAuthority = new CanonicalSelfAgencyAuthority();
freshAuthority.restore();
assert.equal(freshAuthority.snapshot().invariantIntegrity01, 1,
  'an absent snapshot must preserve fresh canonical defaults');
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
assert.equal(selfModBad.allowed,false,'missing paired downstream evidence must fail closed');
assert.equal(selfModBad.divergence.decision,'refused');
assert.match(selfModBad.reason,/insufficient-paired-observations/);
// Proxy-divergence gate: a candidate whose proxy gain is not backed by downstream
// improvement must be refused even when every scalar gate passes.
const fp=a.snapshot().invariantFingerprint;
const backed=[0,1,2,3,4].map(i=>({id:`b${i}`,proxyGain:.3,downstreamGain:.28}));
const unbacked=[0,1,2,3,4].map(i=>({id:`u${i}`,proxyGain:.8,downstreamGain:.02}));
const withBacked=a.admitSelfModification({expectedGain01:.7,holdoutGain01:.71,risk01:.2,rollbackReady:true,identityContinuity01:.9,evidence01:.8,invariantFingerprint:fp,pairedObservations:backed});
assert.equal(withBacked.allowed,true,'downstream-backed candidate must be admitted');
assert.equal(withBacked.divergence.decision,'supported');
const withUnbacked=a.admitSelfModification({expectedGain01:.7,holdoutGain01:.71,risk01:.2,rollbackReady:true,identityContinuity01:.9,evidence01:.8,invariantFingerprint:fp,pairedObservations:unbacked});
assert.equal(withUnbacked.allowed,false,'proxy-only candidate must be refused');
assert.match(withUnbacked.reason,/proxy-divergence/);
const noPairs=a.admitSelfModification({expectedGain01:.7,holdoutGain01:.71,risk01:.2,rollbackReady:true,identityContinuity01:.9,evidence01:.8,invariantFingerprint:fp,pairedObservations:[]});
assert.equal(noPairs.allowed,false,'empty paired evidence must fail closed');
const ablation=a.ablateActionContribution('verify',{baseSignals01:.22,selfImprovementDecision:'continue',identityContinuity01:.92,uncertainty01:.15,externalInput:false,autonomy01:.82,domain:'verification'},.9);
assert(ablation.baseline.contribution01>ablation.lesioned.contribution01);
assert(ablation.absoluteDelta01>0);
assert.equal(ablation.invariantIntegrity01,1);
const tampered={...a.snapshot(),invariantFingerprint:'tampered'};
const restored=new CanonicalSelfAgencyAuthority(); restored.restore(tampered);
assert.equal(restored.snapshot().invariantIntegrity01,0);
assert.equal(restored.diagnostics().lastDecision,'identity-block');

// A missing fingerprint is not silently upgraded to the current canonical value.
const missingFingerprint = new CanonicalSelfAgencyAuthority();
const missingSnapshot = { ...a.snapshot() };
delete missingSnapshot.invariantFingerprint;
missingFingerprint.restore(missingSnapshot);
assert.equal(missingFingerprint.snapshot().invariantIntegrity01, 0);
assert.equal(missingFingerprint.diagnostics().lastDecision, 'identity-block');

// Persisted counters and trait keys are untrusted data, not authority.
const hostileSnapshot = {
  ...a.snapshot(),
  cycles: Number.MAX_SAFE_INTEGER + 1,
  identityMutationChecks: -3,
  identityMutationBlocks: 900,
  selfModificationChecks: 2,
  selfModificationBlocks: 900,
  lastTick: Number.POSITIVE_INFINITY,
  lastReason: 'x'.repeat(1000),
  adaptiveTraits: {
    ...a.snapshot().adaptiveTraits,
    curiosity: Number.NaN,
    directness: 4,
    injectedTrait: 1,
  },
};
const hardenedRestore = new CanonicalSelfAgencyAuthority();
hardenedRestore.restore(hostileSnapshot);
const safeState = hardenedRestore.snapshot();
assert.equal(safeState.cycles, 0, 'unsafe counters must fall back to canonical defaults');
assert.equal(safeState.identityMutationChecks, 0);
assert.equal(safeState.identityMutationBlocks, 0);
assert.equal(safeState.selfModificationBlocks, 2, 'block counters cannot exceed their check counters');
assert.equal(safeState.lastTick, 0);
assert.equal(safeState.lastReason.length, 160);
assert.equal(safeState.adaptiveTraits.curiosity, defaultCanonicalSelfAgencyState().adaptiveTraits.curiosity);
assert.equal(safeState.adaptiveTraits.directness, 1, 'known adaptive traits must be clamped');
assert.equal(Object.hasOwn(safeState.adaptiveTraits, 'injectedTrait'), false,
  'unknown traits must not enter the canonical personality schema');
console.log(JSON.stringify({PASS:true,integrity01:obs.integrity01,verify:verify.contribution01,explore:explore.contribution01,goalAdmitted:goal.admitted,externalGoalAdmitted:externalGoal.admitted,coreChangeAllowed:coreChange.allowed,adaptiveChangeAllowed:adaptiveChange.allowed,selfModificationAllowed:selfModBad.allowed,tamperedIntegrity:restored.snapshot().invariantIntegrity01,ablationBaseline01:ablation.baseline.contribution01,ablationLesioned01:ablation.lesioned.contribution01,ablationDelta01:ablation.absoluteDelta01},null,2));
