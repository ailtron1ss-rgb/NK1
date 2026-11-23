import { createHash } from 'node:crypto';
import { isAuthenticVerifiedSkillPromotionProposal, type VerifiedSkillPromotionProposal } from './VerifiedSkillPromotion.ts';

export type SkillCandidateStatus = 'staged' | 'shadow' | 'active' | 'superseded' | 'rolled-back';

export interface SkillPromotionApprovalPayload {
  schemaVersion: 1;
  approvalId: string;
  approverId: string;
  approvedAt: number;
  candidateId: string;
  skillId: string;
  candidateVersion: number;
  payloadFingerprint: string;
  proposalId: string;
  proposalOutcomeFingerprint: string;
  expectedActiveVersion: number | null;
  minShadowRuns: number;
  shadowEvidenceFingerprint: string;
}

export interface SignedSkillPromotionApprovalArtifact {
  payload: SkillPromotionApprovalPayload;
  signature: string;
}

export interface SkillPromotionApproval {
  approvedBy: string;
  approvedAt: number;
  expectedActiveVersion: number | null;
  /** Required by the production configured verifier; optional only for test/legacy deny adapters. */
  artifact?: SignedSkillPromotionApprovalArtifact;
}

export interface SkillRollbackApprovalPayload {
  schemaVersion: 1;
  approvalId: string;
  approverId: string;
  approvedAt: number;
  candidateId: string;
  skillId: string;
  candidateVersion: number;
  payloadFingerprint: string;
  proposalId: string;
  expectedActiveVersion: number;
  restoredVersion: number | null;
  restoredPayloadFingerprint: string | null;
  restoredProposalId: string | null;
  previousActiveFingerprint: string;
  shadowEvidenceFingerprint: string;
}

export interface SignedSkillRollbackApprovalArtifact {
  payload: SkillRollbackApprovalPayload;
  signature: string;
}

export interface SkillRollbackApproval {
  approvedBy: string;
  approvedAt: number;
  expectedActiveVersion: number;
  artifact?: SignedSkillRollbackApprovalArtifact;
}

export type SkillRollbackApprovalVerificationPurpose = 'rollback' | 'persisted-rollback';
export type SkillRollbackApprovalVerifier = (
  approval: SkillRollbackApproval,
  candidate: Readonly<VersionedSkillCandidate>,
  restoreTarget: Readonly<ActiveSkillVersion> | null,
  purpose?: SkillRollbackApprovalVerificationPurpose,
) => boolean;


/**
 * The application must supply an authority that validates the approval against
 * an authenticated human/session or a separately trusted approval service.
 * An audit-shaped { approvedBy } object alone is not authorization.
 */
export type SkillPromotionApprovalVerificationPurpose = 'promotion' | 'persisted-active';
export type SkillPromotionApprovalVerifier = (
  approval: SkillPromotionApproval,
  candidate: Readonly<VersionedSkillCandidate>,
  minShadowRuns: number,
  purpose?: SkillPromotionApprovalVerificationPurpose,
) => boolean;

export interface SkillShadowObservation {
  runId: string;
  evidenceFingerprint: string;
  passed: boolean;
  observedAt: number;
  /** Signed execution receipt; required by the default-deny verifier in production. */
  artifact?: import('./VerifiedSkillShadowEvidence.ts').SignedSkillShadowArtifact;
}

export type SkillShadowEvidenceVerifier = (
  observation: Readonly<SkillShadowObservation>,
  candidate: Readonly<VersionedSkillCandidate>,
) => boolean;

export interface ActiveSkillVersion {
  skillId: string;
  version: number;
  payload: unknown;
  payloadFingerprint: string;
  proposalId: string;
  activatedAt: number;
}

export interface SkillRevisionProvenance {
  schemaVersion: 1;
  /** Digest of the independent post-generation evaluation report; lineage only, not approval. */
  evaluationFingerprint?: string;
  sourceCandidateId: string | null;
  planFingerprint: string;
  /** Verified dataset snapshot used when the proposal authorized this revision attempt. */
  datasetFingerprint: string;
  /** Digest of the exact eligible repair evidence that triggered background revision; lineage only, never approval. */
  sourceEvidenceFingerprint?: string;
  dimensions: string[];
  createdAt: number;
}

