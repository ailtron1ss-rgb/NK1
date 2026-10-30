#!/usr/bin/env node
import { readFile, stat, open, link, unlink, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runMemoryOS2RetrievalExperiment } from '../src/organism/memory/MemoryRetrievalExperiment.ts';

const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024;
const MAX_LABEL_BYTES = 4 * 1024 * 1024;
const MAX_PROVENANCE_BYTES = 32 * 1024;
const MAX_EXAMPLES = 512;

function usage() {
  return [
    'Usage:',
    '  node --experimental-strip-types scripts/run-memory-retrieval-experiment.mjs --snapshot <MemoryOSState2.json> --labels <labels.jsonl> --provenance <dataset-provenance.json> --out <report.json> [--seeds 11,29,47,71,101] [--k 5] [--now <unix-ms>]',
    '',
    'The label file is JSONL; optional explicit language labels are "en", "ru", or "other".',
    'Optional task categories: single-hop, multi-hop, multi-session, temporal, knowledge-update, contradiction, preference, procedural, open-domain, abstention, static-state, dynamic-state, workflow-knowledge, environment-gotcha, premise-awareness, other.',
    'A tagged benchmark requires all rows tagged and both en and ru for promotion; per-language holdout gates run separately.',
    'For multi-session tasks, provide an anonymized conversationId on every row; train/holdout must be split by conversation.',
    'Bootstrap confidence intervals resample whole conversationId clusters (or individual query IDs when ungrouped).',
    'For an explicitly unanswerable query, use "answerable":false with an empty relevantIds array; omitted answerable defaults to true.',
    'The snapshot must be the exported MemoryOSState2 object. The provenance file must contain datasetId, datasetVersion, sourceRef and labelingProtocol.',
    'This runs offline on a clone; it does not alter live memory or automatically promote a candidate.',
  ].join('\n');
}
function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help' || key === '-h') return { help: true };
    if (!key?.startsWith('--')) throw new Error(`unexpected-argument:${key}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`missing-value:${key}`);
    if (options[key.slice(2)] !== undefined) throw new Error(`duplicate-argument:${key}`);
    options[key.slice(2)] = value;
  }
  for (const name of ['snapshot', 'labels', 'provenance', 'out']) if (!options[name]) throw new Error(`required-argument-missing:--${name}`);
  return options;
}
async function readBounded(file, maxBytes, label) {
  const absolute = path.resolve(file);
  const meta = await stat(absolute);
  if (!meta.isFile()) throw new Error(`${label}-not-a-file:${absolute}`);
  if (meta.size > maxBytes) throw new Error(`${label}-too-large:${meta.size}>${maxBytes}`);
  return { absolute, text: await readFile(absolute, 'utf8') };
}
/**
 * Publish a report atomically without clobbering an existing result. The temporary
 * file lives beside the destination, is flushed before publication, and `link` is
 * an atomic no-overwrite operation on the same filesystem. On failure the temporary
 * file is removed, so interrupted writes do not leave a partial report at --out.
 */
async function publishReportExclusive(outputPath, contents) {
  const dir = path.dirname(outputPath);
  const base = path.basename(outputPath);
  await mkdir(dir, { recursive: true });
  const temporaryPath = path.join(dir, `.${base}.${process.pid}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(temporaryPath, outputPath);
    await unlink(temporaryPath);
  } catch (error) {
    try { await handle?.close(); } catch {}
    try { await unlink(temporaryPath); } catch {}
    throw error;
  }
}
function parseLabels(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith('#')) continue;
    let row;
    try { row = JSON.parse(line); }
    catch { throw new Error(`labels-invalid-json-line:${index + 1}`); }
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`labels-row-not-object:${index + 1}`);
    if (typeof row.id !== 'string' || !row.id.trim() || row.id.length > 120) throw new Error(`labels-invalid-id-line:${index + 1}`);
    if (typeof row.query !== 'string' || !row.query.trim() || row.query.length > 500) throw new Error(`labels-invalid-query-line:${index + 1}`);
    if (row.answerable !== undefined && typeof row.answerable !== 'boolean') throw new Error(`labels-invalid-answerable-line:${index + 1}`);
    if (row.language !== undefined && !['en', 'ru', 'other'].includes(row.language)) throw new Error(`labels-invalid-language-line:${index + 1}`);
    if (row.category !== undefined && !['single-hop', 'multi-hop', 'multi-session', 'temporal', 'knowledge-update', 'contradiction', 'preference', 'procedural', 'open-domain', 'abstention', 'static-state', 'dynamic-state', 'workflow-knowledge', 'environment-gotcha', 'premise-awareness', 'other'].includes(row.category)) throw new Error(`labels-invalid-category-line:${index + 1}`);
    if (row.conversationId !== undefined && (typeof row.conversationId !== 'string' || !row.conversationId.trim() || row.conversationId.length > 160)) throw new Error(`labels-invalid-conversationId-line:${index + 1}`);
    const answerable = row.answerable !== false;
    if (!Array.isArray(row.relevantIds) || row.relevantIds.length > 24 ||
        (answerable ? row.relevantIds.length < 1 : row.relevantIds.length !== 0) ||
        row.relevantIds.some(id => typeof id !== 'string' || !id.trim() || id.length > 160)) {
      throw new Error(`labels-invalid-relevantIds-line:${index + 1}`);
    }
    if (row.split !== 'train' && row.split !== 'holdout') throw new Error(`labels-invalid-split-line:${index + 1}`);
    rows.push({ id: row.id.trim(), query: row.query.trim(), relevantIds: row.relevantIds.map(id => id.trim()), split: row.split, answerable, ...(row.language === undefined ? {} : { language: row.language }), ...(row.category === undefined ? {} : { category: row.category }), ...(row.conversationId === undefined ? {} : { conversationId: row.conversationId.trim() }) });
    if (rows.length > MAX_EXAMPLES) throw new Error(`labels-exceed-limit:${MAX_EXAMPLES}`);
  }
  if (!rows.length) throw new Error('labels-empty');
  return rows;
}
function parseSeeds(value) {
  if (!value) return undefined;
  const seeds = value.split(',').map(x => x.trim()).filter(Boolean).map(Number);
  if (seeds.length < 3 || seeds.length > 9 || seeds.some(seed => !Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff)) throw new Error('seeds-must-be-3-to-9-uint32-values');
  if (new Set(seeds).size !== seeds.length) throw new Error('seeds-must-be-distinct');
  return seeds;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }
  const [snapshotFile, labelsFile, provenanceFile] = await Promise.all([
    readBounded(args.snapshot, MAX_SNAPSHOT_BYTES, 'snapshot'),
    readBounded(args.labels, MAX_LABEL_BYTES, 'labels'),
    readBounded(args.provenance, MAX_PROVENANCE_BYTES, 'provenance'),
  ]);
  let snapshot, provenance;
  try { snapshot = JSON.parse(snapshotFile.text); } catch { throw new Error('snapshot-invalid-json'); }
  try { provenance = JSON.parse(provenanceFile.text); } catch { throw new Error('provenance-invalid-json'); }
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.items)) throw new Error('snapshot-must-be-MemoryOSState2-with-items-array');
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) throw new Error('provenance-must-be-json-object');
  for (const key of ['datasetId', 'datasetVersion', 'sourceRef', 'labelingProtocol']) if (typeof provenance[key] !== 'string' || !provenance[key].trim()) throw new Error(`provenance-field-required:${key}`);
  const examples = parseLabels(labelsFile.text);
  const seeds = parseSeeds(args.seeds);
  const k = args.k === undefined ? 5 : Number(args.k);
  if (!Number.isInteger(k) || k < 1 || k > 10) throw new Error('k-must-be-integer-1-to-10');
  const now = args.now === undefined ? Date.now() : Number(args.now);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('now-must-be-nonnegative-unix-milliseconds');
  const report = runMemoryOS2RetrievalExperiment(snapshot, examples, {
    now, k, seeds, maxExamples: MAX_EXAMPLES,
    minHoldoutQueries: 8,
    datasetProvenance: provenance,
  });
  report.input = {
    snapshotFile: path.basename(snapshotFile.absolute),
    labelsFile: path.basename(labelsFile.absolute),
    provenanceFile: path.basename(provenanceFile.absolute),
    labelRowsParsed: examples.length,
    note: 'Absolute local paths are deliberately omitted from the report; use sourceRef in provenance for durable lineage.',
  };
  const outputPath = path.resolve(args.out);
  await publishReportExclusive(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  const holdoutMetrics = report.runs[0]?.candidateHoldout;
  console.log(JSON.stringify({
    output: outputPath,
    datasetFingerprint: report.datasetFingerprint,
    corpusFingerprint: report.corpusFingerprint,
    seedCount: report.seedCount,
    trainQueries: report.trainQueries,
    holdoutQueries: report.holdoutQueries,
    answerableHoldoutQueries: holdoutMetrics?.answerableQueries ?? 0,
    unanswerableHoldoutQueries: holdoutMetrics?.unanswerableQueries ?? 0,
    unsupportedRetrievalRate01: holdoutMetrics?.unsupportedRetrievalRate01 ?? 0,
    correctAbstentionRate01: holdoutMetrics?.correctAbstentionRate01 ?? 0,
    promotion: report.promotion.status,
    reason: report.promotion.reason,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`MEMORY_EXPERIMENT_FAILED: ${String(error?.message ?? error)}`); console.error(usage()); process.exitCode = 2; });
}
