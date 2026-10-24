#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { runCommand } from './process-supervisor.mjs';

const root = process.cwd();
const runtime = path.join(root, 'runtime/neuro-kurisu');
const timeoutMs = Number(process.env.NK_SCHEMA_CHECK_TIMEOUT_MS ?? 180_000);

if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 600_000) {
  console.error('SCHEMA_CHECK=FAIL reason=invalid-timeout allowed=1000..600000');
  process.exit(1);
}

async function runCheck(label, cwd, args) {
  console.log(`SCHEMA_CHECK=START step=${label} timeoutMs=${timeoutMs}`);
  const result = await runCommand(process.execPath, args, {
    cwd,
    env: process.env,
    timeoutMs,
    terminationGraceMs: 750,
    forceGraceMs: 500,
    maxOutputBytes: 24 * 1024,
    streamOutput: true,
  });

  if (result.error || result.code !== 0 || result.timedOut) {
    const reason = result.timedOut
      ? `timeout-after-${result.durationMs}ms`
      : result.error
        ? 'spawn-error'
        : result.signal
          ? `signal-${result.signal}`
          : `exit-${result.code ?? 'unknown'}`;
    console.error(`SCHEMA_CHECK=FAIL step=${label} reason=${reason} durationMs=${result.durationMs}`);
    if (result.error) console.error(`SCHEMA_CHECK=DIAGNOSTIC ${result.error}`);
    const tail = (result.err || result.out).trim();
    if (tail) console.error(`SCHEMA_CHECK=OUTPUT_TAIL\\n${tail}`);
    return false;
  }

  console.log(`SCHEMA_CHECK=PASS step=${label} durationMs=${result.durationMs}`);
  return true;
}

if (!await runCheck('runtime-persistence', runtime, [
  '--experimental-strip-types',
  'tests/pass20-persistence-restore-continuity.mjs',
])) {
  process.exit(1);
}

if (!await runCheck('app-migration-plan', root, [
  '-e',
  `import('./app/scripts/migration-plan.mjs').then(m => console.log('APP_MIGRATION_PLAN=PASS', m.pendingMigrations(['0001.sql'], []).length)).catch(error => { console.error(error); process.exitCode = 1; })`,
])) {
  process.exit(1);
}

console.log('SCHEMA_CHECK=PASS');
