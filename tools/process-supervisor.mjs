import { spawn } from 'node:child_process';

const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

function assertTimerDelay(name, value, { allowZero = true } = {}) {
  const minimumValid = allowZero ? value >= 0 : value > 0;
  if (!Number.isFinite(value) || !minimumValid || value > MAX_TIMER_DELAY_MS) {
    const qualifier = allowZero ? 'finite and non-negative' : 'finite and positive';
    throw new RangeError(`${name} must be ${qualifier} and no greater than ${MAX_TIMER_DELAY_MS}ms`);
  }
}

function withTail(current, chunk, maxBytes) {
  const incoming = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  if (maxBytes <= 0) {
    return { buffer: Buffer.alloc(0), truncated: current.length > 0 || incoming.length > 0 };
  }
  // A single oversized chunk already contains the complete tail we need. Copy
  // only that suffix instead of concatenating it with older, now-useless bytes.
  if (incoming.length >= maxBytes) {
    return {
      buffer: Buffer.from(incoming.subarray(incoming.length - maxBytes)),
      truncated: incoming.length > maxBytes || current.length > 0,
    };
  }

  const totalLength = current.length + incoming.length;
  if (totalLength <= maxBytes) {
    return { buffer: Buffer.concat([current, incoming], totalLength), truncated: false };
  }

  // Retain exactly enough of the prior tail to fit the new chunk. This avoids
  // allocating and then discarding the full oversized concatenation each time.
  const keepCurrent = maxBytes - incoming.length;
  const currentTail = current.subarray(Math.max(0, current.length - keepCurrent));
  return {
    buffer: Buffer.concat([currentTail, incoming], currentTail.length + incoming.length),
    truncated: true,
  };
}

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function sendSignal(child, signal) {
  if (!child?.pid) return false;
  if (child.__nkProcessGroup && process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return true;
    } catch (error) {
      if (error?.code !== 'ESRCH' && error?.code !== 'EPERM') return false;
    }
  }
  try {
    return child.kill(signal);
  } catch {
    return false;
  }
}

function processGroupExists(pid) {
  if (!pid || process.platform === 'win32') return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

/**
 * Spawn a child in a separate process group on POSIX, so shutdown can clean up
 * npm/python/node descendants as a unit. On Windows, fall back to ChildProcess.
 */
export function spawnManaged(command, args = [], options = {}) {
  const detached = options.detached ?? process.platform !== 'win32';
  const child = spawn(command, args, { ...options, detached, windowsHide: true });
  child.__nkProcessGroup = detached && process.platform !== 'win32';
  return child;
}

/**
 * Send TERM, then escalate to KILL if the process (or its POSIX process group)
 * does not stop. The bounded wait prevents server launchers from exiting while
 * background descendants are still alive.
 */
export function terminateChild(child, { graceMs = 1_000, forceGraceMs = 500 } = {}) {
  if (!child) return Promise.resolve({ stopped: true, alreadyExited: true, forced: false });
  assertTimerDelay('graceMs', graceMs);
  assertTimerDelay('forceGraceMs', forceGraceMs);
  if (hasExited(child) && !(child.__nkProcessGroup && processGroupExists(child.pid))) {
    return Promise.resolve({ stopped: true, alreadyExited: true, forced: false, code: child.exitCode, signal: child.signalCode });
  }

  return new Promise((resolvePromise) => {
    let settled = false;
    let closed = false;
    let forced = false;
    let closeCode = null;
    let closeSignal = null;
    let graceTimer;
    let forceTimer;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(graceTimer);
      clearTimeout(forceTimer);
      child.removeListener('close', onClose);
      child.removeListener('error', onError);
      resolvePromise({
        stopped: child.__nkProcessGroup && processGroupExists(child.pid) ? false : (closed || hasExited(child)),
        alreadyExited: false,
        forced,
        code: closeCode ?? child.exitCode,
        signal: closeSignal ?? child.signalCode,
      });
    };

    const onClose = (code, signal) => {
      closed = true;
      closeCode = code;
      closeSignal = signal;
      // A POSIX parent may exit before its descendants. Wait through the grace
      // period so the entire detached group can be checked and cleaned up.
      if (!child.__nkProcessGroup || !processGroupExists(child.pid)) finish();
    };
    const onError = () => {
      if (!child.pid) finish();
    };

    child.once('close', onClose);
    child.once('error', onError);
    sendSignal(child, 'SIGTERM');

    graceTimer = setTimeout(() => {
      if (child.__nkProcessGroup && processGroupExists(child.pid)) {
        forced = true;
        sendSignal(child, 'SIGKILL');
        forceTimer = setTimeout(finish, forceGraceMs);
        forceTimer.unref?.();
        return;
      }

      if (!closed && !hasExited(child)) {
        forced = true;
        sendSignal(child, 'SIGKILL');
        forceTimer = setTimeout(finish, forceGraceMs);
        forceTimer.unref?.();
        return;
      }

      finish();
    }, graceMs);
    graceTimer.unref?.();
  });
}

export async function terminateChildren(children, options = {}) {
  return Promise.all(children.filter(Boolean).map((child) => terminateChild(child, options)));
}

