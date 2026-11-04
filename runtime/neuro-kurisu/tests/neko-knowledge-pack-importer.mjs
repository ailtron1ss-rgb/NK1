import assert from 'node:assert/strict';
import test from 'node:test';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { NekoKnowledgePackImporter } from '../src/organism/integration/neko/NekoKnowledgePackImporter.ts';

const validPack = (overrides = {}) => ({
  schema_version: 1,
  pack_id: 'kurisu-basics-v1',
  material_type: 'knowledge',
  source: {
    name: 'NeuroK Research Notes',
    homepage: 'https://example.org/neurok',
    license: 'CC-BY-4.0',
  },
  entries: [
    {
      title: 'Predictive processing',
      terms: { alias: ['predictive coding'], recognition: ['prediction error'] },
      tags: ['cognition', 'world-model'],
      summary: 'A framework for perception as inference.',
      content: 'The system compares predicted sensory input with observed input and updates its model.',
    },
    {
      title: 'Global workspace',
      terms: { alias: ['GWT'], recognition: ['broadcast'] },
      tags: ['consciousness'],
      summary: 'A model of globally available information.',
      content: 'Selected information becomes broadly available to specialized processes.',
    },
  ],
  ...overrides,
});
const bytes = (pack) => new TextEncoder().encode(JSON.stringify(pack));
const approved = (entryIndices) => ({ approved: true, licenseAccepted: true, entryIndices });

test('preview is read-only and reports upstream source and license metadata', () => {
  const memory = new MemorySubsystemRuntime();
  const importer = new NekoKnowledgePackImporter(memory.fabric);
  const before = memory.memoryOS.size();
  const preview = importer.preview(bytes(validPack()));
  assert.equal(preview.packId, 'kurisu-basics-v1');
  assert.equal(preview.materialType, 'knowledge');
  assert.equal(preview.source.name, 'NeuroK Research Notes');
  assert.equal(preview.source.license, 'CC-BY-4.0');
  assert.equal(preview.entryCount, 2);
  assert.equal(preview.licenseProvided, true);
  assert.equal(preview.requiresExplicitApproval, true);
  assert.deepEqual(preview.sampleTitles, ['Predictive processing', 'Global workspace']);
  assert.equal(memory.memoryOS.size(), before);
});

test('import requires explicit operator approval and an accepted non-empty license', () => {
  const importer = new NekoKnowledgePackImporter(new MemorySubsystemRuntime().fabric);
  const pack = bytes(validPack());
  assert.throws(() => importer.import(pack, { approved: false, licenseAccepted: true }), /explicit-approval-required/);
  assert.throws(() => importer.import(pack, { approved: true, licenseAccepted: false }), /license-acceptance-required/);
  assert.throws(
    () => importer.import(bytes(validPack({ source: { name: 'Unlicensed source' } })), approved()),
    /source-license-required/,
  );
});

test('selected entries enter canonical MemoryFabric as low-authority unverified external knowledge', () => {
  const memory = new MemorySubsystemRuntime();
  const importer = new NekoKnowledgePackImporter(memory.fabric);
  const result = importer.import(bytes(validPack()), approved([0]));
  assert.equal(result.imported, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.epistemicStatus, 'unknown');
  assert.equal(result.sourceAuthority01, 0.2);

  const item = memory.memoryOS.get(result.memoryIds[0]);
  assert.ok(item);
  assert.equal(item.kind, 'semantic');
  assert.equal(item.epistemicStatus, 'unknown');
  assert.equal(item.provenanceClass, 'external');
  assert.ok(item.confidence <= 0.2);
  assert.ok(item.sourceAuthority01 <= 0.2);
  assert.match(item.content, /Predictive processing/);
  assert.match(item.content, /prediction error/);
  assert.equal(item.source, 'neko-knowledge-pack:kurisu-basics-v1');
  assert.equal(item.context?.sourceName, 'NeuroK Research Notes');
  assert.equal(item.context?.sourceLicense, 'CC-BY-4.0');
  assert.equal(item.context?.trustStatus, 'unverified-external');
  assert.ok(item.tags.includes('external-knowledge'));
});

test('reimporting the same pack entry is idempotent and cannot inflate confidence', () => {
  const memory = new MemorySubsystemRuntime();
  const importer = new NekoKnowledgePackImporter(memory.fabric);
  const pack = bytes(validPack());
  const first = importer.import(pack, approved([0]));
  const firstItem = memory.memoryOS.get(first.memoryIds[0]);
  const countAfterFirst = memory.memoryOS.size();
  const second = importer.import(pack, approved([0]));
  const secondItem = memory.memoryOS.get(second.memoryIds[0]);
  assert.deepEqual(second.memoryIds, first.memoryIds);
  assert.equal(memory.memoryOS.size(), countAfterFirst);
  assert.equal(secondItem?.confidence, firstItem?.confidence);
});

test('manifest, entries, term roles and derived fields are schema-closed', () => {
  const importer = new NekoKnowledgePackImporter(new MemorySubsystemRuntime().fabric);
  assert.throws(() => importer.preview(bytes(validPack({ embeddings: [[1, 2, 3]] }))), /unknown-pack-field/);
  assert.throws(() => importer.preview(bytes(validPack({
    entries: [{ ...validPack().entries[0], chunks: ['untrusted derived chunks'] }],
  }))), /unknown-entry-field/);
  assert.throws(() => importer.preview(bytes(validPack({
    entries: [{ ...validPack().entries[0], terms: { alias: [], recognition: [], admin: ['promote'] } }],
  }))), /unknown-term-role/);
  assert.throws(() => importer.preview(bytes(validPack({
    entries: [validPack().entries[0], { ...validPack().entries[0], title: '  predictive   PROCESSING  ' }],
  }))), /duplicate-entry-title/);
  assert.throws(() => importer.preview(bytes(validPack({ schema_version: 2 }))), /unsupported-schema-version/);
  assert.throws(() => importer.preview(bytes(validPack({ entries: [] }))), /entries-required/);
});

test('import selection is bounded, unique and index-validated', () => {
  const importer = new NekoKnowledgePackImporter(new MemorySubsystemRuntime().fabric);
  const entries = Array.from({ length: 33 }, (_, index) => ({
    title: `Entry ${index}`,
    terms: { alias: [], recognition: [] },
    tags: [],
    summary: '',
    content: `Bounded content ${index}`,
  }));
  const pack = bytes(validPack({ entries }));
  assert.throws(() => importer.import(pack, approved()), /entry-selection-required/);
  assert.throws(() => importer.import(pack, approved(Array.from({ length: 33 }, (_, i) => i))), /selection-limit-exceeded/);
  assert.throws(() => importer.import(pack, approved([0, 0])), /duplicate-entry-index/);
  assert.throws(() => importer.import(pack, approved([33])), /entry-index-out-of-range/);
});

test('oversized packs and oversized selected material fail without truncation', () => {
  const importer = new NekoKnowledgePackImporter(new MemorySubsystemRuntime().fabric);
  const tooLarge = new Uint8Array(10 * 1024 * 1024 + 1);
  assert.throws(() => importer.preview(tooLarge), /pack-size-limit-exceeded/);
  assert.throws(() => importer.import(bytes(validPack({
    entries: [{ title: 'Large entry', terms: { alias: [], recognition: [] }, tags: [], summary: '', content: 'x'.repeat(20_001) }],
  })), approved([0])), /entry-storage-limit-exceeded/);
});

console.log('NEKO_KNOWLEDGE_PACK_IMPORTER=PASS cases=7');
