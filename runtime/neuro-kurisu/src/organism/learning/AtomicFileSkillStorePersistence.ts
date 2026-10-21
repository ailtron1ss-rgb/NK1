import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import type { SkillStorePersistence, VersionedSkillStoreSnapshot } from './VersionedSkillCandidateStore.ts';

const emptySnapshot = (): VersionedSkillStoreSnapshot => ({ schemaVersion: 1, revision: 0, active: [], candidates: [] });

/**
 * Durable JSON-file adapter. Writes are temp-file + fsync + atomic rename under
 * an exclusive lock. A lock collision returns CAS=false so callers can reload
 * and retry instead of overwriting a concurrent writer.
 */
export class AtomicFileSkillStorePersistence implements SkillStorePersistence {
  private readonly lockPath: string;

  constructor(private readonly filePath: string) {
    if (!filePath?.trim()) throw new Error('skill store file path must be non-empty');
    this.lockPath = filePath + '.lock';
  }

  read(): VersionedSkillStoreSnapshot {
    mkdirSync(dirname(this.filePath), { recursive: true });
    try { return this.parse(readFileSync(this.filePath, 'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const lock = this.acquireLock();
    if (lock === null) throw new Error('skill store initialization is locked; retry read');
    try {
      try { return this.parse(readFileSync(this.filePath, 'utf8')); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const initial = emptySnapshot();
      this.atomicWrite(initial);
      return initial;
    } finally {
      this.releaseLock(lock);
    }
  }

  compareAndSwap(expectedRevision: number, next: VersionedSkillStoreSnapshot): boolean {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
        next.schemaVersion !== 1 || next.revision !== expectedRevision + 1) return false;
    mkdirSync(dirname(this.filePath), { recursive: true });
    const lock = this.acquireLock();
    if (lock === null) return false;
    try {
      let current: VersionedSkillStoreSnapshot;
      try { current = this.parse(readFileSync(this.filePath, 'utf8')); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        current = emptySnapshot();
      }
      if (current.revision !== expectedRevision) return false;
      this.atomicWrite(next);
      return true;
    } finally {
      this.releaseLock(lock);
    }
  }

  private acquireLock(): number | null {
    try {
      const fd = openSync(this.lockPath, 'wx', 0o600);
      writeFileSync(fd, String(process.pid));
      fsyncSync(fd);
      return fd;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // Recover only a lock whose recorded process is definitely gone.
      try {
        const pid = Number(readFileSync(this.lockPath, 'utf8'));
        if (!Number.isSafeInteger(pid) || pid < 1) return null;
        try { process.kill(pid, 0); return null; }
        catch (probeError) {
          if ((probeError as NodeJS.ErrnoException).code !== 'ESRCH') return null;
          unlinkSync(this.lockPath);
          const fd = openSync(this.lockPath, 'wx', 0o600);
          writeFileSync(fd, String(process.pid));
          fsyncSync(fd);
          return fd;
        }
      } catch (lockError) {
        if ((lockError as NodeJS.ErrnoException).code === 'ENOENT') return this.acquireLock();
        return null;
      }
    }
  }

  private releaseLock(fd: number): void {
    closeSync(fd);
    try { unlinkSync(this.lockPath); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }

  private atomicWrite(snapshot: VersionedSkillStoreSnapshot): void {
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    const fd = openSync(temporary, 'wx', 0o600);
    try {
      writeFileSync(fd, JSON.stringify(snapshot));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, this.filePath);
    try {
      const directoryFd = openSync(dirname(this.filePath), 'r');
      try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
    } catch {
      // Some platforms do not permit fsync on directory handles. The file itself
      // has already been fsynced and atomically replaced.
    }
  }

  private parse(raw: string): VersionedSkillStoreSnapshot {
    const value = JSON.parse(raw) as VersionedSkillStoreSnapshot;
    if (!value || value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) ||
        value.revision < 0 || !Array.isArray(value.active) || !Array.isArray(value.candidates)) {
      throw new Error('invalid persisted versioned skill store snapshot');
    }
    return value;
  }
}
