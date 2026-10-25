import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectToolchainVersions } from './toolchain-contract.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
function version(bin, args = ['--version']) {
  try { return execFileSync(bin, args, { encoding: 'utf8' }).trim(); }
  catch { return null; }
}
function readManifest(relativePath) {
  try { return JSON.parse(readFileSync(resolve(ROOT, relativePath), 'utf8')); }
  catch { return null; }
}
let nodePin = null;
try { nodePin = readFileSync(resolve(ROOT, '.nvmrc'), 'utf8').trim(); }
catch { /* Missing version pin is rejected below. */ }
const nodeVersion = process.version;
const npmVersion = version('npm');
const manifests = [
  { name: 'root', path: 'package.json' },
  { name: 'runtime', path: 'runtime/neuro-kurisu/package.json' },
  { name: 'app', path: 'app/package.json' },
].map(entry => ({ ...entry, value: readManifest(entry.path) }));
const contracts = manifests.map(({ value }) => inspectToolchainVersions({
  nodeVersion,
  npmVersion,
  nodePin,
  nodeRequirement: value?.engines?.node,
  npmRequirement: value?.engines?.npm,
}));
const nodeReady = !!nodePin && manifests.every((manifest, index) =>
  manifest.value && contracts[index].nodePinMatches && contracts[index].nodeMeetsRequirement);
const npmReady = !!npmVersion && manifests.every((manifest, index) =>
  manifest.value && contracts[index].npmMeetsRequirement);
if (!nodeReady || !npmReady) {
  const engines = manifests.map(({ name, value }) =>
    `${name}:node=${value?.engines?.node ?? 'missing'},npm=${value?.engines?.npm ?? 'missing'}`).join('; ');
  console.error(`SUPER_START=FAIL reason=toolchain-contract node=${nodeVersion} pin=${nodePin ?? 'missing'} npm=${npmVersion ?? 'missing'} engines=[${engines}]`);
  process.exit(1);
}

const stateDir = resolve(ROOT, '.super-state');
mkdirSync(stateDir, { recursive: true });

const children = [];
let shuttingDown = false;
const launch = (label, command, args, env = {}) => {
  const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: 'inherit' });
  child.on('error', (error) => console.error(`[super] ${label} spawn error: ${error.message}`));
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (signal) console.log(`[super] ${label} exited via ${signal}`);
    else if (code !== 0) { console.error(`[super] ${label} exited with ${code}`); void shutdown(`child:${label}`); }
  });
  children.push(child);
  return child;
};

launch('neuro-kurisu', process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], {
  PORT: '3310', HOST: '127.0.0.1', STATE_DIR: resolve(stateDir, 'organism'), NODE_ENV: 'production'
});
launch('research-bridge', 'python3', ['research/research_bridge.py'], { RESEARCH_PORT: '8765' });
launch('ui-preview', 'npm', ['--prefix', 'app', 'run', 'preview']);
launch('gateway', process.execPath, ['tools/super-gateway.mjs'], { SUPER_GATEWAY_PORT: '8080', SUPER_UI_PORT: '8081', SUPER_RUNTIME_PORT: '3310', SUPER_RESEARCH_PORT: '8765' });

const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[super] shutting down (${signal})`);
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 800).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
