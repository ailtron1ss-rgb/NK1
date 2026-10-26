/**
 * Retry only an explicitly identified, transient approval-persistence conflict.
 * Callers must supply a precise predicate; permanent storage failures and other
 * results are returned immediately. The operation itself remains fail-closed.
 */
export async function retryTransientApprovalStorage(operation, isBusy, options = {}) {
  if (typeof operation !== 'function' || typeof isBusy !== 'function') {
    throw new TypeError('approval retry requires operation and isBusy functions');
  }

  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(0, options.timeoutMs) : 8000;
  const initialDelayMs = Number.isFinite(options.initialDelayMs) ? Math.max(1, options.initialDelayMs) : 25;
  const maxDelayMs = Number.isFinite(options.maxDelayMs) ? Math.max(initialDelayMs, options.maxDelayMs) : 250;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const sleep = typeof options.sleep === 'function'
    ? options.sleep
    : ms => new Promise(resolve => setTimeout(resolve, ms));

  const deadline = now() + timeoutMs;
  let delayMs = initialDelayMs;
  let attempts = 0;
  let lastBusyResult;

  for (;;) {
    // Never start another operation after the retry deadline; the first
    // attempt is always allowed, even when timeoutMs is zero.
    if (attempts > 0 && now() >= deadline) {
      return { result: lastBusyResult, exhausted: true, attempts };
    }

    attempts += 1;
    const result = await operation();
    if (!isBusy(result)) return { result, exhausted: false, attempts };
    lastBusyResult = result;

    const remainingMs = deadline - now();
    if (remainingMs <= 0) return { result, exhausted: true, attempts };

    await sleep(Math.min(delayMs, remainingMs));
    delayMs = Math.min(maxDelayMs, delayMs * 2);
  }
}
