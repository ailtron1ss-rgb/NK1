import assert from 'node:assert/strict';
import { normalizeNk1HmxExport } from '../../src/organism/integration/hexis/Nk1HmxExportAdapter.mjs';

const exported = normalizeNk1HmxExport({
  source_lineage_id: 'hexis-export-alias-regression',
  sections: {
    memories: [
      { id: 'shared-alias', content: 'The first memory owns a colliding alias.' },
      { id: 'target-memory', name: 'shared-alias', content: 'The second memory also exposes that alias as a name.' },
      { id: 'unique-source', content: 'A uniquely addressable source.' },
      { id: 'unique-target', content: 'A uniquely addressable target.' },
    ],
    relationships: [
      { source_ref: 'shared-alias', target_ref: 'target-memory', edge_type: 'supports' },
      { source_ref: 'unique-source', target_ref: 'unique-target', edge_type: 'supports' },
    ],
  },
});

const memories = exported.sections.memories;
const relationships = exported.sections.relationships;
const memoryByIdentity = identity => memories.find(
  memory => memory.metadata?.nk1NativeIdentity === identity,
);

const ambiguous = relationships.find(edge => edge.properties?.nk1NativeIndex === 0);
assert(ambiguous, 'ambiguous-source relationship must be retained for review');
assert.equal(
  ambiguous.source_ref,
  exported.export_id + ':ref-shared-alias',
  'ambiguous aliases must remain unresolved, not point to the last matching record',
);
assert.notEqual(ambiguous.source_ref, memoryByIdentity('shared-alias')?.ref);
assert.notEqual(ambiguous.source_ref, memoryByIdentity('target-memory')?.ref);
assert.equal(
  ambiguous.target_ref,
  memoryByIdentity('target-memory')?.ref,
  'unambiguous native ids must still resolve normally',
);
assert(
  exported.export_warnings.some(warning => /ambiguous native reference alias/i.test(warning)),
  'the export must report alias ambiguity without leaking the alias value',
);

const unique = relationships.find(edge => edge.properties?.nk1NativeIndex === 1);
assert(unique, 'unique relationship must be preserved');
assert.equal(unique.source_ref, memoryByIdentity('unique-source')?.ref);
assert.equal(unique.target_ref, memoryByIdentity('unique-target')?.ref);

console.log('Hexis export adapter alias tests: PASS');
