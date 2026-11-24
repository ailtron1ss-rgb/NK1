export interface SkillEvaluationInput {
  split: 'holdout';
  manifestFingerprint: string;
  outcomeFingerprint: string;
  authenticatedEvidenceRows: number;
  unauthenticatedEvidenceRows: number;
  quality: { sampleN: number; coverage: number; executability: number; safety: number };
  trajectory: {
    sampleN: number;
    keyPointRecall: number;
    orderAccuracy: number;
    completionRate: number;
    skillInvocationRate: number;
  };
  outcome: {
    sampleN: number;
    uniqueTaskN: number;
    pairedSeedN: number;
    baselinePassRate: number;
    candidatePassRate: number;
    meanSteps: number;
    meanTokens: number;
  };
}

export interface SkillEvaluationReport {
  schemaVersion: 1;
  split: 'holdout';
  manifestFingerprint: string;
  outcomeFingerprint: string;
  evidence: {
    authenticatedRows: number;
    unauthenticatedRows: number;
    integrity: 'authenticated' | 'incomplete';
  };
  levels: {
    skillQuality: { sampleN: number; coverage: number; executability: number; safety: number; meanScore: number };
    trajectory: {
      sampleN: number;
      keyPointRecall: number;
      orderAccuracy: number;
      completionRate: number;
      skillInvocationRate: number;
      meanScore: number;
    };
    taskOutcome: {
      sampleN: number;
      uniqueTaskN: number;
      pairedSeedN: number;
      baselinePassRate: number;
      candidatePassRate: number;
      absoluteGain: number;
      meanSteps: number;
      meanTokens: number;
    };
  };
  reviewability: {
    eligible: boolean;
    reasons: string[];
    minimums: { qualitySamples: number; trajectorySamples: number; outcomePairs: number; uniqueTasks: number; pairedSeeds: number };
  };
}

const isCount = (value: number) => Number.isSafeInteger(value) && value >= 0;
const isRate = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;
const isNonNegative = (value: number) => Number.isFinite(value) && value >= 0;

/**
 * Three-level holdout report inspired by SkillLearnBench. It keeps skill quality,
 * execution trajectory and verifier outcomes separate instead of hiding failures
 * behind one composite score. It reports eligibility for review, not promotion.
 */
export function buildSkillEvaluationReport(input: SkillEvaluationInput): SkillEvaluationReport {
  if (!input || input.split !== 'holdout') throw new Error('skill evaluation report requires the holdout split');
  if (!/^[a-f0-9]{64}$/i.test(input.manifestFingerprint) ||
      !/^[a-f0-9]{64}$/i.test(input.outcomeFingerprint)) throw new Error('manifest and outcome fingerprints must be SHA-256');
  const q = input.quality;
  const t = input.trajectory;
  const o = input.outcome;
  if (!q || !isCount(q.sampleN) || ![q.coverage,q.executability,q.safety].every(isRate)) {
    throw new Error('invalid skill-quality measurements');
  }
  if (!t || !isCount(t.sampleN) ||
      ![t.keyPointRecall,t.orderAccuracy,t.completionRate,t.skillInvocationRate].every(isRate)) {
    throw new Error('invalid trajectory measurements');
  }
  if (!o || !isCount(o.sampleN) || !isCount(o.uniqueTaskN) || !isCount(o.pairedSeedN) ||
      ![o.baselinePassRate,o.candidatePassRate].every(isRate) ||
      !isNonNegative(o.meanSteps) || !isNonNegative(o.meanTokens)) {
    throw new Error('invalid task-outcome measurements');
  }
  if (!isCount(input.authenticatedEvidenceRows) || !isCount(input.unauthenticatedEvidenceRows)) {
    throw new Error('invalid evidence row counts');
  }
  const reasons: string[] = [];
  if (q.sampleN < 1) reasons.push('missing-skill-quality-samples');
  if (t.sampleN < 1) reasons.push('missing-trajectory-samples');
  if (o.sampleN < 8) reasons.push('insufficient-paired-outcome-samples');
  if (o.uniqueTaskN < 8) reasons.push('insufficient-independent-task-coverage');
  if (o.pairedSeedN < 3) reasons.push('insufficient-paired-seed-coverage');
  if (input.authenticatedEvidenceRows < o.sampleN) reasons.push('authenticated-evidence-does-not-cover-outcome-samples');
  if (input.unauthenticatedEvidenceRows !== 0) reasons.push('unauthenticated-outcome-evidence-present');
  return {
    schemaVersion: 1, split: 'holdout', manifestFingerprint: input.manifestFingerprint,
    outcomeFingerprint: input.outcomeFingerprint,
    evidence: {
      authenticatedRows: input.authenticatedEvidenceRows,
      unauthenticatedRows: input.unauthenticatedEvidenceRows,
      integrity: reasons.some(reason => reason.includes('evidence')) ? 'incomplete' : 'authenticated',
    },
    levels: {
      skillQuality: { ...q, meanScore: (q.coverage + q.executability + q.safety) / 3 },
      trajectory: { ...t, meanScore: (t.keyPointRecall + t.orderAccuracy + t.completionRate + t.skillInvocationRate) / 4 },
      taskOutcome: { ...o, absoluteGain: o.candidatePassRate - o.baselinePassRate },
    },
    reviewability: {
      eligible: reasons.length === 0, reasons,
      minimums: { qualitySamples: 1, trajectorySamples: 1, outcomePairs: 8, uniqueTasks: 8, pairedSeeds: 3 },
    },
  };
}