export interface VersionedSkillCandidate {
  candidateId: string;
  skillId: string;
  version: number;
  payload: unknown;
  payloadFingerprint: string;
  proposalId: string;
  proposalOutcomeFingerprint: string;
  /** Non-authoritative lineage for evidence-directed revisions; never grants activation rights. */
  revisionProvenance?: SkillRevisionProvenance;
  baseVersion: number | null;
  previousActive: ActiveSkillVersion | null;
  status: SkillCandidateStatus;
  shadowObservations: SkillShadowObservation[];
  createdAt: number;
  approval?: SkillPromotionApproval;
  rollbackApproval?: SkillRollbackApproval;
  promotedAt?: number;
  rolledBackAt?: number;
}

export interface VersionedSkillStoreSnapshot {
  schemaVersion: 1;
  revision: number;
  active: ActiveSkillVersion[];
  candidates: VersionedSkillCandidate[];
}

export interface SkillStorePersistence {
  read(): VersionedSkillStoreSnapshot;
  compareAndSwap(expectedRevision: number, next: VersionedSkillStoreSnapshot): boolean;
}

/** Process-local adapter for tests and ephemeral deployments; inject a durable CAS adapter for restart safety. */
export class InMemorySkillStorePersistence implements SkillStorePersistence {
  private state: VersionedSkillStoreSnapshot = { schemaVersion: 1, revision: 0, active: [], candidates: [] };

  read(): VersionedSkillStoreSnapshot { return clone(this.state); }

  compareAndSwap(expectedRevision: number, next: VersionedSkillStoreSnapshot): boolean {
    if (this.state.revision !== expectedRevision || next.revision !== expectedRevision + 1) return false;
    this.state = clone(next);
    return true;
  }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function fingerprint(value: unknown): string {
  let json: string | undefined;
  try { json = JSON.stringify(value); } catch { throw new Error('skill payload must be JSON-serializable'); }
  if (json === undefined) throw new Error('skill payload must be JSON-serializable');
  const canonicalJson = canonical(JSON.parse(json));
  return createHash('sha256').update(canonicalJson).digest('hex');
}

/** Canonical SHA-256 used by the versioned skill store for exact payload identity. */
export function fingerprintSkillPayload(value: unknown): string {
  return fingerprint(value);
}

function activeFor(snapshot: VersionedSkillStoreSnapshot, skillId: string): ActiveSkillVersion | null {
  return snapshot.active.find(item => item.skillId === skillId) ?? null;
}

/**
 * Versioned candidate lifecycle with optimistic atomic persistence:
 * stage -> shadow evidence -> explicit approval -> promotion -> rollback.
 * This store is deliberately separate from the live runtime skill resolver.
 */
export class VersionedSkillCandidateStore {
  private readonly persistence: SkillStorePersistence;
  private readonly verifyApproval: SkillPromotionApprovalVerifier;
  private readonly verifyShadowEvidence: SkillShadowEvidenceVerifier;
  private readonly verifyRollbackApproval: SkillRollbackApprovalVerifier;

  constructor(
    persistence: SkillStorePersistence = new InMemorySkillStorePersistence(),
    verifyApproval: SkillPromotionApprovalVerifier = () => false,
    verifyShadowEvidence: SkillShadowEvidenceVerifier = () => false,
    verifyRollbackApproval: SkillRollbackApprovalVerifier = () => false,
  ) {
    this.persistence = persistence;
    this.verifyApproval = verifyApproval;
    this.verifyShadowEvidence = verifyShadowEvidence;
    this.verifyRollbackApproval = verifyRollbackApproval;
    const initial = persistence.read();
    if (initial.schemaVersion !== 1 || !Number.isSafeInteger(initial.revision) ||
        initial.revision < 0 || !Array.isArray(initial.active) || !Array.isArray(initial.candidates)) {
      throw new Error('invalid versioned skill store snapshot');
    }
    this.assertTrustedActiveState(initial);
  }

