const DEFAULT_POLL_MS = 1_400;
const MAX_POLL_MS = 30_000;

/** Bounded exponential backoff for background snapshot polling after transport failures. */
export function snapshotPollDelayMs(failureCount: number, baseMs = DEFAULT_POLL_MS, maxMs = MAX_POLL_MS): number {
  const base = Number.isFinite(baseMs) && baseMs >= 250
    ? Math.max(250, Math.min(10_000, Math.floor(baseMs)))
    : DEFAULT_POLL_MS;
  const maximum = Number.isFinite(maxMs) && maxMs >= base
    ? Math.max(base, Math.min(120_000, Math.floor(maxMs)))
    : MAX_POLL_MS;
  const failures = Number.isFinite(failureCount) ? Math.max(0, Math.min(16, Math.floor(failureCount))) : 0;
  return Math.min(maximum, base * (2 ** failures));
}
