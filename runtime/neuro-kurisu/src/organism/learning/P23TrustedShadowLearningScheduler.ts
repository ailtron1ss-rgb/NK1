import { randomUUID } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SkillShadowObservation } from './VersionedSkillCandidateStore.ts';
import type { LearningProcessCommand, LearningProcessResult, LearningProcessRun } from './LearningProcessSupervisor.ts';

export interface TrustedShadowLearningScheduleConfig {
  /** Explicit opt-in; the runtime must never launch a child process by default. */
  enabled: boolean;
  /** Runtime-clock cadence; 15 minutes by default. */
  intervalMs?: number;
  /** First launch delay; defaults to intervalMs. */
  initialDelayMs?: number;
  runtimeVersion: string;
  taskId: string;
  taskVersion: string;
  seedBase?: number;
  /** Existing staged skill candidate to receive independently signed shadow observations. */
  candidateId?: string;
  /** Basename written inside NK1_LEARNING_RUN_DIR; never an arbitrary path. */
  observationFileName?: string;
  manifestFingerprint: string;
  planFingerprint: string;
  command: LearningProcessCommand;
}

export interface TrustedShadowLearningCore {
  runTrustedSkillShadowLearningProcess(input: {
    runtimeVersion: string;
    run: LearningProcessRun;
    planFingerprint: string;
    command: LearningProcessCommand;
  }): Promise<LearningProcessResult>;
  recordVerifiedSkillShadow(candidateId: string, observation: SkillShadowObservation): unknown | Promise<unknown>;
}

export interface TrustedShadowLearningSchedulerSnapshot {
  enabled: true;
  runsStarted: number;
  inFlight: boolean;
  lastRunId: string | null;
  lastSeed: number | null;
  lastStartedAt: number;
  lastFinishedAt: number;
  lastStatus: LearningProcessResult['receipt']['status'] | 'running' | 'error' | 'idle';
  lastExitCode: number | null;
  lastError: string | null;
  lastEvidenceStatus: 'not-configured' | 'not-attempted' | 'pending' | 'accepted' | 'missing' | 'rejected';
  lastEvidenceError: string | null;
}

const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;
const isPlainRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Production environment loader. No setting means the runtime clock remains
 * disabled. If configured, the operator must provide a real staged candidate,
 * exact task/manifest/plan identity and a child command; malformed settings
 * abort startup rather than silently degrading into execution-only runs.
 */
