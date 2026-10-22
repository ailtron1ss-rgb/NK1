export type RuntimeClockKind = 'cognitive' | 'embodiment' | 'reflection' | 'trusted-shadow-learning';

export interface RuntimeClockDecision {
  delayMs: number;
  reason: string;
  run: boolean;
}

export interface RuntimeClockStats {
  startedAt: number;
  wakeups: number;
  executions: number;
  skipped: number;
  lastRunAt: number;
  lastDurationMs: number;
  lastDelayMs: number;
  averageDurationMs: number;
  failures: number;
}

export interface RuntimeClockOptions {
  id: RuntimeClockKind;
  initialDelayMs: number;
  decide?: () => RuntimeClockDecision;
  task: () => Promise<void> | void;
  onError?: (error: unknown) => void | Promise<void>;
}

/**
 * Tiny multi-clock scheduler intended for long-lived phone runtimes.
 * It deliberately uses one-shot timers instead of permanent intervals so
 * each clock can stretch/sleep after observing current device pressure.
 */
const MAX_CLOCK_DELAY_MS = 24 * 60 * 60 * 1000;
const MIN_REPEAT_DELAY_MS = 50;
const RETRY_DELAY_MS = 1_000;
const CLOCK_KINDS = new Set<RuntimeClockKind>(['cognitive','embodiment','reflection','trusted-shadow-learning']);

function normalizeDecision(value: unknown, fallback: RuntimeClockDecision): RuntimeClockDecision {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('runtime clock decision must be an object');
  }
  const candidate = value as Partial<RuntimeClockDecision>;
  if (typeof candidate.run !== 'boolean' ||
      typeof candidate.reason !== 'string' ||
      candidate.reason.trim().length === 0 || candidate.reason.length > 1024 ||
      typeof candidate.delayMs !== 'number' || !Number.isFinite(candidate.delayMs) ||
      candidate.delayMs < 0 || candidate.delayMs > MAX_CLOCK_DELAY_MS) {
    throw new RangeError('runtime clock decision must have a reason, boolean run flag and bounded finite delayMs');
  }
  return { delayMs: Math.round(candidate.delayMs), reason: candidate.reason, run: candidate.run };
}

export class RuntimeClockScheduler {
  private readonly clocks = new Map<RuntimeClockKind, RuntimeClockOptions>();
  private readonly timers = new Map<RuntimeClockKind, ReturnType<typeof setTimeout>>();
  private readonly stats = new Map<RuntimeClockKind, RuntimeClockStats>();
  private readonly activeWakeups = new Set<Promise<void>>();
  private stopping = false;

  register(options: RuntimeClockOptions): void {
    if (!options || typeof options !== 'object') throw new TypeError('runtime clock options must be an object');
    if (!CLOCK_KINDS.has(options.id)) throw new Error(`Unknown runtime clock: ${String(options.id)}`);
    if (this.clocks.has(options.id)) throw new Error(`Runtime clock already registered: ${options.id}`);
    if (typeof options.initialDelayMs !== 'number' || !Number.isFinite(options.initialDelayMs) ||
        options.initialDelayMs < 0 || options.initialDelayMs > MAX_CLOCK_DELAY_MS) {
      throw new RangeError('runtime clock initialDelayMs must be finite and within [0, 24 hours]');
    }
    if (typeof options.task !== 'function') throw new TypeError('runtime clock task must be a function');
    if (options.decide !== undefined && typeof options.decide !== 'function') throw new TypeError('runtime clock decide must be a function');
    if (options.onError !== undefined && typeof options.onError !== 'function') throw new TypeError('runtime clock onError must be a function');
    this.clocks.set(options.id, options);
    this.stats.set(options.id, {
      startedAt: 0, wakeups: 0, executions: 0, skipped: 0,
      lastRunAt: 0, lastDurationMs: 0, lastDelayMs: 0,
      averageDurationMs: 0, failures: 0,
    });
  }

