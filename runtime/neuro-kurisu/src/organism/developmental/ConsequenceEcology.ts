import { createHash } from 'node:crypto';
import type { SharedFutureDecision, SharedFutureOutcomeRecord, SharedFutureScenario } from './SharedFutureEngine.ts';

export type ConsequenceEffect = 'harm' | 'benefit' | 'neutral';
export type ConsequenceBasis = 'measured' | 'external-research' | 'user-assumption' | 'simulation' | 'internal-model';
export type ConsequenceRelation = 'causes' | 'amplifies' | 'mitigates' | 'depends-on' | 'feedback';
export type ConsequencePolarity = 'increase' | 'decrease';

export interface ConsequenceNodeInput {
  id: string;
  description: string;
  effect: ConsequenceEffect;
  actor: string;
  system: string;
  probability01: number;
  impact01: number;
  confidence01: number;
  delayDays: number;
  reversible: boolean;
  basis: ConsequenceBasis;
  evidenceRefs?: string[];
  assumptionRefs?: string[];
  /** Probability of this outcome without the evaluated option, under comparable conditions. */
  baselineProbability01?: number;
}

export interface ConsequenceEdgeInput {
  id: string;
  from: string;
  to: string;
  relation: ConsequenceRelation;
  polarity: ConsequencePolarity;
  strength01: number;
  confidence01: number;
  delayDays: number;
  /** Same group means shared/unknown cause; different declared groups are treated as independent. */
  independenceGroup?: string;
}

export interface ConsequenceOptionInput {
  id: string;
  title: string;
  action: string;
  nodes: ConsequenceNodeInput[];
  edges: ConsequenceEdgeInput[];
  /** Exact canonical Shared Future actionDecisionId used by the accepted action binding. */
  decisionId?: string;
}

export interface ConsequenceEcologyRequest {
  id: string;
  scenarioId?: string;
  horizonDays: number;
  options: ConsequenceOptionInput[];
  at?: number;
}

export interface ConsequenceGoalContext {
  activeCount: number;
  goalPressure01: number;
  meanConflict01: number;
  meanStaleness01: number;
  topGoalId: string | null;
}

export interface ConsequenceNegativeSpaceContext {
  records: number;
  alternatives: number;
  reviewEligible: number;
  verifiedOutcomes: number;
  independentOutcomes: number;
}

export interface ConsequenceEcologyContext {
  goalEcology?: ConsequenceGoalContext | null;
  negativeSpace?: ConsequenceNegativeSpaceContext | null;
  resolveDecision?: (decisionId: string) => SharedFutureDecision | null;
}

export interface ConsequenceNodeResult {
  id: string;
  description: string;
  effect: ConsequenceEffect;
  actor: string;
  system: string;
  propagatedProbability01: number;
  impact01: number;
  expectedEffect01: number;
  confidence01: number;
  uncertaintyContribution01: number;
  depth: number;
  order: 'direct' | 'secondary' | 'tertiary';
  delayDays: number;
  reversible: boolean;
  basis: ConsequenceBasis;
  evidenceRefs: string[];
  missingAssumptionRefs: string[];
  baselineProbability01: number | null;
  /** Signed probability delta × impact; null when no comparable baseline was supplied. */
  attributableEffect01: number | null;
}

export interface ConsequenceStakeholderResult {
  actor: string;
  system: string;
  harm01: number;
  benefit01: number;
  uncertainty01: number;
  irreversibleExposure01: number;
  consequenceCount: number;
}

export interface ConsequenceOptionResult {
  id: string;
  title: string;
  action: string;
  decisionId: string | null;
  decisionBinding: {
    sharedFutureDecisionId: string;
    actionDecisionId: string;
    scenarioId: string;
    consequenceId: string;
    toolId: string;
    expectedPostcondition: string;
  } | null;
  ranking: number;
  riskBand: 'low' | 'moderate' | 'high' | 'critical';
  attention: 'routine-review' | 'enhanced-review' | 'mandatory-review';
  directRisk01: number;
  secondaryRisk01: number;
  tertiaryRisk01: number;
  totalHarm01: number;
  totalBenefit01: number;
  netExpectedValue01: number;
  riskAdjustedValue01: number;
  uncertainty01: number;
  confidence01: number;
  graphCoverage01: number;
  evidenceCoverage01: number;
  irreversibleExposure01: number;
  mitigationCredit01: number;
  counterfactualCoverage01: number;
  attributableHarm01: number;
  avoidedHarm01: number;
  attributableBenefit01: number;
  lostBenefit01: number;
  netAttributableValue01: number;
  correlatedPathMerges: number;
  worstStakeholderHarm01: number;
  topStakeholderHarmShare01: number;
  benefitBurdenSeparation01: number;
  mostExposedStakeholder: { actor: string; system: string; harm01: number } | null;
  mainBeneficiary: { actor: string; system: string; benefit01: number } | null;
  feedbackLoopCount: number;
  excludedBeyondHorizon: number;
  unreachableNodeCount: number;
  exploredPathCount: number;
  truncated: boolean;
  nodes: ConsequenceNodeResult[];
  stakeholders: ConsequenceStakeholderResult[];
  temporalEffects: {
    immediateHarm01: number;
    shortTermHarm01: number;
    longTermHarm01: number;
    immediateBenefit01: number;
    shortTermBenefit01: number;
    longTermBenefit01: number;
  };
  criticalPaths: Array<{
    nodeIds: string[];
    probability01: number;
    expectedHarm01: number;
    delayDays: number;
  }>;
  feedbackLoops: Array<{
    from: string;
    to: string;
    relation: ConsequenceRelation;
    exposure01: number;
    path: string[];
  }>;
  missingAssumptionRefs: string[];
  limitations: string[];
  independentlyVerified: false;
}

export interface ConsequenceEcologyAnalysis {
  id: string;
  scenarioId: string | null;
  createdAt: number;
  horizonDays: number;
  status: 'analysed' | 'bounded-partial';
  options: ConsequenceOptionResult[];
  modelTopRankedOptionId: string | null;
  decisionAuthority: 'none';
  independentlyVerified: false;
  context: ConsequenceEcologyContext;
  limitations: string[];
}

export interface ConsequenceOutcomeCalibrationRecord {
  id: string;
  outcomeId: string;
  analysisId: string;
  optionId: string;
  nodeId: string;
  scenarioId: string;
  actionDecisionId: string;
  executionId: string;
  observationId: string;
  observedAt: number;
  forecastProbability01: number;
  observed: boolean;
  brierScore01: number;
  sharedFutureForecastProbability01: number;
  sharedFutureBrierScore01: number;
  brierSkillScore: number | null;
  evidenceRef: string;
  independentSourceCount: number;
  confidence01: number;
  independent01: number;
  evidenceObservationIds: string[];
  sourceIds: string[];
  sourceClasses: string[];
  independenceKeys: string[];
  authority: 'independent-external';
  independentlyVerified: true;
}

export interface ConsequenceEcologyState {
  version: 1;
  analyses: Array<{ digest: string; analysis: ConsequenceEcologyAnalysis }>;
  outcomeCalibrations: ConsequenceOutcomeCalibrationRecord[];
  rejectedCalibrations: number;
  lastCalibrationAt: number;
  totalAnalyses: number;
  rejectedAnalyses: number;
  feedbackLoopsObserved: number;
  truncatedAnalyses: number;
  lastAt: number;
}

const ACTION_NODE = '__action__';
const MAX_ANALYSES = 128;
const MAX_OUTCOME_CALIBRATIONS = 512;
const MAX_OPTIONS = 8;
const MAX_NODES = 64;
const MAX_EDGES = 128;
const MAX_DEPTH = 6;
const MAX_PATHS = 2048;
const MAX_HORIZON_DAYS = 365;
const MIN_PATH_PROBABILITY = 0.0001;
const clamp = (value: number, lo = 0, hi = 1): number =>
  Math.max(lo, Math.min(hi, Number.isFinite(value) ? value : lo));
const finite = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clean = (value: unknown, limit = 160): string =>
  typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, limit) : '';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const noisyOr = (values: number[]): number =>
  clamp(1 - values.reduce((remaining, value) => remaining * (1 - clamp(value)), 1));

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function defaultConsequenceEcologyState(): ConsequenceEcologyState {
  return {
    version: 1,
    analyses: [],
    outcomeCalibrations: [],
    rejectedCalibrations: 0,
    lastCalibrationAt: 0,
    totalAnalyses: 0,
    rejectedAnalyses: 0,
    feedbackLoopsObserved: 0,
    truncatedAnalyses: 0,
    lastAt: 0,
  };
}

const emptyState = defaultConsequenceEcologyState;

function normalizeGoalContext(value: unknown): ConsequenceGoalContext | null {
  if (!isRecord(value)) return null;
  return {
    activeCount: Math.max(0, Math.floor(finite(value.activeCount))),
    goalPressure01: clamp(finite(value.goalPressure01)),
    meanConflict01: clamp(finite(value.meanConflict01)),
    meanStaleness01: clamp(finite(value.meanStaleness01)),
    topGoalId: clean(value.lastTopGoalId ?? value.topGoalId, 128) || null,
  };
}

function normalizeNegativeSpaceContext(value: unknown): ConsequenceNegativeSpaceContext | null {
  if (!isRecord(value)) return null;
  return {
    records: Math.max(0, Math.floor(finite(value.records))),
    alternatives: Math.max(0, Math.floor(finite(value.alternatives))),
    reviewEligible: Math.max(0, Math.floor(finite(value.reviewEligible))),
    verifiedOutcomes: Math.max(0, Math.floor(finite(value.verifiedOutcomes))),
    independentOutcomes: Math.max(0, Math.floor(finite(value.independentOutcomes))),
  };
}

