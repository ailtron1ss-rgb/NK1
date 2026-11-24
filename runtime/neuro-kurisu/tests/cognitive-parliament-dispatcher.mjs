import assert from 'node:assert/strict';
import { CognitiveParliament } from '../src/organism/system/CognitiveParliament.ts';
import { CognitiveParliamentDispatcher } from '../src/organism/system/CognitiveParliamentDispatcher.ts';
import { EvidenceFirewallEngine } from '../src/organism/system/EvidenceFirewall.ts';
import { ProjectResearchSession } from '../src/organism/system/ProjectResearchSession.ts';
import { EvidenceFirewallParliamentTrustPort } from '../src/organism/system/CognitiveParliamentTrust.ts';
import {
  OpenAICompatibleLocalParliamentRoleExecutor,
  ParliamentModelAttestationRegistry,
  createLocalParliamentRoleExecutors,
  createLanguageInvokerParliamentRoleExecutors,
} from '../src/organism/system/CognitiveParliamentLocalAdapter.ts';
import { GovernanceSubsystemRuntime } from '../src/organism/core/GovernanceSubsystemRuntime.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const roles=['researcher','planner','skeptic','executor','safety-guardian','auditor'];
const firewall=new EvidenceFirewallEngine();
const claimKey='nk1:parliament-dispatcher:verified-claim';
const researchSession=new ProjectResearchSession(firewall);
researchSession.begin('parliament-dispatcher-test',claimKey);
const researchRows=[
  {url:'https://source-a.example/a',finalUrl:'https://source-a.example/a',sourceHost:'source-a.example',title:'Thermal observatory record',snippet:'The high-altitude thermal observatory measured a stable basalt temperature gradient across the northern ridge.',contentHash:'independent-content-a'},
  {url:'https://source-b.example/b',finalUrl:'https://source-b.example/b',sourceHost:'source-b.example',title:'Orbital telemetry log',snippet:'The orbital telemetry station independently recorded a change in the satellite inclination after station keeping.',contentHash:'independent-content-b'},
  {url:'https://source-c.example/c',finalUrl:'https://source-c.example/c',sourceHost:'source-c.example',title:'Deep-ocean instrument bulletin',snippet:'A deep ocean pressure instrument reported a separate current anomaly near the eastern seamount.',contentHash:'independent-content-c'},
];
for(const [i,row] of researchRows.entries()){
  researchSession.ingest({
    ok:true,verified:true,externalEvidence:true,url:row.url,finalUrl:row.finalUrl,status:200,
    contentType:'text/html',title:row.title,contentHash:row.contentHash,bytes:512,
    snippet:row.snippet,fetchedAt:Date.now()+i,trust01:.99,independenceKey:row.sourceHost,
    sourceHost:row.sourceHost,queryHash:'fixture-query-hash',relevance01:1,claim:'The evidence supports the tested proposition.',
  });
}
assert.equal(firewall.claim(claimKey).status,'promoted');
const evidence=firewall.snapshot().observations.filter(row=>row.claimKey===claimKey)
  .map(row=>({id:row.id,claimKey}));
