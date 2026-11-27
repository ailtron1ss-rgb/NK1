import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { NekoExternalMarkdownMemoryAdapter } from '../src/organism/integration/neko/NekoExternalMarkdownMemoryAdapter.ts';

const runtime = new MemorySubsystemRuntime();
const adapter = new NekoExternalMarkdownMemoryAdapter({ memory: runtime.fabric });
const files = [{
  path: 'openclaw-main/skills/github/SKILL.md',
  content: [
    '---',
    'name: github',
    'description: Use the GitHub CLI for repository issues and pull requests.',
    'metadata:',
    '  openclaw:',
    '    requires:',
    '      bins:',
    '        - gh',
    '---',
    '',
    '# GitHub skill',
    '',
    'Use the gh command to inspect repositories and pull requests.',
  ].join(String.fromCharCode(10)),
}];

const before = runtime.fabric.canonicalSize();
const preview = adapter.preview(files);

assert.equal(preview.sourceFormat, 'openclaw');
assert.ok(preview.candidates.length > 0);
assert.ok(preview.candidates.every(row => row.sourceKind === 'skill'));
assert.ok(preview.candidates.every(row => row.memoryKind === 'semantic'));
assert.ok(preview.candidates.every(row => row.target === 'facts'));
assert.ok(preview.candidates.every(row => row.epistemicStatus === 'unknown'));
assert.ok(preview.candidates.every(row => row.reviewStatus === 'quarantined'));
assert.ok(preview.candidates.every(row => row.warningPatterns.includes('skill-content-requires-manual-review')));
assert.equal(runtime.fabric.canonicalSize(), before, 'preview must not write imported skills to canonical memory');

const candidateIds = preview.candidates.map(row => row.id);
const denied = adapter.commit(preview.importId, candidateIds);
assert.equal(denied.committed.length, 0, 'skill content must not enter memory without explicit human review');
assert.equal(denied.rejected.length, candidateIds.length);
assert.ok(denied.rejected.every(row => row.code === 'suspicious-candidate-requires-explicit-override'));
assert.equal(runtime.fabric.canonicalSize(), before);

const approved = adapter.commit(preview.importId, candidateIds, { allowSuspiciousIds: candidateIds, tick: 7 });
assert.equal(approved.committed.length, candidateIds.length);
assert.equal(approved.rejected.length, 0);

for (const receipt of approved.committed) {
  const stored = runtime.fabric.canonicalSnapshot().items.find(row => row.id === receipt.memoryId);
  assert.ok(stored);
  assert.equal(stored.epistemicStatus, 'unknown');
  assert.equal(stored.provenanceClass, 'external');
  assert.equal(stored.source, 'neko-markdown-import:skill');
  assert.ok(stored.tags.includes('external-import'));
  assert.ok(stored.tags.includes('unverified-import'));
  assert.equal(stored.context.externalImport, 'neko-markdown');
  assert.equal(stored.context.sourceKind, 'skill');
  assert.equal(stored.context.target, 'facts');
  assert.equal(stored.context.actionAuthority, undefined, 'imported skill text must not acquire tool authority');
}

console.log('OpenClaw SKILL.md memory import: PASS (preview quarantined; explicit review required; no execution authority)');
