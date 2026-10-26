import { createHash } from 'node:crypto';
import {
  closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import {
  assertValidSkillReviewInboxSnapshot, createEmptySkillReviewInboxSnapshot,
} from './HexisSkillReviewInbox.ts';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Atomic local persistence for the Hexis-inspired proposal-review inbox.
 *
 * The exclusive lock means concurrent writers fail closed rather than silently
 * overwrite each other. If a process crashes while holding the lock, remove the
 * stale .lock file only after verifying that no writer is still running.
 */
export class AtomicFileSkillReviewInboxPersistence {
  constructor(filePath) {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('skill review inbox path is required');
    }
    this.filePath = filePath;
  }

  readDisk() {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8'));
      assertValidSkillReviewInboxSnapshot(parsed);
      return clone(parsed);
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT') return createEmptySkillReviewInboxSnapshot();
      throw error;
    }
  }

  read() {
    return this.readDisk();
  }

  compareAndSwap(expectedRevision, next) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
        next.revision !== expectedRevision + 1) {
      throw new Error('invalid review inbox revision transition');
    }
    assertValidSkillReviewInboxSnapshot(next);
    mkdirSync(dirname(this.filePath), { recursive: true });
    const lockPath = this.filePath + '.lock';
    let lockFd;
    let tempPath;
    try {
      try {
        lockFd = openSync(lockPath, 'wx', 0o600);
      } catch (error) {
        if (isRecord(error) && error.code === 'EEXIST') return false;
        throw error;
      }
      const current = this.readDisk();
      if (current.revision !== expectedRevision) return false;
      tempPath = this.filePath + '.' + process.pid + '.' +
        createHash('sha256').update(String(Date.now()) + ':' + String(Math.random()))
          .digest('hex').slice(0, 12) + '.tmp';
      const fd = openSync(tempPath, 'wx', 0o600);
      try {
        writeFileSync(fd, JSON.stringify(next), 'utf8');
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      renameSync(tempPath, this.filePath);
      tempPath = undefined;
      return true;
    } finally {
      if (tempPath) {
        try { unlinkSync(tempPath); } catch { /* best-effort temporary file cleanup */ }
      }
      // Never remove a lock owned by another process. We unlink only if we
      // successfully acquired it, after the atomic rename has completed.
      if (lockFd !== undefined) {
        try { unlinkSync(lockPath); } catch { /* preserve the original persistence error */ }
        closeSync(lockFd);
      }
    }
  }
}