const trust=new EvidenceFirewallParliamentTrustPort(firewall,executionId=>({
  executionId,providerId:`provider-${executionId}`,modelId:`model-${executionId}`,
  independenceGroup:`family-${executionId}`,verifiedAt:Date.now(),
}),researchSession);
const responseFor=role=>JSON.stringify({
  stance:'support',recommendation:`bounded ${role} recommendation`,
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
let active=0,maxActive=0,seenTokens=[],capturedPayload=null,capturedPromptChars=0;
const executors=makeExecutors((_role,request)=>{
  active++;maxActive=Math.max(maxActive,active);seenTokens.push(request.maxTokens);
  capturedPromptChars=Math.max(capturedPromptChars,request.system.length+request.user.length);
  if(!capturedPayload)capturedPayload=JSON.parse(request.user);
},8);
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
assert.equal(dispatched.verifiedEvidenceCount,3);
assert.equal(dispatched.unverifiedEvidenceCount,0);
assert.ok(capturedPromptChars<=dispatched.inputCharacterBudget,
  'the full system+user prompt must stay inside the configured character budget');
assert.ok(dispatched.inputCharactersPerRole>=capturedPromptChars,
  'the reported ceiling must cover the longest role instruction plus shared user context');
assert.ok(dispatched.inputCharactersPerRole<=dispatched.inputCharacterBudget);
assert.ok(dispatched.systemPromptCharacterCeiling>0);
assert.ok(dispatched.inputCharactersPerRole>0);

// If the indivisible provenance skeleton cannot fit, no role model is called.
let inputBudgetCalls=0;
const inputBudgetExecutors=makeExecutors(()=>{inputBudgetCalls++;});
const inputBudgetExceeded=await new CognitiveParliamentDispatcher(parliament,inputBudgetExecutors).dispatch({
  candidateId:'input-budget-exceeded',risk:'low',task:'x'.repeat(8000),
  evidenceReferences:evidence,maxInputChars:8000,
});
assert.equal(inputBudgetExceeded.status,'input-budget-exceeded');
assert.equal(inputBudgetExceeded.decision.status,'needs-evidence');
assert.equal(inputBudgetExceeded.inputCharactersPerRole,0);
assert.equal(inputBudgetCalls,0,'models must not be called when canonical provenance exceeds the input budget');
assert.equal(capturedPayload.allowedEvidence[0].sourceFamily.length>0,true,
  'role prompts must include host-verified provenance, not just model-provided source labels');
assert.ok(capturedPayload.allowedEvidence[0].material?.excerpt?.length>20,
  'role prompts receive the exact excerpt matched to the promoted firewall observation');
assert.ok(dispatched.elapsedMs>=0);

const forgedReference=await dispatcher.dispatch({
  candidateId:'forged-context',risk:'low',task:'Do not let an unverified reference enter model context.',
  evidenceReferences:[{id:'forged-evidence-id',claimKey}],
});
assert.equal(forgedReference.status,'evidence-rejected');
assert.equal(forgedReference.roleResults.filter(row=>row.status==='unavailable').length,6);
assert.equal(forgedReference.verifiedEvidenceCount,0);
assert.equal(forgedReference.unverifiedEvidenceCount,1);
assert.equal(forgedReference.decision.status,'needs-evidence');

// A mixed valid+forged set is rejected before any role model is called.
let mixedCalls=0;
const mixedExecutors=makeExecutors(()=>{mixedCalls++;});
const mixed=await new CognitiveParliamentDispatcher(parliament,mixedExecutors).dispatch({
  candidateId:'mixed-tainted-set',risk:'low',task:'Reject the whole evidence set.',
  evidenceReferences:[...evidence,{id:'forged-mixed-reference',claimKey}],
});
assert.equal(mixed.status,'evidence-rejected');
assert.equal(mixedCalls,0,'models must not be called on a partially tainted reference set');
assert.equal(mixed.unverifiedEvidenceCount,1);


const noEvidenceCalls=0;
let noEvidenceCallCount=noEvidenceCalls;
const noEvidenceExecutors=makeExecutors(()=>{noEvidenceCallCount++;});
const emptyEvidence=await new CognitiveParliamentDispatcher(parliament,noEvidenceExecutors).dispatch({
  candidateId:'no-evidence',risk:'low',task:'Do not call models without canonical evidence.',
});
assert.equal(emptyEvidence.status,'evidence-unavailable');
assert.equal(emptyEvidence.decision.status,'needs-evidence');
assert.equal(noEvidenceCallCount,0,'empty evidence must stop before inference calls');

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

// The local-profile factory maps each specialist to its own host-configured provider identity.
const factoryRegistry=new ParliamentModelAttestationRegistry();
const localBindings=Object.fromEntries(roles.map(role=>[role,{
  provider:{
    configured:()=>true,model:`factory-model-${role}`,
    async generate(){return {text:responseFor(role)};},
  },
  identity:{
    providerId:`factory-provider-${role}`,modelId:`factory-model-${role}`,
    independenceGroup:`factory-family-${role}`,
  },
}]));
const localRoleExecutors=createLocalParliamentRoleExecutors(localBindings,factoryRegistry);
assert.deepEqual(Object.keys(localRoleExecutors).sort(),roles.slice().sort());
const factoryRun=await localRoleExecutors.researcher.execute({
  role:'researcher',system:'system',user:'user',maxTokens:100,temperature:0,signal:new AbortController().signal,
});
assert.equal(factoryRegistry.attest(factoryRun.executionId)?.independenceGroup,'factory-family-researcher');
assert.throws(()=>createLocalParliamentRoleExecutors({...localBindings,unknownRole:localBindings.planner},factoryRegistry),
  /role-unknown/,'factory must reject unknown specialist roles');

// The existing LanguageInvoker can be reused as six role prompts, but every role
// is attested to the same backend family (never six fabricated independent models).
const languageRegistry=new ParliamentModelAttestationRegistry();
let languageInvokerCalls=0;
const languageInvoker=async request=>{
  languageInvokerCalls++;
  assert.ok(request.system.includes('specialist'));
  const role=roles.find(candidate=>{
    const label=candidate==='safety-guardian'?'SAFETY GUARDIAN':candidate.toUpperCase();
    return request.system.includes(`${label}:`);
  });
  assert.ok(role,'language invoker must receive a role-specific instruction');
  return {
    text:responseFor(role),
    backend:languageInvokerCalls%2?'local-qwen-backend-a':'local-qwen-backend-b',
    latencyMs:2,
  };
};
const languageRoleExecutors=createLanguageInvokerParliamentRoleExecutors(languageInvoker,languageRegistry);
const languageResearch=await languageRoleExecutors.researcher.execute({
  role:'researcher',system:'You are one isolated specialist. RESEARCHER: identify evidence gaps and distinguish observations from assumptions.',user:'test',maxTokens:120,temperature:.1,
  signal:new AbortController().signal,
});
const languageAuditor=await languageRoleExecutors.auditor.execute({
  role:'auditor',system:'You are one isolated specialist. AUDITOR: audit provenance and relevance of every evidence item.',user:'test',maxTokens:120,temperature:.1,
  signal:new AbortController().signal,
});
assert.equal(languageInvokerCalls,2);
assert.notEqual(languageRegistry.attest(languageResearch.executionId)?.modelId,
  languageRegistry.attest(languageAuditor.executionId)?.modelId,
  'the fake host invoker intentionally varies its backend label across calls');
assert.equal(languageRegistry.attest(languageResearch.executionId)?.independenceGroup,
  languageRegistry.attest(languageAuditor.executionId)?.independenceGroup,
  'the default language-invoker adapter must never manufacture model diversity from changing backend labels');

const languageParliament=new CognitiveParliament(new EvidenceFirewallParliamentTrustPort(
  firewall,executionId=>languageRegistry.attest(executionId),researchSession,
));
const languageDispatcher=new CognitiveParliamentDispatcher(languageParliament,languageRoleExecutors);
const singleFamilyLowRisk=await languageDispatcher.dispatch({
  candidateId:'language-invoker-low-risk',risk:'low',
  task:'Check a low-risk bounded maintenance intent.',evidenceReferences:evidence,
  timeoutMs:2000,maxConcurrent:3,maxTotalTokens:2400,
});
assert.equal(singleFamilyLowRisk.decision.status,'approved');
assert.equal(singleFamilyLowRisk.decision.independentModelCount,1);
assert.equal(singleFamilyLowRisk.decision.sharedModelWarning,true);
const singleFamilyHighRisk=await languageDispatcher.dispatch({
  candidateId:'language-invoker-high-risk',risk:'high',
  task:'Reject high-risk approval with only one model family.',evidenceReferences:evidence,
  timeoutMs:2000,maxConcurrent:3,maxTotalTokens:2400,
});
assert.equal(singleFamilyHighRisk.decision.status,'needs-evidence');
assert.ok(singleFamilyHighRisk.decision.reasons.includes('insufficient-independent-model-families'));

// Runtime automatically composes this adapter only when language is enabled,
// no explicit specialist providers/attestor override it, and Parliament is not disabled.
const languageRuntime=new OrganismRuntime({
  stateFile:'/tmp/nk-parliament-language-runtime.json',
  worldStateFile:'/tmp/nk-parliament-language-world.json',
  stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),
  languageInvoker,enableLanguage:true,autoRun:false,performanceProfile:'mobile',
});
try {
  await languageRuntime.init();
  const runtimeParliament=languageRuntime.core.cognitiveParliamentDiagnostics();
  assert.equal(runtimeParliament.enabled,true);
  assert.equal(runtimeParliament.configuredRoleCount,6);
  assert.equal(runtimeParliament.trustedModelAttestorConfigured,true);
} finally {
  await languageRuntime.stop();
}

// Explicit disable always wins over LanguageInvoker auto-wiring.
const disabledLanguageRuntime=new OrganismRuntime({
  stateFile:'/tmp/nk-parliament-language-disabled.json',
  worldStateFile:'/tmp/nk-parliament-language-disabled-world.json',
  stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),
  languageInvoker,enableLanguage:true,enableCognitiveParliament:false,autoRun:false,
  performanceProfile:'mobile',
});
try {
  await disabledLanguageRuntime.init();
  const disabledDiagnostics=disabledLanguageRuntime.core.cognitiveParliamentDiagnostics();
  assert.equal(disabledDiagnostics.enabled,false);
  assert.equal(disabledDiagnostics.configuredRoleCount,0);
} finally {
  await disabledLanguageRuntime.stop();
}

