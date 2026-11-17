/**
 * OmeStro #11 — Cognitive Parliament.
 *
 * Evidence-led coordination of specialist cognitive roles. This module does not
 * call models: adapters collect role reports under an external compute budget,
 * then this deterministic coordinator checks provenance, independence and
 * constitutional safety before returning a decision.
 */
export type ParliamentRole =
  | 'researcher' | 'planner' | 'skeptic' | 'executor'
  | 'safety-guardian' | 'auditor';
export type ParliamentStance = 'support' | 'oppose' | 'abstain' | 'block';
export type ParliamentRisk = 'low' | 'medium' | 'high';
export interface ParliamentEvidence {
  id: string;
  sourceId: string;
  sourceFamily: string;
  claim: string;
  confidence01: number;
  relevance01: number;
  falsifiability01: number;
  observed: boolean;
}
export interface ParliamentRoleReport {
  role: ParliamentRole;
  stance: ParliamentStance;
  recommendation: string;
  facts: string[];
  assumptions: string[];
  objections: string[];
  uncertainty01: number;
  modelFingerprint: string;
  provider: string;
  evidence: ParliamentEvidence[];
  safetyViolations?: string[];
  provenanceComplete: boolean;
}
export interface ParliamentDecision {
  version: 1;
  status: 'approved' | 'rejected' | 'needs-evidence' | 'blocked';
  candidateId: string;
  score01: number;
  threshold01: number;
  evidenceQuality01: number;
  independentSourceCount: number;
  independentModelCount: number;
  coveredRoles: ParliamentRole[];
  missingRoles: ParliamentRole[];
  sharedModelWarning: boolean;
  reasons: string[];
  dissent: Array<{ role: ParliamentRole; stance: ParliamentStance; objections: string[] }>;
  reports: ParliamentRoleReport[];
}
const ROLES: ParliamentRole[] = [
  'researcher', 'planner', 'skeptic', 'executor', 'safety-guardian', 'auditor'
];
const clamp = (n: number): number => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const uniq = <T>(items: T[]): T[] => [...new Set(items)];
const quality = (e: ParliamentEvidence): number =>
  e.observed ? clamp(e.confidence01) * clamp(e.relevance01) * (0.5 + 0.5 * clamp(e.falsifiability01)) : 0;

