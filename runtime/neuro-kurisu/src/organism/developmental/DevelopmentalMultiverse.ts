import { createHash } from 'node:crypto';
import type { P55Fork, P55Knob, P55State } from './P55DevelopmentalForkUniverse.ts';
import { snapshotPlainData } from '../learning/LearningTrustBoundary.ts';

/**
 * Developmental Multiverse — bounded, data-only parallel development trials.
 *
 * This is an off-cycle experiment coordinator, not a second organism runtime.
 * It clones only a five-number behavioural policy profile, never memories,
 * conversations, identity records, secrets, executable code, or live state.
 * All arms share the same source/environment fingerprint and paired scenarios.
 * Validation selects at most one finalist; untouched holdout scenarios are then
 * run only against baseline + finalist. A passing result is a review artifact,
 * never an automatic mutation of the live policy.
 */

export const DEVELOPMENTAL_MULTIVERSE_VERSION = 1 as const;
export const DEVELOPMENTAL_MULTIVERSE_KNOBS = [
  'exploration', 'verification', 'reflection', 'attention', 'prediction',
] as const satisfies readonly P55Knob[];

const MAX_VARIANTS = 7;
const MAX_SCENARIOS_PER_SPLIT = 32;
const MIN_VALIDATION_SEEDS = 3;
const MIN_HOLDOUT_SEEDS = 5;
const MAX_OBSERVATIONS = (MAX_VARIANTS + 1) * (MAX_SCENARIOS_PER_SPLIT * 2);
const KNOB_SET = new Set<string>(DEVELOPMENTAL_MULTIVERSE_KNOBS);
const T95_BY_N: Record<number, number> = {
  5: 2.776, 6: 2.571, 7: 2.447, 8: 2.365, 9: 2.306, 10: 2.262,
  11: 2.228, 12: 2.201, 13: 2.179, 14: 2.160, 15: 2.145,
  16: 2.131, 17: 2.120, 18: 2.110, 19: 2.101, 20: 2.093,
};

export type DevelopmentalMultiversePhase = 'validation' | 'holdout';
export type DevelopmentalMultiverseState = 'validating' | 'holding-out' | 'completed' | 'rejected';
export type DevelopmentalMultiverseDecision = 'eligible-for-independent-review' | 'rejected';

export type DevelopmentalPolicyProfile = Record<P55Knob, number>;
export interface DevelopmentalScenarioSeed { id: string; seed: number; }
export interface DevelopmentalMultiverseVariantInput {
  id: string;
  label: string;
  deltas: Partial<Record<P55Knob, number>>;
}
export interface DevelopmentalMultiverseSessionInput {
  runId: string;
  createdAt: number;
  sourceRevision: string;
  environmentFingerprint: string;
  baselineProfile: DevelopmentalPolicyProfile;
  validationScenarios: DevelopmentalScenarioSeed[];
  holdoutScenarios: DevelopmentalScenarioSeed[];
  variants: DevelopmentalMultiverseVariantInput[];
}

export interface DevelopmentalMultiverseWorkItem {
  workItemId: string;
  runId: string;
  phase: DevelopmentalMultiversePhase;
  variantId: string;
  scenarioId: string;
  seed: number;
  sourceRevision: string;
  environmentFingerprint: string;
  initialStateFingerprint: string;
  pairFingerprint: string;
  policyFingerprint: string;
  /** Only the explicitly whitelisted behavioural policy knobs are exposed. */
  policyProfile: DevelopmentalPolicyProfile;
}

export interface DevelopmentalMultiverseMetrics {
  quality01: number;
  /** Normalized cost: lower is better. */
  cost01: number;
  safety01: number;
  stability01: number;
}

export interface DevelopmentalMultiverseVerifiedEvidence {
  evaluator: 'p23-independent-skill-candidate-evaluator';
  evaluationFingerprint: string;
  planFingerprint: string;
  manifestFingerprint: string;
  validationPlanFingerprint: string;
  holdoutPlanFingerprint: string;
  method: string;
  verifierId: string;
  runId: string;
  plannedRunId: string;
  /** Fingerprint of the canonical P23 outcome ledger immediately after this arm commit. */
  outcomeLedgerFingerprint: string;
  /** Accepted canonical outcome rows present in that ledger snapshot. */
  outcomeCount: number;
}

export interface DevelopmentalMultiverseObservationInput extends DevelopmentalMultiverseWorkItem {
  measurementId: string;
  metrics: DevelopmentalMultiverseMetrics;
  safetyViolationCount: number;
  /** Present only when accepted through the P23 independently verified runner. */
  verifiedEvidence?: DevelopmentalMultiverseVerifiedEvidence;
}

export interface DevelopmentalMultiverseObservation {
  measurementId: string;
  runId: string;
  workItemId: string;
  sourceRevision: string;
  policyProfile: DevelopmentalPolicyProfile;
  phase: DevelopmentalMultiversePhase;
  variantId: string;
  scenarioId: string;
  seed: number;
  environmentFingerprint: string;
  initialStateFingerprint: string;
  pairFingerprint: string;
  policyFingerprint: string;
  metrics: DevelopmentalMultiverseMetrics;
  safetyViolationCount: number;
  verifiedEvidence?: DevelopmentalMultiverseVerifiedEvidence;
}

