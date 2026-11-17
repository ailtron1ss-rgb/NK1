import assert from 'node:assert/strict';
import { CognitiveParliament } from '../src/organism/system/CognitiveParliament.ts';
import { CognitiveParliamentDispatcher } from '../src/organism/system/CognitiveParliamentDispatcher.ts';
import { EvidenceFirewallEngine } from '../src/organism/system/EvidenceFirewall.ts';
import { EvidenceFirewallParliamentTrustPort } from '../src/organism/system/CognitiveParliamentTrust.ts';
import {
  OpenAICompatibleLocalParliamentRoleExecutor,
  ParliamentModelAttestationRegistry,
} from '../src/organism/system/CognitiveParliamentLocalAdapter.ts';
import { GovernanceSubsystemRuntime } from '../src/organism/core/GovernanceSubsystemRuntime.ts';

const roles=['researcher','planner','skeptic','executor','safety-guardian','auditor'];
const firewall=new EvidenceFirewallEngine();
const claimKey='nk1:parliament-dispatcher:verified-claim';
for(const [i,sourceKey] of ['source-a.example','source-b.example','source-c.example'].entries()){
  firewall.observe({claimKey,sourceClass:'external-api',sourceKey,
    sourceLineageKey:`independent-lineage-${i}`,contentHash:`independent-content-${i}`,
    confidence01:.99,trust01:.99});
}
assert.equal(firewall.claim(claimKey).status,'promoted');
const evidence=firewall.snapshot().observations.filter(row=>row.claimKey===claimKey)
  .map(row=>({id:row.id,claimKey}));
