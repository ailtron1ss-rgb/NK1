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

// Reusing a trace ID with a different provenance envelope must not shadow the
// original observation or inject a second lineage into canonical memory.
runtime.sourceMonitor.record({
  id: 'trace-direct-001',
  source: 'world',
  kind: 'sensor-observation',
  confidence: .99,
  epistemicStatus: 'observation',
  at: now,
  provenance: {
    ...provenance,
    sourceId: 'sensor:spoofed-reuse',
    contentFingerprint: createHash('sha256').update('different body').digest('hex'),
  },
});
assert.equal(runtime.sourceMonitor.snapshot().conflicts, 1, 'conflicting trace ID reuse is recorded');
const traceIdReuse = runtime.hexisCanonicalEvidenceBridge.recordSourceTrace(memory.id, 'trace-direct-001');
assert.equal(traceIdReuse.accepted, true);
assert.equal(traceIdReuse.added, false, 'conflicting ID reuse cannot replace the original lineage');
const afterTraceIdReuse = runtime.fabric.canonicalSnapshot().items.find(row => row.id === memory.id);
assert(afterTraceIdReuse);
assert.equal(afterTraceIdReuse.evidenceSources?.filter(row => row.independenceKey === independenceKey).length, 1);
assert(!afterTraceIdReuse.evidenceSources?.some(row => row.independenceKey?.includes('spoofed-reuse')));

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
assert.equal(
  runtime.hexisCanonicalEvidenceBridge.recordSourceTrace(memory.id, 'trace-missing').reason,
  'source-trace-not-found',
);

// Observation time is independently bounded. A valid capture envelope cannot
// make a future-dated event safe to persist as canonical observedAt.
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
assert.equal(
  runtime.hexisCanonicalEvidenceBridge.recordSourceTrace(memory.id, 'trace-future-observation').reason,
  'observation-time-in-future',
);
const futureP65Id = runtime.p65EpistemicLedger.record({
  tick: 80, at: futureAt, kind: 'observation', content,
  confidence01: .9, source: 'external-api',
  provenance: { ...provenance, sourceId: 'sensor:future-p65' },
});
assert.equal(
  runtime.hexisCanonicalEvidenceBridge.recordP65Claim(memory.id, futureP65Id).reason,
  'observation-time-in-future',
);
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

const snapshot = runtime.snapshot();
assert.equal(snapshot.hexisSourceMonitor.traces.find(row => row.id === 'trace-direct-001')?.provenance?.contentFingerprint, fingerprint);
assert.equal(snapshot.p65.claimsData.find(row => row.id === p65Id)?.provenance?.contentFingerprint, fingerprint);
// A corrupted persisted snapshot must not restore a conflicting duplicate ID
// over the first trace; the restore path records the conflict and keeps lineage stable.
snapshot.hexisSourceMonitor.traces.push({
  ...snapshot.hexisSourceMonitor.traces.find(row => row.id === 'trace-direct-001'),
  provenance: {
    ...provenance,
    sourceId: 'sensor:restore-spoof',
    contentFingerprint: createHash('sha256').update('restore spoof').digest('hex'),
  },
});
const priorRestoreConflicts = snapshot.hexisSourceMonitor.conflicts;
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
assert.equal(restoredSourceState.conflicts, priorRestoreConflicts + 1, 'restore records conflicting duplicate trace IDs');
assert.equal(
  restoredSourceState.traces.find(row => row.id === 'trace-direct-001')?.provenance?.contentFingerprint,
  fingerprint,
  'restore preserves the original trace rather than the conflicting duplicate',
);
const replay = restored.hexisCanonicalEvidenceBridge.recordSourceTrace(memory.id, 'trace-direct-001');
assert.equal(replay.accepted, true);
assert.equal(replay.added, false, 'canonical lineage must remain the duplicate authority after a runtime snapshot/restore');

const stats = runtime.hexisCanonicalEvidenceBridge.snapshotStats();
assert(stats.attempted >= 10, 'account for direct, duplicate-ID, missing, rejected and future-dated bridge ingress; restore replay uses a separate bridge instance');
assert(stats.accepted >= 2);
assert(stats.added === 1);
assert(stats.duplicates >= 1);
assert(stats.rejected >= 6);

console.log('HEXIS_CANONICAL_EVIDENCE_LINEAGE=PASS', JSON.stringify({
  added: stats.added,
  duplicates: stats.duplicates,
  rejected: stats.rejected,
  confidenceUnchanged: true,
  liveMemorySingleOwner: true,
  replaySafe: replay.added === false,
}));
