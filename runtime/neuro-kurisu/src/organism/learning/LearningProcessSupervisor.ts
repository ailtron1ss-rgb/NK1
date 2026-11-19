import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface LearningProcessRun {
  runId: string;
  manifestFingerprint: string;
  taskId: string;
  taskVersion: string;
  seed: number;
  arm: string;
  method: string;
}
export interface LearningProcessCommand {
  executable: string;
  args: string[];
  cwd: string;
  runRoot: string;
  surviveDir: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  env?: Record<string, string>;
  inheritEnv?: string[];
  signal?: AbortSignal;
}
export interface LearningExecutionReceipt {
  schemaVersion: 2;
  executionId: string;
  runId: string;
  planFingerprint: string;
  manifestFingerprint: string;
  commandFingerprint: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  status: 'completed' | 'failed' | 'timed-out' | 'cancelled' | 'output-limit' | 'spawn-error';
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  stdoutBytes: number;
  stderrBytes: number;
  outputTruncated: boolean;
  runDirectory: string;
  surviveDirectory: string;
  boundaries: string[];
}
export interface LearningProcessResult {
  receipt: LearningExecutionReceipt;
  receiptPath: string;
}

/** Trusted registration capability owned by the host runtime, never supplied by the child process. */
export interface TrustedShadowRunRegistration {
  runtimeVersion: string;
  register(context: { runId: string; taskId: string; seed: number; manifestFingerprint: string; runtimeVersion: string }): void | Promise<unknown>;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576;
const MAX_TIMEOUT_MS = 3_600_000;
const MAX_OUTPUT_BYTES = 16_777_216;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function safeInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

/**
 * Executes one scheduled learner attempt as a real child process, without a
 * shell. Every attempt gets a fresh scratch directory; the caller explicitly
 * chooses the arm's survive directory. This function produces execution
 * evidence only: exit code/output are NOT verified task outcomes. When a trusted
 * registrar is supplied, its durable registration completes before the child is spawned;
 * registration failure aborts execution and cannot produce an unregistered trusted run.
 */
export async function runLearningProcess(
  run: LearningProcessRun,
  planFingerprint: string,
  command: LearningProcessCommand,
  trustedShadowRun?: TrustedShadowRunRegistration,
): Promise<LearningProcessResult> {
  if (!run || typeof run !== 'object') throw new Error('invalid scheduled learning run');
  // Snapshot caller-owned run/command data before any await. In particular, trusted
  // registration may be asynchronous; it must not create a window where the command
  // that gets spawned differs from the command whose identity was validated/fingerprinted.
  run = { ...run };
  if (!command || typeof command !== 'object') throw new Error('invalid process command');
  command = {
    ...command,
    args: Array.isArray(command.args) ? [...command.args] : command.args,
    env: command.env ? { ...command.env } : undefined,
    inheritEnv: command.inheritEnv ? [...command.inheritEnv] : undefined,
  };
  // Pin the registrar capability itself before the first filesystem await. A caller
  // retaining the registration object must not be able to swap its method or runtime
  // identity while directory preparation is in progress.
  if (trustedShadowRun !== undefined) {
    if (!trustedShadowRun || !nonEmpty(trustedShadowRun.runtimeVersion) ||
        typeof trustedShadowRun.register !== 'function') {
      throw new Error('invalid trusted shadow run registrar');
    }
    const runtimeVersion = trustedShadowRun.runtimeVersion;
    const register = trustedShadowRun.register.bind(trustedShadowRun);
    trustedShadowRun = { runtimeVersion, register };
  }
  if (!nonEmpty(run.runId) || !/^[a-f0-9]{64}$/i.test(run.manifestFingerprint) ||
      !nonEmpty(run.taskId) || !nonEmpty(run.taskVersion) || !nonEmpty(run.arm) || !nonEmpty(run.method) ||
      !safeInteger(run.seed, 0, Number.MAX_SAFE_INTEGER)) throw new Error('invalid scheduled learning run');
  if (!/^[a-f0-9]{64}$/i.test(planFingerprint)) throw new Error('invalid plan fingerprint');
  if (!nonEmpty(command?.executable) || !Array.isArray(command.args) ||
      command.args.some(arg => typeof arg !== 'string') || !nonEmpty(command.cwd) ||
      !nonEmpty(command.runRoot) || !nonEmpty(command.surviveDir)) throw new Error('invalid process command');
  // Candidate shadow runs are the only runs eligible for trusted skill evidence.
  // Fail closed here too, not only in the Core coordinator: direct callers of this
  // generic supervisor must not launch an unregistered candidate/shadow run.
  const isTrustedShadowLane = run.arm === 'candidate' && run.method === 'shadow';
  if (isTrustedShadowLane && trustedShadowRun === undefined) {
    throw new Error('candidate/shadow execution requires trusted run registration');
  }
  if (trustedShadowRun !== undefined && !isTrustedShadowLane) {
    throw new Error('trusted run registration is only valid for candidate/shadow execution');
  }

  // Resolve relative cwd against the caller's cwd now, not after async registration.
  // The exact directory used for execution is the one bound into command provenance.
  const workingDirectory = path.resolve(command.cwd);
  const timeoutMs = command.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = command.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  if (!safeInteger(timeoutMs, 1, MAX_TIMEOUT_MS)) throw new Error('timeoutMs out of bounds');
  if (!safeInteger(maxOutputBytes, 1, MAX_OUTPUT_BYTES)) throw new Error('maxOutputBytes out of bounds');

  if (command.signal?.aborted) throw new Error('learning process cancelled before spawn');
  const executionId = randomUUID();
  const startedAt = Date.now();
  await mkdir(path.resolve(command.runRoot), { recursive: true });
  await mkdir(path.resolve(command.surviveDir), { recursive: true });
  const runDirectory = await mkdtemp(path.join(path.resolve(command.runRoot), 'nk1-learning-'));
  const surviveDirectory = path.resolve(command.surviveDir);
  const env: NodeJS.ProcessEnv = {};
  for (const key of command.inheritEnv ?? []) {
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) throw new Error('invalid inherited environment key');
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  for (const [key, value] of Object.entries(command.env ?? {})) {
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key) || typeof value !== 'string') throw new Error('invalid environment entry');
    env[key] = value;
  }
  Object.assign(env, {
    NK1_LEARNING_RUN_ID: run.runId,
    NK1_LEARNING_EXECUTION_ID: executionId,
    NK1_LEARNING_PLAN_FINGERPRINT: planFingerprint,
    NK1_LEARNING_MANIFEST_FINGERPRINT: run.manifestFingerprint,
    NK1_LEARNING_TASK_ID: run.taskId,
    NK1_LEARNING_TASK_VERSION: run.taskVersion,
    NK1_LEARNING_SEED: String(run.seed),
    NK1_LEARNING_ARM: run.arm,
    NK1_LEARNING_METHOD: run.method,
    NK1_LEARNING_RUN_DIR: runDirectory,
    NK1_LEARNING_SURVIVE_DIR: surviveDirectory,
  });
  if (trustedShadowRun !== undefined) {
    if (!nonEmpty(trustedShadowRun.runtimeVersion) || typeof trustedShadowRun.register !== 'function') {
      throw new Error('invalid trusted shadow run registrar');
    }
    // This call is deliberately before spawn(): a registry outage must prevent the run.
    await trustedShadowRun.register({
      runId: run.runId, taskId: run.taskId, seed: run.seed,
      manifestFingerprint: run.manifestFingerprint, runtimeVersion: trustedShadowRun.runtimeVersion,
    });
  }
  if (command.signal?.aborted) throw new Error('learning process cancelled before spawn');
  const inheritedEnvKeys = [...(command.inheritEnv ?? [])].sort();
  const explicitEnvKeys = Object.keys(command.env ?? {}).sort();
  // Fingerprint environment values as well as names: values can change execution
  // semantics. Only the digest is persisted, so secret values are not copied into receipts.
  const commandFingerprint = sha256(JSON.stringify({
    executable: command.executable,
    args: command.args,
    cwd: workingDirectory,
    inheritedEnv: inheritedEnvKeys.map(key => [key, env[key] ?? null]),
    explicitEnv: explicitEnvKeys.map(key => [key, env[key] ?? null]),
  }));

  let stdout = Buffer.alloc(0);
  let stderr = Buffer.alloc(0);
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let outputTruncated = false;
  let terminalStatus: LearningExecutionReceipt['status'] | null = null;
  let exitCode: number | null = null;
  let signal: string | null = null;
  let spawnFailure = '';
  // On POSIX, give the run its own process group so timeout/cancellation/output
  // limits can terminate descendants too. Windows retains direct-child semantics;
  // strong cross-platform isolation still belongs to an OS/container sandbox.
  const child = spawn(command.executable, command.args, {
    cwd: workingDirectory,
    env,
    shell: false,
    windowsHide: true,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const terminateRun = () => {
    if (process.platform !== 'win32' && child.pid !== undefined) {
      try {
        process.kill(-child.pid, 'SIGKILL');
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'ESRCH') {
          // Fall through to the direct child kill if group signaling is unavailable.
        } else {
          return;
        }
      }
    }
    try { child.kill('SIGKILL'); } catch { /* the child may already have exited */ }
  };
  const append = (current: Buffer, chunk: Buffer, isStdout: boolean): Buffer => {
    if (isStdout) stdoutBytes += chunk.length;
    else stderrBytes += chunk.length;
    const combined = Buffer.concat([current, chunk]);
    if (combined.length > maxOutputBytes) {
      outputTruncated = true;
      terminalStatus = 'output-limit';
      terminateRun();
      return combined.subarray(0, maxOutputBytes);
    }
    return combined;
  };
  child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk, true); });
  child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk, false); });
  // Track close before installing timeout/abort handlers so late notifications
  // cannot rewrite the terminal state of a process that has already exited.
  let childClosed = false;
  const timeout = setTimeout(() => {
    if (childClosed) return;
    if (!terminalStatus) terminalStatus = 'timed-out';
    terminateRun();
  }, timeoutMs);
  (timeout as unknown as { unref?: () => void }).unref?.();
  const onAbort = () => {
    if (childClosed || terminalStatus) return;
    terminalStatus = 'cancelled';
    terminateRun();
  };
  command.signal?.addEventListener('abort', onAbort, { once: true });
  if (command.signal?.aborted) onAbort();

  await new Promise<void>(resolve => {
    child.once('error', (error: Error) => {
      if (!childClosed) {
        spawnFailure = error.message;
        terminalStatus = 'spawn-error';
      }
      resolve();
    });
    child.once('close', (code: number | null, childSignal: NodeJS.Signals | null) => {
      childClosed = true;
      exitCode = code;
      signal = childSignal;
      resolve();
    });
  });
  clearTimeout(timeout);
  command.signal?.removeEventListener('abort', onAbort);
  const finishedAt = Date.now();
  if (!terminalStatus) terminalStatus = exitCode === 0 ? 'completed' : 'failed';
  const receipt: LearningExecutionReceipt = {
    schemaVersion: 2,
    executionId,
    runId: run.runId,
    planFingerprint,
    manifestFingerprint: run.manifestFingerprint,
    commandFingerprint,
    startedAt,
    finishedAt,
    durationMs: Math.max(0, finishedAt - startedAt),
    status: terminalStatus,
    exitCode,
    signal,
    stdout: stdout.toString('utf8') + (spawnFailure ? `\nSPAWN_ERROR: ${spawnFailure}` : ''),
    stderr: stderr.toString('utf8'),
    stdoutBytes,
    stderrBytes,
    outputTruncated,
    runDirectory,
    surviveDirectory,
    boundaries: [
      'A process receipt records execution, not task correctness or independent verification.',
      'The caller must keep a separate survive directory per experimental arm and control reset timing.',
      'The child process is not OS/container sandboxed by this module; use an external sandbox for untrusted learners.',
      'A child can access paths permitted by the host OS; the survive directory is not tamper-proof.',
    ],
  };
  const receiptDirectory = path.join(path.resolve(command.runRoot), 'receipts');
  await mkdir(receiptDirectory, { recursive: true });
  const receiptPath = path.join(receiptDirectory, `${executionId}.json`);
  const temporaryPath = `${receiptPath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(receipt, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await rename(temporaryPath, receiptPath);
  return { receipt, receiptPath };
}

/** Read and minimally validate a saved execution receipt before downstream use. */
export async function readLearningExecutionReceipt(receiptPath: string): Promise<LearningExecutionReceipt> {
  const parsed: unknown = JSON.parse(await readFile(receiptPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid execution receipt');
  const receipt = parsed as LearningExecutionReceipt;
  if (receipt.schemaVersion !== 2 || !nonEmpty(receipt.executionId) || !nonEmpty(receipt.runId) ||
      !/^[a-f0-9]{64}$/i.test(receipt.planFingerprint) ||
      !/^[a-f0-9]{64}$/i.test(receipt.commandFingerprint) ||
      !['completed', 'failed', 'timed-out', 'cancelled', 'output-limit', 'spawn-error'].includes(receipt.status) ||
      !Number.isFinite(receipt.startedAt) || !Number.isFinite(receipt.finishedAt) ||
      receipt.finishedAt < receipt.startedAt || !Number.isSafeInteger(receipt.stdoutBytes) ||
      !Number.isSafeInteger(receipt.stderrBytes) || typeof receipt.outputTruncated !== 'boolean') {
    throw new Error('execution receipt fields are invalid');
  }
  return receipt;
}
