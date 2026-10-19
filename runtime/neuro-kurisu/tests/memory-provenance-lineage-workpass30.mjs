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

console.log('MEMORY_PROVENANCE_LINEAGE_WORKPASS30=PASS', JSON.stringify({ canonicalMemoryCount: restored.size(), independentSources: restoredTrail?.independentSources, confidenceAfterIndependentSupport: afterIndependentConfidence, boundedTrail: capped.evidenceTrail(row.id)?.independentSources, replayGuardKeys: capped.snapshot().items.find(item => item.id === row.id).evidenceLineageKeys.length, researchRows: researchRows.length, mirroredLineageVotes: core.memorySubsystem.memoryOS.evidenceTrail(familyA.id)?.independentSources, memorySchema: snap.version }));
