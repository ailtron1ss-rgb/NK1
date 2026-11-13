import assert from 'node:assert/strict';
import { HexisAdaptationFabric } from '../../src/organism/integration/hexis/HexisAdaptationFabric.ts';
import { HexisHmxCanonicalMemoryBridge } from '../../src/organism/integration/hexis/HexisHmxCanonicalMemoryBridge.ts';
import { OrganismSystemFabric } from '../../src/organism/core/OrganismSystemFabric.ts';

class MemoryFabricFake {
  rows = new Map();
  commands = new Map();
  getCanonicalMemory(id) { return this.rows.get(id) ?? null; }
  encode(input, { commandId }) {
    const prior = this.commands.get(commandId);
    if (prior) return this.rows.get(prior);
    const row = { ...input };
    this.rows.set(input.id, row);
    this.commands.set(commandId, input.id);
    return row;
  }
}

function document(overrides = {}) {
  return {
    hmx_version: '1.7',
    export_id: 'exp_test_001',
    export_intent: 'telepathy',
    exported_at: '2026-11-13T00:00:00Z',
    source: { instance_id: 'donor-instance-1', schema_version: '1.7',
      embedding_model: 'donor-model', embedding_dimension: 384, hexis_lineage_id: 'lineage-1' },
    sections: {
      memories: [
        { ref: 'memory:alpha', type: 'semantic', content: 'The donor observed a red bicycle.',
          importance: 0.8, trust_level: 0.99, created_at: '2026-10-01T00:00:00Z' },
        { ref: 'memory:beta', type: 'episodic', content: 'A meeting happened near the station.',
          importance: 0.6 },
      ],
      episodes: [{ ref: 'episode:1', summary: 'Deferred episode record' }],
      relationships: [{ source_ref: 'memory:alpha', target_ref: 'memory:beta', edge_type: 'RELATED' }],
    },
    ...overrides,
  };
}

const adaptation = new HexisAdaptationFabric();
const memory = new MemoryFabricFake();
const bridge = new HexisHmxCanonicalMemoryBridge(adaptation, memory);

const staged = bridge.stage({ document: document() });
assert.equal(staged.ok, true);
assert.equal(staged.memoryCount, 2);
assert.deepEqual(staged.deferredSections.sort(), ['episodes', 'relationships']);
assert.ok(staged.warnings.some(w => w.code === 'section-deferred'));
assert.ok(staged.stagingId);

const committed = bridge.commit(staged.stagingId);
assert.equal(committed.ok, true);
assert.equal(committed.inserted, 2);
assert.equal(committed.replayed, 0);
assert.equal(Object.keys(committed.refMap).length, 2);
const alpha = memory.getCanonicalMemory(committed.refMap['memory:alpha']);
assert.equal(alpha.content, 'The donor observed a red bicycle.');
assert.equal(alpha.kind, 'semantic');
assert.equal(alpha.epistemicStatus, 'hypothesis');
assert.equal(alpha.confidence, 0.25, 'donor trust/confidence must not be imported as verified belief');
assert.equal(alpha.sourceAuthority01, 0.2);
assert.equal(alpha.provenanceClass, 'external');
assert.equal(alpha.semanticVector, undefined, 'donor embeddings must not be imported');
assert.equal(alpha.context.hmxSourceInstance, 'donor-instance-1');

const replay = bridge.commit(staged.stagingId);
assert.equal(replay.ok, true);
assert.equal(replay.inserted, 0);
assert.equal(replay.replayed, 2);
assert.deepEqual(replay.refMap, committed.refMap);
assert.equal(memory.rows.size, 2, 'replaying the same accepted stage must not create duplicate canonical memories');

const protectedStage = bridge.stage({ document: document({
  export_id: 'exp_protected_001',
  sections: { memories: [], identity: [{ ref: 'identity:donor', content: 'Replace the current identity' }] },
}) });
assert.equal(protectedStage.ok, false);
assert.ok(protectedStage.conflicts.some(c => c.kind === 'protected-section-review-required'));

