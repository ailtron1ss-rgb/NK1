import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatSupervisorToolchainFailure, inspectSupervisorToolchain } from './supervisor-preflight.mjs';
import { decideSupervisedChildExit, decideSupervisedChildSpawnError } from './supervisor-exit-policy.mjs';
import { buildSupervisedServiceSpecs, missingServiceRequirements, resolveSupervisorStateDir } from './supervised-service-specs.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
function commandAvailable(bin, args = ['--version']) {
  try { execFileSync(bin, args, { stdio: 'ignore' }); return true; }
  catch { return false; }
}
const toolchain = inspectSupervisorToolchain(ROOT);
if (!toolchain.ready) {
  console.error(formatSupervisorToolchainFailure(toolchain, 'SUPER_START'));
  process.exit(1);
}

const stateDir = resolveSupervisorStateDir(ROOT);
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
