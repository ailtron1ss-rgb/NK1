import { createHash } from 'node:crypto';
import { P23CandidateParetoArchive, type PopulationCandidateRecord } from './P23CandidateParetoArchive.ts';
import type { SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';
import type { SkillRevisionTarget } from './SkillRevisionPlan.ts';
import type {
  ValidationOnlyCandidateEvaluator,
  ValidationOnlyCandidateEvaluation,
} from './ValidationOnlySkillCandidateEvaluator.ts';
import { snapshotPlainData } from './LearningTrustBoundary.ts';

const DIGEST = /^[a-f0-9]{64}$/;
const HARD_MAX_CANDIDATES = 4;
const DEFAULT_MAX_CANDIDATES = 3;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024;
const DEFAULT_MINIMUM_GAIN = 0.005;

export interface P23PopulationSearchBudget {
  maxCandidates?: number;
  maxGenerationCalls?: number;
  maxEvaluationCalls?: number;
  timeoutMs?: number;
  maxPayloadBytes?: number;
  maxArchiveEntries?: number;
  minimumValidationGain01?: number;
  seed?: number;
}

export interface P23PopulationSearchVariation {
  id: 'minimal-targeted-repair' | 'trajectory-structure-revision' |
      'edge-case-reinforcement' | 'simplify-with-contract-preservation';
  instruction: string;
  index: number;
  seed: number;
}

export interface P23PopulationCandidateGenerationRequest {
  sourcePayload: unknown;
  datasetFingerprint: string;
  optimizerInstruction: string;
  validationEvidence: unknown[];
  targets: SkillRevisionTarget[];
  holdoutPolicy: {
    resultsWithheld: true;
    requiresFreshIndependentEvaluation: true;
  };
  variation: P23PopulationSearchVariation;
  signal: AbortSignal;
}

export type P23PopulationCandidateGenerator = (
  request: P23PopulationCandidateGenerationRequest,
) => Promise<unknown> | unknown;

export interface P23PopulationSearchInput {
  sourcePayload: unknown;
  datasetFingerprint: string;
  optimizerInstruction: string;
  validationEvidence: unknown[];
  targets: SkillRevisionTarget[];
  holdoutPolicy: {
    resultsWithheld: true;
    requiresFreshIndependentEvaluation: true;
  };
  /** Validation-only reports for the source version; never include holdout reports here. */
  sourceValidationReports: SkillLearnBenchTrialReport[];
  validationEvaluator: ValidationOnlyCandidateEvaluator;
  generateCandidate: P23PopulationCandidateGenerator;
  budget?: P23PopulationSearchBudget;
}

export interface P23PopulationSearchDiagnostics {
  generationCalls: number;
  uniqueCandidates: number;
  evaluationCalls: number;
  duplicateCandidates: number;
  sourceIdenticalCandidates: number;
  invalidCandidates: number;
  safetyRejected: number;
  dominatedCandidates: number;
  paretoRetained: number;
  validationOnly: true;
  timedOut: boolean;
}

export interface P23PopulationSearchResult {
  status: 'selected' | 'no-improving-candidate';
  selectedPayload: unknown | null;
  selectedCandidateFingerprint: string | null;
  archive: PopulationCandidateRecord[];
  diagnostics: P23PopulationSearchDiagnostics;
}

interface NormalizedBudget {
  maxCandidates: number;
  maxGenerationCalls: number;
  maxEvaluationCalls: number;
  timeoutMs: number;
  maxPayloadBytes: number;
  maxArchiveEntries: number;
  minimumValidationGain01: number;
  seed: number;
}

interface FrozenSearchInput {
  sourcePayload: unknown;
  sourceCanonical: string;
  sourceFingerprint: string;
  datasetFingerprint: string;
  optimizerInstruction: string;
  validationEvidence: unknown[];
  targets: SkillRevisionTarget[];
  sourceValidationReports: SkillLearnBenchTrialReport[];
  holdoutPolicy: {
    resultsWithheld: true;
    requiresFreshIndependentEvaluation: true;
  };
  generateCandidate: P23PopulationCandidateGenerator;
  evaluateValidation: ValidationOnlyCandidateEvaluator['evaluate'];
  budget: NormalizedBudget;
}

const VARIATIONS: readonly Omit<P23PopulationSearchVariation, 'index'|'seed'>[] = [
  {
    id: 'minimal-targeted-repair',
    instruction: 'Make the smallest local change that directly addresses the evidence-backed targets. Preserve all unrelated fields and contracts.',
  },
  {
    id: 'trajectory-structure-revision',
    instruction: 'Explore an alternative ordering or structure for the evidenced trajectory while preserving the same capabilities and safety constraints.',
  },
  {
    id: 'edge-case-reinforcement',
    instruction: 'Improve the narrow evidenced edge case and its explicit preconditions without broadening unrelated behavior.',
  },
  {
    id: 'simplify-with-contract-preservation',
    instruction: 'Reduce unnecessary complexity only where the validation evidence supports it; preserve safety, schema, and all unrelated behavior.',
  },
];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSafeText(value: unknown, max = 4096): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max &&
    value.trim() === value &&
    !Array.from(value).some(character => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
    });
}

