import { createHash } from 'node:crypto';
import { snapshotPlainData } from './LearningTrustBoundary.ts';
import type { SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';

/** Validation-only objective vector. Safety is a hard constraint, not a fourth objective. */
export interface ValidationObjectiveVector {
  taskSuccess01: number;
  skillQuality01: number;
  trajectoryQuality01: number;
}

export interface PopulationCandidateTaskRecord {
  /** Hash of the canonical task identity; raw task identifiers are not persisted. */
  taskKeyHash: string;
  /** Hash of the sorted trial identity set for this task. */
  trialSetFingerprint: string;
  trialCount: number;
  taskFamily?: string;
  objectives: ValidationObjectiveVector;
  safetyViolationCount: number;
}

export type PopulationCandidateArchiveStatus =
  | 'pareto'
  | 'dominated'
  | 'duplicate'
  | 'safety-rejected'
  | 'capacity-rejected';

export interface PopulationCandidateRecord {
  candidateFingerprint: string;
  sourceFingerprint: string;
  variationId: string;
  seed: number;
  split: 'validation';
  validationManifestFingerprint: string;
  validationPlanFingerprint: string;
  coverageFingerprint: string;
  objectives: ValidationObjectiveVector;
  perTask: PopulationCandidateTaskRecord[];
  safetyViolationCount: number;
  archiveStatus: PopulationCandidateArchiveStatus;
}

export interface PopulationCandidateInput {
  split: 'validation';
  /** SHA-256 of the exact payload given to the independent validation evaluator. */
  candidateFingerprint: string;
  /** SHA-256 of the immutable source payload for this search run. */
  sourceFingerprint: string;
  variationId: string;
  seed: number;
  validationManifestFingerprint: string;
  validationPlanFingerprint: string;
  reports: readonly SkillLearnBenchTrialReport[];
}

export interface P23CandidateParetoArchiveOptions {
  maxEntries?: number;
  maxTaskRows?: number;
}

export interface PopulationCandidateAdmission {
  status: PopulationCandidateArchiveStatus;
  record: PopulationCandidateRecord;
  evictedFingerprints: string[];
}

export const DEFAULT_P23_POPULATION_ARCHIVE_LIMIT = 16;
export const DEFAULT_P23_POPULATION_TASK_ROW_LIMIT = 4096;
const DIGEST = /^[a-f0-9]{64}$/;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const isUnit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const isSafeIdentity = (value: unknown, max = 256): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max &&
  value.trim() === value && value.normalize('NFKC') === value &&
  !Array.from(value).some(character => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Stable JSON representation for fingerprints; the input has already crossed the plain-data boundary. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('p23-population-value-not-json-serializable');
    return encoded;
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('p23-population-value-must-be-plain-data');
  }
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map(key =>
    JSON.stringify(key) + ':' + canonical(record[key]),
  ).join(',') + '}';
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error('p23-population-empty-objective');
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(6));
}

/** Match the canonical P23 task/skill/trajectory weighting; used only for deterministic tie-breaking. */
function objectiveComposite(value: ValidationObjectiveVector): number {
  return 0.5 * value.taskSuccess01 + 0.2 * value.skillQuality01 + 0.3 * value.trajectoryQuality01;
}

function sameValidationCohort(a: Readonly<PopulationCandidateRecord>, b: Readonly<PopulationCandidateRecord>): boolean {
  return a.sourceFingerprint === b.sourceFingerprint &&
    a.validationManifestFingerprint === b.validationManifestFingerprint &&
    a.validationPlanFingerprint === b.validationPlanFingerprint &&
    a.coverageFingerprint === b.coverageFingerprint;
}

