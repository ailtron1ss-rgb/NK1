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

  constructor(private readonly core: TrustedShadowLearningCore, config: TrustedShadowLearningScheduleConfig) {
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
    if (config.candidateId !== undefined && !nonEmpty(config.candidateId)) {
      throw new Error('trusted shadow candidateId must be non-empty when configured');
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