function boundedNumber(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function requiredBoundedNumber(value: unknown, min: number, max: number, code: string): number {
  if (!boundedNumber(value, min, max)) throw new Error(code);
  return value as number;
}

function boundedInteger(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

function boundedString(value: unknown, maxLength: number, allowEmpty = true): boolean {
  return typeof value === 'string' && value.length <= maxLength && (allowEmpty || value.trim().length > 0);
}

function boundedStringArray(value: unknown, maxItems: number, maxLength: number): boolean {
  return Array.isArray(value) && value.length <= maxItems &&
    value.every(item => boundedString(item, maxLength, false));
}

/**
 * Conservatively merges calibration rows that reuse any evidence lineage token.
 * Repeated source IDs, independence keys, observations, or exact evidence references
 * are treated as potentially correlated; distinct outcome IDs alone do not prove independence.
 */
function countIndependentCalibrationEvidenceClusters(
  rows: readonly ConsequenceOutcomeCalibrationRecord[],
): number {
  if (rows.length === 0) return 0;
  const parent = rows.map((_, index) => index);
  const find = (value: number): number => {
    let root = value;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[value] !== value) {
      const next = parent[value]!;
      parent[value] = root;
      value = next;
    }
    return root;
  };
  const join = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
  };
  const ownerByToken = new Map<string, number>();
  rows.forEach((row, index) => {
    const tokens = new Set([
      ...row.sourceIds.map(value => `source:${value}`),
      ...row.independenceKeys.map(value => `independence:${value}`),
      ...row.evidenceObservationIds.map(value => `observation:${value}`),
      `evidence-ref:${row.evidenceRef}`,
    ]);
    for (const token of tokens) {
      const owner = ownerByToken.get(token);
      if (owner === undefined) ownerByToken.set(token, index);
      else join(index, owner);
    }
  });
  return new Set(rows.map((_, index) => find(index))).size;
}

function isRestorableContext(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const goal = value.goalEcology;
  const negative = value.negativeSpace;
  if (goal !== null && (!isRecord(goal) ||
      !boundedInteger(goal.activeCount, 0, 1_000_000) ||
      !boundedNumber(goal.goalPressure01, 0, 1) ||
      !boundedNumber(goal.meanConflict01, 0, 1) ||
      !boundedNumber(goal.meanStaleness01, 0, 1) ||
      !(goal.topGoalId === null || boundedString(goal.topGoalId, 128)))) return false;
  if (negative !== null && (!isRecord(negative) ||
      !boundedInteger(negative.records, 0, 1_000_000) ||
      !boundedInteger(negative.alternatives, 0, 1_000_000) ||
      !boundedInteger(negative.reviewEligible, 0, 1_000_000) ||
      !boundedInteger(negative.verifiedOutcomes, 0, 1_000_000) ||
      !boundedInteger(negative.independentOutcomes, 0, 1_000_000))) return false;
  return Object.keys(value).length <= 2 &&
    Object.hasOwn(value, 'goalEcology') && Object.hasOwn(value, 'negativeSpace');
}

function migrateRestoredAnalysis(value: ConsequenceEcologyAnalysis): ConsequenceEcologyAnalysis {
  const analysis = structuredClone(value);
  for (const option of analysis.options) {
    option.decisionId ??= null;
    option.decisionBinding ??= null;
    option.counterfactualCoverage01 ??= 0;
    option.attributableHarm01 ??= 0;
    option.avoidedHarm01 ??= 0;
    option.attributableBenefit01 ??= 0;
    option.lostBenefit01 ??= 0;
    option.netAttributableValue01 ??= 0;
    option.correlatedPathMerges ??= 0;
    option.worstStakeholderHarm01 ??= 0;
    option.topStakeholderHarmShare01 ??= 0;
    option.benefitBurdenSeparation01 ??= 0;
    option.mostExposedStakeholder ??= null;
    option.mainBeneficiary ??= null;
    for (const node of option.nodes) {
      if (node.description === undefined) node.description = '';
      if (node.baselineProbability01 === undefined) node.baselineProbability01 = null;
      if (node.attributableEffect01 === undefined) node.attributableEffect01 = null;
    }
  }
  return analysis;
}

function isRestorableAnalysis(value: unknown): value is ConsequenceEcologyAnalysis {
  if (!isRecord(value) || !boundedString(value.id, 96, false) || value.decisionAuthority !== 'none' ||
      value.independentlyVerified !== false || (value.status !== 'analysed' && value.status !== 'bounded-partial') ||
      !boundedNumber(value.createdAt, 0, Number.MAX_SAFE_INTEGER) ||
      !boundedInteger(value.horizonDays, 1, MAX_HORIZON_DAYS) ||
      !(value.scenarioId === null || boundedString(value.scenarioId, 160, false)) ||
      !(value.modelTopRankedOptionId === null || boundedString(value.modelTopRankedOptionId, 96, false)) ||
      !Array.isArray(value.options) || value.options.length < 1 || value.options.length > MAX_OPTIONS ||
      !boundedStringArray(value.limitations, 12, 320) || !isRestorableContext(value.context)) return false;

  return value.options.every(option => {
    if (!isRecord(option) || !boundedString(option.id, 96, false) ||
        !boundedString(option.title, 180, false) || !boundedString(option.action, 180, false) ||
        !(option.decisionId === undefined || option.decisionId === null || boundedString(option.decisionId, 180, false)) ||
        !(option.decisionBinding === undefined || option.decisionBinding === null ||
          (isRecord(option.decisionBinding) &&
            boundedString(option.decisionBinding.sharedFutureDecisionId, 96, false) &&
            boundedString(option.decisionBinding.actionDecisionId, 180, false) &&
            boundedString(option.decisionBinding.scenarioId, 160, false) &&
            boundedString(option.decisionBinding.consequenceId, 96, false) &&
            boundedString(option.decisionBinding.toolId, 64, false) &&
            boundedString(option.decisionBinding.expectedPostcondition, 1024, false))) ||
        !boundedInteger(option.ranking, 1, MAX_OPTIONS) ||
        !(['low', 'moderate', 'high', 'critical'] as unknown[]).includes(option.riskBand) ||
        !(['routine-review', 'enhanced-review', 'mandatory-review'] as unknown[]).includes(option.attention) ||
        !boundedNumber(option.directRisk01, 0, 1) || !boundedNumber(option.secondaryRisk01, 0, 1) ||
        !boundedNumber(option.tertiaryRisk01, 0, 1) || !boundedNumber(option.totalHarm01, 0, 1) ||
        !boundedNumber(option.totalBenefit01, 0, 1) || !boundedNumber(option.netExpectedValue01, -1, 1) ||
        !boundedNumber(option.riskAdjustedValue01, -1, 1) || !boundedNumber(option.uncertainty01, 0, 1) ||
        !boundedNumber(option.confidence01, 0, 1) || !boundedNumber(option.graphCoverage01, 0, 1) ||
        !boundedNumber(option.evidenceCoverage01, 0, 1) || !boundedNumber(option.irreversibleExposure01, 0, 1) ||
        !boundedNumber(option.mitigationCredit01, 0, 1) ||
        !(option.counterfactualCoverage01 === undefined || boundedNumber(option.counterfactualCoverage01, 0, 1)) ||
        !(option.attributableHarm01 === undefined || boundedNumber(option.attributableHarm01, 0, 1)) ||
        !(option.avoidedHarm01 === undefined || boundedNumber(option.avoidedHarm01, 0, 1)) ||
        !(option.attributableBenefit01 === undefined || boundedNumber(option.attributableBenefit01, 0, 1)) ||
        !(option.lostBenefit01 === undefined || boundedNumber(option.lostBenefit01, 0, 1)) ||
        !(option.netAttributableValue01 === undefined || boundedNumber(option.netAttributableValue01, -1, 1)) ||
        !(option.correlatedPathMerges === undefined || boundedInteger(option.correlatedPathMerges, 0, MAX_PATHS * MAX_NODES)) ||
        !(option.worstStakeholderHarm01 === undefined || boundedNumber(option.worstStakeholderHarm01, 0, 1)) ||
        !(option.topStakeholderHarmShare01 === undefined || boundedNumber(option.topStakeholderHarmShare01, 0, 1)) ||
        !(option.benefitBurdenSeparation01 === undefined || boundedNumber(option.benefitBurdenSeparation01, 0, 1)) ||
        !(option.mostExposedStakeholder === undefined || option.mostExposedStakeholder === null ||
          (isRecord(option.mostExposedStakeholder) && boundedString(option.mostExposedStakeholder.actor, 96, false) &&
            boundedString(option.mostExposedStakeholder.system, 96, false) && boundedNumber(option.mostExposedStakeholder.harm01, 0, 1))) ||
        !(option.mainBeneficiary === undefined || option.mainBeneficiary === null ||
          (isRecord(option.mainBeneficiary) && boundedString(option.mainBeneficiary.actor, 96, false) &&
            boundedString(option.mainBeneficiary.system, 96, false) && boundedNumber(option.mainBeneficiary.benefit01, 0, 1))) ||
        !boundedInteger(option.feedbackLoopCount, 0, MAX_PATHS) ||
        !boundedInteger(option.excludedBeyondHorizon, 0, MAX_PATHS) ||
        !boundedInteger(option.unreachableNodeCount, 0, MAX_NODES) ||
        !boundedInteger(option.exploredPathCount, 0, MAX_PATHS) || typeof option.truncated !== 'boolean' ||
        !Array.isArray(option.nodes) || option.nodes.length > MAX_NODES ||
        !Array.isArray(option.stakeholders) || option.stakeholders.length > MAX_NODES ||
        !isRecord(option.temporalEffects) || !Array.isArray(option.criticalPaths) || option.criticalPaths.length > 8 ||
        !Array.isArray(option.feedbackLoops) || option.feedbackLoops.length > 16 ||
        !boundedStringArray(option.missingAssumptionRefs, MAX_NODES * 8, 128) ||
        !boundedStringArray(option.limitations, 12, 320)) return false;

    const temporalEffects = option.temporalEffects;
    if (!isRecord(temporalEffects) ||
        !['immediateHarm01', 'shortTermHarm01', 'longTermHarm01', 'immediateBenefit01', 'shortTermBenefit01', 'longTermBenefit01']
          .every(key => boundedNumber(temporalEffects[key], 0, 1))) return false;

    if (!option.nodes.every(node => isRecord(node) &&
        boundedString(node.id, 96, false) && (node.description === undefined || boundedString(node.description, 320)) && boundedString(node.actor, 96, false) &&
        boundedString(node.system, 96, false) &&
        (node.effect === 'harm' || node.effect === 'benefit' || node.effect === 'neutral') &&
        (node.order === 'direct' || node.order === 'secondary' || node.order === 'tertiary') &&
        (node.basis === 'measured' || node.basis === 'external-research' || node.basis === 'user-assumption' ||
          node.basis === 'simulation' || node.basis === 'internal-model') &&
        boundedNumber(node.propagatedProbability01, 0, 1) && boundedNumber(node.impact01, 0, 1) &&
        boundedNumber(node.expectedEffect01, 0, 1) && boundedNumber(node.confidence01, 0, 1) &&
        boundedNumber(node.uncertaintyContribution01, 0, 1) &&
        (node.baselineProbability01 === undefined || node.baselineProbability01 === null || boundedNumber(node.baselineProbability01, 0, 1)) &&
        (node.attributableEffect01 === undefined || node.attributableEffect01 === null || boundedNumber(node.attributableEffect01, -1, 1)) &&
        boundedInteger(node.depth, 1, MAX_DEPTH) && boundedNumber(node.delayDays, 0, MAX_HORIZON_DAYS) &&
        typeof node.reversible === 'boolean' && boundedStringArray(node.evidenceRefs, 8, 180) &&
        boundedStringArray(node.missingAssumptionRefs, 8, 128))) return false;

    if (!option.stakeholders.every(row => isRecord(row) &&
        boundedString(row.actor, 96, false) && boundedString(row.system, 96, false) &&
        boundedNumber(row.harm01, 0, 1) && boundedNumber(row.benefit01, 0, 1) &&
        boundedNumber(row.uncertainty01, 0, 1) && boundedNumber(row.irreversibleExposure01, 0, 1) &&
        boundedInteger(row.consequenceCount, 0, MAX_NODES))) return false;

    if (!option.criticalPaths.every(row => isRecord(row) &&
        Array.isArray(row.nodeIds) && row.nodeIds.length >= 2 && row.nodeIds.length <= MAX_DEPTH + 1 &&
        boundedStringArray(row.nodeIds, MAX_DEPTH + 1, 96) &&
        boundedNumber(row.probability01, 0, 1) && boundedNumber(row.expectedHarm01, 0, 1) &&
        boundedNumber(row.delayDays, 0, MAX_HORIZON_DAYS))) return false;

    if (!option.feedbackLoops.every(row => isRecord(row) &&
        boundedString(row.from, 96, false) && boundedString(row.to, 96, false) &&
        (row.relation === 'causes' || row.relation === 'amplifies' || row.relation === 'mitigates' ||
          row.relation === 'depends-on' || row.relation === 'feedback') &&
        boundedNumber(row.exposure01, 0, 1) && Array.isArray(row.path) &&
        row.path.length >= 2 && row.path.length <= MAX_DEPTH + 1 &&
        boundedStringArray(row.path, MAX_DEPTH + 1, 96))) return false;
    return true;
  });
}

