const MAX_GROUPS = 32;
const MAX_GROUP_LABEL = 80;
const safeInt = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
};
const groupKey = (value) => String(value ?? 'local-default').trim().slice(0, MAX_GROUP_LABEL) || 'local-default';

/**
 * Per-endpoint fair semaphore for local inference. It bounds concurrent model
 * loads and waiting callers, supports queued-request cancellation and keeps
 * diagnostics aggregate-only (no prompt, URL, model path or user text).
 *
 * Queue deadlines cover waiting only; providers still own their inference
 * timeout. Callers with an AbortSignal must also pass it to their provider.
 */
export class LocalInferenceScheduler {
  constructor({
    maxConcurrentPerGroup = 1,
    maxQueuedPerGroup = 16,
    queueTimeoutMs = 4_000,
    clock = () => Date.now(),
  } = {}) {
    this.maxConcurrentPerGroup = safeInt(maxConcurrentPerGroup, 1, 1, 8);
    this.maxQueuedPerGroup = safeInt(maxQueuedPerGroup, 16, 0, 128);
    this.queueTimeoutMs = safeInt(queueTimeoutMs, 4_000, 100, 30_000);
    this.clock = clock;
    this.groups = new Map();
    this.nextGroupId = 1;
  }

  _group(rawKey) {
    const key = groupKey(rawKey);
    let group = this.groups.get(key);
    if (!group) {
      group = {
        id: `resource-${this.nextGroupId++}`,
        active: 0,
        queue: [],
        started: 0,
        completed: 0,
        failed: 0,
        rejected: 0,
        cancelled: 0,
        timedOut: 0,
        totalQueueWaitMs: 0,
        maxQueueWaitMs: 0,
      };
      this.groups.set(key, group);
    }
    return group;
  }

  run(rawGroup, task, { signal, queueTimeoutMs = this.queueTimeoutMs } = {}) {
    if (typeof task !== 'function') return Promise.reject(new TypeError('local-inference-task-must-be-a-function'));
    if (signal?.aborted) return Promise.reject(new Error('local-inference-aborted'));

    const group = this._group(rawGroup);
    if (group.active < this.maxConcurrentPerGroup && group.queue.length === 0) {
      return this._execute(group, task, 0, signal);
    }
    if (group.queue.length >= this.maxQueuedPerGroup) {
      group.rejected++;
      return Promise.reject(new Error('local-inference-queue-full'));
    }

    const timeoutMs = safeInt(queueTimeoutMs, this.queueTimeoutMs, 100, 30_000);
    return new Promise((resolve, reject) => {
      const entry = {
        enqueuedAt: this.clock(),
        task,
        signal,
        resolve,
        reject,
        timer: null,
        abortHandler: null,
        settled: false,
      };
      const removeQueued = (error, counter) => {
        if (entry.settled) return;
        const index = group.queue.indexOf(entry);
        if (index < 0) return;
        group.queue.splice(index, 1);
        entry.settled = true;
        if (entry.timer) clearTimeout(entry.timer);
        if (entry.abortHandler) signal?.removeEventListener('abort', entry.abortHandler);
        group[counter]++;
        reject(error);
        this._drain(group);
      };

      if (signal) {
        entry.abortHandler = () => removeQueued(new Error('local-inference-aborted'), 'cancelled');
        signal.addEventListener('abort', entry.abortHandler, { once: true });
      }
      entry.timer = setTimeout(() => removeQueued(new Error('local-inference-queue-timeout'), 'timedOut'), timeoutMs);
      entry.timer.unref?.();
      group.queue.push(entry);
      this._drain(group);
    });
  }

  async _execute(group, task, waitMs, signal) {
    group.active++;
    group.started++;
    group.totalQueueWaitMs += waitMs;
    group.maxQueueWaitMs = Math.max(group.maxQueueWaitMs, waitMs);
    try {
      if (signal?.aborted) throw new Error('local-inference-aborted');
      const result = await task();
      group.completed++;
      return result;
    } catch (error) {
      group.failed++;
      throw error;
    } finally {
      group.active = Math.max(0, group.active - 1);
      this._drain(group);
    }
  }

  _drain(group) {
    while (group.active < this.maxConcurrentPerGroup && group.queue.length > 0) {
      const entry = group.queue.shift();
      if (!entry || entry.settled) continue;
      entry.settled = true;
      if (entry.timer) clearTimeout(entry.timer);
      if (entry.abortHandler) entry.signal?.removeEventListener('abort', entry.abortHandler);
      const waitMs = Math.max(0, this.clock() - entry.enqueuedAt);
      this._execute(group, entry.task, waitMs, entry.signal).then(entry.resolve, entry.reject);
    }
  }

  snapshot() {
    const groups = [...this.groups.values()].slice(0, MAX_GROUPS).map(group => ({
      id: group.id,
      active: group.active,
      pending: group.queue.length,
      started: group.started,
      completed: group.completed,
      failed: group.failed,
      rejected: group.rejected,
      cancelled: group.cancelled,
      timedOut: group.timedOut,
      totalQueueWaitMs: Math.max(0, Math.min(86_400_000, group.totalQueueWaitMs)),
      maxQueueWaitMs: Math.max(0, Math.min(30_000, group.maxQueueWaitMs)),
    }));
    return {
      version: 1,
      policy: 'per-local-endpoint-bounded-fifo',
      maxConcurrentPerGroup: this.maxConcurrentPerGroup,
      maxQueuedPerGroup: this.maxQueuedPerGroup,
      queueTimeoutMs: this.queueTimeoutMs,
      active: groups.reduce((sum, row) => sum + row.active, 0),
      pending: groups.reduce((sum, row) => sum + row.pending, 0),
      groups,
      // Do not expose endpoint/group keys, model paths, prompts or payloads.
      privacy: { endpointKeysExposed: false, promptsLogged: false, modelPathsLogged: false },
    };
  }
}

/** Collapse different local API paths on the same origin into one resource lane. */
export function localEndpointResourceKey(provider, fallbackRole = 'local-default') {
  const candidate = provider?.baseUrl ?? provider?.endpoint?.();
  try {
    const raw = candidate instanceof URL ? candidate.toString() : String(candidate ?? '');
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
  } catch {
    // Providers with no endpoint or non-URL adapters receive their own bounded role lane.
  }
  return `role:${String(fallbackRole).slice(0, 60)}`;
}
