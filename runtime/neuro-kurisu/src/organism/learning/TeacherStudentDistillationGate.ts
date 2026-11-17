import { createHash } from 'node:crypto';
import { bootstrapMeanConfidenceInterval } from './PairedSeedConfidence.ts';
import { hasAuthenticatedOutcomeEvidence } from './VerifiedOutcomeArtifact.ts';
import { VerifiedOutcomeLedger, type EvaluationSplit, type TaskManifestEntry, type VerifiedTaskOutcome } from './VerifiedOutcomeLedger.ts';
import { snapshotPlainData } from './LearningTrustBoundary.ts';

export interface DistillationPairedSummary {
  pairedSeedCount: number;
  baselinePassRate01: number;
  studentPassRate01: number;
  absoluteGain01: number;
  confidenceInterval95: { lower: number; upper: number } | null;
}

export interface DistillationFamilySummary extends DistillationPairedSummary {
  family: string;
}

export interface TeacherStudentDistillationGateState {
  schemaVersion: 1;
  consumedCandidateFingerprints: string[];
  saturated: boolean;
}

export interface TeacherStudentDistillationGateOptions {
  minValidationSeeds?: number;
  minHoldoutSeeds?: number;
  minHoldoutFamilies?: number;
  minimumHoldoutGain01?: number;
  maximumFamilyRegression01?: number;
  bootstrapResamples?: number;
}

export interface TeacherStudentDistillationGateReport {
  schemaVersion: 1;
  status: 'insufficient-evidence' | 'rejected' | 'eligible-for-manual-review' | 'already-consumed';
  candidateFingerprint: string;
  manifestFingerprint: string;
  baselineMethod: string;
  studentMethod: string;
  validation: DistillationPairedSummary;
  holdout: DistillationPairedSummary;
  holdoutFamilies: DistillationFamilySummary[];
  reasonCodes: string[];
  manualApprovalRequired: true;
  automaticActivation: false;
  evaluatedAt: number;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const isDigest = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const safeIdentity = (value: unknown, max = 180): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max &&
  value.trim() === value && !/[\u0000-\u001f\u007f-\u009f]/.test(value);

const emptySummary = (): DistillationPairedSummary => ({
  pairedSeedCount: 0,
  baselinePassRate01: 0,
  studentPassRate01: 0,
  absoluteGain01: 0,
  confidenceInterval95: null,
});

function summarizePaired(
  ledger: VerifiedOutcomeLedger,
  split: EvaluationSplit,
  baselineMethod: string,
  studentMethod: string,
  family: string | undefined,
  bootstrapResamples: number,
): DistillationPairedSummary {
  const snapshot = ledger.snapshot();
  const tasks = (snapshot.manifest as TaskManifestEntry[])
    .filter(task => task.split === split && (family === undefined || task.family === family))
    .map(task => task.taskId).sort();
  if (!tasks.length) return emptySummary();

  const taskSet = new Set(tasks);
  const bySeed = new Map<number, Map<string, Map<string, VerifiedTaskOutcome>>>();
  for (const outcome of snapshot.outcomes as VerifiedTaskOutcome[]) {
    if (!taskSet.has(outcome.taskId) || outcome.attempt !== 1 ||
        (outcome.method !== baselineMethod && outcome.method !== studentMethod) ||
        outcome.authority !== 'independent-verifier' ||
        !hasAuthenticatedOutcomeEvidence(ledger, outcome.evidenceRef)) continue;
    const taskRows = bySeed.get(outcome.seed) ?? new Map<string, Map<string, VerifiedTaskOutcome>>();
    const methods = taskRows.get(outcome.taskId) ?? new Map<string, VerifiedTaskOutcome>();
    methods.set(outcome.method, outcome);
    taskRows.set(outcome.taskId, methods);
    bySeed.set(outcome.seed, taskRows);
  }

  const paired: Array<{ seed: number; baseline: number; student: number }> = [];
  for (const [seed, taskRows] of [...bySeed.entries()].sort((a, b) => a[0] - b[0])) {
    if (tasks.some(taskId => {
      const methods = taskRows.get(taskId);
      return !methods?.has(baselineMethod) || !methods?.has(studentMethod);
    })) continue;
    const baseline = tasks.reduce((sum, taskId) =>
      sum + Number(taskRows.get(taskId)!.get(baselineMethod)!.passed), 0) / tasks.length;
    const student = tasks.reduce((sum, taskId) =>
      sum + Number(taskRows.get(taskId)!.get(studentMethod)!.passed), 0) / tasks.length;
    paired.push({ seed, baseline, student });
  }
  if (!paired.length) return emptySummary();

  const baselinePassRate01 = paired.reduce((sum, row) => sum + row.baseline, 0) / paired.length;
  const studentPassRate01 = paired.reduce((sum, row) => sum + row.student, 0) / paired.length;
  const differences = paired.map(row => row.student - row.baseline);
  let confidenceInterval95: { lower: number; upper: number } | null = null;
  if (differences.length >= 2) {
    const identity = JSON.stringify({
      manifest: ledger.manifestFingerprint(),
      split,
      family: family ?? null,
      baselineMethod,
      studentMethod,
      seeds: paired.map(row => row.seed),
    });
    const seed = Number.parseInt(sha256(identity).slice(0, 8), 16);
    const interval = bootstrapMeanConfidenceInterval(differences, {
      confidenceLevel: 0.95,
      resamples: bootstrapResamples,
      seed,
    });
    confidenceInterval95 = { lower: interval.lower, upper: interval.upper };
  }
  return {
    pairedSeedCount: paired.length,
    baselinePassRate01,
    studentPassRate01,
    absoluteGain01: studentPassRate01 - baselinePassRate01,
    confidenceInterval95,
  };
}

function validOptions(options: TeacherStudentDistillationGateOptions) {
  const minValidationSeeds = options.minValidationSeeds ?? 3;
  const minHoldoutSeeds = options.minHoldoutSeeds ?? 5;
  const minHoldoutFamilies = options.minHoldoutFamilies ?? 2;
  const minimumHoldoutGain01 = options.minimumHoldoutGain01 ?? 0.01;
  const maximumFamilyRegression01 = options.maximumFamilyRegression01 ?? 0.02;
  const bootstrapResamples = options.bootstrapResamples ?? 4000;
  if (!Number.isSafeInteger(minValidationSeeds) || minValidationSeeds < 2 || minValidationSeeds > 1000 ||
      !Number.isSafeInteger(minHoldoutSeeds) || minHoldoutSeeds < 2 || minHoldoutSeeds > 1000 ||
      !Number.isSafeInteger(minHoldoutFamilies) || minHoldoutFamilies < 1 || minHoldoutFamilies > 1000 ||
      !Number.isFinite(minimumHoldoutGain01) || minimumHoldoutGain01 < 0 || minimumHoldoutGain01 > 1 ||
      !Number.isFinite(maximumFamilyRegression01) || maximumFamilyRegression01 < 0 ||
      maximumFamilyRegression01 > 1 ||
      !Number.isSafeInteger(bootstrapResamples) || bootstrapResamples < 100 || bootstrapResamples > 50_000) {
    throw new Error('teacher-distillation-gate-options-invalid');
  }
  return {
    minValidationSeeds, minHoldoutSeeds, minHoldoutFamilies,
    minimumHoldoutGain01, maximumFamilyRegression01, bootstrapResamples,
  };
}

/**
 * Stateful, one-shot holdout decision. Persist snapshot() with the host-owned state
 * store and restore it on restart; a missing/corrupt receipt fails closed.
 *
 * Only cryptographically authenticated independent-verifier outcomes are considered.
 * The result is a review recommendation, never a command to load or activate weights.
 */
export class TeacherStudentDistillationGate {
  private readonly consumed = new Set<string>();
  private saturated = false;

