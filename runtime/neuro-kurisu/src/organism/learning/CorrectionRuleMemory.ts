import { snapshotPlainData } from './LearningTrustBoundary.ts';

/**
 * Hexis-inspired correction memory for NK1.
 * Only explicitly reviewed correction records enter this store. Repeated raw
 * runtime events are not interpreted as human corrections. Escalation yields a
 * gate proposal only: this module never activates a hard gate or grants approval.
 */
export type CorrectionSeverity = 'low' | 'medium' | 'high' | 'critical';
export type CorrectionRootCause =
  | 'context-pressure'
  | 'ambiguous-rule'
  | 'instruction-conflict'
  | 'edge-case'
  | 'other';
export type CorrectionEnforcementStage = 'soft-rule' | 'reinforced-rule' | 'gate-candidate';
export type CorrectionRecommendation =
  | 'retain-soft-rule'
  | 'reinforce-reminder'
  | 'rewrite-rule'
  | 'resolve-conflict'
  | 'add-exception'
  | 'propose-gate-review';

export interface ReviewedCorrectionObservation {
  schemaVersion: 1;
  ruleId: string;
  observationId: string;
  reviewerId: string;
  reviewEvidenceFingerprint: string;
  reviewedAt: number;
  severity: CorrectionSeverity;
  rootCause: CorrectionRootCause;
  binaryRule: boolean;
  correctionApplied: true;
}

export interface CorrectionRuleAssessment {
  ruleId: string;
  observationCount: number;
  contextPressureCount: number;
  severity: CorrectionSeverity;
  rootCauses: CorrectionRootCause[];
  stage: CorrectionEnforcementStage;
  recommendation: CorrectionRecommendation;
  requiresIndependentApproval: boolean;
  /** Always false here. Assessment is not an authority to block runtime actions. */
  hardGateActive: false;
  firstReviewedAt: number;
  lastReviewedAt: number;
}

export interface CorrectionRuleMemorySnapshot {
  schemaVersion: 1;
  revision: number;
  observations: ReviewedCorrectionObservation[];
  quarantinedObservationIds: string[];
}

export type CorrectionReviewVerifier = (observation: Readonly<ReviewedCorrectionObservation>) => boolean;

const MAX_OBSERVATIONS = 2048;
const MAX_QUARANTINED = 512;
const HASH = /^[a-f0-9]{64}$/;
const REVIEWER_ID = /^[a-zA-Z0-9._:-]{1,128}$/;
const SEVERITY_ORDER: Record<CorrectionSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export const emptyCorrectionRuleMemorySnapshot = (): CorrectionRuleMemorySnapshot => ({
  schemaVersion: 1,
  revision: 0,
  observations: [],
  quarantinedObservationIds: [],
});

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseObservation(value: unknown): ReviewedCorrectionObservation | null {
  try {
    const detached = snapshotPlainData(value);
    if (!isRecord(detached)) return null;
    const x = detached;
    const allowed = new Set([
      'schemaVersion', 'ruleId', 'observationId', 'reviewerId',
      'reviewEvidenceFingerprint', 'reviewedAt', 'severity', 'rootCause',
      'binaryRule', 'correctionApplied',
    ]);
    if (Object.keys(x).some(key => !allowed.has(key)) ||
        x.schemaVersion !== 1 ||
        typeof x.ruleId !== 'string' || !HASH.test(x.ruleId) ||
        typeof x.observationId !== 'string' || !HASH.test(x.observationId) ||
        typeof x.reviewerId !== 'string' || !REVIEWER_ID.test(x.reviewerId) ||
        typeof x.reviewEvidenceFingerprint !== 'string' || !HASH.test(x.reviewEvidenceFingerprint) ||
        !isTimestamp(x.reviewedAt) ||
        !['low', 'medium', 'high', 'critical'].includes(String(x.severity)) ||
        !['context-pressure', 'ambiguous-rule', 'instruction-conflict', 'edge-case', 'other'].includes(String(x.rootCause)) ||
        typeof x.binaryRule !== 'boolean' ||
        x.correctionApplied !== true) return null;

    return {
      schemaVersion: 1,
      ruleId: x.ruleId,
      observationId: x.observationId,
      reviewerId: x.reviewerId,
      reviewEvidenceFingerprint: x.reviewEvidenceFingerprint,
      reviewedAt: x.reviewedAt,
      severity: x.severity as CorrectionSeverity,
      rootCause: x.rootCause as CorrectionRootCause,
      binaryRule: x.binaryRule,
      correctionApplied: true,
    };
  } catch {
    return null;
  }
}

