import assert from 'node:assert/strict';
import { EvidenceFirewallEngine } from '../src/organism/system/EvidenceFirewall.ts';
import { ProjectResearchSession } from '../src/organism/system/ProjectResearchSession.ts';

const fw=new EvidenceFirewallEngine();
const session=new ProjectResearchSession(fw);
session.begin('project-x');
const base=(host,hash,at)=>({ok:true,verified:true,externalEvidence:true,url:`https://${host}/a`,finalUrl:`https://${host}/a`,status:200,contentType:'text/html',title:'t',contentHash:hash,bytes:100,snippet:'s',fetchedAt:at,trust01:.88,independenceKey:host});
const now=Date.now();
let state=session.ingest(base('a.example','h1',now));
assert.equal(state.promoted,false);
assert.equal(state.independentSources,1);
state=session.ingest(base('a.example','h1',now+10));
assert.equal(state.promoted,false,'same-source duplicate must not promote');
state=session.ingest(base('b.example','h2',now+20));
assert.equal(state.promoted,true,'two independent sources should promote');
assert.ok(state.independentSources>=2);
const snap=fw.snapshot();
assert.equal(snap.promotedCount,1);
assert.equal(fw.canPromote('project:project-x:research'),true);
fw.observe({claimKey:'project:project-x:research',sourceClass:'external-api',sourceKey:'a.example',contentHash:'contradiction',confidence01:.1,trust01:.1,contradiction01:.95,at:now+30});
assert.equal(fw.canPromote('project:project-x:research'),false);
assert.equal(fw.claim('project:project-x:research').status,'contested');

// Retrieval success alone is not sufficient: relevance to the bound query
// attenuates claim confidence before it reaches the canonical firewall.
const weakFw=new EvidenceFirewallEngine();
const weakSession=new ProjectResearchSession(weakFw); weakSession.begin('weak','project:weak:research:q-weak');
const relevant=(host,hash,at,relevance01,queryHash)=>({...base(host,hash,at),relevance01,queryHash});
weakSession.ingest(relevant('weak-a.example','wa',now+100,.55,'q-weak'));
const weakState=weakSession.ingest(relevant('weak-b.example','wb',now+200,.55,'q-weak'));
assert.equal(weakState.promoted,false,'low topical relevance must not promote a claim');
const strongFw=new EvidenceFirewallEngine();
const strongSession=new ProjectResearchSession(strongFw); strongSession.begin('strong','project:strong:research:q-strong');
strongSession.ingest(relevant('strong-a.example','sa',now+100,.95,'q-strong'));
const strongState=strongSession.ingest(relevant('strong-b.example','sb',now+200,.95,'q-strong'));
assert.equal(strongState.promoted,true,'highly relevant, independent sources can promote a claim');
strongSession.begin('strong','project:strong:research:different-query');
assert.equal(strongSession.snapshot().promoted,false,'changing query hash starts a separate claim session');
assert.equal(strongSession.snapshot().results.length,0);

console.log('BIG_PASS_48_FIREWALL=PASS',JSON.stringify({independentSources:state.independentSources,promotionScore01:state.promotionScore01,promoted:state.promoted}));