function canonical(value: unknown, ancestors = new Set<object>()): string {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('p23-population-non-finite-number');
  }
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('p23-population-value-not-json-serializable');
    return encoded;
  }
  if (ancestors.has(value)) throw new Error('p23-population-circular-value');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error('p23-population-non-plain-value');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return '[' + value.map(item => canonical(item, ancestors)).join(',') + ']';
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).filter(key => record[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(record[key], ancestors)).join(',') + '}';
  } finally {
    ancestors.delete(value);
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function readBudget(raw: unknown): NormalizedBudget {
  let budget: P23PopulationSearchBudget = {};
  if (raw !== undefined) {
    try {
      budget = snapshotPlainData(raw) as P23PopulationSearchBudget;
    } catch {
      throw new Error('p23-population-budget-data-boundary-rejected');
    }
    if (!isPlainRecord(budget)) throw new Error('p23-population-budget-invalid');
    const allowed = new Set([
      'maxCandidates','maxGenerationCalls','maxEvaluationCalls','timeoutMs','maxPayloadBytes',
      'maxArchiveEntries','minimumValidationGain01','seed',
    ]);
    if (Object.keys(budget).some(key => !allowed.has(key))) throw new Error('p23-population-budget-extra-field');
  }
  const integer = (value: unknown, fallback: number, minimum: number, maximum: number, label: string) => {
    const normalized = value === undefined ? fallback : value;
    if (!Number.isSafeInteger(normalized) || Number(normalized) < minimum || Number(normalized) > maximum) {
      throw new Error('p23-population-budget-' + label + '-invalid');
    }
    return Number(normalized);
  };
  const maxCandidatesRequested = integer(
    budget.maxCandidates, DEFAULT_MAX_CANDIDATES, 1, 64, 'max-candidates',
  );
  const maxGenerationRequested = integer(
    budget.maxGenerationCalls, maxCandidatesRequested, 1, 64, 'max-generation-calls',
  );
  const maxEvaluationRequested = integer(
    budget.maxEvaluationCalls, maxCandidatesRequested, 1, 64, 'max-evaluation-calls',
  );
  const maximum = Math.min(
    HARD_MAX_CANDIDATES,
    maxCandidatesRequested,
    maxGenerationRequested,
    maxEvaluationRequested,
  );
  const timeoutMs = integer(budget.timeoutMs, DEFAULT_TIMEOUT_MS, 10, 300_000, 'timeout');
  const maxPayloadBytes = integer(budget.maxPayloadBytes, DEFAULT_MAX_PAYLOAD_BYTES, 256, 256 * 1024, 'payload-bytes');
  const maxArchiveEntries = integer(budget.maxArchiveEntries, 16, 1, 64, 'archive-entries');
  const minimumGain = budget.minimumValidationGain01 === undefined
    ? DEFAULT_MINIMUM_GAIN
    : budget.minimumValidationGain01;
  if (typeof minimumGain !== 'number' || !Number.isFinite(minimumGain) || minimumGain < 0 || minimumGain > 1) {
    throw new Error('p23-population-budget-minimum-gain-invalid');
  }
  return {
    maxCandidates: maximum,
    maxGenerationCalls: maximum,
    maxEvaluationCalls: maximum,
    timeoutMs,
    maxPayloadBytes,
    maxArchiveEntries,
    minimumValidationGain01: minimumGain,
    seed: integer(budget.seed, 17, 0, 0x7fffffff, 'seed'),
  };
}

function bindCapability<T extends (...args: any[]) => any>(
  target: unknown,
  key: string,
): T {
  if (target === null || (typeof target !== 'object' && typeof target !== 'function')) {
    throw new Error('p23-population-host-capability-invalid');
  }
  let cursor: object | null = target as object;
  const seen = new Set<object>();
  try {
    for (let depth = 0; cursor && depth < 32; depth++) {
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const descriptor = Object.getOwnPropertyDescriptor(cursor, key);
      if (descriptor) {
        if (!('value' in descriptor) || typeof descriptor.value !== 'function') {
          throw new Error('p23-population-host-capability-invalid');
        }
        return descriptor.value.bind(target) as T;
      }
      cursor = Object.getPrototypeOf(cursor) as object | null;
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'p23-population-host-capability-invalid') throw error;
    throw new Error('p23-population-host-capability-invalid');
  }
  throw new Error('p23-population-host-capability-invalid');
}

function readInput(raw: P23PopulationSearchInput): FrozenSearchInput {
  if (!isPlainRecord(raw)) throw new Error('p23-population-input-must-be-plain-data');
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const allowed = new Set([
    'sourcePayload','datasetFingerprint','optimizerInstruction','validationEvidence','targets',
    'holdoutPolicy','sourceValidationReports','validationEvaluator','generateCandidate','budget',
  ]);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !allowed.has(key) || !('value' in descriptors[key]!)) {
      throw new Error('p23-population-input-field-rejected');
    }
  }
  const value = (key: string): unknown => descriptors[key]?.value;
  const sourcePayload = snapshotPlainData(value('sourcePayload'));
  const validationEvidence = snapshotPlainData(value('validationEvidence')) as unknown[];
  const targets = snapshotPlainData(value('targets')) as SkillRevisionTarget[];
  const sourceValidationReports = snapshotPlainData(value('sourceValidationReports')) as SkillLearnBenchTrialReport[];
  const datasetFingerprint = value('datasetFingerprint');
  const optimizerInstruction = value('optimizerInstruction');
  const rawPolicy = snapshotPlainData(value('holdoutPolicy'));
  const evaluator = value('validationEvaluator');
  const generator = value('generateCandidate');

  if (!DIGEST.test(String(datasetFingerprint ?? ''))) throw new Error('p23-population-dataset-fingerprint-invalid');
  if (!isSafeText(optimizerInstruction, 24_000)) throw new Error('p23-population-optimizer-instruction-invalid');
  if (!Array.isArray(validationEvidence) || validationEvidence.length === 0 || validationEvidence.length > 4096) {
    throw new Error('p23-population-validation-evidence-invalid');
  }
  if (!Array.isArray(targets) || targets.length === 0 || targets.length > 64) {
    throw new Error('p23-population-targets-required');
  }
  if (!Array.isArray(sourceValidationReports) || sourceValidationReports.length === 0 || sourceValidationReports.length > 4096) {
    throw new Error('p23-population-source-validation-reports-required');
  }
  if (!isPlainRecord(rawPolicy) || rawPolicy.resultsWithheld !== true ||
      rawPolicy.requiresFreshIndependentEvaluation !== true ||
      Object.keys(rawPolicy).some(key => !['resultsWithheld','requiresFreshIndependentEvaluation'].includes(key))) {
    throw new Error('p23-population-holdout-policy-withheld-required');
  }
  const generateCandidate = value('generateCandidate');
  if (typeof generateCandidate !== 'function') throw new Error('p23-population-candidate-generator-required');
  const evaluateValidation = bindCapability<ValidationOnlyCandidateEvaluator['evaluate']>(evaluator, 'evaluate');

  const sourceCanonical = canonical(sourcePayload);
  return {
    sourcePayload,
    sourceCanonical,
    sourceFingerprint: sha256(sourceCanonical),
    datasetFingerprint: String(datasetFingerprint).toLowerCase(),
    optimizerInstruction,
    validationEvidence,
    targets,
    sourceValidationReports,
    holdoutPolicy: {
      resultsWithheld: true,
      requiresFreshIndependentEvaluation: true,
    },
    generateCandidate: generateCandidate as P23PopulationCandidateGenerator,
    evaluateValidation,
    budget: readBudget(value('budget')),
  };
}