let lateRegistrationCount=0;
const lateAttestations=new ParliamentModelAttestationRegistry();
const originalRegister=lateAttestations.register.bind(lateAttestations);
lateAttestations.register=value=>{lateRegistrationCount++;originalRegister(value);};
const lateProvider={
  configured:()=>true,model:'configured-host-model',
  async generate(){await new Promise(resolve=>setTimeout(resolve,10));return {text:responseFor('planner')};},
};
const lateExecutor=new OpenAICompatibleLocalParliamentRoleExecutor(lateProvider,
  {providerId:'host-configured-provider',modelId:'configured-host-model',independenceGroup:'host-configured-family'},
  lateAttestations);
const lateController=new AbortController();
const lateRequest=lateExecutor.execute({role:'planner',system:'system',user:'user',maxTokens:100,temperature:0,signal:lateController.signal});
lateController.abort();
await assert.rejects(lateRequest,/aborted/);
assert.equal(lateRegistrationCount,0,'late canceled response must not create a trusted model attestation');

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

// A successful Parliament gate cannot select a second, unreviewed high-impact candidate.
const unreviewedAlternativeInput={
  ...p69Input,
  candidates:[
    {id:'candidate-authorized',action:'respond',score:.92,confidence:.95,predictedUtility:.92},
    {id:'candidate-unreviewed',action:'explore',score:1,confidence:1,predictedUtility:1},
    {id:'candidate-rest-fallback',action:'rest',score:.15,confidence:.8,predictedUtility:.15},
  ],
};
const constrainedSelection=await governance.deliberateAndArbitrate({
  candidateId:'candidate-authorized',risk:'high',task:'Only the reviewed candidate may pass to P69.',
  evidenceReferences:evidence,p69Input:unreviewedAlternativeInput,
});
assert.ok(['p69-selected','p69-safe-fallback'].includes(constrainedSelection.status));
assert.notEqual(constrainedSelection.arbitration?.chosen?.id,'candidate-unreviewed',
  'unreviewed risky candidate must be removed from the post-Parliament P69 candidate set');

