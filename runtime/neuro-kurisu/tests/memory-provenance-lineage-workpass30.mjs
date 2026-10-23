import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const at = 2_000_000_000_000;
const makeInput = (source, independenceKey, extra = {}) => ({
  content: 'Release candidate R30 stays in implementation status until temporal memory evidence is independently verified.',
  kind: 'semantic', source, provenanceClass: 'external', sourceAuthority01: .9,
  independenceKey, evidenceFreshnessAt: at, observedAt: at,
  tags: ['release', 'memory'], context: { branch: 'workpass30' },
  salience: .7, emotionalWeight: .1, identityRelevance: .2, goalRelevance: .3,
  socialRelevance: .1, predictionError: .1, temperature01: 0, confidence: .45,
  epistemicStatus: 'hypothesis', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
  ...extra,
});

const memory = new MemoryOS2();
const initial = memory.encode(makeInput('publisher-a.example', 'story-lineage-A'), { clone: false });
const baselineConfidence = initial.confidence;
assert.equal(initial.evidenceSources?.length, 1, 'new memory should keep its first evidence lineage');

// A repeated import or another mirror for the same upstream story is not new
// independent evidence and cannot ratchet the canonical confidence upward.
const replay = memory.encode(makeInput('publisher-a.example', 'story-lineage-A', { confidence: .99, sourceAuthority01: 1 }), { clone: false });
assert.equal(replay.id, initial.id);
assert.equal(replay.evidenceSources?.length, 1);
assert.equal(replay.confidence, baselineConfidence, 'replaying one evidence lineage must not inflate confidence');
const mirror = memory.encode(makeInput('mirror.example', 'story-lineage-A', { confidence: .99 }), { clone: false });
assert.equal(mirror.id, initial.id, 'identical content remains one canonical memory');
assert.equal(mirror.evidenceSources?.length, 1, 'publisher mirrors with the same independenceKey remain one lineage');
assert.equal(mirror.confidence, baselineConfidence, 'mirror replay is not corroboration');

// A genuinely independent source is retained in the same canonical record and
// may contribute one bounded confidence update.
const independent = memory.encode(makeInput('publisher-b.example', 'story-lineage-B', { confidence: .9 }), { clone: false });
assert.equal(independent.id, initial.id);
assert.equal(independent.evidenceSources?.length, 2);
assert.ok(independent.confidence > baselineConfidence && independent.confidence < .9);
assert.equal(memory.evidenceTrail(initial.id)?.independentSources, 2);
assert.equal(memory.evidenceTrail(initial.id)?.corroborationBonus01, .025);

// Repeated ingestion of either existing lineage must not add further confidence.
const afterIndependentConfidence = independent.confidence;
for (let i = 0; i < 5; i++) memory.encode(makeInput(i % 2 ? 'mirror.example' : 'publisher-b.example', i % 2 ? 'story-lineage-A' : 'story-lineage-B', { confidence: 1 }), { clone: false });
assert.equal(memory.evidenceTrail(initial.id)?.independentSources, 2);
assert.equal(memory.snapshot().items.find(item => item.id === initial.id)?.confidence, afterIndependentConfidence);

// Evidence metadata is part of the serialized canonical memory and byte budget.
const snap = memory.snapshot();
assert.ok(snap.estimatedBytes > 0);
assert.equal(snap.version, 7, 'memory schema advances for the bounded evidence trail');
const restored = new MemoryOS2();
restored.restore(structuredClone(snap));
const restoredTrail = restored.evidenceTrail(initial.id);
assert.equal(restoredTrail?.independentSources, 2);
assert.equal(restored.snapshot().estimatedBytes, snap.estimatedBytes, 'restore must recompute the same provenance-aware byte estimate');
assert.deepEqual(new Set(restoredTrail?.sources.map(row => row.independenceKey)), new Set(['story-lineage-A', 'story-lineage-B']));
assert.equal(restored.statsLight().memoriesWithIndependentEvidence, 1);
assert.equal(restored.inspectRecent(1)[0]?.independentEvidenceSources, 2);
assert.equal(restored.indexDiagnostics().pass, true);

// WorkPass331: corrupt persisted/resource values or plugin overrides cannot disable the memory byte budget.
const poisonedSnapshot = structuredClone(snap);
poisonedSnapshot.byteBudget = Number.POSITIVE_INFINITY;
poisonedSnapshot.estimatedBytes = Number.POSITIVE_INFINITY;
poisonedSnapshot.implicitConflictCandidates = Number.POSITIVE_INFINITY;
poisonedSnapshot.implicitConflictsResolved = Number.NaN;
poisonedSnapshot.staleRetrievalsAvoided = Number.POSITIVE_INFINITY;
poisonedSnapshot.lastConflictScanAt = Number.POSITIVE_INFINITY;
poisonedSnapshot.budgetEvictions = Number.NEGATIVE_INFINITY;
const budgetHardened = new MemoryOS2();
budgetHardened.restore(poisonedSnapshot);
assert.equal(budgetHardened.budgetDiagnostics().byteBudget, 524288,
  'an invalid persisted byte budget must fall back to the bounded default');
