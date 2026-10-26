import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRuntimeServerEntry } from './super-runtime-paths.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const stateDir = resolve(ROOT, '.super-state');
const runtimeServerEntry = resolveRuntimeServerEntry(ROOT);
if (!existsSync(runtimeServerEntry)) {
  throw new Error(`Neuro-Kurisu runtime server entry is missing: ${runtimeServerEntry}`);
}
mkdirSync(stateDir, { recursive: true });

const children = [];
let shuttingDown = false;
const shutdown = (reason, code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (code !== 0) process.exitCode = code;
  console.log(`[super] shutting down (${reason})`);
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(process.exitCode ?? 0), 800).unref();
};

function launch(label, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  child.on('error', (error) => {
    if (shuttingDown) return;
    console.error(`[super] ${label} spawn error: ${error.message}`);
    void shutdown(`spawn:${label}`, 1);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const exitCode = typeof code === 'number' && code !== 0 ? code : 1;
    console.error(`[super] ${label} exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'none'})`);
    void shutdown(`child:${label}`, exitCode);
  });
  children.push(child);
  return child;
}

if (!existsSync(resolve(ROOT, 'app/package.json'))) throw new Error('app/package.json missing');

launch('neuro-kurisu', 'node', ['--experimental-strip-types', runtimeServerEntry], {
  PORT: '3310',
  HOST: '127.0.0.1',
  STATE_DIR: resolve(stateDir, 'organism'),
  NODE_ENV: 'development',
});
launch('research-bridge', 'python3', ['research/research_bridge.py'], { RESEARCH_PORT: '8765' });
launch('ui', 'npm', ['--prefix', 'app', 'run', 'dev']);

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
