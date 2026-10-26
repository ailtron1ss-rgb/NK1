import assert from 'node:assert/strict';
import { MemoryFabric, MemoryLifecycleCommandConflictError } from '../../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../../src/organism/memory/SemanticMemoryGraph.ts';
import { readFile } from 'node:fs/promises';
import { MemoryOS2 } from '../../src/organism/developmental/MemoryOS2.ts';
import { HexisAdaptationFabric } from '../../src/organism/integration/hexis/HexisAdaptationFabric.ts';

const memoryOS = new MemoryOS2({ signalFusionProfile: 'balanced' });
const memory = memoryOS.encode({
  content: 'A stable fact used to verify evidence provenance.',
  kind: 'semantic',
  source: 'hexis-evidence-lineage-regression',
  tags: ['hexis', 'provenance'],
  context: { regression: 'hexis-memory-evidence-lineage' },
  salience: .6,
  emotionalWeight: .1,
  identityRelevance: .2,
  goalRelevance: .4,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .5,
  epistemicStatus: 'belief',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
}, { clone: false });

const fabric = new HexisAdaptationFabric();
const sourceRef = 'https://evidence.example/specimen-1';
const evidence = { ref: sourceRef, trust01: .9, label: 'independent observation' };
const sourceAuthority01 = Number(memory.sourceAuthority01 ?? .5);

assert.equal(memoryOS.hasEvidenceLineage(memory.id, sourceRef), false);
fabric.registerOrUpdateBelief({ memoryId: memory.id, confidence01: memory.confidence, trust01: sourceAuthority01, at: memory.lastAccessAt });

const priorConfidence = memory.confidence;
const canonicalDuplicate = memoryOS.hasEvidenceLineage(memory.id, sourceRef);
const recorded = canonicalDuplicate ? null : memoryOS.recordEvidence(memory.id, {
  source: sourceRef,
  provenanceClass: 'external',
  sourceAuthority01: .9,
  independenceKey: sourceRef,
  observedAt: 1000,
  evidenceFreshnessAt: 1000,
});
const firstAudit = fabric.reviseBelief({
  memoryId: memory.id,
  confidence01: priorConfidence,
  trust01: sourceAuthority01,
  evidence,
  stance: 'supports',
  canonicalDuplicate,
  at: 2000,
});
assert.equal(recorded?.added, true);
assert.equal(firstAudit.applied, true);
assert.ok(firstAudit.posteriorConfidence01 > priorConfidence);
memoryOS.updateSignals(memory.id, { confidence: firstAudit.posteriorConfidence01 }, 'hexis-belief-revision');

const duplicateReceipt = memoryOS.recordEvidence(memory.id, {
  source: sourceRef,
  provenanceClass: 'external',
  sourceAuthority01: .9,
  independenceKey: sourceRef,
  observedAt: 3000,
  evidenceFreshnessAt: 3000,
});
assert.equal(duplicateReceipt.ok, true);
assert.equal(duplicateReceipt.added, false);
assert.equal(duplicateReceipt.reason, 'duplicate-source');

const canonicalAlreadyKnows = memoryOS.hasEvidenceLineage(memory.id, sourceRef);
fabric.registerOrUpdateBelief({ memoryId: memory.id, confidence01: memoryOS.get(memory.id).confidence, trust01: sourceAuthority01, at: 9999 });
const beforeReplay = fabric.snapshot().beliefs.find(row => row.memoryId === memory.id);
const canonicalDuplicateAudit = fabric.reviseBelief({
  memoryId: memory.id,
  confidence01: memoryOS.get(memory.id).confidence,
  trust01: sourceAuthority01,
  evidence,
  stance: 'supports',
  canonicalDuplicate: canonicalAlreadyKnows,
  at: 12000,
});
assert.equal(canonicalDuplicateAudit.applied, false);
assert.equal(canonicalDuplicateAudit.reason, 'duplicate_source_canonical');
const afterDuplicate = fabric.snapshot().beliefs.find(row => row.memoryId === memory.id);
assert.equal(afterDuplicate.confidence01, beforeReplay.confidence01, 'replayed evidence must not change adapter confidence');
assert.equal(afterDuplicate.trust01, beforeReplay.trust01, 'replayed evidence must not change trust');
assert.equal(afterDuplicate.updatedAt, beforeReplay.updatedAt, 'a rejected replay must not mutate belief time');
assert.equal(afterDuplicate.sourceKeys.length, 1, 'only successfully applied evidence contributes a belief vote');
assert.equal(memoryOS.evidenceTrail(memory.id).independentSources, 2, 'primary and independent source are retained');