assert.ok(Number.isFinite(budgetHardened.budgetDiagnostics().estimatedBytes));
assert.equal(budgetHardened.snapshot().implicitConflictCandidates, 0);
assert.equal(budgetHardened.snapshot().implicitConflictsResolved, 0);
assert.equal(budgetHardened.snapshot().staleRetrievalsAvoided, 0);
assert.equal(budgetHardened.snapshot().lastConflictScanAt, 0,
  'an infinite conflict-scan timestamp must not suppress maintenance indefinitely');
assert.equal(budgetHardened.snapshot().budgetEvictions, 0);
budgetHardened.enforceByteBudget({ maxBytes: 16384 });
const invalidOverride = budgetHardened.enforceByteBudget({ maxBytes: Number.POSITIVE_INFINITY });
assert.equal(invalidOverride.budget, 16384,
  'a non-finite public budget override must retain the already enforced finite budget');

// The same mechanism is strictly bounded when many genuinely distinct source
// lineages attest to one memory. It never introduces a second memory owner.
const capped = new MemoryOS2();
const row = capped.encode(makeInput('source-0.example', 'independent-0'), { clone: false });
for (let i = 1; i < 14; i++) capped.encode(makeInput(`source-${i}.example`, `independent-${i}`, { evidenceFreshnessAt: at + i, observedAt: at + i, sourceAuthority01: i / 14, confidence: .5 + i / 30 }), { clone: false });
assert.equal(capped.size(), 1, 'independent evidence merges inside a single canonical record');
assert.equal(capped.evidenceTrail(row.id)?.independentSources, 8, 'evidence trail stays bounded at eight lineages');
assert.equal(new Set(capped.evidenceTrail(row.id)?.sources.map(item => item.independenceKey)).size, 8);
const afterCapConfidence = capped.snapshot().items.find(item => item.id === row.id).confidence;
capped.encode(makeInput('source-0.example', 'independent-0', { sourceAuthority01: 1, confidence: 1, observedAt: at + 20000, evidenceFreshnessAt: at + 20000 }), { clone: false });
assert.equal(capped.snapshot().items.find(item => item.id === row.id).confidence, afterCapConfidence, 'a source trimmed from the visible trail must not be treated as new after replay');
assert.ok(capped.snapshot().items.find(item => item.id === row.id).evidenceLineageKeys.length <= 32, 'compact replay guard must also stay bounded');