export interface ParliamentInput {
  candidateId: string;
  risk: ParliamentRisk;
  reports: ParliamentRoleReport[];
  /** Maximum number of reports accepted in one deliberation. */
  maxReports?: number;
}
export class CognitiveParliament {
  deliberate(input: ParliamentInput): ParliamentDecision {
    const reasons: string[] = [];
    const maxReports = Math.max(1, Math.min(12, Math.floor(input.maxReports ?? 6)));
    const reports = Array.isArray(input.reports) ? input.reports.slice(0, maxReports) : [];
    const seenRoles = new Set<ParliamentRole>();
    const valid: ParliamentRoleReport[] = [];
    for (const report of reports) {
      if (!report || !ROLES.includes(report.role) || seenRoles.has(report.role)) {
        reasons.push('invalid-or-duplicate-role-report');
        continue;
      }
      seenRoles.add(report.role);
      if (!text(report.modelFingerprint) || !text(report.provider) || !Array.isArray(report.evidence)) {
        reasons.push(`incomplete-report-provenance:${report.role}`);
        continue;
      }
      if (!report.provenanceComplete) reasons.push(`unverified-provenance:${report.role}`);
      valid.push({
        ...report,
        facts: Array.isArray(report.facts) ? report.facts.slice(0, 24) : [],
        assumptions: Array.isArray(report.assumptions) ? report.assumptions.slice(0, 24) : [],
        objections: Array.isArray(report.objections) ? report.objections.slice(0, 24) : [],
        evidence: report.evidence.slice(0, 48).filter(e =>
          e && text(e.id) && text(e.sourceId) && text(e.sourceFamily) && text(e.claim) &&
          [e.confidence01, e.relevance01, e.falsifiability01].every(Number.isFinite)
        ),
      });
    }
    const coveredRoles = valid.map(r => r.role);
    const missingRoles = ROLES.filter(role => !coveredRoles.includes(role));
    const safety = valid.find(r => r.role === 'safety-guardian');
    const auditor = valid.find(r => r.role === 'auditor');
    const safetyBlocks = Boolean(safety && (
      safety.stance === 'block' || (safety.safetyViolations?.length ?? 0) > 0
    ));
    const provenanceFailed = !auditor || !auditor.provenanceComplete ||
      valid.some(r => !r.provenanceComplete);
    if (missingRoles.length) reasons.push(`missing-required-roles:${missingRoles.join(',')}`);
    if (safetyBlocks) reasons.push('safety-guardian-veto');
    if (provenanceFailed) reasons.push('audit-provenance-gate-failed');

    const allEvidence = valid.flatMap(r => r.evidence.map(e => ({ ...e, modelFingerprint: r.modelFingerprint })));
    const ids = new Set<string>();
    const uniqueEvidence = allEvidence.filter(e => {
      if (ids.has(e.id)) { reasons.push('duplicate-evidence-id'); return false; }
      ids.add(e.id); return true;
    });
    const sourceFamilies = uniq(uniqueEvidence.filter(e => e.observed).map(e => e.sourceFamily));
    const models = uniq(valid.map(r => r.modelFingerprint));
    const sharedModelWarning = models.length < Math.min(3, valid.length);
    if (sharedModelWarning) reasons.push('roles-share-model-substrate; independence-not-assumed');

    // A source family contributes only its strongest item: repeated citations
    // cannot inflate confidence by volume.
    const bestBySource = new Map<string, number>();
    for (const evidence of uniqueEvidence) {
      const q = quality(evidence);
      bestBySource.set(evidence.sourceFamily, Math.max(bestBySource.get(evidence.sourceFamily) ?? 0, q));
    }
    const sourceScores = [...bestBySource.values()];
    const evidenceQuality01 = sourceScores.length
      ? clamp(sourceScores.reduce((sum, n) => sum + n, 0) / sourceScores.length) : 0;
    const support = valid.filter(r => r.stance === 'support').length;
    const oppose = valid.filter(r => r.stance === 'oppose').length;
    const stanceBalance = (support + oppose) ? support / (support + oppose) : 0;
    const score01 = clamp(evidenceQuality01 * 0.78 + stanceBalance * 0.22);
    const threshold01 = input.risk === 'high' ? 0.78 : input.risk === 'medium' ? 0.64 : 0.5;
    const minSources = input.risk === 'high' ? 2 : 1;
    const minModels = input.risk === 'high' ? 2 : 1;
    const skeptic = valid.find(r => r.role === 'skeptic');
    const auditorHasObjection = Boolean(auditor?.objections.length);
    const skepticUnresolved = Boolean(skeptic && skeptic.stance === 'oppose' && skeptic.objections.length);
    if (sourceFamilies.length < minSources) reasons.push('insufficient-independent-source-families');
    if (models.length < minModels) reasons.push('insufficient-model-diversity-for-risk');
    if (skepticUnresolved) reasons.push('unresolved-skeptic-objection');
    if (auditorHasObjection) reasons.push('auditor-raised-unresolved-objection');

    let status: ParliamentDecision['status'];
    if (safetyBlocks) status = 'blocked';
    else if (missingRoles.length || provenanceFailed || sourceFamilies.length < minSources ||
      models.length < minModels || uniqueEvidence.length === 0 || skepticUnresolved || auditorHasObjection) {
      status = 'needs-evidence';
    } else if (score01 >= threshold01) status = 'approved';
    else status = 'rejected';
    if (status === 'rejected') reasons.push('evidence-score-below-risk-threshold');
    return {
      version: 1, status, candidateId: input.candidateId, score01, threshold01,
      evidenceQuality01, independentSourceCount: sourceFamilies.length,
      independentModelCount: models.length, coveredRoles, missingRoles,
      sharedModelWarning, reasons: uniq(reasons),
      dissent: valid.filter(r => r.stance === 'oppose' || r.stance === 'block')
        .map(r => ({ role: r.role, stance: r.stance, objections: r.objections })),
      reports: valid,
    };
  }
}
