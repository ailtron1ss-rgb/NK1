/** BIG PASS 224 — continuous autonomous runtime with defensive restore boundaries. */

const clamp = (x: number): number => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const MAX_RECENT = 96;
const MAX_REASON_LENGTH = 160;
const MODES = new Set<AmbientMode>(["active", "observe", "reflect", "recover", "idle"]);
const ACTIVITIES = new Set(["explore", "verify", "reflect", "rest"]);

export type AmbientMode = "active" | "observe" | "reflect" | "recover" | "idle";
export interface AutonomousRuntimeLifeState {
  version: 1;
  ticks: number;
  ambientCycles: number;
  selfStartedCycles: number;
  externallyTriggeredCycles: number;
  idleGapCycles: number;
  continuedAfterSilence: number;
  selfAuthoredActivity01: number;
  temporalPersistence01: number;
  environmentalAgency01: number;
  meanAutonomy01: number;
  meanOutcome01: number;
  lastMode: AmbientMode;
  lastReason: string;
  lastActivity: string | null;
  lastAt: number;
  nextWakeAt: number;
  sleepUntil: number;
  streak: number;
  longestStreak: number;
  recent: Array<{ tick: number; mode: AmbientMode; reason: string; autonomous: boolean; outcome01: number; at: number }>;
}

type RecentEntry = AutonomousRuntimeLifeState["recent"][number];
type RecordLike = Record<string, unknown>;