function sameObservation(a: ReviewedCorrectionObservation, b: ReviewedCorrectionObservation): boolean {
  return a.schemaVersion === b.schemaVersion &&
    a.ruleId === b.ruleId &&
    a.observationId === b.observationId &&
    a.reviewerId === b.reviewerId &&
    a.reviewEvidenceFingerprint === b.reviewEvidenceFingerprint &&
    a.reviewedAt === b.reviewedAt &&
    a.severity === b.severity &&
    a.rootCause === b.rootCause &&
    a.binaryRule === b.binaryRule &&
    a.correctionApplied === b.correctionApplied;
}

function rankSeverity(rows: readonly ReviewedCorrectionObservation[]): CorrectionSeverity {
  return rows.reduce<CorrectionSeverity>(
    (best, row) => SEVERITY_ORDER[row.severity] > SEVERITY_ORDER[best] ? row.severity : best,
    'low',
  );
}

function assessmentFor(ruleId: string, rows: readonly ReviewedCorrectionObservation[]): CorrectionRuleAssessment | null {
  if (!rows.length) return null;
  const ordered = [...rows].sort((a, b) => a.reviewedAt - b.reviewedAt || a.observationId.localeCompare(b.observationId));
  const severity = rankSeverity(ordered);
  const contextPressureCount = ordered.filter(row => row.rootCause === 'context-pressure').length;
  const allContextPressure = contextPressureCount === ordered.length;
  const binaryRule = ordered.every(row => row.binaryRule);
  const criticalEvent = severity === 'critical';
  const repeatedHighImpact = allContextPressure && binaryRule && severity === 'high' && contextPressureCount >= 2;
  const repeatedMediumImpact = allContextPressure && binaryRule && severity === 'medium' && contextPressureCount >= 3;
  const gateCandidate = criticalEvent || repeatedHighImpact || repeatedMediumImpact;
  const stage: CorrectionEnforcementStage = gateCandidate
    ? 'gate-candidate'
    : ordered.length >= 2 ? 'reinforced-rule' : 'soft-rule';
  const causes = [...new Set(ordered.map(row => row.rootCause))].sort();
  const latestCause = ordered[ordered.length - 1].rootCause;
  const recommendation: CorrectionRecommendation = gateCandidate
    ? 'propose-gate-review'
    : latestCause === 'ambiguous-rule' ? 'rewrite-rule'
      : latestCause === 'instruction-conflict' ? 'resolve-conflict'
        : latestCause === 'edge-case' ? 'add-exception'
          : ordered.length >= 2 ? 'reinforce-reminder' : 'retain-soft-rule';
  return {
    ruleId,
    observationCount: ordered.length,
    contextPressureCount,
    severity,
    rootCauses: causes,
    stage,
    recommendation,
    requiresIndependentApproval: gateCandidate,
    hardGateActive: false,
    firstReviewedAt: ordered[0].reviewedAt,
    lastReviewedAt: ordered[ordered.length - 1].reviewedAt,
  };
}

export class CorrectionRuleMemory {
  private state = emptyCorrectionRuleMemorySnapshot();
  private verifyReview: CorrectionReviewVerifier;

  /** Default-deny: a host must supply a verifier for authenticated review evidence. */
  constructor(verifyReview: CorrectionReviewVerifier = () => false) {
    this.verifyReview = verifyReview;
  }

  configureReviewVerifier(verifier: CorrectionReviewVerifier): void {
    if (typeof verifier !== 'function') throw new TypeError('correction-review-verifier-required');
    this.verifyReview = verifier;
  }

  snapshot(): CorrectionRuleMemorySnapshot {
    const copy=structuredClone(this.state);
    copy.observations.sort((a,b)=>a.reviewedAt-b.reviewedAt||a.observationId.localeCompare(b.observationId));
    copy.quarantinedObservationIds.sort();
    return copy;
  }