export interface DevelopmentalMultiverseComparison {
  variantId: string;
  /** Number of independent seed clusters used as the statistical sample size. */
  pairedN: number;
  /** Number of matched scenario × seed cells contributing to the seed clusters. */
  matchedScenarioSeedPairs: number;
  qualityDelta01: number;
  costDelta01: number;
  safetyDelta01: number;
  stabilityDelta01: number;
  utilityDelta01: number;
  utilityCi95: [number, number] | null;
  safetyViolationCount: number;
  eligible: boolean;
  reasons: string[];
}

export interface DevelopmentalMultiverseSelection {
  selectedVariantId: string | null;
  comparisons: DevelopmentalMultiverseComparison[];
  reasons: string[];
}

export interface DevelopmentalMultiverseFinalResult {
  runId: string;
  status: DevelopmentalMultiverseDecision;
  selectedVariantId: string | null;
  comparison: DevelopmentalMultiverseComparison | null;
  automaticPromotion: false;
  requiresIndependentVerification: true;
  reasons: string[];
  /** The candidate profile is an inert review artifact, never written to live state. */
  proposedPolicyProfile?: DevelopmentalPolicyProfile;
  evidence: {
    sourceRevision: string;
    environmentFingerprint: string;
    initialStateFingerprint: string;
    holdoutPairCount: number;
    holdoutSeedCount: number;
    comparedArms: ['baseline', string] | null;
    verifiedObservationCount: number;
    verifiedPlanCount: number;
    verifiedEvidenceFingerprint: string | null;
  };
}

export interface DevelopmentalMultiverseSnapshot {
  version: typeof DEVELOPMENTAL_MULTIVERSE_VERSION;
  status: DevelopmentalMultiverseState;
  session: DevelopmentalMultiverseSessionInput;
  initialStateFingerprint: string;
  validationObservations: DevelopmentalMultiverseObservation[];
  holdoutObservations: DevelopmentalMultiverseObservation[];
  selectedVariantId: string | null;
  selection: DevelopmentalMultiverseSelection | null;
  finalResult: DevelopmentalMultiverseFinalResult | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function boundedEvidenceIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 &&
    /^[A-Za-z0-9._:-]+$/.test(value);
}

function boundedId(value: unknown, label: string, max = 96): string {
  if (typeof value !== 'string') throw new TypeError(`developmental-multiverse-${label}-invalid`);
  const normalized = value.normalize('NFKC').trim();
  if (!normalized || normalized.length > max || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new TypeError(`developmental-multiverse-${label}-invalid`);
  }
  return normalized;
}

function finiteUnit(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`developmental-multiverse-${label}-out-of-range`);
  }
  return value;
}

function stableJson(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item !== null && typeof item === 'object') {
      if (!isRecord(item)) throw new TypeError('developmental-multiverse-data-must-be-plain');
      return Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])]));
    }
    if (typeof item === 'number' && !Number.isFinite(item)) {
      throw new TypeError('developmental-multiverse-non-finite-number');
    }
    if (typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint' || item === undefined) {
      throw new TypeError('developmental-multiverse-non-serializable-value');
    }
    return item;
  };
  return JSON.stringify(canonical(value));
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function normalizeProfile(value: unknown): DevelopmentalPolicyProfile {
  if (!isRecord(value)) throw new TypeError('developmental-multiverse-baseline-profile-invalid');
  const keys = Object.keys(value);
  if (keys.length !== DEVELOPMENTAL_MULTIVERSE_KNOBS.length || keys.some(key => !KNOB_SET.has(key))) {
    throw new TypeError('developmental-multiverse-profile-keys-invalid');
  }
  return Object.fromEntries(DEVELOPMENTAL_MULTIVERSE_KNOBS.map(key => [key, finiteUnit(value[key], `profile-${key}`)])) as DevelopmentalPolicyProfile;
}

function normalizeScenarios(value: unknown, phase: DevelopmentalMultiversePhase): DevelopmentalScenarioSeed[] {
  const minimumSeeds = phase === 'validation' ? MIN_VALIDATION_SEEDS : MIN_HOLDOUT_SEEDS;
  if (!Array.isArray(value) || value.length < minimumSeeds || value.length > MAX_SCENARIOS_PER_SPLIT) {
    throw new RangeError(`developmental-multiverse-${phase}-scenario-count-invalid`);
  }
  const rows = value.map((raw, index): DevelopmentalScenarioSeed => {
    if (!isRecord(raw)) throw new TypeError(`developmental-multiverse-${phase}-scenario-${index}-invalid`);
    const id = boundedId(raw.id, `${phase}-scenario-id`);
    if (!Number.isSafeInteger(raw.seed) || (raw.seed as number) < 0 || (raw.seed as number) > 0xffffffff) {
      throw new RangeError(`developmental-multiverse-${phase}-seed-invalid`);
    }
    return { id, seed: raw.seed as number };
  });
  const seeds = [...new Set(rows.map(row => row.seed))].sort((a, b) => a - b);
  if (seeds.length < minimumSeeds) {
    throw new RangeError(`developmental-multiverse-${phase}-seed-diversity-invalid`);
  }
  const expectedSeedSet = seeds.join(',');
  const scenarioSeeds = new Map<string, Set<number>>();
  for (const row of rows) {
    const values = scenarioSeeds.get(row.id) ?? new Set<number>();
    if (values.has(row.seed)) throw new Error(`developmental-multiverse-${phase}-scenario-duplicate`);
    values.add(row.seed);
    scenarioSeeds.set(row.id, values);
  }
  if ([...scenarioSeeds.values()].some(values =>
    values.size !== seeds.length || [...values].sort((a, b) => a - b).join(',') !== expectedSeedSet)) {
    throw new Error(`developmental-multiverse-${phase}-scenario-seed-matrix-incomplete`);
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id) || a.seed - b.seed);
}

