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

const p65Id = runtime.p65EpistemicLedger.record({
  tick: 77,
  at: now,
  kind: 'observation',
  content: 'Same upstream sensor observation from the P65 evidence route.',
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

const snapshot = runtime.snapshot();
assert.equal(snapshot.sourceMonitor.traces.find(row => row.id === 'trace-direct-001')?.provenance?.contentFingerprint, fingerprint);
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
    sourceMonitor: snapshot.sourceMonitor,
    p70MemoryLifecycleGovernor: snapshot.p70,
    p75MemoryContinuumOS: snapshot.p75,
    experienceContinuum: snapshot.experienceContinuum,
    hippocampal: snapshot.hippocampal,
    hippocampalFormation: snapshot.hippocampalFormation,
    consolidationController: snapshot.consolidationController,
    memoryLifecycleAuthority: snapshot.memoryLifecycleAuthority,
  },
});
const replay = restored.hexisCanonicalEvidenceBridge.recordSourceTrace(memory.id, 'trace-direct-001');
assert.equal(replay.accepted, true);
assert.equal(replay.added, false, 'canonical lineage must remain the duplicate authority after a runtime snapshot/restore');

const stats = runtime.hexisCanonicalEvidenceBridge.snapshotStats();
assert(stats.attempted >= 5);
assert(stats.accepted >= 2);
assert(stats.added === 1);
assert(stats.duplicates >= 1);
assert(stats.rejected >= 3);

console.log('HEXIS_CANONICAL_EVIDENCE_LINEAGE=PASS', JSON.stringify({
  added: stats.added,
  duplicates: stats.duplicates,
  rejected: stats.rejected,
  confidenceUnchanged: true,
  liveMemorySingleOwner: true,
  replaySafe: replay.added === false,
}));