function isPlainRecord(value: unknown): value is RecordLike {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownData(record: RecordLike, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function safeCounter(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function safeTime(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function safeRatio(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value) : fallback;
}

function normalizeRecent(value: unknown): RecentEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: RecentEntry[] = [];
  const start = Math.max(0, value.length - MAX_RECENT);
  for (let index = start; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !isPlainRecord(descriptor.value)) continue;
    const row = descriptor.value;
    const tick = ownData(row, "tick");
    const mode = ownData(row, "mode");
    const reason = ownData(row, "reason");
    const autonomous = ownData(row, "autonomous");
    const outcome01 = ownData(row, "outcome01");
    const at = ownData(row, "at");
    if (!Number.isSafeInteger(tick) || (tick as number) < 0) continue;
    if (typeof mode !== "string" || !MODES.has(mode as AmbientMode)) continue;
    if (typeof reason !== "string" || !reason.trim() || reason.length > MAX_REASON_LENGTH) continue;
    if (typeof autonomous !== "boolean") continue;
    if (typeof outcome01 !== "number" || !Number.isFinite(outcome01)) continue;
    if (typeof at !== "number" || !Number.isFinite(at) || at < 0) continue;
    entries.push({ tick: tick as number, mode: mode as AmbientMode, reason, autonomous, outcome01: clamp(outcome01), at });
  }
  return entries;
}

export const defaultAutonomousRuntimeLife = (): AutonomousRuntimeLifeState => ({
  version: 1, ticks: 0, ambientCycles: 0, selfStartedCycles: 0, externallyTriggeredCycles: 0,
  idleGapCycles: 0, continuedAfterSilence: 0, selfAuthoredActivity01: .35, temporalPersistence01: .28,
  environmentalAgency01: .3, meanAutonomy01: .4, meanOutcome01: .5, lastMode: "idle",
  lastReason: "initial", lastActivity: null, lastAt: 0, nextWakeAt: 0, sleepUntil: 0,
  streak: 0, longestStreak: 0, recent: [],
});

export class AutonomousRuntimeLifeController {
  private state = defaultAutonomousRuntimeLife();

  /** Restore a detached, bounded snapshot. Accessors, proxies and malformed rows never execute or poison state. */
  restore(raw?: Partial<AutonomousRuntimeLifeState> | null): void {
    const defaults = defaultAutonomousRuntimeLife();
    try {
      if (raw == null) {
        this.state = defaults;
        return;
      }
      if (!isPlainRecord(raw) || Object.getOwnPropertySymbols(raw).length > 0) {
        this.state = defaults;
        return;
      }
      const next = defaultAutonomousRuntimeLife();
      const counters = ["ticks", "ambientCycles", "selfStartedCycles", "externallyTriggeredCycles",
        "idleGapCycles", "continuedAfterSilence", "streak", "longestStreak"] as const;
      for (const key of counters) {
        const value = ownData(raw, key);
        if (value !== undefined) next[key] = safeCounter(value, defaults[key]);
      }
      const ratios = ["selfAuthoredActivity01", "temporalPersistence01", "environmentalAgency01",
        "meanAutonomy01", "meanOutcome01"] as const;
      for (const key of ratios) {
        const value = ownData(raw, key);
        if (value !== undefined) next[key] = safeRatio(value, defaults[key]);
      }
      next.lastAt = safeTime(ownData(raw, "lastAt"), defaults.lastAt);
      next.nextWakeAt = safeTime(ownData(raw, "nextWakeAt"), defaults.nextWakeAt);
      next.sleepUntil = safeTime(ownData(raw, "sleepUntil"), defaults.sleepUntil);
      const mode = ownData(raw, "lastMode");
      if (typeof mode === "string" && MODES.has(mode as AmbientMode)) next.lastMode = mode as AmbientMode;
      const reason = ownData(raw, "lastReason");
      if (typeof reason === "string" && reason.trim() && reason.length <= MAX_REASON_LENGTH) next.lastReason = reason;
      const activity = ownData(raw, "lastActivity");
      if (activity === null || (typeof activity === "string" && ACTIVITIES.has(activity))) next.lastActivity = activity;
      next.recent = normalizeRecent(ownData(raw, "recent"));
      next.version = 1;
      this.state = next;
    } catch {
      // Import is atomic: a hostile proxy or throwing descriptor trap resets to safe defaults.
      this.state = defaults;
    }
  }

  snapshot(): AutonomousRuntimeLifeState {
    return structuredClone(this.state);
  }

  tick(input: { tick: number; at: number; externalSignal: boolean; energy01: number; uncertainty01: number; novelty01: number; goalPressure01: number; homeostaticPressure01: number; initiative01: number; predictionError01: number; resourcePressure01: number }) {
    this.state.ticks++;
    const previousActivityAt = this.state.lastAt;
    const silence = !input.externalSignal;
    if (input.externalSignal) this.state.externallyTriggeredCycles++;
    if (silence) this.state.ambientCycles++;
    const pressure = clamp(input.goalPressure01 * .28 + input.uncertainty01 * .2 + input.novelty01 * .16 + input.initiative01 * .2 + input.homeostaticPressure01 * .16 + input.predictionError01 * .12);
    const exhausted = clamp((1 - input.energy01) * .52 + input.resourcePressure01 * .48 + Math.max(0, input.homeostaticPressure01 - .78) * .4);
    if (input.at < this.state.sleepUntil) {
      this.state.lastMode = "recover"; this.state.lastReason = "recovery-window"; this.state.nextWakeAt = this.state.sleepUntil;
      return { shouldAct: false, mode: "recover" as const, reason: "recovery-window", activity: "rest" as const, autonomous: silence, nextWakeAt: this.state.sleepUntil };
    }
    const wakeInterval = Math.round(7000 + clamp(1 - pressure) * 9000 + clamp(input.homeostaticPressure01) * 6000);
    const due = input.at >= this.state.nextWakeAt;
    if (!due && silence) {
      this.state.lastMode = "idle"; this.state.lastReason = "waiting-for-cadence";
      return { shouldAct: false, mode: "idle" as const, reason: "waiting-for-cadence", activity: null, autonomous: false, nextWakeAt: this.state.nextWakeAt };
    }
    if (exhausted > .76 || input.energy01 < .16 || input.homeostaticPressure01 > .92) {
      this.state.lastMode = "recover"; this.state.lastReason = "self-preservation";
      this.state.sleepUntil = input.at + Math.round(9000 + exhausted * 12000); this.state.nextWakeAt = this.state.sleepUntil; this.state.streak = 0;
      return { shouldAct: false, mode: "recover" as const, reason: "self-preservation", activity: "rest" as const, autonomous: silence, nextWakeAt: this.state.sleepUntil };
    }
    let mode: AmbientMode = "observe";
    let activity: "explore" | "verify" | "reflect" | "rest" | null = "explore";
    if (input.homeostaticPressure01 > .62 || input.energy01 < .32) { mode = "recover"; activity = "rest"; }
    else if (input.uncertainty01 > .64 || input.predictionError01 > .58) { mode = "observe"; activity = "verify"; }
    else if (input.novelty01 > .58 || input.goalPressure01 > .58 || input.initiative01 > .58) { mode = "active"; activity = "explore"; }
    else { mode = "reflect"; activity = "reflect"; }
    const autonomous = silence;
    if (autonomous) {
      this.state.selfStartedCycles++;
      if (previousActivityAt > 0 && input.at > previousActivityAt) this.state.continuedAfterSilence++;
    }
    if (autonomous && this.state.lastMode !== "idle") this.state.idleGapCycles++;
    this.state.streak++;
    this.state.longestStreak = Math.max(this.state.longestStreak, this.state.streak);
    this.state.selfAuthoredActivity01 = clamp(this.state.selfAuthoredActivity01 * .93 + (autonomous ? .92 : .22) * .07);
    this.state.temporalPersistence01 = clamp(this.state.temporalPersistence01 * .92 + (this.state.streak > 1 ? .86 : .62) * .08);
    this.state.environmentalAgency01 = clamp(this.state.environmentalAgency01 * .92 + ((activity === "explore" || activity === "verify") ? .8 : .58) * .08);
    this.state.meanAutonomy01 = clamp(this.state.meanAutonomy01 * .94 + (autonomous ? .95 : .3) * .06);
    this.state.lastMode = mode; this.state.lastActivity = activity;
    this.state.lastReason = autonomous ? "internally-derived-ambient-activity" : "external-cycle";
    this.state.lastAt = input.at; this.state.nextWakeAt = input.at + wakeInterval;
    this.state.recent = [{ tick: input.tick, mode, reason: this.state.lastReason, autonomous, outcome01: .5, at: input.at }, ...this.state.recent].slice(0, MAX_RECENT);
    return { shouldAct: true, mode, reason: this.state.lastReason, activity, autonomous, nextWakeAt: this.state.nextWakeAt };
  }

  observeOutcome(outcome01: number, at: number): void {
    const quality = clamp(outcome01);
    this.state.meanOutcome01 = clamp(this.state.meanOutcome01 * .9 + quality * .1);
    if (this.state.recent[0]) this.state.recent[0] = { ...this.state.recent[0], outcome01: quality };
    this.state.lastAt = at;
  }

  summary() {
    return {
      ticks: this.state.ticks, ambientCycles: this.state.ambientCycles, selfStartedCycles: this.state.selfStartedCycles,
      externallyTriggeredCycles: this.state.externallyTriggeredCycles, idleGapCycles: this.state.idleGapCycles,
      continuedAfterSilence: this.state.continuedAfterSilence, selfAuthoredActivity01: this.state.selfAuthoredActivity01,
      temporalPersistence01: this.state.temporalPersistence01, environmentalAgency01: this.state.environmentalAgency01,
      meanAutonomy01: this.state.meanAutonomy01, meanOutcome01: this.state.meanOutcome01, lastMode: this.state.lastMode,
      lastReason: this.state.lastReason, streak: this.state.streak, longestStreak: this.state.longestStreak,
      nextWakeAt: this.state.nextWakeAt,
    };
  }
}
