import assert from 'node:assert/strict';
import { CognitiveParliament } from '../src/organism/system/CognitiveParliament.ts';
import { EvidenceFirewallEngine } from '../src/organism/system/EvidenceFirewall.ts';
import { EvidenceFirewallParliamentTrustPort } from '../src/organism/system/CognitiveParliamentTrust.ts';
import { GovernanceSubsystemRuntime } from '../src/organism/core/GovernanceSubsystemRuntime.ts';

const firewall=new EvidenceFirewallEngine();
const claimKey='nk1:cognitive-parliament:known-fact';
for(const [i,sourceKey] of ['alpha.example','beta.example','gamma.example'].entries()){
  firewall.observe({claimKey,sourceClass:'external-api',sourceKey,documentKey:`doc-${i}`,
    sourceLineageKey:`lineage-${i}`,contentHash:`sha256-content-${i}`,
    confidence01:.98,trust01:.98,at:Date.now()+i});
}
const evidenceRows=firewall.snapshot().observations.filter(row=>row.claimKey===claimKey);
assert.equal(firewall.claim(claimKey).status,'promoted','fixture must create firewall-promoted evidence');
const evidence=evidenceRows.map(row=>({id:row.id,claimKey}));
const modelFamilies=['model-family-a','model-family-b','model-family-c'];
const modelAttestor=executionId=>{
  const group=modelFamilies[Number(executionId.split('-').at(-1))%modelFamilies.length];
  return {executionId,providerId:`provider-${group}`,modelId:`model-${group}`,independenceGroup:group,verifiedAt:Date.now()};
};
const parliament=new CognitiveParliament(new EvidenceFirewallParliamentTrustPort(firewall,modelAttestor));
const syndicatedFirewall=new EvidenceFirewallEngine();
const syndicatedClaim='nk1:cognitive-parliament:syndicated-copy';
for(const row of [
  {sourceKey:'publisher-a.example',lineage:'same-syndicated-story',hash:'copy-a'},
  {sourceKey:'publisher-b.example',lineage:'same-syndicated-story',hash:'copy-b'},
  {sourceKey:'publisher-c.example',lineage:'independent-story',hash:'copy-c'},
]){
  syndicatedFirewall.observe({claimKey:syndicatedClaim,sourceClass:'external-api',sourceKey:row.sourceKey,
    sourceLineageKey:row.lineage,contentHash:row.hash,confidence01:.98,trust01:.98});
}
assert.equal(syndicatedFirewall.claim(syndicatedClaim).status,'promoted');
const syndicatedRows=syndicatedFirewall.snapshot().observations.filter(row=>row.claimKey===syndicatedClaim);
const syndicatedSession=new EvidenceFirewallParliamentTrustPort(syndicatedFirewall,modelAttestor).openSession();
const syndicatedVerified=syndicatedRows.map(row=>syndicatedSession.verifyEvidence({id:row.id,claimKey:syndicatedClaim}));
assert.ok(syndicatedVerified.every(Boolean));
const syndicatedFamilies=new Map(syndicatedRows.map((row,index)=>[row.sourceKey,syndicatedVerified[index].sourceFamily]));
assert.equal(syndicatedFamilies.get('publisher-a.example'),syndicatedFamilies.get('publisher-b.example'),
  'syndicated publisher copies are one source family');
assert.notEqual(syndicatedFamilies.get('publisher-a.example'),syndicatedFamilies.get('publisher-c.example'),
  'a separate lineage remains independent');

const staleFirewall=new EvidenceFirewallEngine();
const staleClaim='nk1:cognitive-parliament:stale-observation';
staleFirewall.observe({claimKey:staleClaim,sourceClass:'external-api',sourceKey:'stale.example',
  contentHash:'stale-content',confidence01:.99,trust01:.99,at:Date.now()-31*24*60*60*1000});
staleFirewall.observe({claimKey:staleClaim,sourceClass:'external-api',sourceKey:'fresh-a.example',
  contentHash:'fresh-content-a',confidence01:.99,trust01:.99});
staleFirewall.observe({claimKey:staleClaim,sourceClass:'external-api',sourceKey:'fresh-b.example',
  contentHash:'fresh-content-b',confidence01:.99,trust01:.99});