const restored = new MemoryOS2({ signalFusionProfile: 'balanced' });
restored.restore(memoryOS.snapshot());
assert.equal(restored.hasEvidenceLineage(memory.id, sourceRef), true, 'lineage replay guard survives snapshot/restore');
assert.equal(restored.recordEvidence(memory.id, {
  source: sourceRef,
  provenanceClass: 'external',
  sourceAuthority01: .99,
  independenceKey: sourceRef,
}).added, false, 'restored memory must not count the same source twice');
assert.equal(restored.indexDiagnostics().pass, true, 'evidence integration must preserve memory indexes');

// A long-lived canonical memory must still reject evidence replay after the 32-key exact ring rolls over.
const longTrailOS = new MemoryOS2();
const lineageEpoch = Date.now() + 1_000;
const longLineageInput = (index, overrides = {}) => ({
  content: 'One canonical fact with many independent lineage identifiers for replay-guard rollover testing.',
  kind: 'semantic',
  source: `hexis-rollover-publisher-${index}`,
  provenanceClass: 'external',
  sourceAuthority01: overrides.sourceAuthority01 ?? .9,
  independenceKey: `hexis-rollover-${index}`,
  observedAt: lineageEpoch + index,
  evidenceFreshnessAt: lineageEpoch + index,
  tags: ['hexis', 'lineage-rollover'],
  context: { regression: 'hexis-evidence-lineage-rollover' },
  salience: .6,
  emotionalWeight: .1,
  identityRelevance: .2,
  goalRelevance: .4,
  socialRelevance: .1,
  predictionError: .1,
  confidence: overrides.confidence ?? .58,
  epistemicStatus: 'belief',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
});
const longTrailMemory = longTrailOS.encode(longLineageInput(0, { confidence: .45 }), { clone: false });
assert.equal(longTrailMemory.evidenceLineageFilter, undefined, 'ordinary memories do not pay the Bloom-filter storage cost before lineage rollover');
for (let index = 1; index <= 140; index++) longTrailOS.encode(longLineageInput(index), { clone: false });
const longTrailBeforeReplay = longTrailOS.snapshot().items.find(row => row.id === longTrailMemory.id);
assert.equal(longTrailBeforeReplay.evidenceLineageKeys.length, 32, 'exact lineage ring remains bounded');
assert.ok(longTrailBeforeReplay.evidenceLineageFilter.segments.length >= 2, 'lineage filter grows by fixed-size segments rather than dropping old identities');
assert.equal(longTrailOS.hasEvidenceLineage(longTrailMemory.id, 'hexis-rollover-0'), true, 'old lineages remain recognized after exact-ring rollover');
const longTrailConfidence = longTrailBeforeReplay.confidence;
longTrailOS.encode(longLineageInput(0, { confidence: .99, sourceAuthority01: 1 }), { clone: false });
assert.equal(longTrailOS.snapshot().items.find(row => row.id === longTrailMemory.id).confidence, longTrailConfidence, 'replaying the oldest source cannot change confidence after 140 newer sources');
const longTrailRestored = new MemoryOS2();
longTrailRestored.restore(structuredClone(longTrailOS.snapshot()));
assert.equal(longTrailRestored.hasEvidenceLineage(longTrailMemory.id, 'hexis-rollover-0'), true, 'Bloom replay guard survives snapshot/restore');
const restoredLongTrailConfidence = longTrailRestored.snapshot().items.find(row => row.id === longTrailMemory.id).confidence;
longTrailRestored.encode(longLineageInput(0, { confidence: .99, sourceAuthority01: 1 }), { clone: false });
assert.equal(longTrailRestored.snapshot().items.find(row => row.id === longTrailMemory.id).confidence, restoredLongTrailConfidence, 'restored oldest-lineage replay cannot ratchet confidence');
assert.equal(longTrailRestored.indexDiagnostics().pass, true, 'long-horizon provenance filter preserves canonical memory indexes');
const normalizedReplay = longTrailRestored.recordEvidence(longTrailMemory.id, {
  source: 'replay-normalization-regression',
  provenanceClass: 'external',
  sourceAuthority01: 1,
  independenceKey: '  ＨＥＸＩＳ－ＲＯＬＬＯＶＥＲ－０  ',
  observedAt: lineageEpoch + 10_000,
  evidenceFreshnessAt: lineageEpoch + 10_000,
});
assert.equal(normalizedReplay.added, false, 'NFKC-equivalent full-width and case-normalized lineage keys cannot bypass the replay guard');
assert.equal(normalizedReplay.reason, 'duplicate-source');
assert.equal(longTrailRestored.snapshot().items.find(row => row.id === longTrailMemory.id).confidence, restoredLongTrailConfidence, 'normalized replay cannot ratchet confidence');
assert.equal(longTrailRestored.indexDiagnostics().pass, true, 'normalized replay rejection preserves memory indexes');