/** A dominates B only on the exact same validation cohort and only when both candidates are safe. */
export function dominatesValidationCandidate(
  a: Readonly<PopulationCandidateRecord>,
  b: Readonly<PopulationCandidateRecord>,
): boolean {
  if (!sameValidationCohort(a, b) || a.safetyViolationCount !== 0 || b.safetyViolationCount !== 0) {
    return false;
  }
  const noWorse =
    a.objectives.taskSuccess01 >= b.objectives.taskSuccess01 &&
    a.objectives.skillQuality01 >= b.objectives.skillQuality01 &&
    a.objectives.trajectoryQuality01 >= b.objectives.trajectoryQuality01;
  const strictlyBetter =
    a.objectives.taskSuccess01 > b.objectives.taskSuccess01 ||
    a.objectives.skillQuality01 > b.objectives.skillQuality01 ||
    a.objectives.trajectoryQuality01 > b.objectives.trajectoryQuality01;
  return noWorse && strictlyBetter;
}

/** Higher validation quality wins; task-minimum then fingerprint make ties deterministic. */
function compareCandidates(a: PopulationCandidateRecord, b: PopulationCandidateRecord): number {
  const compositeDelta = objectiveComposite(b.objectives) - objectiveComposite(a.objectives);
  if (compositeDelta !== 0) return compositeDelta;
  const minimumA = Math.min(...a.perTask.map(row => objectiveComposite(row.objectives)));
  const minimumB = Math.min(...b.perTask.map(row => objectiveComposite(row.objectives)));
  if (minimumA !== minimumB) return minimumB - minimumA;
  return a.candidateFingerprint.localeCompare(b.candidateFingerprint);
}

/** Winner selection is validation-only and has no promotion or activation authority. */
export function selectValidationParetoWinner(
  records: readonly PopulationCandidateRecord[],
): PopulationCandidateRecord | null {
  const eligible = records.filter(record =>
    record.archiveStatus === 'pareto' && record.safetyViolationCount === 0,
  );
  const ordered = [...eligible].sort(compareCandidates);
  return ordered.length > 0 ? clone(ordered[0]!) : null;
}

