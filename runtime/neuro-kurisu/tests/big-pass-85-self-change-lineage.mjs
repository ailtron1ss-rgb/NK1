import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';
import { P84AutobiographicalContinuityFabric } from '../src/organism/developmental/P84AutobiographicalContinuityFabric.ts';
import { ValueEvolutionEngine } from '../src/organism/cognition/evolution/ValueEvolutionEngine.ts';

const core = new OrganismCore(new MemoryStateStore(), { cycleResultMode:'operational', enableLanguage:false, checkpointMinIntervalMs:0 });
await core.init();
const before = core.snapshot();
const valueEngine = new ValueEvolutionEngine();
let revision = null;
const values = structuredClone(before.facets.memory.adaptiveValues);
for (let i=0;i<3 && !revision;i++) {
  revision = valueEngine.observeExperience({values,success:.92,surprise:.81,projectOrigin:'identity',evidenceCount:5,independentSourceCount:2,value:'responsibility',direction:1});
}
assert.ok(revision,'value evolution should emit a revision after corroborated surprising evidence');
const applied = core.applyVerifiedValueRevision(revision);
const after = core.snapshot();
assert.equal(applied.revision.id, revision.id);
assert.equal(after.facets.memory.adaptiveValues.responsibility, revision.after);
assert.equal(after.facets.learning.selfAuthorship.revisions.length, before.facets.learning.selfAuthorship.revisions.length + 1);
const authored = after.facets.learning.selfAuthorship.revisions[0];
assert.equal(authored.kind,'value');
assert.equal(authored.target,'responsibility');
assert.deepEqual(authored.evidence, [revision.id,'success:0.920','surprise:0.810']);
const graph=core.identityCausalitySnapshot();
assert.ok(graph.nodes.some(n=>n.kind==='self-change' && n.label.includes(revision.id)),'self-change node must be in identity graph');
assert.ok(graph.edges.some(e=>e.source==='value-evolution' && e.relation==='revised-by' && e.reason.includes('verified-value-revision')));
assert.ok(graph.edges.some(e=>e.source==='self-authorship' && e.relation==='changed-by' && e.reason.includes('authored-developmental-self-change')));
assert.ok(after.facets.memory.eventLog.some(e=>e.type==='value-update' && e.payload?.revisionId===revision.id),'value revision must be event-sourced');
assert.ok(after.facets.evolution.identityTrajectory.chapters.some(x=>x.includes('responsibility')),'self-change must enter developmental narrative');

// Migration regression: P84 class contract is version 5; migration must preserve it.
const p84=new P84AutobiographicalContinuityFabric(32);
const p84Migrated=migratePersistedOrganism({schemaVersion:110,state:{version:110},facets:{advanced:{p84AutobiographicalContinuity:p84.snapshot()}}});
assert.equal(p84Migrated.facets.advanced.p84AutobiographicalContinuity.version,5);

console.log(`BIG_PASS_85_SELF_CHANGE=PASS generatedRevisions=${valueEngine.snapshot().revisions.length} authoredRevisions=${after.facets.learning.selfAuthorship.revisions.length} selfChangeNodes=${graph.nodes.filter(n=>n.kind==='self-change').length}`);
