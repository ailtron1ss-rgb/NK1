import { createHash } from 'node:crypto';
import { isAuthenticVerifiedSkillPromotionProposal, type VerifiedSkillPromotionProposal } from './VerifiedSkillPromotion.ts';
import type { VersionedSkillCandidate } from './VersionedSkillCandidateStore.ts';

export type SkillReviewStatus = 'pending' | 'rejected' | 'approved-for-signed-promotion';

export interface SkillReviewFamilySummary {
  family: string;
  pairedN: number;
  gain: number;
}

export interface HexisSkillReviewPacket {
  schemaVersion: 1;
  reviewId: string;
  digest: string;
  createdAt: number;
  candidateId: string;
  skillId: string;
  candidateVersion: number;
  artifactFingerprint: string;
  proposalId: string;
  proposalOutcomeFingerprint: string;
  manifestFingerprint: string;
  datasetFingerprint: string;
  outcomeFingerprint: string;
  shadowEvidenceFingerprint: string;
  authenticatedEvidenceRows: number;
  pairedTaskSeedN: number;
  uniquePairedTasks: number;
  completePairedSeeds: number;
  evaluation: {
    pairedN: number;
    baselinePassRate: number;
    candidatePassRate: number;
    absoluteGain: number;
    familyGains: SkillReviewFamilySummary[];
  };
}

export interface SkillReviewDecision {
  outcome: 'approve' | 'reject';
  reviewerId: string;
  rationale: string;
  decidedAt: number;
  digest: string;
}

export interface SkillReviewRecord {
  packet: HexisSkillReviewPacket;
  status: SkillReviewStatus;
  decision?: SkillReviewDecision;
}

export interface SkillReviewInboxSnapshot {
  schemaVersion: 1;
  revision: number;
  records: SkillReviewRecord[];
}

export interface SkillReviewInboxPersistence {
  read(): SkillReviewInboxSnapshot;
  compareAndSwap(expectedRevision: number, next: SkillReviewInboxSnapshot): boolean;
}

const EMPTY = (): SkillReviewInboxSnapshot => ({ schemaVersion: 1, revision: 0, records: [] });
const HASH_RE = /^[a-f0-9]{64}$/;
const isRecord = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
const isText = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const isHash = (x: unknown): x is string => typeof x === 'string' && HASH_RE.test(x);
const isSafeCount = (x: unknown, min = 0): x is number =>
  Number.isSafeInteger(x) && Number(x) >= min;
const isRate = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('review data is not JSON-serializable');
    return encoded;
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + canonical(object[key])).join(',') + '}';
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function packetBody(packet: HexisSkillReviewPacket): Omit<HexisSkillReviewPacket, 'reviewId' | 'digest'> {
  const { reviewId: _reviewId, digest: _digest, ...body } = packet;
  return body;
}

function decisionBody(decision: SkillReviewDecision): Omit<SkillReviewDecision, 'digest'> {
  const { digest: _digest, ...body } = decision;
  return body;
}

/** Fingerprint the same decision-critical shadow fields covered by the signed promotion approval. */
export function fingerprintSkillReviewShadowEvidence(candidate: Readonly<VersionedSkillCandidate>): string {
  const observations = [...candidate.shadowObservations]
    .map(item => ({
      runId: item.runId,
      evidenceFingerprint: item.evidenceFingerprint,
      passed: item.passed,
      observedAt: item.observedAt,
    }))
    .sort((a, b) => a.runId.localeCompare(b.runId));
  return digest(observations);
}