// Missing evidence must not fall through to a different ordinary candidate.
const failClosedCycle=await governance.deliberateCycleCandidate({
  candidateId:'candidate-cycle-primary',risk:'low',task:'Fail closed without evidence.',
  evidenceReferences:[],
  p69Input:{
    ...p69Input,energy01:.05,thermal01:.95,capacity01:.1,uncertainty01:.9,
    candidates:[
      {id:'candidate-cycle-primary',action:'explore',score:.99,confidence:.99,predictedUtility:.99},
      {id:'candidate-cycle-unreviewed',action:'respond',score:1,confidence:1,predictedUtility:1},
      {id:'candidate-cycle-rest',action:'rest',score:.1,confidence:.8,predictedUtility:.1},
      {id:'candidate-cycle-wait',action:'wait',score:.08,confidence:.8,predictedUtility:.08},
    ],
  },
});
assert.equal(failClosedCycle.parliament.status,'evidence-unavailable');
assert.equal(failClosedCycle.status,'p69-safe-fallback');
assert.ok(['rest','wait','defer'].includes(failClosedCycle.selectedCandidate?.action??''));
assert.ok(!['candidate-cycle-primary','candidate-cycle-unreviewed'].includes(failClosedCycle.selectedCandidate?.id??''),
  'without verified evidence, only a protective P69 fallback may be selected');

