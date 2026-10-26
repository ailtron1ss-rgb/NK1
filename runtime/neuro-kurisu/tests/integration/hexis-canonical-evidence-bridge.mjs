import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { HexisCanonicalEvidenceBridge } from '../src/organism/integration/hexis/HexisCanonicalEvidenceBridge.ts';
import { P65EpistemicLedger } from '../src/organism/memory/P65EpistemicLedger.ts';
import { SourceMonitor } from '../src/organism/memory/SourceMonitor.ts';

const now = Date.now();
const makeMemoryOS = () => new MemoryOS2({ signalFusionProfile: 'balanced' });
const createMemory = (memoryOS) => memoryOS.encode({
  content: 'A stable belief used to test source-trace canonicalization.',
  kind: 'semantic',
  source: 'hexis-source-bridge-fixture',
  tags: ['hexis', 'source-bridge'],
  context: { regression: 'workpass376' },
  salience: 0.6,
  emotionalWeight: 0.1,
  identityRelevance: 0.2,
  goalRelevance: 0.4,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.5,
  epistemicStatus: 'belief',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
}, { clone: false });

const fingerprintA = 'a'.repeat(64);
const provenance = {
  sourceId: 'sensor:room-4:observation-81',
  sourceKind: 'device-sensor',
  capturedAt: now - 50,
  evidenceClass: 'direct-observation',
  contentFingerprint: fingerprintA,
  citation: 'sensor:room-4:frame-81',
};
const memoryOS = makeMemoryOS();
const memory = createMemory(memoryOS);
const monitor = new SourceMonitor();
const p65 = new P65EpistemicLedger();
monitor.record({
  id: 'trace:room-4:observation-81',
  source: 'system',
  kind: 'temperature-observation',
  confidence: 0.91,
  epistemicStatus: 'observation',
  at: now - 50,
  provenance,
});
const bridge = new HexisCanonicalEvidenceBridge(memoryOS, monitor, p65);

const first = bridge.recordSourceTrace(memory.id, 'trace:room-4:observation-81');
assert.equal(first.accepted, true);
if (!first.accepted) throw new Error('direct source trace was rejected');
assert.equal(first.added, true);
assert.equal(first.independentSources, 2);
assert.equal(memoryOS.get(memory.id)?.confidence, 0.5,
  'lineage sync is not permission to revise belief confidence');
const trailAfterFirst = memoryOS.evidenceTrail(memory.id);
const reconsolidationsAfterFirst = memoryOS.statsLight().reconsolidations;

const replay = bridge.recordSourceTrace(memory.id, 'trace:room-4:observation-81');
assert.equal(replay.accepted, true);
if (!replay.accepted) throw new Error('same source lineage should be an accepted no-op');
assert.equal(replay.added, false);
assert.equal(replay.reason, 'duplicate-source');
assert.deepEqual(memoryOS.evidenceTrail(memory.id), trailAfterFirst);
assert.equal(memoryOS.statsLight().reconsolidations, reconsolidationsAfterFirst);
assert.equal(memoryOS.get(memory.id)?.confidence, 0.5);
 
// P65 and SourceMonitor reports for the same upstream source/fingerprint share one
// canonical independence key and therefore cannot double-count the observation.
const p65ClaimId = p65.record({
  tick: 100,
  at: now - 40,
  kind: 'observation',
  content: 'The room sensor reported the same observation.',
  confidence01: 0.88,
  source: 'device',
  provenance: { ...provenance, capturedAt: now - 40 },
});
const p65Replay = bridge.recordP65Claim(memory.id, p65ClaimId);
assert.equal(p65Replay.accepted, true);
if (!p65Replay.accepted) throw new Error('P65 record from an already-known source should be a no-op');
assert.equal(p65Replay.added, false);
assert.equal(p65Replay.reason, 'duplicate-source');
assert.deepEqual(memoryOS.evidenceTrail(memory.id), trailAfterFirst);
assert.equal(memoryOS.statsLight().reconsolidations, reconsolidationsAfterFirst);

