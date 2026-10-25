import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const stateDir = resolve(ROOT, '.super-state');
const runtimeEntry = resolve(ROOT, 'runtime/neuro-kurisu/src/server/server.mjs');
const researchEntry = resolve(ROOT, 'research/research_bridge.py');
const gatewayEntry = resolve(ROOT, 'tools/super-gateway.mjs');
mkdirSync(stateDir, { recursive: true });

for (const [label, file] of [
  ['app/package.json', resolve(ROOT, 'app/package.json')],
  ['runtime entrypoint', runtimeEntry],
  ['research bridge', researchEntry],
  ['gateway entrypoint', gatewayEntry],
]) {
  if (!existsSync(file)) throw new Error(`[super] required ${label} missing: ${file}`);
}

const children = [];
let shuttingDown = false;

const shutdown = (reason) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[super] shutting down (${reason})`);
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      try { child.kill('SIGTERM'); } catch { /* child already exited */ }
    }
  }
  setTimeout(() => process.exit(0), 800).unref();
};

const launch = (label, command, args, env = {}) => {
  const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: 'inherit' });
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
};

launch('neuro-kurisu', 'node', ['--experimental-strip-types', 'runtime/neuro-kurisu/src/server/server.mjs'], {
  PORT: '3310', HOST: '127.0.0.1', STATE_DIR: resolve(stateDir, 'organism'), NODE_ENV: 'production'
});
launch('research-bridge', 'python3', ['research/research_bridge.py'], {
  RESEARCH_PORT: '8765',
  ORGANISM_RUNTIME_URL: 'http://127.0.0.1:3310',
});
launch('ui-preview', 'npm', ['--prefix', 'app', 'run', 'preview']);
launch('gateway', 'node', ['tools/super-gateway.mjs'], {
  SUPER_GATEWAY_PORT: '8080', SUPER_UI_PORT: '8081', SUPER_RUNTIME_PORT: '3310', SUPER_RESEARCH_PORT: '8765'
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