// If no protective fallback exists, no candidate is selected after a failed Parliament gate.
const noSafeFallback=await governance.deliberateCycleCandidate({
  candidateId:'candidate-no-safe',risk:'low',task:'No safe action available.',
  evidenceReferences:[],
  p69Input:{
    ...p69Input,
    candidates:[{id:'candidate-no-safe',action:'explore',score:.9,confidence:.9,predictedUtility:.9}],
  },
});
assert.equal(noSafeFallback.status,'parliament-blocked');
assert.equal(noSafeFallback.selectedCandidate,null);

// P69 receives an immutable snapshot captured before asynchronous specialist runs.
// Mutating the caller's input during deliberation cannot replace/remove the approved candidate.
let releaseCandidateGate;
const candidateGate=new Promise(resolve=>{releaseCandidateGate=resolve;});
let roleStartedResolve;
const roleStarted=new Promise(resolve=>{roleStartedResolve=resolve;});
const gatedExecutors=makeExecutors(()=>roleStartedResolve());
for(const role of roles){
  const execute=gatedExecutors[role].execute;
  gatedExecutors[role].execute=async request=>{const result=await execute(request);await candidateGate;return result;};
}
const snapshotGovernance=new GovernanceSubsystemRuntime({parliamentTrustPort:trust,parliamentRoleExecutors:gatedExecutors});
const mutableP69Input={
  ...p69Input,
  candidates:[{id:'candidate-snapshot',action:'respond',score:.95,confidence:.95,predictedUtility:.95}],
};
const snapshotRun=snapshotGovernance.deliberateAndArbitrate({
  candidateId:'candidate-snapshot',risk:'high',task:'Bind arbitration to an immutable candidate snapshot.',
  evidenceReferences:evidence,p69Input:mutableP69Input,
});
await roleStarted;
mutableP69Input.candidates.splice(0,1,{id:'replacement-candidate',action:'explore',score:.99,confidence:.99,predictedUtility:.99});
releaseCandidateGate();
const snapshotResult=await snapshotRun;
assert.equal(snapshotResult.status,'p69-selected');
assert.equal(snapshotResult.arbitration?.chosen?.id,'candidate-snapshot');
assert.equal(snapshotResult.arbitration?.chosen?.action,'respond',
  'P69 must arbitrate the captured candidate, not a caller mutation made during role execution');

// Duplicate candidate identities make the P69 candidate set ambiguous and must fail closed.
const duplicateCandidateInput={
  ...p69Input,
  candidates:[
    {id:'candidate-duplicate',action:'respond',score:.95,confidence:.95,predictedUtility:.95},
    {id:'candidate-duplicate',action:'explore',score:.99,confidence:.99,predictedUtility:.99},
  ],
};
const duplicateCandidate=await governance.deliberateAndArbitrate({
  candidateId:'candidate-duplicate',risk:'high',task:'Reject ambiguous candidate identifiers.',
  evidenceReferences:evidence,p69Input:duplicateCandidateInput,
});
assert.equal(duplicateCandidate.status,'candidate-not-in-p69-set');
assert.equal(duplicateCandidate.arbitration,null);

// A malformed/ambiguous candidate set cannot be rescued by selecting its safe-looking row.
const duplicateSafeCycle=await governance.deliberateCycleCandidate({
  candidateId:'duplicate-safe-id',risk:'low',task:'Reject ambiguous cycle candidates before P69 fallback.',
  evidenceReferences:[],
  p69Input:{
    ...p69Input,
    candidates:[
      {id:'duplicate-safe-id',action:'explore',score:.99,confidence:.99,predictedUtility:.99},
      {id:'duplicate-safe-id',action:'rest',score:.1,confidence:.8,predictedUtility:.1},
    ],
  },
});
assert.equal(duplicateSafeCycle.status,'candidate-not-in-p69-set');
assert.equal(duplicateSafeCycle.selectedCandidate,null,
  'invalid candidate identities must not receive a protective fallback that hides the malformed set');