assert.equal(staleFirewall.claim(staleClaim).status,'promoted');
const staleRows=staleFirewall.snapshot().observations.filter(row=>row.claimKey===staleClaim);
const staleSession=new EvidenceFirewallParliamentTrustPort(staleFirewall,modelAttestor).openSession();
const staleObservation=staleRows.find(row=>row.sourceKey==='stale.example');
const freshObservation=staleRows.find(row=>row.sourceKey==='fresh-a.example');
assert.ok(staleObservation&&freshObservation);
assert.equal(staleSession.verifyEvidence({id:staleObservation.id,claimKey:staleClaim}),null,
  'an old observation cannot borrow a fresh promoted claim status');
assert.ok(staleSession.verifyEvidence({id:freshObservation.id,claimKey:staleClaim}),
  'a fresh observation covered by the promotion receipt remains valid');

const governance=new GovernanceSubsystemRuntime();
assert.ok(governance.cognitiveParliament instanceof CognitiveParliament);
assert.equal(governance.cognitiveParliament.deliberate({candidateId:'no-trust',risk:'low',reports:[]}).status,'needs-evidence',
  'default runtime must fail closed without trusted evidence/model adapters');

const roles=['researcher','planner','skeptic','executor','safety-guardian','auditor'];
const reports=roles.map((role,i)=>({
  role,stance:'support',recommendation:'proceed with bounded change',facts:['observed firewall claim'],
  ...(role==='executor'?{executionAssessment:'feasible'}:{}),
  assumptions:[],objections:[],uncertainty01:.08,modelExecutionId:`run-${i}`,evidence,
  ...(role==='skeptic'?{reviewedEvidenceIds:evidence.map(e=>e.id)}:{}),
  ...(role==='auditor'?{auditedEvidenceIds:evidence.map(e=>e.id)}:{}),
  ...(role==='safety-guardian'?{safetyVerdict:'clear'}:{}),
}));
const approved=parliament.deliberate({candidateId:'deploy-change',risk:'high',reports});
assert.equal(approved.status,'approved');
assert.equal(approved.coveredRoles.length,6);
assert.equal(approved.independentSourceCount,3);
assert.equal(approved.independentModelCount,3);
assert.ok(approved.score01<=approved.evidenceQuality01,'uncertainty may lower score; no role votes raise it');

// A different distribution of role stances cannot add score. Dissent can only hold the decision.
const dissent=parliament.deliberate({candidateId:'disputed',risk:'high',
  reports:reports.map(r=>r.role==='skeptic'?{...r,stance:'oppose',objections:['unresolved counterexample']}:r)});
assert.equal(dissent.status,'needs-evidence');
assert.equal(dissent.score01,approved.score01);

// Safety Guardian veto is absolute.
const blocked=parliament.deliberate({candidateId:'unsafe',risk:'low',
  reports:reports.map(r=>r.role==='safety-guardian'?{...r,safetyVerdict:'block',safetyViolations:['hard constraint']}:r)});
assert.equal(blocked.status,'blocked');
const uncertainSafety=parliament.deliberate({candidateId:'uncertain-safety',risk:'low',
  reports:reports.map(r=>r.role==='safety-guardian'?{...r,safetyVerdict:'uncertain'}:r)});
assert.equal(uncertainSafety.status,'needs-evidence');

// Missing roles, audit gaps and skeptic gaps fail closed.
const incomplete=parliament.deliberate({candidateId:'incomplete',risk:'low',reports:reports.slice(0,4)});
assert.equal(incomplete.status,'needs-evidence');
assert.ok(incomplete.missingRoles.includes('auditor'));
const unaudited=parliament.deliberate({candidateId:'unaudited',risk:'low',
  reports:reports.map(r=>r.role==='auditor'?{...r,auditedEvidenceIds:[]}:r)});
assert.ok(unaudited.reasons.includes('auditor-evidence-coverage-incomplete'));
assert.equal(unaudited.status,'needs-evidence');
const unreviewed=parliament.deliberate({candidateId:'unreviewed',risk:'low',
  reports:reports.map(r=>r.role==='skeptic'?{...r,reviewedEvidenceIds:[]}:r)});
assert.ok(unreviewed.reasons.includes('skeptic-review-coverage-incomplete'));

