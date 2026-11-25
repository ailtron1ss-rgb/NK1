import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runLearningProcess, readLearningExecutionReceipt } from '../src/organism/learning/LearningProcessSupervisor.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-learning-supervisor-'));
const run = {
  runId: 'run-001',
  manifestFingerprint: 'a'.repeat(64),
  taskId: 'task-1',
  taskVersion: 'v1',
  seed: 7,
  arm: 'R(2)',
  method: 'reset-v1',
};
const base = {
  executable: process.execPath,
  args: ['-e', 'process.stdout.write(JSON.stringify({runId:process.env.NK1_LEARNING_RUN_ID,seed:process.env.NK1_LEARNING_SEED}))'],
  cwd: process.cwd(),
  runRoot: path.join(root, 'runs'),
  surviveDir: path.join(root, 'survive', 'R2'),
  timeoutMs: 2_000,
  maxOutputBytes: 4096,
};
try {
  const success = await runLearningProcess(run, 'b'.repeat(64), base);
  assert.equal(success.receipt.status, 'completed');
  assert.equal(success.receipt.exitCode, 0);
  assert.equal(JSON.parse(success.receipt.stdout).runId, run.runId);
  assert.equal(JSON.parse(success.receipt.stdout).seed, String(run.seed));
  assert.equal(success.receipt.surviveDirectory, path.resolve(base.surviveDir));
  assert.equal((await readLearningExecutionReceipt(success.receiptPath)).executionId, success.receipt.executionId);

  const envOne = await runLearningProcess(run, 'b'.repeat(64), { ...base, env: { NK1_TEST_FLAG: 'one' } });
  const envTwo = await runLearningProcess(run, 'b'.repeat(64), { ...base, env: { NK1_TEST_FLAG: 'two' } });
  assert.notEqual(envOne.receipt.commandFingerprint, envTwo.receipt.commandFingerprint);

  // Sensitive values explicitly passed to the child must not survive in durable
  // execution receipts, while byte counters retain the raw-output measurements.
  const accessToken = 'nk1-access-token-secret-2026';
  const redacted = await runLearningProcess(run, 'b'.repeat(64), {
    ...base,
    env: { NK1_TEST_ACCESS_TOKEN: accessToken },
    args: ['-e', "process.stdout.write(process.env.NK1_TEST_ACCESS_TOKEN); process.stderr.write('Authorization: Bearer '+process.env.NK1_TEST_ACCESS_TOKEN)"],
  });
  assert.equal(redacted.receipt.status, 'completed');
  assert.equal(redacted.receipt.stdout, '[REDACTED]');
  assert.equal(redacted.receipt.stderr, 'Authorization: Bearer [REDACTED]');
  assert.equal(redacted.receipt.stdoutBytes, Buffer.byteLength(accessToken));
  assert.equal(redacted.receipt.stderrBytes, Buffer.byteLength('Authorization: Bearer ' + accessToken));
  assert.ok(!JSON.stringify(redacted.receipt).includes(accessToken), 'receipt must not contain the explicit access token');

  // If the raw-output limit cuts a credential in the middle, its captured prefix
  // is also redacted instead of leaking a partial token.
  const truncatedSecret = await runLearningProcess(run, 'b'.repeat(64), {
    ...base,
    maxOutputBytes: 8,
    env: { NK1_TEST_ACCESS_TOKEN: accessToken },
    args: ['-e', 'process.stdout.write(process.env.NK1_TEST_ACCESS_TOKEN)'],
  });
  assert.equal(truncatedSecret.receipt.status, 'output-limit');
  assert.equal(truncatedSecret.receipt.outputTruncated, true);
  assert.equal(truncatedSecret.receipt.stdout, '[REDACTED]');
  assert.ok(!JSON.stringify(truncatedSecret.receipt).includes(accessToken.slice(0, 8)), 'truncated token prefixes must not be persisted');

  // Generic credential-shaped output is redacted even when the value was not
  // passed through the supervisor's environment allowlist.
  const genericCredentials = await runLearningProcess(run, 'b'.repeat(64), {
    ...base,
    args: ['-e', "process.stdout.write('Authorization: Bearer unbound-credential-value-123456'); process.stderr.write('api_key=unbound-api-key-value')"],
  });
  assert.equal(genericCredentials.receipt.stdout, 'Authorization: Bearer [REDACTED]');
  assert.equal(genericCredentials.receipt.stderr, 'api_key=[REDACTED]');
  assert.ok(!JSON.stringify(genericCredentials.receipt).includes('unbound-credential-value-123456'));
  assert.ok(!JSON.stringify(genericCredentials.receipt).includes('unbound-api-key-value'));

  // Connection strings and service-role credentials are sensitive even when their
  // variable names do not contain the generic TOKEN/SECRET suffix.
  const databaseUrl = 'postgres://nk1:db-password@db.example.invalid:5432/nk1';
  const serviceRoleKey = 'supabase-service-role-secret-2026';
  const redisUrl = 'redis://:redis-password@cache.example.invalid:6379/0';
  const connectionSecrets = await runLearningProcess(run, 'b'.repeat(64), {
    ...base,
    env: {
      DATABASE_URL: databaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      REDIS_URL: redisUrl,
    },
    args: ['-e', "process.stdout.write(process.env.DATABASE_URL); process.stderr.write(process.env.SUPABASE_SERVICE_ROLE_KEY+' '+process.env.REDIS_URL)"],
  });
  assert.equal(connectionSecrets.receipt.stdout, '[REDACTED]');
  assert.equal(connectionSecrets.receipt.stderr, '[REDACTED] [REDACTED]');
  const serializedConnectionReceipt = JSON.stringify(connectionSecrets.receipt);
  assert.ok(!serializedConnectionReceipt.includes(databaseUrl));
  assert.ok(!serializedConnectionReceipt.includes(serviceRoleKey));
  assert.ok(!serializedConnectionReceipt.includes(redisUrl));

  const failed = await runLearningProcess(run, 'b'.repeat(64), { ...base, args: ['-e', 'process.exit(9)'] });
  assert.equal(failed.receipt.status, 'failed');
  assert.equal(failed.receipt.exitCode, 9);

  const timed = await runLearningProcess(run, 'b'.repeat(64), {
    ...base, timeoutMs: 40, args: ['-e', 'setInterval(()=>{},1000)'],
  });
  assert.equal(timed.receipt.status, 'timed-out');
  assert.equal(timed.receipt.signal, 'SIGKILL');

  const cancellation = new AbortController();
  const running = runLearningProcess(run, 'b'.repeat(64), {
    ...base, signal: cancellation.signal, timeoutMs: 2_000,
    args: ['-e', 'setInterval(()=>{},1000)'],
  });
  setTimeout(() => cancellation.abort(new Error('test cancellation')), 40);
  const cancelled = await running;
  assert.equal(cancelled.receipt.status, 'cancelled');
  assert.equal(cancelled.receipt.signal, 'SIGKILL');

  const preCancelled = new AbortController();
  preCancelled.abort();
  await assert.rejects(
    () => runLearningProcess(run, 'b'.repeat(64), { ...base, signal: preCancelled.signal }),
    /cancelled before spawn/,
  );

  // Caller-owned command objects must not be able to change what is executed
  // while trusted run registration is awaiting a durable host write.
  let releaseRegistration;
  let announceRegistration;
  const registrationEntered = new Promise(resolve => { announceRegistration = resolve; });
  const registrationGate = new Promise(resolve => { releaseRegistration = resolve; });
  const mutableCommand = {
    ...base,
    env: { NK1_TEST_FLAG: 'original-env' },
    args: ['-e', "process.stdout.write(process.env.NK1_TEST_FLAG)"],
  };
  const registeredRun = runLearningProcess(
    { ...run, arm: 'candidate', method: 'shadow' },
    'b'.repeat(64),
    mutableCommand,
    { runtimeVersion: 'test-runtime', register: async () => { announceRegistration(); await registrationGate; } },
  );
  await registrationEntered;
  mutableCommand.args[1] = "process.exit(9)";
  mutableCommand.executable = path.join(root, 'must-not-be-executed');
  mutableCommand.env.NK1_TEST_FLAG = 'mutated-env';
  releaseRegistration();
  const immutableCommandResult = await registeredRun;
  assert.equal(immutableCommandResult.receipt.status, 'completed');
  assert.equal(immutableCommandResult.receipt.stdout, 'original-env');

  // Replacing registrar method/version after scheduling must not alter trusted identity.
  let originalRegistrationCalls = 0;
  const mutableRegistrar = {
    runtimeVersion: 'pinned-runtime',
    register: async () => { originalRegistrationCalls++; },
  };
  const registrarRun = runLearningProcess(
    { ...run, runId: 'run-registrar-pinned', arm: 'candidate', method: 'shadow' },
    'b'.repeat(64),
    { ...base, runRoot: path.join(root, 'registrar-runs') },
    mutableRegistrar,
  );
  mutableRegistrar.runtimeVersion = 'attacker-runtime';
  mutableRegistrar.register = async () => { throw new Error('registrar-swapped'); };
  const pinnedRegistrarResult = await registrarRun;
  assert.equal(pinnedRegistrarResult.receipt.status, 'completed');
  assert.equal(originalRegistrationCalls, 1);

  // Relative cwd is resolved before awaits and must not drift if process.cwd changes.
  const originalProcessCwd = process.cwd();
  const pinnedCwd = path.join(root, 'pinned-cwd');
  const changedCwd = path.join(root, 'changed-cwd');
  await Promise.all([
    mkdir(pinnedCwd, { recursive: true }), mkdir(changedCwd, { recursive: true }),
  ]);
  let releaseCwdRegistration;
  let announceCwdRegistration;
  const cwdRegistrationEntered = new Promise(resolve => { announceCwdRegistration = resolve; });
  const cwdRegistrationGate = new Promise(resolve => { releaseCwdRegistration = resolve; });
  try {
    process.chdir(pinnedCwd);
    const cwdRun = runLearningProcess(
      { ...run, runId: 'run-cwd-pinned', arm: 'candidate', method: 'shadow' },
      'b'.repeat(64),
      { ...base, cwd: '.', runRoot: path.join(root, 'cwd-runs'), args: ['-e', 'process.stdout.write(process.cwd())'] },
      { runtimeVersion: 'cwd-test-runtime', register: async () => { announceCwdRegistration(); await cwdRegistrationGate; } },
    );
    await cwdRegistrationEntered;
    process.chdir(changedCwd);
    releaseCwdRegistration();
    const cwdResult = await cwdRun;
    assert.equal(cwdResult.receipt.status, 'completed');
    assert.equal(cwdResult.receipt.stdout, pinnedCwd);
  } finally {
    process.chdir(originalProcessCwd);
  }

  if (process.platform !== 'win32') {
    // A timed-out parent must not leave a same-process-group descendant running.
    // The descendant would create a marker after the supervisor has returned if it survived.
    const descendantMarker = path.join(root, 'descendant-survived.txt');
    const descendantPayload = `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(descendantMarker)}, 'alive'), 300)`;
    const descendantScript = `const { spawn } = require('node:child_process'); spawn(process.execPath, ['-e', ${JSON.stringify(descendantPayload)}], { stdio: 'ignore' }); setInterval(() => {}, 1000);`;
    const treeTimed = await runLearningProcess(run, 'b'.repeat(64), {
      ...base, timeoutMs: 80, args: ['-e', descendantScript],
    });
    assert.equal(treeTimed.receipt.status, 'timed-out');
    await new Promise(resolve => setTimeout(resolve, 400));
    await assert.rejects(() => readFile(descendantMarker, 'utf8'), error => error.code === 'ENOENT');

  }

  const capped = await runLearningProcess(run, 'b'.repeat(64), {
    ...base, maxOutputBytes: 32, args: ['-e', "process.stdout.write('x'.repeat(10000))"],
  });
  assert.equal(capped.receipt.status, 'output-limit');
  assert.equal(capped.receipt.outputTruncated, true);
  assert.ok(capped.receipt.stdoutBytes > capped.receipt.stdout.length);

  await assert.rejects(() => runLearningProcess(run, 'not-a-fingerprint', base), /plan fingerprint/);
  await assert.rejects(() => runLearningProcess({ ...run, seed: -1 }, 'b'.repeat(64), base), /invalid scheduled/);
  const tamperedPath = path.join(root, 'tampered.json');
  await writeFile(tamperedPath, JSON.stringify({ ...success.receipt, planFingerprint: 'wrong' }));
  await assert.rejects(() => readLearningExecutionReceipt(tamperedPath), /receipt fields/);
  const stored = JSON.parse(await readFile(success.receiptPath, 'utf8'));
  assert.equal(stored.runId, run.runId);

  // Lumina-derived least-privilege boundary: credential-shaped environment
  // variables must not cross into a child unless the host grants each exact key.
  const sensitiveKey = 'NK1_TEST_ACCESS_TOKEN';
  const sensitiveValue = 'nk1-fixture-secret-value-2026';
  const priorSensitive = process.env[sensitiveKey];
  process.env[sensitiveKey] = sensitiveValue;
  try {
    await assert.rejects(
      () => runLearningProcess(run, 'b'.repeat(64), {
        ...base,
        inheritEnv: [sensitiveKey],
        args: ['-e', 'process.stdout.write(process.env.NK1_TEST_ACCESS_TOKEN || "missing")'],
      }),
      /sensitive-environment-key-not-authorized/,
      'inherited credentials require an exact host-owned authorization',
    );
    await assert.rejects(
      () => runLearningProcess(run, 'b'.repeat(64), {
        ...base,
        env: { [sensitiveKey]: sensitiveValue },
        args: ['-e', 'process.stdout.write(process.env.NK1_TEST_ACCESS_TOKEN || "missing")'],
      }),
      /sensitive-environment-key-not-authorized/,
      'explicit credentials require the same exact authorization as inherited credentials',
    );
    const allowed = await runLearningProcess(run, 'b'.repeat(64), {
      ...base,
      env: { [sensitiveKey]: sensitiveValue },
      allowSensitiveEnv: [sensitiveKey],
      args: ['-e', 'process.stdout.write(process.env.NK1_TEST_ACCESS_TOKEN || "missing")'],
    });
    assert.equal(allowed.receipt.status, 'completed');
    assert.equal(allowed.receipt.stdout, '[REDACTED]');
    assert.ok(!JSON.stringify(allowed.receipt).includes(sensitiveValue));
    await assert.rejects(
      () => runLearningProcess(run, 'b'.repeat(64), {
        ...base,
        env: { [sensitiveKey]: sensitiveValue },
        allowSensitiveEnv: ['DATABASE_URL'],
      }),
      /sensitive-environment-key-not-authorized/,
      'a grant for another variable must not authorize this credential',
    );
  } finally {
    if (priorSensitive === undefined) delete process.env[sensitiveKey];
    else process.env[sensitiveKey] = priorSensitive;
  }

  console.log('P23_LEARNING_PROCESS_SUPERVISOR=PASS');
} finally {
  await rm(root, { recursive: true, force: true });
}