  start(id?: RuntimeClockKind): void {
    if (id !== undefined && !this.clocks.has(id)) throw new Error(`Runtime clock is not registered: ${id}`);
    this.stopping = false;
    const ids = id ? [id] : [...this.clocks.keys()];
    for (const clockId of ids) this.schedule(clockId, Math.max(0, this.clocks.get(clockId)?.initialDelayMs ?? 0));
  }

  stop(): void {
    this.stopping = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  async drain(): Promise<void> {
    const pending = [...this.activeWakeups];
    if (pending.length) await Promise.allSettled(pending);
  }

  restart(): void {
    this.stop();
    this.start();
  }

  snapshot(): Record<RuntimeClockKind, RuntimeClockStats> {
    return Object.fromEntries([...this.stats.entries()].map(([id, value]) => [id, { ...value }])) as Record<RuntimeClockKind, RuntimeClockStats>;
  }

  private schedule(id: RuntimeClockKind, delayMs: number): void {
    if (this.stopping || this.timers.has(id)) return;
    const clock = this.clocks.get(id);
    if (!clock) return;
    const stats = this.stats.get(id)!;
    stats.lastDelayMs = Math.max(0, Math.round(delayMs));
    if (!stats.startedAt) stats.startedAt = Date.now();
    const timer = setTimeout(() => {
      this.timers.delete(id);
      void this.wake(id);
    }, Math.max(0, Math.round(delayMs)));
    (timer as any).unref?.();
    this.timers.set(id, timer);
  }

  private async wake(id: RuntimeClockKind): Promise<void> {
    if (this.stopping) return;
    const clock = this.clocks.get(id);
    const stats = this.stats.get(id);
    if (!clock || !stats) return;
    const work = this.runWake(id, clock, stats);
    this.activeWakeups.add(work);
    try { await work; } finally { this.activeWakeups.delete(work); }
  }

  private async reportFailure(clock: RuntimeClockOptions, stats: RuntimeClockStats, error: unknown): Promise<void> {
    stats.failures += 1;
    try {
      await clock.onError?.(error);
    } catch {
      // The error reporter is not allowed to kill the clock's rescheduling loop.
      stats.failures += 1;
    }
  }

  private async runWake(id: RuntimeClockKind, clock: RuntimeClockOptions, stats: RuntimeClockStats): Promise<void> {
    stats.wakeups += 1;
    const fallback: RuntimeClockDecision = { delayMs: RETRY_DELAY_MS, reason: 'default-retry', run: true };
    let decision: RuntimeClockDecision;
    let decisionFailed = false;
    try {
      decision = normalizeDecision(clock.decide?.(), fallback);
    } catch (error) {
      decisionFailed = true;
      decision = { delayMs: RETRY_DELAY_MS, reason: 'decision-error', run: false };
      await this.reportFailure(clock, stats, error);
    }

    // Admission decision failures are fail-closed: no task side effects occur.
    if (!decision.run) stats.skipped += 1;
    else {
      const started = Date.now();
      try {
        stats.executions += 1;
        await clock.task();
        const duration = Date.now() - started;
        stats.lastRunAt = Date.now();
        stats.lastDurationMs = duration;
        stats.averageDurationMs = stats.averageDurationMs === 0 ? duration : stats.averageDurationMs * 0.8 + duration * 0.2;
      } catch (error) {
        await this.reportFailure(clock, stats, error);
      }
    }

    if (!this.stopping) {
      let nextDelay = decision.delayMs;
      if (decisionFailed) {
        nextDelay = Math.max(RETRY_DELAY_MS, nextDelay);
      } else {
        try {
          // Re-evaluate after work so clocks can adapt their cadence to updated pressure.
          const next = normalizeDecision(clock.decide?.(), decision);
          nextDelay = next.delayMs;
        } catch (error) {
          await this.reportFailure(clock, stats, error);
          nextDelay = Math.max(RETRY_DELAY_MS, decision.delayMs);
        }
      }
      // A zero-delay recurring decision must not spin the event loop indefinitely.
      this.schedule(id, Math.max(MIN_REPEAT_DELAY_MS, nextDelay));
    }
  }
}