function normalizeVariants(value: unknown, baseline: DevelopmentalPolicyProfile): DevelopmentalMultiverseVariantInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_VARIANTS) {
    throw new RangeError('developmental-multiverse-variant-count-invalid');
  }
  const seen = new Set<string>(['baseline']);
  return value.map((raw, index) => {
    if (!isRecord(raw) || !isRecord(raw.deltas)) throw new TypeError(`developmental-multiverse-variant-${index}-invalid`);
    const id = boundedId(raw.id, 'variant-id');
    if (seen.has(id)) throw new Error('developmental-multiverse-variant-id-duplicate');
    seen.add(id);
    if (typeof raw.label !== 'string' || !raw.label.trim() || raw.label.length > 80 || /[\u0000-\u001f\u007f]/.test(raw.label)) {
      throw new TypeError('developmental-multiverse-variant-label-invalid');
    }
    const deltaKeys = Object.keys(raw.deltas);
    if (!deltaKeys.length || deltaKeys.some(key => !KNOB_SET.has(key))) {
      throw new TypeError('developmental-multiverse-delta-keys-invalid');
    }
    const deltas: Partial<Record<P55Knob, number>> = {};
    for (const key of deltaKeys as P55Knob[]) {
      const delta = raw.deltas[key];
      if (typeof delta !== 'number' || !Number.isFinite(delta) || delta < -0.15 || delta > 0.15) {
        throw new RangeError(`developmental-multiverse-delta-${key}-out-of-range`);
      }
      // The profile is clamped at the policy boundary, not allowed to escape [0,1].
      deltas[key] = delta;
      finiteUnit(Math.max(0, Math.min(1, baseline[key] + delta)), `candidate-${key}`);
    }
    return { id, label: raw.label.trim(), deltas };
  });
}

function normalizeSession(input: DevelopmentalMultiverseSessionInput): DevelopmentalMultiverseSessionInput {
  let detached: unknown;
  try { detached = snapshotPlainData(input); }
  catch { throw new TypeError('developmental-multiverse-session-data-invalid'); }
  if (!isRecord(detached)) throw new TypeError('developmental-multiverse-session-invalid');
  input = detached as unknown as DevelopmentalMultiverseSessionInput;
  const runId = boundedId(input.runId, 'run-id');
  if (!Number.isSafeInteger(input.createdAt) || input.createdAt < 0) throw new RangeError('developmental-multiverse-created-at-invalid');
  if (typeof input.sourceRevision !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(input.sourceRevision)) {
    throw new TypeError('developmental-multiverse-source-revision-invalid');
  }
  if (typeof input.environmentFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(input.environmentFingerprint)) {
    throw new TypeError('developmental-multiverse-environment-fingerprint-invalid');
  }
  const baselineProfile = normalizeProfile(input.baselineProfile);
  const validationScenarios = normalizeScenarios(input.validationScenarios, 'validation');
  const holdoutScenarios = normalizeScenarios(input.holdoutScenarios, 'holdout');
  const validationScenarioIds = new Set(validationScenarios.map(item => item.id));
  if (holdoutScenarios.some(item => validationScenarioIds.has(item.id))) {
    throw new Error('developmental-multiverse-holdout-overlaps-validation');
  }
  const validationSeeds = new Set(validationScenarios.map(item => item.seed));
  if (holdoutScenarios.some(item => validationSeeds.has(item.seed))) {
    throw new Error('developmental-multiverse-holdout-seeds-overlap-validation');
  }
  const variants = normalizeVariants(input.variants, baselineProfile);
  return {
    runId,
    createdAt: input.createdAt,
    sourceRevision: input.sourceRevision.toLowerCase(),
    environmentFingerprint: input.environmentFingerprint.toLowerCase(),
    baselineProfile,
    validationScenarios,
    holdoutScenarios,
    variants,
  };
}

function effectiveProfile(baseline: DevelopmentalPolicyProfile, variant: DevelopmentalMultiverseVariantInput | null): DevelopmentalPolicyProfile {
  return Object.fromEntries(DEVELOPMENTAL_MULTIVERSE_KNOBS.map(key => [
    key,
    Math.max(0, Math.min(1, baseline[key] + (variant?.deltas[key] ?? 0))),
  ])) as DevelopmentalPolicyProfile;
}

function observationKey(value: Pick<DevelopmentalMultiverseWorkItem, 'variantId' | 'scenarioId' | 'seed'>): string {
  return `${value.variantId}\u0000${value.scenarioId}\u0000${value.seed}`;
}
function pairKey(value: Pick<DevelopmentalMultiverseWorkItem, 'scenarioId' | 'seed'>): string {
  return `${value.scenarioId}\u0000${value.seed}`;
}