  snapshot(): VersionedSkillStoreSnapshot { return clone(this.readTrustedSnapshot()); }

  private readTrustedSnapshot(): VersionedSkillStoreSnapshot {
    const current = this.persistence.read();
    this.assertTrustedActiveState(current);
    return current;
  }

  /**
   * A structurally valid JSON snapshot is not promotion authority. On startup and
   * every read, each active skill must map to an active candidate carrying a signed
   * approval and independently verifiable shadow observations.
   */
  private assertTrustedActiveState(current: VersionedSkillStoreSnapshot): void {
    const activeCandidates = current.candidates.filter(candidate => candidate.status === 'active');
    if (activeCandidates.length !== current.active.length) {
      throw new Error('persisted active skill set does not match candidate lifecycle');
    }
    const activeSkillIds = new Set<string>();
    for (const active of current.active) {
      if (activeSkillIds.has(active.skillId)) throw new Error('persisted active skill set contains duplicate skill IDs');
      activeSkillIds.add(active.skillId);
      const candidate = activeCandidates.find(item =>
        item.skillId === active.skillId && item.version === active.version);
      if (!candidate || candidate.payloadFingerprint !== active.payloadFingerprint ||
          candidate.proposalId !== active.proposalId || canonical(candidate.payload) !== canonical(active.payload)) {
        throw new Error('persisted active skill is not bound to its candidate payload/version');
      }
      const approval = candidate.approval;
      if (!approval) throw new Error('persisted active candidate is missing signed promotion approval');
      // Bind the version CAS fields to the signed approval before interpreting
      // previousActive. Otherwise a tampered baseVersion can fail an incidental
      // "prior version missing" check first and obscure the exact authority mismatch.
      if (candidate.baseVersion !== approval.expectedActiveVersion ||
          (candidate.previousActive?.version ?? null) !== candidate.baseVersion ||
          candidate.promotedAt !== approval.approvedAt ||
          active.activatedAt !== approval.approvedAt) {
        throw new Error('persisted active candidate promotion CAS/activation metadata is not bound to the signed approval');
      }
      if (candidate.baseVersion !== null) {
        const prior = current.candidates.find(item => item.skillId === candidate.skillId &&
          item.version === candidate.baseVersion && ['active', 'superseded'].includes(item.status));
        const expectedPrior = prior ? {
          skillId: prior.skillId, version: prior.version, payload: prior.payload,
          payloadFingerprint: prior.payloadFingerprint, proposalId: prior.proposalId,
          activatedAt: prior.promotedAt,
        } : null;
        if (!prior || !candidate.previousActive || prior.promotedAt === undefined ||
            canonical(candidate.previousActive) !== canonical(expectedPrior)) {
          throw new Error('persisted active candidate rollback target is not bound to a prior approved version');
        }
      } else if (candidate.previousActive !== null) {
        throw new Error('persisted initial candidate has an unexpected rollback target');
      }
      const minShadowRuns = approval.artifact?.payload?.minShadowRuns ?? 3;
      if (!Number.isSafeInteger(minShadowRuns) || minShadowRuns < 1 || minShadowRuns > 1000 ||
          candidate.shadowObservations.length < minShadowRuns ||
          candidate.shadowObservations.some(item => item.passed !== true)) {
        throw new Error('persisted active candidate does not satisfy its signed shadow gate');
      }
      let approvalAuthorized = false;
      try { approvalAuthorized = this.verifyApproval(clone(approval), clone(candidate), minShadowRuns, 'persisted-active'); }
      catch { approvalAuthorized = false; }
      if (approvalAuthorized !== true) {
        throw new Error('persisted active skill approval failed signature/context verification');
      }
      for (const observation of candidate.shadowObservations) {
        let evidenceAuthorized = false;
        try { evidenceAuthorized = this.verifyShadowEvidence(clone(observation), clone(candidate)); }
        catch { evidenceAuthorized = false; }
        if (evidenceAuthorized !== true) {
          throw new Error('persisted active skill shadow evidence failed authentication');
        }
      }
    }
    for (const rolledBack of current.candidates.filter(candidate => candidate.status === 'rolled-back')) {
      const approval = rolledBack.rollbackApproval;
      if (!approval || rolledBack.rolledBackAt !== approval.approvedAt ||
          approval.expectedActiveVersion !== rolledBack.version) {
        throw new Error('persisted rolled-back skill is missing a bound signed rollback approval');
      }
      let rollbackAuthorized = false;
      try {
        rollbackAuthorized = this.verifyRollbackApproval(
          clone(approval), clone(rolledBack), rolledBack.previousActive ? clone(rolledBack.previousActive) : null,
          'persisted-rollback',
        );
      } catch { rollbackAuthorized = false; }
      if (rollbackAuthorized !== true) {
        throw new Error('persisted rollback approval failed signature/context verification');
      }
    }
  }

