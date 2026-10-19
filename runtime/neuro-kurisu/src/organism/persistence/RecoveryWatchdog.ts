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
      lastCheckpointAt:nowAt,
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
      };
      await this.persist();
    }
    return this.snapshot();
  }

  heartbeat(input: RecoveryProbe = {}): RecoveryWatchdogState {
    const at = input.now ?? now();
    this.state.lastHeartbeatAt = at;
    this.state.lastCheckpointAt = at;
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
    this.state.lastCheckpointAt = at;
    this.state.status = 'recovered';
    return this.snapshot();
  }

  async checkpoint(input: RecoveryProbe = {}): Promise<RecoveryWatchdogState> {
    this.heartbeat(input);
    await this.persist();
    return this.snapshot();
  }

  snapshot(): RecoveryWatchdogState { return structuredClone(this.state); }

  private async persist(): Promise<void> { if (this.store) await this.store.save(this.state); }
}
