export type PersistenceDurabilityProfile = 'quality'|'balanced'|'mobile';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface PersistenceDurabilityState {
  version: 1;
  decisions: number;
  lastDecision: 'default'|'save-cost'|'resource-pressure'|'battery-risk';
  effectiveMaxDirtyCycles: number;
  targetCrashLossCycles: number;
  lastPayloadBytes: number;
  lastSaveMs: number;
  estimatedWriteAmplification01: number;
  lastAt: number;
}

export interface PersistenceDurabilityInput {
  profile: PersistenceDurabilityProfile;
  baseMaxDirtyCycles: number;
  battery01: number;
  thermal01: number;
  ramPressure01: number;
  payloadBytes?: number;
  saveMs?: number;
}

/**
 * B320 adaptive durability controller.
 * It balances crash-loss risk against the real cost of serializing the organism.
 * It does not decide whether a checkpoint is allowed; it only chooses a bounded
 * dirty-cycle window for the next full durable checkpoint.
 */
export class PersistenceDurabilityGovernor {
  private state: PersistenceDurabilityState = {
    version: 1,
    decisions: 0,
    lastDecision: 'default',
    effectiveMaxDirtyCycles: 1,
    targetCrashLossCycles: 1,
    lastPayloadBytes: 0,
    lastSaveMs: 0,
    estimatedWriteAmplification01: 0,
    lastAt: 0,
  };

  restore(raw?: Partial<PersistenceDurabilityState>|null): void {
    this.state = { ...this.state, ...(raw ?? {}) };
  }

  decide(input: PersistenceDurabilityInput): number {
    const base = Math.max(1, Math.floor(input.baseMaxDirtyCycles));
    const battery = clamp(input.battery01);
    const thermal = clamp(input.thermal01);
    const ram = clamp(input.ramPressure01);
    const bytes = Math.max(0, Number(input.payloadBytes ?? this.state.lastPayloadBytes ?? 0));
    const saveMs = Math.max(0, Number(input.saveMs ?? this.state.lastSaveMs ?? 0));

    let window = base;
    let reason: PersistenceDurabilityState['lastDecision'] = 'default';

    // Large/slow writes create real phone-side write amplification. Increase the
    // dirty window, but keep it bounded so the state does not become dangerously stale.
    const largeState = bytes >= 1024 * 1024;
    const veryLargeState = bytes >= 2 * 1024 * 1024;
    const slowWrite = saveMs >= 150;
    const verySlowWrite = saveMs >= 300;
    if (veryLargeState || verySlowWrite) {
      window = Math.ceil(window * 2);
      reason = 'save-cost';
    } else if (largeState || slowWrite) {
      window = Math.ceil(window * 1.5);
      reason = 'save-cost';
    }

    // Thermal/RAM pressure means another large synchronous save is expensive.
    if (thermal >= .82 || ram >= .86) {
      window = Math.ceil(window * 1.5);
      reason = 'resource-pressure';
    }

    // Low battery is the opposite: losing many cycles is more dangerous than
    // paying some additional write cost. We deliberately override the expansion.
    if (battery <= .18) {
      window = Math.max(1, Math.floor(base * .5));
      reason = 'battery-risk';
    } else if (battery <= .30) {
      window = Math.max(1, Math.floor(base * .75));
      reason = 'battery-risk';
    }

    const profileCap = input.profile === 'quality' ? 16 : input.profile === 'balanced' ? 24 : 32;
    const floor = input.profile === 'quality' ? 1 : input.profile === 'balanced' ? 2 : 4;
    window = Math.max(floor, Math.min(profileCap, window));

    const targetLoss = battery <= .18 ? 1 : battery <= .30 ? Math.max(1, Math.floor(window / 2)) : window;
    const writeCost01 = clamp((bytes / (2 * 1024 * 1024)) * .55 + (saveMs / 500) * .45);
    this.state = {
      version: 1,
      decisions: this.state.decisions + 1,
      lastDecision: reason,
      effectiveMaxDirtyCycles: window,
      targetCrashLossCycles: targetLoss,
      lastPayloadBytes: bytes,
      lastSaveMs: saveMs,
      estimatedWriteAmplification01: writeCost01,
      lastAt: Date.now(),
    };
    return window;
  }

  recordCheckpoint(metrics: { payloadBytes: number; saveMs: number }): void {
    this.state.lastPayloadBytes = Math.max(0, Number(metrics.payloadBytes));
    this.state.lastSaveMs = Math.max(0, Number(metrics.saveMs));
  }

  snapshot(): PersistenceDurabilityState { return structuredClone(this.state); }
}
