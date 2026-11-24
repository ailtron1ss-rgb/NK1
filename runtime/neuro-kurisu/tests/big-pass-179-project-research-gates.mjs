import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { AutonomousProjectExecutor } from '../src/organism/system/AutonomousProjectExecutor.ts';
import { EvidenceFirewallEngine } from '../src/organism/system/EvidenceFirewall.ts';
import { ProjectResearchSession } from '../src/organism/system/ProjectResearchSession.ts';
import { ExternalProjectResearchTool } from '../src/organism/system/ExternalProjectResearchTool.ts';

// External-network policy failures are surfaced before a fetch or retry is attempted.
const disabled = new ExternalProjectResearchTool({ enabled: false, allowHosts: ['example.com'] });
assert.deepEqual(disabled.preflightUrl({ url: '' }), { ok: false, error: 'project-network-disabled' });
const enabled = new ExternalProjectResearchTool({ enabled: true, allowHosts: ['example.com'] });
assert.equal(enabled.preflightUrl({ url: '' }).error, 'project-research-url-required');
assert.equal(enabled.preflightUrl({ url: 'http://example.com' }).error, 'only-https-allowed');
assert.equal(enabled.preflightUrl({ url: 'https://not-allowed.invalid' }).error, 'host-not-allowlisted');
assert.equal(enabled.preflightUrl({ url: 'https://example.com/research' }).ok, true);

// A second hostname serving identical bytes must not promote external evidence.
const result=(host,hash,at)=>({ok:true,verified:true,externalEvidence:true,url:`https://${host}/doc`,finalUrl:`https://${host}/doc`,status:200,contentType:'text/html',title:'doc',contentHash:hash,bytes:100,snippet:'same-ish',fetchedAt:at,trust01:.9,independenceKey:host});
const now=Date.now();
const fwSame=new EvidenceFirewallEngine();
const same=new ProjectResearchSession(fwSame); same.begin('same-bytes');
same.ingest(result('a.example','same-hash',now));
const sameState=same.ingest(result('b.example','same-hash',now+10));
assert.equal(sameState.promoted,false,'different hosts must not promote identical content');
assert.equal(sameState.distinctSourceKeys,2);
assert.equal(sameState.uniqueContentHashes,1);
const fwSubdomains=new EvidenceFirewallEngine();
const subdomains=new ProjectResearchSession(fwSubdomains); subdomains.begin('same-publisher-subdomains');
subdomains.ingest({...result('a.publisher.com','subdomain-hash-a',now),independenceKey:'claimed-a.org'});
const samePublisherState=subdomains.ingest({...result('b.publisher.com','subdomain-hash-b',now+10000),independenceKey:'claimed-b.net'});
assert.equal(samePublisherState.distinctSourceKeys,1,'subdomains of the same publisher must share a source identity');
assert.equal(samePublisherState.promoted,false,'publisher subdomains cannot manufacture independent corroboration');
const fwMultiPage=new EvidenceFirewallEngine();
const multiPage=new ProjectResearchSession(fwMultiPage); multiPage.begin('same-publisher-multiple-pages');
multiPage.ingest(result('www.publisher.com','page-hash-a',now));
const multiPageState=multiPage.ingest({...result('www.publisher.com','page-hash-b',now+20000),url:'https://www.publisher.com/other',finalUrl:'https://www.publisher.com/other'});
assert.equal(multiPageState.independentSources,1,'multiple URLs from one publisher remain one source');
assert.equal(multiPageState.firewallStatus,'quarantine','different pages by the same publisher are not automatically treated as contradictory');
const fwDifferent=new EvidenceFirewallEngine();
const different=new ProjectResearchSession(fwDifferent); different.begin('different-bytes');
different.ingest(result('a.example','hash-a',now));
const promoted=different.ingest(result('b.example','hash-b',now+10));
assert.equal(promoted.promoted,true,'independent source and content diversity can promote');

