import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = path.resolve(testDir, '..');
const builder = path.join(runtimeDir, 'scripts/build-bilingual-holdout-from-wikipedia.mjs');
const fixture = path.join(testDir, 'fixtures/mock-wikipedia-summary-fetch.mjs');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nk1-wikipedia-holdout-provenance-'));

function buildFixture(revision, suffix) {
  const output = path.join(tempDir, `dataset-${suffix}.json`);
  const result = spawnSync(process.execPath, [
    '--import', fixture,
    '--experimental-strip-types',
    builder,
    '--topics', '2',
    '--throttle-ms', '0',
    '--out', output,
  ], {
    cwd: runtimeDir,
    encoding: 'utf8',
    env: { ...process.env, NK1_WIKI_FIXTURE_REVISION: String(revision) },
  });
  assert.equal(result.status, 0, `builder failed:\n${result.stdout}\n${result.stderr}`);
  return {
    raw: fs.readFileSync(output, 'utf8'),
    dataset: JSON.parse(fs.readFileSync(output, 'utf8')),
  };
}

try {
  const first = buildFixture(1000, 'first');
  const repeated = buildFixture(1000, 'repeated');
  const changedRevision = buildFixture(2000, 'changed-revision');

  assert.equal(first.raw, repeated.raw, 'same upstream revisions must produce byte-identical datasets');
  const provenance = first.dataset.provenance;
  assert.equal(provenance.manifestAlgorithm, 'sha256-json-v1');
  assert.match(provenance.sourceManifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    provenance.sourceManifestSha256,
    createHash('sha256').update(JSON.stringify(provenance.sourcePages), 'utf8').digest('hex'),
  );
  assert.equal(
    provenance.datasetVersion,
    `wikipedia-rest-v1-${provenance.sourceManifestSha256.slice(0, 16)}`,
  );
  assert.equal(provenance.sourcePages.length, 4, 'two topics require both language source pages');
  assert.equal(first.dataset.snapshot.items.length, 2, 'one single-language memory is admitted per topic');
  assert.notEqual(
    provenance.sourceManifestSha256,
    changedRevision.dataset.provenance.sourceManifestSha256,
    'a changed upstream revision must change the source manifest',
  );
  assert.notEqual(
    provenance.datasetVersion,
    changedRevision.dataset.provenance.datasetVersion,
    'a changed upstream revision must change the dataset version',
  );

  const memoryIds = new Set(first.dataset.snapshot.items.map((item) => item.id));
  const groups = new Map();
  for (const page of provenance.sourcePages) {
    assert.match(page.contentSha256, /^[a-f0-9]{64}$/);
    assert.ok(page.revision, 'each source page must retain its upstream revision');
    assert.ok(page.pageId > 0, 'each source page must retain its page ID');
    assert.ok(page.canonicalUrl?.startsWith(`https://${page.language}.wikipedia.org/wiki/`));
    const group = groups.get(page.topicId) ?? [];
    group.push(page);
    groups.set(page.topicId, group);
  }
  assert.equal(groups.size, 2);
  for (const group of groups.values()) {
    assert.deepEqual(new Set(group.map((page) => page.language)), new Set(['en', 'ru']));
    const selected = group.filter((page) => page.usedAsMemory);
    assert.equal(selected.length, 1);
    assert.ok(memoryIds.has(selected[0].memoryId));
    assert.equal(group.filter((page) => !page.usedAsMemory && page.memoryId === null).length, 1);
  }

  console.log(JSON.stringify({
    ok: true,
    topics: groups.size,
    sourcePages: provenance.sourcePages.length,
    memoryRows: first.dataset.snapshot.items.length,
    deterministic: true,
    revisionSensitive: true,
    manifestSha256: provenance.sourceManifestSha256,
  }));
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
