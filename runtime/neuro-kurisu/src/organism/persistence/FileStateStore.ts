import { access, copyFile, mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { deserialize, serialize } from 'node:v8';

export interface StateStoreMetrics {
  saves: number;
  bytesWritten: number;
  lastPayloadBytes: number;
  lastSaveMs: number;
  backupCopies: number;
  fsyncs: number;
  lastSavedAt: number;
  skippedUnchangedSaves: number;
}

export interface JsonStateStore<T> {
  load(): Promise<T | null>;
  save(value: T): Promise<void>;
  metrics?(): StateStoreMetrics;
}

export class StateCorruptionError extends Error {
  readonly filePath: string;
  readonly backupPath: string;
  constructor(filePath: string, backupPath: string, message: string) {
    super(message);
    this.name = 'StateCorruptionError';
    this.filePath = filePath;
    this.backupPath = backupPath;
  }
}

export type StateStoreEncoding = 'json' | 'v8';

export interface FileStateStoreOptions {
  backupEverySaves?: number;
  encoding?: StateStoreEncoding;
  directoryFsyncEverySaves?: number;
  strictDirectoryFsync?: boolean;
}

const now = () => Date.now();

// Count UTF-8 bytes without allocating a second Uint8Array for the full JSON payload.
// JSON.stringify emits lone surrogates escaped, while valid surrogate pairs remain as
// Unicode code units; both cases are handled explicitly here.
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i += 1; }
      else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

function crashInject(point: string): void {
  const wanted = String(process.env.NEURO_CRASH_INJECT ?? '');
  if (wanted !== point) return;
  console.error(`[FileStateStore] crash-injection:${point}`);
  process.kill(process.pid, 'SIGKILL');
}

export class FileStateStore<T> implements JsonStateStore<T> {
  private readonly filePath: string;
  private readonly backupPath: string;
  private readonly backupEverySaves: number;
  private readonly encoding: StateStoreEncoding;
  private readonly directoryFsyncEverySaves: number;
  private readonly strictDirectoryFsync: boolean;
  private saveCount = 0;
  private lastPayloadHash = '';
  private stats: StateStoreMetrics = { saves: 0, bytesWritten: 0, lastPayloadBytes: 0, lastSaveMs: 0, backupCopies: 0, fsyncs: 0, lastSavedAt: 0, skippedUnchangedSaves: 0 };
  // A single state store can be flushed by multiple concurrent runtime steps. Serialize saves
  // per store so each temp file survives until its own fsync/rename sequence completes.
  private saveTail: Promise<void> = Promise.resolve();
  constructor(filePath: string, options: FileStateStoreOptions = {}) {
    this.filePath = filePath;
    this.backupPath = `${filePath}.bak`;
    this.backupEverySaves = Math.max(1, Math.floor(options.backupEverySaves ?? Number(process.env.NEURO_BACKUP_EVERY_SAVES || 4)));
    this.encoding = options.encoding ?? (/^v8$/i.test(String(process.env.NEURO_STATE_FORMAT || '')) ? 'v8' : 'json');
    this.strictDirectoryFsync = options.strictDirectoryFsync ?? /^(1|true|yes|on)$/i.test(String(process.env.NEURO_STRICT_FSYNC ?? 'false'));
    this.directoryFsyncEverySaves = Math.max(1, Math.floor(options.directoryFsyncEverySaves ?? Number(process.env.NEURO_DIRECTORY_FSYNC_EVERY_SAVES || 4)));
  }

  metrics(): StateStoreMetrics { return { ...this.stats }; }

  /** Returns a sibling persistence path for a durable sidecar owned by this store. */
  siblingPath(suffix: string): string {
    const safe = String(suffix ?? '').trim();
    if (!/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(safe)) throw new Error('invalid-state-sidecar-suffix');
    return `${this.filePath}.${safe}`;
  }

  private decodePayload(payload: Uint8Array): T {
    if (this.encoding === 'v8') {
      try { return deserialize(payload) as T; } catch {
        // Backward compatibility: an existing JSON state can be read by a V8-configured store
        // and will be migrated to binary on the next successful save.
      }
    }
    return JSON.parse(new TextDecoder().decode(payload)) as T;
  }

  async load(): Promise<T | null> {
    try {
      const payload = await readFile(this.filePath);
      this.lastPayloadHash = createHash('sha256').update(payload).digest('hex');
      return this.decodePayload(payload);
    } catch (error: any) {
      if (error?.code === 'ENOENT') return null;
      try {
        const recovered = this.decodePayload(await readFile(this.backupPath));
        console.warn(`[FileStateStore] recovered state from backup: ${this.backupPath}`);
        return recovered;
      } catch (backupError: any) {
        throw new StateCorruptionError(
          this.filePath,
          this.backupPath,
          `Primary state is unreadable and backup recovery failed: ${error?.message || String(error)}; backup=${backupError?.message || String(backupError)}`,
        );
      }
    }
  }

  async save(value: T): Promise<void> {
    const next = this.saveTail.then(() => this.saveInternal(value));
    this.saveTail = next.catch(() => {});
    return next;
  }

  private async saveInternal(value: T): Promise<void> {
    const startedAt = now();
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    const payload = this.encoding === 'v8'
      ? serialize(value)
      : new TextEncoder().encode(process.env.NEURO_STATE_PRETTY === '1' ? JSON.stringify(value, null, 2) : JSON.stringify(value));
    const payloadHash = createHash('sha256').update(payload).digest('hex');
    if (payloadHash === this.lastPayloadHash) {
      try {
        await access(this.filePath);
        this.stats = { ...this.stats, skippedUnchangedSaves: this.stats.skippedUnchangedSaves + 1 };
        return;
      } catch {
        // The state file disappeared externally; recreate it even though the payload is unchanged.
      }
    }
    await writeFile(tmp, payload as unknown as string, 'utf8');
    crashInject('after-tmp-write');
    const handle = await open(tmp, 'r+');
    try { await handle.sync(); this.stats.fsyncs += 1; } finally { await handle.close(); }
    crashInject('after-file-fsync');

    this.saveCount += 1;
    const shouldBackup = this.saveCount === 1 || (this.saveCount % this.backupEverySaves === 0);
    if (shouldBackup) {
      try {
        await access(this.filePath);
        await copyFile(this.filePath, this.backupPath);
        this.stats.backupCopies += 1;
      } catch (error: any) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    crashInject('after-backup');

    crashInject('before-rename');
    await rename(tmp, this.filePath);
    crashInject('after-rename');
    if (this.strictDirectoryFsync || this.saveCount % this.directoryFsyncEverySaves === 0 || shouldBackup) {
      try {
      const dirHandle = await open(dirname(this.filePath), 'r');
      try { await dirHandle.sync(); this.stats.fsyncs += 1; } finally { await dirHandle.close(); }
      } catch { /* directory fsync is not available on every filesystem */ }
    }

    const elapsed = now() - startedAt;
    this.lastPayloadHash = payloadHash;
    this.stats = {
      ...this.stats,
      saves: this.stats.saves + 1,
      bytesWritten: this.stats.bytesWritten + payload.byteLength,
      lastPayloadBytes: payload.byteLength,
      lastSaveMs: elapsed,
      lastSavedAt: now(),
    };
  }
}