  stageCandidate(
    proposal: VerifiedSkillPromotionProposal,
    skillId: string,
    payload: unknown,
    revisionProvenance?: SkillRevisionProvenance,
  ): VersionedSkillCandidate {
    if (!skillId?.trim()) throw new Error('skillId must be non-empty');
    if (!isAuthenticVerifiedSkillPromotionProposal(proposal) || proposal.schemaVersion !== 1 || proposal.gate?.accepted !== true ||
        proposal.canActivateAutomatically !== false || proposal.authenticatedEvidenceRows < 1 ||
        proposal.unauthenticatedEvidenceRows !== 0 || !/^[a-f0-9]{64}$/.test(proposal.proposalId) ||
        !/^[a-f0-9]{64}$/.test(proposal.datasetFingerprint) ||
        !/^[a-f0-9]{64}$/.test(proposal.outcomeFingerprint)) {
      throw new Error('only an authentic, accepted proposal backed exclusively by authenticated evidence can be staged');
    }
    if (revisionProvenance && (
      revisionProvenance.schemaVersion !== 1 ||
      !(/^[a-f0-9]{64}$/.test(revisionProvenance.evaluationFingerprint ?? '')) ||
      !(revisionProvenance.sourceCandidateId === null || /^[a-f0-9]{64}$/.test(revisionProvenance.sourceCandidateId)) ||
      !/^[a-f0-9]{64}$/.test(revisionProvenance.planFingerprint) ||
      !/^[a-f0-9]{64}$/.test(revisionProvenance.datasetFingerprint) ||
      (revisionProvenance.sourceEvidenceFingerprint !== undefined &&
        !/^[a-f0-9]{64}$/.test(revisionProvenance.sourceEvidenceFingerprint)) ||
      !Array.isArray(revisionProvenance.dimensions) || revisionProvenance.dimensions.length === 0 ||
      revisionProvenance.dimensions.some(d => !['safety','task-success','trajectory','capability-coverage','executability','holdout-generalization'].includes(d)) ||
      new Set(revisionProvenance.dimensions).size !== revisionProvenance.dimensions.length ||
      !Number.isFinite(revisionProvenance.createdAt) || revisionProvenance.createdAt <= 0
    )) throw new Error('invalid reflective skill revision provenance');
    const payloadFingerprint = fingerprint(payload);
    const current = this.readTrustedSnapshot();
    const existing = current.candidates.find(item => item.proposalId === proposal.proposalId &&
      item.skillId === skillId && item.payloadFingerprint === payloadFingerprint);
    if (existing) return clone(existing);
    const previousActive = activeFor(current, skillId);
    const nextVersion = Math.max(
      previousActive?.version ?? 0,
      ...current.candidates.filter(item => item.skillId === skillId).map(item => item.version),
    ) + 1;
    const candidateId = createHash('sha256').update(JSON.stringify([
      skillId, nextVersion, proposal.proposalId, payloadFingerprint,
      revisionProvenance ? fingerprint(revisionProvenance) : null,
    ])).digest('hex');
    const candidate: VersionedSkillCandidate = {
      candidateId, skillId, version: nextVersion, payload: clone(payload), payloadFingerprint,
      proposalId: proposal.proposalId, proposalOutcomeFingerprint: proposal.outcomeFingerprint,
      ...(revisionProvenance ? { revisionProvenance: clone(revisionProvenance) } : {}),
      baseVersion: previousActive?.version ?? null, previousActive: previousActive ? clone(previousActive) : null,
      status: 'staged', shadowObservations: [], createdAt: Date.now(),
    };
    const next = clone(current);
    next.revision += 1;
    next.candidates.push(candidate);
    this.commit(current, next);
    return clone(candidate);
  }