function assertProposalAndCandidate(
  proposal: VerifiedSkillPromotionProposal,
  candidate: Readonly<VersionedSkillCandidate>,
): void {
  if (!isAuthenticVerifiedSkillPromotionProposal(proposal)) {
    throw new Error('review inbox requires an authentic proposal from the verified evidence ledger');
  }
  if (proposal.schemaVersion !== 1 || proposal.gate?.accepted !== true ||
      proposal.canActivateAutomatically !== false ||
      !Number.isSafeInteger(proposal.authenticatedEvidenceRows) || proposal.authenticatedEvidenceRows < 1 ||
      proposal.unauthenticatedEvidenceRows !== 0 ||
      !isHash(proposal.proposalId) || !isHash(proposal.manifestFingerprint) ||
      !isHash(proposal.datasetFingerprint) || !isHash(proposal.outcomeFingerprint)) {
    throw new Error('review inbox requires an accepted evidence-backed proposal with no unauthenticated outcomes');
  }
  if (!candidate || candidate.status !== 'shadow' || !isHash(candidate.candidateId) ||
      !isText(candidate.skillId) || !isSafeCount(candidate.version, 1) ||
      !isHash(candidate.payloadFingerprint) || candidate.proposalId !== proposal.proposalId ||
      candidate.proposalOutcomeFingerprint !== proposal.outcomeFingerprint ||
      !Array.isArray(candidate.shadowObservations) || candidate.shadowObservations.length === 0) {
    throw new Error('review inbox requires the matching shadow candidate and bound evidence');
  }
  const gate = proposal.gate;
  if (!isSafeCount(gate.pairedN, 1) || !isRate(gate.baselinePassRate) ||
      !isRate(gate.candidatePassRate) || !Number.isFinite(gate.absoluteGain) ||
      !Array.isArray(gate.familyGains)) {
    throw new Error('review inbox requires finite, complete aggregate evaluation metrics');
  }
}

/**
 * Port of Hexis's reviewable skill-improvement proposal concept.
 *
 * This packet contains only stable identifiers, digests and aggregate metrics;
 * it deliberately omits raw holdout prompts/outcomes. The returned packet is a
 * review request, not activation authority. The existing Ed25519 approval and
 * signed shadow-evidence gates remain mandatory after review.
 */
export function createHexisSkillReviewPacket(
  proposal: VerifiedSkillPromotionProposal,
  candidate: Readonly<VersionedSkillCandidate>,
  createdAt = Date.now(),
): HexisSkillReviewPacket {
  assertProposalAndCandidate(proposal, candidate);
  if (!Number.isSafeInteger(createdAt) || createdAt <= 0) throw new Error('review packet timestamp must be a positive safe integer');
  const body = {
    schemaVersion: 1 as const,
    createdAt,
    candidateId: candidate.candidateId,
    skillId: candidate.skillId,
    candidateVersion: candidate.version,
    artifactFingerprint: candidate.payloadFingerprint,
    proposalId: proposal.proposalId,
    proposalOutcomeFingerprint: proposal.outcomeFingerprint,
    manifestFingerprint: proposal.manifestFingerprint,
    datasetFingerprint: proposal.datasetFingerprint,
    outcomeFingerprint: proposal.outcomeFingerprint,
    shadowEvidenceFingerprint: fingerprintSkillReviewShadowEvidence(candidate),
    authenticatedEvidenceRows: proposal.authenticatedEvidenceRows,
    pairedTaskSeedN: proposal.pairedTaskSeedN,
    uniquePairedTasks: proposal.uniquePairedTasks,
    completePairedSeeds: proposal.completePairedSeeds,
    evaluation: {
      pairedN: proposal.gate.pairedN,
      baselinePassRate: proposal.gate.baselinePassRate,
      candidatePassRate: proposal.gate.candidatePassRate,
      absoluteGain: proposal.gate.absoluteGain,
      familyGains: proposal.gate.familyGains.map(row => ({
        family: row.family,
        pairedN: row.pairedN,
        gain: row.gain,
      })),
    },
  };
  const packetDigest = digest(body);
  return { ...body, reviewId: packetDigest, digest: packetDigest };
}

function validPacket(value: unknown): value is HexisSkillReviewPacket {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isHash(value.reviewId) ||
      !isHash(value.digest) || value.reviewId !== value.digest ||
      !isSafeCount(value.createdAt, 1) || !isHash(value.candidateId) ||
      !isText(value.skillId) || !isSafeCount(value.candidateVersion, 1) ||
      !isHash(value.artifactFingerprint) || !isHash(value.proposalId) ||
      !isHash(value.proposalOutcomeFingerprint) || !isHash(value.manifestFingerprint) ||
      !isHash(value.datasetFingerprint) || !isHash(value.outcomeFingerprint) ||
      !isHash(value.shadowEvidenceFingerprint) || !isSafeCount(value.authenticatedEvidenceRows, 1) ||
      !isSafeCount(value.pairedTaskSeedN, 1) || !isSafeCount(value.uniquePairedTasks, 1) ||
      !isSafeCount(value.completePairedSeeds, 1) || !isRecord(value.evaluation)) return false;
  const ev = value.evaluation;
  if (!isSafeCount(ev.pairedN, 1) || !isRate(ev.baselinePassRate) ||
      !isRate(ev.candidatePassRate) || typeof ev.absoluteGain !== 'number' ||
      !Number.isFinite(ev.absoluteGain) || !Array.isArray(ev.familyGains) ||
      !ev.familyGains.every(row => isRecord(row) && isText(row.family) &&
        isSafeCount(row.pairedN, 1) && typeof row.gain === 'number' && Number.isFinite(row.gain))) return false;
  try { return value.digest === digest(packetBody(value as unknown as HexisSkillReviewPacket)); }
  catch { return false; }
}

