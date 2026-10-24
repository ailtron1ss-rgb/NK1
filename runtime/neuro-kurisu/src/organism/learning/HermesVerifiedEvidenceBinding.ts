import { createHash } from 'node:crypto';
import type { SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';
import type { SkillShadowEvidenceVerifier, SkillShadowObservation, VersionedSkillCandidate } from './VersionedSkillCandidateStore.ts';

const MAX_EVIDENCE_CANONICAL_NODES = 100_000;
const MAX_EVIDENCE_CANONICAL_DEPTH = 64;
const MAX_EVIDENCE_CANONICAL_ARRAY_LENGTH = 20_000;
const MAX_EVIDENCE_CANONICAL_OBJECT_KEYS = 20_000;
const MAX_EVIDENCE_CANONICAL_STRING_UNITS = 4 * 1024 * 1024;
type EvidenceCanonicalBudget = { nodes: number; stringUnits: number };

function canonicalEvidence(
  value: unknown,
  ancestors = new Set<object>(),
  budget: EvidenceCanonicalBudget = { nodes: 0, stringUnits: 0 },
  depth = 0,
): string {
  if (depth > MAX_EVIDENCE_CANONICAL_DEPTH) throw new Error('evidence-envelope-depth-exceeded');
  budget.nodes += 1;
  if (budget.nodes > MAX_EVIDENCE_CANONICAL_NODES) throw new Error('evidence-envelope-node-budget-exceeded');
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('evidence-envelope-non-finite-number');
  }
  if (typeof value === 'string') {
    budget.stringUnits += value.length;
    if (budget.stringUnits > MAX_EVIDENCE_CANONICAL_STRING_UNITS) {
      throw new Error('evidence-envelope-string-budget-exceeded');
    }
  }
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('evidence-envelope-not-json-serializable');
    return encoded;
  }
  if (ancestors.has(value)) throw new Error('evidence-envelope-circular-reference');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error('evidence-envelope-non-plain-object');
  }
  ancestors.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<PropertyKey, PropertyDescriptor>;
    if (Array.isArray(value)) {
      const length = descriptors.length?.value;
      if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 ||
          length > MAX_EVIDENCE_CANONICAL_ARRAY_LENGTH) {
        throw new Error('evidence-envelope-array-budget-exceeded');
      }
      for (const key of Reflect.ownKeys(descriptors)) {
        if (key === 'length') continue;
        const descriptor = descriptors[key];
        if (!descriptor?.enumerable) continue;
        if (typeof key === 'symbol' || !/^(0|[1-9]\d*)$/.test(key) ||
            !Number.isSafeInteger(Number(key)) || Number(key) >= length) {
          throw new Error('evidence-envelope-array-extra-key');
        }
      }
      const items: string[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !descriptor.enumerable) throw new Error('evidence-envelope-sparse-array');
        if (!('value' in descriptor)) throw new Error('evidence-envelope-accessor-not-permitted');
        items.push(canonicalEvidence(descriptor.value, ancestors, budget, depth + 1));
      }
      return '[' + items.join(',') + ']';
    }

    const keys: string[] = [];
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = descriptors[key];
      if (!descriptor?.enumerable) continue;
      if (typeof key === 'symbol') throw new Error('evidence-envelope-symbol-key-not-supported');
      if (key.length > 1024) throw new Error('evidence-envelope-key-too-long');
      budget.stringUnits += key.length;
      if (budget.stringUnits > MAX_EVIDENCE_CANONICAL_STRING_UNITS) {
        throw new Error('evidence-envelope-string-budget-exceeded');
      }
      keys.push(key);
    }
    if (keys.length > MAX_EVIDENCE_CANONICAL_OBJECT_KEYS) throw new Error('evidence-envelope-object-key-budget-exceeded');
    keys.sort();
    return '{' + keys.map(key => {
      const descriptor = descriptors[key]!;
      if (!('value' in descriptor)) throw new Error('evidence-envelope-accessor-not-permitted');
      return JSON.stringify(key) + ':' + canonicalEvidence(descriptor.value, ancestors, budget, depth + 1);
    }).join(',') + '}';
  } finally {
    ancestors.delete(value);
  }
}