function normalizeMetrics(value: unknown): DevelopmentalMultiverseMetrics {
  if (!isRecord(value)) throw new TypeError('developmental-multiverse-metrics-invalid');
  return {
    quality01: finiteUnit(value.quality01, 'quality'),
    cost01: finiteUnit(value.cost01, 'cost'),
    safety01: finiteUnit(value.safety01, 'safety'),
    stability01: finiteUnit(value.stability01, 'stability'),
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function tCritical95(n: number): number {
  if (n < MIN_HOLDOUT_SEEDS) return 0;
  return T95_BY_N[n] ?? 2.093; // Conservative for n >= 20.
}

function utility(metrics: DevelopmentalMultiverseMetrics): number {
  return metrics.quality01 * 0.45 + metrics.safety01 * 0.25 + metrics.stability01 * 0.2 + (1 - metrics.cost01) * 0.1;
}

function pairedComparison(
  variantId: string,
  baseline: DevelopmentalMultiverseObservation[],
  candidate: DevelopmentalMultiverseObservation[],
  requireConfidence: boolean,
): DevelopmentalMultiverseComparison {
  const baselineByPair = new Map(baseline.map(item => [pairKey(item), item]));
  const candidateByPair = new Map(candidate.map(item => [pairKey(item), item]));
  const pairs = [...candidateByPair.entries()]
    .filter(([key]) => baselineByPair.has(key))
    .map(([key, item]) => ({ candidate: item, baseline: baselineByPair.get(key)! }));

  // Scenario rows sharing the same seed are correlated observations. Collapse
  // them first so the statistical N is the number of independent seeds, not
  // the number of scenario × seed cells.
  const pairsBySeed = new Map<number, typeof pairs>();
  for (const pair of pairs) {
    const rows = pairsBySeed.get(pair.candidate.seed) ?? [];
    rows.push(pair);
    pairsBySeed.set(pair.candidate.seed, rows);
  }
  const seedClusters = [...pairsBySeed.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seed, rows]) => ({
      seed,
      quality: mean(rows.map(pair => pair.candidate.metrics.quality01 - pair.baseline.metrics.quality01)),
      cost: mean(rows.map(pair => pair.candidate.metrics.cost01 - pair.baseline.metrics.cost01)),
      safety: mean(rows.map(pair => pair.candidate.metrics.safety01 - pair.baseline.metrics.safety01)),
      stability: mean(rows.map(pair => pair.candidate.metrics.stability01 - pair.baseline.metrics.stability01)),
      utility: mean(rows.map(pair => utility(pair.candidate.metrics) - utility(pair.baseline.metrics))),
    }));
  const quality = seedClusters.map(cluster => cluster.quality);
  const cost = seedClusters.map(cluster => cluster.cost);
  const safety = seedClusters.map(cluster => cluster.safety);
  const stability = seedClusters.map(cluster => cluster.stability);
  const utilityDeltas = seedClusters.map(cluster => cluster.utility);
  const independentSeedCount = seedClusters.length;
  const utilityDelta01 = mean(utilityDeltas);
  let utilityCi95: [number, number] | null = null;
  if (requireConfidence && independentSeedCount >= MIN_HOLDOUT_SEEDS) {
    const variance = utilityDeltas.reduce((sum, value) => sum + ((value - utilityDelta01) ** 2), 0) /
      Math.max(1, independentSeedCount - 1);
    const margin = tCritical95(independentSeedCount) * Math.sqrt(variance / independentSeedCount);
    utilityCi95 = [utilityDelta01 - margin, utilityDelta01 + margin];
  }
  const safetyViolationCount = candidate.reduce((sum, item) => sum + item.safetyViolationCount, 0);
  const reasons: string[] = [];
  if (independentSeedCount < (requireConfidence ? MIN_HOLDOUT_SEEDS : MIN_VALIDATION_SEEDS)) {
    reasons.push('insufficient-independent-seeds');
  }
  if (quality.length && mean(quality) < -0.01) reasons.push('quality-regression');
  if (safety.length && mean(safety) < 0) reasons.push('safety-regression');
  if (stability.length && mean(stability) < -0.02) reasons.push('stability-regression');
  if (cost.length && mean(cost) > 0.03) reasons.push('cost-regression');
  if (safetyViolationCount > 0) reasons.push('candidate-safety-violations');
  if (utilityDelta01 < (requireConfidence ? 0 : 0.01)) reasons.push('utility-gain-below-threshold');
  if (requireConfidence && (!utilityCi95 || utilityCi95[0] <= 0)) reasons.push('holdout-confidence-lower-bound-not-positive');
  return {
    variantId,
    pairedN: independentSeedCount,
    matchedScenarioSeedPairs: pairs.length,
    qualityDelta01: mean(quality),
    costDelta01: mean(cost),
    safetyDelta01: mean(safety),
    stabilityDelta01: mean(stability),
    utilityDelta01,
    utilityCi95,
    safetyViolationCount,
    eligible: reasons.length === 0,
    reasons,
  };
}

function ensureObservationsComplete(
  expected: DevelopmentalMultiverseWorkItem[],
  observed: DevelopmentalMultiverseObservation[],
  label: string,
): void {
  if (observed.length !== expected.length) throw new Error(`developmental-multiverse-${label}-incomplete`);
  const seen = new Set(observed.map(observationKey));
  if (seen.size !== expected.length || expected.some(item => !seen.has(observationKey(item)))) {
    throw new Error(`developmental-multiverse-${label}-pairing-incomplete`);
  }
}

export class DevelopmentalMultiverse {
  private state: DevelopmentalMultiverseSnapshot | null = null;

