import { deserialize, serialize } from 'node:v8';
import type { StateStoreMetrics } from './FileStateStore.ts';

export interface MemoryStateStoreOptions<T> { initial?: T | null; }

/**
 * In-process durable boundary used by tests, embedded runtimes and mobile execution.
 *
 * The previous implementation retained a second full object graph and rebuilt it with
 * structuredClone() on every save/load. V8's binary serializer gives us the same
 * detached-state semantics while storing a compact Buffer instead of another object
 * graph, which materially lowers transient heap pressure on long-lived mobile runs.
 */
export class MemoryStateStore<T> {
  private payload: Uint8Array | null = null;
  private stats: StateStoreMetrics = {
    saves: 0,
    bytesWritten: 0,
    lastPayloadBytes: 0,
    lastSaveMs: 0,
    backupCopies: 0,
    fsyncs: 0,
    lastSavedAt: 0,
    skippedUnchangedSaves: 0,
  };

  constructor(options: MemoryStateStoreOptions<T> = {}) {
    if (options.initial != null) this.payload = serialize(options.initial);
  }

  metrics(): StateStoreMetrics {
    return { ...this.stats };
  }

  async load(): Promise<T | null> {
    return this.payload == null ? null : deserialize(this.payload) as T;
  }

  async save(value: T): Promise<void> {
    const startedAt = performance.now();
    const nextPayload = serialize(value);
    const elapsed = performance.now() - startedAt;
    this.payload = nextPayload;
    this.stats = {
      ...this.stats,
      saves: this.stats.saves + 1,
      lastPayloadBytes: nextPayload.byteLength,
      lastSaveMs: elapsed,
      lastSavedAt: Date.now(),
    };
  }
}
