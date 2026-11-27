export const AVATAR_BODY_MOTION_STEP_INTERVAL_MS = 50;

/**
 * Keep the semantic body controller and particle solver on a bounded 20 Hz
 * cadence. The visual renderer remains independent and interpolates between
 * physics snapshots. A monotonic timestamp is supplied by requestAnimationFrame.
 */
export function shouldStepAvatarBodyMotion(nowMs: number, lastStepAtMs: number): boolean {
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastStepAtMs)) return false;
  return nowMs >= lastStepAtMs + AVATAR_BODY_MOTION_STEP_INTERVAL_MS;
}
