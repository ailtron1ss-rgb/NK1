import { createHash } from 'node:crypto';

export type RuntimeClosureStatus = 'PASS' | 'DEGRADED' | 'FAIL';

export interface RuntimeClosureCheck {
  name: string;
  ok: boolean;
  value?: number | string | boolean | null;
  expected?: number | string | boolean | null;
  detail?: string;
}

export interface RuntimeClosureRecord {
  at: number;
  tick: number;
  phase: 'step' | 'durable' | 'restore' | 'failure';
  status: RuntimeClosureStatus;
  checks: RuntimeClosureCheck[];
  behaviorHash: string;
  durableHash?: string;
}

export interface RuntimeClosureSnapshot {
  version: 1;
  checks: number;
  passes: number;
  degraded: number;
  failures: number;
  lastTick: number;
  lastStatus: RuntimeClosureStatus;
  lastBehaviorHash: string;
  lastDurableHash: string;
  records: RuntimeClosureRecord[];
}

export interface RuntimeClosureStepInput {
  at: number;
  previousTick: number;
  stateTick: number;
  cycleTick: number;
  continuousTick?: number;
  processed?: number;
  previousProcessed?: number;
  continuity01?: number;
  energy01?: number;
  uncertainty01?: number;
  identityContinuity01?: number;
  predictionError01?: number;
  action?: string;
}

export interface RuntimeClosureDurabilityInput {
  at: number;
  tick: number;
  replaySignature: string;
  continuityProcessed?: number;
  stateTick: number;
  continuousTick?: number;
  memoryCount?: number;
}