  createSession(input: DevelopmentalMultiverseSessionInput): {
    runId: string;
    variantCount: number;
    validationPairCount: number;
    holdoutPairCount: number;
    initialStateFingerprint: string;
  } {
    if (this.state && !['completed', 'rejected'].includes(this.state.status)) {
      throw new Error('developmental-multiverse-session-already-active');
    }
    const session = normalizeSession(input);
    const initialStateFingerprint = digest({
      sourceRevision: session.sourceRevision,
      environmentFingerprint: session.environmentFingerprint,
      baselineProfile: session.baselineProfile,
    });
    this.state = {
      version: DEVELOPMENTAL_MULTIVERSE_VERSION,
      status: 'validating',
      session,
      initialStateFingerprint,
      validationObservations: [],
      holdoutObservations: [],
      selectedVariantId: null,
      selection: null,
      finalResult: null,
    };
    return {
      runId: session.runId,
      variantCount: session.variants.length + 1,
      validationPairCount: session.validationScenarios.length,
      holdoutPairCount: session.holdoutScenarios.length,
      initialStateFingerprint,
    };
  }

  validationWorkPlan(): DevelopmentalMultiverseWorkItem[] {
    const state = this.requireState();
    if (state.status !== 'validating') throw new Error('developmental-multiverse-not-validating');
    return this.buildWorkPlan('validation', [null, ...state.session.variants]);
  }

  holdoutWorkPlan(): DevelopmentalMultiverseWorkItem[] {
    const state = this.requireState();
    if (state.status !== 'holding-out' || !state.selectedVariantId) {
      throw new Error('developmental-multiverse-no-holdout-finalist');
    }
    const winner = state.session.variants.find(variant => variant.id === state.selectedVariantId);
    if (!winner) throw new Error('developmental-multiverse-selected-variant-missing');
    return this.buildWorkPlan('holdout', [null, winner]);
  }

  recordValidationObservation(input: DevelopmentalMultiverseObservationInput): DevelopmentalMultiverseObservation {
    return this.recordObservation('validation', input);
  }

  /** Atomically admits a complete independently evaluated arm batch. */
  recordValidationObservations(inputs: DevelopmentalMultiverseObservationInput[]): DevelopmentalMultiverseObservation[] {
    return this.recordObservationBatch('validation', inputs);
  }

  recordHoldoutObservation(input: DevelopmentalMultiverseObservationInput): DevelopmentalMultiverseObservation {
    return this.recordObservation('holdout', input);
  }

  /** Atomically admits baseline + finalist holdout measurements. */
  recordHoldoutObservations(inputs: DevelopmentalMultiverseObservationInput[]): DevelopmentalMultiverseObservation[] {
    return this.recordObservationBatch('holdout', inputs);
  }