  recordShadowObservation(candidateId: string, observation: SkillShadowObservation): VersionedSkillCandidate {
    if (!observation || !observation.runId?.trim() ||
        !/^[a-f0-9]{64}$/i.test(observation.evidenceFingerprint) ||
        typeof observation.passed !== 'boolean' || !Number.isFinite(observation.observedAt) ||
        observation.observedAt <= 0) throw new Error('invalid shadow observation');
    const current = this.readTrustedSnapshot();
    const candidate = current.candidates.find(item => item.candidateId === candidateId);
    if (!candidate || !['staged', 'shadow'].includes(candidate.status)) throw new Error('candidate is not eligible for shadow evaluation');
    let evidenceAuthorized = false;
    try { evidenceAuthorized = this.verifyShadowEvidence(clone(observation), clone(candidate)); } catch { evidenceAuthorized = false; }
    if (evidenceAuthorized !== true) throw new Error('shadow observation is not authenticated by the configured evidence verifier');
    if ((activeFor(current, candidate.skillId)?.version ?? null) !== candidate.baseVersion) {
      throw new Error('active skill version changed; candidate must be restaged against the current version');
    }
    if (candidate.shadowObservations.some(item => item.runId === observation.runId)) {
      throw new Error('duplicate shadow run id');
    }
    if (candidate.shadowObservations.length >= 1000) throw new Error('shadow observation limit reached');
    const next = clone(current);
    const target = next.candidates.find(item => item.candidateId === candidateId)!;
    target.shadowObservations.push(clone(observation));
    target.status = 'shadow';
    next.revision += 1;
    this.commit(current, next);
    return clone(target);
  }

  approveAndPromote(
    candidateId: string,
    approval: SkillPromotionApproval,
    minShadowRuns = 3,
  ): ActiveSkillVersion {
    if (!approval?.approvedBy?.trim() || !Number.isFinite(approval.approvedAt) || approval.approvedAt <= 0 ||
        !(approval.expectedActiveVersion === null || Number.isSafeInteger(approval.expectedActiveVersion))) {
      throw new Error('explicit approval identity, timestamp and expected active version are required');
    }
    if (!Number.isSafeInteger(minShadowRuns) || minShadowRuns < 1 || minShadowRuns > 1000) {
      throw new Error('minShadowRuns must be an integer from 1 to 1000');
    }
    const current = this.readTrustedSnapshot();
    const candidate = current.candidates.find(item => item.candidateId === candidateId);
    if (!candidate || candidate.status !== 'shadow') throw new Error('candidate must complete shadow staging before promotion');
    const active = activeFor(current, candidate.skillId);
    const activeVersion = active?.version ?? null;
    if (approval.expectedActiveVersion !== activeVersion || candidate.baseVersion !== activeVersion) {
      throw new Error('active version compare-and-swap failed; candidate must be restaged');
    }
    if (candidate.shadowObservations.length < minShadowRuns ||
        candidate.shadowObservations.some(item => !item.passed)) {
      throw new Error('shadow gate requires enough runs and zero failed outcomes');
    }
    // Revalidate persisted receipts at promotion time; a restored snapshot is not itself trusted.
    for (const observation of candidate.shadowObservations) {
      let evidenceAuthorized = false;
      try { evidenceAuthorized = this.verifyShadowEvidence(clone(observation), clone(candidate)); } catch { evidenceAuthorized = false; }
      if (evidenceAuthorized !== true) throw new Error('persisted shadow evidence failed authentication');
    }
    // Never treat caller-supplied audit fields as proof of human authorization.
    // Default is deny; production must inject a verifier backed by authenticated authority.
    let approvalAuthorized = false;
    try {
      approvalAuthorized = this.verifyApproval(clone(approval), clone(candidate), minShadowRuns, 'promotion');
    } catch {
      approvalAuthorized = false;
    }
    if (approvalAuthorized !== true) {
      throw new Error('promotion approval is not authenticated by the configured authority');
    }
    const promoted: ActiveSkillVersion = {
      skillId: candidate.skillId, version: candidate.version, payload: clone(candidate.payload),
      payloadFingerprint: candidate.payloadFingerprint, proposalId: candidate.proposalId,
      activatedAt: approval.approvedAt,
    };
    const next = clone(current);
    next.revision += 1;
    next.active = next.active.filter(item => item.skillId !== candidate.skillId);
    next.active.push(promoted);
    const target = next.candidates.find(item => item.candidateId === candidateId)!;
    for (const previous of next.candidates) {
      if (previous.skillId === candidate.skillId && previous.candidateId !== candidateId &&
          previous.status === 'active' && previous.version === candidate.baseVersion) previous.status = 'superseded';
    }
    target.status = 'active';
    target.approval = clone(approval);
    target.promotedAt = approval.approvedAt;
    this.commit(current, next);
    return clone(promoted);
  }

