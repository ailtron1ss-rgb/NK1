import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'contracts/UPSTREAM_SOURCE_ARCHIVE_REVIEW_2026-11-03.json'), 'utf8'));
assert.equal(manifest.schema, 'nk1.upstream-source-archive-review.v1');
assert.equal(manifest.containers.length, 4);
assert.equal(manifest.archives.length, 22);
assert.equal(manifest.summary.uniqueInnerProjects, 21);
assert.equal(manifest.summary.duplicateInnerZipArtifacts, 1);
assert.equal(manifest.containers.reduce((sum, item) => sum + item.members.length, 0), 22,
  'every inner archive must be assigned to exactly one outer container');
assert.equal(new Set(manifest.archives.map(item => item.sha256)).size, 21,
  'the two Letta entries are the only exact inner-archive duplicate');
for (const container of manifest.containers) {
  assert.match(container.sha256, /^[a-f0-9]{64}$/, 'outer container must have a SHA-256 digest');
  assert.ok(container.members.length > 0, 'every outer container must contain indexed archives');
  assert.equal(new Set(container.members).size, container.members.length,
    'an outer container cannot list an inner archive twice');
}
const containerNames = new Set(manifest.containers.map(x => x.file));
const byName = new Map();
for (const row of manifest.archives) {
  assert.ok(containerNames.has(row.container), 'archive must refer to a declared outer container');
  assert.match(row.sha256, /^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(row.bytes) && row.bytes > 0);
  assert.ok(Number.isSafeInteger(row.members) && row.members > 0);
  assert.ok(row.licenseEvidence && row.licenseStatus && row.disposition && row.decision);
  assert.equal(row.codeCopied, undefined, 'inventory entries must not claim code import');
  assert.notEqual(row.licenseStatus, 'human-approved', 'archive scan is not human license approval');
  byName.set(row.file, row);
}
assert.equal(byName.size, 22, 'archive filenames must be unique inside the four containers');
const lettaA = byName.get('letta-main.zip');
const lettaB = byName.get('letta-main (1).zip');
assert.ok(lettaA && lettaB);
assert.equal(lettaA.sha256, lettaB.sha256);
assert.equal(lettaA.members, 16);
assert.equal(lettaB.members, 16);
assert.equal(lettaA.duplicateOf, 'letta-main (1).zip');
assert.equal(lettaB.duplicateOf, 'letta-main.zip');
assert.equal(byName.get('will-main.zip').sha256, '9d0c30277f0981b67104b1e2a07d9c7f025fee60ae57bd470cca898cf0d457a4');
assert.equal(byName.get('lumina-main.zip').sha256, 'a820cb1b394018451c8ee5863ae0a1f74666bd10519007d6e37e69e42452d467');
assert.equal(byName.get('owl-main.zip').licenseStatus, 'unresolved-no-copy');
assert.equal(byName.get('autogen-main.zip').disposition, 'research-reference-only');
assert.equal(byName.get('AutoGPT-master.zip').disposition, 'reference-only-no-platform-copy');
assert.equal(manifest.summary.codeCopiedByThisReview, 0);
assert.equal(manifest.summary.dependenciesInstalled, 0);
console.log('NK1_SOURCE_ARCHIVE_REVIEW=PASS archives=22 unique=21 duplicates=1');
