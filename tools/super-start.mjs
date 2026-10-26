import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const stateDir = resolve(ROOT, process.env.SUPER_STATE_DIR || '.super-state');
mkdirSync(stateDir, { recursive: true });

const children = [];
let shuttingDown = false;
let finalExitCode = 0;
const shutdown = (reason, exitCode = 0) => {
  if (shuttingDown) {
    if (exitCode !== 0) finalExitCode = exitCode;
    return;
  }
  shuttingDown = true;
  finalExitCode = exitCode;
  console.log(`[super] shutting down (${reason}); exitCode=${finalExitCode}`);
  for (const child of children) {
    try { child.kill('SIGTERM'); } catch { /* child already exited */ }
  }
  setTimeout(() => process.exit(finalExitCode), 1200).unref();
};
const launch = (label, command, args, env = {}, cwd = ROOT) => {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' });
  child.on('error', (error) => {
    console.error(`[super] ${label} spawn error: ${error.message}`);
    void shutdown(`spawn-error:${label}`, 1);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const detail = signal ? `via ${signal}` : `with exit code ${code}`;
    console.error(`[super] critical service ${label} exited unexpectedly ${detail}`);
    void shutdown(`child-exit:${label}`, 1);
  });
  children.push(child);
  return child;
};

launch('neuro-kurisu', 'node', ['--experimental-strip-types', 'src/server/server.mjs'], {
  PORT: '3310', HOST: '127.0.0.1', STATE_DIR: resolve(stateDir, 'organism'), NODE_ENV: 'production'
}, resolve(ROOT, 'runtime/neuro-kurisu'));
launch('research-bridge', 'python3', ['research/research_bridge.py'], { RESEARCH_PORT: '8765' });
launch('ui-preview', 'npm', ['--prefix', 'app', 'run', 'preview']);
launch('gateway', 'node', ['tools/super-gateway.mjs'], { SUPER_GATEWAY_PORT: '8080', SUPER_UI_PORT: '8081', SUPER_RUNTIME_PORT: '3310', SUPER_RESEARCH_PORT: '8765' });

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
