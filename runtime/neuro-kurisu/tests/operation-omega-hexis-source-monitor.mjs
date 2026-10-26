import assert from 'node:assert/strict';
import { SourceMonitor } from '../src/organism/memory/SourceMonitor.ts';

const monitor = new SourceMonitor();
const root = {
  id: 'trace:memory:turn-17',
  source: 'memory',
  kind: 'user-preference',
  confidence: 0.78,
  epistemicStatus: 'observation',
  at: 1_800_000_000_100,
  provenance: {
    sourceId: 'conversation:turn-17:item-4',
    sourceKind: 'user-memory',
    capturedAt: 1_800_000_000_100,
    evidenceClass: 'corroborated',
    contentFingerprint: 'a'.repeat(64),
    citation: 'turn-17:item-4',
  },
};
const child = {
  id: 'trace:inference:turn-18',
  source: 'model',
  kind: 'preference-inference',
  confidence: 0.61,
  epistemicStatus: 'hypothesis',
  at: 1_800_000_000_200,
  parentIds: [root.id],
  provenance: {
    sourceId: 'inference:turn-18',
    sourceKind: 'model-inference',
    capturedAt: 1_800_000_000_200,
    evidenceClass: 'inferred',
  },
};
monitor.record(root);
monitor.record(child);
assert.deepEqual(monitor.lineage(child.id).map(x => x.id), [child.id, root.id]);
assert.equal(monitor.lineage(child.id)[1].provenance.contentFingerprint, 'a'.repeat(64));
assert.equal(monitor.snapshot().traces.length, 2);

const restored = new SourceMonitor();
restored.restore(monitor.snapshot());
assert.deepEqual(restored.lineage(child.id).map(x => x.id), [child.id, root.id]);
assert.equal(restored.latest()[0].provenance.evidenceClass, 'inferred');

const beforeRejected = restored.snapshot().unattributed;
restored.record({
  ...child, id: 'trace:bad', provenance: {
    sourceId: 'not-authenticated', sourceKind: 'external',
    capturedAt: -1, evidenceClass: 'direct-observation',
  },
});
assert.equal(restored.snapshot().unattributed, beforeRejected + 1);
assert.equal(restored.snapshot().traces.some(x => x.id === 'trace:bad'), false,
  'malformed provenance must be rejected as an entire trace, not silently trusted');

const legacy = new SourceMonitor();
legacy.restore({traces:[{
  id:'trace:legacy',source:'user',kind:'note',confidence:1.4,epistemicStatus:'fact',at:100,
}],conflicts:0,unattributed:0});
assert.equal(legacy.latest()[0].confidence,1);
assert.equal(legacy.latest()[0].provenance,undefined);
assert.equal(legacy.snapshot().unattributed,0,
  'old traces without provenance remain compatible');

const malformedRestore = new SourceMonitor();
malformedRestore.restore({traces:[{
  id:'trace:bad-restore',source:'tool',kind:'tool-result',confidence:.7,
  epistemicStatus:'observation',at:100,
  provenance:{sourceId:'broken',sourceKind:'tool',capturedAt:-1,evidenceClass:'direct-observation'},
}],conflicts:0,unattributed:0});
assert.equal(malformedRestore.latest().length,0);
assert.equal(malformedRestore.snapshot().unattributed,1);

console.log('OPERATION_OMEGA_HEXIS_SOURCE_MONITOR=PASS bounded lineage, provenance integrity, restore safety and legacy compatibility');
