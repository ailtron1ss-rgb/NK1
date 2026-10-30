/**
 * Bounded latest-value transport for renderer-neutral motor frames.
 *
 * The controller remains the sole producer of MotorFrame state. This channel
 * provides a small, synchronous hand-off to embodiment adapters without
 * importing browser, UI, renderer, device, or OrganismCore modules.
 *
 * It intentionally stores one frame (not a queue): slow consumers observe the
 * newest pose and cannot create unbounded animation backlog.
 */
import type { MotorFrame } from "./EmbodiedMotorController.js";

export interface MotorFrameChannelOptions {
  maxJoints?: number;
  maxListeners?: number;
}

export interface MotorFrameChannelDiagnostics {
  published: number;
  rejected: number;
  listenerErrors: number;
  listenerCount: number;
  hasLatest: boolean;
  lastTick: number | null;
  lastAtMs: number | null;
}

export type MotorFrameListener = (frame: MotorFrame) => void;

const DEFAULT_MAX_JOINTS = 128;
const DEFAULT_MAX_LISTENERS = 32;
const MAX_LISTENERS_HARD_LIMIT = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneFrame(frame: MotorFrame): MotorFrame {
  const joints: MotorFrame["joints"] = {};
  for (const [id, joint] of Object.entries(frame.joints)) {
    joints[id] = { ...joint };
  }
  return {
    ...frame,
    joints,
    reachedJointIds: [...frame.reachedJointIds],
    blockedJointIds: [...frame.blockedJointIds],
  };
}

/** Validate the transport envelope before it can replace the latest frame. */
export function validateMotorFrameForTransport(
  raw: unknown,
  maxJoints = DEFAULT_MAX_JOINTS,
): { ok: boolean; reason: string } {
  if (!isRecord(raw)) return { ok: false, reason: "frame-not-object" };
  if (raw.version !== 1) return { ok: false, reason: "unsupported-frame-version" };
  if (!Number.isSafeInteger(raw.tick) || Number(raw.tick) < 0) return { ok: false, reason: "invalid-frame-tick" };
  if (!Number.isFinite(raw.atMs) || Number(raw.atMs) < 0) return { ok: false, reason: "invalid-frame-time" };
  if (raw.goalId !== null && (typeof raw.goalId !== "string" || !raw.goalId.trim())) return { ok: false, reason: "invalid-frame-goal-id" };
  if (typeof raw.action !== "string" || raw.action.length > 160) return { ok: false, reason: "invalid-frame-action" };
  if (!["idle", "moving", "holding", "rejected", "expired"].includes(String(raw.phase))) return { ok: false, reason: "invalid-frame-phase" };
  if (!Number.isFinite(raw.completion01) || Number(raw.completion01) < 0 || Number(raw.completion01) > 1) return { ok: false, reason: "invalid-frame-completion" };
  if (typeof raw.reason !== "string" || raw.reason.length > 512) return { ok: false, reason: "invalid-frame-reason" };
  if (!isRecord(raw.joints)) return { ok: false, reason: "invalid-frame-joints" };
  const entries = Object.entries(raw.joints);
  if (entries.length > maxJoints) return { ok: false, reason: "frame-joint-count-exceeded" };
  for (const [id, value] of entries) {
    if (!/^[a-z][a-z0-9._-]{0,63}$/i.test(id) || !isRecord(value)) return { ok: false, reason: "invalid-frame-joint-entry" };
    if (value.id !== id || typeof value.available !== "boolean") return { ok: false, reason: "invalid-frame-joint-identity" };
    if (![value.angleRad, value.targetAngleRad, value.velocityRadPerSec, value.accelerationRadPerSec2]
      .every((number) => typeof number === "number" && Number.isFinite(number))) {
      return { ok: false, reason: "invalid-frame-joint-numeric-state" };
    }
  }
  for (const field of ["reachedJointIds", "blockedJointIds"] as const) {
    const ids = raw[field];
    if (!Array.isArray(ids) || ids.length > maxJoints || ids.some((id) => typeof id !== "string" || !Object.hasOwn(raw.joints as object, id))) {
      return { ok: false, reason: "invalid-frame-joint-status-list" };
    }
  }
  return { ok: true, reason: "valid" };
}

/**
 * Synchronous single-slot channel. Publication is accepted only for strictly
 * increasing tick and non-decreasing monotonic time. Listener failures are
 * isolated: one renderer cannot prevent delivery to the others.
 */
export class MotorFrameChannel {
  private latest: MotorFrame | null = null;
  private readonly listeners = new Set<MotorFrameListener>();
  private readonly maxJoints: number;
  private readonly maxListeners: number;
  private published = 0;
  private rejected = 0;
  private listenerErrors = 0;

  constructor(options: MotorFrameChannelOptions = {}) {
    this.maxJoints = Number.isSafeInteger(options.maxJoints) && (options.maxJoints ?? 0) > 0
      ? Math.min(options.maxJoints!, 256) : DEFAULT_MAX_JOINTS;
    this.maxListeners = Number.isSafeInteger(options.maxListeners) && (options.maxListeners ?? 0) > 0
      ? Math.min(options.maxListeners!, MAX_LISTENERS_HARD_LIMIT) : DEFAULT_MAX_LISTENERS;
  }

  publish(raw: MotorFrame): { accepted: boolean; reason: string } {
    const validation = validateMotorFrameForTransport(raw, this.maxJoints);
    if (!validation.ok) {
      this.rejected++;
      return { accepted: false, reason: validation.reason };
    }
    if (this.latest && raw.tick <= this.latest.tick) {
      this.rejected++;
      return { accepted: false, reason: "frame-tick-not-increasing" };
    }
    if (this.latest && raw.atMs < this.latest.atMs) {
      this.rejected++;
      return { accepted: false, reason: "frame-time-rewound" };
    }
    const snapshot = cloneFrame(raw);
    this.latest = snapshot;
    this.published++;
    for (const listener of this.listeners) {
      try {
        listener(cloneFrame(snapshot));
      } catch {
        this.listenerErrors++;
      }
    }
    return { accepted: true, reason: "frame-published" };
  }

  /** Return a defensive copy; callers cannot mutate the channel's latest slot. */
  readLatest(): MotorFrame | null {
    return this.latest ? cloneFrame(this.latest) : null;
  }

  /**
   * Subscribe to future frames. With replayLatest=true, the current snapshot is
   * delivered immediately. The returned disposer is idempotent.
   */
  subscribe(listener: MotorFrameListener, replayLatest = false): () => void {
    if (typeof listener !== "function") throw new TypeError("motor-frame-listener-must-be-function");
    if (!this.listeners.has(listener) && this.listeners.size >= this.maxListeners) {
      throw new Error("motor-frame-listener-capacity-exceeded");
    }
    this.listeners.add(listener);
    if (replayLatest && this.latest) {
      try {
        listener(cloneFrame(this.latest));
      } catch {
        this.listenerErrors++;
      }
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.latest = null;
  }

  diagnostics(): MotorFrameChannelDiagnostics {
    return {
      published: this.published,
      rejected: this.rejected,
      listenerErrors: this.listenerErrors,
      listenerCount: this.listeners.size,
      hasLatest: this.latest !== null,
      lastTick: this.latest?.tick ?? null,
      lastAtMs: this.latest?.atMs ?? null,
    };
  }
}
