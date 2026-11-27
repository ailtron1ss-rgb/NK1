import { createHash, randomUUID } from 'node:crypto';
import { types } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { lstat, link, mkdir, open, readFile, readdir, unlink } from 'node:fs/promises';

export interface HostObservationNonceKey {
  issuerId: string;
  deviceId: string;
  sessionId: string;
  nonce: string;
  receiptDigest: string;
  retainUntil: number;
}

export interface FileHostObservationNonceStoreOptions {
  directoryPath: string;
  now?: () => number;
  maxClockLogBytes?: number;
}

interface NonceRecord extends HostObservationNonceKey {
  version: 1;
  tupleDigest: string;
}

interface ClockDayMarker {
  version: 1;
  day: string;
  createdAt: number;
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/;
const NONCE = /^[A-Za-z0-9_-]{16,128}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_MAX_CLOCK_LOG_BYTES = 4 * 1024 * 1024;
const MAX_CLOCK_LOG_ENTRIES = 200_000;

const fail = (code: string): Error => new Error(code);
const safeTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000;

function utcDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function validKey(value: unknown): value is HostObservationNonceKey {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) || types.isProxy(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const expected = ['deviceId', 'issuerId', 'nonce', 'receiptDigest', 'retainUntil', 'sessionId'];
    if (Object.keys(descriptors).sort().join('|') !== expected.join('|') || Object.getOwnPropertySymbols(value).length) return false;
    const read = (name: keyof HostObservationNonceKey): unknown => {
      const descriptor = descriptors[name];
      return descriptor && 'value' in descriptor ? descriptor.value : undefined;
    };
    const issuerId = read('issuerId');
    const deviceId = read('deviceId');
    const sessionId = read('sessionId');
    const nonce = read('nonce');
    const receiptDigest = read('receiptDigest');
    const retainUntil = read('retainUntil');
    return typeof issuerId === 'string' && IDENTIFIER.test(issuerId)
      && typeof deviceId === 'string' && IDENTIFIER.test(deviceId)
      && typeof sessionId === 'string' && IDENTIFIER.test(sessionId)
      && typeof nonce === 'string' && NONCE.test(nonce)
      && typeof receiptDigest === 'string' && DIGEST.test(receiptDigest)
      && safeTime(retainUntil);
  } catch {
    return false;
  }
}

function tupleDigest(key: HostObservationNonceKey): string {
  return createHash('sha256')
    .update(Buffer.from(JSON.stringify([key.issuerId, key.deviceId, key.sessionId, key.nonce]), 'utf8'))
    .digest('hex');
}

async function ensurePrivateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail('nonce-store-directory-invalid');
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

/** Publish a completed file atomically without overwriting an existing nonce tuple. */
async function createImmutableFile(path: string, content: string): Promise<boolean> {
  const temporary = path + '.' + process.pid + '.' + randomUUID() + '.tmp';
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await link(temporary, path);
    await syncDirectory(dirname(path));
    return true;
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException)?.code === 'EEXIST') return false;
    throw cause;
  } finally {
    await unlink(temporary).catch((cause) => {
      if ((cause as NodeJS.ErrnoException)?.code !== 'ENOENT') throw cause;
    });
  }
}