// DAG completion is gated by the exact research proof, not merely tool confidence.
const ex=new AutonomousProjectExecutor(); ex.ensure({id:'research-gate',origin:'intrinsic'});
const first=ex.currentStep(); assert(first);
assert.equal(ex.completeToolStep({tick:1,tool:first.preferredTool,verified:true,evidence01:.9})?.completed,true,'ordinary first step remains compatible');
const repeat=ex.currentStep(); assert.equal(repeat?.id,'repeat');
assert.equal(repeat?.preferredTool,'organism.project.research');
assert.equal(ex.completeToolStep({tick:2,tool:'organism.project.research',verified:true,evidence01:.99,externalResearchVerified:true,researchPromoted:false}),null);
assert.equal(ex.currentStep()?.completed,false,'repeat cannot complete before firewall promotion');
assert.equal(ex.completeToolStep({tick:3,tool:'organism.project.research',verified:true,evidence01:.9,externalResearchVerified:true,researchPromoted:true}),null,'one successful fetch is not enough for the two-attempt research step');
assert.equal(ex.currentStep()?.id,'repeat');
assert.equal(ex.completeToolStep({tick:4,tool:'organism.project.research',verified:true,evidence01:.9,externalResearchVerified:true,researchPromoted:true})?.completed,true);
const consolidate=ex.currentStep(); assert.equal(consolidate?.id,'consolidate');
assert.equal(ex.completeToolStep({tick:5,tool:consolidate.preferredTool,verified:true,evidence01:.99,researchPromoted:false}),null);
assert.equal(ex.completeToolStep({tick:6,tool:consolidate.preferredTool,verified:true,evidence01:.9,researchPromoted:true}),null,'consolidation requires two qualifying executions');
assert.equal(ex.currentStep()?.id,'consolidate');
assert.equal(ex.completeToolStep({tick:7,tool:consolidate.preferredTool,verified:true,evidence01:.9,researchPromoted:true})?.completed,true);

// A failure from an unrelated tool must not spend the active step's retry budget.
const unrelated=new AutonomousProjectExecutor(); unrelated.ensure({id:'retry-isolation',origin:'unresolved'});
const before=unrelated.currentStep();
unrelated.observeToolResult({tick:1,tool:'organism.unrelated.tool',ok:false,error:'unrelated failure'});
assert.equal(unrelated.currentStep()?.failureAttempts??0,0);
assert.equal(unrelated.currentStep()?.lastFailureReason,undefined);

