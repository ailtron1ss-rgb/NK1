import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const stateDir = resolve(ROOT, '.super-state');
const runtimeEntry = resolve(ROOT, 'runtime/neuro-kurisu/src/server/server.mjs');
const researchEntry = resolve(ROOT, 'research/research_bridge.py');
mkdirSync(stateDir, { recursive: true });

for (const [label, file] of [
  ['app/package.json', resolve(ROOT, 'app/package.json')],
  ['runtime entrypoint', runtimeEntry],
  ['research bridge', researchEntry],
]) {
  if (!existsSync(file)) throw new Error(`[super] required ${label} missing: ${file}`);
}

const children = [];
let shuttingDown = false;

const shutdown = (reason) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[super] shutting down (${reason})`);
  const exitCode = reason === 'SIGINT' ? 130 : reason === 'SIGTERM' ? 143 : 1;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      try { child.kill('SIGTERM'); } catch { /* child already exited */ }
    }
  }
  setTimeout(() => process.exit(exitCode), 800).unref();
};

function launch(label, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  child.on('error', (error) => {
    console.error(`[super] ${label} spawn error: ${error.message}`);
    void shutdown(`spawn:${label}`);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (signal) console.error(`[super] ${label} exited via ${signal}`);
    else if (code !== 0) console.error(`[super] ${label} exited with ${code}`);
    void shutdown(`child:${label}`);
  });
  children.push(child);
  return child;
}

launch('neuro-kurisu', 'node', ['--experimental-strip-types', 'runtime/neuro-kurisu/src/server/server.mjs'], {
  PORT: '3310',
  HOST: '127.0.0.1',
  STATE_DIR: resolve(stateDir, 'organism'),
  NODE_ENV: 'development',
});
launch('research-bridge', 'python3', ['research/research_bridge.py'], {
  RESEARCH_PORT: '8765',
  ORGANISM_RUNTIME_URL: 'http://127.0.0.1:3310',
});
launch('ui', 'npm', ['--prefix', 'app', 'run', 'dev']);

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