  constructor(rawState?: TeacherStudentDistillationGateState | null) {
    if (rawState === undefined || rawState === null) return;
    this.restore(rawState);
  }

  private restore(rawState: TeacherStudentDistillationGateState): void {
    let state: TeacherStudentDistillationGateState;
    try {
      state = snapshotPlainData(rawState) as TeacherStudentDistillationGateState;
    } catch {
      this.saturated = true;
      return;
    }
    if (!state || state.schemaVersion !== 1 || !Array.isArray(state.consumedCandidateFingerprints) ||
        state.consumedCandidateFingerprints.length > 10_000 ||
        typeof state.saturated !== 'boolean' ||
        state.consumedCandidateFingerprints.some(value => !isDigest(value)) ||
        new Set(state.consumedCandidateFingerprints).size !== state.consumedCandidateFingerprints.length) {
      this.saturated = true;
      return;
    }
    this.consumed.clear();
    for (const candidate of state.consumedCandidateFingerprints) this.consumed.add(candidate);
    this.saturated = state.saturated;
  }

  snapshot(): TeacherStudentDistillationGateState {
    return {
      schemaVersion: 1,
      consumedCandidateFingerprints: [...this.consumed].sort(),
      saturated: this.saturated,
    };
  }

  evaluateOnce(input: {
    ledger: VerifiedOutcomeLedger;
    candidateFingerprint: string;
    baselineMethod: string;
    studentMethod: string;
    options?: TeacherStudentDistillationGateOptions;
  }): TeacherStudentDistillationGateReport {
    const { ledger, candidateFingerprint, baselineMethod, studentMethod } = input;
    if (!(ledger instanceof VerifiedOutcomeLedger) || !isDigest(candidateFingerprint) ||
        !safeIdentity(baselineMethod) || !safeIdentity(studentMethod) || baselineMethod === studentMethod) {
      throw new Error('teacher-distillation-gate-input-invalid');
    }
    let options: ReturnType<typeof validOptions>;
    try {
      const detachedOptions = snapshotPlainData(input.options ?? {});
      if (!detachedOptions || typeof detachedOptions !== 'object' || Array.isArray(detachedOptions)) {
        throw new Error('options-not-plain-data');
      }
      options = validOptions(detachedOptions as TeacherStudentDistillationGateOptions);
    } catch {
      throw new Error('teacher-distillation-gate-options-boundary-rejected');
    }
    const manifestFingerprint = ledger.manifestFingerprint();
    const blocked = this.saturated || this.consumed.has(candidateFingerprint);
    if (blocked) {
      return {
        schemaVersion: 1,
        status: 'already-consumed',
        candidateFingerprint,
        manifestFingerprint,
        baselineMethod,
        studentMethod,
        validation: emptySummary(),
        holdout: emptySummary(),
        holdoutFamilies: [],
        reasonCodes: [this.saturated ? 'holdout-ledger-invalid-or-saturated' : 'holdout-already-consumed'],
        manualApprovalRequired: true,
        automaticActivation: false,
        evaluatedAt: Date.now(),
      };
    }
    // Consume before inspecting outcomes. A partial/failed analysis cannot be rerun
    // against the same candidate and the same private holdout after observing results.
    this.consumed.add(candidateFingerprint);
    if (this.consumed.size > 10_000) {
      this.saturated = true;
      return {
        schemaVersion: 1,
        status: 'already-consumed',
        candidateFingerprint,
        manifestFingerprint,
        baselineMethod,
        studentMethod,
        validation: emptySummary(),
        holdout: emptySummary(),
        holdoutFamilies: [],
        reasonCodes: ['holdout-ledger-capacity-exceeded'],
        manualApprovalRequired: true,
        automaticActivation: false,
        evaluatedAt: Date.now(),
      };
    }

    const manifest = ledger.snapshot().manifest as TaskManifestEntry[];
    const holdoutFamilies = [...new Set(manifest
      .filter(task => task.split === 'holdout')
      .map(task => task.family))].sort();
    const validation = summarizePaired(
      ledger, 'validation', baselineMethod, studentMethod, undefined, options.bootstrapResamples,
    );
    const holdout = summarizePaired(
      ledger, 'holdout', baselineMethod, studentMethod, undefined, options.bootstrapResamples,
    );
    const familySummaries = holdoutFamilies.map(family => ({
      family,
      ...summarizePaired(
        ledger, 'holdout', baselineMethod, studentMethod, family, options.bootstrapResamples,
      ),
    }));
    const insufficient: string[] = [];
    const rejected: string[] = [];
    if (validation.pairedSeedCount < options.minValidationSeeds) insufficient.push('validation-paired-seeds-insufficient');
    if (validation.pairedSeedCount >= options.minValidationSeeds && validation.absoluteGain01 < 0) {
      rejected.push('validation-regression');
    }
    if (holdoutFamilies.length < options.minHoldoutFamilies) insufficient.push('holdout-family-count-insufficient');
    if (holdout.pairedSeedCount < options.minHoldoutSeeds) insufficient.push('holdout-paired-seeds-insufficient');
    if (holdout.pairedSeedCount >= options.minHoldoutSeeds && holdout.confidenceInterval95 === null) {
      insufficient.push('holdout-confidence-interval-unavailable');
    }
    if (familySummaries.some(row => row.pairedSeedCount < options.minHoldoutSeeds)) {
      insufficient.push('holdout-family-seeds-insufficient');
    }
    if (familySummaries.some(row => row.pairedSeedCount >= options.minHoldoutSeeds &&
        row.absoluteGain01 < -options.maximumFamilyRegression01)) {
      rejected.push('holdout-family-regression');
    }
    if (holdout.pairedSeedCount >= options.minHoldoutSeeds) {
      if (holdout.absoluteGain01 < options.minimumHoldoutGain01) rejected.push('holdout-gain-below-threshold');
      if (holdout.confidenceInterval95 && holdout.confidenceInterval95.lower <= 0) {
        rejected.push('holdout-confidence-interval-includes-zero');
      }
    }
    const reasonCodes = [...insufficient, ...rejected];
    const status = insufficient.length
      ? 'insufficient-evidence'
      : rejected.length
        ? 'rejected'
        : 'eligible-for-manual-review';
    return {
      schemaVersion: 1,
      status,
      candidateFingerprint,
      manifestFingerprint,
      baselineMethod,
      studentMethod,
      validation,
      holdout,
      holdoutFamilies: familySummaries,
      reasonCodes,
      manualApprovalRequired: true,
      automaticActivation: false,
      evaluatedAt: Date.now(),
    };
  }
}