async function readRegularFile(path: string, missingIsEmpty = false): Promise<string> {
  let stat;
  try {
    stat = await lstat(path);
  } catch (cause) {
    if (missingIsEmpty && (cause as NodeJS.ErrnoException)?.code === 'ENOENT') return '';
    throw cause;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw fail('nonce-store-file-invalid');
  return readFile(path, 'utf8');
}

function parseClockMarker(raw: string, expectedDay: string): ClockDayMarker {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw fail('nonce-store-clock-marker-invalid'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail('nonce-store-clock-marker-invalid');
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || record.day !== expectedDay || !safeTime(record.createdAt)
    || utcDay(record.createdAt) !== expectedDay) throw fail('nonce-store-clock-marker-invalid');
  return { version: 1, day: expectedDay, createdAt: record.createdAt };
}

function parseClockLog(raw: string, day: string): number {
  if (!raw) return 0;
  if (!raw.endsWith('\n')) throw fail('nonce-store-clock-log-truncated');
  const rows = raw.split('\n');
  rows.pop();
  if (rows.length > MAX_CLOCK_LOG_ENTRIES) throw fail('nonce-store-clock-log-limit');
  let latest = 0;
  for (const row of rows) {
    if (!/^\d{1,16}$/.test(row)) throw fail('nonce-store-clock-log-invalid');
    const value = Number(row);
    if (!safeTime(value) || utcDay(value) !== day) throw fail('nonce-store-clock-log-invalid');
    latest = Math.max(latest, value);
  }
  return latest;
}

function parseNonceRecord(raw: string, expectedTuple: string): NonceRecord {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw fail('nonce-store-record-invalid'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail('nonce-store-record-invalid');
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || record.tupleDigest !== expectedTuple
    || typeof record.issuerId !== 'string' || !IDENTIFIER.test(record.issuerId)
    || typeof record.deviceId !== 'string' || !IDENTIFIER.test(record.deviceId)
    || typeof record.sessionId !== 'string' || !IDENTIFIER.test(record.sessionId)
    || typeof record.nonce !== 'string' || !NONCE.test(record.nonce)
    || typeof record.receiptDigest !== 'string' || !DIGEST.test(record.receiptDigest)
    || !safeTime(record.retainUntil)) throw fail('nonce-store-record-invalid');
  return {
    version: 1,
    tupleDigest: expectedTuple,
    issuerId: record.issuerId,
    deviceId: record.deviceId,
    sessionId: record.sessionId,
    nonce: record.nonce,
    receiptDigest: record.receiptDigest,
    retainUntil: record.retainUntil,
  };
}

/**
 * Durable fail-closed replay protection for SignedObservationAdmissionAuthority.
 * Immutable nonce tuple files plus a monotonic UTC-day clock log prevent process
 * restart or wall-clock rollback from reviving consumed nonces.
 */
export class FileHostObservationNonceStore {
  private readonly root: string;
  private readonly clock: () => number;
  private readonly maxClockLogBytes: number;

  constructor(options: FileHostObservationNonceStoreOptions) {
    if (!options || typeof options.directoryPath !== 'string' || !options.directoryPath.trim()) {
      throw fail('nonce-store-directory-required');
    }
    this.root = resolve(options.directoryPath);
    this.clock = options.now ?? Date.now;
    this.maxClockLogBytes = options.maxClockLogBytes ?? DEFAULT_MAX_CLOCK_LOG_BYTES;
    if (!Number.isSafeInteger(this.maxClockLogBytes) || this.maxClockLogBytes < 1024
      || this.maxClockLogBytes > 64 * 1024 * 1024) throw fail('nonce-store-clock-log-limit-invalid');
  }

  private async ensureLayout(): Promise<void> {
    await ensurePrivateDirectory(this.root);
    await ensurePrivateDirectory(join(this.root, 'clock-days'));
    await ensurePrivateDirectory(join(this.root, 'clock-timestamps'));
    await ensurePrivateDirectory(join(this.root, 'nonces'));
  }

  /** Persist a nondecreasing clock high-water mark before evaluating receipt expiry. */
  private async effectiveNow(): Promise<number> {
    let systemNow: number;
    try { systemNow = this.clock(); } catch { throw fail('nonce-store-clock-invalid'); }
    if (!safeTime(systemNow)) throw fail('nonce-store-clock-invalid');
    const systemDay = utcDay(systemNow);
    const markersDir = join(this.root, 'clock-days');
    const names = await readdir(markersDir);
    const days = names.filter((name) => DAY.test(name)).sort();
    for (const name of names) {
      if (!DAY.test(name) && !name.endsWith('.tmp')) throw fail('nonce-store-clock-marker-invalid');
    }

    let latestDay = days.at(-1) ?? '';
    if (!latestDay || systemDay > latestDay) {
      const marker: ClockDayMarker = { version: 1, day: systemDay, createdAt: systemNow };
      const markerPath = join(markersDir, systemDay);
      const created = await createImmutableFile(markerPath, JSON.stringify(marker));
      if (!created) parseClockMarker(await readRegularFile(markerPath), systemDay);
      latestDay = systemDay;
    }

    const markerPath = join(markersDir, latestDay);
    const marker = parseClockMarker(await readRegularFile(markerPath), latestDay);
    const logPath = join(this.root, 'clock-timestamps', latestDay + '.log');
    const logRaw = await readRegularFile(logPath, true);
    if (Buffer.byteLength(logRaw, 'utf8') > this.maxClockLogBytes) throw fail('nonce-store-clock-log-limit');
    const logHighWater = parseClockLog(logRaw, latestDay);
    const dayFloor = new Date(latestDay + 'T00:00:00.000Z').getTime();
    const candidate = Math.max(marker.createdAt, logHighWater, systemDay === latestDay ? systemNow : dayFloor);
    const rounded = Math.ceil(candidate / 1000) * 1000;
    const persist = utcDay(rounded) === latestDay ? rounded : candidate;
    if (persist > logHighWater) {
      if (Buffer.byteLength(logRaw, 'utf8') + String(persist).length + 1 > this.maxClockLogBytes) {
        throw fail('nonce-store-clock-log-limit');
      }
      const handle = await open(logPath, 'a', 0o600);
      try {
        const line = Buffer.from(String(persist) + '\n', 'utf8');
        const written = await handle.write(line, 0, line.length, null);
        if (written.bytesWritten !== line.length) throw fail('nonce-store-clock-log-short-write');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await syncDirectory(dirname(logPath));
    }
    return Math.max(candidate, persist, logHighWater);
  }

  private recordPath(key: HostObservationNonceKey): string {
    const digest = tupleDigest(key);
    return join(this.root, 'nonces', digest.slice(0, 2), digest + '.json');
  }

  private async readRecord(key: HostObservationNonceKey): Promise<NonceRecord | null> {
    const path = this.recordPath(key);
    try {
      return parseNonceRecord(await readRegularFile(path), tupleDigest(key));
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
      throw cause;
    }
  }

  async consume(key: HostObservationNonceKey): Promise<boolean> {
    if (!validKey(key)) throw fail('nonce-store-key-invalid');
    await this.ensureLayout();
    const now = await this.effectiveNow();
    if (key.retainUntil <= now) return false;
    const digest = tupleDigest(key);
    const path = this.recordPath(key);
    await ensurePrivateDirectory(dirname(path));
    const record: NonceRecord = { version: 1, tupleDigest: digest, ...key };
    if (await createImmutableFile(path, JSON.stringify(record))) return true;
    const existing = await this.readRecord(key);
    if (!existing) throw fail('nonce-store-record-missing-after-conflict');
    return false;
  }

  async hasConsumed(key: HostObservationNonceKey): Promise<boolean> {
    if (!validKey(key)) throw fail('nonce-store-key-invalid');
    await this.ensureLayout();
    const now = await this.effectiveNow();
    if (key.retainUntil <= now) return false;
    const record = await this.readRecord(key);
    return Boolean(record && record.receiptDigest === key.receiptDigest && record.retainUntil === key.retainUntil);
  }
}