const trust=new EvidenceFirewallParliamentTrustPort(firewall,executionId=>({
  executionId,providerId:`provider-${executionId}`,modelId:`model-${executionId}`,
  independenceGroup:`family-${executionId}`,verifiedAt:Date.now(),
}));
const responseFor=role=>JSON.stringify({
  stance:'support',recommendation:`bounded ${role} recommendation',
  facts:['canonical firewall fact'],assumptions:[],objections:[],uncertainty01:.05,
  evidence,
  ...(role==='skeptic'?{reviewedEvidenceIds:evidence.map(row=>row.id)}:{}),
  ...(role==='auditor'?{auditedEvidenceIds:evidence.map(row=>row.id)}:{}),
  ...(role==='executor'?{executionAssessment:'feasible'}:{}),
  ...(role==='safety-guardian'?{safetyVerdict:'clear'}:{}),
});
const makeExecutors=(onRun=()=>{},delayMs=0)=>Object.fromEntries(roles.map(role=>[role,{
  async execute(request){
    onRun(role,request);
    if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));
    return {executionId:`host-run-${role}`,text:responseFor(role)};
  },
}]));

const parliament=new CognitiveParliament(trust);
let active=0,maxActive=0,seenTokens=[];
const executors=makeExecutors((_role,request)=>{active++;maxActive=Math.max(maxActive,active);seenTokens.push(request.maxTokens);},8);
for(const role of roles){
  const original=executors[role].execute;
  executors[role].execute=async request=>{try{return await original(request);}finally{active--;}};
}
const dispatcher=new CognitiveParliamentDispatcher(parliament,executors);
const dispatched=await dispatcher.dispatch({
  candidateId:'candidate-dispatch',risk:'high',
  task:'Evaluate whether the bounded maintenance action should proceed.',
  evidenceReferences:evidence,maxConcurrent:2,maxTotalTokens:2400,timeoutMs:2000,
});
assert.equal(dispatched.decision.status,'approved');
assert.equal(dispatched.roleResults.filter(row=>row.status==='completed').length,6);
assert.ok(maxActive<=2,'role concurrency must obey the hard fan-out limit');
assert.equal(seenTokens.length,6);
assert.ok(seenTokens.every(value=>value===400),'the total requested token budget must be partitioned across six roles');
assert.ok(dispatched.elapsedMs>=0);

// Missing providers never synthesize role reports or an approval.
const unavailable=new CognitiveParliamentDispatcher(parliament,{}).dispatch({
  candidateId:'no-providers',risk:'low',task:'Do not proceed without evidence.',evidenceReferences:evidence,
});
const unavailableResult=await unavailable;
assert.equal(unavailableResult.decision.status,'needs-evidence');
assert.equal(unavailableResult.roleResults.filter(row=>row.status==='unavailable').length,6);

// Invalid JSON and role-shape violations become failed reports, not approvals.
const validBaseline=await new CognitiveParliamentDispatcher(parliament,makeExecutors()).dispatch({
  candidateId:'valid-baseline',risk:'low',task:'Validate structured role outputs.',evidenceReferences:evidence,
});
assert.equal(validBaseline.decision.status,'approved','valid structured baseline must approve');
const malformedExecutors=Object.fromEntries(roles.map(role=>[role,{async execute(){return {executionId:`bad-${role}`,text:'not-json'};}}]));
const invalid=await new CognitiveParliamentDispatcher(parliament,malformedExecutors).dispatch({
  candidateId:'invalid-report',risk:'low',task:'Reject malformed data.',evidenceReferences:evidence,
});
assert.equal(invalid.decision.status,'needs-evidence');
assert.ok(invalid.roleResults.every(row=>row.status==='invalid-output'||row.status==='failed'));

// A runner that ignores AbortSignal must still be bounded by the dispatcher deadline.
const hanging=Object.fromEntries(roles.map(role=>[role,{execute:()=>new Promise(()=>{})}]));
const timedOut=await new CognitiveParliamentDispatcher(parliament,hanging).dispatch({
  candidateId:'timeout',risk:'low',task:'Respect the deadline.',evidenceReferences:evidence,
  timeoutMs:30,maxConcurrent:2,
});
assert.equal(timedOut.status,'timed-out');
assert.equal(timedOut.decision.status,'needs-evidence');

// Local adapters register configured host identity, never provider/model strings returned by the model.
const attestations=new ParliamentModelAttestationRegistry();
const fakeLocalProvider={
  configured:()=>true,model:'configured-host-model',
  async generate(){return {text:responseFor('planner'),backend:'model-lied-about-backend',model:'model-lied-about-name',latencyMs:2};},
};
const localExecutor=new OpenAICompatibleLocalParliamentRoleExecutor(
  fakeLocalProvider,
  {providerId:'host-configured-provider',modelId:'configured-host-model',independenceGroup:'host-configured-family'},
  attestations,
);
const localRun=await localExecutor.execute({role:'planner',system:'system',user:'user',maxTokens:100,temperature:0,signal:new AbortController().signal});
const localAttestation=attestations.attest(localRun.executionId);
assert.equal(localAttestation.providerId,'host-configured-provider');
assert.equal(localAttestation.modelId,'configured-host-model');
assert.equal(localAttestation.independenceGroup,'host-configured-family');
assert.ok(!localAttestation.modelId.includes('lied'));

// The governance entry point may forward only an approved parliamentary candidate to P69.
// P69 remains the final action selector; a parliamentary pass does not execute the action.
const governance=new GovernanceSubsystemRuntime({parliamentTrustPort:trust,parliamentRoleExecutors:makeExecutors()});
const p69Input={
  tick:1,energy01:1,thermal01:0,capacity01:1,identity01:1,realityGap01:0,
  uncertainty01:.05,novelty01:.3,socialNeed01:1,attention01:1,homeostaticPressure01:.1,
  candidates:[{id:'candidate-dispatch',action:'respond',score:.95,confidence:.95,predictedUtility:.95}],
  requestedAction:'respond',userPresent:true,upstreamMode:'respond',
};
const integrated=await governance.deliberateAndArbitrate({
  candidateId:'candidate-dispatch',risk:'high',task:'Check this exact action candidate.',
  evidenceReferences:evidence,p69Input,
});
assert.equal(integrated.parliament.decision.status,'approved');
assert.equal(integrated.status,'p69-selected');
assert.equal(integrated.arbitration?.chosen?.id,'candidate-dispatch');
const missingCandidate=await governance.deliberateAndArbitrate({
  candidateId:'missing-candidate',risk:'high',task:'Candidate must be present in P69.',
  evidenceReferences:evidence,p69Input,
});
assert.equal(missingCandidate.status,'candidate-not-in-p69-set');
assert.equal(missingCandidate.arbitration,null);

console.log(JSON.stringify({
  dispatch:dispatched.decision.status,roleCount:dispatched.roleResults.length,
  maxConcurrency:maxActive,tokenBudget:seenTokens.reduce((sum,n)=>sum+n,0),
  unavailable:unavailableResult.decision.status,malformed:invalid.decision.status,
  timeout:timedOut.status,localAttestation:'host-identity-only',
  governanceIntegration:integrated.status,p69Selection:integrated.arbitration?.chosen?.id,
},null,2));
