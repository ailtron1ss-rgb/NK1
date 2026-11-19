import assert from 'node:assert/strict';
import { chmod, link, mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { areHostOwnedStorageRootsDisjoint, createHostOwnedIndependentEvaluationConfigFactory, createHostOwnedIndependentEvaluationServices } from '../src/organism/learning/HostOwnedIndependentEvaluationServices.ts';

// Two different path strings are not enough when an OS exposes the same
// underlying filesystem object through a bind mount or alternate mount alias.
assert.equal(areHostOwnedStorageRootsDisjoint(
  { path: '/authority/executor/runs', identity: 'dev7:inode42' },
  { path: '/authority/verifier/runs', identity: 'dev7:inode42' },
), false, 'storage roots sharing the same device/inode must not be treated as independent');
assert.equal(areHostOwnedStorageRootsDisjoint(
  { path: '/authority/executor/runs', identity: 'dev7:inode42' },
  { path: '/authority/verifier/runs', identity: 'dev7:inode43' },
), true, 'independent paths and filesystem identities should satisfy the separation contract');
assert.equal(areHostOwnedStorageRootsDisjoint(
  { path: '/authority/runs', identity: 'dev7:inode42' },
  { path: '/authority/runs/nested', identity: 'dev7:inode43' },
), false, 'nested storage roots must be rejected even when identities differ');

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-host-evaluation-'));
try {
  const serviceRoot = async name => {
    const base = path.join(root, name);
    await mkdir(base, { recursive: true, mode: 0o700 });
    return {
      executable: path.join(base, 'authority.mjs'),
      cwd: base,
      runRoot: path.join(base, 'runs'),
      surviveDir: path.join(base, 'survive'),
      args: ['{requestFile}'],
      timeoutMs: 5000,
      maxOutputBytes: 8192,
      env: {},
      inheritEnv: ['PATH'],
    };
  };
  const executor = await serviceRoot('executor');
  const verifier = await serviceRoot('verifier');
  const scanner = await serviceRoot('scanner');
  const scripts = [
    [executor, `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const request = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (request.authority !== 'executor' || request.input.payload.answer !== 42) process.exit(21);
const runId = request.input.payload.mismatchRunId ? request.context.runId + '-detached' : request.context.runId;
process.stdout.write(JSON.stringify({ runId, observedStepIds: ['step-a'] }));
`],
    [verifier, `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const request = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (request.authority !== 'verifier' || request.input.execution.observedStepIds[0] !== 'step-a') process.exit(22);
process.stdout.write(JSON.stringify({
  bindingVerified: true, passed: true, coveredCapabilityIds: ['cap-a'],
  payloadFingerprint: request.input.context.payloadFingerprint,
  taskInputFingerprint: request.input.context.taskInputFingerprint,
  environmentFingerprint: request.input.context.environmentFingerprint,
  planFingerprint: request.input.context.planFingerprint,
  manifestFingerprint: request.input.context.manifestFingerprint,
  experimentPlanFingerprint: request.input.context.experimentPlanFingerprint,
  plannedRunId: request.input.context.plannedRunId,
  runId: request.input.execution.runId,
  taskId: request.input.task.taskId,
  seed: request.input.task.seed,
}));
`],
    [scanner, `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const request = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (request.authority !== 'safety-scanner' || request.input.payload.answer !== 42 ||
    request.input.context.planFingerprint !== 'a'.repeat(64)) process.exit(23);
process.stdout.write(JSON.stringify({
  violationCount: 0, bindingVerified: true,
  payloadFingerprint: request.input.context.payloadFingerprint,
  taskInputFingerprint: request.input.context.taskInputFingerprint,
  environmentFingerprint: request.input.context.environmentFingerprint,
  planFingerprint: request.input.context.planFingerprint,
  manifestFingerprint: request.input.context.manifestFingerprint,
  experimentPlanFingerprint: request.input.context.experimentPlanFingerprint,
  plannedRunId: request.input.context.plannedRunId,
  runId: request.input.execution.runId,
  taskId: request.input.task.taskId,
  seed: request.input.task.seed,
}));
`],
  ];
  for (const [service, source] of scripts) {
    await writeFile(service.executable, source, { mode: 0o700, flag: 'wx' });
    await chmod(service.executable, 0o700);
  }

  await assert.rejects(
    createHostOwnedIndependentEvaluationServices({
      executor: { ...executor, inheritEnv: ['PATH', 'OPENAI_API_KEY'] },
      verifier, safetyScanner: scanner,
    }),
    /host-owned-executor-inherited-environment-not-allowed/,
  );
  await assert.rejects(
    createHostOwnedIndependentEvaluationServices({
      executor: { ...executor, inheritEnv: ['PATH', 'NODE_OPTIONS'] },
      verifier, safetyScanner: scanner,
    }),
    /host-owned-executor-inherited-environment-not-allowed/,
  );

  const services = await createHostOwnedIndependentEvaluationServices({
    executor, verifier, safetyScanner: scanner,
  });
  assert.equal(new Set(Object.values(services.authorityIdentity)).size, 3);
  // Prepared services must not retain mutable argv/env arrays owned by the caller.
  executor.args[0] = 'caller-mutated-argument';
  const task = {
    taskId: 'task-a', trialId: 'trial-a', seed: 7, split: 'validation',
    input: { prompt: 'do the task' }, requiredCapabilityIds: ['cap-a'], expectedStepIds: ['step-a'],
  };
  const context = {
    payloadFingerprint: 'b'.repeat(64), taskInputFingerprint: 'c'.repeat(64),
    environmentFingerprint: 'd'.repeat(64), planFingerprint: 'a'.repeat(64),
    manifestFingerprint: 'f'.repeat(64), experimentPlanFingerprint: null, plannedRunId: null,
  };
  await assert.rejects(
    services.executor.execute({ payload: { answer: 42, mismatchRunId: true }, task, context }),
    /host-owned-executor-response-run-id-mismatch/,
  );
  const execution = await services.executor.execute({ payload: { answer: 42 }, task, context });
  assert.deepEqual(execution.observedStepIds, ['step-a']);
  const verified = await services.verifier.verify({ task, execution, context });
  assert.deepEqual(verified, { bindingVerified: true, passed: true, coveredCapabilityIds: ['cap-a'] });
  const safety = await services.safetyScanner.scan({ payload: { answer: 42 }, task, execution, context });
  assert.deepEqual(safety, { violationCount: 0 });

  executor.args[0] = '{requestFile}';
  const runtimeConfigFactory = await createHostOwnedIndependentEvaluationConfigFactory({
    commands: { executor, verifier, safetyScanner: scanner },
    tasksForRepair: () => [task],
    environmentFingerprintForRepair: () => 'd'.repeat(64),
  });
  const runtimeConfig = runtimeConfigFactory({ repairId: 'repair-a' });
  assert.deepEqual(runtimeConfig.tasks, [task]);
  assert.equal(runtimeConfig.environmentFingerprint, 'd'.repeat(64));
  assert.equal(new Set(Object.values(runtimeConfig.authorityIdentity)).size, 3);
  assert.equal(typeof runtimeConfig.executor.execute, 'function');
  assert.equal(typeof runtimeConfig.verifier.verify, 'function');
  assert.equal(typeof runtimeConfig.safetyScanner.scan, 'function');

  await assert.rejects(
    createHostOwnedIndependentEvaluationServices({ executor, verifier, safetyScanner: verifier }),
    /host-owned-evaluation-authorities-must-use-distinct-executables/,
  );
  if (process.platform !== 'win32') {
    const alias = path.join(root, 'executor-hardlink.mjs');
    await link(executor.executable, alias);
    const hardlinkedScanner = { ...scanner, executable: alias };
    await assert.rejects(
      createHostOwnedIndependentEvaluationServices({ executor, verifier, safetyScanner: hardlinkedScanner }),
      /host-owned-evaluation-authorities-must-use-distinct-executables/,
    );
  }
  if (process.platform !== 'win32') {
    // Host authorities must not be replaceable by group/other writers.
    await chmod(executor.executable, 0o720);
    await assert.rejects(
      createHostOwnedIndependentEvaluationServices({ executor, verifier, safetyScanner: scanner }),
      /host-owned-executor-executable-must-not-be-group-or-world-writable/,
    );
    // Restore the safe fixture mode so the next assertion isolates root identity,
    // rather than being pre-empted by the executable-permission guard.
    await chmod(executor.executable, 0o700);
  }
  if (process.platform !== 'win32') {
    // Prepared authority handles must fail closed if the executable path is
    // replaced after setup; a distinct path at setup time is not enough.
    const replacement = path.join(root, 'replacement-scanner.mjs');
    await writeFile(replacement, '#!/usr/bin/env node\\nprocess.stdout.write(JSON.stringify({ violationCount: 0 }));\\n', { mode: 0o700, flag: 'wx' });
    await chmod(replacement, 0o700);
    await rename(replacement, scanner.executable);
    await assert.rejects(
      services.safetyScanner.scan({ payload: { answer: 42 }, task, execution, context }),
      /host-owned-safety-scanner-executable-identity-changed/,
    );

    // Replacing a prepared scratch root must fail before a request file or child
    // process is created; the new directory inherits the same path, not identity.
    const movedRunRoot = executor.runRoot + '-replaced';
    await rename(executor.runRoot, movedRunRoot);
    await mkdir(executor.runRoot, { mode: 0o700 });
    await assert.rejects(
      services.executor.execute({ payload: { answer: 42 }, task, context }),
      /host-owned-executor-run-root-identity-changed/,
    );
  }
  console.log('WorkPass258 dispatch-time authority path identity regression: authored');
} finally {
  await rm(root, { recursive: true, force: true });
}