  restore(raw: unknown): void {
    if (raw === undefined || raw === null) {
      this.state = emptyCorrectionRuleMemorySnapshot();
      return;
    }
    let detached: unknown;
    try { detached = snapshotPlainData(raw); } catch {
      this.state = emptyCorrectionRuleMemorySnapshot();
      return;
    }
    if (!isRecord(detached) || detached.schemaVersion !== 1 || !Array.isArray(detached.observations)) {
      this.state = emptyCorrectionRuleMemorySnapshot();
      return;
    }

    const sourceRows = detached.observations.slice(0, MAX_OBSERVATIONS);
    const byId = new Map<string, ReviewedCorrectionObservation>();
    const conflicted = new Set<string>();
    const seenEvidenceKeys = new Set<string>();
    const quarantined = new Set<string>();
    const storedQuarantine = Array.isArray(detached.quarantinedObservationIds)
      ? detached.quarantinedObservationIds.filter((id): id is string => typeof id === 'string' && HASH.test(id)).slice(0, MAX_QUARANTINED)
      : [];
    for (const id of storedQuarantine) quarantined.add(id);

    for (const rawRow of sourceRows) {
      const row = parseObservation(rawRow);
      if (!row || quarantined.has(row.observationId)) continue;
      // Persisted fingerprints are claims, not authentication. Re-check every
      // restored row with the host verifier before it can influence maturity.
      let verified = false;
      try { verified = this.verifyReview(structuredClone(row)); } catch { verified = false; }
      if (!verified) continue;
      const prior = byId.get(row.observationId);
      if (!prior) {
        const evidenceKey = `${row.ruleId}:${row.reviewEvidenceFingerprint}`;
        if (seenEvidenceKeys.has(evidenceKey)) {
          // The same reviewed artifact cannot create a second recurrence vote.
          quarantined.add(row.observationId);
          continue;
        }
        seenEvidenceKeys.add(evidenceKey);
        byId.set(row.observationId, row);
      } else if (!sameObservation(prior, row)) {
        byId.delete(row.observationId);
        conflicted.add(row.observationId);
        quarantined.add(row.observationId);
      }
    }
    for (const id of conflicted) byId.delete(id);

    this.state = {
      schemaVersion: 1,
      revision: isTimestamp(detached.revision) ? detached.revision : byId.size,
      observations: [...byId.values()].sort((a, b) => a.reviewedAt - b.reviewedAt || a.observationId.localeCompare(b.observationId)),
      quarantinedObservationIds: [...quarantined].slice(-MAX_QUARANTINED),
    };
  }

  record(raw: unknown): { duplicate: boolean; rule: CorrectionRuleAssessment } {
    const observation = parseObservation(raw);
    if (!observation) throw new TypeError('invalid-reviewed-correction-observation');
    let accepted = false;
    try { accepted = this.verifyReview(structuredClone(observation)); } catch { accepted = false; }
    if (!accepted) throw new Error('correction-review-evidence-not-authenticated');

    if (this.state.quarantinedObservationIds.includes(observation.observationId)) {
      throw new Error('correction-observation-id-quarantined');
    }
    const prior = this.state.observations.find(row => row.observationId === observation.observationId);
    if (prior) {
      if (sameObservation(prior, observation)) {
        const rule = this.assess(observation.ruleId);
        if (!rule) throw new Error('correction-rule-state-inconsistent');
        return { duplicate: true, rule };
      }
      this.state.observations = this.state.observations.filter(row => row.observationId !== observation.observationId);
      this.state.quarantinedObservationIds = [...this.state.quarantinedObservationIds, observation.observationId].slice(-MAX_QUARANTINED);
      this.state.revision++;
      throw new Error('correction-observation-id-conflict');
    }
    const repeatedEvidence = this.state.observations.find(row => row.ruleId === observation.ruleId && row.reviewEvidenceFingerprint === observation.reviewEvidenceFingerprint);
    if (repeatedEvidence) throw new Error('correction-review-evidence-reused');
    if (this.state.observations.length >= MAX_OBSERVATIONS) throw new RangeError('correction-memory-capacity-reached');

    this.state.observations.push(observation);
    this.state.revision++;
    const rule = this.assess(observation.ruleId);
    if (!rule) throw new Error('correction-rule-state-inconsistent');
    return { duplicate: false, rule };
  }

  assess(ruleId: string): CorrectionRuleAssessment | null {
    if (typeof ruleId !== 'string' || !HASH.test(ruleId)) return null;
    return assessmentFor(ruleId, this.state.observations.filter(row => row.ruleId === ruleId));
  }

  rules(): CorrectionRuleAssessment[] {
    const ids = [...new Set(this.state.observations.map(row => row.ruleId))].sort();
    return ids.flatMap(id => {
      const assessment = this.assess(id);
      return assessment ? [assessment] : [];
    });
  }
}