function sha256Evidence(value: unknown): string {
  return createHash('sha256').update(canonicalEvidence(value)).digest('hex');
}
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
  envelope: {
    payloadFingerprint: string;
    evaluationFingerprint: string;
    evaluation: {
      validation: readonly SkillLearnBenchTrialReport[];
      holdout: readonly SkillLearnBenchTrialReport[];
      provenance: {
        payloadFingerprint?: string;
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
    };
  },
  observations: readonly SkillShadowObservation[],
  candidate: Readonly<VersionedSkillCandidate>,
  verifyEvidence: SkillShadowEvidenceVerifier,
): ReflectiveEvidenceBindingReport {
  const reasons: string[] = [];
  let evaluationValue: unknown;
  let recomputedEvaluationFingerprint: string | null = null;
  try {
    if (!envelope || typeof envelope !== 'object') throw new Error('evidence-envelope-object-required');
    const envelopePrototype = Object.getPrototypeOf(envelope);
    if (envelopePrototype !== Object.prototype && envelopePrototype !== null) {
      throw new Error('evidence-envelope-non-plain-object');
    }
    const envelopeDescriptors = Object.getOwnPropertyDescriptors(envelope) as Record<PropertyKey, PropertyDescriptor>;
    for (const field of ['payloadFingerprint', 'evaluationFingerprint', 'evaluation'] as const) {
      const descriptor = envelopeDescriptors[field];
      if (descriptor && !('value' in descriptor)) throw new Error('evidence-envelope-accessor-not-permitted');
    }
    const evaluationDescriptor = envelopeDescriptors.evaluation;
    evaluationValue = evaluationDescriptor && 'value' in evaluationDescriptor ? evaluationDescriptor.value : undefined;
    if (evaluationValue !== undefined) recomputedEvaluationFingerprint = sha256Evidence(evaluationValue);
  } catch {
    // Reject before reading envelope/evaluation fields again; doing so after a
    // canonicalization failure could execute the very accessor being rejected.
    return {
      accepted: false,
      reasons: ['independent-evaluation-envelope-not-canonicalizable'],
      boundTrials: 0,
      manifestFingerprint: null,
      boundEvidenceScope: 'identity-and-binary-outcome-only',
      qualityMetricsAuthenticated: false,
    };
  }
  const evaluation = evaluationValue as typeof envelope.evaluation | undefined;
  if (!evaluation) return {
    accepted: false,
    reasons: ['independent-evaluation-envelope-not-canonicalizable'],
    boundTrials: 0,
    manifestFingerprint: null,
    boundEvidenceScope: 'identity-and-binary-outcome-only',
    qualityMetricsAuthenticated: false,
  };
  const authority = evaluation.provenance?.experimentAuthority;
  const bindings = evaluation?.provenance?.runBindings;
  const trustedManifestFingerprint = authority?.manifestFingerprint ?? '';
  if (!envelope || !/^[a-f0-9]{64}$/.test(envelope.payloadFingerprint) ||
      !/^[a-f0-9]{64}$/.test(envelope.evaluationFingerprint) || !evaluation ||
      envelope.payloadFingerprint !== evaluation.provenance?.payloadFingerprint ||
      envelope.evaluationFingerprint !== recomputedEvaluationFingerprint) {
    reasons.push('independent-evaluation-envelope-integrity-invalid');
  }
  if (!evaluation || !Array.isArray(evaluation.validation) || !Array.isArray(evaluation.holdout) ||
      !Array.isArray(bindings) || !authority ||
      typeof authority.manifestFingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(authority.manifestFingerprint)) {
    reasons.push('independent-evaluation-authority-required');
  }
  if (!Array.isArray(observations) || observations.length === 0) reasons.push('signed-shadow-observations-required');
  if (!candidate || typeof candidate.candidateId !== 'string' || !candidate.candidateId.trim()) reasons.push('candidate-identity-required');
  else if (candidate.payloadFingerprint !== envelope?.payloadFingerprint) {
    // The independent report must evaluate this exact staged payload, not merely
    // a different payload whose receipt happens to carry the same task/outcome.
    reasons.push('independent-evaluation-candidate-payload-mismatch');
  }
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
        binding.bindingVerified !== true || typeof binding.verifierPassed !== 'boolean' ||
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
        payload.manifestFingerprint !== trustedManifestFingerprint ||
        payload.passed !== reportItem.report.taskSuccess.passed ||
        binding.verifierPassed !== reportItem.report.taskSuccess.passed) {
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
    manifestFingerprint: reasons.length === 0 ? trustedManifestFingerprint : null,
    boundEvidenceScope: 'identity-and-binary-outcome-only',
    qualityMetricsAuthenticated: false,
  };
}