export function parseTrustedShadowLearningScheduleConfig(
  raw: string | undefined,
): TrustedShadowLearningScheduleConfig | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error('NEURO_SKILL_SHADOW_SCHEDULER_JSON must be valid JSON'); }
  if (!isPlainRecord(value) || value.enabled !== true) {
    throw new Error('NEURO_SKILL_SHADOW_SCHEDULER_JSON must be an enabled configuration object');
  }
  const allowed = new Set([
    'enabled', 'intervalMs', 'initialDelayMs', 'runtimeVersion', 'taskId', 'taskVersion',
    'seedBase', 'candidateId', 'observationFileName', 'manifestFingerprint', 'planFingerprint', 'command',
  ]);
  if (Object.keys(value).some(key => !allowed.has(key))) {
    throw new Error('NEURO_SKILL_SHADOW_SCHEDULER_JSON contains unknown configuration fields');
  }
  if (!nonEmpty(value.runtimeVersion) || !nonEmpty(value.taskId) || !nonEmpty(value.taskVersion)) {
    throw new Error('trusted shadow runtime/task identity must be non-empty strings');
  }
  if (!validFingerprint(value.manifestFingerprint) || !validFingerprint(value.planFingerprint)) {
    throw new Error('trusted shadow schedule requires valid manifestFingerprint and planFingerprint SHA-256 values');
  }
  if (typeof value.candidateId !== 'string' || !/^[a-f0-9]{64}$/i.test(value.candidateId)) {
    throw new Error('trusted shadow schedule requires a 64-hex staged candidateId');
  }
  if (value.seedBase !== undefined && !safeInteger(value.seedBase, 0, Number.MAX_SAFE_INTEGER)) {
    throw new Error('trusted shadow seedBase must be a non-negative safe integer');
  }
  for (const [key, max] of [['intervalMs', MAX_INTERVAL_MS], ['initialDelayMs', MAX_INTERVAL_MS]] as const) {
    const candidate = value[key];
    if (candidate !== undefined && !safeInteger(candidate, key === 'intervalMs' ? 1_000 : 0, max)) {
      throw new Error(`trusted shadow ${key} is out of bounds`);
    }
  }
  const cmd = value.command;
  if (!isPlainRecord(cmd) || !nonEmpty(cmd.executable) || !nonEmpty(cmd.cwd) ||
      !nonEmpty(cmd.runRoot) || !nonEmpty(cmd.surviveDir) ||
      !Array.isArray(cmd.args) || cmd.args.some(arg => typeof arg !== 'string')) {
    throw new Error('trusted shadow schedule command must specify executable, string args, cwd, runRoot and surviveDir');
  }
  if (cmd.env !== undefined && (!isPlainRecord(cmd.env) ||
      Object.values(cmd.env).some(entry => typeof entry !== 'string'))) {
    throw new Error('trusted shadow command env must be a string-to-string object');
  }
  if (cmd.inheritEnv !== undefined && (!Array.isArray(cmd.inheritEnv) ||
      cmd.inheritEnv.some(key => typeof key !== 'string' || !/^[A-Z_][A-Z0-9_]*$/i.test(key)))) {
    throw new Error('trusted shadow command inheritEnv must contain valid environment variable names');
  }
  for (const key of ['timeoutMs', 'maxOutputBytes'] as const) {
    const bound = key === 'timeoutMs' ? 3_600_000 : 16_777_216;
    if (cmd[key] !== undefined && !safeInteger(cmd[key], 1, bound)) {
      throw new Error(`trusted shadow command ${key} is out of bounds`);
    }
  }
  const observationFileName = value.observationFileName ?? 'verified-skill-shadow-observation.json';
  if (typeof observationFileName !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(observationFileName) ||
      observationFileName === '.' || observationFileName === '..') {
    throw new Error('trusted shadow observationFileName must be a safe basename');
  }
  return {
    enabled: true,
    runtimeVersion: value.runtimeVersion,
    taskId: value.taskId,
    taskVersion: value.taskVersion,
    manifestFingerprint: value.manifestFingerprint,
    planFingerprint: value.planFingerprint,
    candidateId: value.candidateId,
    observationFileName,
    ...(value.intervalMs !== undefined ? { intervalMs: value.intervalMs as number } : {}),
    ...(value.initialDelayMs !== undefined ? { initialDelayMs: value.initialDelayMs as number } : {}),
    ...(value.seedBase !== undefined ? { seedBase: value.seedBase as number } : {}),
    command: {
      executable: cmd.executable,
      args: [...cmd.args] as string[],
      cwd: cmd.cwd,
      runRoot: cmd.runRoot,
      surviveDir: cmd.surviveDir,
      ...(cmd.timeoutMs !== undefined ? { timeoutMs: cmd.timeoutMs as number } : {}),
      ...(cmd.maxOutputBytes !== undefined ? { maxOutputBytes: cmd.maxOutputBytes as number } : {}),
      ...(cmd.env !== undefined ? { env: { ...(cmd.env as Record<string, string>) } } : {}),
      ...(cmd.inheritEnv !== undefined ? { inheritEnv: [...cmd.inheritEnv] as string[] } : {}),
    },
  };
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const validFingerprint = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v);
const safeInteger = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;

/**
 * The actual runtime-clock adapter for Core-owned trusted shadow execution.
 * It constructs a candidate/shadow run from operator-supplied task provenance
 * and always routes execution through OrganismCore's registration capability.
 * A completed process receipt is execution evidence only, never proof of task
 * correctness, signed skill evidence, or promotion authorization.
 */