function assumptionConfidence(
  node: ConsequenceNodeInput,
  assumptions: Map<string, { confidence01: number; status: string }>,
): { confidence01: number; missing: string[] } {
  const refs = Array.isArray(node.assumptionRefs) ? node.assumptionRefs.slice(0, 8) : [];
  if (!refs.length) return { confidence01: clamp(node.confidence01), missing: [] };
  const factors: number[] = [];
  const missing: string[] = [];
  for (const ref of refs) {
    const assumption = assumptions.get(ref);
    if (!assumption) {
      missing.push(ref);
      factors.push(0.25);
      continue;
    }
    const statusFactor = assumption.status === 'supported' ? 1
      : assumption.status === 'challenged' ? 0.55
      : assumption.status === 'expired' ? 0.2 : 0.85;
    factors.push(clamp(assumption.confidence01) * statusFactor);
  }
  const factor = factors.reduce((sum, row) => sum + row, 0) / Math.max(1, factors.length);
  return { confidence01: clamp(node.confidence01) * factor, missing };
}

interface NormalizedNode extends Omit<ConsequenceNodeInput, 'baselineProbability01'> {
  baselineProbability01: number | null;
  effectiveConfidence01: number;
  missingAssumptionRefs: string[];
}
interface PathState {
  nodeId: string;
  probability01: number;
  confidence01: number;
  depth: number;
  delayDays: number;
  path: string[];
  originGroup: string;
}
interface NodeAccumulation {
  originPaths: Map<string, { probability01: number; confidence01: number }>;
  correlatedPathMerges: number;
  weightedConfidenceMass: number;
  probabilityMass: number;
  minDepth: number;
  minDelayDays: number;
  maxPathProbability01: number;
}

function riskBand(value: number): ConsequenceOptionResult['riskBand'] {
  return value >= 0.78 ? 'critical' : value >= 0.55 ? 'high' : value >= 0.28 ? 'moderate' : 'low';
}

