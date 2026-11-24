/** Compute a request timeout that cannot outlive the overall smoke deadline. */
export function timeoutWithinDeadline(deadline, maxTimeoutMs = 4_000, now = Date.now()) {
  if (!Number.isFinite(deadline) || !Number.isFinite(maxTimeoutMs) || !Number.isFinite(now)) return 0;
  const remaining = Math.floor(deadline - now);
  if (remaining <= 0) return 0;
  const ceiling = Math.max(1, Math.floor(maxTimeoutMs));
  return Math.max(1, Math.min(ceiling, remaining));
}

/** Bounded startup polling for disposable integration-test servers. */
export async function pollUntilReady({
  probe,
  isChildExited = () => false,
  timeoutMs = 30_000,
  intervalMs = 100,
  probeTimeoutMs = 1_000,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (typeof probe !== 'function') throw new TypeError('probe must be a function');
  const safeTimeout = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(120_000, Math.floor(timeoutMs))) : 30_000;
  const safeInterval = Number.isFinite(intervalMs) ? Math.max(1, Math.min(2_000, Math.floor(intervalMs))) : 100;
  const safeProbeTimeout = Number.isFinite(probeTimeoutMs) ? Math.max(1, Math.min(10_000, Math.floor(probeTimeoutMs))) : 1_000;
  const startedAt = now();
  const deadline = startedAt + safeTimeout;
  let attempts = 0;
  let lastError = '';

  while (!isChildExited() && now() < deadline) {
    attempts += 1;
    const remainingMs = Math.max(1, deadline - now());
    try {
      if (await probe(Math.max(1, Math.min(safeProbeTimeout, remainingMs)))) {
        return { ready: true, attempts, elapsedMs: Math.max(0, now() - startedAt), childExited: false, lastError: '' };
      }
    } catch (error) {
      lastError = String(error?.code || error?.name || 'probe-failed').slice(0, 120);
    }
    if (isChildExited() || now() >= deadline) break;
    await sleep(Math.max(1, Math.min(safeInterval, deadline - now())));
  }

  return {
    ready: false,
    attempts,
    elapsedMs: Math.max(0, now() - startedAt),
    childExited: Boolean(isChildExited()),
    lastError,
  };
}
