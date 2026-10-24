#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { runCommand } from './process-supervisor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const timeoutMs = Number(process.env.NK_MIGRATION_TIMEOUT_MS ?? 1_800_000);

if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 3_600_000) {
  console.error('MIGRATION=FAIL reason=invalid-timeout allowed=1000..3600000');
  process.exit(1);
}

async function runMigration({ label, cwd, args }) {
  console.log(`MIGRATION=START step=${label} timeoutMs=${timeoutMs}`);
  const result = await runCommand(process.execPath, args, {
    cwd,
    env: process.env,
    timeoutMs,
    terminationGraceMs: 1_000,
    forceGraceMs: 750,
    maxOutputBytes: 32 * 1024,
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
    console.error(`MIGRATION=FAIL step=${label} reason=${reason} durationMs=${result.durationMs}`);
    if (result.error) console.error(`MIGRATION=DIAGNOSTIC ${result.error}`);
    const tail = (result.err || result.out).trim();
    if (tail) console.error(`MIGRATION=OUTPUT_TAIL\\n${tail}`);
    if (result.timedOut) {
      console.error('Migration process timeout is a hard cancellation. Inspect database transaction/partial-application state before retrying.');
    }
    return { ok: false, reason, durationMs: result.durationMs };
  }

  console.log(`MIGRATION=PASS step=${label} durationMs=${result.durationMs}`);
  return { ok: true, durationMs: result.durationMs };
}

let appMigration = { status: 'skipped', durationMs: 0 };
if (process.env.DATABASE_URL) {
  appMigration = await runMigration({
    label: 'app-database',
    cwd: path.join(root, 'app'),
    args: ['scripts/migrate.mjs'],
  });
  if (!appMigration.ok) process.exit(1);
}

const runtimeMigration = await runMigration({
  label: 'runtime-persistence',
  cwd: path.join(root, 'runtime/neuro-kurisu'),
  args: ['--experimental-strip-types', 'scripts/pass20-persistence-restore-continuity.mjs'],
});
if (!runtimeMigration.ok) process.exit(1);

console.log(JSON.stringify({
  ok: true,
  appMigration: appMigration.status === 'skipped' ? 'skipped-no-DATABASE_URL' : 'PASS',
  runtimePersistenceMigration: 'PASS',
  timeoutMs,
  durationMs: appMigration.durationMs + runtimeMigration.durationMs,
}, null, 2));