function analyzeOption(
  option: ConsequenceOptionInput,
  horizonDays: number,
  assumptions: Map<string, { confidence01: number; status: string }>,
): ConsequenceOptionResult {
  if (!isRecord(option) || !clean(option.id, 96) || !clean(option.action, 180)) {
    throw new Error('consequence-option-identity-invalid');
  }
  if (!Array.isArray(option.nodes) || option.nodes.length < 1 || option.nodes.length > MAX_NODES) {
    throw new Error('consequence-node-capacity-invalid');
  }
  if (!Array.isArray(option.edges) || option.edges.length > MAX_EDGES) {
    throw new Error('consequence-edge-capacity-invalid');
  }

  const nodes = new Map<string, NormalizedNode>();
  for (const raw of option.nodes) {
    if (!isRecord(raw)) throw new Error('consequence-node-invalid');
    const id = clean(raw.id, 96);
    if (!id || id === ACTION_NODE || nodes.has(id)) throw new Error('consequence-node-id-invalid');
    const effect = raw.effect;
    const basis = raw.basis;
    if (effect !== 'harm' && effect !== 'benefit' && effect !== 'neutral') throw new Error('consequence-effect-invalid');
    if (basis !== 'measured' && basis !== 'external-research' && basis !== 'user-assumption' &&
        basis !== 'simulation' && basis !== 'internal-model') throw new Error('consequence-basis-invalid');
    if (typeof raw.reversible !== 'boolean') throw new Error('consequence-reversibility-invalid');
    const probability01 = requiredBoundedNumber(raw.probability01, 0, 1, 'consequence-node-probability-invalid');
    const impact01 = requiredBoundedNumber(raw.impact01, 0, 1, 'consequence-node-impact-invalid');
    const confidence01 = requiredBoundedNumber(raw.confidence01, 0, 1, 'consequence-node-confidence-invalid');
    const delayDays = requiredBoundedNumber(raw.delayDays, 0, MAX_HORIZON_DAYS, 'consequence-node-delay-invalid');
    const baselineProbability01 = raw.baselineProbability01 === undefined ? null
      : requiredBoundedNumber(raw.baselineProbability01, 0, 1, 'consequence-node-baseline-probability-invalid');
    const node: ConsequenceNodeInput = {
      id,
      description: clean(raw.description, 320),
      effect,
      actor: clean(raw.actor, 96) || 'unspecified',
      system: clean(raw.system, 96) || 'unspecified',
      probability01,
      impact01,
      confidence01,
      delayDays,
      reversible: raw.reversible,
      basis,
      evidenceRefs: Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs.map(x => clean(x, 180)).filter(Boolean).slice(0, 8) : [],
      assumptionRefs: Array.isArray(raw.assumptionRefs) ? raw.assumptionRefs.map(x => clean(x, 128)).filter(Boolean).slice(0, 8) : [],
    };
    const confidence = assumptionConfidence(node, assumptions);
    nodes.set(id, {
      ...node,
      baselineProbability01,
      effectiveConfidence01: confidence.confidence01,
      missingAssumptionRefs: confidence.missing,
    });
  }

  const edges: ConsequenceEdgeInput[] = [];
  const edgeIds = new Set<string>();
  for (const raw of option.edges) {
    if (!isRecord(raw)) throw new Error('consequence-edge-invalid');
    const id = clean(raw.id, 96), from = clean(raw.from, 96), to = clean(raw.to, 96);
    if (!id || edgeIds.has(id) || (from !== ACTION_NODE && !nodes.has(from)) || !nodes.has(to)) {
      throw new Error('consequence-edge-reference-invalid');
    }
    if (raw.relation !== 'causes' && raw.relation !== 'amplifies' && raw.relation !== 'mitigates' &&
        raw.relation !== 'depends-on' && raw.relation !== 'feedback') throw new Error('consequence-edge-relation-invalid');
    if (raw.polarity !== 'increase' && raw.polarity !== 'decrease') throw new Error('consequence-edge-polarity-invalid');
    if (raw.relation === 'mitigates' && raw.polarity !== 'decrease') throw new Error('consequence-mitigation-must-reduce');
    const strength01 = requiredBoundedNumber(raw.strength01, 0, 1, 'consequence-edge-strength-invalid');
    const confidence01 = requiredBoundedNumber(raw.confidence01, 0, 1, 'consequence-edge-confidence-invalid');
    const delayDays = requiredBoundedNumber(raw.delayDays, 0, MAX_HORIZON_DAYS, 'consequence-edge-delay-invalid');
    edgeIds.add(id);
    edges.push({
      id, from, to,
      relation: raw.relation,
      polarity: raw.polarity,
      strength01,
      confidence01,
      delayDays,
      ...(clean(raw.independenceGroup, 96) ? { independenceGroup: clean(raw.independenceGroup, 96) } : {}),
    });
  }

  const outgoing = new Map<string, ConsequenceEdgeInput[]>();
  for (const edge of edges) {
    const bucket = outgoing.get(edge.from) ?? [];
    bucket.push(edge);
    outgoing.set(edge.from, bucket);
  }
  for (const bucket of outgoing.values()) bucket.sort((a, b) => a.id.localeCompare(b.id));

  const accumulated = new Map<string, NodeAccumulation>();
  const queue: PathState[] = [{ nodeId: ACTION_NODE, probability01: 1, confidence01: 1, depth: 0, delayDays: 0, path: [ACTION_NODE], originGroup: '__unknown_root_cause__' }];
  const feedbackLoops: ConsequenceOptionResult['feedbackLoops'] = [];
  const criticalPaths: ConsequenceOptionResult['criticalPaths'] = [];
  let excludedBeyondHorizon = 0;
  let mitigationCredit01 = 0;
  let exploredPathCount = 0;
  let truncated = false;

  for (let cursor = 0; cursor < queue.length; cursor++) {
    if (exploredPathCount >= MAX_PATHS) { truncated = true; break; }
    const current = queue[cursor]!;
    if (current.depth >= MAX_DEPTH) continue;
    for (const edge of outgoing.get(current.nodeId) ?? []) {
      const node = nodes.get(edge.to)!;
      const delayDays = current.delayDays + edge.delayDays + node.delayDays;
      if (delayDays > horizonDays) { excludedBeyondHorizon++; continue; }
      const mitigationTransfer01 = edge.strength01 * edge.confidence01;
      const targetPrior01 = node.probability01;
      if (edge.polarity === 'decrease' && node.effect === 'harm') {
        mitigationCredit01 = noisyOr([mitigationCredit01, current.probability01 * mitigationTransfer01 * targetPrior01 * node.impact01]);
      }
      // Influence strength controls how much the cause propagates. Evidence confidence
      // is carried separately so weak evidence cannot make a possible harm disappear.
      const residualTransfer01 = edge.polarity === 'decrease' ? 1 - mitigationTransfer01 : edge.strength01;
      const probability01 = clamp(current.probability01 * residualTransfer01 * targetPrior01);
      const pathConfidence01 = clamp(current.confidence01 * edge.confidence01 * node.effectiveConfidence01);
      if (current.path.includes(edge.to)) {
        feedbackLoops.push({
          from: edge.from,
          to: edge.to,
          relation: edge.relation,
          exposure01: clamp(probability01 * node.impact01),
          path: [...current.path, edge.to].slice(-MAX_DEPTH - 1),
        });
        exploredPathCount++;
        continue;
      }
      if (probability01 < MIN_PATH_PROBABILITY) continue;
      const depth = current.depth + 1;
      const path = [...current.path, edge.to];
      const entry = accumulated.get(edge.to) ?? {
        originPaths: new Map(),
        correlatedPathMerges: 0,
        weightedConfidenceMass: 0,
        probabilityMass: 0,
        minDepth: depth,
        minDelayDays: delayDays,
        maxPathProbability01: 0,
      };
      const originGroup = current.depth === 0
        ? (clean(edge.independenceGroup, 96) || '__unknown_root_cause__')
        : current.originGroup;
      const priorOrigin = entry.originPaths.get(originGroup);
      if (priorOrigin) entry.correlatedPathMerges++;
      if (!priorOrigin || probability01 > priorOrigin.probability01) {
        entry.originPaths.set(originGroup, { probability01, confidence01: pathConfidence01 });
      }
      const groupedOrigins = [...entry.originPaths.values()];
      entry.weightedConfidenceMass = groupedOrigins.reduce((sum, row) => sum + row.probability01 * row.confidence01, 0);
      entry.probabilityMass = groupedOrigins.reduce((sum, row) => sum + row.probability01, 0);
      entry.minDepth = Math.min(entry.minDepth, depth);
      entry.minDelayDays = Math.min(entry.minDelayDays, delayDays);
      entry.maxPathProbability01 = Math.max(entry.maxPathProbability01, probability01);
      accumulated.set(edge.to, entry);
      if (node.effect === 'harm') {
        criticalPaths.push({
          nodeIds: path,
          probability01,
          expectedHarm01: probability01 * node.impact01,
          delayDays,
        });
      }
      queue.push({ nodeId: edge.to, probability01, confidence01: pathConfidence01, depth, delayDays, path, originGroup });
      exploredPathCount++;
      if (exploredPathCount >= MAX_PATHS) { truncated = true; break; }
    }
  }

  const rows: ConsequenceNodeResult[] = [];
  const stakeholderBuckets = new Map<string, { actor: string; system: string; harms: number[]; benefits: number[]; uncertainty: number[]; irreversible: number[]; count: number }>();
  const orderRisk = { direct: [] as number[], secondary: [] as number[], tertiary: [] as number[] };
  const temporalRisk = { immediate: [] as number[], short: [] as number[], long: [] as number[] };
  const temporalBenefit = { immediate: [] as number[], short: [] as number[], long: [] as number[] };
  const attributableHarm: number[] = [];
  const avoidedHarm: number[] = [];
  const attributableBenefit: number[] = [];
  const lostBenefit: number[] = [];
  const allMissingAssumptions = new Set<string>();
  const reachable = Array.from(accumulated.entries()).sort(([a], [b]) => a.localeCompare(b));

  for (const [id, exposure] of reachable) {
    const node = nodes.get(id)!;
    const groupedOrigins = [...exposure.originPaths.values()];
    const propagatedProbability01 = noisyOr(groupedOrigins.map(row => row.probability01));
    const expectedEffect01 = propagatedProbability01 * node.impact01;
    const attributableEffect01 = node.baselineProbability01 === null
      ? null : (propagatedProbability01 - node.baselineProbability01) * node.impact01;
    if (attributableEffect01 !== null) {
      if (node.effect === 'harm') {
        (attributableEffect01 >= 0 ? attributableHarm : avoidedHarm).push(Math.abs(attributableEffect01));
      } else if (node.effect === 'benefit') {
        (attributableEffect01 >= 0 ? attributableBenefit : lostBenefit).push(Math.abs(attributableEffect01));
      }
    }
    const propagatedConfidence01 = clamp(exposure.weightedConfidenceMass / Math.max(1e-9, exposure.probabilityMass));
    const uncertaintyContribution01 = expectedEffect01 * (1 - propagatedConfidence01);
    const order = exposure.minDepth <= 1 ? 'direct' : exposure.minDepth === 2 ? 'secondary' : 'tertiary';
    const refs = node.evidenceRefs ?? [];
    const missingAssumptionRefs = [...node.missingAssumptionRefs];
    for (const ref of missingAssumptionRefs) allMissingAssumptions.add(ref);
    const row: ConsequenceNodeResult = {
      id,
      description: node.description,
      effect: node.effect,
      actor: node.actor,
      system: node.system,
      propagatedProbability01,
      impact01: node.impact01,
      expectedEffect01,
      confidence01: propagatedConfidence01,
      uncertaintyContribution01,
      depth: exposure.minDepth,
      order,
      delayDays: exposure.minDelayDays,
      reversible: node.reversible,
      basis: node.basis,
      evidenceRefs: [...refs],
      missingAssumptionRefs,
      baselineProbability01: node.baselineProbability01,
      attributableEffect01,
    };
    rows.push(row);
    const actorKey = node.actor + '\u0000' + node.system;
    const stakeholder = stakeholderBuckets.get(actorKey) ?? {
      actor: node.actor, system: node.system, harms: [], benefits: [], uncertainty: [], irreversible: [], count: 0,
    };
    stakeholder.count++;
    if (node.effect === 'harm') {
      stakeholder.harms.push(expectedEffect01);
      orderRisk[order].push(expectedEffect01);
      const bucket = exposure.minDelayDays < 1 ? 'immediate' : exposure.minDelayDays <= 30 ? 'short' : 'long';
      temporalRisk[bucket].push(expectedEffect01);
      if (!node.reversible) stakeholder.irreversible.push(expectedEffect01);
    } else if (node.effect === 'benefit') {
      stakeholder.benefits.push(expectedEffect01);
      const bucket = exposure.minDelayDays < 1 ? 'immediate' : exposure.minDelayDays <= 30 ? 'short' : 'long';
      temporalBenefit[bucket].push(expectedEffect01);
    }
    stakeholder.uncertainty.push(uncertaintyContribution01);
    stakeholderBuckets.set(actorKey, stakeholder);
  }

  const totalHarm01 = noisyOr(rows.filter(row => row.effect === 'harm').map(row => row.expectedEffect01));
  const totalBenefit01 = noisyOr(rows.filter(row => row.effect === 'benefit').map(row => row.expectedEffect01));
  const irreversibleExposure01 = noisyOr(rows.filter(row => row.effect === 'harm' && !row.reversible).map(row => row.expectedEffect01));
  const weightedMass = rows.reduce((sum, row) => sum + row.expectedEffect01, 0);
  const uncertaintyMass = rows.reduce((sum, row) => sum + row.uncertaintyContribution01, 0);
  const evidenceCoverage01 = rows.length ? rows.filter(row => row.evidenceRefs.length > 0).length / rows.length : 0;
  const counterfactualCoverage01 = rows.length ? rows.filter(row => row.baselineProbability01 !== null).length / rows.length : 0;
  const graphCoverage01 = nodes.size ? rows.length / nodes.size : 0;
  const uncertainty01 = clamp((weightedMass > 0 ? uncertaintyMass / weightedMass : 0.5) + (1 - graphCoverage01) * 0.25);
  const confidence01 = 1 - uncertainty01;
  const netExpectedValue01 = totalBenefit01 - totalHarm01;
  const riskAdjustedValue01 = clamp(netExpectedValue01 - uncertainty01 * 0.25 - irreversibleExposure01 * 0.15, -1, 1);
  const stakeholders: ConsequenceStakeholderResult[] = Array.from(stakeholderBuckets.values())
    .map(bucket => ({
      actor: bucket.actor,
      system: bucket.system,
      harm01: noisyOr(bucket.harms),
      benefit01: noisyOr(bucket.benefits),
      uncertainty01: noisyOr(bucket.uncertainty),
      irreversibleExposure01: noisyOr(bucket.irreversible),
      consequenceCount: bucket.count,
    }))
    .sort((a, b) => b.harm01 - a.harm01 || a.actor.localeCompare(b.actor) || a.system.localeCompare(b.system));
  const harmBearingStakeholders = stakeholders.filter(row => row.harm01 > 0);
  const benefitBearingStakeholders = stakeholders.filter(row => row.benefit01 > 0)
    .sort((a, b) => b.benefit01 - a.benefit01 || a.actor.localeCompare(b.actor) || a.system.localeCompare(b.system));
  const mostExposed = harmBearingStakeholders[0] ?? null;
  const mainBeneficiary = benefitBearingStakeholders[0] ?? null;
  const stakeholderHarmMass = harmBearingStakeholders.reduce((sum, row) => sum + row.harm01, 0);
  const worstStakeholderHarm01 = mostExposed?.harm01 ?? 0;
  const topStakeholderHarmShare01 = stakeholderHarmMass > 0 ? clamp(worstStakeholderHarm01 / stakeholderHarmMass) : 0;
  const benefitBurdenSeparation01 = mostExposed && mainBeneficiary &&
    (mostExposed.actor !== mainBeneficiary.actor || mostExposed.system !== mainBeneficiary.system)
    ? Math.min(mostExposed.harm01, mainBeneficiary.benefit01) : 0;
  // Distributional exposure is surfaced independently from net value: benefits do not cancel a concentrated burden borne by another stakeholder.
  const attention: ConsequenceOptionResult['attention'] =
    (irreversibleExposure01 >= 0.25 || totalHarm01 >= 0.7 || worstStakeholderHarm01 >= 0.6) ? 'mandatory-review'
    : (uncertainty01 >= 0.45 || graphCoverage01 < 0.6 || totalHarm01 >= 0.4 || worstStakeholderHarm01 >= 0.35) ? 'enhanced-review'
    : 'routine-review';

  criticalPaths.sort((a, b) => b.expectedHarm01 - a.expectedHarm01 || a.delayDays - b.delayDays || a.nodeIds.join('/').localeCompare(b.nodeIds.join('/')));
  const limitations = [
    'Causal links and conditional probabilities are supplied assumptions or model inputs, not proof of objective causation.',
    'Path propagation is bounded to six edges and 2,048 explored paths; cycles are reported, not solved as a physical dynamical system.',
    'Paths sharing a root-cause group are merged by maximum exposure; noisy-OR is used only across separately declared root-cause groups. Missing groups are conservatively treated as one shared/unknown cause.',
    'Evidence references provide traceability only; this engine does not fetch, authenticate or independently verify sources.',
    'The analysis ranks modelled exposure only. It does not select, approve, schedule or execute an action.',
  ];
  if (truncated) limitations.push('Path budget reached; unvisited branches remain outside this result.');
  if (excludedBeyondHorizon) limitations.push('Some effects were excluded because their accumulated delay exceeded the requested horizon.');
  if (allMissingAssumptions.size) limitations.push('One or more referenced assumptions were missing and reduced confidence.');
  if (counterfactualCoverage01 < 1) limitations.push(counterfactualCoverage01 === 0
    ? 'No comparable baseline probabilities were supplied; action-attributable effects remain unknown.'
    : 'Counterfactual coverage is partial; aggregate attributable effects omit nodes without a baseline.');
  if (benefitBurdenSeparation01 >= 0.25) limitations.push('A material share of benefits and harms falls on different stakeholder groups; net value must not be read as consent or fairness.');
  if (topStakeholderHarmShare01 >= 0.75 && worstStakeholderHarm01 >= 0.2) limitations.push('Harm is concentrated in one stakeholder group; review distributional effects separately from aggregate totals.');
  if (!rows.length) limitations.push('No consequence node was reachable from the proposed action.');
  return {
    id: clean(option.id, 96),
    title: clean(option.title, 180),
    action: clean(option.action, 180),
    decisionId: clean(option.decisionId, 180) || null,
    decisionBinding: null,
    ranking: 0,
    riskBand: riskBand(totalHarm01),
    attention,
    directRisk01: noisyOr(orderRisk.direct),
    secondaryRisk01: noisyOr(orderRisk.secondary),
    tertiaryRisk01: noisyOr(orderRisk.tertiary),
    totalHarm01,
    totalBenefit01,
    netExpectedValue01,
    riskAdjustedValue01,
    uncertainty01,
    confidence01,
    graphCoverage01,
    evidenceCoverage01,
    irreversibleExposure01,
    mitigationCredit01,
    counterfactualCoverage01,
    attributableHarm01: noisyOr(attributableHarm),
    avoidedHarm01: noisyOr(avoidedHarm),
    attributableBenefit01: noisyOr(attributableBenefit),
    lostBenefit01: noisyOr(lostBenefit),
    netAttributableValue01: clamp(
      noisyOr(attributableBenefit) + noisyOr(avoidedHarm) - noisyOr(attributableHarm) - noisyOr(lostBenefit), -1, 1,
    ),
    correlatedPathMerges: reachable.reduce((sum, [, exposure]) => sum + exposure.correlatedPathMerges, 0),
    worstStakeholderHarm01,
    topStakeholderHarmShare01,
    benefitBurdenSeparation01,
    mostExposedStakeholder: mostExposed ? { actor: mostExposed.actor, system: mostExposed.system, harm01: mostExposed.harm01 } : null,
    mainBeneficiary: mainBeneficiary ? { actor: mainBeneficiary.actor, system: mainBeneficiary.system, benefit01: mainBeneficiary.benefit01 } : null,
    feedbackLoopCount: feedbackLoops.length,
    excludedBeyondHorizon,
    unreachableNodeCount: nodes.size - rows.length,
    exploredPathCount,
    truncated,
    nodes: rows,
    stakeholders,
    temporalEffects: {
      immediateHarm01: noisyOr(temporalRisk.immediate),
      shortTermHarm01: noisyOr(temporalRisk.short),
      longTermHarm01: noisyOr(temporalRisk.long),
      immediateBenefit01: noisyOr(temporalBenefit.immediate),
      shortTermBenefit01: noisyOr(temporalBenefit.short),
      longTermBenefit01: noisyOr(temporalBenefit.long),
    },
    criticalPaths: criticalPaths.slice(0, 8),
    feedbackLoops: feedbackLoops.slice(0, 16),
    missingAssumptionRefs: [...allMissingAssumptions].sort(),
    limitations,
    independentlyVerified: false,
  };
}

