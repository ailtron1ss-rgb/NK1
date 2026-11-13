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
      episodes: [{ ref: 'episode:1', summary: 'An imported episode summary.', memory_refs: ['memory:alpha', 'memory:beta'] }],
      relationships: [
        { source_ref: 'memory:alpha', target_ref: 'memory:beta', edge_type: 'RELATED' },
        { source_ref: 'memory:beta', target_ref: 'episode:1', edge_type: 'CAUSES' },
        { source_ref: 'episode:1', target_ref: 'memory:alpha', edge_type: 'CAUSED_BY' },
        { source_ref: 'memory:alpha', target_ref: 'memory:beta', edge_type: 'CONTRADICTS' },
      ],
      clusters: [{ ref: 'cluster:1', name: 'Transit planning', cluster_type: 'topic', member_refs: ['memory:alpha', 'memory:beta'] }],
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
assert.equal(staged.episodeCount, 1);
assert.equal(staged.relationshipCount, 4);
assert.equal(staged.clusterCount, 1);
assert.deepEqual(staged.deferredSections, []);
assert.ok(staged.stagingId);

const committed = bridge.commit(staged.stagingId);
assert.equal(committed.ok, true);
assert.equal(committed.inserted, 4);
assert.equal(committed.replayed, 0);
assert.equal(committed.relationshipsApplied, 4);
assert.equal(committed.clustersApplied, 1);
assert.equal(Object.keys(committed.refMap).length, 4);
const alpha = memory.getCanonicalMemory(committed.refMap['memory:alpha']);
assert.equal(alpha.content, 'The donor observed a red bicycle.');
assert.equal(alpha.kind, 'semantic');
assert.equal(alpha.epistemicStatus, 'hypothesis');
assert.equal(alpha.confidence, 0.25, 'donor trust/confidence must not be imported as verified belief');
assert.equal(alpha.sourceAuthority01, 0.2);
assert.equal(alpha.provenanceClass, 'external');
assert.equal(alpha.semanticVector, undefined, 'donor embeddings must not be imported');
assert.equal(alpha.context.hmxSourceInstance, 'donor-instance-1');
assert.ok(alpha.semanticLinks.includes(committed.refMap['memory:beta']), 'HMX semantic relationship must become a canonical semantic link');
assert.ok(alpha.causalLinks.includes(committed.refMap['episode:1']), 'CAUSED_BY must reverse direction when projected to canonical causal links');
assert.ok(alpha.contradictionLinks.includes(committed.refMap['memory:beta']), 'CONTRADICTS must be projected bidirectionally');
const beta = memory.getCanonicalMemory(committed.refMap['memory:beta']);
assert.ok(beta.causalLinks.includes(committed.refMap['episode:1']), 'HMX causal relationship must become a canonical causal link');
assert.ok(beta.contradictionLinks.includes(committed.refMap['memory:alpha']), 'symmetric contradiction must be visible from both endpoints');
assert.ok(alpha.semanticLinks.includes(committed.refMap['cluster:1']), 'cluster membership must link the member to the cluster anchor');
assert.ok(beta.semanticLinks.includes(committed.refMap['cluster:1']), 'cluster membership must be bidirectional');
const cluster = memory.getCanonicalMemory(committed.refMap['cluster:1']);
assert.equal(cluster.content, 'Transit planning');
assert.equal(cluster.context.hmxSection, 'clusters');
assert.ok(cluster.semanticLinks.includes(committed.refMap['memory:alpha']));
assert.ok(cluster.semanticLinks.includes(committed.refMap['memory:beta']));
const episode = memory.getCanonicalMemory(committed.refMap['episode:1']);
assert.equal(episode.kind, 'episodic');
assert.equal(episode.content, 'An imported episode summary.');
assert.ok(episode.temporalLinks.includes(committed.refMap['memory:alpha']));
assert.ok(episode.temporalLinks.includes(committed.refMap['memory:beta']));

const replay = bridge.commit(staged.stagingId);
assert.equal(replay.ok, true);
assert.equal(replay.inserted, 0);
assert.equal(replay.replayed, 4);
assert.equal(replay.relationshipsApplied, 4);
assert.equal(replay.clustersApplied, 1);
assert.deepEqual(replay.refMap, committed.refMap);
assert.equal(memory.rows.size, 4, 'replaying the same accepted stage must not create duplicate canonical memories');