// Real Core integration: missing external research configuration must not spend budget or retry attempts.
const savedEnv = Object.fromEntries(['NEURO_PROJECT_NETWORK_ENABLED','NEURO_PROJECT_NETWORK_ALLOWLIST','NEURO_PROJECT_RESEARCH_URL','NEURO_PROJECT_RESEARCH_URL_2','KURISU_RESEARCH_NLI_ENDPOINT','KURISU_RESEARCH_NLI_TIMEOUT_MS','KURISU_RESEARCH_NLI_MIN_SCORE','KURISU_RESEARCH_NLI_MIN_MARGIN'].map(k=>[k,process.env[k]]));
process.env.NEURO_PROJECT_NETWORK_ENABLED='false';
process.env.NEURO_PROJECT_NETWORK_ALLOWLIST='';
process.env.NEURO_PROJECT_RESEARCH_URL='';
process.env.NEURO_PROJECT_RESEARCH_URL_2='';
// Exercise the real Core -> configured HTTP backend seam without contacting a model host.
// This is an integration fixture, not a claim that pretrained model quality was tested.
const nliServer=createServer(async(req,res)=>{
  let body=''; for await (const chunk of req) body+=chunk;
  let input={}; try { input=JSON.parse(body); } catch { res.writeHead(400); res.end(); return; }
  if(req.method!=='POST'||req.url!=='/v1/nli'){res.writeHead(404);res.end();return;}
  if(String(input.premise||'').includes('NLI_OUTAGE')){res.writeHead(503,{'content-type':'application/json'});res.end('{"error":"mock-outage"}');return;}
  const contradiction=/not safe/i.test(String(input.premise||''));
  const scores=contradiction?{entailment:.02,contradiction:.94,neutral:.04}:{entailment:.93,contradiction:.02,neutral:.05};
  const payload=JSON.stringify({modelId:'mock-core-nli-v1',modelRevision:'c'.repeat(40),scores,calibrated:false});
  res.writeHead(200,{'content-type':'application/json','content-length':Buffer.byteLength(payload)});res.end(payload);
});
await new Promise(resolve=>nliServer.listen(0,'127.0.0.1',resolve));
process.env.KURISU_RESEARCH_NLI_ENDPOINT=`http://127.0.0.1:${nliServer.address().port}/v1/nli`;
process.env.KURISU_RESEARCH_NLI_TIMEOUT_MS='800';
const tmpRoot=await mkdtemp(join(tmpdir(),'nk-wp17-research-'));
try {
  const core=new OrganismCore(new FileStateStore(join(tmpRoot,'state.json')),{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'});
  await core.init();
  await core.observe({
    text:'исследуй новую неизвестную область',
    worldContext:{location:'lab',facts:['unknown signal'],objects:[{id:'signal',label:'signal',location:'lab',value:.9,visible:true,collected:false}],events:['surprise']},
    embodiment:{bodyEnergy01:.94,cognitiveCapacity01:.92,thermalStrain01:.08,sensoryFreshness01:.98,awake:true,battery01:.95,cpuLoad01:.12,ramPressure01:.15},
  });
  assert(core.autonomousProjectLifeSnapshot().project,'Core should have an active project');

  // External snippets enter canonical MemoryOS2 only after source/content diversity,
  // remain hypotheses (never facts), and are quarantined again when a source conflicts.
  const projectId=core.autonomousProjectLifeSnapshot().project.id;
  let researchQueryHash='a'.repeat(64);
  const mkResearch=(host,sourceKey,contentHash,at,snippet='Evidence describes a measurable adaptive-system result with reproducible methods and explicit limitations.',claim)=>({
    ok:true,verified:true,externalEvidence:true,url:`https://${host}/paper`,finalUrl:`https://${host}/paper`,status:200,
    contentType:'text/html',title:`Paper from ${host}`,contentHash,bytes:512,snippet,fetchedAt:at,trust01:.94,
    independenceKey:sourceKey,sourceHost:host,queryHash:researchQueryHash,relevance01:.94,matchedQueryTerms:['adaptive','system','evidence'],
    ...(claim?{claim}:{}),
  });
  researchQueryHash='f'.repeat(64);
  // Claim-level evidence is wired through Core -> ProjectResearchSession -> MemoryOS2.
  // Two independent direct text anchors may be summarized as textual support; a later
  // support/refute mix must quarantine earlier hypothesis notes rather than keep reinforcing it.
  const claim='System is safe for deployment';
  const claimOne=await core.ingestExternalProjectResearch(mkResearch('alpha.publisher-c.example','publisher-c.example','1'.repeat(64),Date.now()-1600,'The release review states: System is safe for deployment.',claim));
  assert.equal(claimOne.claimVerification.verdict,'unknown','one publisher cannot establish independent model-assisted support');
  assert.equal(claimOne.claimVerification.scope,'model-assisted-entailment');
  assert.equal(claimOne.positiveEvidenceApplied,false,'one NLI source cannot receive project progress credit');
  const claimTwo=await core.ingestExternalProjectResearch(mkResearch('beta.publisher-d.example','publisher-d.example','2'.repeat(64),Date.now()-1300,'The integration report confirms: System is safe for deployment.',claim));
  assert.equal(claimTwo.claimVerification.verdict,'support');
  assert.equal(claimTwo.claimVerification.independentSupportSources,2);
  assert.equal(claimTwo.claimVerification.semanticSupportSources,2,'two distinct model-scored lineages are required');
  assert.equal(claimTwo.session.results.filter(r=>r.claimAssessment?.method==='nli-cross-encoder-v1').at(-1)?.claimAssessment?.modelId,'mock-core-nli-v1');
  assert.equal(claimTwo.positiveEvidenceApplied,true,'independent model-assisted support may pass the Core credit gate after firewall promotion');
  let claimMemories=core.memorySubsystem.memoryOS.snapshot({clone:false}).items.filter(m=>m.source==='external-project-research'&&m.context?.researchProjectId===projectId&&m.context?.researchQueryHash===researchQueryHash&&m.context?.researchClaimText===claim);
  assert.equal(claimMemories.length,2,'direct claim evidence is integrated into canonical MemoryOS2 after publisher/content diversity');
  assert(claimMemories.every(m=>m.epistemicStatus==='hypothesis'&&m.context?.researchClaimVerdict==='support'&&m.context?.researchClaimEvidenceQuote),'claim notes retain exact quote and remain hypotheses');
  const claimMixed=await core.ingestExternalProjectResearch(mkResearch('gamma.publisher-e.example','publisher-e.example','3'.repeat(64),Date.now()-700,'The deployment review states: System is not safe for deployment.',claim));
  assert.equal(claimMixed.claimVerification.verdict,'mixed','contradictory model-scored evidence must be visible');
  assert.equal(claimMixed.positiveEvidenceApplied,false,'mixed NLI evidence cannot receive project credit');
  claimMemories=core.memorySubsystem.memoryOS.snapshot({clone:false}).items.filter(m=>m.source==='external-project-research'&&m.context?.researchProjectId===projectId&&m.context?.researchQueryHash===researchQueryHash&&m.context?.researchClaimText===claim);
  assert(claimMemories.every(m=>m.epistemicStatus==='quarantined'&&m.context?.researchStatus==='quarantined-claim-conflict'),'mixed claim evidence must quarantine previous notes in canonical memory');

  // WorkPass21: mirrored/syndicated pages must share one lineage across publisher
  // domains, must not promote on their own, and must not create duplicate MemoryOS2 notes.
  researchQueryHash='9'.repeat(64);
  const lineageClaim='System is safe for deployment';
  const syndicatedBody='System is safe for deployment. The independent review examined the release configuration, dependency inventory, access policy, network boundaries, persistent state, failure recovery, audit logs, and user-facing workflow. Reviewers also inspected rollback procedure, permission boundaries, secret handling, operational monitoring, version alignment, backup recovery, incident response, and failure containment. The published report states that the candidate passed the specified checks in the tested environment while documenting limitations around prolonged operation, external providers, and model confidence. Operators should preserve the original source material and repeat relevant procedures whenever the deployed configuration changes. The report does not claim that every possible failure mode has been eliminated.';
  const lineageStart=await core.ingestExternalProjectResearch(mkResearch('alpha.wire-example.test','wire-example.test','4'.repeat(64),Date.now()-2500,syndicatedBody,lineageClaim));
  assert.equal(lineageStart.promoted,false);
  const lineageCopy=await core.ingestExternalProjectResearch(mkResearch('beta.republisher-example.test','republisher-example.test','5'.repeat(64),Date.now()-2200,`Reprinted story: ${syndicatedBody} Publisher contact details follow.`,lineageClaim));
  assert.equal(lineageCopy.session.results[0].lineageRelation,'near-duplicate');
  assert.equal(lineageCopy.session.duplicateLineageCount,1);
  assert.equal(lineageCopy.claimVerification.independentSupportSources,1,'cross-domain copies of the same wire story count as one evidence lineage');
  assert.equal(lineageCopy.promoted,false,'syndicated copies do not satisfy independent corroboration');
  let lineageMemories=core.memorySubsystem.memoryOS.snapshot({clone:false}).items.filter(m=>m.source==='external-project-research'&&m.context?.researchProjectId===projectId&&m.context?.researchQueryHash===researchQueryHash&&m.context?.researchClaimText===lineageClaim);
  assert.equal(lineageMemories.length,0,'same-story mirrors remain in the bounded session until genuinely independent evidence exists');
  const independentStory='System is safe for deployment. A separate operations team evaluated another deployment environment and recorded independent measurements for recovery latency, rollback completion, service availability, access-boundary enforcement, resource pressure, incident handling, and configuration drift. This report uses its own sample window, separate instrumentation and a different review procedure rather than repeating the release candidate article. It documents observed conditions, limitations and its own recommendations based on separate records gathered by the operations team.';
  const lineageThird=await core.ingestExternalProjectResearch(mkResearch('gamma.independent-example.test','independent-example.test','6'.repeat(64),Date.now()-1800,independentStory,lineageClaim));
  assert.equal(lineageThird.promoted,true,'a separate evidence lineage may combine with the syndicated cluster to meet source diversity');
  assert.equal(lineageThird.claimVerification.independentSupportSources,2);
  lineageMemories=core.memorySubsystem.memoryOS.snapshot({clone:false}).items.filter(m=>m.source==='external-project-research'&&m.context?.researchProjectId===projectId&&m.context?.researchQueryHash===researchQueryHash&&m.context?.researchClaimText===lineageClaim);
  assert.equal(lineageMemories.length,2,'one canonical note per independent story lineage, not one per publisher mirror');
  assert(lineageMemories.every(m=>m.context?.researchLineageKey),'canonical memory notes preserve lineage identity');
  const mirroredNote=lineageMemories.find(m=>String(m.context?.researchMirrorUrls??'').includes('beta.republisher-example.test'));
  assert(mirroredNote,'mirror URL is retained as provenance on the canonical note');

  researchQueryHash='a'.repeat(64);
  const one=await core.ingestExternalProjectResearch(mkResearch('alpha.publisher-a.example','publisher-a.example','b'.repeat(64),Date.now()-3000));
  assert.equal(one.promoted,false,'one source must not become a promoted research session');
  let researchMemories=core.memorySubsystem.memoryOS.snapshot({clone:false}).items.filter(m=>m.source==='external-project-research'&&m.context?.researchProjectId===projectId&&m.context?.researchQueryHash===researchQueryHash);
  assert.equal(researchMemories.length,0,'single-source snippets should stay in bounded session, not persistent recall');
  const two=await core.ingestExternalProjectResearch(mkResearch('beta.publisher-b.example','publisher-b.example','c'.repeat(64),Date.now()-2000));
  assert.equal(two.promoted,true,'independent source and content diversity should release hypothesis-only recall');
  researchMemories=core.memorySubsystem.memoryOS.snapshot({clone:false}).items.filter(m=>m.source==='external-project-research'&&m.context?.researchProjectId===projectId&&m.context?.researchQueryHash===researchQueryHash);
  assert.equal(researchMemories.length,2,'both collected excerpts must be integrated into canonical memory');
  assert(researchMemories.every(m=>m.epistemicStatus==='hypothesis'),'source diversity is not claim verification');
  assert(researchMemories.every(m=>m.confidence<=.54),'unverified external snippets must have capped confidence');
  assert(researchMemories.every(m=>m.context?.researchSourceUrl&&m.context?.researchContentHash),'memory must retain source and content provenance');
  const conflict=await core.ingestExternalProjectResearch(mkResearch('alpha.publisher-a.example','publisher-a.example','d'.repeat(64),Date.now()+1000,'A conflicting report gives a materially different outcome under similar research conditions.'));
  assert.equal(conflict.firewall.claims.find(c=>c.claimKey===conflict.session.claimKey)?.status,'contested');
  researchMemories=core.memorySubsystem.memoryOS.snapshot({clone:false}).items.filter(m=>m.source==='external-project-research'&&m.context?.researchProjectId===projectId&&m.context?.researchQueryHash===researchQueryHash);
  assert(researchMemories.every(m=>m.epistemicStatus==='quarantined'),'conflicted promoted notes must be removed from normal recall');

  await core.executeNextProjectStep('wp17-first-step');
  const before=core.autonomousProjectExecutorSnapshot();
  assert.equal(before.steps.find(s=>s.id==='repeat')?.completed,false);
  if(before.steps.some(s=>s.id==='repeat'&&!s.completed)) {
    const attemptsBefore=before.steps.find(s=>s.id==='repeat')?.failureAttempts??0;
    const failuresBefore=before.failedAttempts;
    const blocked=await core.executeNextProjectStep('wp17-missing-research-config');
    assert.equal(blocked.ok,false);
    assert.equal(blocked.result?.error,'project-network-disabled');
    const after=core.autonomousProjectExecutorSnapshot();
    assert.equal(after.failedAttempts,failuresBefore,'preflight must not record a failed tool execution');
    assert.equal(after.steps.find(s=>s.id==='repeat')?.failureAttempts??0,attemptsBefore,'preflight must not spend retry attempts');
  }
  await core.flush();
  const recovered=new OrganismCore(new FileStateStore(join(tmpRoot,'state.json')),{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'});
  await recovered.init();
  const recoveredSession=recovered.projectResearchSessionSnapshot();
  assert(recoveredSession.results.some(r=>r.queryHash===researchQueryHash&&r.snippet.length>=40),'research excerpts and hashes must survive restart/migration');
  assert(recoveredSession.firewallStatus==='contested','research conflict state must survive restart');
  const recoveredNotes=recovered.memorySubsystem.memoryOS.snapshot({clone:false}).items.filter(m=>m.source==='external-project-research'&&m.context?.researchProjectId===projectId&&m.context?.researchQueryHash===researchQueryHash);
  assert(recoveredNotes.length>=2&&recoveredNotes.every(m=>m.epistemicStatus==='quarantined'),'conflicted research must remain quarantined after restart');
  await recovered.flush();

  // A configured NLI outage must not silently downgrade to lexical evidence or
  // produce a positive learning signal after the source-diversity firewall promotes.
  researchQueryHash='8'.repeat(64);
  const outageClaim='System is ready for deployment';
  await core.ingestExternalProjectResearch(mkResearch('alpha-outage-a.example','nli-outage-a','7'.repeat(64),Date.now()+1000,'NLI_OUTAGE_A: System is ready for deployment. The first report describes a unique migration path and separate environment configuration.',outageClaim));
  const outageResult=await core.ingestExternalProjectResearch(mkResearch('beta-outage-b.example','nli-outage-b','8'.repeat(64),Date.now()+2000,'NLI_OUTAGE_B: System is ready for deployment. The second paper covers another experiment, distinct hardware, and different recovery controls.',outageClaim));
  assert.equal(outageResult.promoted,true,'source diversity can be collected, but not confused with NLI support');
  assert.equal(outageResult.claimVerification.verdict,'unknown','complete NLI outage must remain unknown');
  assert.equal(outageResult.claimVerification.scope,'model-assisted-entailment','configured service failure must not downgrade to lexical mode');
  assert.equal(outageResult.positiveEvidenceApplied,false,'no Core credit is allowed when configured NLI is unavailable');
  assert.equal(core.evidenceResearchSubsystem.skillAcquisitionBenchmark.snapshot().recent[0]?.outcome01,0,'NLI outage cannot create a positive skill-learning signal');

} finally {
  await rm(tmpRoot,{recursive:true,force:true});
  await new Promise(resolve=>nliServer.close(resolve));
  for (const [k,v] of Object.entries(savedEnv)) { if(v===undefined) delete process.env[k]; else process.env[k]=v; }
}

console.log('BIG_PASS_179_PROJECT_RESEARCH_GATES=PASS');