function buildCandidateRecord(
  rawInput: PopulationCandidateInput,
  maxTaskRows: number,
): PopulationCandidateRecord {
  let input: PopulationCandidateInput;
  try {
    input = snapshotPlainData(rawInput) as PopulationCandidateInput;
  } catch {
    throw new Error('p23-population-input-data-boundary-rejected');
  }
  if (!input || typeof input !== 'object' || input.split !== 'validation') {
    throw new Error('p23-population-validation-only-input-required');
  }
  if (!DIGEST.test(input.candidateFingerprint) || !DIGEST.test(input.sourceFingerprint) ||
      !DIGEST.test(input.validationManifestFingerprint) || !DIGEST.test(input.validationPlanFingerprint) ||
      !isSafeIdentity(input.variationId, 96) ||
      !Number.isSafeInteger(input.seed) || input.seed < 0) {
    throw new Error('p23-population-candidate-identity-invalid');
  }
  if (!Array.isArray(input.reports) || input.reports.length === 0 ||
      input.reports.length > maxTaskRows * 16) {
    throw new Error('p23-population-validation-report-count-invalid');
  }

  const tasks = new Map<string, {
    trialIds: string[];
    taskSuccess: number[];
    skillQuality: number[];
    trajectoryQuality: number[];
    safetyViolationCount: number;
    taskFamily?: string;
  }>();
  const seenTrialIds = new Set<string>();

  for (const report of input.reports) {
    const safetyCount = report?.skillQuality?.safetyViolationCount;
    if (!report || !isSafeIdentity(report.taskId) || !isSafeIdentity(report.trialId) ||
        (report.taskFamily !== undefined && !isSafeIdentity(report.taskFamily, 128)) ||
        typeof report.taskSuccess?.passed !== 'boolean' ||
        !isUnit(report.taskSuccess?.passRate) ||
        report.taskSuccess.passRate !== (report.taskSuccess.passed ? 1 : 0) ||
        !isUnit(report.skillQuality?.aggregate) ||
        !isUnit(report.trajectoryQuality?.aggregate) ||
        !Number.isSafeInteger(safetyCount) || safetyCount < 0 ||
        (report.skillQuality.safety !== undefined &&
          report.skillQuality.safety !== (safetyCount === 0 ? 1 : 0))) {
      throw new Error('p23-population-validation-report-invalid');
    }
    if (seenTrialIds.has(report.trialId)) {
      throw new Error('p23-population-validation-trial-duplicate');
    }
    seenTrialIds.add(report.trialId);

    const existing = tasks.get(report.taskId) ?? {
      trialIds: [],
      taskSuccess: [],
      skillQuality: [],
      trajectoryQuality: [],
      safetyViolationCount: 0,
      ...(report.taskFamily === undefined ? {} : { taskFamily: report.taskFamily }),
    };
    if (existing.taskFamily !== undefined && report.taskFamily !== undefined &&
        existing.taskFamily !== report.taskFamily) {
      throw new Error('p23-population-validation-task-family-conflict');
    }
    existing.trialIds.push(report.trialId);
    existing.taskSuccess.push(report.taskSuccess.passRate);
    existing.skillQuality.push(report.skillQuality.aggregate);
    existing.trajectoryQuality.push(report.trajectoryQuality.aggregate);
    existing.safetyViolationCount += safetyCount;
    tasks.set(report.taskId, existing);
  }
  if (tasks.size > maxTaskRows) throw new Error('p23-population-task-row-limit');

  const perTask: PopulationCandidateTaskRecord[] = [...tasks.entries()].map(([taskId, rows]) => ({
    taskKeyHash: sha256(taskId),
    trialSetFingerprint: sha256(rows.trialIds.slice().sort().join('\n')),
    trialCount: rows.trialIds.length,
    ...(rows.taskFamily === undefined ? {} : { taskFamily: rows.taskFamily }),
    objectives: {
      taskSuccess01: mean(rows.taskSuccess),
      skillQuality01: mean(rows.skillQuality),
      trajectoryQuality01: mean(rows.trajectoryQuality),
    },
    safetyViolationCount: rows.safetyViolationCount,
  })).sort((a, b) => a.taskKeyHash.localeCompare(b.taskKeyHash));

  const coverageFingerprint = sha256(canonical(perTask.map(row => ({
    taskKeyHash: row.taskKeyHash,
    trialSetFingerprint: row.trialSetFingerprint,
    trialCount: row.trialCount,
    taskFamily: row.taskFamily ?? null,
  }))));
  const safetyViolationCount = perTask.reduce((sum, row) => sum + row.safetyViolationCount, 0);

  return {
    candidateFingerprint: input.candidateFingerprint,
    sourceFingerprint: input.sourceFingerprint,
    variationId: input.variationId,
    seed: input.seed,
    split: 'validation',
    validationManifestFingerprint: input.validationManifestFingerprint,
    validationPlanFingerprint: input.validationPlanFingerprint,
    coverageFingerprint,
    objectives: {
      // Macro-average task means so tasks with many repeated trials cannot dominate.
      taskSuccess01: mean(perTask.map(row => row.objectives.taskSuccess01)),
      skillQuality01: mean(perTask.map(row => row.objectives.skillQuality01)),
      trajectoryQuality01: mean(perTask.map(row => row.objectives.trajectoryQuality01)),
    },
    perTask,
    safetyViolationCount,
    archiveStatus: 'pareto',
  };
}

/**
 * Bounded nondominated archive. Only validation reports are accepted or retained;
 * holdout reports cannot enter this API. The archive itself never stages or activates.
 */
export class P23CandidateParetoArchive {
  private readonly maxEntries: number;
  private readonly maxTaskRows: number;
  private records: PopulationCandidateRecord[] = [];
  private cohort: Pick<PopulationCandidateRecord,
    'sourceFingerprint'|'validationManifestFingerprint'|'validationPlanFingerprint'|'coverageFingerprint'> | null = null;
  private readonly seenFingerprints = new Set<string>();

