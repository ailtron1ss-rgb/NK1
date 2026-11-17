import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type {
  TeacherStudentDistillationGateReservationStore,
  TeacherStudentDistillationGateState,
} from './TeacherStudentDistillationGate.ts';

interface GateStateEnvelope {
  format: 'nk1-teacher-student-distillation-gate';
  formatVersion: 1;
  payload: TeacherStudentDistillationGateState;
  sha256: string;
}

const MAX_CONSUMED_CANDIDATES = 10_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const emptyState = (): TeacherStudentDistillationGateState => ({
  schemaVersion: 1,
  consumedCandidateFingerprints: [],
  saturated: false,
});
const saturatedState = (): TeacherStudentDistillationGateState => ({
  schemaVersion: 1,
  consumedCandidateFingerprints: [],
  saturated: true,
});
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isDigest = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/iu.test(value);

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('teacher-distillation-gate-state-not-json');
    return encoded;
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(object[key])).join(',') + '}';
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function validateState(value: unknown): value is TeacherStudentDistillationGateState {
  if (!isRecord(value) || value.schemaVersion !== 1 ||
      !Array.isArray(value.consumedCandidateFingerprints) ||
      value.consumedCandidateFingerprints.length > MAX_CONSUMED_CANDIDATES ||
      typeof value.saturated !== 'boolean') return false;
  const fingerprints = value.consumedCandidateFingerprints;
  return fingerprints.every(isDigest) &&
    new Set(fingerprints).size === fingerprints.length &&
    [...fingerprints].sort().every((fingerprint, index) => fingerprint === fingerprints[index]);
}

function errnoCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

async function openNoFollow(filename: string) {
  if (process.platform === 'linux') return open(filename, 0x20000);
  if (process.platform === 'darwin') return open(filename, 0x100);
  return open(filename, 'r');
}

/**
 * Atomic, checksummed, process-exclusive reservation store for one-shot holdout use.
 * The checksum detects accidental corruption; file permissions and the host-owned
 * path remain the security boundary against deliberate modification. A stale lock
 * fails closed and requires operator review; it is never automatically stolen.
 */
export class TeacherStudentDistillationGateFileStore
implements TeacherStudentDistillationGateReservationStore {
  private readonly filePath: string;
  private readonly lockPath: string;
  private readonly maxBytes: number;

  constructor(filePath: string, maxBytes = DEFAULT_MAX_BYTES) {
    if (typeof filePath !== 'string' || !filePath.trim() || filePath.includes('\u0000') ||
        !Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 16 * 1024 * 1024) {
      throw new Error('teacher-distillation-gate-store-config-invalid');
    }
    this.filePath = path.resolve(filePath);
    this.lockPath = this.filePath + '.lock';
    this.maxBytes = maxBytes;
  }

  /** Corruption, unexpected file type, or read failure returns a saturated fail-closed state. */
  async load(): Promise<TeacherStudentDistillationGateState> {
    try {
      return await this.readState();
    } catch {
      return saturatedState();
    }
  }

  /**
   * Atomically reserve one candidate fingerprint before holdout analysis.
   * Returns false when the fingerprint was already consumed, state is saturated,
   * or persisted state is corrupt. Concurrent writers fail closed on the lock.
   */
  async reserveCandidate(candidateFingerprint: string): Promise<boolean> {
    if (!isDigest(candidateFingerprint)) {
      throw new Error('teacher-distillation-gate-candidate-fingerprint-invalid');
    }
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    let lockHandle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      try {
        lockHandle = await open(this.lockPath, 'wx', 0o600);
      } catch (error) {
        if (errnoCode(error) === 'EEXIST') {
          throw new Error('teacher-distillation-gate-store-lock-held');
        }
        throw error;
      }
      await lockHandle.writeFile(String(process.pid), 'utf8');
      await lockHandle.sync();

      let current: TeacherStudentDistillationGateState;
      try {
        current = await this.readState();
      } catch {
        return false;
      }
      if (current.saturated ||
          current.consumedCandidateFingerprints.includes(candidateFingerprint)) {
        return false;
      }
      if (current.consumedCandidateFingerprints.length >= MAX_CONSUMED_CANDIDATES) {
        await this.writeState({
          schemaVersion: 1,
          consumedCandidateFingerprints: current.consumedCandidateFingerprints,
          saturated: true,
        });
        return false;
      }
      const next: TeacherStudentDistillationGateState = {
        schemaVersion: 1,
        consumedCandidateFingerprints: [
          ...current.consumedCandidateFingerprints,
          candidateFingerprint,
        ].sort(),
        saturated: false,
      };
      await this.writeState(next);
      return true;
    } finally {
      if (lockHandle) {
        await lockHandle.close().catch(() => undefined);
        await rm(this.lockPath, { force: true }).catch(() => undefined);
      }
    }
  }

  private async readState(): Promise<TeacherStudentDistillationGateState> {
    let before;
    try {
      before = await lstat(this.filePath);
    } catch (error) {
      if (errnoCode(error) === 'ENOENT') return emptyState();
      throw error;
    }
    if (before.isSymbolicLink() || !before.isFile() || before.size > this.maxBytes) {
      throw new Error('teacher-distillation-gate-store-file-invalid');
    }
    const resolved = await realpath(this.filePath);
    if (resolved !== this.filePath) {
      throw new Error('teacher-distillation-gate-store-path-invalid');
    }
    const handle = await openNoFollow(this.filePath);
    let serialized: string;
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino ||
          opened.size !== before.size || opened.size > this.maxBytes) {
        throw new Error('teacher-distillation-gate-store-file-changed');
      }
      serialized = await handle.readFile({ encoding: 'utf8' });
      const after = await handle.stat();
      if (!after.isFile() || after.dev !== opened.dev || after.ino !== opened.ino ||
          after.size !== opened.size || after.mtimeMs !== opened.mtimeMs ||
          after.ctimeMs !== opened.ctimeMs ||
          Buffer.byteLength(serialized, 'utf8') !== after.size) {
        throw new Error('teacher-distillation-gate-store-file-changed');
      }
    } finally {
      await handle.close();
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw new Error('teacher-distillation-gate-store-json-invalid');
    }
    if (!isRecord(parsed) || parsed.format !== 'nk1-teacher-student-distillation-gate' ||
        parsed.formatVersion !== 1 || !validateState(parsed.payload) || !isDigest(parsed.sha256) ||
        digest(parsed.payload) !== parsed.sha256) {
      throw new Error('teacher-distillation-gate-store-integrity-invalid');
    }
    return {
      schemaVersion: 1,
      consumedCandidateFingerprints: [...parsed.payload.consumedCandidateFingerprints],
      saturated: parsed.payload.saturated,
    };
  }

  private async writeState(state: TeacherStudentDistillationGateState): Promise<void> {
    if (!validateState(state)) throw new Error('teacher-distillation-gate-state-invalid');
    const envelope: GateStateEnvelope = {
      format: 'nk1-teacher-student-distillation-gate',
      formatVersion: 1,
      payload: state,
      sha256: digest(state),
    };
    const serialized = JSON.stringify(envelope, null, 2) + '\n';
    if (Buffer.byteLength(serialized, 'utf8') > this.maxBytes) {
      throw new Error('teacher-distillation-gate-store-size-limit');
    }
    const directory = path.dirname(this.filePath);
    const temporary = path.join(
      directory,
      '.' + path.basename(this.filePath) + '.' + randomUUID() + '.tmp',
    );
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
        // Some filesystems do not support directory fsync; the state file was synced.
      }
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
