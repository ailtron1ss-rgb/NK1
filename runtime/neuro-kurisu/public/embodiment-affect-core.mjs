/**
 * Shared, browser-safe interpolation for low-frequency avatar affect.
 * Mouth/viseme state is deliberately excluded so speech remains on its monotonic audio clock.
 */
const clamp = (n, low, high) => Math.max(low, Math.min(high, Number.isFinite(n) ? n : low));

/**
 * Smooth slow affective channels without touching viseme/audio timing.
 * A monotonic timestamp and bounded time constant prevent late snapshots from
 * rewinding the avatar or producing large single-frame jumps.
 */
export function smoothEmbodimentAffect(previous, target, nowMs, timeConstantMs = 180) {
  const bounded = {
    expressionIntensity: clamp(target.expressionIntensity, 0, 1),
    gazeX: clamp(target.gazeX, -1, 1),
    gazeY: clamp(target.gazeY, -1, 1),
    headTilt: clamp(target.headTilt, -0.15, 0.15),
    voiceEmphasis: clamp(target.voiceEmphasis, 0, 1),
  };
  const now = Number.isFinite(nowMs) ? Math.max(0, nowMs) : (previous?.sampleAtMs ?? 0);
  if (!previous) return { sampleAtMs: now, ...bounded };
  if (!Number.isFinite(previous.sampleAtMs) || now <= previous.sampleAtMs) return { ...previous };
  const tau = clamp(timeConstantMs, 40, 1000);
  const elapsed = Math.min(1000, now - previous.sampleAtMs);
  const alpha = 1 - Math.exp(-elapsed / tau);
  const blend = (before, after, low, high) => clamp(before + (after - before) * alpha, low, high);
  return {
    sampleAtMs: now,
    expressionIntensity: blend(previous.expressionIntensity, bounded.expressionIntensity, 0, 1),
    gazeX: blend(previous.gazeX, bounded.gazeX, -1, 1),
    gazeY: blend(previous.gazeY, bounded.gazeY, -1, 1),
    headTilt: blend(previous.headTilt, bounded.headTilt, -0.15, 0.15),
    voiceEmphasis: blend(previous.voiceEmphasis, bounded.voiceEmphasis, 0, 1),
  };
}