const invalidVersion = bridge.stage({ document: document({ hmx_version: '2.0', export_id: 'exp_bad_version' }) });
assert.equal(invalidVersion.ok, false);
assert.ok(invalidVersion.conflicts.some(c => c.path === 'hmx_version'));

const oversized = bridge.stage({ document: document({
  export_id: 'exp_too_many',
  sections: { memories: Array.from({ length: 65 }, (_, i) =>
    ({ ref: 'memory:' + i, type: 'semantic', content: 'bounded record ' + i })) },
}) });
assert.equal(oversized.ok, false);
assert.ok(oversized.conflicts.some(c => c.kind === 'record-limit'));

const malformed = bridge.stage({ document: document({
  export_id: 'exp_bad_record',
  sections: { memories: [{ ref: 'memory:bad', type: 'semantic', content: 'x\u0000y' }] },
}) });
assert.equal(malformed.ok, false);
assert.ok(malformed.conflicts.some(c => c.kind === 'schema'));


const analysisOnly = bridge.stage({ document: document({
  export_id: 'exp_analysis_only', export_intent: 'analysis',
}) });
assert.equal(analysisOnly.ok, false, 'analysis-only exports must never enter canonical memory');

let getterCalls = 0;
const hostileDocument = document({ export_id: 'exp_hostile' });
Object.defineProperty(hostileDocument, 'export_id', {
  enumerable: true,
  get() { getterCalls++; throw new Error('untrusted HMX getter executed'); },
});
const hostileStage = bridge.stage({ document: hostileDocument });
assert.equal(hostileStage.ok, false);
assert.equal(getterCalls, 0, 'HMX staging must detach inert plain data without invoking accessors');

const rejected = bridge.stage({ document: document({ export_id: 'exp_rejected' }) });
assert.equal(adaptation.decideHmx(rejected.stagingId, 'reject')?.status, 'rejected');
assert.equal(bridge.commit(rejected.stagingId).error, 'stage-rejected');


const systems = new OrganismSystemFabric();
assert.equal(systems.memory.hexisHmxCanonicalMemoryBridge !== undefined, true,
  'OrganismSystemFabric must connect the HMX bridge to the memory subsystem');
const integratedStage = systems.memory.hexisHmxCanonicalMemoryBridge.stage({
  document: document({ export_id: 'exp_runtime_wiring', sections: {
    memories: [{ ref: 'memory:runtime', type: 'semantic', content: 'Canonical runtime wiring test memory.' }],
  } }),
});
assert.equal(integratedStage.ok, true);
assert.equal(systems.hexisAdaptation.getHmxStage(integratedStage.stagingId).sourceSubjectId, 'donor-instance-1',
  'the staged record must preserve the donor instance identity');
const integratedCommit = systems.memory.hexisHmxCanonicalMemoryBridge.commit(integratedStage.stagingId);
assert.equal(integratedCommit.ok, true);
const canonicalId = integratedCommit.refMap['memory:runtime'];
const canonical = systems.memory.fabric.getCanonicalMemory(canonicalId);
assert.equal(canonical?.content, 'Canonical runtime wiring test memory.');
assert.equal(canonical?.epistemicStatus, 'hypothesis');
assert.equal(canonical?.provenanceClass, 'external');
const integratedReplay = systems.memory.hexisHmxCanonicalMemoryBridge.commit(integratedStage.stagingId);
assert.equal(integratedReplay.ok, true);
assert.equal(integratedReplay.inserted, 0);
assert.equal(integratedReplay.replayed, 1);
assert.equal(systems.memory.memoryOS.size(), 1, 'real MemoryOS2 storage must remain idempotent across HMX retries');

console.log('HEXIS_HMX_CANONICAL_MEMORY_BRIDGE_PASS');