// Inferences, unverified traces, model output and memory echoes are not independent
// observations, even if their envelope has a plausible fingerprint.
monitor.record({
  id: 'trace:inference:rejected',
  source: 'model',
  kind: 'preference-inference',
  confidence: 0.99,
  epistemicStatus: 'hypothesis',
  at: now,
  provenance: { ...provenance, sourceId: 'model:derived:inference-1', evidenceClass: 'inferred' },
});
const beforeRejected = memoryOS.evidenceTrail(memory.id);
const statsBeforeRejected = memoryOS.statsLight().reconsolidations;
for (const traceId of ['trace:inference:rejected']) {
  const rejected = bridge.recordSourceTrace(memory.id, traceId);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.added, false);
  assert.equal(rejected.reason, 'source-not-independent');
}
monitor.record({
  id: 'trace:unverified:rejected',
  source: 'world',
  kind: 'unverified-web-claim',
  confidence: 0.99,
  epistemicStatus: 'observation',
  at: now,
  provenance: { ...provenance, sourceId: 'web:unverified:1', evidenceClass: 'unverified' },
});
const unverified = bridge.recordSourceTrace(memory.id, 'trace:unverified:rejected');
assert.equal(unverified.accepted, false);
assert.equal(unverified.reason, 'provenance-not-eligible-for-canonical-lineage');
monitor.record({
  id: 'trace:missing-fingerprint',
  source: 'world',
  kind: 'unfingerprinted-claim',
  confidence: 0.9,
  epistemicStatus: 'fact',
  at: now,
  provenance: {
    sourceId: 'web:claim-without-fingerprint',
    sourceKind: 'web-page',
    capturedAt: now,
    evidenceClass: 'corroborated',
  },
});
const missingFingerprint = bridge.recordSourceTrace(memory.id, 'trace:missing-fingerprint');
assert.equal(missingFingerprint.accepted, false);
assert.equal(missingFingerprint.reason, 'provenance-not-eligible-for-canonical-lineage');
const inferredP65 = p65.record({
  tick: 101,
  at: now,
  kind: 'inference',
  content: 'The value may be stable.',
  confidence01: 0.98,
  source: 'device',
  provenance: { ...provenance, sourceId: 'derived:claim', evidenceClass: 'inferred' },
});
assert.equal(bridge.recordP65Claim(memory.id, inferredP65).reason, 'p65-claim-not-current-observation');

assert.deepEqual(memoryOS.evidenceTrail(memory.id), beforeRejected,
  'rejected/inferred evidence must not mutate canonical lineage');
assert.equal(memoryOS.statsLight().reconsolidations, statsBeforeRejected,
  'rejected evidence must not change reconsolidation counters');
assert.equal(memoryOS.get(memory.id)?.confidence, 0.5);

const stats = bridge.snapshotStats();
assert.equal(stats.accepted, 3, 'first direct, duplicate source-trace, duplicate P65 observation');
assert.equal(stats.added, 1);
assert.equal(stats.duplicates, 2);
assert.equal(stats.rejected, 4);

const restoredMemory = makeMemoryOS();
restoredMemory.restore(memoryOS.snapshot());
const restoredBridge = new HexisCanonicalEvidenceBridge(restoredMemory, monitor, p65);
const afterRestart = restoredBridge.recordSourceTrace(memory.id, 'trace:room-4:observation-81');
assert.equal(afterRestart.accepted, true);
if (!afterRestart.accepted) throw new Error('persisted canonical lineage should accept a duplicate replay');
assert.equal(afterRestart.added, false);
assert.equal(afterRestart.reason, 'duplicate-source');
assert.equal(restoredMemory.get(memory.id)?.confidence, 0.5);

console.log('NK1_HEXIS_SOURCE_TO_MEMORY_BRIDGE=PASS source-monitor=true p65=true duplicate-across-stores=true no-confidence-promotion=true');
