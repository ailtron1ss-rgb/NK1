import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fingerprintMemoryRetrievalDataset } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';
import { parseMemoryRetrievalLabels } from '../scripts/run-memory-retrieval-experiment.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(runtimeRoot, 'scripts/fingerprint-memory-retrieval-dataset.mjs');
const rows = [
  { id: 'train-1', query: 'Where did I leave the red notebook?', relevantIds: ['memory-red-notebook', 'memory-red-notebook-context'], split: 'train' },
  { id: 'holdout-1', query: 'Quelle est ma préférence pour le thé ?', relevantIds: ['memory-tea-preference'], split: 'holdout' },
  { id: 'holdout-2', query: 'Which language did I ask to practice?', relevantIds: ['memory-language-practice'], split: 'holdout' },
  { id: 'holdout-3', query: 'What time do I usually go running?', relevantIds: ['memory-running-time'], split: 'holdout' },
  { id: 'holdout-unanswerable', query: 'What is the serial number of an unseen device?', relevantIds: [], split: 'holdout', answerable: false },
];
const source = rows.map(row => JSON.stringify(row)).join('\n') + '\n';
const parsed = parseMemoryRetrievalLabels(source);
const expectedCanonical = fingerprintMemoryRetrievalDataset(parsed);
const expectedRaw = createHash('sha256').update(source, 'utf8').digest('hex');
const temp = await mkdtemp(path.join(os.tmpdir(), 'nk1-memory-dataset-fingerprint-'));
try {
  const labelsPath = path.join(temp, 'labels.jsonl');
  await writeFile(labelsPath, source, 'utf8');
  const run = spawnSync(process.execPath, ['--experimental-strip-types', cliPath, '--labels', labelsPath], {
    cwd: runtimeRoot, encoding: 'utf8', timeout: 120000,
  });
  assert.equal(run.status, 0, `fingerprint CLI failed: ${run.stderr || run.stdout}`);
  const report = JSON.parse(run.stdout);
  assert.equal(report.datasetFingerprint, expectedCanonical);
  assert.equal(report.contentSha256, expectedCanonical, 'contentSha256 must be directly usable in benchmark provenance');
  assert.equal(report.rawSourceSha256, expectedRaw, 'raw hash must pin exact source bytes');
  assert.equal(report.trainQueries, 1);
  assert.equal(report.holdoutQueries, 4);
  assert.equal(report.answerableHoldoutQueries, 3);
  assert.equal(report.unanswerableHoldoutQueries, 1);
  assert.equal(report.provenanceTemplate.contentSha256, expectedCanonical);
  assert.equal(report.provenanceTemplate.rawSourceSha256, expectedRaw);

  // Canonical labels are stable under row order, query case/whitespace and relevant-ID order,
  // while the raw-source hash is intentionally different for a different serialized file.
  const reordered = [
    { ...rows[4] },
    { ...rows[3], query: '  WHAT TIME DO I USUALLY GO RUNNING?  ' },
    { ...rows[2] },
    { ...rows[1], query: 'QUELLE EST MA PRÉFÉRENCE POUR LE THÉ ?' },
    { ...rows[0], relevantIds: ['memory-red-notebook-context', 'memory-red-notebook'] },
  ];
  const alternateSource = reordered.map(row => JSON.stringify(row)).join('\n') + '\n';
  const alternatePath = path.join(temp, 'labels-reordered.jsonl');
  await writeFile(alternatePath, alternateSource, 'utf8');
  const alternate = spawnSync(process.execPath, ['--experimental-strip-types', cliPath, '--labels', alternatePath], {
    cwd: runtimeRoot, encoding: 'utf8', timeout: 120000,
  });
  assert.equal(alternate.status, 0, `reordered fingerprint CLI failed: ${alternate.stderr || alternate.stdout}`);
  const alternateReport = JSON.parse(alternate.stdout);
  assert.equal(alternateReport.contentSha256, expectedCanonical, 'canonical dataset hash must not depend on harmless serialization order');
  assert.notEqual(alternateReport.rawSourceSha256, expectedRaw, 'raw byte hash must distinguish serialized artifacts');

  const invalidPath = path.join(temp, 'invalid.jsonl');
  await writeFile(invalidPath, '{this is not valid JSON}\n', 'utf8');
  const invalid = spawnSync(process.execPath, ['--experimental-strip-types', cliPath, '--labels', invalidPath], {
    cwd: runtimeRoot, encoding: 'utf8', timeout: 120000,
  });
  assert.notEqual(invalid.status, 0, 'invalid label data must fail closed');
  assert.match(invalid.stderr, /labels-invalid-json-line:1/);
  console.log('MEMORY_RETRIEVAL_DATASET_FINGERPRINT=PASS', JSON.stringify({
    exampleCount: report.exampleCount,
    trainQueries: report.trainQueries,
    holdoutQueries: report.holdoutQueries,
    canonicalStableUnderReordering: alternateReport.contentSha256 === expectedCanonical,
    rawHashBindsSerialization: alternateReport.rawSourceSha256 !== expectedRaw,
  }));
} finally {
  await rm(temp, { recursive: true, force: true });
}
