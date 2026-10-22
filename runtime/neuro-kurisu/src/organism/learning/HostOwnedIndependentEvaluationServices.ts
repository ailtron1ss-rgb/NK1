import { randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import type {
  CandidateExecutionContext,
  CandidateExecutionResult,
  CandidateSandboxExecutor,
  IndependentCandidateSafetyScanner,
  IndependentTaskVerifier,
  IndependentCandidateTask,
  IndependentCandidateEvaluationConfig,
} from './IndependentSkillCandidateEvaluator.ts';
import { runLearningProcess } from './LearningProcessSupervisor.ts';

export interface HostOwnedAuthorityCommand {
  /** Absolute path to a host-owned executable. No shell is ever used. */
  executable: string;
  /** Fixed host-owned arguments; exactly one "{requestFile}" placeholder is required. */
  args: string[];
  /** Absolute working directory controlled by the host. */
  cwd: string;
  /** Private scratch root for bounded process receipts and request files. */
  runRoot: string;
  /** Dedicated persistence directory for this service; never shared between services. */
  surviveDir: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  env?: Record<string, string>;
  inheritEnv?: string[];
}
export interface HostOwnedIndependentEvaluationCommands {
  /** Must be a host-owned OS/container sandbox launcher, not the candidate itself. */
  executor: HostOwnedAuthorityCommand;
  /** Must be controlled independently from the candidate executor. */
  verifier: HostOwnedAuthorityCommand;
  /** Must be controlled independently from both executor and verifier. */
  safetyScanner: HostOwnedAuthorityCommand;
}
export interface HostOwnedIndependentEvaluationServices {
  executor: CandidateSandboxExecutor;
  verifier: IndependentTaskVerifier;
  safetyScanner: IndependentCandidateSafetyScanner;
  authorityIdentity: {
    executorExecutable: string;
    verifierExecutable: string;
    safetyScannerExecutable: string;
  };
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);

function validateCommand(command: HostOwnedAuthorityCommand, name: string): void {
  if (!command || !path.isAbsolute(command.executable) || !path.isAbsolute(command.cwd) ||
      !path.isAbsolute(command.runRoot) || !path.isAbsolute(command.surviveDir) ||
      !Array.isArray(command.args) || command.args.some(arg => typeof arg !== 'string') ||
      command.args.filter(arg => arg === '{requestFile}').length !== 1 ||
      (command.timeoutMs !== undefined && (!Number.isSafeInteger(command.timeoutMs) || command.timeoutMs < 10 || command.timeoutMs > 300_000)) ||
      (command.maxOutputBytes !== undefined && (!Number.isSafeInteger(command.maxOutputBytes) || command.maxOutputBytes < 256 || command.maxOutputBytes > 1_048_576))) {
    throw new Error('host-owned-' + name + '-command-invalid');
  }
  for (const [key, value] of Object.entries(command.env ?? {})) {
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key) || typeof value !== 'string') {
      throw new Error('host-owned-' + name + '-environment-invalid');
    }
  }
  for (const key of command.inheritEnv ?? []) {
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) throw new Error('host-owned-' + name + '-inherited-environment-invalid');
  }
}

async function prepareCommand(command: HostOwnedAuthorityCommand, name: string): Promise<HostOwnedAuthorityCommand & { executable: string }> {
  validateCommand(command, name);
  const executable = await realpath(command.executable);
  const cwd = await realpath(command.cwd);
  await access(executable, constants.X_OK);
  const roots = await Promise.all([command.runRoot, command.surviveDir].map(async root => {
    await mkdir(root, { recursive: true, mode: 0o700 });
    return realpath(root);
  }));
  if (roots[0] === roots[1] || roots[0].startsWith(roots[1] + path.sep) || roots[1].startsWith(roots[0] + path.sep)) {
    throw new Error('host-owned-' + name + '-storage-roots-must-be-disjoint');
  }
  return { ...command, executable, cwd, runRoot: roots[0], surviveDir: roots[1] };
}

