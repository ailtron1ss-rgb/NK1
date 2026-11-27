import { FileStateStore } from './FileStateStore.ts';

export type RecoveryStatus = 'healthy'|'stale'|'recovered';

export interface RecoveryWatchdogState {
  version: 1;
  organismId: string;
  bootId: string;
  previousBootId: string;
  startedAt: number;
  lastHeartbeatAt: number;
  lastCheckpointAt: number;
  lastTick: number;
  lastLearningCount: number;
  recoveryCount: number;
  lastRecoveryAt: number;
  lastRecoveryReason: string;
  status: RecoveryStatus;
  staleAfterMs: number;
}

export interface RecoveryProbe {
  now?: number;
  staleAfterMs?: number;
  tick?: number;
  learningCount?: number;
}

const now = () => Date.now();
const clampInt = (v:number, min=0) => Number.isFinite(v) ? Math.max(min, Math.floor(v)) : min;
const safeCheckpointTime = (value:unknown, nowAt:number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= nowAt + 60_000;

/**
 * RecoveryWatchdog distinguishes process liveness from a durable checkpoint.
 * Only a successful persistence boundary may advance lastCheckpointAt.
 */
export class RecoveryWatchdog {
  private state: RecoveryWatchdogState;
  private readonly store?: FileStateStore<RecoveryWatchdogState>;

  constructor(organismId: string, store?: FileStateStore<RecoveryWatchdogState>, nowAt=now()) {
    this.store = store;
    this.state = {
      version:1,
      organismId,
      bootId:`${process.pid}-${nowAt}-${Math.random().toString(36).slice(2,8)}`,
      previousBootId:'',
      startedAt:nowAt,
      lastHeartbeatAt:nowAt,
      // Construction is not a persistence event; until the first successful store
      // write, the watchdog must report that no durable checkpoint is known.
      lastCheckpointAt:0,
      lastTick:0,
      lastLearningCount:0,
      recoveryCount:0,
      lastRecoveryAt:0,
      lastRecoveryReason:'',
      status:'healthy',
      staleAfterMs:30000,
    };
  }

  async restore(nowAt=now(), rawOverride?: RecoveryWatchdogState): Promise<RecoveryWatchdogState> {
    const raw = rawOverride ?? (this.store ? await this.store.load() : null);
    if (raw) {
      const currentBootId=this.state.bootId;
      const checkpointAt = safeCheckpointTime(raw.lastCheckpointAt, nowAt)
        ? raw.lastCheckpointAt
        : 0;
      this.state = {
        ...this.state,
        ...raw,
        bootId:currentBootId,
        previousBootId:String(raw.bootId ?? ''),
        status:'recovered',
        lastRecoveryAt:nowAt,
        recoveryCount:clampInt(raw.recoveryCount)+1,
        lastRecoveryReason:'process-resume',
        lastHeartbeatAt:nowAt,
        // A missing, malformed, negative or implausibly future timestamp is not
        // evidence of a durable save. Do not coerce strings into timestamps.
        lastCheckpointAt:checkpointAt,
      };
      await this.persist();
    }
    return this.snapshot();
  }

  heartbeat(input: RecoveryProbe = {}): RecoveryWatchdogState {
    const at = input.now ?? now();
    this.state.lastHeartbeatAt = at;
    // Liveness/tick progress must remain visible even if the next disk write fails.
    // A heartbeat never advances the durable checkpoint marker.
    if (input.tick !== undefined) this.state.lastTick = clampInt(input.tick);
    if (input.learningCount !== undefined) this.state.lastLearningCount = clampInt(input.learningCount);
    this.state.status = 'healthy';
    return this.snapshot();
  }

  observe(input: RecoveryProbe = {}): RecoveryWatchdogState {
    const at = input.now ?? now();
    const staleAfter = Math.max(1000, Math.floor(input.staleAfterMs ?? this.state.staleAfterMs));
    this.state.staleAfterMs = staleAfter;
    const age = Math.max(0, at - this.state.lastHeartbeatAt);
    this.state.status = age >= staleAfter ? 'stale' : this.state.status;
    return this.snapshot();
  }

  markRecovered(reason='watchdog-recovery', at=now()): RecoveryWatchdogState {
    this.state.recoveryCount += 1;
    this.state.lastRecoveryAt = at;
    this.state.lastRecoveryReason = reason;
    this.state.lastHeartbeatAt = at;
    // A recovery decision is not proof that the new process has committed a checkpoint.
    this.state.status = 'recovered';
    return this.snapshot();
  }

  /** Detached candidate to place inside the canonical Core checkpoint before save(). */
  checkpointCandidate(at=now()): RecoveryWatchdogState {
    if (!Number.isSafeInteger(at) || at < 0) throw new Error('recovery-watchdog-checkpoint-time-invalid');
    return { ...this.snapshot(), lastCheckpointAt:at };
  }

  /** Publish the in-memory durable marker only after the canonical store accepts the candidate. */
  commitCheckpoint(at=now()): RecoveryWatchdogState {
    if (!Number.isSafeInteger(at) || at < 0) throw new Error('recovery-watchdog-checkpoint-time-invalid');
    this.state.lastCheckpointAt = at;
    return this.snapshot();
  }

  /**
   * Standalone persistence remains supported for explicitly injected stores.
   * The candidate is persisted first; a failed write leaves liveness fresh but
   * leaves the previous durable timestamp untouched.
   */
  async checkpoint(input: RecoveryProbe = {}): Promise<RecoveryWatchdogState> {
    const at = input.now ?? now();
    const previousCheckpointAt = this.state.lastCheckpointAt;
    this.heartbeat({ ...input, now:at });
    // Liveness without a persistence owner is not evidence of a durable checkpoint.
    if (!this.store) return this.snapshot();
    const candidate = this.checkpointCandidate(at);
    try {
      await this.persist(candidate);
    } catch (error) {
      this.state.lastCheckpointAt = previousCheckpointAt;
      throw error;
    }
    return this.commitCheckpoint(at);
  }

  snapshot(): RecoveryWatchdogState { return structuredClone(this.state); }

  private async persist(value: RecoveryWatchdogState = this.state): Promise<void> {
    if (this.store) await this.store.save(value);
  }
}