function reportIdentityCoverage(reports: readonly SkillLearnBenchTrialReport[]): Map<string, SkillLearnBenchTrialReport> {
  if (!Array.isArray(reports) || reports.length === 0 || reports.length > 4096) {
    throw new Error('p23-population-validation-reports-invalid');
  }
  const mapped = new Map<string, SkillLearnBenchTrialReport>();
  const seenTrials = new Set<string>();
  for (const report of reports) {
    if (!report || !isSafeText(report.taskId, 256) || !isSafeText(report.trialId, 256) ||
        (report.taskFamily !== undefined && !isSafeText(report.taskFamily, 128))) {
      throw new Error('p23-population-validation-report-identity-invalid');
    }
    const key = JSON.stringify([report.taskId, report.trialId]);
    if (mapped.has(key) || seenTrials.has(report.trialId)) {
      throw new Error('p23-population-validation-coverage-duplicate');
    }
    seenTrials.add(report.trialId);
    mapped.set(key, report);
  }
  return mapped;
}

function verifyValidationCoverage(
  baseline: readonly SkillLearnBenchTrialReport[],
  candidate: readonly SkillLearnBenchTrialReport[],
): void {
  const base = reportIdentityCoverage(baseline);
  const next = reportIdentityCoverage(candidate);
  if (base.size !== next.size) throw new Error('p23-population-validation-coverage-mismatch');
  for (const [key, prior] of base) {
    const current = next.get(key);
    if (!current) throw new Error('p23-population-validation-coverage-mismatch');
    if ((prior.taskFamily ?? null) !== (current.taskFamily ?? null)) {
      throw new Error('p23-population-validation-family-mismatch');
    }
  }
}