/**
 * Run an external command with a wall-clock deadline and bounded diagnostic
 * output. Output keeps its tail, which is usually the most useful part of a
 * failed typecheck or integration command.
 */
export function runCommand(command, args = [], options = {}) {
  const {
    cwd,
    env,
    timeoutMs = 120_000,
    terminationGraceMs = 1_000,
    forceGraceMs = 500,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
    streamOutput = false,
  } = options;
  const maxBytes = Number.isFinite(maxOutputBytes) ? Math.max(0, Math.floor(maxOutputBytes)) : DEFAULT_MAX_OUTPUT_BYTES;
  // Node clamps oversized timer delays to 1ms; rejecting invalid values avoids
  // silently turning a requested long deadline into an almost immediate kill.
  assertTimerDelay('timeoutMs', timeoutMs);
  assertTimerDelay('terminationGraceMs', terminationGraceMs);
  assertTimerDelay('forceGraceMs', forceGraceMs);
  assertTimerDelay('timeout cleanup deadline', terminationGraceMs + forceGraceMs + 1_000);
  const startedAt = Date.now();

  return new Promise((resolvePromise) => {
    let out = Buffer.alloc(0);
    let err = Buffer.alloc(0);
    let outTruncated = false;
    let errTruncated = false;
    let timedOut = false;
    let spawnError = null;
    let settled = false;
    let timeoutTimer;
    let forceTimer;
    let finalTimer;
    let timeoutCleanupStarted = false;
    let closeResult = null;
    let terminationResult = null;

    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(forceTimer);
      clearTimeout(finalTimer);
      resolvePromise({
        command,
        args,
        code,
        signal,
        timedOut,
        error: spawnError?.message ?? null,
        out: out.toString('utf8'),
        err: err.toString('utf8'),
        outTruncated,
        errTruncated,
        terminationResult,
        cleanupFailed: Boolean(terminationResult && !terminationResult.stopped),
        durationMs: Date.now() - startedAt,
      });
    };

    let child;
    try {
      child = spawnManaged(command, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      spawnError = error;
      finish(null, null);
      return;
    }

    child.stdout?.on('data', (chunk) => {
      if (streamOutput) process.stdout.write(chunk);
      const result = withTail(out, chunk, maxBytes);
      out = result.buffer;
      outTruncated ||= result.truncated;
    });
    child.stderr?.on('data', (chunk) => {
      if (streamOutput) process.stderr.write(chunk);
      const result = withTail(err, chunk, maxBytes);
      err = result.buffer;
      errTruncated ||= result.truncated;
    });
    child.once('error', (error) => {
      spawnError = error;
      if (!child.pid) finish(null, null);
    });
    child.once('close', (code, signal) => {
      closeResult = { code, signal };
      if (!timeoutCleanupStarted) finish(code, signal);
    });

    if (Number.isFinite(timeoutMs) && timeoutMs >= 0) {
      timeoutTimer = setTimeout(() => {
        if (settled) return;
        timedOut = true;
        timeoutCleanupStarted = true;
        void terminateChild(child, { graceMs: terminationGraceMs, forceGraceMs }).then((result) => {
          terminationResult = result;
          const closed = closeResult ?? { code: child.exitCode, signal: child.signalCode };
          finish(closed.code, closed.signal);
        }).catch((error) => {
          terminationResult = { stopped: false, error: error instanceof Error ? error.message : String(error) };
          const closed = closeResult ?? { code: child.exitCode, signal: child.signalCode };
          finish(closed.code, closed.signal);
        });
        finalTimer = setTimeout(() => {
          terminationResult ??= { stopped: false, error: 'termination deadline exceeded' };
          finish(closeResult?.code ?? null, closeResult?.signal ?? 'SIGKILL');
        }, terminationGraceMs + forceGraceMs + 1_000);
      }, timeoutMs);
      timeoutTimer.unref?.();
    }
  });
}

/**
 * Poll a readiness endpoint rather than relying on a fixed sleep. Requests are
 * individually bounded and the overall wait always has a deadline.
 */
export async function waitForHttp(url, {
  timeoutMs = 15_000,
  intervalMs = 100,
  requestTimeoutMs = 1_000,
  fetchImpl = fetch,
} = {}) {
  assertTimerDelay('timeoutMs', timeoutMs);
  assertTimerDelay('intervalMs', intervalMs);
  assertTimerDelay('requestTimeoutMs', requestTimeoutMs, { allowZero: false });
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let lastError = 'deadline elapsed before a successful response';

  while (Date.now() < deadline) {
    const remainingMs = deadline - Date.now();
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(requestTimeoutMs, remainingMs))),
      });
      // Readiness probes only need status metadata. Release the response body
      // without awaiting cancellation, so an unusual stream cannot extend the
      // probe beyond its overall deadline.
      try {
        response.body?.cancel?.()?.catch?.(() => {});
      } catch {
        // Body disposal is best-effort; preserve the actual readiness result.
      }
      if (response.ok) {
        return { ok: true, status: response.status, error: null, elapsedMs: Date.now() - startedAt };
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    const pauseMs = Math.min(Math.max(0, intervalMs), deadline - Date.now());
    if (pauseMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, pauseMs));
  }

  return { ok: false, status: null, error: lastError, elapsedMs: Date.now() - startedAt };
}