// Exercise the actual external-research -> MemoryOS2 bridge. Two publisher URLs
// in one EvidenceFirewall lineage must produce one memory and one source vote;
// a second independent lineage may produce another hypothesis-only memory.
const core = new OrganismCore(new MemoryStateStore(), { performanceProfile: 'mobile', cycleResultMode: 'operational' });
await core.init();
const qHash = 'a'.repeat(64);
const researchAt = Date.now() - 400;
const rowA = { ok: true, queryHash: qHash, contentHash: '1'.repeat(64), sourceKey: 'publisher-a', sourceLineageKey: 'story-family-A', url: 'https://publisher-a.example/a', sourceHost: 'publisher-a.example', title: 'A source', snippet: 'An excerpt long enough to pass the external research memory filter and preserve source provenance.', fetchedAt: researchAt + 100, relevance01: .8, trust01: .8, contentType: 'text/html', lineageRelation: 'original' };
const mirrorA = { ...rowA, sourceKey: 'publisher-a-mirror', url: 'https://mirror-a.example/a', sourceHost: 'mirror-a.example', fetchedAt: researchAt + 200, lineageRelation: 'syndicated-copy' };
const rowB = { ...rowA, contentHash: '2'.repeat(64), sourceKey: 'publisher-b', sourceLineageKey: 'story-family-B', url: 'https://publisher-b.example/b', sourceHost: 'publisher-b.example', title: 'B source', fetchedAt: researchAt + 300, lineageRelation: 'independent' };
const integrated = core.integrateExternalResearchMemory({ queryHash: qHash, contentHash: rowB.contentHash, independenceKey: rowB.sourceKey }, 'workpass30-source-bridge', {
  claimText: '', claimVerification: { verdict: 'unknown' }, firewallStatus: 'promoted', promoted: true,
  independentSources: 2, uniqueContentHashes: 3, results: [rowA, mirrorA, rowB],
});
assert.ok(integrated.memoryId, 'current independent research row should resolve to a canonical memory ID');
const researchRows = core.memorySubsystem.memoryOS.snapshot().items.filter(item => item.context?.researchProjectId === 'workpass30-source-bridge');
assert.equal(researchRows.length, 2, 'the syndicated pair must not create a third canonical memory');
const familyA = researchRows.find(item => item.context?.researchLineageKey === 'story-family-A');
assert.ok(familyA);
assert.equal(core.memorySubsystem.memoryOS.evidenceTrail(familyA.id)?.independentSources, 1, 'same-lineage publisher mirror stays one vote in canonical memory');
assert.match(String(familyA.context?.researchMirrorUrls ?? ''), /publisher-a\.example/);
assert.match(String(familyA.context?.researchMirrorUrls ?? ''), /mirror-a\.example/);
const inspectorRow = core.memoryInspectorSnapshot(32).find(item => item.id === familyA.id);
assert.equal(inspectorRow?.independentEvidenceSources, 1, 'the existing Runtime Atlas memory inspector exposes evidence-lineage count');
assert.equal(core.memorySubsystem.memoryOS.indexDiagnostics().pass, true);

 // WorkPass418: valid-but-excessive budgets must not disable eviction.
 const oversizedPersistedBudget = structuredClone(snap);
 oversizedPersistedBudget.byteBudget = 16 * 1024 * 1024;
 const boundedPersistedBudget = new MemoryOS2();
 boundedPersistedBudget.restore(oversizedPersistedBudget);
 assert.equal(boundedPersistedBudget.budgetDiagnostics().byteBudget, 524288,
   'an over-cap persisted byte budget must fall back to the finite default');
 const oversizedOverrideResult = boundedPersistedBudget.enforceByteBudget({ maxBytes: Number.MAX_SAFE_INTEGER });
 assert.equal(oversizedOverrideResult.budget, 524288,
   'an over-cap runtime override must preserve the current finite budget');

 let memoryGetterReads = 0;
 const accessorSnapshot = structuredClone(snap);
 Object.defineProperty(accessorSnapshot, 'byteBudget', {
   configurable: true, enumerable: true,
   get() { memoryGetterReads += 1; return Number.MAX_SAFE_INTEGER; },
 });
 const accessorRestoredMemory = new MemoryOS2();
 accessorRestoredMemory.restore(accessorSnapshot);
 assert.equal(memoryGetterReads, 0, 'restore must not execute a caller-owned getter');
 assert.equal(accessorRestoredMemory.budgetDiagnostics().byteBudget, 524288);

// Hexis-inspired residual evidence revision is owned by the same canonical memory row.
const beliefMemory = new MemoryOS2();
const belief = beliefMemory.encode(makeInput('belief-seed', 'belief-seed-lineage', {
  content:'A semantic belief uses independent evidence to revise confidence without rewriting memory history.',
  confidence:.45, sourceAuthority01:.9, context:{domain:'belief-revision-lab'},
}), { clone:false });
const beliefBefore = belief.confidence;
const support = beliefMemory.reviseConfidenceFromEvidence(belief.id, {
  source:'reviewed-paper-a', provenanceClass:'external', sourceAuthority01:.8,
  independenceKey:'paper-lineage-a', observedAt:at, evidenceFreshnessAt:at,
}, 'supports', at);
assert.equal(support.applied,true);
assert.equal(support.reason,'applied');
assert.ok(Math.abs(support.posteriorConfidence-(beliefBefore+(1-beliefBefore)*.35*.8))<1e-9,
  'support should close a fixed fraction of remaining doubt');
const afterSupport = support.posteriorConfidence;

// A caller cannot amplify evidence beyond the default trust ceiling for its
// declared provenance class (a high sourceAuthority field is only an upper request).
const cappedTrustMemory=new MemoryOS2();
const cappedTrustBelief=cappedTrustMemory.encode(makeInput('authority-cap-seed','authority-cap-seed',{
  content:'Declared evidence trust is capped by the canonical provenance policy.',
  provenanceClass:'external',sourceAuthority01:1,confidence:.5,
}),{clone:false});
const cappedTrustResult=cappedTrustMemory.reviseConfidenceFromEvidence(cappedTrustBelief.id,{
  source:'external-paper-c',provenanceClass:'external',sourceAuthority01:1,
  independenceKey:'external-paper-c-lineage',observedAt:at,evidenceFreshnessAt:at,
},'supports',at);
assert.equal(cappedTrustResult.authority01,.9,'external evidence may not self-promote above the configured class default');
assert.ok(Math.abs(cappedTrustResult.posteriorConfidence-(cappedTrustBelief.confidence+(1-cappedTrustBelief.confidence)*.35*.9))<1e-9);
const duplicateSupport=beliefMemory.reviseConfidenceFromEvidence(belief.id,{
  source:'mirror-of-paper-a',provenanceClass:'external',sourceAuthority01:1,
  independenceKey:'paper-lineage-a',observedAt:at+1,evidenceFreshnessAt:at+1,
},'supports',at+1);
assert.equal(duplicateSupport.applied,false);
assert.equal(duplicateSupport.reason,'duplicate_source');
assert.equal(beliefMemory.get(belief.id).confidence,afterSupport,
  'replaying the same lineage cannot add another support vote');