function macroObjective(reports: readonly SkillLearnBenchTrialReport[]): number {
  const byTask = new Map<string, {
    success: number[];
    skill: number[];
    trajectory: number[];
  }>();
  for (const report of reports) {
    const unit = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    if (!report || !isSafeText(report.taskId, 256) || !isSafeText(report.trialId, 256) ||
        typeof report.taskSuccess?.passed !== 'boolean' ||
        !unit(report.taskSuccess?.passRate) ||
        report.taskSuccess.passRate !== (report.taskSuccess.passed ? 1 : 0) ||
        !unit(report.skillQuality?.aggregate) || !unit(report.trajectoryQuality?.aggregate) ||
        !Number.isSafeInteger(report.skillQuality?.safetyViolationCount) ||
        report.skillQuality.safetyViolationCount < 0) {
      throw new Error('p23-population-source-validation-report-invalid');
    }
    const row = byTask.get(report.taskId) ?? { success: [], skill: [], trajectory: [] };
    row.success.push(report.taskSuccess.passRate);
    row.skill.push(report.skillQuality.aggregate);
    row.trajectory.push(report.trajectoryQuality.aggregate);
    byTask.set(report.taskId, row);
  }
  const taskRows = [...byTask.values()].map(row => ({
    success: row.success.reduce((a,b)=>a+b,0)/row.success.length,
    skill: row.skill.reduce((a,b)=>a+b,0)/row.skill.length,
    trajectory: row.trajectory.reduce((a,b)=>a+b,0)/row.trajectory.length,
  }));
  if (!taskRows.length) throw new Error('p23-population-objective-empty');
  return taskRows.reduce((sum,row)=>sum + .5*row.success + .2*row.skill + .3*row.trajectory,0)/taskRows.length;
}