function validDecision(value: unknown, packet: HexisSkillReviewPacket): value is SkillReviewDecision {
  if (!isRecord(value) || (value.outcome !== 'approve' && value.outcome !== 'reject') ||
      !isText(value.reviewerId) || value.reviewerId.length > 128 ||
      /[\u0000-\u001f\u007f]/.test(value.reviewerId) ||
      !isText(value.rationale) || value.rationale.trim().length < 3 ||
      value.rationale.length > 2000 || !isSafeCount(value.decidedAt, packet.createdAt) ||
      !isHash(value.digest)) return false;
  try { return value.digest === digest(decisionBody(value as unknown as SkillReviewDecision)); }
  catch { return false; }
}

function assertSnapshot(value: unknown): asserts value is SkillReviewInboxSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isSafeCount(value.revision) ||
      !Array.isArray(value.records) || value.records.length > 5000) {
    throw new Error('invalid skill review inbox snapshot');
  }
  const ids = new Set<string>();
  for (const record of value.records) {
    if (!isRecord(record) || !validPacket(record.packet) ||
        !['pending', 'rejected', 'approved-for-signed-promotion'].includes(String(record.status))) {
      throw new Error('invalid skill review inbox record');
    }
    const packet = record.packet;
    if (ids.has(packet.reviewId)) throw new Error('duplicate skill review ID');
    ids.add(packet.reviewId);
    if (record.status === 'pending') {
      if (record.decision !== undefined) throw new Error('pending skill review must not carry a decision');
    } else {
      if (!validDecision(record.decision, packet) ||
          (record.status === 'approved-for-signed-promotion' && record.decision.outcome !== 'approve') ||
          (record.status === 'rejected' && record.decision.outcome !== 'reject')) {
        throw new Error('skill review decision/status mismatch');
      }
    }
  }
}

/** Stable persistence helpers shared with the plain-JavaScript filesystem adapter. */
export function createEmptySkillReviewInboxSnapshot(): SkillReviewInboxSnapshot { return EMPTY(); }
export function assertValidSkillReviewInboxSnapshot(value: unknown): asserts value is SkillReviewInboxSnapshot {
  assertSnapshot(value);
}

export class InMemorySkillReviewInboxPersistence implements SkillReviewInboxPersistence {
  private state = EMPTY();
  read(): SkillReviewInboxSnapshot { return clone(this.state); }
  compareAndSwap(expectedRevision: number, next: SkillReviewInboxSnapshot): boolean {
    if (this.state.revision !== expectedRevision || next.revision !== expectedRevision + 1) return false;
    assertSnapshot(next);
    this.state = clone(next);
    return true;
  }
}

/**
 * Atomic local persistence. A short exclusive lock makes competing writers fail
 * closed rather than silently overwriting each other. If the process crashes while
 * holding the lock, remove the stale .lock file only after verifying no writer runs.
 */
export interface SkillReviewDecisionInput {
  outcome: 'approve' | 'reject';
  reviewerId: string;
  rationale: string;
  decidedAt?: number;
}

export class HexisSkillReviewInbox {
  private readonly persistence: SkillReviewInboxPersistence;
  private readonly maxCasRetries: number;

  constructor(
    persistence: SkillReviewInboxPersistence = new InMemorySkillReviewInboxPersistence(),
    maxCasRetries = 32,
  ) {
    this.persistence = persistence;
    this.maxCasRetries = maxCasRetries;
    if (!Number.isSafeInteger(maxCasRetries) || maxCasRetries < 1 || maxCasRetries > 256) {
      throw new Error('skill review CAS retry limit is out of bounds');
    }
    assertSnapshot(persistence.read());
  }

  snapshot(): SkillReviewInboxSnapshot {
    const snapshot = this.persistence.read();
    assertSnapshot(snapshot);
    return clone(snapshot);
  }