export class P23TrustedShadowLearningScheduler {
  private inFlight: Promise<LearningProcessResult> | null = null;
  private state: TrustedShadowLearningSchedulerSnapshot = {
    enabled: true, runsStarted: 0, inFlight: false, lastRunId: null,
    lastSeed: null, lastStartedAt: 0, lastFinishedAt: 0,
    lastStatus: 'idle', lastExitCode: null, lastError: null,
    lastEvidenceStatus: 'not-configured', lastEvidenceError: null,
  };
  readonly intervalMs: number;
  readonly initialDelayMs: number;
  private readonly config: TrustedShadowLearningScheduleConfig;
  private readonly core: TrustedShadowLearningCore;

  constructor(core: TrustedShadowLearningCore, config: TrustedShadowLearningScheduleConfig) {
    this.core = core;
    if (!config || config.enabled !== true) throw new Error('trusted shadow runtime schedule requires explicit enablement');
    if (!nonEmpty(config.runtimeVersion) || !nonEmpty(config.taskId) || !nonEmpty(config.taskVersion)) {
      throw new Error('trusted shadow runtime task identity is incomplete');
    }
    if (!validFingerprint(config.manifestFingerprint) || !validFingerprint(config.planFingerprint)) {
      throw new Error('trusted shadow runtime requires manifest and plan SHA-256 fingerprints');
    }
    if (config.seedBase !== undefined && !safeInteger(config.seedBase, 0, Number.MAX_SAFE_INTEGER)) {
      throw new Error('trusted shadow seedBase is invalid');
    }
    if (config.candidateId !== undefined && !/^[a-f0-9]{64}$/i.test(config.candidateId)) {
      throw new Error('trusted shadow candidateId must be a 64-hex candidate fingerprint when configured');
    }
    const observationFileName = config.observationFileName ?? 'verified-skill-shadow-observation.json';
    if (config.candidateId && (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(observationFileName) || observationFileName === '.' || observationFileName === '..')) {
      throw new Error('trusted shadow observation file must be a safe basename');
    }
    this.intervalMs = config.intervalMs ?? 15 * 60_000;
    this.initialDelayMs = config.initialDelayMs ?? this.intervalMs;
    if (!safeInteger(this.intervalMs, 1_000, MAX_INTERVAL_MS) ||
        !safeInteger(this.initialDelayMs, 0, MAX_INTERVAL_MS)) {
      throw new Error('trusted shadow runtime cadence is out of bounds');
    }
    if (!config.command || !nonEmpty(config.command.executable) || !Array.isArray(config.command.args) ||
        config.command.args.some(arg => typeof arg !== 'string') || !nonEmpty(config.command.cwd) ||
        !nonEmpty(config.command.runRoot) || !nonEmpty(config.command.surviveDir)) {
      throw new Error('trusted shadow runtime command is incomplete');
    }
    this.config = {
      ...config,
      observationFileName,
      command: {
        ...config.command,
        args: [...config.command.args],
        env: {
          ...(config.command.env ?? {}),
          ...(config.candidateId ? { NK1_SKILL_CANDIDATE_ID: config.candidateId } : {}),
          ...(config.candidateId ? { NK1_LEARNING_SIGNED_OBSERVATION_FILENAME: observationFileName } : {}),
        },
        ...(config.command.inheritEnv ? { inheritEnv: [...config.command.inheritEnv] } : {}),
      },
    };
    this.state.lastEvidenceStatus = config.candidateId ? 'not-attempted' : 'not-configured';
  }

