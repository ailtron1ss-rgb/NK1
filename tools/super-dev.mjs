import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatSupervisorToolchainFailure, inspectSupervisorToolchain } from './supervisor-preflight.mjs';
import { decideSupervisedChildExit, decideSupervisedChildSpawnError } from './supervisor-exit-policy.mjs';
import { buildSupervisedDevelopmentServiceSpecs, missingServiceRequirements, resolveSupervisorStateDir } from './supervised-service-specs.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const toolchain = inspectSupervisorToolchain(ROOT);
if (!toolchain.ready) {
  console.error(formatSupervisorToolchainFailure(toolchain, 'SUPER_DEV'));
  process.exit(1);
}

function commandAvailable(command, args = ['--version']) {
  try { execFileSync(command, args, { stdio: 'ignore' }); return true; }
  catch { return false; }
}
if (!commandAvailable('python3')) {
  console.error('SUPER_DEV=FAIL reason=required-executable-missing service=research-bridge command=python3');
  process.exit(1);
}

const stateDir = resolveSupervisorStateDir(ROOT);
const serviceSpecs = buildSupervisedDevelopmentServiceSpecs({
  root: ROOT, stateDir, nodeExecutable: process.execPath,
});
const missingRequirements = missingServiceRequirements(serviceSpecs, existsSync);
if (missingRequirements.length) {
  const details = missingRequirements.map(item => `${item.label}:${item.path}`).join('; ');
  console.error(`SUPER_DEV=FAIL reason=service-prerequisite-missing details=[${details}]`);
  process.exit(1);
}

mkdirSync(stateDir, { recursive: true });
const children = [];
let shuttingDown = false;
const shutdown = (reason, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[super-dev] shutting down (${reason})`);
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(exitCode), 800).unref();
};

function launch({ label, command, args, cwd, env = {} }) {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' });
  child.on('error', error => {
    const decision = decideSupervisedChildSpawnError({
      label,
      errorMessage: error instanceof Error ? error.message : String(error),
      shuttingDown,
    });
    if (decision.action === 'ignore') return;
    console.error(decision.message);
    void shutdown(decision.reason, decision.exitCode);
  });
  child.on('exit', (code, signal) => {
    const decision = decideSupervisedChildExit({ label, code, signal, shuttingDown });
    if (decision.action === 'ignore') return;
    console.error(decision.message);
    void shutdown(decision.reason, decision.exitCode);
  });
  children.push(child);
  return child;
}

for (const spec of serviceSpecs) launch(spec);

process.on('SIGINT', () => shutdown('SIGINT', 130));
process.on('SIGTERM', () => shutdown('SIGTERM', 143));
