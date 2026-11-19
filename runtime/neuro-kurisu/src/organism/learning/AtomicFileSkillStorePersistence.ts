import { createHash } from 'node:crypto';
import {
  closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import type {
  ActiveSkillVersion, SkillPromotionApproval, SkillRollbackApproval, SkillShadowObservation, SkillStorePersistence,
  VersionedSkillCandidate, VersionedSkillStoreSnapshot,
} from './VersionedSkillCandidateStore.ts';

const emptySnapshot = (): VersionedSkillStoreSnapshot => ({ schemaVersion: 1, revision: 0, active: [], candidates: [] });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isVersion = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isFingerprint = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function payloadFingerprint(value: unknown): string | null {
  try {
    const json = JSON.stringify(value);
    if (json === undefined) return null;
    return createHash('sha256').update(canonical(JSON.parse(json))).digest('hex');
  } catch { return null; }
}

function isActiveSkill(value: unknown): value is ActiveSkillVersion {
  if (!isRecord(value) || !isText(value.skillId) || !isVersion(value.version) ||
      !isFingerprint(value.payloadFingerprint) || !isFingerprint(value.proposalId) || !isTime(value.activatedAt) ||
      !Object.prototype.hasOwnProperty.call(value, 'payload')) return false;
  return payloadFingerprint(value.payload) === value.payloadFingerprint;
}

function isApproval(value: unknown): value is SkillPromotionApproval {
  if (!isRecord(value) || !isText(value.approvedBy) || !isTime(value.approvedAt) ||
      !(value.expectedActiveVersion === null || isVersion(value.expectedActiveVersion))) return false;
  if (value.artifact === undefined) return true; // test-only approval adapters may omit a signed artifact.
  const artifact = value.artifact;
  if (!isRecord(artifact) || typeof artifact.signature !== 'string' || !artifact.signature.trim() ||
      !isRecord(artifact.payload)) return false;
  const payload = artifact.payload;
  return payload.schemaVersion === 1 &&
    isText(payload.approvalId) && isText(payload.approverId) && isTime(payload.approvedAt) &&
    isFingerprint(payload.candidateId) && isText(payload.skillId) && isVersion(payload.candidateVersion) &&
    isFingerprint(payload.payloadFingerprint) && isFingerprint(payload.proposalId) &&
    isFingerprint(payload.proposalOutcomeFingerprint) &&
    (payload.expectedActiveVersion === null || isVersion(payload.expectedActiveVersion)) &&
    Number.isSafeInteger(payload.minShadowRuns) && Number(payload.minShadowRuns) >= 1 &&
    Number(payload.minShadowRuns) <= 1000 && isFingerprint(payload.shadowEvidenceFingerprint) &&
    payload.approverId === value.approvedBy && payload.approvedAt === value.approvedAt &&
    payload.expectedActiveVersion === value.expectedActiveVersion;
}

function isShadowObservation(value: unknown): value is SkillShadowObservation {
  return isRecord(value) && isText(value.runId) && isFingerprint(value.evidenceFingerprint) &&
    typeof value.passed === 'boolean' && isTime(value.observedAt);
}

function isRollbackApproval(value: unknown): value is SkillRollbackApproval {
  if (!isRecord(value) || !isText(value.approvedBy) || !isTime(value.approvedAt) ||
      !isVersion(value.expectedActiveVersion)) return false;
  if (value.artifact === undefined) return true; // Only explicit test verifier adapters may authorize unsigned fixtures.
  const artifact = value.artifact;
  if (!isRecord(artifact) || !isText(artifact.signature) || !isRecord(artifact.payload)) return false;
  const payload = artifact.payload;
  const restoredVersionValid = payload.restoredVersion === null || isVersion(payload.restoredVersion);
  const restoredFingerprintValid = payload.restoredPayloadFingerprint === null || isFingerprint(payload.restoredPayloadFingerprint);
  const restoredProposalValid = payload.restoredProposalId === null || isFingerprint(payload.restoredProposalId);
  return payload.schemaVersion === 1 &&
    isText(payload.approvalId) && isText(payload.approverId) && isTime(payload.approvedAt) &&
    isFingerprint(payload.candidateId) && isText(payload.skillId) && isVersion(payload.candidateVersion) &&
    isFingerprint(payload.payloadFingerprint) && isFingerprint(payload.proposalId) &&
    isVersion(payload.expectedActiveVersion) && restoredVersionValid && restoredFingerprintValid && restoredProposalValid &&
    ((payload.restoredVersion === null) === (payload.restoredPayloadFingerprint === null)) &&
    ((payload.restoredVersion === null) === (payload.restoredProposalId === null)) &&
    isFingerprint(payload.previousActiveFingerprint) && isFingerprint(payload.shadowEvidenceFingerprint) &&
    payload.approverId === value.approvedBy && payload.approvedAt === value.approvedAt &&
    payload.expectedActiveVersion === value.expectedActiveVersion;
}

function isCandidate(value: unknown): value is VersionedSkillCandidate {
  if (!isRecord(value) || !isFingerprint(value.candidateId) || !isText(value.skillId) ||
      !isVersion(value.version) || !isFingerprint(value.payloadFingerprint) ||
      !isFingerprint(value.proposalId) || !isFingerprint(value.proposalOutcomeFingerprint) ||
      !(value.baseVersion === null || isVersion(value.baseVersion)) ||
      !(value.previousActive === null || isActiveSkill(value.previousActive)) ||
      !['staged', 'shadow', 'active', 'superseded', 'rolled-back'].includes(String(value.status)) ||
      !Array.isArray(value.shadowObservations) || !value.shadowObservations.every(isShadowObservation) ||
      !isTime(value.createdAt) || !Object.prototype.hasOwnProperty.call(value, 'payload')) return false;
  if (payloadFingerprint(value.payload) !== value.payloadFingerprint) return false;
  const identityParts = [value.skillId, value.version, value.proposalId, value.payloadFingerprint];
  // The store's canonical candidate identity includes a fifth revision-provenance
  // slot (null for ordinary candidates). Keep the legacy four-field identity
  // readable for older persisted snapshots, while validating new rows against the
  // exact identity shape written by VersionedSkillCandidateStore.
  const revisionFingerprint = value.revisionProvenance === undefined
    ? null
    : payloadFingerprint(value.revisionProvenance);
  if (value.revisionProvenance !== undefined && (
      !isRecord(value.revisionProvenance) ||
      value.revisionProvenance.schemaVersion !== 1 ||
      !isFingerprint(value.revisionProvenance.evaluationFingerprint) ||
      !(value.revisionProvenance.sourceCandidateId === null || isFingerprint(value.revisionProvenance.sourceCandidateId)) ||
      !isFingerprint(value.revisionProvenance.planFingerprint) ||
      !isFingerprint(value.revisionProvenance.datasetFingerprint) ||
      (value.revisionProvenance.sourceEvidenceFingerprint !== undefined && !isFingerprint(value.revisionProvenance.sourceEvidenceFingerprint)) ||
      !Array.isArray(value.revisionProvenance.dimensions) || value.revisionProvenance.dimensions.length === 0 ||
      !value.revisionProvenance.dimensions.every((dimension: unknown) =>
        ['safety','task-success','trajectory','capability-coverage','executability','holdout-generalization'].includes(String(dimension))) ||
      new Set(value.revisionProvenance.dimensions).size !== value.revisionProvenance.dimensions.length ||
      !isTime(value.revisionProvenance.createdAt) || !revisionFingerprint
  )) return false;
  const expectedId = createHash('sha256').update(JSON.stringify([...identityParts, revisionFingerprint])).digest('hex');
  const legacyId = createHash('sha256').update(JSON.stringify(identityParts)).digest('hex');
  if (value.candidateId !== expectedId &&
      !(value.revisionProvenance === undefined && value.candidateId === legacyId)) return false;
  if (value.approval !== undefined && !isApproval(value.approval)) return false;
  if (value.rollbackApproval !== undefined && !isRollbackApproval(value.rollbackApproval)) return false;
  if (value.promotedAt !== undefined && !isTime(value.promotedAt)) return false;
  if (value.rolledBackAt !== undefined && !isTime(value.rolledBackAt)) return false;
  if (value.status === 'active' && (!value.approval || !isTime(value.promotedAt) || value.rollbackApproval !== undefined)) return false;
  if (value.status === 'rolled-back' && (!value.rollbackApproval || !isTime(value.rolledBackAt))) return false;
  if (value.status !== 'rolled-back' && value.rollbackApproval !== undefined) return false;
  return true;
}

function isSnapshot(value: unknown): value is VersionedSkillStoreSnapshot {
  return isRecord(value) && value.schemaVersion === 1 && Number.isSafeInteger(value.revision) &&
    typeof value.revision === 'number' && value.revision >= 0 &&
    Array.isArray(value.active) && value.active.every(isActiveSkill) &&
    Array.isArray(value.candidates) && value.candidates.every(isCandidate);
}

/**
 * Durable JSON-file adapter. Writes are temp-file + fsync + atomic rename under
 * an exclusive lock. Persisted entries and their payload fingerprints are
 * validated, not just the outer arrays, before they enter runtime state.
 */
export class AtomicFileSkillStorePersistence implements SkillStorePersistence {
  private readonly filePath: string;
  private readonly lockPath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
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
        !isSnapshot(next) || next.revision !== expectedRevision + 1) return false;
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
    const value: unknown = JSON.parse(raw);
    if (!isSnapshot(value)) throw new Error('invalid persisted versioned skill store snapshot');
    return value;
  }
}
