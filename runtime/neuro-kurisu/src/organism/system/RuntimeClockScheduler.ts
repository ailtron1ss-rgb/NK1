export type RuntimeClockKind = 'cognitive' | 'embodiment' | 'reflection' | 'trusted-shadow-learning' | 'p23-compound-repair-revision';

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
const CLOCK_KINDS = new Set<RuntimeClockKind>(['cognitive','embodiment','reflection','trusted-shadow-learning','p23-compound-repair-revision']);

function normalizeDecision(value: unknown, fallback: RuntimeClockDecision): RuntimeClockDecision {
  if (value === undefined || value === null) {
    throw new TypeError('runtime clock decision must not be null or undefined');
  }
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
  private readonly activeByClock = new Map<RuntimeClockKind, Promise<void>>();
  private readonly generations = new Map<RuntimeClockKind, number>();
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
    this.generations.set(options.id, 0);
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
    for (const clockId of ids) {
      const priorTimer = this.timers.get(clockId);
      if (priorTimer) clearTimeout(priorTimer);
      this.timers.delete(clockId);
      const generation = (this.generations.get(clockId) ?? 0) + 1;
      this.generations.set(clockId, generation);
      this.schedule(clockId, Math.max(0, this.clocks.get(clockId)?.initialDelayMs ?? 0), generation);
    }
  }

  stop(): void {
    this.stopping = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    for (const id of this.clocks.keys()) this.generations.set(id, (this.generations.get(id) ?? 0) + 1);
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

  private schedule(id: RuntimeClockKind, delayMs: number, generation = this.generations.get(id) ?? 0): void {
    if (this.stopping || this.timers.has(id) || generation !== (this.generations.get(id) ?? 0)) return;
    const clock = this.clocks.get(id);
    if (!clock) return;
    const stats = this.stats.get(id)!;
    stats.lastDelayMs = Math.max(0, Math.round(delayMs));
    if (!stats.startedAt) stats.startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    timer = setTimeout(() => {
      // An obsolete timer must never delete a newer generation's timer.
      if (this.timers.get(id) === timer) this.timers.delete(id);
      if (this.stopping || generation !== (this.generations.get(id) ?? 0)) return;
      void this.wake(id, generation);
    }, Math.max(0, Math.round(delayMs)));
    (timer as any).unref?.();
    this.timers.set(id, timer);
  }

  private async wake(id: RuntimeClockKind, generation: number): Promise<void> {
    if (this.stopping || generation !== (this.generations.get(id) ?? 0)) return;
    const clock = this.clocks.get(id);
    const stats = this.stats.get(id);
    if (!clock || !stats) return;
    // restart() can schedule a new generation while its previous task is still
    // finishing. Never run two tasks for one clock at the same time.
    if (this.activeByClock.has(id)) {
      this.schedule(id, MIN_REPEAT_DELAY_MS, generation);
      return;
    }
    const work = this.runWake(id, clock, stats, generation);
    this.activeByClock.set(id, work);
    this.activeWakeups.add(work);
    try { await work; } finally {
      this.activeWakeups.delete(work);
      if (this.activeByClock.get(id) === work) this.activeByClock.delete(id);
    }
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

  private async runWake(id: RuntimeClockKind, clock: RuntimeClockOptions, stats: RuntimeClockStats, generation: number): Promise<void> {
    stats.wakeups += 1;
    const fallback: RuntimeClockDecision = { delayMs: RETRY_DELAY_MS, reason: 'default-retry', run: true };
    let decision: RuntimeClockDecision;
    let decisionFailed = false;
    try {
      decision = clock.decide ? normalizeDecision(clock.decide(), fallback) : fallback;
    } catch (error) {
      decisionFailed = true;
      decision = { delayMs: RETRY_DELAY_MS, reason: 'decision-error', run: false };
      await this.reportFailure(clock, stats, error);
    }

    // The policy callback can re-enter this scheduler and stop/restart it.
    // Recheck the generation after it returns so a stale decision cannot launch
    // side effects after its runtime generation was invalidated.
    if (this.stopping || generation !== (this.generations.get(id) ?? 0)) return;

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

    // A stop/restart may have occurred while the user task or error handler
    // was awaited. That stale wakeup may update telemetry, but not schedule or
    // make another admission decision for the current generation.
    if (!this.stopping && generation === (this.generations.get(id) ?? 0)) {
      let nextDelay = decision.delayMs;
      if (decisionFailed) {
        nextDelay = Math.max(RETRY_DELAY_MS, nextDelay);
      } else {
        try {
          // Re-evaluate after work so clocks can adapt their cadence to updated pressure.
          const next = clock.decide ? normalizeDecision(clock.decide(), decision) : decision;
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
