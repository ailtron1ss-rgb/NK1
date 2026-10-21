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


/**
 * Join the independent P23 evaluation envelope to Hermes signed shadow receipts.
 * P23 trial IDs are experiment identities; signed receipt run IDs are execution
 * identities, so this bridge joins through the evaluator's independently bound
 * runBindings instead of incorrectly equating those two namespaces.
 *
 * Receipts authenticate candidate identity and binary outcome only. Evaluation
 * quality scores remain derived from the independent evaluator, never from the
 * signature. This function grants no staging, approval, or promotion authority.
 */
export function bindIndependentEvaluationToVerifiedShadowEvidence(
  evaluation: {
    validation: readonly SkillLearnBenchTrialReport[];
    holdout: readonly SkillLearnBenchTrialReport[];
    provenance: {
      experimentAuthority: { manifestFingerprint: string } | null;
      runBindings: readonly {
        taskId: string;
        trialId: string;
        runId: string | null;
        plannedRunId: string | null;
        seed: number;
        split: 'validation' | 'holdout';
        bindingVerified: boolean;
        verifierPassed: boolean;
        safetyViolationCount: number;
      }[];
    };
  },
  observations: readonly SkillShadowObservation[],
  candidate: Readonly<VersionedSkillCandidate>,
  verifyEvidence: SkillShadowEvidenceVerifier,
): ReflectiveEvidenceBindingReport {
  const reasons: string[] = [];
  const authority = evaluation?.provenance?.experimentAuthority;
  const bindings = evaluation?.provenance?.runBindings;
  if (!evaluation || !Array.isArray(evaluation.validation) || !Array.isArray(evaluation.holdout) ||
      !Array.isArray(bindings) || !authority ||
      typeof authority.manifestFingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(authority.manifestFingerprint)) {
    reasons.push('independent-evaluation-authority-required');
  }
  if (!Array.isArray(observations) || observations.length === 0) reasons.push('signed-shadow-observations-required');
  if (!candidate || typeof candidate.candidateId !== 'string' || !candidate.candidateId.trim()) reasons.push('candidate-identity-required');
  if (typeof verifyEvidence !== 'function') reasons.push('trusted-evidence-verifier-required');
  if (reasons.length) return {
    accepted: false, reasons, boundTrials: 0, manifestFingerprint: null,
    boundEvidenceScope: 'identity-and-binary-outcome-only', qualityMetricsAuthenticated: false,
  };

  const allReports = [
    ...evaluation.validation.map(report => ({ report, split: 'validation' as const })),
    ...evaluation.holdout.map(report => ({ report, split: 'holdout' as const })),
  ];
  const reportByKey = new Map<string, { report: SkillLearnBenchTrialReport; split: 'validation' | 'holdout' }>();
  for (const item of allReports) {
    const report = item.report;
    if (!report || typeof report.taskId !== 'string' || !report.taskId.trim() ||
        typeof report.trialId !== 'string' || !report.trialId.trim() ||
        !report.taskSuccess || typeof report.taskSuccess.passed !== 'boolean' ||
        report.taskSuccess.passRate !== (report.taskSuccess.passed ? 1 : 0)) {
      reasons.push('independent-evaluation-report-invalid');
      continue;
    }
    const key = JSON.stringify([report.taskId, report.trialId]);
    if (reportByKey.has(key)) reasons.push('duplicate-independent-evaluation-report');
    else reportByKey.set(key, item);
  }
  const safeBindings = bindings ?? [];
  const bindingByKey = new Map<string, (typeof safeBindings)[number]>();
  const runIds = new Set<string>();
  for (const binding of safeBindings) {
    if (!binding || typeof binding.taskId !== 'string' || !binding.taskId.trim() ||
        typeof binding.trialId !== 'string' || !binding.trialId.trim() ||
        typeof binding.runId !== 'string' || !binding.runId.trim() ||
        typeof binding.plannedRunId !== 'string' || !binding.plannedRunId.trim() ||
        !Number.isSafeInteger(binding.seed) || binding.seed < 0 ||
        !['validation', 'holdout'].includes(binding.split) ||
        binding.bindingVerified !== true || binding.verifierPassed !== true ||
        !Number.isSafeInteger(binding.safetyViolationCount) || binding.safetyViolationCount !== 0) {
      reasons.push('independent-evaluation-run-untrusted');
      continue;
    }
    const key = JSON.stringify([binding.taskId, binding.trialId]);
    if (bindingByKey.has(key) || runIds.has(binding.runId)) reasons.push('duplicate-independent-evaluation-run-binding');
    else {
      bindingByKey.set(key, binding);
      runIds.add(binding.runId);
    }
    const report = reportByKey.get(key);
    if (!report || report.split !== binding.split) reasons.push('independent-evaluation-report-binding-mismatch');
  }
  if (reportByKey.size !== bindingByKey.size || reportByKey.size === 0) reasons.push('independent-evaluation-coverage-incomplete');

  const observationsByRun = new Map<string, SkillShadowObservation>();
  const artifactIds = new Set<string>();
  for (const observation of observations) {
    const payload = observation?.artifact?.payload;
    if (!payload || typeof observation.runId !== 'string' || !observation.runId.trim()) {
      reasons.push('observation-receipt-missing');
      continue;
    }
    if (observationsByRun.has(observation.runId)) reasons.push('duplicate-observation-run-id');
    if (typeof payload.artifactId !== 'string' || !payload.artifactId.trim() || artifactIds.has(payload.artifactId)) {
      reasons.push('duplicate-or-invalid-artifact-id');
    }
    observationsByRun.set(observation.runId, observation);
    artifactIds.add(payload.artifactId);
  }

  let boundTrials = 0;
  const consumedRuns = new Set<string>();
  for (const [key, binding] of bindingByKey) {
    const reportItem = reportByKey.get(key);
    const observation = observationsByRun.get(binding.runId!);
    const payload = observation?.artifact?.payload;
    if (!reportItem || !observation || !payload) {
      reasons.push('independent-evaluation-run-has-no-signed-receipt');
      continue;
    }
    consumedRuns.add(binding.runId!);
    if (payload.runId !== binding.runId || observation.runId !== binding.runId ||
        payload.taskId !== binding.taskId || payload.seed !== binding.seed ||
        payload.manifestFingerprint !== authority.manifestFingerprint ||
        payload.passed !== reportItem.report.taskSuccess.passed) {
      reasons.push('independent-evaluation-signed-receipt-mismatch');
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
  for (const runId of observationsByRun.keys()) {
    if (!consumedRuns.has(runId)) reasons.push('unmatched-shadow-observation');
  }
  if (boundTrials !== reportByKey.size) reasons.push('not-all-independent-evaluation-trials-bound');
  return {
    accepted: reasons.length === 0,
    reasons: [...new Set(reasons)],
    boundTrials,
    manifestFingerprint: reasons.length === 0 ? authority.manifestFingerprint : null,
    boundEvidenceScope: 'identity-and-binary-outcome-only',
    qualityMetricsAuthenticated: false,
  };
}