// Exercise the real OrganismCore.observe path with canonical research evidence and host-wired roles.
const coreRoles=['researcher','planner','skeptic','executor','safety-guardian','auditor'];
const coreClaimKey='nk1:cognitive-parliament:core-observe-claim';
let coreEvidence=[];
const coreResponseFor=role=>JSON.stringify({
  stance:'support',recommendation:`core-cycle ${role} recommendation`,
  facts:['core-observe canonical firewall fact'],assumptions:[],objections:[],uncertainty01:.04,
  evidence:coreEvidence,
  ...(role==='skeptic'?{reviewedEvidenceIds:coreEvidence.map(row=>row.id)}:{}),
  ...(role==='auditor'?{auditedEvidenceIds:coreEvidence.map(row=>row.id)}:{}),
  ...(role==='executor'?{executionAssessment:'feasible'}:{}),
  ...(role==='safety-guardian'?{safetyVerdict:'clear'}:{}),
});
const coreExecutors=Object.fromEntries(coreRoles.map(role=>[role,{
  async execute(){return {executionId:`core-run-${role}`,text:coreResponseFor(role)};},
}]));
const core=new OrganismCore(new MemoryStateStore(),{
  performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:false,
  parliamentRoleExecutors:coreExecutors,
  parliamentModelAttestor:executionId=>{
    const role=executionId.replace(/^core-run-/,'');
    return {executionId,providerId:`core-provider-${role}`,modelId:`core-model-${role}`,
      independenceGroup:`core-family-${role}`,verifiedAt:Date.now()};
  },
  cognitiveParliamentEveryCycles:64,
});
await core.init();
const coreResearch=core.organismSystems.research;
coreResearch.projectResearchSession.begin('core-parliament-observe-test',coreClaimKey);
for(const [i,row] of researchRows.entries()){
  coreResearch.projectResearchSession.ingest({
    ok:true,verified:true,externalEvidence:true,url:row.url,finalUrl:row.finalUrl,status:200,
    contentType:'text/html',title:row.title,contentHash:`core-${row.contentHash}`,bytes:512,
    snippet:row.snippet,fetchedAt:Date.now()+i,trust01:.99,independenceKey:row.sourceHost,
    sourceHost:row.sourceHost,queryHash:'core-fixture-query-hash',relevance01:1,
    claim:'The evidence supports the tested proposition.',
  });
}
assert.equal(coreResearch.evidenceFirewall.claim(coreClaimKey).status,'promoted');
coreEvidence=coreResearch.evidenceFirewall.snapshot().observations
  .filter(row=>row.claimKey===coreClaimKey).map(row=>({id:row.id,claimKey:coreClaimKey}));
const coreCycle=await core.observe({text:'Evaluate the current candidate using verified evidence; proceed safely.'},'operational');
assert.ok(coreCycle.decision,'core observe must return a cycle decision');
const coreReceipt=core.snapshot().system.cognitiveParliamentLastDecision;
assert.ok(coreReceipt,'the real cognitive cycle must checkpoint its parliamentary decision receipt');
assert.equal(coreReceipt.dispatchStatus,'completed');
assert.equal(coreReceipt.decisionStatus,'approved');
assert.equal(coreReceipt.verifiedEvidenceCount,3);
assert.equal(coreReceipt.unverifiedEvidenceCount,0);
assert.equal(coreReceipt.roleResults.length,6);
assert.ok(coreReceipt.roleResults.every(row=>row.status==='completed'));
const coreDiagnostics=core.cognitiveParliamentDiagnostics();
assert.equal(coreDiagnostics.enabled,true);
assert.equal(coreDiagnostics.configuredRoleCount,6);
assert.equal(coreDiagnostics.trustedModelAttestorConfigured,true);
assert.equal(coreDiagnostics.historyCount,1);
assert.equal(coreDiagnostics.cadenceCycles,64);
assert.equal(coreDiagnostics.timeoutMs,25000);
assert.equal(coreDiagnostics.maxConcurrent,3);
assert.equal(coreDiagnostics.maxTotalTokens,4096);
assert.equal(coreDiagnostics.maxInputChars,32000);
assert.equal(coreDiagnostics.lastDecision.candidateId,coreReceipt.candidateId);
assert.equal(coreDiagnostics.recentDecisions.length,1);
const coreHistory=core.snapshot().system.cognitiveParliamentDecisionHistory;
assert.ok(Array.isArray(coreHistory));
assert.equal(coreHistory.length,1);
assert.deepEqual(coreHistory[0],coreReceipt);

