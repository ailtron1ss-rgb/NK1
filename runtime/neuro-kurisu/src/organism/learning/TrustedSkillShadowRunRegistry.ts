import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { hostname } from 'node:os';
import type { SkillShadowObservation, VersionedSkillCandidate } from './VersionedSkillCandidateStore.ts';
import type { TrustedShadowExecutionContext } from './VerifiedSkillShadowEvidence.ts';

export interface TrustedSkillShadowRunContext extends TrustedShadowExecutionContext {
  registeredAt: number;
}
interface RegistrySnapshot {
  schemaVersion: 1;
  revision: number;
  runs: TrustedSkillShadowRunContext[];
}
const empty = (): RegistrySnapshot => ({ schemaVersion: 1, revision: 0, runs: [] });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const fingerprint = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function validateContext(value: unknown): value is TrustedSkillShadowRunContext {
  return isRecord(value) && nonEmpty(value.runId) && nonEmpty(value.taskId) &&
    Number.isSafeInteger(value.seed) && (value.seed as number) >= 0 &&
    fingerprint(value.manifestFingerprint) && nonEmpty(value.runtimeVersion) &&
    typeof value.registeredAt === 'number' && Number.isFinite(value.registeredAt) && value.registeredAt > 0;
}
function validateSnapshot(value: unknown): value is RegistrySnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) ||
      (value.revision as number) < 0 || !Array.isArray(value.runs) || !value.runs.every(validateContext)) return false;
  const seen = new Set<string>();
  for (const run of value.runs) {
    const key = JSON.stringify([run.runId, run.taskId]);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}
function contextKey(runId: string, taskId: string): string { return JSON.stringify([runId, taskId]); }
function sameContext(a: TrustedSkillShadowRunContext, b: TrustedSkillShadowRunContext): boolean {
  return a.runId === b.runId && a.taskId === b.taskId && a.seed === b.seed &&
    a.manifestFingerprint === b.manifestFingerprint && a.runtimeVersion === b.runtimeVersion;
}

/**
 * Durable trusted-run registry. Registration must happen from the supervisor that
 * launches/records the execution, before a signed shadow receipt is accepted.
 * Receipt fields are lookup keys only; returned values always come from this store.
 * Corrupt state and lock contention fail closed rather than resetting trust state.
 */