const orphanCluster = bridge.stage({ document: document({
  export_id: 'exp_orphan_cluster',
  sections: {
    memories: [{ ref: 'memory:orphan-base', type: 'semantic', content: 'An isolated imported item.' }],
    clusters: [{ ref: 'cluster:orphan', name: 'Unavailable cluster', member_refs: ['memory:not-imported'] }],
  },
}) });
assert.equal(orphanCluster.ok, true);
assert.equal(orphanCluster.clusterCount, 1, 'stage reports a named cluster candidate');
const orphanCommit = bridge.commit(orphanCluster.stagingId);
assert.equal(orphanCommit.ok, true);
assert.equal(orphanCommit.clustersApplied, 0, 'cluster without imported members must not create a ghost anchor');
assert.ok(orphanCommit.warnings.some(w => w.code === 'cluster-member-not-imported'));
assert.ok(orphanCommit.warnings.some(w => w.code === 'cluster-without-members'));
assert.equal(orphanCommit.refMap['cluster:orphan'], undefined);

const dangling = bridge.stage({ document: document({
  export_id: 'exp_dangling_relationship',
  sections: {
    memories: [{ ref: 'memory:known', type: 'semantic', content: 'Known endpoint.' }],
    relationships: [{ source_ref: 'memory:known', target_ref: 'memory:not-imported', edge_type: 'RELATED' }],
  },
}) });
assert.equal(dangling.ok, true);
const danglingCommit = bridge.commit(dangling.stagingId);
assert.equal(danglingCommit.ok, true);
assert.equal(danglingCommit.relationshipsApplied, 0);
assert.ok(danglingCommit.warnings.some(w => w.code === 'relationship-endpoint-not-imported'));
const known = memory.getCanonicalMemory(danglingCommit.refMap['memory:known']);
assert.equal(known.semanticLinks.length, 0, 'dangling relationship must not create a ghost link');

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



const normalizedStage = bridge.stage({ document: document({
  export_id: 'exp_normalized_metadata',
  sections: { memories: [{
    ref: 'memory:procedural', type: 'procedural', content: 'A donor procedural item is not executable.',
    created_at: '2999-01-01T00:00:00Z',
  }] },
}) });
assert.equal(normalizedStage.ok, true);
const normalizedCommit = bridge.commit(normalizedStage.stagingId);
assert.equal(normalizedCommit.ok, true);
assert.ok(normalizedCommit.warnings.some(w => w.code === 'memory-kind-normalized'));
assert.ok(normalizedCommit.warnings.some(w => w.code === 'future-source-time-ignored'));
const normalized = memory.getCanonicalMemory(normalizedCommit.refMap['memory:procedural']);
assert.equal(normalized.kind, 'semantic');
assert.equal(normalized.context.hmxOriginalType, 'procedural');
assert.equal(normalized.observedAt, undefined, 'future donor timestamps must not inflate canonical freshness');

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
assert.equal(integratedCommit.ok, true, JSON.stringify(integratedCommit));
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

const sameContentDifferentExport = systems.memory.hexisHmxCanonicalMemoryBridge.stage({
  document: document({
    export_id: 'exp_runtime_wiring_2',
    sections: { memories: [{ ref: 'memory:runtime-copy', type: 'semantic', content: 'Canonical runtime wiring test memory.' }] },
  }),
});
assert.equal(sameContentDifferentExport.ok, true);
const secondImport = systems.memory.hexisHmxCanonicalMemoryBridge.commit(sameContentDifferentExport.stagingId);
assert.equal(secondImport.ok, true);
assert.notEqual(secondImport.refMap['memory:runtime-copy'], canonicalId,
  'a distinct HMX export must preserve its own deterministic provenance reference even when content is identical');
assert.equal(systems.memory.memoryOS.size(), 2, 'forceDistinct must preserve distinct donor export references in the canonical owner');

console.log('HEXIS_HMX_CANONICAL_MEMORY_BRIDGE_PASS');
