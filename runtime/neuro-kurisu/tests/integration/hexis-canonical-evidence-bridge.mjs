import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MemorySubsystemRuntime } from '../../src/organism/core/MemorySubsystemRuntime.ts';

const runtime = new MemorySubsystemRuntime();
const now = Date.now();
const content = 'A direct sensor observation remains attached to the canonical NK1 memory.';
const memory = runtime.fabric.encode({
  content,
  kind: 'semantic',
  source: 'hexis-evidence-test-seed',
  tags: ['hexis-evidence-lineage'],
  context: { fixture: 'hexis-evidence-lineage' },
  salience: .6,
  emotionalWeight: .1,
  identityRelevance: .1,
  goalRelevance: .2,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .72,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now,
  observedAt: now,
  provenanceClass: 'agent',
  sourceAuthority01: .4,
}, { commandId: 'hexis-evidence-test:seed' });
assert(memory?.id);

const fingerprint = createHash('sha256').update(content).digest('hex');
const provenance = {
  sourceId: 'sensor:hall-01',
  sourceKind: 'temperature-sensor',
  capturedAt: now,
  evidenceClass: 'direct-observation',
  contentFingerprint: fingerprint,
};
runtime.sourceMonitor.record({
  id: 'trace-direct-001',
  source: 'world',
  kind: 'sensor-observation',
  confidence: .99,
  epistemicStatus: 'observation',
  at: now,
  provenance,
});

const before = runtime.fabric.canonicalSnapshot().items.find(row => row.id === memory.id);
assert(before);
const first = runtime.hexisCanonicalEvidenceBridge.recordSourceTrace(memory.id, 'trace-direct-001');
assert.equal(first.accepted, true);
assert.equal(first.added, true);
const afterFirst = runtime.fabric.canonicalSnapshot().items.find(row => row.id === memory.id);
assert(afterFirst);
assert.equal(afterFirst.confidence, before.confidence, 'provenance ingestion must not change belief confidence');
const independenceKey = 'hexis-source:' + createHash('sha256').update(provenance.sourceId + '\u0000' + fingerprint).digest('hex');
assert(afterFirst.evidenceSources?.some(row => row.independenceKey === independenceKey));
assert(afterFirst.evidenceLineageKeys?.includes('lineage:' + independenceKey));

// A conflicting reuse of an immutable trace ID must not replace its original lineage.
const spoofedFingerprint = createHash('sha256').update('different body').digest('hex');
runtime.sourceMonitor.record({
  id: 'trace-direct-001',
  source: 'world',
  kind: 'sensor-observation',
  confidence: .99,
  epistemicStatus: 'observation',
  at: now,
  provenance: { ...provenance, sourceId: 'sensor:spoofed-reuse', contentFingerprint: spoofedFingerprint },
});
assert.equal(runtime.sourceMonitor.snapshot().conflicts, 1, 'conflicting trace ID reuse is counted');
const traceIdReuse = runtime.hexisCanonicalEvidenceBridge.recordSourceTrace(memory.id, 'trace-direct-001');
assert.equal(traceIdReuse.accepted, true);
assert.equal(traceIdReuse.added, false, 'conflicting ID reuse cannot replace the original canonical lineage');
const afterTraceIdReuse = runtime.fabric.canonicalSnapshot().items.find(row => row.id === memory.id);
assert(afterTraceIdReuse);
assert.equal(afterTraceIdReuse.evidenceSources?.filter(row => row.independenceKey === independenceKey).length, 1);
const spoofedIndependenceKey = 'hexis-source:' + createHash('sha256').update('sensor:spoofed-reuse' + '\u0000' + spoofedFingerprint).digest('hex');
assert.equal(afterTraceIdReuse.evidenceSources?.some(row => row.independenceKey === spoofedIndependenceKey), false);
assert.equal(afterTraceIdReuse.confidence, before.confidence);

const p65Id = runtime.p65EpistemicLedger.record({
  tick: 77,
  at: now,
  kind: 'observation',
  content,
  confidence01: .98,
  source: 'external-api',
  provenance,
});
const duplicate = runtime.hexisCanonicalEvidenceBridge.recordP65Claim(memory.id, p65Id);
assert.equal(duplicate.accepted, true);
assert.equal(duplicate.added, false, 'SourceMonitor and P65 copies of one upstream observation must collapse to one lineage');
const afterDuplicate = runtime.fabric.canonicalSnapshot().items.find(row => row.id === memory.id);
assert(afterDuplicate);
assert.equal(afterDuplicate.evidenceSources?.filter(row => row.independenceKey === independenceKey).length, 1);
assert.equal(afterDuplicate.confidence, before.confidence);