export class AtomicFileTrustedSkillShadowRunRegistry {
  private readonly filePath: string;
  private readonly lockPath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    if (!nonEmpty(filePath)) throw new Error('trusted run registry path is required');
    this.lockPath = `${filePath}.lock`;
  }

  private readSnapshot(): RegistrySnapshot {
    let raw: string;
    try { raw = readFileSync(this.filePath, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty();
      throw error;
    }
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error('trusted run registry JSON is corrupt'); }
    if (!validateSnapshot(parsed)) throw new Error('trusted run registry schema is invalid');
    return parsed;
  }

  private lockOwnerIsProvablyDead(raw: string): boolean {
    let owner: unknown;
    try { owner = JSON.parse(raw); } catch { return false; }
    if (!isRecord(owner) || owner.hostname !== hostname() ||
        !Number.isSafeInteger(owner.pid) || (owner.pid as number) < 1) return false;
    try {
      process.kill(owner.pid as number, 0);
      return false;
    } catch (error) {
      // EPERM means the process exists but is not signalable. Only ESRCH proves
      // that a same-host owner no longer exists; unknown/legacy lock formats fail closed.
      return (error as NodeJS.ErrnoException).code === 'ESRCH';
    }
  }

  private withExclusiveLock<T>(action: () => T): T {
    mkdirSync(dirname(this.filePath), { recursive: true });
    let lockFd: number;
    try { lockFd = openSync(this.lockPath, 'wx', 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // Reclaim a dead owner without a check-then-unlink race. Two contenders
      // may both inspect the stale lock, but only one can atomically rename that
      // path. Re-read the quarantined inode before deleting it so a lock replaced
      // between inspection and rename is never mistaken for the stale owner.
      let staleRaw: string;
      try { staleRaw = readFileSync(this.lockPath, 'utf8'); }
      catch { throw new Error('trusted run registry is locked; fail closed'); }
      if (!this.lockOwnerIsProvablyDead(staleRaw)) {
        throw new Error('trusted run registry is locked; fail closed');
      }
      const quarantinePath = `${this.lockPath}.stale-${process.pid}-${randomUUID()}`;
      try { renameSync(this.lockPath, quarantinePath); }
      catch { throw new Error('trusted run registry is locked; fail closed'); }
      let quarantinedRaw: string;
      try { quarantinedRaw = readFileSync(quarantinePath, 'utf8'); }
      catch {
        try { unlinkSync(quarantinePath); } catch { /* best effort */ }
        throw new Error('trusted run registry is locked; fail closed');
      }
      if (quarantinedRaw !== staleRaw || !this.lockOwnerIsProvablyDead(quarantinedRaw)) {
        // If the path changed after our first read, put that exact lock back
        // without overwriting a newer owner's lock. If another owner already
        // acquired the canonical path, preserve the quarantined record rather
        // than deleting evidence of an in-flight owner.
        try {
          linkSync(quarantinePath, this.lockPath);
          unlinkSync(quarantinePath);
        } catch { /* fail closed; never overwrite or unlink the canonical lock */ }
        throw new Error('trusted run registry is locked; fail closed');
      }
      try { unlinkSync(quarantinePath); }
      catch { throw new Error('trusted run registry is locked; fail closed'); }
      // Another contender may win after quarantine cleanup; exclusive creation
      // ensures at most one caller enters the critical section.
      try { lockFd = openSync(this.lockPath, 'wx', 0o600); }
      catch { throw new Error('trusted run registry is locked; fail closed'); }
    }
    const ownerToken = randomUUID();
    try {
      writeFileSync(lockFd, JSON.stringify({
        pid: process.pid, hostname: hostname(), acquiredAt: Date.now(), ownerToken,
      }));
      fsyncSync(lockFd);
      return action();
    } finally {
      closeSync(lockFd);
      // A concurrent recovery attempt must never cause this owner to unlink a
      // different process's replacement lock.
      try {
        const current = JSON.parse(readFileSync(this.lockPath, 'utf8')) as Record<string, unknown>;
        if (current.ownerToken === ownerToken) unlinkSync(this.lockPath);
      } catch { /* preserve the primary result and any replacement lock */ }
    }
  }

  register(input: TrustedShadowExecutionContext): TrustedSkillShadowRunContext {
    const context: TrustedSkillShadowRunContext = { ...input, registeredAt: Date.now() };
    if (!validateContext(context)) throw new Error('invalid trusted shadow run context');
    return this.withExclusiveLock(() => {
      const current = this.readSnapshot();
      const key = contextKey(context.runId, context.taskId);
      const prior = current.runs.find(item => contextKey(item.runId, item.taskId) === key);
      if (prior) {
        if (sameContext(prior, context)) return { ...prior };
        throw new Error('trusted run identity already registered with conflicting context');
      }
      const next: RegistrySnapshot = { schemaVersion: 1, revision: current.revision + 1, runs: [...current.runs, context] };
      const tempPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
      let fd: number | undefined;
      try {
        fd = openSync(tempPath, 'wx', 0o600);
        writeFileSync(fd, JSON.stringify(next));
        fsyncSync(fd);
        closeSync(fd); fd = undefined;
        renameSync(tempPath, this.filePath);
        const dirFd = openSync(dirname(this.filePath), 'r');
        try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
      } catch (error) {
        if (fd !== undefined) closeSync(fd);
        try { unlinkSync(tempPath); } catch { /* best effort cleanup */ }
        throw error;
      }
      return { ...context };
    });
  }

  resolve(
    observation: Readonly<SkillShadowObservation>,
    _candidate: Readonly<VersionedSkillCandidate>,
  ): TrustedShadowExecutionContext | null {
    const payload = observation?.artifact?.payload;
    if (!payload || !nonEmpty(observation.runId) || !nonEmpty(payload.taskId)) return null;
    const snapshot = this.readSnapshot();
    const context = snapshot.runs.find(item => item.runId === observation.runId && item.taskId === payload.taskId);
    return context ? {
      runId: context.runId, taskId: context.taskId, seed: context.seed,
      manifestFingerprint: context.manifestFingerprint, runtimeVersion: context.runtimeVersion,
    } : null;
  }

  snapshot(): Readonly<RegistrySnapshot> {
    const state = this.readSnapshot();
    return structuredClone(state);
  }
}

/** In-memory implementation for isolated tests; production should use durable storage. */
export class InMemoryTrustedSkillShadowRunRegistry {
  private readonly runs = new Map<string, TrustedSkillShadowRunContext>();
  register(input: TrustedShadowExecutionContext): TrustedSkillShadowRunContext {
    const context: TrustedSkillShadowRunContext = { ...input, registeredAt: Date.now() };
    if (!validateContext(context)) throw new Error('invalid trusted shadow run context');
    const key = contextKey(context.runId, context.taskId);
    const prior = this.runs.get(key);
    if (prior && !sameContext(prior, context)) throw new Error('trusted run identity already registered with conflicting context');
    if (prior) return { ...prior };
    this.runs.set(key, context);
    return { ...context };
  }
  resolve(observation: Readonly<SkillShadowObservation>, _candidate: Readonly<VersionedSkillCandidate>): TrustedShadowExecutionContext | null {
    const payload = observation?.artifact?.payload;
    if (!payload) return null;
    const context = this.runs.get(contextKey(observation.runId, payload.taskId));
    if (!context) return null;
    return {
      runId: context.runId, taskId: context.taskId, seed: context.seed,
      manifestFingerprint: context.manifestFingerprint, runtimeVersion: context.runtimeVersion,
    };
  }
}
