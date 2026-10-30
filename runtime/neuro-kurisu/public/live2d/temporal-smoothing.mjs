/**
 * Frame-rate-independent animation primitives for the canonical NK1 Live2D viewers.
 * All callers supply elapsed seconds/milliseconds; values are bounded against tab-sleep jumps.
 */
export function smoothingAlpha(deltaSeconds, timeConstantSeconds) {
  const dt = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(0.1, deltaSeconds)) : 0;
  const tau = Number.isFinite(timeConstantSeconds) ? Math.max(0.001, timeConstantSeconds) : 0.16;
  return 1 - Math.exp(-dt / tau);
}

export function smoothToward(current, target, deltaSeconds, timeConstantSeconds) {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return Number.isFinite(current) ? current : 0;
  return current + (target - current) * smoothingAlpha(deltaSeconds, timeConstantSeconds);
}

function easeUnit(value) {
  const t = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return t * t * (3 - 2 * t);
}

/**
 * Symmetric, bounded blink envelope: closed at both ends and fully closed at midpoint.
 * Sampling by elapsed time keeps blink shape identical at 14/30/60/144 Hz.
 */
export function sampleBlink(elapsedMs, durationMs = 180) {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(durationMs) || durationMs <= 0) return 0;
  const progress = elapsedMs / durationMs;
  if (progress <= 0 || progress >= 1) return 0;
  return progress < 0.5
    ? easeUnit(progress * 2)
    : 1 - easeUnit((progress - 0.5) * 2);
}
