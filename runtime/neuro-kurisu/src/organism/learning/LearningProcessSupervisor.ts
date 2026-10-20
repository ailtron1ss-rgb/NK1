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
}
export interface LearningExecutionReceipt {
  schemaVersion: 1;
  executionId: string;
  runId: string;
  planFingerprint: string;
  commandFingerprint: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  status: 'completed' | 'failed' | 'timed-out' | 'output-limit' | 'spawn-error';
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
 * evidence only: exit code/output are NOT verified task outcomes.
 */
export async function runLearningProcess(
  run: LearningProcessRun,
  planFingerprint: string,
  command: LearningProcessCommand,
): Promise<LearningProcessResult> {
  if (!run || !nonEmpty(run.runId) || !/^[a-f0-9]{64}$/i.test(run.manifestFingerprint) ||
      !nonEmpty(run.taskId) || !nonEmpty(run.taskVersion) || !nonEmpty(run.arm) || !nonEmpty(run.method) ||
      !safeInteger(run.seed, 0, Number.MAX_SAFE_INTEGER)) throw new Error('invalid scheduled learning run');
  if (!/^[a-f0-9]{64}$/i.test(planFingerprint)) throw new Error('invalid plan fingerprint');
  if (!nonEmpty(command?.executable) || !Array.isArray(command.args) ||
      command.args.some(arg => typeof arg !== 'string') || !nonEmpty(command.cwd) ||
      !nonEmpty(command.runRoot) || !nonEmpty(command.surviveDir)) throw new Error('invalid process command');
  const timeoutMs = command.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = command.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  if (!safeInteger(timeoutMs, 1, MAX_TIMEOUT_MS)) throw new Error('timeoutMs out of bounds');
  if (!safeInteger(maxOutputBytes, 1, MAX_OUTPUT_BYTES)) throw new Error('maxOutputBytes out of bounds');

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
  const commandFingerprint = sha256(JSON.stringify({
    executable: command.executable, args: command.args, cwd: path.resolve(command.cwd),
    inheritedEnvKeys: [...(command.inheritEnv ?? [])].sort(),
    explicitEnvKeys: Object.keys(command.env ?? {}).sort(),
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
  const child = spawn(command.executable, command.args, {
    cwd: path.resolve(command.cwd),
    env,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const append = (current: Buffer, chunk: Buffer, isStdout: boolean): Buffer => {
    if (isStdout) stdoutBytes += chunk.length;
    else stderrBytes += chunk.length;
    const combined = Buffer.concat([current, chunk]);
    if (combined.length > maxOutputBytes) {
      outputTruncated = true;
      terminalStatus = 'output-limit';
      child.kill('SIGKILL');
      return combined.subarray(0, maxOutputBytes);
    }
    return combined;
  };
  child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk, true); });
  child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk, false); });
  const timeout = setTimeout(() => {
    if (!terminalStatus) terminalStatus = 'timed-out';
    child.kill('SIGKILL');
  }, timeoutMs);
  timeout.unref?.();

  await new Promise<void>(resolve => {
    child.once('error', error => { spawnFailure = error.message; terminalStatus = 'spawn-error'; resolve(); });
    child.once('close', (code, childSignal) => {
      exitCode = code;
      signal = childSignal;
      resolve();
    });
  });
  clearTimeout(timeout);
  const finishedAt = Date.now();
  if (!terminalStatus) terminalStatus = exitCode === 0 ? 'completed' : 'failed';
  const receipt: LearningExecutionReceipt = {
    schemaVersion: 1,
    executionId,
    runId: run.runId,
    planFingerprint,
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
  if (receipt.schemaVersion !== 1 || !nonEmpty(receipt.executionId) || !nonEmpty(receipt.runId) ||
      !/^[a-f0-9]{64}$/i.test(receipt.planFingerprint) ||
      !/^[a-f0-9]{64}$/i.test(receipt.commandFingerprint) ||
      !['completed', 'failed', 'timed-out', 'output-limit', 'spawn-error'].includes(receipt.status) ||
      !Number.isFinite(receipt.startedAt) || !Number.isFinite(receipt.finishedAt) ||
      receipt.finishedAt < receipt.startedAt || !Number.isSafeInteger(receipt.stdoutBytes) ||
      !Number.isSafeInteger(receipt.stderrBytes) || typeof receipt.outputTruncated !== 'boolean') {
    throw new Error('execution receipt fields are invalid');
  }
  return receipt;
}
