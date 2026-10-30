import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { ExperimentCampaignRegistry } from './ExperimentCampaignRegistry.ts';

const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;
const FORMAT = 'nk1-experiment-campaign-registry';
const FORMAT_VERSION = 1;

interface StoredCampaignEnvelope {
  format: typeof FORMAT;
  formatVersion: typeof FORMAT_VERSION;
  payload: ReturnType<ExperimentCampaignRegistry['snapshot']>;
  sha256: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

/**
 * Durable local-file campaign registry.
 *
 * - Every mutation is performed inside transact(), which creates an exclusive
 *   same-directory lock file, loads the latest snapshot, applies one operation,
 *   then atomically replaces the snapshot.
 * - A crash can leave a stale lock file. This intentionally blocks future writes
 *   until an operator verifies that no owner is active and removes the stale lock.
 * - This provides single-host filesystem serialization, not a distributed lock
 *   for NFS/object storage or a multi-host deployment.
 * - The SHA-256 envelope detects accidental corruption; it is not an HMAC/signature.
 */
export class ExperimentCampaignRegistryFileStore {
  private readonly filePath: string;
  private readonly lockPath: string;
  private readonly maxBytes: number;

  constructor(filePath: string, maxBytes = DEFAULT_MAX_BYTES) {
    if (typeof filePath !== 'string' || !filePath.trim() ||
        !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
      throw new Error('invalid experiment campaign file-store configuration');
    }
    this.filePath = filePath;
    this.lockPath = `${filePath}.lock`;
    this.maxBytes = maxBytes;
  }

  /** Read the last committed snapshot. Missing files are an error; transact() creates a new registry. */
  async load(): Promise<ExperimentCampaignRegistry> {
    const info = await stat(this.filePath);
    if (!info.isFile() || info.size > this.maxBytes) {
      throw new Error('campaign registry file is not regular or exceeds size limit');
    }
    const serialized = await readFile(this.filePath, 'utf8');
    if (new TextEncoder().encode(serialized).byteLength > this.maxBytes) {
      throw new Error('campaign registry exceeds configured size limit');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw new Error('campaign registry persistence is not valid JSON');
    }
    if (!isRecord(parsed) || parsed.format !== FORMAT ||
        parsed.formatVersion !== FORMAT_VERSION || !isRecord(parsed.payload) ||
        typeof parsed.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(parsed.sha256)) {
      throw new Error('unsupported or malformed campaign registry envelope');
    }
    if (digest(parsed.payload) !== parsed.sha256) {
      throw new Error('campaign registry persistence checksum mismatch');
    }
    return ExperimentCampaignRegistry.restoreSnapshot(parsed.payload);
  }

  /**
   * Execute one serialized mutation. On callback failure no snapshot is written.
   * A second process gets an immediate lock error instead of overwriting a newer
   * snapshot with stale in-memory state; callers may retry at the application layer.
   */
  async transact<T>(
    operation: (registry: ExperimentCampaignRegistry) => T | Promise<T>,
  ): Promise<T> {
    if (typeof operation !== 'function') throw new Error('campaign registry transaction must be a function');
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true });
    let lock: Awaited<ReturnType<typeof open>> | undefined;
    try {
      try {
        lock = await open(this.lockPath, 'wx', 0o600);
      } catch (error) {
        if (isRecord(error) && error.code === 'EEXIST') {
          throw new Error('campaign registry is locked by another transaction or a stale lock');
        }
        throw error;
      }
      await lock.writeFile(JSON.stringify({
        pid: process.pid,
        acquiredAt: Date.now(),
        token: randomUUID(),
      }) + '\n', 'utf8');
      await lock.sync();

      const registry = await this.loadOrCreateUnlocked();
      const result = await operation(registry);
      await this.writeUnlocked(registry);
      return result;
    } finally {
      if (lock) await lock.close().catch(() => undefined);
      // Only release the lock we successfully created in this transaction.
      if (lock) await rm(this.lockPath, { force: true }).catch(() => undefined);
    }
  }

  private async loadOrCreateUnlocked(): Promise<ExperimentCampaignRegistry> {
    try {
      return await this.load();
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT') return new ExperimentCampaignRegistry();
      throw error;
    }
  }

  private async writeUnlocked(registry: ExperimentCampaignRegistry): Promise<void> {
    const payload = registry.snapshot();
    const envelope: StoredCampaignEnvelope = {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      payload,
      sha256: digest(payload),
    };
    const serialized = JSON.stringify(envelope, null, 2) + '\n';
    if (new TextEncoder().encode(serialized).byteLength > this.maxBytes) {
      throw new Error('campaign registry exceeds configured size limit');
    }

    const directory = path.dirname(this.filePath);
    const temporary = path.join(directory, `.${path.basename(this.filePath)}.${randomUUID()}.tmp`);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporary, 'wx', 0o600);
      await handle.writeFile(serialized, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporary, this.filePath);
      try {
        const directoryHandle = await open(directory, 'r');
        try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
      } catch {
        // Some supported filesystems cannot fsync directories; the file itself was synced.
      }
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
