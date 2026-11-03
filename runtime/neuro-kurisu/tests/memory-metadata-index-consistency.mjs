import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// The metadata postings index (tags/entities/allowed context keys) must stay in
// lockstep with the canonical rows. indexDiagnostics() rebuilds the expected
// index from the rows, so it is an independent oracle: any in-place metadata
// edit that forgets to refresh postings shows up as a mismatch. Such a stale
// index silently makes recall match an old topic and miss the new one.

const memory = new MemoryOS2({ embeddingProvider: null, metadataRecallEnabled: true });

// updateContext rewrites context, a metadata source.
const contextual = memory.encode({ content: 'a short note with distinct filler words', kind: 'semantic', source: 'metadata-index', context: { topic: 'alphatopic' } }).id;
assert.equal(memory.indexDiagnostics().metadataIndexMismatch, 0, 'index coherent after encode');
assert.ok(memory.retrieve('alphatopic', 5).some((item) => item.id === contextual), 'the topic is recallable after encode');
memory.updateContext(contextual, { topic: 'betatopic' });
assert.equal(memory.indexDiagnostics().metadataIndexMismatch, 0, 'updateContext must refresh metadata postings');
assert.ok(!memory.retrieve('alphatopic', 5).some((item) => item.id === contextual), 'the replaced topic must stop matching');
assert.ok(memory.retrieve('betatopic', 5).some((item) => item.id === contextual), 'the new topic must become recallable');

// The dedup-merge path merges tags into an existing record.
const tagged = memory.encode({ content: 'another record sharing this exact body text', kind: 'semantic', source: 'metadata-index', tags: ['zebraword'] }).id;
memory.encode({ content: 'another record sharing this exact body text', kind: 'semantic', source: 'metadata-index', tags: ['quokkaword'] });
assert.equal(memory.indexDiagnostics().metadataIndexMismatch, 0, 'dedup merge must refresh metadata postings');
assert.ok(memory.retrieve('zebraword', 5).some((item) => item.id === tagged), 'merged tag stays recallable');
assert.ok(memory.retrieve('quokkaword', 5).some((item) => item.id === tagged), 'new merged tag becomes recallable');

// Removal and restore must keep the derived index coherent too.
const removable = memory.encode({ content: 'a disposable note about marginal details', kind: 'episodic', source: 'metadata-index', context: { topic: 'temporary' } }).id;
assert.ok(memory.forgetById(removable, 'metadata-index-test'));
assert.equal(memory.indexDiagnostics().metadataIndexMismatch, 0, 'forget must clear metadata postings');
const restored = new MemoryOS2({ embeddingProvider: null, metadataRecallEnabled: true });
restored.restore(structuredClone(memory.snapshot()));
assert.equal(restored.indexDiagnostics().metadataIndexMismatch, 0, 'restore must rebuild metadata postings');

assert.equal(memory.indexDiagnostics().pass, true, 'all indexes stay coherent through metadata edits');
console.log('MEMORY_METADATA_INDEX_CONSISTENCY=PASS', JSON.stringify({ mismatch: memory.indexDiagnostics().metadataIndexMismatch, vocabulary: memory.indexDiagnostics().metadataTokenVocabulary }));
