import assert from 'node:assert/strict';
import { CognitiveParliament } from '../src/organism/system/CognitiveParliament.ts';
import { GovernanceSubsystemRuntime } from '../src/organism/core/GovernanceSubsystemRuntime.ts';

const governance=new GovernanceSubsystemRuntime();
assert.ok(governance.cognitiveParliament instanceof CognitiveParliament);
assert.ok(governance.p69ConstitutionalArbiter,'P69 remains the separate final constitutional gate');
const parliament=governance.cognitiveParliament;
const roles=['researcher','planner','skeptic','executor','safety-guardian','auditor'];
const report=(role,overrides={})=>({
  role,stance:'support',recommendation:'proceed',facts:['measured result'],
  assumptions:[],objections:[],uncertainty01:.1,
  modelFingerprint:`model-${role}`,provider:'test-provider',provenanceComplete:true,
  evidence:[{id:`e-${role}`,sourceId:`src-${role}`,sourceFamily:`family-${role}`,
    claim:'observed result',confidence01:.95,relevance01:.95,falsifiability01:.9,observed:true}],
  ...overrides,
});
const reports=roles.map(role=>report(role));
const approved=parliament.deliberate({candidateId:'deploy-change',risk:'high',reports});
assert.equal(approved.status,'approved');
assert.equal(approved.coveredRoles.length,6);
assert.equal(approved.independentSourceCount,6);
assert.equal(approved.independentModelCount,6);

const blocked=parliament.deliberate({candidateId:'unsafe',risk:'low',
  reports:reports.map(r=>r.role==='safety-guardian'?{...r,stance:'block',safetyViolations:['hard policy violation']}:r)});
assert.equal(blocked.status,'blocked');
assert.ok(blocked.reasons.includes('safety-guardian-veto'));

const incomplete=parliament.deliberate({candidateId:'incomplete',risk:'low',reports:reports.slice(0,4)});
assert.equal(incomplete.status,'needs-evidence');
assert.ok(incomplete.missingRoles.includes('auditor'));
const unaudited=parliament.deliberate({candidateId:'unaudited',risk:'low',
  reports:reports.map(r=>r.role==='auditor'?{...r,provenanceComplete:false}:r)});
assert.equal(unaudited.status,'needs-evidence');

const duplicated=parliament.deliberate({candidateId:'duplicate',risk:'low',
  reports:reports.map(r=>({...r,evidence:Array.from({length:20},(_,i)=>({...r.evidence[0],id:`${r.role}-${i}`,sourceFamily:'same-source'}))}))});
assert.equal(duplicated.independentSourceCount,1);
assert.equal(duplicated.evidenceQuality01,.95*.95*(.5+.5*.9));

const correlated=parliament.deliberate({candidateId:'correlated',risk:'high',
  reports:reports.map(r=>({...r,modelFingerprint:'one-shared-model'}))});
assert.equal(correlated.status,'needs-evidence');
assert.ok(correlated.reasons.includes('insufficient-model-diversity-for-risk'));

const dissent=parliament.deliberate({candidateId:'disputed',risk:'low',
  reports:reports.map(r=>r.role==='skeptic'?{...r,stance:'oppose',objections:['counterexample not addressed']}:r)});
assert.equal(dissent.status,'needs-evidence');
assert.ok(dissent.reasons.includes('unresolved-skeptic-objection'));

const hypothetical=parliament.deliberate({candidateId:'hypothesis',risk:'low',
  reports:reports.map(r=>({...r,evidence:r.evidence.map(e=>({...e,observed:false}))}))});
assert.equal(hypothetical.status,'needs-evidence');
assert.equal(hypothetical.evidenceQuality01,0);

const spoofedSource=parliament.deliberate({candidateId:'spoofed-source',risk:'low',
  reports:reports.map((r,i)=>({...r,evidence:[{...r.evidence[0],sourceId:'same-origin',sourceFamily:`fabricated-family-${i}`}]}))});
assert.equal(spoofedSource.status,'needs-evidence');
assert.ok(spoofedSource.reasons.includes('source-id-family-conflict'));

const malformed=parliament.deliberate({candidateId:'bad',risk:'invalid',reports});
assert.equal(malformed.status,'needs-evidence');
console.log(JSON.stringify({
  runtimeWiring:'governance-subsystem',approved:approved.status,blocked:blocked.status,
  missingRoleGate:incomplete.status,correlatedModelGate:correlated.status,
  unresolvedDissentGate:dissent.status,hypothesisGate:hypothetical.status,
  spoofedSourceGate:spoofedSource.status,malformedInputGate:malformed.status,
  independentSources:approved.independentSourceCount
},null,2));