export class ConsequenceEcologyEngine {
  private state: ConsequenceEcologyState = emptyState();
  private verifiedOutcomeResolver: ((outcomeId: string) => SharedFutureOutcomeRecord | null) | null = null;

  /** Only FutureSimulator may attach the canonical Shared Future outcome resolver. */
  setVerifiedOutcomeResolver(resolver: ((outcomeId: string) => SharedFutureOutcomeRecord | null) | null): void {
    this.verifiedOutcomeResolver = typeof resolver === 'function' ? resolver : null;
  }

  snapshot(): ConsequenceEcologyState {
    return structuredClone(this.state);
  }

  private canonicalPostcondition(value: string): string {
    return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  private restoreCalibrationRecords(
    raw: unknown,
    analyses: ConsequenceEcologyAnalysis[],
    resolveVerifiedOutcome?: (outcomeId: string) => SharedFutureOutcomeRecord | null,
  ): ConsequenceOutcomeCalibrationRecord[] {
    if (!Array.isArray(raw) || typeof resolveVerifiedOutcome !== 'function') return [];
    const accepted: ConsequenceOutcomeCalibrationRecord[] = [];
    const seen = new Set<string>();
    const allowedClasses = new Set(['os', 'device', 'user', 'external-api', 'world']);
    for (const row of raw.slice(-MAX_OUTCOME_CALIBRATIONS)) {
      if (!isRecord(row)) continue;
      const classes = row.sourceClasses;
      const evidenceIds = row.evidenceObservationIds;
      const skill = row.brierSkillScore;
      if (!boundedString(row.id, 180, false) || row.id !== row.outcomeId ||
          !boundedString(row.outcomeId, 180, false) ||
          !boundedString(row.analysisId, 96, false) || !boundedString(row.optionId, 96, false) ||
          !boundedString(row.nodeId, 96, false) || !boundedString(row.scenarioId, 160, false) ||
          !boundedString(row.actionDecisionId, 180, false) ||
          !boundedString(row.executionId, 180, false) || !boundedString(row.observationId, 180, false) ||
          !boundedNumber(row.observedAt, 0, Number.MAX_SAFE_INTEGER) ||
          !boundedNumber(row.forecastProbability01, 0, 1) || typeof row.observed !== 'boolean' ||
          !boundedNumber(row.brierScore01, 0, 1) ||
          !boundedNumber(row.sharedFutureForecastProbability01, 0, 1) ||
          !boundedNumber(row.sharedFutureBrierScore01, 0, 1) ||
          !(skill === null || boundedNumber(skill, -100, 1)) ||
          !boundedString(row.evidenceRef, 500, false) ||
          !boundedInteger(row.independentSourceCount, 1, 16) ||
          !boundedNumber(row.confidence01, 0.68, 1) || !boundedNumber(row.independent01, 0.5, 1) ||
          !boundedStringArray(evidenceIds, 16, 180) || evidenceIds.length < row.independentSourceCount ||
          !boundedStringArray(row.sourceIds, 16, 180) || row.sourceIds.length < row.independentSourceCount ||
          !boundedStringArray(row.independenceKeys, 16, 120) || row.independenceKeys.length < row.independentSourceCount ||
          !Array.isArray(classes) || classes.length > 5 ||
          !classes.every(value => typeof value === 'string' && allowedClasses.has(value)) ||
          row.authority !== 'independent-external' || row.independentlyVerified !== true ||
          seen.has(row.outcomeId)) continue;

      const analysis = analyses.find(item => item.id === row.analysisId);
      const option = analysis?.options.find(item => item.id === row.optionId);
      const node = option?.nodes.find(item => item.id === row.nodeId);
      const binding = option?.decisionBinding;
      let canonicalOutcome: SharedFutureOutcomeRecord | null = null;
      try { canonicalOutcome = resolveVerifiedOutcome(row.outcomeId); } catch { canonicalOutcome = null; }
      if (!analysis || analysis.scenarioId !== row.scenarioId ||
          analysis.createdAt >= row.observedAt ||
          option?.decisionId !== row.actionDecisionId ||
          !binding || binding.actionDecisionId !== row.actionDecisionId ||
          binding.sharedFutureDecisionId !== canonicalOutcome?.sharedFutureDecisionId ||
          binding.scenarioId !== row.scenarioId || binding.consequenceId !== row.nodeId ||
          binding.toolId !== canonicalOutcome?.actionToolId ||
          this.canonicalPostcondition(binding.expectedPostcondition) !==
            this.canonicalPostcondition(canonicalOutcome?.expectedPostcondition ?? '') ||
          !node || Math.abs(node.propagatedProbability01 - row.forecastProbability01) > 1e-9 ||
          !canonicalOutcome || canonicalOutcome.id !== row.outcomeId ||
          canonicalOutcome.authority !== 'independent-external' || canonicalOutcome.independentlyVerified !== true ||
          canonicalOutcome.scenarioId !== row.scenarioId || canonicalOutcome.consequenceId !== row.nodeId ||
          canonicalOutcome.actionDecisionId !== row.actionDecisionId ||
          canonicalOutcome.executionId !== row.executionId || canonicalOutcome.observationId !== row.observationId ||
          canonicalOutcome.observedAt !== row.observedAt ||
          canonicalOutcome.occurred !== row.observed ||
          Math.abs(canonicalOutcome.forecastProbability01 - row.sharedFutureForecastProbability01) > 1e-9 ||
          canonicalOutcome.evidenceRef !== row.evidenceRef ||
          canonicalOutcome.independentSourceCount !== row.independentSourceCount ||
          Math.abs((canonicalOutcome.confidence01 ?? -1) - row.confidence01) > 1e-9 ||
          Math.abs((canonicalOutcome.independent01 ?? -1) - row.independent01) > 1e-9 ||
          new Set(canonicalOutcome.evidenceObservationIds ?? []).size !== row.independentSourceCount ||
          new Set(canonicalOutcome.sourceIds ?? []).size !== row.independentSourceCount ||
          new Set(canonicalOutcome.independenceKeys ?? []).size !== row.independentSourceCount ||
          JSON.stringify([...new Set(canonicalOutcome.evidenceObservationIds ?? [])].slice(0, 16)) !==
            JSON.stringify(row.evidenceObservationIds) ||
          JSON.stringify([...new Set(canonicalOutcome.sourceIds ?? [])].slice(0, 16)) !==
            JSON.stringify(row.sourceIds) ||
          JSON.stringify([...new Set(canonicalOutcome.independenceKeys ?? [])].slice(0, 16)) !==
            JSON.stringify(row.independenceKeys)) continue;
      const canonicalSourceClasses = [...new Set([
        ...(canonicalOutcome.sourceClasses ?? []),
        ...(canonicalOutcome.sourceClass ? [canonicalOutcome.sourceClass] : []),
      ])].slice(0, 5);
      if (JSON.stringify(canonicalSourceClasses) !== JSON.stringify(row.sourceClasses)) continue;

      const target = row.observed ? 1 : 0;
      const recomputedBrier = Math.round(((row.forecastProbability01 - target) ** 2) * 1e12) / 1e12;
      const recomputedBaselineBrier = Math.round(((row.sharedFutureForecastProbability01 - target) ** 2) * 1e12) / 1e12;
      const recomputedSkill = recomputedBaselineBrier > 0
        ? Math.max(-100, Math.min(1, 1 - recomputedBrier / recomputedBaselineBrier))
        : null;
      if (Math.abs(recomputedBrier - row.brierScore01) > 1e-9 ||
          Math.abs(recomputedBaselineBrier - row.sharedFutureBrierScore01) > 1e-9 ||
          (recomputedSkill === null ? skill !== null : typeof skill !== 'number' || Math.abs(recomputedSkill - skill) > 1e-9)) continue;

      seen.add(row.outcomeId);
      accepted.push(structuredClone(row) as unknown as ConsequenceOutcomeCalibrationRecord);
    }
    return accepted;
  }

  restore(raw?: Partial<ConsequenceEcologyState> | null, resolveVerifiedOutcome?: (outcomeId: string) => SharedFutureOutcomeRecord | null): void {
    const source = isRecord(raw) ? raw : {};
    const rows = Array.isArray(source.analyses) ? source.analyses.slice(-MAX_ANALYSES) : [];
    const seen = new Set<string>();
    const analyses: ConsequenceEcologyState['analyses'] = [];
    for (const row of rows) {
      if (!isRecord(row) || !isRestorableAnalysis(row.analysis)) continue;
      const analysis = migrateRestoredAnalysis(row.analysis);
      const id = clean(analysis.id, 96);
      const hash = typeof row.digest === 'string' && /^[a-f0-9]{64}$/i.test(row.digest) ? row.digest.toLowerCase() : '';
      if (!id || seen.has(id) || !hash) continue;
      seen.add(id);
      analyses.push({ digest: hash, analysis: structuredClone(analysis) });
    }
    this.state = {
      version: 1,
      analyses,
      outcomeCalibrations: this.restoreCalibrationRecords(source.outcomeCalibrations, analyses.map(row => row.analysis), resolveVerifiedOutcome),
      rejectedCalibrations: Math.min(1_000_000, Math.max(0, Math.floor(finite(source.rejectedCalibrations)))),
      lastCalibrationAt: Math.max(0, finite(source.lastCalibrationAt)),
      totalAnalyses: Math.min(1_000_000, Math.max(analyses.length, Math.floor(finite(source.totalAnalyses, analyses.length)))),
      rejectedAnalyses: Math.min(1_000_000, Math.max(0, Math.floor(finite(source.rejectedAnalyses)))),
      feedbackLoopsObserved: Math.min(1_000_000, Math.max(0, Math.floor(finite(source.feedbackLoopsObserved)))),
      truncatedAnalyses: Math.min(1_000_000, Math.max(0, Math.floor(finite(source.truncatedAnalyses)))),
      lastAt: Math.max(0, finite(source.lastAt)),
    };
  }

  analyze(
    request: ConsequenceEcologyRequest,
    context: ConsequenceEcologyContext & { scenario?: SharedFutureScenario | null } = {},
  ): { analysis: ConsequenceEcologyAnalysis; replayed: boolean } {
    try {
      const id = clean(request?.id, 96);
      const scenarioId = clean(request?.scenarioId, 160) || null;
      if (!id) throw new Error('consequence-analysis-id-required');
      if (!Array.isArray(request.options) || request.options.length < 1 || request.options.length > MAX_OPTIONS) {
        throw new Error('consequence-option-count-invalid');
      }
      if (!boundedInteger(request.horizonDays, 1, MAX_HORIZON_DAYS)) throw new Error('consequence-horizon-invalid');
      if (request.at !== undefined && !boundedNumber(request.at, 0, Number.MAX_SAFE_INTEGER)) {
        throw new Error('consequence-analysis-timestamp-invalid');
      }
      const horizonDays = request.horizonDays;
      if (scenarioId && (!context.scenario || context.scenario.id !== scenarioId)) {
        throw new Error('consequence-scenario-not-found');
      }

      const assumptions = new Map<string, { confidence01: number; status: string }>();
      for (const assumption of context.scenario?.assumptions ?? []) {
        assumptions.set(assumption.id, { confidence01: clamp(assumption.confidence01), status: assumption.status });
      }
      const scenarioConsequences = context.scenario?.consequences ?? [];
      const decisionBindings: Array<{ optionId: string; decisionId: string; sharedFutureDecisionId: string; scenarioId: string; consequenceId: string; toolId: string; expectedPostcondition: string }> = [];
      const seenActionDecisionIds = new Set<string>();
      const preparedOptions = request.options.map(option => {
        const nodes = [...(Array.isArray(option.nodes) ? option.nodes : [])];
        const edges = [...(Array.isArray(option.edges) ? option.edges : [])];
        const existingIds = new Set(nodes.map(node => clean(node?.id, 96)));
        const decisionId = clean(option?.decisionId, 180);
        if (decisionId) {
          if (!scenarioId || !context.scenario || !context.resolveDecision) throw new Error('consequence-decision-binding-context-required');
          if (seenActionDecisionIds.has(decisionId)) throw new Error('consequence-action-decision-bound-to-multiple-options');
          const decision = context.resolveDecision(decisionId);
          const binding = decision?.actionBinding;
          if (!decision || decision.status !== 'accepted') throw new Error('consequence-action-decision-not-accepted');
          if (decision.scenarioId !== scenarioId || binding?.decisionId !== decisionId) throw new Error('consequence-action-decision-scenario-mismatch');
          const canonicalConsequence = scenarioConsequences.find(consequence => consequence.id === binding.consequenceId);
          if (!canonicalConsequence) throw new Error('consequence-action-binding-node-not-found');
          seenActionDecisionIds.add(decisionId);
          decisionBindings.push({
            optionId: clean(option.id, 96),
            decisionId,
            sharedFutureDecisionId: decision.id,
            scenarioId,
            consequenceId: binding.consequenceId,
            toolId: binding.toolId,
            expectedPostcondition: binding.expectedPostcondition,
          });
        }
        for (const consequence of scenarioConsequences) {
          if (existingIds.has(consequence.id)) {
            const supplied = nodes.find(node => clean(node?.id, 96) === consequence.id);
            if (!supplied || supplied.effect !== 'harm' ||
                supplied.probability01 !== consequence.probability01 ||
                supplied.impact01 !== consequence.impact01 ||
                supplied.delayDays !== consequence.horizonDays ||
                supplied.reversible !== consequence.reversible) {
              throw new Error('consequence-scenario-node-conflict');
            }
            continue;
          }
          nodes.push({
            id: consequence.id,
            description: consequence.description,
            effect: 'harm',
            actor: 'scenario-participants',
            system: 'scenario:' + context.scenario!.id,
            probability01: consequence.probability01,
            impact01: consequence.impact01,
            confidence01: context.scenario!.confidence01,
            delayDays: consequence.horizonDays,
            reversible: consequence.reversible,
            basis: 'user-assumption',
          });
          edges.push({
            id: 'scenario-link:' + consequence.id,
            from: ACTION_NODE,
            to: consequence.id,
            relation: 'causes',
            polarity: 'increase',
            independenceGroup: '__unknown_root_cause__',
            strength01: 1,
            confidence01: context.scenario!.confidence01,
            delayDays: 0,
          });
          existingIds.add(consequence.id);
        }
        return { ...option, nodes, edges };
      });

      const normalizedContext: ConsequenceEcologyContext = {
        goalEcology: normalizeGoalContext(context.goalEcology),
        negativeSpace: normalizeNegativeSpaceContext(context.negativeSpace),
      };
      const requestDigest = digest({
        request: { ...request, horizonDays },
        decisions: decisionBindings,
        scenario: context.scenario ? {
          id: context.scenario.id,
          confidence01: context.scenario.confidence01,
          assumptions: context.scenario.assumptions,
          consequences: context.scenario.consequences,
          goalLinks: context.scenario.goalLinks,
        } : null,
        context: normalizedContext,
      });
      const prior = this.state.analyses.find(row => row.analysis.id === id);
      if (prior) {
        if (prior.digest !== requestDigest) throw new Error('consequence-analysis-id-conflict');
        return { analysis: structuredClone(prior.analysis), replayed: true };
      }
      if (this.state.analyses.length >= MAX_ANALYSES) throw new Error('consequence-analysis-capacity-reached');

      const options = preparedOptions.map(option => {
        const analysed = analyzeOption(option, horizonDays, assumptions);
        const binding = decisionBindings.find(row => row.optionId === analysed.id);
        return {
          ...analysed,
          decisionId: clean(option.decisionId, 180) || null,
          decisionBinding: binding ? {
            sharedFutureDecisionId: binding.sharedFutureDecisionId,
            actionDecisionId: binding.decisionId,
            scenarioId: binding.scenarioId,
            consequenceId: binding.consequenceId,
            toolId: binding.toolId,
            expectedPostcondition: binding.expectedPostcondition,
          } : null,
        };
      }).sort((a, b) => b.riskAdjustedValue01 - a.riskAdjustedValue01 || a.id.localeCompare(b.id));
      options.forEach((option, index) => { option.ranking = index + 1; });
      const top = options[0] ?? null;
      const second = options[1] ?? null;
      const modelTopRankedOptionId = top && top.attention !== 'mandatory-review' && top.graphCoverage01 >= 0.6 &&
        top.uncertainty01 < 0.4 && (!second || top.riskAdjustedValue01 - second.riskAdjustedValue01 >= 0.08)
        ? top.id : null;
      const analysis: ConsequenceEcologyAnalysis = {
        id,
        scenarioId,
        createdAt: Math.max(0, finite(request.at, Date.now())),
        horizonDays,
        status: options.some(option => option.truncated) ? 'bounded-partial' : 'analysed',
        options,
        modelTopRankedOptionId,
        decisionAuthority: 'none',
        independentlyVerified: false,
        context: normalizedContext,
        limitations: [
          'This is a bounded consequence model, not a claim that the causal graph is objectively complete.',
          'A model-ranked option is not an approved decision; canonical governance and ActionGateway remain authoritative.',
          'Synthetic or internal projections are not converted into observed outcomes or independent evidence.',
          'Forecast calibration is diagnostic-only and accepts canonical independently verified Shared Future outcomes; it does not auto-update model weights.',
          ...(context.scenario?.consequences.length ? ['Shared Future consequence rows have no explicit harm/benefit polarity in their current schema and are conservatively treated as harm exposure.'] : []),
        ],
      };
      this.state.analyses = [...this.state.analyses, { digest: requestDigest, analysis }];
      this.state.totalAnalyses++;
      this.state.feedbackLoopsObserved += options.reduce((sum, option) => sum + option.feedbackLoopCount, 0);
      if (analysis.status === 'bounded-partial') this.state.truncatedAnalyses++;
      this.state.lastAt = analysis.createdAt;
      return { analysis: structuredClone(analysis), replayed: false };
    } catch (error) {
      this.state.rejectedAnalyses++;
      throw error;
    }
  }

  recordVerifiedOutcome(input: {
    outcomeId: string;
    analysisId: string;
    optionId: string;
  }): { recorded: boolean; replayed: boolean; independentlyVerified: true; calibration: ConsequenceOutcomeCalibrationRecord } {
    try {
      const outcomeId = clean(input?.outcomeId, 180);
      if (!outcomeId) throw new Error('consequence-outcome-id-required');
      if (!this.verifiedOutcomeResolver) throw new Error('consequence-outcome-resolver-unavailable');
      let outcome: SharedFutureOutcomeRecord | null = null;
      try { outcome = this.verifiedOutcomeResolver(outcomeId); } catch { outcome = null; }
      if (!outcome || outcome.id !== outcomeId || outcome.authority !== 'independent-external' || outcome.independentlyVerified !== true) {
        throw new Error('consequence-outcome-not-independently-verified');
      }
      if (!outcome.actionDecisionId || !outcome.sharedFutureDecisionId || !outcome.actionToolId ||
          typeof outcome.occurred !== 'boolean' ||
          !boundedNumber(outcome.observedAt, 0, Number.MAX_SAFE_INTEGER) ||
          !boundedNumber(outcome.forecastProbability01, 0, 1) ||
          !boundedInteger(outcome.independentSourceCount, 1, 16) ||
          !boundedNumber(outcome.confidence01, 0.68, 1) || !boundedNumber(outcome.independent01, outcome.occurred ? 0.5 : 1, 1) ||
          !Array.isArray(outcome.evidenceObservationIds) || new Set(outcome.evidenceObservationIds).size !== outcome.independentSourceCount ||
          !Array.isArray(outcome.sourceIds) || new Set(outcome.sourceIds).size !== outcome.independentSourceCount ||
          !Array.isArray(outcome.independenceKeys) || new Set(outcome.independenceKeys).size !== outcome.independentSourceCount ||
          !outcome.evidenceRef?.trim()) {
        throw new Error('consequence-outcome-evidence-incomplete');
      }
      const analysisId = clean(input.analysisId, 96);
      const optionId = clean(input.optionId, 96);
      const analysisRow = this.state.analyses.find(row => row.analysis.id === analysisId)?.analysis;
      if (!analysisRow) throw new Error('consequence-calibration-analysis-not-found');
      if (!analysisRow.scenarioId || analysisRow.scenarioId !== outcome.scenarioId) {
        throw new Error('consequence-calibration-scenario-mismatch');
      }
      if (outcome.observedAt <= analysisRow.createdAt) throw new Error('consequence-calibration-outcome-not-after-forecast');
      const option = analysisRow.options.find(row => row.id === optionId);
      if (!option) throw new Error('consequence-calibration-option-not-found');
      const binding = option.decisionBinding;
      if (!option.decisionId || option.decisionId !== outcome.actionDecisionId || !binding ||
          binding.actionDecisionId !== outcome.actionDecisionId ||
          binding.sharedFutureDecisionId !== outcome.sharedFutureDecisionId ||
          binding.scenarioId !== outcome.scenarioId ||
          binding.consequenceId !== outcome.consequenceId ||
          binding.toolId !== outcome.actionToolId ||
          this.canonicalPostcondition(binding.expectedPostcondition) !==
            this.canonicalPostcondition(outcome.expectedPostcondition ?? '')) {
        throw new Error('consequence-calibration-action-decision-mismatch');
      }
      const node = option.nodes.find(row => row.id === outcome.consequenceId);
      if (!node) throw new Error('consequence-calibration-node-not-found');

      const existing = this.state.outcomeCalibrations.find(row => row.outcomeId === outcome.id);
      if (existing) {
        if (existing.analysisId !== analysisId || existing.optionId !== optionId ||
            existing.actionDecisionId !== outcome.actionDecisionId || existing.nodeId !== outcome.consequenceId) {
          throw new Error('consequence-calibration-outcome-already-bound');
        }
        return { recorded: true, replayed: true, independentlyVerified: true, calibration: structuredClone(existing) };
      }
      if (this.state.outcomeCalibrations.length >= MAX_OUTCOME_CALIBRATIONS) {
        throw new Error('consequence-calibration-capacity-reached');
      }

      const observed = outcome.occurred;
      const target = observed ? 1 : 0;
      const forecastProbability01 = node.propagatedProbability01;
      const brierScore01 = Math.round(((forecastProbability01 - target) ** 2) * 1e12) / 1e12;
      const sharedFutureForecastProbability01 = outcome.forecastProbability01;
      const sharedFutureBrierScore01 = Math.round(((sharedFutureForecastProbability01 - target) ** 2) * 1e12) / 1e12;
      const brierSkillScore = sharedFutureBrierScore01 > 0
        ? Math.max(-100, Math.min(1, 1 - brierScore01 / sharedFutureBrierScore01))
        : null;
      const sourceClasses = [...new Set([
        ...(outcome.sourceClasses ?? []),
        ...(outcome.sourceClass ? [outcome.sourceClass] : []),
      ])].slice(0, 5);
      const calibration: ConsequenceOutcomeCalibrationRecord = {
        id: outcome.id,
        outcomeId: outcome.id,
        analysisId,
        optionId,
        nodeId: outcome.consequenceId,
        scenarioId: outcome.scenarioId,
        actionDecisionId: outcome.actionDecisionId,
        executionId: outcome.executionId!,
        observationId: outcome.observationId!,
        observedAt: outcome.observedAt,
        forecastProbability01,
        observed,
        brierScore01,
        sharedFutureForecastProbability01,
        sharedFutureBrierScore01,
        brierSkillScore,
        evidenceRef: outcome.evidenceRef,
        independentSourceCount: outcome.independentSourceCount,
        confidence01: outcome.confidence01!,
        independent01: outcome.independent01!,
        evidenceObservationIds: [...new Set(outcome.evidenceObservationIds)].slice(0, 16),
        sourceIds: [...new Set(outcome.sourceIds)].slice(0, 16),
        sourceClasses,
        independenceKeys: [...new Set(outcome.independenceKeys)].slice(0, 16),
        authority: 'independent-external',
        independentlyVerified: true,
      };
      this.state.outcomeCalibrations = [...this.state.outcomeCalibrations, calibration];
      this.state.lastCalibrationAt = Math.max(this.state.lastCalibrationAt, outcome.observedAt);
      return { recorded: true, replayed: false, independentlyVerified: true, calibration: structuredClone(calibration) };
    } catch (error) {
      this.state.rejectedCalibrations++;
      throw error;
    }
  }

  listCalibrations(limit = 32): ConsequenceOutcomeCalibrationRecord[] {
    const bounded = Math.max(1, Math.min(64, Math.floor(finite(limit, 32))));
    return this.state.outcomeCalibrations.slice(-bounded).reverse().map(row => structuredClone(row));
  }

  get(id: string): ConsequenceEcologyAnalysis | null {
    const row = this.state.analyses.find(item => item.analysis.id === id);
    return row ? structuredClone(row.analysis) : null;
  }

  list(limit = 16): ConsequenceEcologyAnalysis[] {
    const bounded = Math.max(1, Math.min(32, Math.floor(finite(limit, 16))));
    return this.state.analyses.slice(-bounded).reverse().map(row => structuredClone(row.analysis));
  }

  diagnostics() {
    const analyses = this.state.analyses.map(row => row.analysis);
    const options = analyses.flatMap(row => row.options);
    const calibrations = this.state.outcomeCalibrations;
    const calibrationScenarioCount = new Set(calibrations.map(row => row.scenarioId)).size;
    const calibrationDecisionCount = new Set(calibrations.map(row => row.actionDecisionId)).size;
    const calibrationExecutionCount = new Set(calibrations.map(row => row.executionId)).size;
    const calibrationObservationCount = new Set(calibrations.map(row => row.observationId)).size;
    const calibrationEvidenceObservationCount = new Set(calibrations.flatMap(row => row.evidenceObservationIds)).size;
    const calibrationSourceIds = new Set(calibrations.flatMap(row => row.sourceIds));
    const calibrationIndependenceKeys = new Set(calibrations.flatMap(row => row.independenceKeys));
    const calibrationSourceClasses = new Set(calibrations.flatMap(row => row.sourceClasses));
    const hasObservedPositive = calibrations.some(row => row.observed);
    const hasObservedNegative = calibrations.some(row => !row.observed);
    const calibrationWeight = (row: ConsequenceOutcomeCalibrationRecord) =>
      Math.max(0, Math.min(1, row.confidence01 * row.independent01));
    const totalCalibrationWeight = calibrations.reduce((sum, row) => sum + calibrationWeight(row), 0);
    const squaredCalibrationWeight = calibrations.reduce((sum, row) => sum + calibrationWeight(row) ** 2, 0);
    const effectiveCalibrationSampleSize = squaredCalibrationWeight > 0
      ? totalCalibrationWeight ** 2 / squaredCalibrationWeight
      : 0;
    const calibrationIndependentEvidenceClusterCount =
      countIndependentCalibrationEvidenceClusters(calibrations);
    const lineageAdjustedEffectiveSampleSize = Math.min(
      effectiveCalibrationSampleSize,
      calibrationIndependentEvidenceClusterCount,
    );
    const meanCalibrationBrier01 = calibrations.length
      ? calibrations.reduce((sum, row) => sum + row.brierScore01, 0) / calibrations.length
      : null;
    const meanSharedFutureBaselineBrier01 = calibrations.length
      ? calibrations.reduce((sum, row) => sum + row.sharedFutureBrierScore01, 0) / calibrations.length
      : null;
    const weightedMeanCalibrationBrier01 = totalCalibrationWeight > 0
      ? calibrations.reduce((sum, row) => sum + calibrationWeight(row) * row.brierScore01, 0) / totalCalibrationWeight
      : null;
    const weightedMeanSharedFutureBaselineBrier01 = totalCalibrationWeight > 0
      ? calibrations.reduce((sum, row) => sum + calibrationWeight(row) * row.sharedFutureBrierScore01, 0) / totalCalibrationWeight
      : null;
    const wilson95 = (successes: number, count: number): { lower01: number; upper01: number } | null => {
      if (!count) return null;
      const z = 1.959963984540054;
      const observed = successes / count;
      const denominator = 1 + z * z / count;
      const center = (observed + z * z / (2 * count)) / denominator;
      const margin = z * Math.sqrt((observed * (1 - observed) / count) + (z * z / (4 * count * count))) / denominator;
      return { lower01: Math.max(0, center - margin), upper01: Math.min(1, center + margin) };
    };
    const calibrationBins = Array.from({ length: 5 }, (_, index) => {
      const lower = index / 5;
      const upper = (index + 1) / 5;
      const rows = calibrations.filter(row => row.forecastProbability01 >= lower &&
        (index === 4 ? row.forecastProbability01 <= upper : row.forecastProbability01 < upper));
      const binWeight = rows.reduce((sum, row) => sum + calibrationWeight(row), 0);
      const observedCount = rows.filter(row => row.observed).length;
      const interval = wilson95(observedCount, rows.length);
      return {
        lower01: lower,
        upper01: upper,
        count: rows.length,
        meanForecastProbability01: rows.length ? rows.reduce((sum, row) => sum + row.forecastProbability01, 0) / rows.length : null,
        observedFrequency01: rows.length ? observedCount / rows.length : null,
        lower95ObservedFrequency01: interval?.lower01 ?? null,
        upper95ObservedFrequency01: interval?.upper01 ?? null,
        weight: binWeight,
        weightedMeanForecastProbability01: binWeight
          ? rows.reduce((sum, row) => sum + calibrationWeight(row) * row.forecastProbability01, 0) / binWeight
          : null,
        weightedObservedFrequency01: binWeight
          ? rows.reduce((sum, row) => sum + calibrationWeight(row) * (row.observed ? 1 : 0), 0) / binWeight
          : null,
      };
    });
    const expectedCalibrationError01 = calibrations.length
      ? calibrationBins.reduce((sum, bin) => sum + (bin.count / calibrations.length) *
        Math.abs((bin.meanForecastProbability01 ?? 0) - (bin.observedFrequency01 ?? 0)), 0)
      : null;
    const weightedExpectedCalibrationError01 = totalCalibrationWeight > 0
      ? calibrationBins.reduce((sum, bin) => sum + (bin.weight / totalCalibrationWeight) *
        Math.abs((bin.weightedMeanForecastProbability01 ?? 0) - (bin.weightedObservedFrequency01 ?? 0)), 0)
      : null;
    const calibrationReadinessReasons = [
      ...(calibrations.length < 20 ? ['need-at-least-20-verified-samples'] : []),
      ...(calibrationScenarioCount < 5 ? ['need-at-least-5-distinct-scenarios'] : []),
      ...(calibrationDecisionCount < 10 ? ['need-at-least-10-distinct-action-decisions'] : []),
      ...(calibrationExecutionCount < 20 ? ['need-at-least-20-distinct-executions'] : []),
      ...(calibrationObservationCount < 20 ? ['need-at-least-20-distinct-observations'] : []),
      ...(calibrationEvidenceObservationCount < 20 ? ['need-at-least-20-distinct-evidence-observations'] : []),
      ...(effectiveCalibrationSampleSize < 15 ? ['effective-sample-size-below-15'] : []),
      ...(calibrationIndependentEvidenceClusterCount < 15 ? ['independent-evidence-clusters-below-15'] : []),
      ...(calibrationSourceIds.size < 3 ? ['need-at-least-3-distinct-evidence-sources'] : []),
      ...(calibrationIndependenceKeys.size < 3 ? ['need-at-least-3-distinct-independence-keys'] : []),
      ...(calibrationSourceClasses.size < 2 ? ['need-at-least-2-evidence-source-classes'] : []),
      ...(!hasObservedPositive || !hasObservedNegative ? ['need-both-positive-and-negative-observed-outcomes'] : []),
    ];
    const calibrationSampleSufficient = calibrationReadinessReasons.length === 0;
    return {
      version: 1 as const,
      retainedAnalyses: analyses.length,
      totalAnalyses: this.state.totalAnalyses,
      rejectedAnalyses: this.state.rejectedAnalyses,
      comparedOptions: options.length,
      feedbackLoopsObserved: this.state.feedbackLoopsObserved,
      truncatedAnalyses: this.state.truncatedAnalyses,
      verifiedCalibrationSamples: calibrations.length,
      rejectedCalibrations: this.state.rejectedCalibrations,
      calibrationScenarioCount,
      calibrationDecisionCount,
      calibrationExecutionCount,
      calibrationObservationCount,
      calibrationEvidenceObservationCount,
      calibrationSourceCount: calibrationSourceIds.size,
      calibrationIndependenceKeyCount: calibrationIndependenceKeys.size,
      calibrationSourceClassCount: calibrationSourceClasses.size,
      hasObservedPositive,
      hasObservedNegative,
      meanCalibrationBrier01,
      meanSharedFutureBaselineBrier01,
      brierSkillScore: meanCalibrationBrier01 !== null && meanSharedFutureBaselineBrier01 !== null &&
        meanSharedFutureBaselineBrier01 > 0
        ? 1 - meanCalibrationBrier01 / meanSharedFutureBaselineBrier01
        : null,
      weightedMeanCalibrationBrier01,
      weightedMeanSharedFutureBaselineBrier01,
      weightedBrierSkillScore: weightedMeanCalibrationBrier01 !== null &&
        weightedMeanSharedFutureBaselineBrier01 !== null && weightedMeanSharedFutureBaselineBrier01 > 0
        ? 1 - weightedMeanCalibrationBrier01 / weightedMeanSharedFutureBaselineBrier01
        : null,
      effectiveCalibrationSampleSize,
      calibrationIndependentEvidenceClusterCount,
      lineageAdjustedEffectiveSampleSize,
      expectedCalibrationError01,
      weightedExpectedCalibrationError01,
      calibrationBins,
      calibrationSampleSufficient,
      calibrationReadinessReasons,
      calibrationReadiness: calibrationSampleSufficient ? 'sample-sufficient-for-review' as const : 'insufficient-evidence' as const,
      modelWeightsUpdated: false as const,
      lastCalibrationAt: this.state.lastCalibrationAt,
      meanUncertainty01: options.length
        ? options.reduce((sum, option) => sum + option.uncertainty01, 0) / options.length
        : 0,
      meanGraphCoverage01: options.length
        ? options.reduce((sum, option) => sum + option.graphCoverage01, 0) / options.length
        : 0,
      meanCounterfactualCoverage01: options.length
        ? options.reduce((sum, option) => sum + option.counterfactualCoverage01, 0) / options.length
        : 0,
      correlatedPathMerges: options.reduce((sum, option) => sum + option.correlatedPathMerges, 0),
      meanWorstStakeholderHarm01: options.length
        ? options.reduce((sum, option) => sum + option.worstStakeholderHarm01, 0) / options.length
        : 0,
      meanBenefitBurdenSeparation01: options.length
        ? options.reduce((sum, option) => sum + option.benefitBurdenSeparation01, 0) / options.length
        : 0,
      highConcentrationOptions: options.filter(option =>
        option.topStakeholderHarmShare01 >= 0.75 && option.worstStakeholderHarm01 >= 0.2).length,
      mandatoryDistributionReviewOptions: options.filter(option => option.worstStakeholderHarm01 >= 0.6).length,
      bounded: analyses.length <= MAX_ANALYSES && options.every(option =>
        option.nodes.length <= MAX_NODES && option.feedbackLoops.length <= 16),
      decisionAuthority: 'none' as const,
      independentlyVerified: false as const,
      lastAt: this.state.lastAt,
    };
  }
}