async function raceWithAbort<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  label: string,
): Promise<T> {
  if (signal.aborted) throw new Error(label);
  let rejectAbort: ((error: Error) => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const listener = () => rejectAbort?.(new Error(label));
  signal.addEventListener('abort', listener, { once: true });
  try {
    return await Promise.race([operation, aborted]);
  } finally {
    signal.removeEventListener('abort', listener);
  }
}

function assertValidationEvaluationShape(raw: unknown): ValidationOnlyCandidateEvaluation {
  if (!isPlainRecord(raw)) throw new Error('p23-population-validation-evaluation-invalid');
  const allowed = new Set([
    'payloadFingerprint','validationManifestFingerprint','validationPlanFingerprint',
    'environmentFingerprint','reports',
  ]);
  if (Object.keys(raw).some(key => !allowed.has(key))) {
    throw new Error('p23-population-validation-evaluation-extra-field');
  }
  const evaluation = raw as unknown as ValidationOnlyCandidateEvaluation;
  if (typeof evaluation.payloadFingerprint !== 'string' ||
      typeof evaluation.validationManifestFingerprint !== 'string' ||
      typeof evaluation.validationPlanFingerprint !== 'string' ||
      typeof evaluation.environmentFingerprint !== 'string' ||
      !Array.isArray(evaluation.reports)) {
    throw new Error('p23-population-validation-evaluation-invalid');
  }
  return evaluation;
}

function emptyDiagnostics(): P23PopulationSearchDiagnostics {
  return {
    generationCalls: 0,
    uniqueCandidates: 0,
    evaluationCalls: 0,
    duplicateCandidates: 0,
    sourceIdenticalCandidates: 0,
    invalidCandidates: 0,
    safetyRejected: 0,
    dominatedCandidates: 0,
    paretoRetained: 0,
    validationOnly: true,
    timedOut: false,
  };
}

function noImprovement(
  archive: P23CandidateParetoArchive,
  diagnostics: P23PopulationSearchDiagnostics,
): P23PopulationSearchResult {
  const retained = archive.snapshot();
  diagnostics.paretoRetained = retained.length;
  return {
    status: 'no-improving-candidate',
    selectedPayload: null,
    selectedCandidateFingerprint: null,
    archive: retained,
    diagnostics: { ...diagnostics },
  };
}

export async function runP23ReflectiveCandidatePopulationSearch(
  rawInput: P23PopulationSearchInput,
): Promise<P23PopulationSearchResult> {
  const input = readInput(rawInput);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error('p23-population-timeout'));
  }, input.budget.timeoutMs);
  const diagnostics = emptyDiagnostics();
  const archive = new P23CandidateParetoArchive({
    maxEntries: input.budget.maxArchiveEntries,
    maxTaskRows: 4096,
  });
  const payloadByFingerprint = new Map<string, unknown>();
  const baselineObjective = macroObjective(input.sourceValidationReports);
  const combinedSignal = controller.signal;
  try {
    const variationCount = input.budget.maxCandidates;
    for (let index = 0; index < variationCount; index++) {
      if (combinedSignal.aborted) throw new Error('p23-population-timeout');
      const template = VARIATIONS[index]!;
      const variation: P23PopulationSearchVariation = {
        ...template,
        index,
        seed: input.budget.seed + index,
      };
      diagnostics.generationCalls++;
      let rawCandidate: unknown;
      try {
        rawCandidate = await raceWithAbort(
          Promise.resolve(input.generateCandidate({
            sourcePayload: snapshotPlainData(input.sourcePayload),
            datasetFingerprint: input.datasetFingerprint,
            optimizerInstruction: input.optimizerInstruction,
            validationEvidence: snapshotPlainData(input.validationEvidence) as unknown[],
            targets: snapshotPlainData(input.targets) as SkillRevisionTarget[],
            holdoutPolicy: input.holdoutPolicy,
            variation,
            signal: combinedSignal,
          })),
          combinedSignal,
          'p23-population-timeout',
        );
      } catch (error) {
        if (combinedSignal.aborted) throw new Error('p23-population-timeout');
        throw error;
      }

      let candidatePayload: unknown;
      try {
        candidatePayload = snapshotPlainData(rawCandidate);
      } catch {
        diagnostics.invalidCandidates++;
        continue;
      }
      let candidateCanonical: string;
      try {
        candidateCanonical = canonical(candidatePayload);
      } catch {
        diagnostics.invalidCandidates++;
        continue;
      }
      if (candidatePayload === null || candidatePayload === undefined ||
          (typeof candidatePayload === 'string' && candidatePayload.trim().length === 0) ||
          new TextEncoder().encode(candidateCanonical).byteLength > input.budget.maxPayloadBytes) {
        diagnostics.invalidCandidates++;
        continue;
      }
      if (candidateCanonical === input.sourceCanonical) {
        diagnostics.sourceIdenticalCandidates++;
        continue;
      }
      const candidateFingerprint = sha256(candidateCanonical);
      if (payloadByFingerprint.has(candidateFingerprint)) {
        diagnostics.duplicateCandidates++;
        continue;
      }
      if (diagnostics.uniqueCandidates >= input.budget.maxEvaluationCalls) {
        diagnostics.invalidCandidates++;
        continue;
      }
      diagnostics.uniqueCandidates++;
      payloadByFingerprint.set(candidateFingerprint, snapshotPlainData(candidatePayload));

      diagnostics.evaluationCalls++;
      const rawEvaluation = await raceWithAbort(
        Promise.resolve(input.evaluateValidation({
          payload: snapshotPlainData(candidatePayload),
          payloadFingerprint: candidateFingerprint,
          signal: combinedSignal,
        })),
        combinedSignal,
        'p23-population-timeout',
      );
      if (combinedSignal.aborted) throw new Error('p23-population-timeout');
      const evaluation = assertValidationEvaluationShape(snapshotPlainData(rawEvaluation));
      if (!evaluation || evaluation.payloadFingerprint !== candidateFingerprint) {
        throw new Error('p23-population-payload-fingerprint-mismatch');
      }
      if (!DIGEST.test(evaluation.validationManifestFingerprint) ||
          !DIGEST.test(evaluation.validationPlanFingerprint) ||
          !DIGEST.test(evaluation.environmentFingerprint)) {
        throw new Error('p23-population-validation-context-fingerprint-invalid');
      }
      verifyValidationCoverage(input.sourceValidationReports, evaluation.reports);
      const admitted = archive.add({
        split: 'validation',
        candidateFingerprint,
        sourceFingerprint: input.sourceFingerprint,
        variationId: variation.id,
        seed: variation.seed,
        validationManifestFingerprint: evaluation.validationManifestFingerprint,
        validationPlanFingerprint: evaluation.validationPlanFingerprint,
        reports: evaluation.reports,
      });
      if (admitted.status === 'safety-rejected') diagnostics.safetyRejected++;
      else if (admitted.status === 'dominated') diagnostics.dominatedCandidates++;
    }
    if (combinedSignal.aborted) throw new Error('p23-population-timeout');
    const winner = archive.winner();
    if (!winner) return noImprovement(archive, diagnostics);
    const winnerObjective = macroObjective(
      input.sourceValidationReports.map(report => report),
    );
    const selectedObjective = .5 * winner.objectives.taskSuccess01 +
      .2 * winner.objectives.skillQuality01 +
      .3 * winner.objectives.trajectoryQuality01;
    if (selectedObjective <= winnerObjective + input.budget.minimumValidationGain01) {
      return noImprovement(archive, diagnostics);
    }
    const selectedPayload = payloadByFingerprint.get(winner.candidateFingerprint);
    if (selectedPayload === undefined) throw new Error('p23-population-selected-payload-missing');
    diagnostics.paretoRetained = archive.snapshot().length;
    return {
      status: 'selected',
      selectedPayload: snapshotPlainData(selectedPayload),
      selectedCandidateFingerprint: winner.candidateFingerprint,
      archive: archive.snapshot(),
      diagnostics: { ...diagnostics },
    };
  } finally {
    clearTimeout(timer);
  }
}
