import { mkdirSync, resolve } from 'node:path';
import { spawnManaged, terminateChildren } from './process-supervisor.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const stateDir = resolve(ROOT, '.super-state');
mkdirSync(stateDir, { recursive: true });

const children = [];
let shuttingDown = false;

const launch = (label, command, args, env = {}) => {
  const child = spawnManaged(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  child.on('error', (error) => {
    console.error(`[super] ${label} spawn error: ${error.message}`);
    void shutdown(`spawn-error:${label}`, 1);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (signal) console.error(`[super] ${label} exited unexpectedly via ${signal}`);
    else console.error(`[super] ${label} exited unexpectedly with code ${code}`);
    // A production service exiting unexpectedly is a failed overall start,
    // even when the individual process reports exit code zero.
    void shutdown(`child-exit:${label}`, code === 0 && !signal ? 1 : (code ?? 1));
  });
  children.push(child);
  return child;
};

launch('neuro-kurisu', 'node', ['--experimental-strip-types', 'src/server/server.mjs'], {
  PORT: '3310', HOST: '127.0.0.1', STATE_DIR: resolve(stateDir, 'organism'), NODE_ENV: 'production'
});
launch('research-bridge', 'python3', ['research/research_bridge.py'], { RESEARCH_PORT: '8765' });
launch('ui-preview', 'npm', ['--prefix', 'app', 'run', 'preview']);
launch('gateway', 'node', ['tools/super-gateway.mjs'], { SUPER_GATEWAY_PORT: '8080', SUPER_UI_PORT: '8081', SUPER_RUNTIME_PORT: '3310', SUPER_RESEARCH_PORT: '8765' });

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[super] shutting down (${signal})`);
  await terminateChildren(children, { graceMs: 800, forceGraceMs: 500 });
  process.exit(exitCode);
}

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