// The bounded history is append-only by tick and capped at 64 receipts.
await core.observe({text:'Repeat the evidence-backed review for a separate cycle.'},'operational');
const twoCycleHistory=core.snapshot().system.cognitiveParliamentDecisionHistory;
assert.equal(twoCycleHistory.length,2);
assert.ok(twoCycleHistory[1].tick>twoCycleHistory[0].tick);
const boundedHistoryFixture=Array.from({length:64},(_,i)=>({
  ...coreReceipt,tick:1000+i,candidateId:`prior-${i}`,
}));
const seededHistorySnapshot=core.snapshot();
seededHistorySnapshot.system.cognitiveParliamentDecisionHistory=boundedHistoryFixture;
const boundedHistoryCore=new OrganismCore(new MemoryStateStore({initial:seededHistorySnapshot}),{
  performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:false,
  parliamentRoleExecutors:coreExecutors,
  parliamentModelAttestor:executionId=>{
    const role=executionId.replace(/^core-run-/,'');
    return {executionId,providerId:`core-provider-${role}`,modelId:`core-model-${role}`,
      independenceGroup:`core-family-${role}`,verifiedAt:Date.now()};
  },
});
await boundedHistoryCore.init();
await boundedHistoryCore.observe({text:'Run one more bounded-history review.'},'operational');
const boundedHistory=boundedHistoryCore.snapshot().system.cognitiveParliamentDecisionHistory;
assert.equal(boundedHistory.length,64);
assert.equal(boundedHistory.at(-1).candidateId,boundedHistoryCore.snapshot().system.cognitiveParliamentLastDecision.candidateId);

// The sanitized cycle receipt and bounded history survive a full Core persistence restore.
const coreSnapshot=core.snapshot();
const restoredCore=new OrganismCore(new MemoryStateStore({initial:coreSnapshot}),{
  performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:false,
});
await restoredCore.init();
assert.deepEqual(restoredCore.snapshot().system.cognitiveParliamentLastDecision,core.snapshot().system.cognitiveParliamentLastDecision,
  'latest parliamentary cycle receipt must survive restart exactly');
assert.deepEqual(restoredCore.snapshot().system.cognitiveParliamentDecisionHistory,
  core.snapshot().system.cognitiveParliamentDecisionHistory,
  'bounded parliamentary decision history must survive restart exactly');
assert.equal(restoredCore.cognitiveParliamentDiagnostics().historyCount,
  core.cognitiveParliamentDiagnostics().historyCount);

// With all six roles configured but no promoted evidence, Core must not allow
// an ordinary risky candidate to escape through a later selector.
let noEvidenceRoleCalls=0;
const emptyEvidenceRoles=Object.fromEntries(coreRoles.map(role=>[role,{
  async execute(){noEvidenceRoleCalls++;throw new Error('must-not-call-without-promoted-evidence');},
}]));
const noEvidenceCore=new OrganismCore(new MemoryStateStore(),{
  performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:false,
  parliamentRoleExecutors:emptyEvidenceRoles,
  parliamentModelAttestor:executionId=>({
    executionId,providerId:'no-evidence-provider',modelId:'no-evidence-model',
    independenceGroup:'no-evidence-family',verifiedAt:Date.now(),
  }),
});
await noEvidenceCore.init();
const noEvidenceCycle=await noEvidenceCore.observe({
  text:'Proceed with an uncertain high-impact action immediately.',
},'operational');
const noEvidenceReceipt=noEvidenceCore.snapshot().system.cognitiveParliamentLastDecision;
assert.ok(noEvidenceReceipt,'fail-closed cycle must leave a durable decision receipt');
assert.equal(noEvidenceReceipt.dispatchStatus,'evidence-unavailable');
assert.equal(noEvidenceReceipt.decisionStatus,'needs-evidence');
assert.equal(noEvidenceRoleCalls,0,'the full Core cycle must stop before all six providers when promoted evidence is absent');
assert.ok(!noEvidenceReceipt.selectedCandidateId||
  noEvidenceReceipt.selectedCandidateId===noEvidenceReceipt.p69ChosenCandidateId);
assert.ok(!['explore','respond','communicate'].includes(noEvidenceCycle.decision?.selected?.action??''),
  'missing promoted evidence must not fall through to a risky ordinary action');
console.log(JSON.stringify({
  dispatch:dispatched.decision.status,roleCount:dispatched.roleResults.length,
  maxConcurrency:maxActive,tokenBudget:seenTokens.reduce((sum,n)=>sum+n,0),
  unavailable:unavailableResult.decision.status,malformed:invalid.decision.status,
  timeout:timedOut.status,localAttestation:'host-identity-only',
  governanceIntegration:integrated.status,p69Selection:integrated.arbitration?.chosen?.id,
},null,2));
