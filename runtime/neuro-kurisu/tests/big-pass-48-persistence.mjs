import assert from 'node:assert/strict';
import { EvidenceFirewallEngine } from '../src/organism/system/EvidenceFirewall.ts';
import { ProjectResearchSession } from '../src/organism/system/ProjectResearchSession.ts';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const fw=new EvidenceFirewallEngine();
const session=new ProjectResearchSession(fw); session.begin('persisted');
const now=Date.now();
const result=(host,hash,at)=>({ok:true,verified:true,externalEvidence:true,url:`https://${host}/x`,finalUrl:`https://${host}/x`,status:200,contentType:'text/html',title:'',contentHash:hash,bytes:10,snippet:'',fetchedAt:at,trust01:.9,independenceKey:host});
session.ingest(result('alpha.example','a1',now));
session.ingest(result('beta.example','b1',now+1));
assert.equal(session.snapshot().promoted,true);
const persisted=migratePersistedOrganism({schemaVersion:90,system:{evidenceFirewall:fw.snapshot(),projectResearchSession:session.snapshot()}});
assert.equal(persisted.system.evidenceFirewall.promotedCount,1);
assert.equal(persisted.system.projectResearchSession.promoted,true);
assert.equal(persisted.system.schemaVersion,ORGANISM_STATE_SCHEMA);
// A contradictory same-source update must remain observable rather than overwrite the earlier content.
const fw2=new EvidenceFirewallEngine();
fw2.restore(fw.snapshot());
fw2.observe({claimKey:'project:persisted:research',sourceClass:'external-api',sourceKey:'alpha.example',contentHash:'DIFFERENT',confidence01:.2,trust01:.2,contradiction01:.95,at:now+2});
const claim=fw2.claim('project:persisted:research');
assert.ok(claim.contradictions>=1);
session.begin('other-project');
assert.equal(session.snapshot().results.length,0,'research from previous project must not leak');
assert.equal(session.snapshot().independentSources,0);
console.log('BIG_PASS_48_PERSISTENCE=PASS',JSON.stringify({schema:persisted.system.schemaVersion,promoted:claim.status==='promoted',contradictions:claim.contradictions}));
