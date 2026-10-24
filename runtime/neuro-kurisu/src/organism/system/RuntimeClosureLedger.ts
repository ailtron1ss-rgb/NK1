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
  cognitiveCycleComplete?: boolean;
  cognitiveCycleTick?: number;
  missingCognitiveStages?: string[];
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


const VALID_CLOSURE_STATUSES = new Set<RuntimeClosureStatus>(['PASS','DEGRADED','FAIL']);
const VALID_CLOSURE_PHASES = new Set<RuntimeClosureRecord['phase']>(['step','durable','restore','failure']);
const safeCounter = (value: unknown): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;

function normalizeClosureRecord(raw: unknown): RuntimeClosureRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Partial<RuntimeClosureRecord>;
  if (typeof record.at !== 'number' || !Number.isFinite(record.at) ||
      typeof record.tick !== 'number' || !Number.isSafeInteger(record.tick) || record.tick < 0 ||
      !VALID_CLOSURE_PHASES.has(record.phase as RuntimeClosureRecord['phase']) ||
      !VALID_CLOSURE_STATUSES.has(record.status as RuntimeClosureStatus) ||
      typeof record.behaviorHash !== 'string' || !Array.isArray(record.checks)) return null;
  const checks = record.checks.flatMap((rawCheck) => {
    if (!rawCheck || typeof rawCheck !== 'object' || typeof rawCheck.name !== 'string' || typeof rawCheck.ok !== 'boolean') return [];
    const check = rawCheck as RuntimeClosureCheck;
    const safeScalar = (value: unknown): string | number | boolean | null | undefined => {
      if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean') return value;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      return String(value).slice(0, 180);
    };
    return [{
      name: check.name.slice(0, 180),
      ok: check.ok,
      value: safeScalar(check.value),
      expected: safeScalar(check.expected),
      detail: typeof check.detail === 'string' ? check.detail.slice(0, 240) : undefined,
    }];
  }).slice(-32);
  if (!checks.length) return null;
  const normalizedStatus: RuntimeClosureStatus = record.status === 'FAIL' || checks.some((check) => !check.ok)
    ? 'FAIL'
    : record.status === 'DEGRADED' || checks.some((check) => check.detail?.startsWith('degraded'))
      ? 'DEGRADED'
      : 'PASS';
  return {
    at: record.at, tick: record.tick, phase: record.phase as RuntimeClosureRecord['phase'],
    status: normalizedStatus, checks, behaviorHash: record.behaviorHash.slice(0, 160),
    durableHash: typeof record.durableHash === 'string' ? record.durableHash.slice(0, 160) : undefined,
  };
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
    const records = Array.isArray(snapshot.records)
      ? snapshot.records.map(normalizeClosureRecord).filter((record): record is RuntimeClosureRecord => record !== null).slice(-24)
      : [];
    const lastCycleRecord = [...records].reverse().find((record) => record.phase === 'step' || record.phase === 'failure');
    const reportedStatus = VALID_CLOSURE_STATUSES.has(snapshot.lastStatus as RuntimeClosureStatus)
      ? snapshot.lastStatus as RuntimeClosureStatus
      : 'DEGRADED';
    // Persisted summary and event history can contradict. Never restore a PASS
    // when the latest retained cycle record is a failure; preserve explicit FAIL
    // when the summary is stricter than the bounded record window.
    const lastStatus: RuntimeClosureStatus = reportedStatus === 'FAIL' || lastCycleRecord?.status === 'FAIL'
      ? 'FAIL'
      : reportedStatus;
    const failedTerminal = lastStatus === 'FAIL' && lastCycleRecord?.status === 'FAIL' ? lastCycleRecord : null;
    this.state = {
      version: 1,
      checks: safeCounter(snapshot.checks),
      passes: safeCounter(snapshot.passes),
      degraded: safeCounter(snapshot.degraded),
      failures: Math.max(safeCounter(snapshot.failures), failedTerminal ? 1 : 0),
      lastTick: safeCounter(snapshot.lastTick),
      lastStatus,
      lastBehaviorHash: failedTerminal?.behaviorHash ?? (typeof snapshot.lastBehaviorHash === 'string' ? snapshot.lastBehaviorHash.slice(0, 160) : ''),
      lastDurableHash: typeof snapshot.lastDurableHash === 'string' ? snapshot.lastDurableHash.slice(0, 160) : '',
      records,
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
    if (input.cognitiveCycleComplete !== undefined) {
      const cognitiveTickAligned = input.cognitiveCycleTick == null || input.cognitiveCycleTick === input.stateTick;
      const cognitiveComplete = input.cognitiveCycleComplete === true && cognitiveTickAligned;
      const missing = Array.isArray(input.missingCognitiveStages) ? input.missingCognitiveStages.slice(0, 11).join(',') : '';
      checks.push({
        name: 'unified-cognitive-cycle-complete',
        ok: cognitiveComplete,
        value: input.cognitiveCycleComplete,
        expected: true,
        detail: cognitiveComplete ? undefined : `incomplete-or-misaligned:${missing || (cognitiveTickAligned ? 'cycle-contract' : 'tick-mismatch')}`
      });
    }
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
      cognitiveCycleComplete: input.cognitiveCycleComplete ?? null,
      cognitiveCycleTick: input.cognitiveCycleTick ?? null,
      missingCognitiveStages: Array.isArray(input.missingCognitiveStages) ? input.missingCognitiveStages.slice(0, 11) : [],
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
    // Durable receipts and restart verification are bookkeeping, not a new
    // cognitive attempt. They must not erase FAIL from the last cycle; only
    // a later step/failure record is allowed to replace the terminal cycle status.
    const preserveFailedCycle = (record.phase === 'durable' || record.phase === 'restore')
      && this.state.lastStatus === 'FAIL';
    if (!preserveFailedCycle) this.state.lastStatus = record.status;
    if (updateBehavior && !preserveFailedCycle) this.state.lastBehaviorHash = record.behaviorHash;
    this.state.records = [...this.state.records, record].slice(-24);
  }
}