  private recordObservationBatch(
    phase: DevelopmentalMultiversePhase,
    inputs: DevelopmentalMultiverseObservationInput[],
  ): DevelopmentalMultiverseObservation[] {
    let detached: unknown;
    try { detached = snapshotPlainData(inputs); }
    catch { throw new TypeError('developmental-multiverse-observation-batch-data-invalid'); }
    if (!Array.isArray(detached)) throw new TypeError('developmental-multiverse-observation-batch-invalid');
    inputs = detached as DevelopmentalMultiverseObservationInput[];
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new Error('developmental-multiverse-observation-batch-empty');
    }
    const current = this.snapshot();
    if (!current) throw new Error('developmental-multiverse-session-not-created');
    const staged = new DevelopmentalMultiverse();
    staged.restore(current);
    const rows = inputs.map(input => staged.recordObservation(phase, input));
    this.state = staged.state;
    return rows.map(row => structuredClone(row));
  }

  selectValidationFinalist(): DevelopmentalMultiverseSelection {
    const state = this.requireState();
    if (state.status === 'holding-out' || state.status === 'completed') {
      if (!state.selection) throw new Error('developmental-multiverse-selection-missing');
      return structuredClone(state.selection);
    }
    if (state.status !== 'validating') throw new Error('developmental-multiverse-not-validating');
    const plan = this.validationWorkPlan();
    ensureObservationsComplete(plan, state.validationObservations, 'validation');
    const baseline = state.validationObservations.filter(item => item.variantId === 'baseline');
    const comparisons = state.session.variants.map(variant => pairedComparison(
      variant.id,
      baseline,
      state.validationObservations.filter(item => item.variantId === variant.id),
      false,
    )).sort((left, right) => right.utilityDelta01 - left.utilityDelta01 || left.variantId.localeCompare(right.variantId));
    const winner = comparisons.find(item => item.eligible) ?? null;
    const selection: DevelopmentalMultiverseSelection = {
      selectedVariantId: winner?.variantId ?? null,
      comparisons,
      reasons: winner ? [] : ['no-validation-candidate-passed'],
    };
    state.selection = selection;
    state.selectedVariantId = winner?.variantId ?? null;
    state.status = winner ? 'holding-out' : 'rejected';
    if (!winner) state.finalResult = this.makeFinalResult(null, null, ['no-validation-candidate-passed']);
    return structuredClone(selection);
  }

  finalize(): DevelopmentalMultiverseFinalResult {
    const state = this.requireState();
    if (state.status === 'completed' || state.status === 'rejected') {
      if (!state.finalResult) throw new Error('developmental-multiverse-final-result-missing');
      return structuredClone(state.finalResult);
    }
    if (state.status !== 'holding-out' || !state.selectedVariantId) {
      throw new Error('developmental-multiverse-holdout-not-ready');
    }
    const plan = this.holdoutWorkPlan();
    ensureObservationsComplete(plan, state.holdoutObservations, 'holdout');
    const baseline = state.holdoutObservations.filter(item => item.variantId === 'baseline');
    const candidate = state.holdoutObservations.filter(item => item.variantId === state.selectedVariantId);
    const comparison = pairedComparison(state.selectedVariantId, baseline, candidate, true);
    const status: DevelopmentalMultiverseDecision = comparison.eligible
      ? 'eligible-for-independent-review'
      : 'rejected';
    const reasons = comparison.reasons;
    state.finalResult = this.makeFinalResult(state.selectedVariantId, comparison, reasons, status);
    state.status = 'completed';
    return structuredClone(state.finalResult);
  }

  snapshot(): DevelopmentalMultiverseSnapshot | null {
    return this.state ? structuredClone(this.state) : null;
  }

  /**
   * Restore by replaying bounded observations through the same admission path.
   * Decision fields in the supplied snapshot are never trusted; they are rebuilt.
   */
  restore(raw: unknown): void {
    if (raw === null || raw === undefined) { this.state = null; return; }
    let detached: unknown;
    try { detached = snapshotPlainData(raw); }
    catch { throw new TypeError('developmental-multiverse-snapshot-data-invalid'); }
    raw = detached;
    if (!isRecord(raw) || raw.version !== DEVELOPMENTAL_MULTIVERSE_VERSION ||
        !isRecord(raw.session) || !Array.isArray(raw.validationObservations) || !Array.isArray(raw.holdoutObservations) ||
        raw.validationObservations.length > MAX_OBSERVATIONS || raw.holdoutObservations.length > MAX_OBSERVATIONS) {
      throw new TypeError('developmental-multiverse-snapshot-invalid');
    }
    const suppliedStatus = raw.status;
    if (!['validating', 'holding-out', 'completed', 'rejected'].includes(String(suppliedStatus))) {
      throw new TypeError('developmental-multiverse-snapshot-status-invalid');
    }
    const suppliedInitialStateFingerprint = raw.initialStateFingerprint;
    const suppliedSelected = raw.selectedVariantId;
    const suppliedFinal = raw.finalResult;
    const validation = structuredClone(raw.validationObservations) as DevelopmentalMultiverseObservationInput[];
    const holdout = structuredClone(raw.holdoutObservations) as DevelopmentalMultiverseObservationInput[];
    this.createSession(raw.session as unknown as DevelopmentalMultiverseSessionInput);
    if (this.requireState().initialStateFingerprint !== suppliedInitialStateFingerprint) {
      throw new Error('developmental-multiverse-snapshot-initial-state-mismatch');
    }
    for (const item of validation) this.recordValidationObservation(item);
    if (suppliedStatus === 'validating') {
      if (suppliedSelected !== null || holdout.length) throw new Error('developmental-multiverse-snapshot-state-mismatch');
      return;
    }
    const selection = this.selectValidationFinalist();
    if (selection.selectedVariantId !== (typeof suppliedSelected === 'string' ? suppliedSelected : null)) {
      throw new Error('developmental-multiverse-snapshot-selection-mismatch');
    }
    if (this.requireState().status === 'rejected') {
      if (holdout.length || suppliedStatus !== 'rejected') throw new Error('developmental-multiverse-snapshot-state-mismatch');
      if (stableJson(this.requireState().finalResult) !== stableJson(suppliedFinal)) throw new Error('developmental-multiverse-snapshot-result-mismatch');
      return;
    }
    for (const item of holdout) this.recordHoldoutObservation(item);
    if (suppliedStatus === 'completed') {
      const rebuilt = this.finalize();
      if (stableJson(rebuilt) !== stableJson(suppliedFinal)) throw new Error('developmental-multiverse-snapshot-result-mismatch');
    } else if (suppliedStatus !== 'holding-out') {
      throw new Error('developmental-multiverse-snapshot-state-mismatch');
    }
  }

  private buildWorkPlan(phase: DevelopmentalMultiversePhase, arms: Array<DevelopmentalMultiverseVariantInput | null>): DevelopmentalMultiverseWorkItem[] {
    const state = this.requireState();
    const scenarios = phase === 'validation' ? state.session.validationScenarios : state.session.holdoutScenarios;
    const plan: DevelopmentalMultiverseWorkItem[] = [];
    for (const scenario of scenarios) {
      const pairFingerprint = digest({
        runId: state.session.runId,
        phase,
        scenarioId: scenario.id,
        seed: scenario.seed,
        sourceRevision: state.session.sourceRevision,
        environmentFingerprint: state.session.environmentFingerprint,
        initialStateFingerprint: state.initialStateFingerprint,
      });
      for (const variant of arms) {
        const variantId = variant?.id ?? 'baseline';
        const policyProfile = effectiveProfile(state.session.baselineProfile, variant);
        const policyFingerprint = digest(policyProfile);
        plan.push({
          workItemId: digest({ pairFingerprint, variantId, policyFingerprint }),
          runId: state.session.runId,
          phase,
          variantId,
          scenarioId: scenario.id,
          seed: scenario.seed,
          sourceRevision: state.session.sourceRevision,
          environmentFingerprint: state.session.environmentFingerprint,
          initialStateFingerprint: state.initialStateFingerprint,
          pairFingerprint,
          policyFingerprint,
          policyProfile,
        });
      }
    }
    return plan;
  }

  private recordObservation(phase: DevelopmentalMultiversePhase, raw: DevelopmentalMultiverseObservationInput): DevelopmentalMultiverseObservation {
    const state = this.requireState();
    const expectedStatus = phase === 'validation' ? 'validating' : 'holding-out';
    if (state.status !== expectedStatus) throw new Error(`developmental-multiverse-session-not-accepting-${phase}`);
    let detached: unknown;
    try { detached = snapshotPlainData(raw); }
    catch { throw new TypeError('developmental-multiverse-observation-data-invalid'); }
    if (!isRecord(detached)) throw new TypeError('developmental-multiverse-observation-invalid');
    raw = detached as unknown as DevelopmentalMultiverseObservationInput;
    const measurementId = boundedId(raw.measurementId, 'measurement-id', 160);
    const expectedPlan = phase === 'validation' ? this.buildWorkPlan('validation', [null, ...state.session.variants]) : this.holdoutWorkPlan();
    const expected = expectedPlan.find(item => observationKey(item) === observationKey(raw as DevelopmentalMultiverseWorkItem));
    if (!expected) throw new Error('developmental-multiverse-work-item-not-planned');
    const bindingsMatch = raw.runId === expected.runId && raw.phase === expected.phase &&
      raw.sourceRevision === expected.sourceRevision && raw.environmentFingerprint === expected.environmentFingerprint &&
      raw.initialStateFingerprint === expected.initialStateFingerprint && raw.pairFingerprint === expected.pairFingerprint &&
      raw.policyFingerprint === expected.policyFingerprint && raw.workItemId === expected.workItemId &&
      stableJson(raw.policyProfile) === stableJson(expected.policyProfile);
    if (!bindingsMatch) throw new Error('developmental-multiverse-observation-binding-mismatch');
    const existing = [...state.validationObservations, ...state.holdoutObservations];
    if (existing.some(item => item.measurementId === measurementId)) throw new Error('developmental-multiverse-measurement-id-duplicate');
    const safetyViolationCount = raw.safetyViolationCount;
    if (!Number.isSafeInteger(safetyViolationCount) || (safetyViolationCount as number) < 0 || (safetyViolationCount as number) > 10_000) {
      throw new RangeError('developmental-multiverse-safety-violation-count-invalid');
    }
    let verifiedEvidence: DevelopmentalMultiverseVerifiedEvidence | undefined;
    if (raw.verifiedEvidence !== undefined) {
      const evidence = raw.verifiedEvidence;
      if (!isRecord(evidence) || evidence.evaluator !== 'p23-independent-skill-candidate-evaluator' ||
          !/^[a-f0-9]{64}$/i.test(String(evidence.evaluationFingerprint)) ||
          !/^[a-f0-9]{64}$/i.test(String(evidence.planFingerprint)) ||
          !/^[a-f0-9]{64}$/i.test(String(evidence.manifestFingerprint)) ||
          !/^[a-f0-9]{64}$/i.test(String(evidence.validationPlanFingerprint)) ||
          !/^[a-f0-9]{64}$/i.test(String(evidence.holdoutPlanFingerprint)) ||
          !/^[a-f0-9]{64}$/i.test(String(evidence.outcomeLedgerFingerprint)) ||
          !Number.isSafeInteger(evidence.outcomeCount) || (evidence.outcomeCount as number) < 1 ||
          !boundedEvidenceIdentity(evidence.method) || !boundedEvidenceIdentity(evidence.verifierId) ||
          !boundedEvidenceIdentity(evidence.runId) || !boundedEvidenceIdentity(evidence.plannedRunId) ||
          evidence.runId !== evidence.plannedRunId) {
        throw new Error('developmental-multiverse-verified-evidence-invalid');
      }
      verifiedEvidence = {
        evaluator: 'p23-independent-skill-candidate-evaluator',
        evaluationFingerprint: String(evidence.evaluationFingerprint).toLowerCase(),
        planFingerprint: String(evidence.planFingerprint).toLowerCase(),
        manifestFingerprint: String(evidence.manifestFingerprint).toLowerCase(),
        validationPlanFingerprint: String(evidence.validationPlanFingerprint).toLowerCase(),
        holdoutPlanFingerprint: String(evidence.holdoutPlanFingerprint).toLowerCase(),
        method: evidence.method as string,
        verifierId: evidence.verifierId as string,
        runId: evidence.runId as string,
        plannedRunId: evidence.plannedRunId as string,
        outcomeLedgerFingerprint: String(evidence.outcomeLedgerFingerprint).toLowerCase(),
        outcomeCount: evidence.outcomeCount as number,
      };
    }
    const observation: DevelopmentalMultiverseObservation = {
      measurementId,
      runId: expected.runId,
      workItemId: expected.workItemId,
      sourceRevision: expected.sourceRevision,
      policyProfile: structuredClone(expected.policyProfile),
      phase,
      variantId: expected.variantId,
      scenarioId: expected.scenarioId,
      seed: expected.seed,
      environmentFingerprint: expected.environmentFingerprint,
      initialStateFingerprint: expected.initialStateFingerprint,
      pairFingerprint: expected.pairFingerprint,
      policyFingerprint: expected.policyFingerprint,
      metrics: normalizeMetrics(raw.metrics),
      safetyViolationCount: safetyViolationCount as number,
      ...(verifiedEvidence ? { verifiedEvidence } : {}),
    };
    if (existing.length >= MAX_OBSERVATIONS) throw new RangeError('developmental-multiverse-observation-capacity-exceeded');
    if (phase === 'validation') state.validationObservations.push(observation);
    else state.holdoutObservations.push(observation);
    return structuredClone(observation);
  }

  private makeFinalResult(
    selectedVariantId: string | null,
    comparison: DevelopmentalMultiverseComparison | null,
    reasons: string[],
    status: DevelopmentalMultiverseDecision = 'rejected',
  ): DevelopmentalMultiverseFinalResult {
    const state = this.requireState();
    const variant = selectedVariantId ? state.session.variants.find(item => item.id === selectedVariantId) : null;
    const proposedPolicyProfile = variant ? effectiveProfile(state.session.baselineProfile, variant) : undefined;
    const allObservations = [...state.validationObservations, ...state.holdoutObservations];
    const verifiedRows = allObservations.flatMap(item => item.verifiedEvidence ? [item.verifiedEvidence] : []);
    const verifiedEvidenceFingerprint = verifiedRows.length
      ? digest(verifiedRows.map(item => ({
          evaluationFingerprint: item.evaluationFingerprint,
          planFingerprint: item.planFingerprint,
          manifestFingerprint: item.manifestFingerprint,
          method: item.method,
          verifierId: item.verifierId,
          runId: item.runId,
          outcomeLedgerFingerprint: item.outcomeLedgerFingerprint,
          outcomeCount: item.outcomeCount,
        })).sort((a, b) => a.evaluationFingerprint.localeCompare(b.evaluationFingerprint)))
      : null;
    const verifiedPlanCount = new Set(verifiedRows.map(item => item.planFingerprint)).size;
    return {
      runId: state.session.runId,
      status,
      selectedVariantId,
      comparison: comparison ? structuredClone(comparison) : null,
      automaticPromotion: false,
      requiresIndependentVerification: true,
      reasons: [...reasons],
      ...(proposedPolicyProfile ? { proposedPolicyProfile } : {}),
      evidence: {
        sourceRevision: state.session.sourceRevision,
        environmentFingerprint: state.session.environmentFingerprint,
        initialStateFingerprint: state.initialStateFingerprint,
        holdoutPairCount: comparison?.matchedScenarioSeedPairs ?? 0,
        holdoutSeedCount: comparison?.pairedN ?? 0,
        comparedArms: selectedVariantId ? ['baseline', selectedVariantId] : null,
        verifiedObservationCount: verifiedRows.length,
        verifiedPlanCount,
        verifiedEvidenceFingerprint,
      },
    };
  }

  private requireState(): DevelopmentalMultiverseSnapshot {
    if (!this.state) throw new Error('developmental-multiverse-session-not-created');
    return this.state;
  }
}