function finite01(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bounded01(value: unknown): boolean {
  const n = finite01(value);
  return n == null || (n >= 0 && n <= 1);
}

function fastFingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function durableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function statusOf(checks: RuntimeClosureCheck[]): RuntimeClosureStatus {
  if (checks.some((check) => !check.ok)) return 'FAIL';
  if (checks.some((check) => check.detail?.startsWith('degraded'))) return 'DEGRADED';
  return 'PASS';
}

export class RuntimeClosureLedger {
  private state: RuntimeClosureSnapshot = {
    version: 1,
    checks: 0,
    passes: 0,
    degraded: 0,
    failures: 0,
    lastTick: 0,
    lastStatus: 'PASS',
    lastBehaviorHash: '',
    lastDurableHash: '',
    records: [],
  };

  restore(snapshot?: Partial<RuntimeClosureSnapshot> | null): void {
    if (!snapshot || Number(snapshot.version) !== 1) return;
    this.state = {
      ...this.state,
      ...snapshot,
      records: Array.isArray(snapshot.records) ? snapshot.records.slice(-24) : [],
    };
  }

  step(input: RuntimeClosureStepInput): RuntimeClosureRecord {
    const checks: RuntimeClosureCheck[] = [
      { name: 'state-cycle-aligned', ok: input.stateTick === input.cycleTick, value: input.cycleTick, expected: input.stateTick },
      { name: 'tick-monotonic', ok: input.stateTick > input.previousTick, value: input.stateTick, expected: `>${input.previousTick}` },
      { name: 'continuity-bounded', ok: bounded01(input.continuity01), value: input.continuity01 ?? null, expected: '0..1' },
      { name: 'homeostasis-bounded', ok: [input.energy01, input.uncertainty01, input.identityContinuity01, input.predictionError01].every((value) => bounded01(value)), value: 'bounded', expected: '0..1' },
      { name: 'processed-monotonic', ok: input.processed == null || input.previousProcessed == null || input.processed >= input.previousProcessed, value: input.processed ?? null, expected: input.previousProcessed ?? null },
      { name: 'action-present', ok: input.action == null || input.action.length > 0, value: input.action ?? null },
    ];
    const validActions = new Set(['observe','inspect','move','collect','rest','communicate']);
    checks.push({ name: 'action-valid', ok: input.action == null || validActions.has(input.action), value: input.action ?? null, expected: 'EnvironmentAction' });
    if (input.continuousTick != null) checks.push({ name: 'continuous-fabric-aligned', ok: input.continuousTick === input.stateTick, value: input.continuousTick, expected: input.stateTick });
    const status = statusOf(checks);
    const behaviorHash = fastFingerprint({
      tick: input.stateTick,
      cycleTick: input.cycleTick,
      continuousTick: input.continuousTick ?? null,
      processed: input.processed ?? null,
      continuity01: finite01(input.continuity01),
      action: input.action ?? null,
      energy01: finite01(input.energy01),
      uncertainty01: finite01(input.uncertainty01),
      identityContinuity01: finite01(input.identityContinuity01),
      predictionError01: finite01(input.predictionError01),
    });
    const record: RuntimeClosureRecord = { at: input.at, tick: input.stateTick, phase: 'step', status, checks, behaviorHash };
    this.commit(record);
    return structuredClone(record);
  }

  fail(input: { at: number; tick: number; reason: string }): RuntimeClosureRecord {
    const tick = Number.isSafeInteger(input.tick) && input.tick >= 0 ? input.tick : 0;
    const reason = (typeof input.reason === 'string' ? input.reason : 'cycle execution failed')
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
      .trim()
      .slice(0, 240) || 'cycle execution failed';
    const record: RuntimeClosureRecord = {
      at: Number.isFinite(input.at) ? input.at : Date.now(),
      tick,
      phase: 'failure',
      status: 'FAIL',
      checks: [
        { name: 'cycle-execution-completed', ok: false, value: 'failed', expected: 'completed', detail: reason },
        { name: 'failure-tick-valid', ok: Number.isSafeInteger(input.tick) && input.tick >= 0, value: tick, expected: 'non-negative safe integer' },
      ],
      behaviorHash: fastFingerprint({ tick, phase: 'failure', reason }),
    };
    this.commit(record);
    return structuredClone(record);
  }
  durable(input: RuntimeClosureDurabilityInput): RuntimeClosureRecord {
    const checks: RuntimeClosureCheck[] = [
      { name: 'durable-state-tick', ok: input.stateTick === input.tick, value: input.stateTick, expected: input.tick },
      { name: 'replay-signature-present', ok: Boolean(input.replaySignature), value: input.replaySignature ? 'present' : 'missing', expected: 'present' },
      { name: 'durable-continuous-fabric', ok: input.continuousTick == null || input.continuousTick === input.tick, value: input.continuousTick ?? null, expected: input.tick },
    ];
    const status = statusOf(checks);
    const durableFingerprint = durableHash({
      tick: input.tick,
      replaySignature: input.replaySignature,
      continuousTick: input.continuousTick ?? null,
      processed: input.continuityProcessed ?? null,
      memoryCount: input.memoryCount ?? null,
    });
    const record: RuntimeClosureRecord = {
      at: input.at,
      tick: input.tick,
      phase: 'durable',
      status,
      checks,
      behaviorHash: this.state.lastBehaviorHash,
      durableHash: durableFingerprint,
    };
    this.state.lastDurableHash = durableFingerprint;
    this.commit(record, false);
    return structuredClone(record);
  }

  restoreVerification(input: { at: number; tick: number; previousDurableHash?: string; replaySignature: string; continuousTick?: number; processed?: number }): RuntimeClosureRecord {
    const checks: RuntimeClosureCheck[] = [
      { name: 'restored-tick', ok: input.tick >= 0, value: input.tick, expected: '>=0' },
      { name: 'restored-replay-signature', ok: Boolean(input.replaySignature) || !input.previousDurableHash, value: input.replaySignature ? 'present' : 'missing', expected: 'present', detail: input.replaySignature ? undefined : 'degraded:first-session' },
      { name: 'restored-continuous-fabric', ok: input.continuousTick == null || input.continuousTick <= input.tick, value: input.continuousTick ?? null, expected: `<=${input.tick}` },
      { name: 'durable-evidence-available', ok: true, value: input.previousDurableHash ? 'present' : 'missing', expected: 'present', detail: input.previousDurableHash ? undefined : 'degraded:first-session' },
    ];
    const status = statusOf(checks);
    const behaviorHash = fastFingerprint({ tick: input.tick, continuousTick: input.continuousTick ?? null, processed: input.processed ?? null, replaySignature: input.replaySignature });
    const record: RuntimeClosureRecord = { at: input.at, tick: input.tick, phase: 'restore', status, checks, behaviorHash };
    this.commit(record);
    return structuredClone(record);
  }

  snapshot(): RuntimeClosureSnapshot { return structuredClone(this.state); }

  diagnostics() {
    return {
      version: this.state.version,
      checks: this.state.checks,
      passes: this.state.passes,
      degraded: this.state.degraded,
      failures: this.state.failures,
      lastTick: this.state.lastTick,
      lastStatus: this.state.lastStatus,
      lastBehaviorHash: this.state.lastBehaviorHash,
      lastDurableHash: this.state.lastDurableHash,
    };
  }

  private commit(record: RuntimeClosureRecord, updateBehavior = true): void {
    this.state.checks += record.checks.length;
    if (record.status === 'PASS') this.state.passes += record.checks.length;
    else if (record.status === 'DEGRADED') this.state.degraded += record.checks.filter((check) => check.detail?.startsWith('degraded')).length || 1;
    else this.state.failures += record.checks.filter((check) => !check.ok).length || 1;
    this.state.lastTick = record.tick;
    // Keep the failed terminal status through repeated flush/durability receipts
    // for the same tick; a later cycle's step record naturally replaces it.
    const hasFailureForTick = record.phase === 'durable' && this.state.records.some(
      (item) => item.phase === 'failure' && item.tick === record.tick,
    );
    if (!hasFailureForTick) this.state.lastStatus = record.status;
    if (updateBehavior) this.state.lastBehaviorHash = record.behaviorHash;
    this.state.records = [...this.state.records, record].slice(-24);
  }
}