function parseJsonOutput<T>(stdout: string, label: string): T {
  let parsed: unknown;
  try { parsed = JSON.parse(stdout); }
  catch { throw new Error('host-owned-' + label + '-response-invalid-json'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('host-owned-' + label + '-response-invalid');
  }
  return parsed as T;
}

async function invoke<T>(
  command: HostOwnedAuthorityCommand & { executable: string },
  name: string,
  input: unknown,
  context: { runId: string; taskId: string; seed: number; planFingerprint: string },
  signal?: AbortSignal,
): Promise<T> {
  if (!digest(context.planFingerprint) || !nonEmpty(context.runId) || !nonEmpty(context.taskId) ||
      !Number.isSafeInteger(context.seed) || context.seed < 0) {
    throw new Error('host-owned-' + name + '-context-invalid');
  }
  const requestDirectory = await mkdtemp(path.join(command.runRoot, 'nk1-authority-request-'));
  const requestFile = path.join(requestDirectory, 'request.json');
  try {
    await writeFile(requestFile, JSON.stringify({ schemaVersion: 1, authority: name, context, input }) + '\n',
      { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    const args = command.args.map(arg => arg === '{requestFile}' ? requestFile : arg);
    const result = await runLearningProcess({
      runId: context.runId,
      manifestFingerprint: context.planFingerprint,
      taskId: context.taskId,
      taskVersion: 'independent-evaluation-v1',
      seed: context.seed,
      arm: 'candidate',
      method: 'independent-' + name,
    }, context.planFingerprint, {
      executable: command.executable,
      args,
      cwd: command.cwd,
      runRoot: command.runRoot,
      surviveDir: command.surviveDir,
      timeoutMs: command.timeoutMs ?? 30_000,
      maxOutputBytes: command.maxOutputBytes ?? 262_144,
      signal,
      env: { ...(command.env ?? {}), NK1_AUTHORITY_PROTOCOL: 'nk1-json-v1' },
      inheritEnv: command.inheritEnv ?? [],
    });
    if (result.receipt.status !== 'completed' || result.receipt.exitCode !== 0 ||
        result.receipt.outputTruncated || result.receipt.stdoutBytes > (command.maxOutputBytes ?? 262_144)) {
      throw new Error('host-owned-' + name + '-execution-not-clean');
    }
    return parseJsonOutput<T>(result.receipt.stdout, name);
  } finally {
    await rm(requestDirectory, { recursive: true, force: true });
  }
}

/**
 * Binds three host-owned JSON-over-process services to the canonical P23 evaluator.
 * This adapter provides bounded subprocess supervision, separate executable identity,
 * private request files and strict response parsing. It does NOT itself create an OS
 * sandbox: the configured executor executable must be a trusted sandbox launcher that
 * enforces filesystem/network/resource isolation for untrusted candidate code.
 */
export async function createHostOwnedIndependentEvaluationServices(
  configured: HostOwnedIndependentEvaluationCommands,
): Promise<HostOwnedIndependentEvaluationServices> {
  const [executorCommand, verifierCommand, safetyCommand] = await Promise.all([
    prepareCommand(configured.executor, 'executor'),
    prepareCommand(configured.verifier, 'verifier'),
    prepareCommand(configured.safetyScanner, 'safety-scanner'),
  ]);
  if (new Set([executorCommand.executable, verifierCommand.executable, safetyCommand.executable]).size !== 3) {
    throw new Error('host-owned-evaluation-authorities-must-use-distinct-executables');
  }
  const storageRoots = [
    executorCommand.runRoot, executorCommand.surviveDir,
    verifierCommand.runRoot, verifierCommand.surviveDir,
    safetyCommand.runRoot, safetyCommand.surviveDir,
  ];
  for (let i = 0; i < storageRoots.length; i += 1) {
    for (let j = i + 1; j < storageRoots.length; j += 1) {
      if (storageRoots[i] === storageRoots[j] ||
          storageRoots[i].startsWith(storageRoots[j] + path.sep) ||
          storageRoots[j].startsWith(storageRoots[i] + path.sep)) {
        throw new Error('host-owned-evaluation-authority-storage-roots-must-be-disjoint');
      }
    }
  }
  return {
    authorityIdentity: {
      executorExecutable: executorCommand.executable,
      verifierExecutable: verifierCommand.executable,
      safetyScannerExecutable: safetyCommand.executable,
    },
    executor: {
      async execute({ payload, task, context, signal }): Promise<CandidateExecutionResult> {
        if (signal?.aborted) throw new Error('host-owned-executor-aborted');
        const result = await invoke<Record<string, unknown>>(executorCommand, 'executor',
          { payload, task, context }, {
            runId: context.plannedRunId ?? randomUUID(),
            taskId: task.taskId,
            seed: task.seed,
            planFingerprint: context.planFingerprint,
          }, signal);
        if (signal?.aborted) throw new Error('host-owned-executor-aborted');
        if (!nonEmpty(result.runId) || !Array.isArray(result.observedStepIds) ||
            result.observedStepIds.some(step => !nonEmpty(step)) ||
            new Set(result.observedStepIds).size !== result.observedStepIds.length) {
          throw new Error('host-owned-executor-response-invalid');
        }
        return { runId: result.runId, observedStepIds: result.observedStepIds as string[],
          ...(result.metadata && typeof result.metadata === 'object' && !Array.isArray(result.metadata)
            ? { metadata: result.metadata as Record<string, unknown> } : {}) };
      },
    },
    verifier: {
      async verify({ task, execution, context, signal }) {
        if (signal?.aborted) throw new Error('host-owned-verifier-aborted');
        const result = await invoke<Record<string, unknown>>(verifierCommand, 'verifier',
          { task, execution, context }, {
            runId: execution.runId, taskId: task.taskId, seed: task.seed, planFingerprint: context.planFingerprint,
          }, signal);
        if (signal?.aborted) throw new Error('host-owned-verifier-aborted');
        if (typeof result.bindingVerified !== 'boolean' || typeof result.passed !== 'boolean' ||
            !Array.isArray(result.coveredCapabilityIds) || result.coveredCapabilityIds.some(id => !nonEmpty(id)) ||
            new Set(result.coveredCapabilityIds).size !== result.coveredCapabilityIds.length) {
          throw new Error('host-owned-verifier-response-invalid');
        }
        return { bindingVerified: result.bindingVerified, passed: result.passed,
          coveredCapabilityIds: result.coveredCapabilityIds as string[] };
      },
    },
    safetyScanner: {
      async scan({ payload, task, execution, context, signal }) {
        if (signal?.aborted) throw new Error('host-owned-safety-scanner-aborted');
        const result = await invoke<Record<string, unknown>>(safetyCommand, 'safety-scanner',
          { payload, task, ...(execution ? { execution } : {}), context }, {
            runId: execution?.runId ?? randomUUID(), taskId: task.taskId, seed: task.seed,
            planFingerprint: context.planFingerprint,
          }, signal);
        if (signal?.aborted) throw new Error('host-owned-safety-scanner-aborted');
        if (!Number.isSafeInteger(result.violationCount) || Number(result.violationCount) < 0) {
          throw new Error('host-owned-safety-scanner-response-invalid');
        }
        return { violationCount: Number(result.violationCount) };
      },
    },
  };
}


export interface HostOwnedIndependentEvaluationFactoryOptions<TInput> {
  commands: HostOwnedIndependentEvaluationCommands;
  tasksForRepair(repair: TInput): IndependentCandidateEvaluationConfig['tasks'];
  environmentFingerprintForRepair(repair: TInput): string;
  experimentAuthorityForRepair?(repair: TInput): IndependentCandidateEvaluationConfig['experimentAuthority'];
  serviceTimeoutMs?: number;
}

/**
 * Prepares trusted host executables once, then supplies a synchronous config factory
 * suitable for RuntimeConfig.compoundRepairRevision.independentEvaluationConfigForRepair.
 * Task plans, environment identity and experiment authority remain owned by the host.
 */
export async function createHostOwnedIndependentEvaluationConfigFactory<TInput>(
  input: HostOwnedIndependentEvaluationFactoryOptions<TInput>,
): Promise<(repair: TInput) => IndependentCandidateEvaluationConfig & {
  commands: HostOwnedIndependentEvaluationCommands;
  tasksForRepair(repair: TInput): IndependentCandidateEvaluationConfig['tasks'];
  environmentFingerprintForRepair(repair: TInput): string;
  experimentAuthorityForRepair?(repair: TInput): IndependentCandidateEvaluationConfig['experimentAuthority'];
  serviceTimeoutMs?: number;
}): Promise<(repair: TInput) => IndependentCandidateEvaluationConfig & {
  authorityIdentity: HostOwnedIndependentEvaluationServices['authorityIdentity'];
}> {
  const services = await createHostOwnedIndependentEvaluationServices(input.commands);
  return repair => {
    const tasks = input.tasksForRepair(repair);
    const environmentFingerprint = input.environmentFingerprintForRepair(repair);
    if (!Array.isArray(tasks) || !digest(environmentFingerprint)) {
      throw new Error('host-owned-independent-evaluation-repair-config-invalid');
    }
    const experimentAuthority = input.experimentAuthorityForRepair?.(repair);
    return {
      tasks,
      environmentFingerprint,
      executor: services.executor,
      verifier: services.verifier,
      safetyScanner: services.safetyScanner,
      ...(experimentAuthority ? { experimentAuthority } : {}),
      ...(input.serviceTimeoutMs === undefined ? {} : { serviceTimeoutMs: input.serviceTimeoutMs }),
      authorityIdentity: services.authorityIdentity,
    };
  };
}