const contradiction=beliefMemory.reviseConfidenceFromEvidence(belief.id,{
  source:'reviewed-paper-b',provenanceClass:'external',sourceAuthority01:.8,
  independenceKey:'paper-lineage-b',observedAt:at+2,evidenceFreshnessAt:at+2,
},'contradicts',at+2);
assert.equal(contradiction.applied,true);
assert.ok(Math.abs(contradiction.posteriorConfidence-afterSupport*(1-.35*.8))<1e-9,
  'contradicting evidence should erode current confidence symmetrically');
assert.equal(beliefMemory.reviseConfidenceFromEvidence(belief.id,{
  source:'paper-a-flipped-stance',provenanceClass:'external',sourceAuthority01:1,
  independenceKey:'paper-lineage-a',observedAt:at+3,evidenceFreshnessAt:at+3,
},'contradicts',at+3).reason,'duplicate_source',
'one lineage cannot vote twice by changing stance');
const protectedBelief=beliefMemory.encode(makeInput('protected-seed','protected-origin-lineage',{
  content:'A protected origin statement remains revisable only by an explicit identity policy.',
  context:{protected:'true'},confidence:.7,
}),{clone:false});
const protectedPrior=protectedBelief.confidence;
const protectedResult=beliefMemory.reviseConfidenceFromEvidence(protectedBelief.id,{
  source:'independent-contradiction',provenanceClass:'external',sourceAuthority01:1,
  independenceKey:'protected-contradiction',observedAt:at,evidenceFreshnessAt:at,
},'contradicts',at);
assert.equal(protectedResult.applied,false);
assert.equal(protectedResult.reason,'protected');
assert.equal(beliefMemory.get(protectedBelief.id).confidence,protectedPrior);
assert.ok(beliefMemory.evidenceTrail(protectedBelief.id).sources.some(row=>row.stance==='contradicts'),
  'protected contradictory evidence remains visible without silently rewriting confidence');
let evidenceGetterReads=0;
const hostileEvidence={};
Object.defineProperty(hostileEvidence,'source',{enumerable:true,configurable:true,get(){evidenceGetterReads++;return 'unsafe-source';}});
const beliefBeforeHostile=beliefMemory.snapshot();
assert.throws(()=>beliefMemory.reviseConfidenceFromEvidence(belief.id,hostileEvidence,'supports',at+4),/memory-belief-evidence-invalid/);
assert.equal(evidenceGetterReads,0);
assert.deepEqual(beliefMemory.snapshot(),beliefBeforeHostile,
  'rejected evidence must not mutate canonical memory or confidence audit');
const persistedBelief=beliefMemory.snapshot();
const restoredBeliefs=new MemoryOS2();
restoredBeliefs.restore(structuredClone(persistedBelief));
assert.deepEqual(restoredBeliefs.evidenceTrail(belief.id).lastConfidenceRevision,
  beliefMemory.evidenceTrail(belief.id).lastConfidenceRevision,
  'confidence-revision audit must survive persistence restore');
assert.ok(restoredBeliefs.budgetDiagnostics().estimatedBytes===persistedBelief.estimatedBytes,
  'audit rows must be part of the canonical byte budget');
console.log('MEMORY_PROVENANCE_LINEAGE_WORKPASS30=PASS', JSON.stringify({ canonicalMemoryCount: restored.size(), independentSources: restoredTrail?.independentSources, confidenceAfterIndependentSupport: afterIndependentConfidence, boundedTrail: capped.evidenceTrail(row.id)?.independentSources, replayGuardKeys: capped.snapshot().items.find(item => item.id === row.id).evidenceLineageKeys.length, researchRows: researchRows.length, mirroredLineageVotes: core.memorySubsystem.memoryOS.evidenceTrail(familyA.id)?.independentSources, memorySchema: persistedBelief.version, confidenceRevisions: restoredBeliefs.evidenceTrail(belief.id).confidenceRevisionCount }));
