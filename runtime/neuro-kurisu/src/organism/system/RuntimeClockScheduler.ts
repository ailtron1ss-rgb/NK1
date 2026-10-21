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
export class RuntimeClockScheduler {
  private readonly clocks = new Map<RuntimeClockKind, RuntimeClockOptions>();
  private readonly timers = new Map<RuntimeClockKind, ReturnType<typeof setTimeout>>();
  private readonly stats = new Map<RuntimeClockKind, RuntimeClockStats>();
  private readonly activeWakeups = new Set<Promise<void>>();
  private stopping = false;

  register(options: RuntimeClockOptions): void {
    if (this.clocks.has(options.id)) throw new Error(`Runtime clock already registered: ${options.id}`);
    this.clocks.set(options.id, options);
    this.stats.set(options.id, {
      startedAt: 0, wakeups: 0, executions: 0, skipped: 0,
      lastRunAt: 0, lastDurationMs: 0, lastDelayMs: 0,
      averageDurationMs: 0, failures: 0,
    });
  }

  start(id?: RuntimeClockKind): void {
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

  private async runWake(id: RuntimeClockKind, clock: RuntimeClockOptions, stats: RuntimeClockStats): Promise<void> {
    stats.wakeups += 1;
    let decision: RuntimeClockDecision = { delayMs: 1000, reason: 'default', run: true };
    try {
      decision = clock.decide?.() ?? decision;
    } catch (error) {
      stats.failures += 1;
      await clock.onError?.(error);
    }
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
        stats.failures += 1;
        await clock.onError?.(error);
      }
    }
    if (!this.stopping) {
      const next = clock.decide?.() ?? decision;
      this.schedule(id, Math.max(0, next.delayMs));
    }
  }
}
