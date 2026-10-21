import type { SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';
import type { SkillShadowEvidenceVerifier, SkillShadowObservation, VersionedSkillCandidate } from './VersionedSkillCandidateStore.ts';

export interface ReflectiveEvidenceBindingReport {
  accepted: boolean;
  reasons: string[];
  boundTrials: number;
  manifestFingerprint: string | null;
  /** Signed receipt authenticates identity/outcome only; quality metrics remain advisory. */
  boundEvidenceScope: 'identity-and-binary-outcome-only';
  qualityMetricsAuthenticated: false;
}

/**
 * Bind advisory fitness rows to signed shadow-run receipts before they are
 * used as evidence in a candidate review. This does not grant promotion rights:
 * the caller must still use the authenticated approval + outcome-ledger path.
 *
 * trialId is deliberately required to equal the receipt's runId. A caller cannot
 * attach an unrelated successful receipt to a different evaluation row.
 */
export function bindReflectiveReportsToVerifiedShadowEvidence(
  reports: readonly SkillLearnBenchTrialReport[],
  observations: readonly SkillShadowObservation[],
  candidate: Readonly<VersionedSkillCandidate>,
  verifyEvidence: SkillShadowEvidenceVerifier,
): ReflectiveEvidenceBindingReport {
  const reasons: string[] = [];
  const byRun = new Map<string, SkillShadowObservation>();
  const artifactIds = new Set<string>();
  let manifestFingerprint: string | null = null;

  if (!Array.isArray(reports) || reports.length === 0) reasons.push('reflective-reports-required');
  if (!Array.isArray(observations) || observations.length === 0) reasons.push('signed-shadow-observations-required');
  if (!candidate || typeof candidate.candidateId !== 'string' || !candidate.candidateId.trim()) {
    reasons.push('candidate-identity-required');
  }
  if (typeof verifyEvidence !== 'function') reasons.push('trusted-evidence-verifier-required');
  if (reasons.length) return { accepted: false, reasons, boundTrials: 0, manifestFingerprint: null, boundEvidenceScope: 'identity-and-binary-outcome-only', qualityMetricsAuthenticated: false };

  for (const observation of observations) {
    const payload = observation?.artifact?.payload;
    if (!payload || typeof observation.runId !== 'string' || !observation.runId.trim()) {
      reasons.push('observation-receipt-missing');
      continue;
    }
    if (byRun.has(observation.runId)) reasons.push('duplicate-observation-run-id');
    if (artifactIds.has(payload.artifactId)) reasons.push('duplicate-artifact-id');
    byRun.set(observation.runId, observation);
    artifactIds.add(payload.artifactId);
    if (manifestFingerprint === null) manifestFingerprint = payload.manifestFingerprint;
    else if (manifestFingerprint !== payload.manifestFingerprint) reasons.push('manifest-fingerprint-mismatch');
  }

  const seenTrials = new Set<string>();
  const consumedRuns = new Set<string>();
  let boundTrials = 0;
  for (const report of reports) {
    if (!report || typeof report.taskId !== 'string' || typeof report.trialId !== 'string' ||
        !report.taskId.trim() || !report.trialId.trim()) {
      reasons.push('reflective-trial-identity-invalid');
      continue;
    }
    const key = JSON.stringify([report.taskId.trim(), report.trialId.trim()]);
    if (seenTrials.has(key)) {
      reasons.push('duplicate-reflective-trial');
      continue;
    }
    seenTrials.add(key);
    const observation = byRun.get(report.trialId);
    const payload = observation?.artifact?.payload;
    if (!observation || !payload) {
      reasons.push('reflective-trial-has-no-signed-run');
      continue;
    }
    consumedRuns.add(report.trialId);
    if (payload.taskId !== report.taskId || payload.runId !== report.trialId) {
      reasons.push('reflective-trial-receipt-identity-mismatch');
      continue;
    }
    if (payload.passed !== report.taskSuccess?.passed ||
        report.taskSuccess?.passRate !== (payload.passed ? 1 : 0)) {
      reasons.push('reflective-trial-outcome-mismatch');
      continue;
    }
    let verified = false;
    try { verified = verifyEvidence(observation, candidate); } catch { verified = false; }
    if (!verified) {
      reasons.push('signed-shadow-evidence-not-trusted');
      continue;
    }
    boundTrials += 1;
  }

  if (boundTrials !== reports.length) reasons.push('not-all-reflective-trials-bound');
  for (const runId of byRun.keys()) {
    if (!consumedRuns.has(runId)) reasons.push('unmatched-shadow-observation');
  }
  return {
    accepted: reasons.length === 0,
    reasons: [...new Set(reasons)],
    boundTrials,
    manifestFingerprint: reasons.length === 0 ? manifestFingerprint : null,
    boundEvidenceScope: 'identity-and-binary-outcome-only',
    qualityMetricsAuthenticated: false,
  };
}
