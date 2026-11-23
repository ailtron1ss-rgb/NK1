#!/usr/bin/env node
/**
 * Produce reproducible provenance hashes for a labelled MemoryOS2 retrieval dataset.
 * The canonical hash is the value required by datasetProvenance.contentSha256.
 * The raw hash binds the exact UTF-8 source file and can be supplied as rawSourceSha256.
 */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseMemoryRetrievalLabels } from './run-memory-retrieval-experiment.mjs';
import { fingerprintMemoryRetrievalDataset } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';

const MAX_LABEL_BYTES = 4 * 1024 * 1024;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help' || key === '-h') return { help: true };
    if (key !== '--labels' || args.labels !== undefined) throw new Error(`unexpected-argument-or-duplicate:${key}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error('labels-path-required');
    args.labels = value;
  }
  if (!args.labels && !args.help) throw new Error('required-argument-missing:--labels');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node --experimental-strip-types scripts/fingerprint-memory-retrieval-dataset.mjs --labels <labels.jsonl>');
    return;
  }
  const absolute = path.resolve(args.labels);
  const metadata = await stat(absolute);
  if (!metadata.isFile()) throw new Error('labels-not-a-file');
  if (metadata.size > MAX_LABEL_BYTES) throw new Error(`labels-too-large:${metadata.size}>${MAX_LABEL_BYTES}`);
  const bytes = await readFile(absolute);
  let source;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('labels-invalid-utf8'); }
  const examples = parseMemoryRetrievalLabels(source);
  const contentSha256 = fingerprintMemoryRetrievalDataset(examples);
  const rawSourceSha256 = createHash('sha256').update(bytes).digest('hex');
  const holdout = examples.filter(row => row.split === 'holdout');
  const report = {
    schemaVersion: 1,
    algorithm: 'memoryos2-retrieval-labelled-dataset-canonical-v1',
    datasetFingerprint: contentSha256,
    contentSha256,
    rawSourceSha256,
    exampleCount: examples.length,
    trainQueries: examples.filter(row => row.split === 'train').length,
    holdoutQueries: holdout.length,
    answerableHoldoutQueries: holdout.filter(row => row.answerable !== false).length,
    unanswerableHoldoutQueries: holdout.filter(row => row.answerable === false).length,
    provenanceTemplate: {
      datasetId: 'replace-with-stable-dataset-id',
      datasetVersion: 'replace-with-immutable-version-or-commit',
      sourceRef: 'replace-with-repository-path-or-archive-reference',
      labelingProtocol: 'describe how labels were assigned and reviewed',
      licenseId: 'replace-with-verified-SPDX-or-LicenseRef',
      contentSha256,
      rawSourceSha256,
    },
    note: 'Fingerprinting does not establish label quality or independence. Freeze the file and provenance in version control; use independent holdout labels and a separate review before any promotion.',
  };
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`MEMORY_DATASET_FINGERPRINT_FAILED: ${String(error?.message ?? error)}`);
    process.exitCode = 2;
  });
}