// A malformed persisted filter must fail closed instead of forgetting lineage and re-voting old evidence.
const corruptFilterSnapshot = structuredClone(longTrailOS.snapshot());
const corruptFilterRow = corruptFilterSnapshot.items.find(row => row.id === longTrailMemory.id);
assert.ok(corruptFilterRow?.evidenceLineageFilter?.segments?.length, 'fixture contains a persisted Bloom segment');
corruptFilterRow.evidenceLineageFilter.segments[0].bits = 'tampered-bitset';
const failClosedMemory = new MemoryOS2();
failClosedMemory.restore(corruptFilterSnapshot);
assert.equal(failClosedMemory.hasEvidenceLineage(longTrailMemory.id, 'brand-new-unseen-lineage'), true, 'invalid persisted bitsets deny unverified lineage membership conservatively');
const failClosedConfidence = failClosedMemory.snapshot().items.find(row => row.id === longTrailMemory.id).confidence;
failClosedMemory.encode(longLineageInput(200, { confidence: .99, sourceAuthority01: 1 }), { clone: false });
assert.equal(failClosedMemory.snapshot().items.find(row => row.id === longTrailMemory.id).confidence, failClosedConfidence, 'corrupt filter recovery cannot inflate confidence through an unverified source');
assert.equal(failClosedMemory.indexDiagnostics().pass, true, 'fail-closed filter recovery retains index integrity');
// Guard the production composition path as well as the isolated policy object.
const coreSource = await readFile(new URL('../../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const revisionStart = coreSource.indexOf('hexisReviseBelief(input: {');
const revisionEnd = coreSource.indexOf('Temporal views delegate to MemoryOS2', revisionStart);
assert.ok(revisionStart >= 0 && revisionEnd > revisionStart, 'Hexis belief revision must remain in Core');
const revisionBody = coreSource.slice(revisionStart, revisionEnd);
assert.ok(revisionBody.includes('memoryOS.hasEvidenceLineage'), 'Core must consult canonical lineage before revision');
assert.ok(revisionBody.includes('fabric.recordEvidence'), 'Core must write evidence through the MemoryFabric lifecycle journal');
assert.ok(revisionBody.includes('canonicalDuplicate,'), 'Core must pass canonical duplicate status to the belief policy');
assert.ok(revisionBody.includes('if (audit.applied)') && revisionBody.includes('if (!evidence?.added)'),
  'confidence updates require an applied revision and a new canonical evidence receipt');
assert.ok(revisionBody.includes('if (priorAudit)'), 'partial belief revisions must recover from an existing audit');
assert.ok(revisionBody.indexOf('const audit = this.hexisAdaptation.reviseBelief') < revisionBody.lastIndexOf('const persisted = persistEvidence()'),
  'new belief audits must precede evidence writes so an interrupted sequence can be recovered');
assert.ok(revisionBody.includes('confidenceCommandId'), 'confidence reconciliation must be idempotent across retry/restore');

// Hexis source identity uses the same Unicode/case/length normalization as canonical memory.
const normalizedSource = new HexisAdaptationFabric();
const normalizedFirst = normalizedSource.reviseBelief({
  memoryId: 'normalized-source-memory',
  confidence01: .5,
  stance: 'supports',
  evidence: { ref: ' ＳOURCE-A ' },
  at: 100,
});
assert.equal(normalizedFirst.applied, true);
const normalizedSnapshot = normalizedSource.snapshot();
normalizedSnapshot.beliefs[0].sourceKeys = ['  ＳOURCE-A ']; // legacy snapshot spelling
const restoredNormalizedSource = new HexisAdaptationFabric();
restoredNormalizedSource.restore(normalizedSnapshot);
const normalizedRetry = restoredNormalizedSource.reviseBelief({
  memoryId: 'normalized-source-memory',
  confidence01: normalizedFirst.posteriorConfidence01,
  stance: 'supports',
  evidence: { ref: 'source-a' },
  at: 200,
});
assert.equal(normalizedRetry.applied, false, 'same NFKC/case-normalized source must not earn a second vote');
assert.equal(normalizedRetry.reason, 'duplicate_source');

// Corrupt sidecar state must not poison the canonical cognitive runtime on restart.
const recoveredProjection = new HexisAdaptationFabric();
recoveredProjection.restore({
  beliefs: [
    null,
    { memoryId: '', confidence01: .4, trust01: .5, sourceKeys: [], contradictingSourceKeys: [], updatedAt: 1 },
    { memoryId: 'bad-confidence', confidence01: Number.NaN, trust01: .5, sourceKeys: [], contradictingSourceKeys: [], updatedAt: 1 },
    { memoryId: 'bad-trust', confidence01: .4, trust01: Number.NaN, sourceKeys: [], contradictingSourceKeys: [], updatedAt: 1 },
    { memoryId: 'ambiguous-memory', confidence01: .2, trust01: .4, sourceKeys: ['old'], contradictingSourceKeys: [], updatedAt: 100 },
    { memoryId: 'ambiguous-memory', confidence01: .8, trust01: .9, sourceKeys: ['new'], contradictingSourceKeys: [], updatedAt: 200 },
    {
      memoryId: 'survivor-memory',
      confidence01: .62,
      trust01: .75,
      sourceKeys: [' source-a ', '', 7, 'source-a'],
      contradictingSourceKeys: null,
      updatedAt: Number.NaN,
    },
  ],
  metrics: { beliefRevisions: 'corrupt-counter', duplicateEvidence: -1 },
});
const recoveredState = recoveredProjection.snapshot();
assert.equal(recoveredState.beliefs.length, 1, 'invalid belief projections are dropped without discarding valid memory-side state');
assert.equal(recoveredState.beliefs.some(row => row.memoryId === 'ambiguous-memory'), false, 'duplicate IDs are dropped rather than selecting an arbitrary confidence projection');
assert.deepEqual(recoveredState.beliefs[0].sourceKeys, ['source-a'], 'replayed keys are trimmed, deduplicated and type-checked');
assert.deepEqual(recoveredState.beliefs[0].contradictingSourceKeys, [], 'malformed key arrays normalize to empty arrays');
assert.equal(recoveredState.beliefs[0].updatedAt, 0, 'invalid projection timestamps normalize conservatively');
assert.equal(recoveredState.metrics.beliefRevisions, 0, 'corrupt counters cannot poison diagnostic arithmetic');
assert.equal(recoveredState.metrics.duplicateEvidence, 0, 'negative counters are rejected during restore');
const postRestoreRevision = recoveredProjection.reviseBelief({
  memoryId: 'survivor-memory',
  confidence01: .62,
  trust01: .75,
  evidence: { ref: 'https://evidence.example/post-restore' },
  stance: 'supports',
  at: 5000,
});
assert.equal(postRestoreRevision.applied, true, 'valid belief updates remain usable after a damaged sidecar is restored');
// Production evidence writes pass through MemoryFabric's journal and durable replay receipts.
const journalMemoryOS = new MemoryOS2({ signalFusionProfile: 'balanced' });
const journalEvents = new EventLog(64);
const journalFabric = new MemoryFabric(
  journalMemoryOS,
  journalEvents,
  new MultiTimescaleMemory(),
  new MemorySubstrateCoordinator(),
  new UnifiedMemorySystem(),
  new P62MemoryFabric(),
  new SemanticMemoryGraph(),
);
const journalMemory = journalFabric.encode({
  content: 'A memory item whose evidence mutation must be journaled.',
  kind: 'semantic',
  source: 'hexis-fabric-evidence-regression',
  tags: ['hexis', 'lifecycle'],
  context: {},
  salience: .5,
  emotionalWeight: .1,
  identityRelevance: .1,
  goalRelevance: .2,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .6,
  epistemicStatus: 'belief',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
}, { commandId: 'hexis-fabric-evidence:seed', tick: 17 });
const journalEvidence = {
  source: 'https://evidence.example/lifecycle-receipt',
  provenanceClass: 'external',
  sourceAuthority01: .82,
  independenceKey: 'hexis-lifecycle-receipt-fixture',
  observedAt: 1800000000700,
  evidenceFreshnessAt: 1800000000700,
};
const journalCommandId = 'hexis-fabric-evidence:' + journalEvidence.independenceKey;
const journalFirst = journalFabric.recordEvidence(journalMemory.id, journalEvidence, { commandId: journalCommandId, tick: 18 });
assert.equal(journalFirst.added, true);
const eventRowsAfterFirst = journalEvents.list().filter(event => event.type === 'memory-lifecycle' && event.payload?.action === 'record-evidence');
assert.equal(eventRowsAfterFirst.length, 1, 'new source evidence emits one lifecycle event');
assert.ok(/^[a-f0-9]{64}$/.test(String(eventRowsAfterFirst[0].payload.independenceKeyDigest)), 'event records only the one-way source digest');
assert.ok(/^[a-f0-9]{64}$/.test(String(eventRowsAfterFirst[0].payload.sourceDigest)), 'event records a digest instead of the raw source label');
assert.equal('source' in eventRowsAfterFirst[0].payload, false, 'raw source reference stays out of the lifecycle event payload');
assert.equal('independenceKey' in eventRowsAfterFirst[0].payload, false, 'raw source-lineage key stays out of the event payload');
assert.equal('content' in eventRowsAfterFirst[0].payload, false, 'memory content stays out of the evidence event payload');
assert.throws(() => journalFabric.recordEvidence(journalMemory.id, {
  ...journalEvidence,
  source: 'different-source-for-same-command-key',
}, { commandId: journalCommandId, tick: 18 }), MemoryLifecycleCommandConflictError,
  'reusing an evidence command ID with a different payload must fail closed');
const journalReplay = journalFabric.recordEvidence(journalMemory.id, journalEvidence, { commandId: journalCommandId, tick: 19 });
assert.equal(journalReplay.added, false, 'same command ID is replay-safe without a second evidence vote');
assert.equal(journalEvents.list().filter(event => event.type === 'memory-lifecycle' && event.payload?.action === 'record-evidence').length, 1,
  'replaying an evidence command must not emit another lifecycle event');
assert.ok(journalFabric.snapshot().mutationReceipts.some(receipt => receipt.commandId === journalCommandId),
  'the evidence mutation receipt must be persisted in MemoryFabric state');

const journalRestoredOS = new MemoryOS2({ signalFusionProfile: 'balanced' });
journalRestoredOS.restore(journalMemoryOS.snapshot());
const restoredJournalEvents = new EventLog(64);
const restoredJournalFabric = new MemoryFabric(
  journalRestoredOS,
  restoredJournalEvents,
  new MultiTimescaleMemory(),
  new MemorySubstrateCoordinator(),
  new UnifiedMemorySystem(),
  new P62MemoryFabric(),
  new SemanticMemoryGraph(),
);
restoredJournalFabric.restore(journalFabric.snapshot());
const journalReplayAfterRestore = restoredJournalFabric.recordEvidence(journalMemory.id, journalEvidence, {
  commandId: journalCommandId,
  tick: 20,
});
assert.equal(journalReplayAfterRestore.added, false, 'receipt restore prevents a second mutation');
assert.equal(restoredJournalEvents.list().filter(event => event.type === 'memory-lifecycle' && event.payload?.action === 'record-evidence').length, 0,
  'replaying a restored receipt must not synthesize a new event');
assert.equal(journalRestoredOS.evidenceTrail(journalMemory.id).independentSources, 2);
assert.equal(journalRestoredOS.indexDiagnostics().pass, true);

console.log('HEXIS_MEMORY_EVIDENCE_LINEAGE=PASS', JSON.stringify({
  priorConfidence,
  posteriorConfidence: firstAudit.posteriorConfidence01,
  independentSources: restored.evidenceTrail(memory.id).independentSources,
  duplicateGuardRestored: restored.hasEvidenceLineage(memory.id, sourceRef),
}));