  rollback(candidateId: string, approval: SkillRollbackApproval): ActiveSkillVersion | null {
    if (!approval?.approvedBy?.trim() || !Number.isFinite(approval.approvedAt) || approval.approvedAt <= 0 ||
        !Number.isSafeInteger(approval.expectedActiveVersion) || approval.expectedActiveVersion < 1) {
      throw new Error('signed rollback approval identity, timestamp and active-version guard are required');
    }
    const current = this.readTrustedSnapshot();
    const candidate = current.candidates.find(item => item.candidateId === candidateId);
    if (!candidate || candidate.status !== 'active') throw new Error('only the currently promoted candidate can be rolled back');
    const active = activeFor(current, candidate.skillId);
    if (!active || active.version !== approval.expectedActiveVersion || active.version !== candidate.version) {
      throw new Error('rollback compare-and-swap failed; active skill has changed');
    }
    const restored = candidate.previousActive ? clone(candidate.previousActive) : null;
    let rollbackAuthorized = false;
    try {
      rollbackAuthorized = this.verifyRollbackApproval(clone(approval), clone(candidate), restored, 'rollback');
    } catch { rollbackAuthorized = false; }
    if (rollbackAuthorized !== true) {
      throw new Error('rollback approval is not authenticated by the configured authority');
    }

    const next = clone(current);
    next.revision += 1;
    next.active = next.active.filter(item => item.skillId !== candidate.skillId);
    if (restored) next.active.push(restored);
    const target = next.candidates.find(item => item.candidateId === candidateId)!;
    target.status = 'rolled-back';
    target.rolledBackAt = approval.approvedAt;
    target.rollbackApproval = clone(approval);
    if (restored) {
      const priorCandidate = next.candidates.find(item => item.skillId === candidate.skillId &&
        item.version === restored.version && item.payloadFingerprint === restored.payloadFingerprint &&
        item.proposalId === restored.proposalId);
      if (!priorCandidate || priorCandidate.promotedAt !== restored.activatedAt) {
        throw new Error('rollback target is not backed by its original approved candidate');
      }
      if (priorCandidate.status === 'superseded') priorCandidate.status = 'active';
      else if (priorCandidate.status !== 'active') {
        throw new Error('rollback target candidate is not eligible for restoration');
      }
    }
    this.commit(current, next);
    return restored;
  }

  private commit(current: VersionedSkillStoreSnapshot, next: VersionedSkillStoreSnapshot): void {
    if (!this.persistence.compareAndSwap(current.revision, next)) {
      throw new Error('atomic skill-store write conflicted; reload and retry');
    }
  }
}