runtime.sourceMonitor.record({
  id: 'trace-no-provenance',
  source: 'world',
  kind: 'sensor-observation',
  confidence: .9,
  epistemicStatus: 'observation',
  at: now,
});
assert.equal(runtime.hexisCanonicalEvidenceBridge.recordSourceTrace(memory.id, 'trace-no-provenance').accepted, false);
runtime.sourceMonitor.record({
  id: 'trace-model-echo',
  source: 'model',
  kind: 'model-echo',
  confidence: .99,
  epistemicStatus: 'observation',
  at: now,
  provenance: { ...provenance, sourceId: 'model:echo-01', evidenceClass: 'model-generated' },
});
assert.equal(runtime.hexisCanonicalEvidenceBridge.recordSourceTrace(memory.id, 'trace-model-echo').accepted, false);
const nonIndependentId = runtime.p65EpistemicLedger.record({
  tick: 78, at: now, kind: 'observation', content: 'Generated assertion, not independent evidence.',
  confidence01: .99, source: 'organism', provenance,
});
assert.equal(runtime.hexisCanonicalEvidenceBridge.recordP65Claim(memory.id, nonIndependentId).accepted, false);
const mismatchedId = runtime.p65EpistemicLedger.record({
  tick: 79, at: now, kind: 'observation', content: 'Different content under a copied fingerprint.',
  confidence01: .99, source: 'external-api', provenance,
});
assert.equal(runtime.hexisCanonicalEvidenceBridge.recordP65Claim(memory.id, mismatchedId).reason, 'p65-content-fingerprint-mismatch');

// A fresh source envelope must not make a future observation safe to ingest.
const futureBaseline = runtime.fabric.canonicalSnapshot().items.find(row => row.id === memory.id);
assert(futureBaseline);
const futureBaselineEvidenceSources = structuredClone(futureBaseline.evidenceSources ?? []);
const futureBaselineLineageKeys = structuredClone(futureBaseline.evidenceLineageKeys ?? []);
const futureBaselineConfidence = futureBaseline.confidence;
const futureAt = Date.now() + 10 * 60_000;
runtime.sourceMonitor.record({
  id: 'trace-future-observation',
  source: 'world',
  kind: 'sensor-observation',
  confidence: .9,
  epistemicStatus: 'observation',
  at: futureAt,
  provenance: { ...provenance, sourceId: 'sensor:future-trace' },
});
assert.equal(runtime.hexisCanonicalEvidenceBridge.recordSourceTrace(memory.id, 'trace-future-observation').reason, 'observation-time-in-future');
const futureP65Id = runtime.p65EpistemicLedger.record({
  tick: 80, at: futureAt, kind: 'observation', content,
  confidence01: .9, source: 'external-api',
  provenance: { ...provenance, sourceId: 'sensor:future-p65' },
});
assert.equal(runtime.hexisCanonicalEvidenceBridge.recordP65Claim(memory.id, futureP65Id).reason, 'observation-time-in-future');
const afterFutureTrace = runtime.fabric.canonicalSnapshot().items.find(row => row.id === memory.id);
assert(afterFutureTrace);
assert.deepEqual(afterFutureTrace.evidenceSources ?? [], futureBaselineEvidenceSources,
  'rejected future observations must not append or rewrite canonical evidence sources');
assert.deepEqual(afterFutureTrace.evidenceLineageKeys ?? [], futureBaselineLineageKeys,
  'rejected future observations must not append canonical lineage keys');
assert.equal(afterFutureTrace.confidence, futureBaselineConfidence);

// A restored snapshot may be corrupted too; a duplicate ID must not shadow its original trace.
const snapshot = runtime.snapshot();
const originalTrace = snapshot.hexisSourceMonitor.traces.find(row => row.id === 'trace-direct-001');
assert(originalTrace);
snapshot.hexisSourceMonitor.traces.push({
  ...structuredClone(originalTrace),
  provenance: {
    ...provenance,
    sourceId: 'sensor:restore-spoof',
    contentFingerprint: createHash('sha256').update('restore spoof').digest('hex'),
  },
});
const priorRestoreConflicts = snapshot.hexisSourceMonitor.conflicts;
assert.equal(snapshot.hexisSourceMonitor.traces.find(row => row.id === 'trace-direct-001')?.provenance?.contentFingerprint, fingerprint);
assert.equal(snapshot.p65.claimsData.find(row => row.id === p65Id)?.provenance?.contentFingerprint, fingerprint);
const restored = new MemorySubsystemRuntime();
restored.restoreFromPersisted({
  memory: {
    eventLog: snapshot.events,
    autobiographicalMemories: snapshot.memories,
    selfModel: snapshot.selfModel,
    socialModel: snapshot.socialModel,
    adaptiveValues: snapshot.adaptiveValues,
    workspace: snapshot.workspace,
    semanticGraph: snapshot.semanticGraph,
  },
  advanced: {
    memoryOS: snapshot.memoryOS,
    memoryFabric: snapshot.fabric,
    unifiedMemory: snapshot.unifiedMemory,
    p47: snapshot.p47,
    p59MemoryOperatingSystem: snapshot.p59,
    p62MemoryFabric: snapshot.p62,
    p65EpistemicLedger: snapshot.p65,
    hexisSourceMonitor: snapshot.hexisSourceMonitor,
    p70MemoryLifecycleGovernor: snapshot.p70,
    p75MemoryContinuumOS: snapshot.p75,
    experienceContinuum: snapshot.experienceContinuum,
    hippocampal: snapshot.hippocampal,
    hippocampalFormation: snapshot.hippocampalFormation,
    consolidationController: snapshot.consolidationController,
    memoryLifecycleAuthority: snapshot.memoryLifecycleAuthority,
  },
});
const restoredSourceState = restored.snapshot().hexisSourceMonitor;
assert.equal(restoredSourceState.conflicts, priorRestoreConflicts + 1, 'restore must count conflicting duplicate trace IDs');
assert.equal(restoredSourceState.traces.find(row => row.id === 'trace-direct-001')?.provenance?.contentFingerprint, fingerprint,
  'restore must preserve the original trace instead of the conflicting duplicate');
