import { open, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

export type OperationalLevel = 'info' | 'warn' | 'error';
export interface OperationalRecord { at: number; level: OperationalLevel; event: string; data?: Record<string, unknown>; }
export interface OperationalJournalOptions {
  maxBytes?: number;
  maxRotations?: number;
  syncLevels?: readonly OperationalLevel[];
  syncEvents?: readonly string[];
  strictDirectoryFsync?: boolean;
}
export interface OperationalJournalMetrics {
  writes: number;
  bytesWritten: number;
  fsyncs: number;
  directoryFsyncs: number;
  rotations: number;
}

const DEFAULT_SYNC_EVENTS = [
  'runtime.stop.durable',
  'runtime.emergency-checkpoint',
  'runtime.p23.compound-repair-revision.staged',
  'runtime.p23.compound-repair-revision.completed',
  'runtime.p23.trusted-shadow.completed',
] as const;
const VALID_LEVELS: readonly OperationalLevel[] = ['info', 'warn', 'error'];
const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'ENOENT';

export class OperationalJournal {
  private readonly filePath: string;
  private readonly maxBytes: number;
  private readonly maxRotations: number;
  private readonly syncLevels: ReadonlySet<OperationalLevel>;
  private readonly syncEvents: ReadonlySet<string>;
  private readonly strictDirectoryFsync: boolean;
  private writeTail: Promise<void> = Promise.resolve();
  private stats: OperationalJournalMetrics = { writes: 0, bytesWritten: 0, fsyncs: 0, directoryFsyncs: 0, rotations: 0 };

  constructor(filePath: string, options: OperationalJournalOptions = {}) {
    if (typeof filePath !== 'string' || !filePath.trim()) throw new TypeError('operational-journal-path-invalid');
    this.filePath = filePath;
    this.maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
    this.maxRotations = options.maxRotations ?? 1;
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1 || this.maxBytes > 100 * 1024 * 1024) {
      throw new RangeError('operational-journal-max-bytes-invalid');
    }
    if (!Number.isSafeInteger(this.maxRotations) || this.maxRotations < 1 || this.maxRotations > 5) {
      throw new RangeError('operational-journal-max-rotations-invalid');
    }
    const levels = options.syncLevels ?? ['warn', 'error'];
    if (!Array.isArray(levels) || !levels.every(level => VALID_LEVELS.includes(level))) {
      throw new TypeError('operational-journal-sync-levels-invalid');
    }
    const events = options.syncEvents ?? DEFAULT_SYNC_EVENTS;
    if (!Array.isArray(events) || !events.every(event => typeof event === 'string' && event.length > 0 && event.length <= 160)) {
      throw new TypeError('operational-journal-sync-events-invalid');
    }
    this.syncLevels = new Set(levels);
    this.syncEvents = new Set(events);
    this.strictDirectoryFsync = options.strictDirectoryFsync === true;
  }

  metrics(): OperationalJournalMetrics { return { ...this.stats }; }

  /** Wait until every write queued before this call has completed. */
  flush(): Promise<void> { return this.writeTail; }

  write(level: OperationalLevel, event: string, data?: Record<string, unknown>): Promise<void> {
    if (!VALID_LEVELS.includes(level)) return Promise.reject(new TypeError('operational-journal-level-invalid'));
    if (typeof event !== 'string' || !event.trim() || event.length > 160) {
      return Promise.reject(new TypeError('operational-journal-event-invalid'));
    }
    const next = this.writeTail.then(() => this.writeInternal(level, event, data));
    this.writeTail = next.catch(() => {});
    return next;
  }

  private async writeInternal(level: OperationalLevel, event: string, data?: Record<string, unknown>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const record: OperationalRecord = { at: Date.now(), level, event, ...(data ? { data } : {}) };
    const line = JSON.stringify(record) + '\n';
    const bytes = Buffer.byteLength(line, 'utf8');
    await this.rotateIfNeeded(bytes);

    const handle = await open(this.filePath, 'a');
    try {
      await handle.writeFile(line, 'utf8');
      if (this.shouldSync(level, event)) {
        await handle.sync();
        this.stats.fsyncs += 1;
        await this.syncDirectory();
      }
    } finally {
      await handle.close();
    }
    this.stats.writes += 1;
    this.stats.bytesWritten += bytes;
  }

  private shouldSync(level: OperationalLevel, event: string): boolean {
    return this.syncLevels.has(level) || this.syncEvents.has(event);
  }

  private async rotateIfNeeded(incomingBytes: number): Promise<void> {
    let currentSize: number;
    try {
      currentSize = (await stat(this.filePath)).size;
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
    if (currentSize === 0 || currentSize + incomingBytes <= this.maxBytes) return;

    for (let index = this.maxRotations - 1; index >= 1; index -= 1) {
      const from = `${this.filePath}.${index}`;
      const to = `${this.filePath}.${index + 1}`;
      try { await unlink(to); } catch (error) { if (!isMissing(error)) throw error; }
      try { await rename(from, to); } catch (error) { if (!isMissing(error)) throw error; }
    }
    const firstRotation = `${this.filePath}.1`;
    try { await unlink(firstRotation); } catch (error) { if (!isMissing(error)) throw error; }
    await rename(this.filePath, firstRotation);
    this.stats.rotations += 1;
    await this.syncDirectory();
  }

  private async syncDirectory(): Promise<void> {
    try {
      const handle = await open(dirname(this.filePath), 'r');
      try {
        await handle.sync();
        this.stats.directoryFsyncs += 1;
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (this.strictDirectoryFsync) throw error;
    }
  }
}
