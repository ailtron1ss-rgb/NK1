#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deserialize } from 'node:v8';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const usage = 'Usage: node --experimental-strip-types scripts/memory-doctor.mjs <state-file> [--max-issues=64]';
const args = process.argv.slice(2);
const statePath = args.find(arg => !arg.startsWith('--'));
const maxArg = args.find(arg => arg.startsWith('--max-issues='));
const maxIssues = maxArg ? Number(maxArg.slice('--max-issues='.length)) : 64;

function fail(code, message, exitCode) {
  console.log(JSON.stringify({ tool: 'NK1-MemoryDoctor', readOnly: true, pass: false, error: { code, message }, usage }, null, 2));
  process.exitCode = exitCode;
}

if (!statePath) {
  fail('state-file-required', usage, 64);
} else if (!Number.isSafeInteger(maxIssues) || maxIssues < 1 || maxIssues > 128) {
  fail('invalid-max-issues', '--max-issues must be an integer from 1 to 128.', 64);
} else {
  try {
    const resolvedPath = resolve(statePath);
    // Read the primary state file only. Unlike FileStateStore recovery, this audit
    // must not silently substitute a .bak file when the requested file is damaged.
    const payload = await readFile(resolvedPath);
    let state;
    let format = 'json';
    if (/^v8$/i.test(String(process.env.NEURO_STATE_FORMAT ?? ''))) {
      try {
        state = deserialize(payload);
        format = 'v8';
      } catch {
        state = JSON.parse(payload.toString('utf8'));
        format = 'json-compat';
      }
    } else {
      state = JSON.parse(payload.toString('utf8'));
    }
    const snapshot = state?.facets?.advanced?.memoryOS;
    if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.items)) {
      throw new Error('The selected state file does not contain facets.advanced.memoryOS.items.');
    }
    const memory = new MemoryOS2({ signalFusionProfile: 'balanced', embeddingProvider: null });
    memory.restore(snapshot);
    const report = memory.doctor({ at: Date.now(), maxIssues });
    console.log(JSON.stringify({
      tool: 'NK1-MemoryDoctor',
      readOnly: true,
      source: { path: resolvedPath, format },
      ...report,
    }, null, 2));
    process.exitCode = report.pass ? 0 : 2;
  } catch (error) {
    fail('memory-doctor-failed', error instanceof Error ? error.message : String(error), 1);
  }
}
