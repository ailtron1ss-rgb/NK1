import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const OUTPUT_LIMIT = 64 * 1024;

export function appendOutputTail(previous, chunk, limit = OUTPUT_LIMIT) {
  return (previous + String(chunk)).slice(-limit);
}

export async function findAvailablePort({ host = '127.0.0.1', exclude = [] } = {}) {
  const excluded = new Set(exclude);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const server = createServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen({ host, port: 0, exclusive: true }, resolve);
    });
    const address = server.address();
    const port = address && typeof address === 'object' ? address.port : null;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (Number.isInteger(port) && port > 0 && !excluded.has(port)) return port;
  }
  throw new Error('Could not allocate a distinct ephemeral TCP port after 10 attempts');
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function signalProcess(child, signal) {
  if (!child?.pid) return;
  if (process.platform !== 'win32' && child.spawnargs && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch (error) {
      if (error?.code !== 'ESRCH') {
        try { child.kill(signal); } catch { /* process already exited */ }
        return;
      }
    }
  }
  try { child.kill(signal); } catch { /* process already exited */ }
}

export async function terminateChild(child, { graceMs = 1500, forceWaitMs = 1000 } = {}) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise(resolve => child.once('close', resolve));
  signalProcess(child, 'SIGTERM');
  const exitedGracefully = await Promise.race([closed.then(() => true), delay(graceMs).then(() => false)]);
  if (exitedGracefully) return;
  signalProcess(child, 'SIGKILL');
  await Promise.race([closed, delay(forceWaitMs)]);
}

export async function waitForHttp(url, {
  timeoutMs = 20_000,
  intervalMs = 150,
  requestTimeoutMs = 1_500,
  child = null,
  label = 'service',
  diagnostic = () => '',
} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new RangeError('timeoutMs must be a positive safe integer');
  const deadline = Date.now() + timeoutMs;
  let lastFailure = 'no response yet';
  while (Date.now() < deadline) {
    if (child && (!child.pid || child.exitCode !== null || child.signalCode !== null)) {
      throw new Error(`${label} exited before readiness (code=${child.exitCode ?? '—'}, signal=${child.signalCode ?? '—'}). ${diagnostic()}`);
    }
    const controller = new AbortController();
    const requestTimer = setTimeout(() => controller.abort(new Error('readiness request timed out')), requestTimeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) {
        await response.body?.cancel().catch(() => {});
        return response;
      }
      lastFailure = `HTTP ${response.status}`;
      await response.body?.cancel().catch(() => {});
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(requestTimer);
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await delay(Math.min(intervalMs, remaining));
  }
  throw new Error(`${label} readiness timed out after ${timeoutMs}ms at ${url}; last failure: ${lastFailure}. ${diagnostic()}`);
}

export function runCommand(label, command, args, {
  cwd,
  env = process.env,
  timeoutMs = 180_000,
  terminateGraceMs = 1_500,
  maxOutputChars = OUTPUT_LIMIT,
} = {}) {
  return new Promise(resolve => {
    let out = '';
    let err = '';
    let timedOut = false;
    let spawnError = null;
    let settled = false;
    let timeout;
    let escalation;
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      windowsHide: true,
    });
    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (escalation) clearTimeout(escalation);
      resolve({ label, code, signal, timedOut, error: spawnError, out, err });
    };
    child.stdout?.on('data', chunk => { out = appendOutputTail(out, chunk, maxOutputChars); });
    child.stderr?.on('data', chunk => { err = appendOutputTail(err, chunk, maxOutputChars); });
    child.once('error', error => { spawnError = error; finish(null, null); });
    child.once('close', (code, signal) => finish(code, signal));
    timeout = setTimeout(() => {
      timedOut = true;
      err = appendOutputTail(err, `\n[supervisor] ${label} exceeded ${timeoutMs}ms; terminating process group\n`, maxOutputChars);
      signalProcess(child, 'SIGTERM');
      escalation = setTimeout(() => signalProcess(child, 'SIGKILL'), terminateGraceMs);
      escalation.unref?.();
    }, timeoutMs);
    timeout.unref?.();
  });
}