const replay = restored.hexisCanonicalEvidenceBridge.recordSourceTrace(memory.id, 'trace-direct-001');
assert.equal(replay.accepted, true);
assert.equal(replay.added, false, 'canonical lineage must remain the duplicate authority after a runtime snapshot/restore');

// The public independentSources metric must report the bounded lineage ledger,
// not just the eight-row visible evidenceSources tail.
const manyRuntime = new MemorySubsystemRuntime();
const manyContent = 'Hexis lineage count fixture for bounded canonical evidence diagnostics.';
const manyMemory = manyRuntime.fabric.encode({
  content: manyContent,
  kind: 'semantic',
  source: 'hexis-lineage-count-fixture',
  tags: ['hexis-lineage-count'],
  context: { fixture: 'hexis-lineage-count' },
  salience: .6,
  emotionalWeight: .1,
  identityRelevance: .1,
  goalRelevance: .2,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .72,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now,
  observedAt: now,
  provenanceClass: 'agent',
  sourceAuthority01: .4,
}, { commandId: 'hexis-lineage-count:seed' });
assert(manyMemory?.id);
let lastFanoutResult;
for (let index = 0; index < 10; index++) {
  const sourceContent = 'Distinct direct observation ' + index;
  const sourceFingerprint = createHash('sha256').update(sourceContent).digest('hex');
  const capturedAt = now - 100 + index;
  manyRuntime.sourceMonitor.record({
    id: 'trace-lineage-count-' + index,
    source: 'world',
    kind: 'independent-sensor-observation',
    confidence: .88,
    epistemicStatus: 'observation',
    at: capturedAt,
    provenance: {
      sourceId: 'sensor:lineage-count-' + index,
      sourceKind: 'lineage-count-fixture',
      capturedAt,
      evidenceClass: 'direct-observation',
      contentFingerprint: sourceFingerprint,
    },
  });
  lastFanoutResult = manyRuntime.hexisCanonicalEvidenceBridge.recordSourceTrace(
    manyMemory.id, 'trace-lineage-count-' + index,
  );
  assert.equal(lastFanoutResult.accepted, true, 'each distinct source lineage should be accepted');
  assert.equal(lastFanoutResult.added, true, 'each distinct source lineage should be recorded once');
}
const manyAfter = manyRuntime.fabric.canonicalSnapshot(false).items.find(row => row.id === manyMemory.id);
assert(manyAfter);
const visibleSourcesCount = manyAfter.evidenceSources?.length ?? 0;
const boundedLineageCount = new Set(manyAfter.evidenceLineageKeys ?? []).size;
assert.ok(visibleSourcesCount <= 8, 'the visible canonical evidence trail must stay bounded');
assert.ok(boundedLineageCount > visibleSourcesCount,
  'the compact known-lineage ledger should retain more source identities than the visible evidence tail');
assert.equal(lastFanoutResult.independentSources, boundedLineageCount,
  'independentSources must report unique known lineages, not the truncated visible source count');
const replayOfEvictedVisibleSource = manyRuntime.hexisCanonicalEvidenceBridge.recordSourceTrace(
  manyMemory.id, 'trace-lineage-count-0',
);
assert.equal(replayOfEvictedVisibleSource.added, false,
  'a source absent from the visible eight-row trail must still be detected through bounded lineage history');
assert.equal(replayOfEvictedVisibleSource.reason, 'duplicate-source-lineage');

const stats = runtime.hexisCanonicalEvidenceBridge.snapshotStats();
assert(stats.attempted >= 6);
assert(stats.accepted >= 2);
assert(stats.added === 1);
assert(stats.duplicates >= 1);
assert(stats.rejected >= 4);

console.log('HEXIS_CANONICAL_EVIDENCE_LINEAGE=PASS', JSON.stringify({
  added: stats.added,
  duplicates: stats.duplicates,
  rejected: stats.rejected,
  confidenceUnchanged: true,
  liveMemorySingleOwner: true,
  replaySafe: replay.added === false,
  lineageCount: boundedLineageCount,
  visibleSourceCount: visibleSourcesCount,
  replayAfterVisibleEviction: replayOfEvictedVisibleSource.added === false,
}));