  constructor(options: P23CandidateParetoArchiveOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_P23_POPULATION_ARCHIVE_LIMIT;
    this.maxTaskRows = options.maxTaskRows ?? DEFAULT_P23_POPULATION_TASK_ROW_LIMIT;
    if (!Number.isSafeInteger(this.maxEntries) || this.maxEntries < 1 || this.maxEntries > 64 ||
        !Number.isSafeInteger(this.maxTaskRows) || this.maxTaskRows < 1 || this.maxTaskRows > 16_384) {
      throw new Error('p23-population-archive-budget-invalid');
    }
  }

  add(rawInput: PopulationCandidateInput): PopulationCandidateAdmission {
    const record = buildCandidateRecord(rawInput, this.maxTaskRows);
    if (this.cohort &&
        (this.cohort.sourceFingerprint !== record.sourceFingerprint ||
         this.cohort.validationManifestFingerprint !== record.validationManifestFingerprint ||
         this.cohort.validationPlanFingerprint !== record.validationPlanFingerprint ||
         this.cohort.coverageFingerprint !== record.coverageFingerprint)) {
      throw new Error('p23-population-validation-cohort-mismatch');
    }
    if (!this.cohort) {
      this.cohort = {
        sourceFingerprint: record.sourceFingerprint,
        validationManifestFingerprint: record.validationManifestFingerprint,
        validationPlanFingerprint: record.validationPlanFingerprint,
        coverageFingerprint: record.coverageFingerprint,
      };
    }
    if (this.seenFingerprints.has(record.candidateFingerprint)) {
      record.archiveStatus = 'duplicate';
      return { status: 'duplicate', record: clone(record), evictedFingerprints: [] };
    }
    if (this.seenFingerprints.size >= 16_384) {
      throw new Error('p23-population-seen-fingerprint-limit');
    }
    this.seenFingerprints.add(record.candidateFingerprint);

    if (record.safetyViolationCount > 0) {
      record.archiveStatus = 'safety-rejected';
      return { status: 'safety-rejected', record: clone(record), evictedFingerprints: [] };
    }

    if (this.records.some(existing => dominatesValidationCandidate(existing, record))) {
      record.archiveStatus = 'dominated';
      return { status: 'dominated', record: clone(record), evictedFingerprints: [] };
    }

    const pool = [...this.records, clone(record)];
    const nondominated = pool.filter(candidate => !pool.some(other =>
      other.candidateFingerprint !== candidate.candidateFingerprint &&
      dominatesValidationCandidate(other, candidate),
    ));
    nondominated.sort(compareCandidates);
    const retained = nondominated.slice(0, this.maxEntries);
    const retainedFingerprints = new Set(retained.map(row => row.candidateFingerprint));
    const evictedFingerprints = this.records
      .filter(row => !retainedFingerprints.has(row.candidateFingerprint))
      .map(row => row.candidateFingerprint);
    const admitted = retainedFingerprints.has(record.candidateFingerprint);
    this.records = retained;

    if (!admitted) {
      record.archiveStatus = 'capacity-rejected';
      return { status: 'capacity-rejected', record: clone(record), evictedFingerprints };
    }
    record.archiveStatus = 'pareto';
    return { status: 'pareto', record: clone(record), evictedFingerprints };
  }

  snapshot(): PopulationCandidateRecord[] {
    return clone([...this.records].sort(compareCandidates));
  }

  winner(): PopulationCandidateRecord | null {
    return selectValidationParetoWinner(this.records);
  }

  diagnostics(): {
    entries: number;
    maxEntries: number;
    taskRows: number;
    maxTaskRows: number;
    validationOnly: true;
  } {
    return {
      entries: this.records.length,
      maxEntries: this.maxEntries,
      taskRows: this.records.reduce((sum, row) => sum + row.perTask.length, 0),
      maxTaskRows: this.maxTaskRows,
      validationOnly: true,
    };
  }
}