/** Convert only active P55 counterfactual candidates into data-only multiverse arms. */
export function variantsFromP55Forks(
  forks: readonly Pick<P55Fork, 'id' | 'style' | 'status' | 'deltas'>[],
): DevelopmentalMultiverseVariantInput[] {
  let detached: unknown;
  try { detached = snapshotPlainData(forks); }
  catch { throw new TypeError('developmental-multiverse-p55-forks-data-invalid'); }
  if (!Array.isArray(detached)) throw new TypeError('developmental-multiverse-p55-forks-invalid');
  forks = detached as typeof forks;
  return forks
    .filter(fork => fork && ['candidate', 'simulated', 'promotable'].includes(fork.status))
    .slice(0, MAX_VARIANTS)
    .map(fork => ({ id: fork.id, label: `P55 ${fork.style}`, deltas: { ...fork.deltas } }));
}


/**
 * Build an experiment session from the public P55 snapshot contract.
 *
 * Only the fork id/style/status/five knob deltas cross this boundary. P55 action
 * biases, counters, last-winner/applied state and all other runtime state remain
 * owned by P55. The baseline profile is always supplied separately by the caller.
 */
export function createDevelopmentalMultiverseSessionFromP55(
  input: Omit<DevelopmentalMultiverseSessionInput, 'variants'>,
  p55Snapshot: Pick<P55State, 'forks'>,
): DevelopmentalMultiverseSessionInput {
  let detachedInput: unknown;
  try { detachedInput = snapshotPlainData(input); }
  catch { throw new TypeError('developmental-multiverse-session-data-invalid'); }
  let detachedSnapshot: unknown;
  try { detachedSnapshot = snapshotPlainData(p55Snapshot); }
  catch { throw new TypeError('developmental-multiverse-p55-snapshot-data-invalid'); }
  if (!isRecord(detachedInput) || !isRecord(detachedSnapshot) || !Array.isArray(detachedSnapshot.forks)) {
    throw new TypeError('developmental-multiverse-p55-snapshot-invalid');
  }
  const variants = variantsFromP55Forks(detachedSnapshot.forks as P55Fork[]);
  if (variants.length === 0) {
    throw new Error('developmental-multiverse-p55-snapshot-has-no-active-forks');
  }
  return { ...(detachedInput as unknown as Omit<DevelopmentalMultiverseSessionInput, 'variants'>), variants };
}
