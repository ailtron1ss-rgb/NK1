import { spawn } from 'node:child_process';

const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;

function withTail(current, chunk, maxBytes) {
  const next = Buffer.concat([current, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
  if (next.length <= maxBytes) return { buffer: next, truncated: false };
  return { buffer: next.subarray(next.length - maxBytes), truncated: true };
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
  } = options;
  const maxBytes = Number.isFinite(maxOutputBytes) ? Math.max(0, Math.floor(maxOutputBytes)) : DEFAULT_MAX_OUTPUT_BYTES;
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
      const result = withTail(out, chunk, maxBytes);
      out = result.buffer;
      outTruncated ||= result.truncated;
    });
    child.stderr?.on('data', (chunk) => {
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
        void terminateChild(child, { graceMs: terminationGraceMs, forceGraceMs }).then(() => {
          const closed = closeResult ?? { code: child.exitCode, signal: child.signalCode };
          finish(closed.code, closed.signal);
        });
        finalTimer = setTimeout(() => finish(closeResult?.code ?? null, closeResult?.signal ?? 'SIGKILL'),
          terminationGraceMs + forceGraceMs + 1_000);
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
  const startedAt = Date.now();
  const deadline = startedAt + Math.max(0, timeoutMs);
  let lastError = 'deadline elapsed before a successful response';

  while (Date.now() < deadline) {
    const remainingMs = deadline - Date.now();
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(requestTimeoutMs, remainingMs))),
      });
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