  submit(proposal: VerifiedSkillPromotionProposal, candidate: Readonly<VersionedSkillCandidate>, createdAt = Date.now()): SkillReviewRecord {
    const packet = createHexisSkillReviewPacket(proposal, candidate, createdAt);
    return this.transact(snapshot => {
      const existing = snapshot.records.find(record => record.packet.reviewId === packet.reviewId);
      if (existing) return { value: clone(existing), changed: false };
      const record: SkillReviewRecord = { packet, status: 'pending' };
      snapshot.records.push(record);
      if (snapshot.records.length > 5000) snapshot.records.shift();
      return { value: clone(record), changed: true };
    });
  }

  decide(reviewId: string, input: SkillReviewDecisionInput): SkillReviewRecord {
    if (!isHash(reviewId)) throw new Error('review ID must be a SHA-256 digest');
    if (input.outcome !== 'approve' && input.outcome !== 'reject') throw new Error('unsupported review decision');
    const reviewerId = typeof input.reviewerId === 'string' ? input.reviewerId.trim() : '';
    const rationale = typeof input.rationale === 'string' ? input.rationale.trim() : '';
    const decidedAt = input.decidedAt ?? Date.now();
    if (!reviewerId || reviewerId.length > 128 || /[\u0000-\u001f\u007f]/.test(reviewerId) ||
        rationale.length < 3 || rationale.length > 2000 || !Number.isSafeInteger(decidedAt) || decidedAt <= 0) {
      throw new Error('review decision requires a bounded reviewer ID, rationale and positive timestamp');
    }
    return this.transact(snapshot => {
      const index = snapshot.records.findIndex(record => record.packet.reviewId === reviewId);
      if (index < 0) throw new Error('skill review packet was not found');
      const current = snapshot.records[index]!;
      if (current.status !== 'pending') throw new Error('skill review already has a final decision');
      if (decidedAt < current.packet.createdAt) throw new Error('review decision predates its proposal');
      const body = { outcome: input.outcome, reviewerId, rationale, decidedAt };
      const decision: SkillReviewDecision = { ...body, digest: digest(body) };
      const next: SkillReviewRecord = {
        packet: current.packet,
        status: input.outcome === 'approve' ? 'approved-for-signed-promotion' : 'rejected',
        decision,
      };
      snapshot.records[index] = next;
      return { value: clone(next), changed: true };
    });
  }

  getForCandidate(candidateId: string): SkillReviewRecord | null {
    if (!isHash(candidateId)) throw new Error('candidate ID must be a SHA-256 digest');
    const rows = this.snapshot().records.filter(record => record.packet.candidateId === candidateId)
      .sort((a, b) => b.packet.createdAt - a.packet.createdAt);
    return rows[0] ? clone(rows[0]) : null;
  }

  private transact<T>(change: (snapshot: SkillReviewInboxSnapshot) => { value: T; changed: boolean }): T {
    for (let attempt = 0; attempt < this.maxCasRetries; attempt++) {
      const current = this.persistence.read();
      assertSnapshot(current);
      const next = clone(current);
      const result = change(next);
      if (!result.changed) return result.value;
      next.revision = current.revision + 1;
      if (this.persistence.compareAndSwap(current.revision, next)) return result.value;
    }
    throw new Error('skill review inbox CAS retries exhausted');
  }
}

/**
 * Check whether an approved review still describes this exact shadow candidate.
 * This is a preflight for creating a signed approval request, never activation
 * authority; the trusted Ed25519 verifier remains the final promotion boundary.
 */
export function assertSkillReviewReadyForSignedPromotion(
  review: SkillReviewRecord,
  candidate: Readonly<VersionedSkillCandidate>,
): void {
  if (!review || review.status !== 'approved-for-signed-promotion' || !review.decision ||
      review.decision.outcome !== 'approve' || !validPacket(review.packet)) {
    throw new Error('a completed positive human review is required before requesting signed promotion');
  }
  if (candidate.status !== 'shadow' || candidate.candidateId !== review.packet.candidateId ||
      candidate.skillId !== review.packet.skillId || candidate.version !== review.packet.candidateVersion ||
      candidate.payloadFingerprint !== review.packet.artifactFingerprint ||
      candidate.proposalId !== review.packet.proposalId ||
      candidate.proposalOutcomeFingerprint !== review.packet.proposalOutcomeFingerprint ||
      fingerprintSkillReviewShadowEvidence(candidate) !== review.packet.shadowEvidenceFingerprint) {
    throw new Error('human review is stale or bound to another skill artifact/evidence set');
  }
  if (!validDecision(review.decision, review.packet)) {
    throw new Error('human review decision integrity check failed');
  }
}