  runOnce(runtimeTick: number): Promise<LearningProcessResult> {
    if (this.inFlight) return this.inFlight;
    if (!safeInteger(runtimeTick, 0, Number.MAX_SAFE_INTEGER)) {
      throw new Error('trusted shadow runtime tick is invalid');
    }
    const seedBase = this.config.seedBase ?? 0;
    // Include the per-process sequence as well as the persistent organism tick:
    // repeated maintenance-clock wakes must not silently reuse a seed just because
    // the cognitive loop is paused or manual-only.
    const seed = ((seedBase % 1_000_000_000) +
      (runtimeTick % 1_000_000_000) +
      (this.state.runsStarted % 1_000_000_000)) % 1_000_000_000;
    const run: LearningProcessRun = {
      runId: `nk1-shadow-${randomUUID()}`,
      manifestFingerprint: this.config.manifestFingerprint,
      taskId: this.config.taskId,
      taskVersion: this.config.taskVersion,
      seed,
      arm: 'candidate',
      method: 'shadow',
    };
    this.state.runsStarted += 1;
    this.state.lastRunId = run.runId;
    this.state.lastSeed = seed;
    this.state.lastStartedAt = Date.now();
    this.state.lastStatus = 'running';
    this.state.lastExitCode = null;
    this.state.lastError = null;
    this.state.lastEvidenceError = null;
    this.state.lastEvidenceStatus = this.config.candidateId ? 'pending' : 'not-configured';
    this.state.inFlight = true;

    let tracked: Promise<LearningProcessResult>;
    tracked = Promise.resolve().then(() => this.core.runTrustedSkillShadowLearningProcess({
      runtimeVersion: this.config.runtimeVersion,
      run,
      planFingerprint: this.config.planFingerprint,
      command: this.config.command,
    })).then(async result => {
      this.state.lastStatus = result.receipt.status;
      this.state.lastExitCode = result.receipt.exitCode;
      this.state.lastFinishedAt = Date.now();
      if (!this.config.candidateId) {
        this.state.lastEvidenceStatus = 'not-configured';
        return result;
      }
      if (result.receipt.status !== 'completed') {
        this.state.lastEvidenceStatus = 'not-attempted';
        return result;
      }
      const observationPath = join(result.receipt.runDirectory, this.config.observationFileName!);
      try {
        const stat = await lstat(observationPath);
        if (stat.isSymbolicLink() || !stat.isFile()) {
          throw new Error('signed shadow observation must be a regular file inside the isolated run directory');
        }
        if (stat.size > 1_048_576) {
          throw new Error('signed shadow observation exceeds the 1 MiB ingestion limit');
        }
        const parsed: unknown = JSON.parse(await readFile(observationPath, 'utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('signed shadow observation JSON must be an object');
        }
        const observation = parsed as SkillShadowObservation;
        const signedRunId = observation.artifact?.payload?.runId;
        if (observation.runId !== run.runId || signedRunId !== run.runId) {
          throw new Error('signed shadow observation run ID does not match the supervisor-created run');
        }
        // Core/P23's configured candidate store performs signature, candidate-version,
        // and independently registered task/seed/manifest/runtime checks. This adapter
        // never treats stdout, exit code or unsigned fields as task-correctness evidence.
        await this.core.recordVerifiedSkillShadow(this.config.candidateId, observation);
        this.state.lastEvidenceStatus = 'accepted';
        this.state.lastEvidenceError = null;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException)?.code;
        this.state.lastEvidenceStatus = code === 'ENOENT' ? 'missing' : 'rejected';
        this.state.lastEvidenceError = String((error as Error)?.message ?? error).slice(0, 500);
      }
      return result;
    }).catch(error => {
      this.state.lastStatus = 'error';
      this.state.lastError = String((error as Error)?.message ?? error).slice(0, 500);
      this.state.lastFinishedAt = Date.now();
      throw error;
    }).finally(() => {
      this.state.inFlight = false;
      if (this.inFlight === tracked) this.inFlight = null;
    });
    this.inFlight = tracked;
    return tracked;
  }

  async drain(): Promise<void> {
    const pending = this.inFlight;
    if (pending) await pending.catch(() => undefined);
  }

  snapshot(): TrustedShadowLearningSchedulerSnapshot {
    return { ...this.state };
  }
}
