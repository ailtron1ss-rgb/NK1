import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const stateDir = resolve(ROOT, '.super-state');
mkdirSync(stateDir, { recursive: true });

const children = [];
function launch(label, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  child.on('exit', (code, signal) => {
    if (signal) console.log(`[super] ${label} exited via ${signal}`);
    else if (code !== 0) console.error(`[super] ${label} exited with ${code}`);
  });
  children.push(child);
  return child;
}

if (!existsSync(resolve(ROOT, 'app/package.json'))) throw new Error('app/package.json missing');
launch('neuro-kurisu', 'node', ['--experimental-strip-types', 'src/server/server.mjs'], {
  PORT: '3310',
  HOST: '127.0.0.1',
  STATE_DIR: resolve(stateDir, 'organism'),
  NODE_ENV: 'development',
});
launch('research-bridge', 'python3', ['research/research_bridge.py'], {
  RESEARCH_PORT: '8765',
});
launch('ui', 'npm', ['--prefix', 'app', 'run', 'dev']);

const shutdown = (signal) => {
  console.log(`[super] shutting down (${signal})`);
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 800).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
