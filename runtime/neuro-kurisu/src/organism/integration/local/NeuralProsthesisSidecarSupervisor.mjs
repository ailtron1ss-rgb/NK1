import { spawn as spawnChild } from 'node:child_process';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function healthEndpoint(baseUrl) {
  if (!baseUrl) return null;
  let url;
  try { url = new URL(String(baseUrl)); }
  catch { throw new Error('neural-prosthesis-sidecar-invalid-base-url'); }
  if (
    url.protocol !== 'http:' ||
    !LOOPBACK_HOSTS.has(url.hostname.toLowerCase()) ||
    url.username || url.password || url.search || url.hash
  ) throw new Error('neural-prosthesis-sidecar-must-be-loopback-http');
  return new URL('/health', url).toString();
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener('exit', onExit);
      resolve(value);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once('exit', onExit);
  });
}

/** Explicitly opt-in lifecycle owner for NK1's local Transformers sidecar. */
export class NeuralProsthesisSidecarSupervisor {
  constructor(options = {}) {
    this.enabled = options.enabled === true;
    this.command = String(options.command ?? '').trim();
    this.args = Array.isArray(options.args) ? options.args.map(String) : [];
    this.cwd = options.cwd ? String(options.cwd) : undefined;
    this.env = options.env ?? process.env;
    this.healthUrl = healthEndpoint(options.baseUrl);
    const startupTimeout = Number(options.startupTimeoutMs ?? 120_000);
    const stopTimeout = Number(options.stopTimeoutMs ?? 3_000);
    this.startupTimeoutMs = Math.max(1_000, Math.min(600_000, Number.isFinite(startupTimeout) ? Math.floor(startupTimeout) : 120_000));
    this.stopTimeoutMs = Math.max(250, Math.min(10_000, Number.isFinite(stopTimeout) ? Math.floor(stopTimeout) : 3_000));
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.spawnImpl = options.spawnImpl ?? spawnChild;
    this.stdio = options.stdio ?? ['ignore', 'inherit', 'inherit'];
    this.child = null;
    this.managed = false;
    this.ready = false;
    this.lastError = null;
    this.stopRequested = false;
    this.startPromise = null;
  }

  snapshot() {
    return {
      enabled: this.enabled,
      configured: Boolean(this.healthUrl),
      ready: this.ready,
      managed: this.managed,
      pid: this.child?.pid ?? null,
      healthUrl: this.healthUrl,
      lastError: this.lastError,
    };
  }

  async probe() {
    if (!this.healthUrl) return false;
    try {
      const response = await this.fetchImpl(this.healthUrl, {
        signal: AbortSignal.timeout(750),
        redirect: 'error',
      });
      if (!response.ok) return false;
      const payload = await response.json();
      return payload?.ready === true && payload?.backend === 'neural-prosthesis';
    } catch {
      return false;
    }
  }

  async start() {
    if (!this.enabled) return { started: false, ready: false, reason: 'disabled' };
    if (this.startPromise) return this.startPromise;
    this.stopRequested = false;
    this.startPromise = this.startInternal();
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async startInternal() {
    if (!this.healthUrl) throw new Error('neural-prosthesis-sidecar-endpoint-required');
    if (this.stopRequested) throw new Error('sidecar-start-cancelled');
    if (this.managed && this.child) {
      if (await this.probe()) {
        this.ready = true;
        return { started: false, ready: true, managed: true, pid: this.child.pid };
      }
      await this.stop();
    }
    if (await this.probe()) {
      if (this.stopRequested) throw new Error('sidecar-start-cancelled');
      this.ready = true;
      this.managed = false;
      this.lastError = null;
      return { started: false, ready: true, reusedExisting: true };
    }
    if (this.stopRequested) throw new Error('sidecar-start-cancelled');
    if (!this.command) throw new Error('neural-prosthesis-sidecar-command-required');

    let child;
    try {
      child = this.spawnImpl(this.command, this.args, {
        cwd: this.cwd,
        env: this.env,
        stdio: this.stdio,
        shell: false,
        windowsHide: true,
      });
    } catch (error) {
      this.lastError = 'sidecar-spawn-failed';
      throw new Error(this.lastError, { cause: error });
    }
    this.child = child;
    this.managed = true;
    this.ready = false;
    this.lastError = null;

    let spawnError = null;
    let exitInfo = null;
    child.once('error', (error) => { spawnError = error; });
    child.once('exit', (code, signal) => {
      exitInfo = { code, signal };
      this.ready = false;
      // Clear the owned process immediately on an unexpected exit. During an
      // intentional stop(), the supervisor detaches the child before sending
      // SIGTERM/SIGKILL, so this branch cannot claim a normal shutdown as a crash.
      if (this.child === child && this.managed) {
        this.child = null;
        this.managed = false;
        if (!this.stopRequested) {
          this.lastError = `sidecar-exited-unexpectedly:code=${code};signal=${signal}`;
        }
      }
    });

    const deadline = Date.now() + this.startupTimeoutMs;
    while (Date.now() < deadline) {
      if (this.stopRequested) {
        this.lastError = 'sidecar-start-cancelled';
        await this.stop();
        throw new Error(this.lastError);
      }
      if (spawnError) {
        this.lastError = 'sidecar-spawn-failed';
        await this.stop();
        throw new Error(this.lastError, { cause: spawnError });
      }
      if (exitInfo || child.exitCode !== null || child.signalCode !== null) {
        const detail = exitInfo ? `code=${exitInfo.code};signal=${exitInfo.signal}` : 'process-exited';
        this.lastError = `sidecar-exited-before-health-check:${detail}`;
        this.child = null;
        this.managed = false;
        this.ready = false;
        throw new Error(this.lastError);
      }
      if (await this.probe()) {
        if (this.stopRequested) {
          this.lastError = 'sidecar-start-cancelled';
          await this.stop();
          throw new Error(this.lastError);
        }
        if (exitInfo || child.exitCode !== null || child.signalCode !== null) continue;
        this.ready = true;
        return { started: true, ready: true, managed: true, pid: child.pid };
      }
      await delay(Math.min(200, Math.max(1, deadline - Date.now())));
    }

    this.lastError = 'sidecar-startup-timeout';
    await this.stop();
    throw new Error(this.lastError);
  }

  async stop() {
    this.stopRequested = true;
    if (!this.managed || !this.child) return false;
    const child = this.child;
    this.child = null;
    this.managed = false;
    this.ready = false;
    if (child.exitCode !== null || child.signalCode !== null) return true;
    try { child.kill('SIGTERM'); } catch { /* Escalate below if it remains alive. */ }
    let exited = await waitForExit(child, this.stopTimeoutMs);
    if (!exited && child.exitCode === null && child.signalCode === null) {
      try { child.kill('SIGKILL'); } catch { /* The process may have exited concurrently. */ }
      exited = await waitForExit(child, Math.min(2_000, this.stopTimeoutMs));
    }
    if (!exited) this.lastError = 'sidecar-did-not-exit-after-kill';
    return true;
  }
}
