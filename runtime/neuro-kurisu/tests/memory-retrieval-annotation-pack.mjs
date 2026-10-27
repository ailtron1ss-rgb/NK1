import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { runMemoryOS2RetrievalBenchmark } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/memory-retrieval-annotation-pack.mjs');
const temp = await mkdtemp(path.join(os.tmpdir(), 'nk1-memory-annotation-'));
const run = args => spawnSync(process.execPath, ['--experimental-strip-types', script, ...args], {
  cwd: root, encoding: 'utf8', timeout: 120000,
});
const writeJsonl = (file, rows) => writeFile(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
try {
  const memory = new MemoryOS2();
  const now = Date.now();
  for (let i = 0; i < 8; i++) memory.encode({
    content: 'frozen annotation corpus document ' + i + ' with topic anchor ' + (i % 3),
    kind: 'semantic', source: 'annotation-fixture', tags: ['test'], context: { area: 'fixture' },
    salience: .7, emotionalWeight: .1, identityRelevance: .1, goalRelevance: .1,
    socialRelevance: .1, predictionError: .1, confidence: .9, epistemicStatus: 'fact',
    entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
    validFromAt: now - 60000, observedAt: now - 60000, provenanceClass: 'external', sourceAuthority01: .9,
  }, { clone: false });
  const snapshot = JSON.parse(JSON.stringify(memory.snapshot()));
  const snapshotPath = path.join(temp, 'snapshot.json');
  const queriesPath = path.join(temp, 'queries.jsonl');
  const packPath = path.join(temp, 'pack');
  const annotationsPath = path.join(temp, 'annotations.jsonl');
  const provenancePath = path.join(temp, 'source-provenance.json');
  const outPath = path.join(temp, 'finalized');
  await writeFile(snapshotPath, JSON.stringify(snapshot));
  const queries = [];
  for (const language of ['en', 'ru']) {
    for (let i = 0; i < 2; i++) queries.push({
      id: 'q-' + language + '-train-' + i, query: 'q-' + language + '-train-' + i, split: 'train', language,
    });
    for (let i = 0; i < 10; i++) queries.push({
      id: 'q-' + language + '-holdout-' + i, query: 'q-' + language + '-holdout-' + i, split: 'holdout', language,
    });
  }
  await writeJsonl(queriesPath, queries);
  const prepared = run(['prepare', '--snapshot', snapshotPath, '--queries', queriesPath, '--outdir', packPath, '--include-content']);
  assert.equal(prepared.status, 0, 'prepare failed: ' + prepared.stderr + prepared.stdout);
  const packManifest = JSON.parse(await readFile(path.join(packPath, 'manifest.json'), 'utf8'));
  const catalog = (await readFile(path.join(packPath, 'corpus-catalog.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  const queue = (await readFile(path.join(packPath, 'annotation-queue.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(packManifest.corpus.corpusFingerprint.length, 64);
  assert.equal(packManifest.corpus.itemCount, snapshot.items.length);
  assert.equal(packManifest.privacy.privateCorpusTextIncluded, true);
  assert.equal(catalog.length, snapshot.items.length);
  assert.equal(catalog.every(row => typeof row.content === 'string' && row.contentSha256.length === 64), true);
  assert.equal(queue.length, queries.length);
  assert.equal(queue.every(row => row.answerable === null && row.relevantIds.length === 0), true,
    'preparation must not fabricate annotation labels');

  const answerRows = queue.map(row => {
    const noAnswer = row.split === 'holdout' && Number(row.id.split('-').at(-1)) >= 8;
    return {
      ...row,
      answerable: !noAnswer,
      relevantIds: noAnswer ? [] : [catalog[0].id],
      annotatorId: row.language === 'en' ? 'reviewer-en' : 'reviewer-ru',
      reviewedAt: '2026-10-27T12:00:00.000Z',
      notes: 'Synthetic test fixture only; not external evidence.',
    };
  });
  await writeJsonl(annotationsPath, answerRows);
  await writeFile(provenancePath, JSON.stringify({
    datasetId: 'nk1-test-annotation-pipeline', datasetVersion: '1',
    sourceRef: 'repo:test-fixture', labelingProtocol: 'Test fixture; manually populated by automated regression only.',
    licenseId: 'LicenseRef-NK1-Test-Fixture',
  }));
  const finalized = run([
    'finalize', '--pack', packPath, '--annotations', annotationsPath,
    '--provenance', provenancePath, '--outdir', outPath,
  ]);
  assert.equal(finalized.status, 0, 'finalize failed: ' + finalized.stderr + finalized.stdout);
  const finalManifest = JSON.parse(await readFile(path.join(outPath, 'finalization-manifest.json'), 'utf8'));
  const labels = (await readFile(path.join(outPath, 'labels.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  const provenance = JSON.parse(await readFile(path.join(outPath, 'dataset-provenance.json'), 'utf8'));
  assert.equal(finalManifest.annotations.rows, 24);
  assert.equal(finalManifest.annotations.reviewerCount, 2);
  assert.equal(finalManifest.status, 'ready-for-offline-benchmark-only-not-promotion');
  assert.equal(provenance.contentSha256, finalManifest.datasetFingerprint);
  assert.equal(labels.every(row => !Object.hasOwn(row, 'annotatorId') && !Object.hasOwn(row, 'notes')), true);

  const benchmark = runMemoryOS2RetrievalBenchmark(snapshot, labels, {
    now: now + 1000, k: 3, minHoldoutQueries: 8, bootstrapSamples: 200,
    datasetProvenance: provenance, maxExamples: 64,
  });
  assert.equal(finalManifest.datasetFingerprint, benchmark.datasetFingerprint,
    'finalizer hash must match MemoryRetrievalBenchmark canonical dataset fingerprint');
  assert.equal(packManifest.corpus.corpusFingerprint, benchmark.corpusFingerprint,
    'annotation pack corpus hash must match the actual benchmark corpus fingerprint');

  const invalidPath = path.join(temp, 'invalid-annotations.jsonl');
  const invalidOut = path.join(temp, 'invalid-finalized');
  const invalidRows = answerRows.map(row => ({ ...row }));
  invalidRows.find(row => row.answerable).relevantIds = ['not-in-corpus'];
  await writeJsonl(invalidPath, invalidRows);
  const invalid = run([
    'finalize', '--pack', packPath, '--annotations', invalidPath,
    '--provenance', provenancePath, '--outdir', invalidOut,
  ]);
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /annotations-unknown-memory-id/);
  await assert.rejects(readFile(path.join(invalidOut, 'labels.jsonl')), { code: 'ENOENT' });

  const duplicateQueriesPath = path.join(temp, 'duplicate-queries.jsonl');
  await writeJsonl(duplicateQueriesPath, [...queries, { ...queries[0], id: 'different-id' }]);
  const duplicatePack = run([
    'prepare', '--snapshot', snapshotPath, '--queries', duplicateQueriesPath,
    '--outdir', path.join(temp, 'duplicate-pack'),
  ]);
  assert.equal(duplicatePack.status, 2);
  assert.match(duplicatePack.stderr, /queries-duplicate-normalized-query/);

  const overwrite = run(['prepare', '--snapshot', snapshotPath, '--queries', queriesPath, '--outdir', packPath]);
  assert.equal(overwrite.status, 2, 'pack generation must not clobber an existing annotation pack');
  assert.match(overwrite.stderr, /output-directory-already-exists/);

  console.log(JSON.stringify({
    pass: true,
    checks: [
      'corpus fingerprint parity with retrieval benchmark',
      'deterministic query fingerprint and private local catalog',
      'unlabelled template does not manufacture ground truth',
      'human annotations finalize only with bounded bilingual evidence',
      'dataset fingerprint parity with retrieval benchmark',
      'unknown relevant IDs fail closed',
      'duplicate normalized queries fail before annotation',
      'output directory cannot be overwritten',
    ],
    rows: labels.length,
    datasetFingerprint: finalManifest.datasetFingerprint,
    corpusFingerprint: finalManifest.sourcePack.corpusFingerprint,
  }, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
