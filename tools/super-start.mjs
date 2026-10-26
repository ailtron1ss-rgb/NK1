import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectToolchainVersions } from './toolchain-contract.mjs';
import { decideSupervisedChildExit, decideSupervisedChildSpawnError } from './supervisor-exit-policy.mjs';
import { buildSupervisedServiceSpecs, missingServiceRequirements } from './supervised-service-specs.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
function version(bin, args = ['--version']) {
  try { return execFileSync(bin, args, { encoding: 'utf8' }).trim(); }
  catch { return null; }
}
function commandAvailable(bin, args = ['--version']) {
  try { execFileSync(bin, args, { stdio: 'ignore' }); return true; }
  catch { return false; }
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
const serviceSpecs = buildSupervisedServiceSpecs({
  root: ROOT,
  stateDir,
  nodeExecutable: process.execPath,
});

// Validate every mandatory child before creating local state or launching the
// first process. A missing research interpreter or an unbuilt preview otherwise
// causes a short-lived partial stack and leaves misleading state artifacts.
if (!commandAvailable('python3')) {
  console.error('SUPER_START=FAIL reason=required-executable-missing service=research-bridge command=python3');
  process.exit(1);
}
const missingRequirements = missingServiceRequirements(serviceSpecs, existsSync);
if (missingRequirements.length) {
  const details = missingRequirements.map(item => `${item.label}:${item.path}`).join('; ');
  console.error(`SUPER_START=FAIL reason=service-prerequisite-missing details=[${details}]`);
  if (missingRequirements.some(item => item.label === 'ui-preview' && item.path === resolve(ROOT, 'app/dist/index.html'))) {
    console.error('Build the UI before production-style start: npm --prefix app run build');
  }
  process.exit(1);
}

mkdirSync(stateDir, { recursive: true });

const children = [];
let shuttingDown = false;
const launch = ({ label, command, args, env = {}, cwd = ROOT }) => {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' });
  child.on('error', (error) => {
    const failure = decideSupervisedChildSpawnError({
      label,
      errorMessage: error instanceof Error ? error.message : String(error),
      shuttingDown,
    });
    if (failure.action === 'ignore') return;
    console.error(failure.message);
    void shutdown(failure.reason, failure.exitCode);
  });
  child.on('exit', (code, signal) => {
    const decision = decideSupervisedChildExit({ label, code, signal, shuttingDown });
    if (decision.action === 'ignore') return;
    console.error(decision.message);
    void shutdown(decision.reason, decision.exitCode);
  });
  children.push(child);
  return child;
};

for (const spec of serviceSpecs) launch(spec);

const shutdown = (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[super] shutting down (${signal})`);
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(exitCode), 800).unref();
};
process.on('SIGINT', () => shutdown('SIGINT', 130));
process.on('SIGTERM', () => shutdown('SIGTERM', 143));
