#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildNK1InspectEvidenceRecord,
  toNK1InspectEvidenceJsonLine,
} from '../src/organism/integration/inspectAi/NK1InspectEvidenceExporter.ts';

const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

function parseArgs(argv) {
  const result = { snapshot: '', output: '', tick: undefined, sourceCommit: undefined, exportedAt: Date.now() };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--snapshot' && next) result.snapshot = argv[++index];
    else if (token === '--out' && next) result.output = argv[++index];
    else if (token === '--tick' && next) result.tick = Number(argv[++index]);
    else if (token === '--source-commit' && next) result.sourceCommit = argv[++index];
    else if (token === '--exported-at' && next) result.exportedAt = Number(argv[++index]);
    else if (token === '--help' || token === '-h') result.help = true;
    else throw new Error(`unknown-or-incomplete-argument:${token}`);
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write([
      'Usage:',
      '  node --experimental-strip-types runtime/neuro-kurisu/scripts/export-nk1-inspect-evidence.mjs --snapshot <CognitiveEventFabricSnapshot.json> --out <evidence.jsonl> [--tick <n>] [--source-commit <40-char-sha>]',
      '',
      'The exporter is read-only and emits a privacy-reduced, single-tick evidence record.',
    ].join('\n') + '\n');
    return;
  }
  if (!args.snapshot || !args.output) throw new Error('--snapshot and --out are required');
  if (args.tick !== undefined && (!Number.isSafeInteger(args.tick) || args.tick < 0)) throw new Error('--tick must be a non-negative safe integer');
  if (!Number.isSafeInteger(args.exportedAt) || args.exportedAt < 0) throw new Error('--exported-at must be a non-negative safe integer');

  const sourcePath = path.resolve(args.snapshot);
  const outputPath = path.resolve(args.output);
  if (sourcePath === outputPath) throw new Error('snapshot-and-output-path-must-differ');
  const raw = await readFile(sourcePath);
  if (raw.byteLength > MAX_SNAPSHOT_BYTES) throw new Error('snapshot-exceeds-64-MiB-limit');
  const snapshot = JSON.parse(raw.toString('utf8'));
  const sourceCommit = args.sourceCommit ?? process.env.GITHUB_SHA;
  const record = buildNK1InspectEvidenceRecord(snapshot, {
    ...(args.tick !== undefined ? { tick: args.tick } : {}),
    exportedAt: args.exportedAt,
    ...(sourceCommit ? { sourceCommit } : {}),
  });
  const line = toNK1InspectEvidenceJsonLine(record);
  const outputBytes = Buffer.byteLength(line, 'utf8');
  if (outputBytes > MAX_OUTPUT_BYTES) throw new Error('evidence-record-exceeds-8-MiB-limit');
  await writeFile(outputPath, line, { flag: 'wx', mode: 0o600 });
  process.stdout.write(JSON.stringify({
    ok: true,
    schemaVersion: record.schemaVersion,
    sampleId: record.sampleId,
    tick: record.tick,
    fullComplete: record.cycle.verdict.fullComplete,
    fullIntegrity01: record.cycle.verdict.fullIntegrity01,
    receiptCount: record.receiptAudit.receiptCount,
    invalidReceiptCount: record.receiptAudit.invalidReceiptCount,
    externalPostconditionClaimCount: record.receiptAudit.externalPostconditionClaimCount,
    externallyCorroboratedCount: record.receiptAudit.externallyCorroboratedCount,
    output: outputPath,
    outputSha256: createHash('sha256').update(line).digest('hex'),
  }) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`NK1_INSPECT_EXPORT_FAILED: ${String(error?.message ?? error)}\n`);
    process.exitCode = 1;
  });
}