// Provider/model identity is host-attested; shared model families cannot satisfy high-risk diversity.
const noModelAttestor=new CognitiveParliament(new EvidenceFirewallParliamentTrustPort(firewall));
const unattestedModel=noModelAttestor.deliberate({candidateId:'unattested-model',risk:'low',reports});
assert.equal(unattestedModel.status,'needs-evidence');
assert.ok(unattestedModel.reasons.includes('unverified-model-execution:researcher'));
const sharedPort=new EvidenceFirewallParliamentTrustPort(firewall,id=>({
  executionId:id,providerId:'one-provider',modelId:'one-model',independenceGroup:'one-family',verifiedAt:Date.now()
}));
const shared=new CognitiveParliament(sharedPort).deliberate({candidateId:'shared',risk:'high',reports});
assert.equal(shared.status,'needs-evidence');
assert.ok(shared.reasons.includes('insufficient-independent-model-families'));

// Model-supplied evidence IDs cannot pass when absent from the canonical promoted firewall.
const forged=parliament.deliberate({candidateId:'forged',risk:'low',
  reports:reports.map(r=>({...r,evidence:[{id:'invented-observation',claimKey}]}))});
assert.equal(forged.status,'needs-evidence');
assert.ok(forged.reasons.includes('unverified-or-unpromoted-evidence'));

// A real firewall observation from an unpromoted claim cannot be used as proof.
const quarantinedKey='nk1:unpromoted';
const quarantined=firewall.observe({claimKey:quarantinedKey,sourceClass:'external-api',sourceKey:'lonely.example',
  contentHash:'single-hash',confidence01:.99,trust01:.99});
const unpromoted=parliament.deliberate({candidateId:'unpromoted',risk:'low',
  reports:reports.map(r=>({...r,evidence:[{id:firewall.snapshot().observations.find(x=>x.claimKey===quarantinedKey).id,claimKey:quarantinedKey}]}))});
assert.equal(unpromoted.status,'needs-evidence');

// Evidence references with conflicting claim identities and duplicate inference IDs are rejected.
const conflict=parliament.deliberate({candidateId:'conflict',risk:'low',
  reports:reports.map((r,i)=>({...r,evidence:i===0?[{id:evidence[0].id,claimKey:'different-claim'}]:evidence}))});
assert.equal(conflict.status,'needs-evidence');
const repeatedRun=parliament.deliberate({candidateId:'reused-run',risk:'low',
  reports:reports.map(r=>({...r,modelExecutionId:'same-run'}))});
assert.equal(repeatedRun.status,'needs-evidence');

// Executor feasibility is a separate role contract, not inferred from other votes.
const infeasible=parliament.deliberate({candidateId:'infeasible',risk:'low',
  reports:reports.map(r=>r.role==='executor'?{...r,executionAssessment:'infeasible'}:r)});
assert.equal(infeasible.status,'rejected');
const unknownExecution=parliament.deliberate({candidateId:'unknown-execution',risk:'low',
  reports:reports.map(r=>r.role==='executor'?{...r,executionAssessment:'unknown'}:r)});
assert.equal(unknownExecution.status,'needs-evidence');
const missingExecution=parliament.deliberate({candidateId:'missing-execution',risk:'low',
  reports:reports.map(r=>r.role==='executor'?(({executionAssessment,...rest})=>rest)(r):r)});
assert.equal(missingExecution.status,'needs-evidence');

// Malformed contracts and oversized report batches do not result in approval.
assert.equal(parliament.deliberate({candidateId:'bad-risk',risk:'invalid',reports}).status,'needs-evidence');
assert.equal(parliament.deliberate({candidateId:'overflow',risk:'low',reports:[...reports,...reports]}).status,'needs-evidence');

console.log(JSON.stringify({
  runtimeDefault:'fail-closed',approved:approved.status,blocked:blocked.status,
  missingRoleGate:incomplete.status,unpromotedEvidenceGate:unpromoted.status,
  forgedEvidenceGate:forged.status,sharedModelGate:shared.status,
  auditorCoverageGate:unaudited.status,skepticCoverageGate:unreviewed.status,
  independentSources:approved.independentSourceCount,independentModels:approved.independentModelCount
},null,2));
