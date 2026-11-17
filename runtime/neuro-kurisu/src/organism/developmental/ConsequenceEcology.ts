import { createHash } from 'node:crypto';
import type { SharedFutureScenario } from './SharedFutureEngine.ts';

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

export interface ConsequenceEcologyState {
  version: 1;
  analyses: Array<{ digest: string; analysis: ConsequenceEcologyAnalysis }>;
  totalAnalyses: number;
  rejectedAnalyses: number;
  feedbackLoopsObserved: number;
  truncatedAnalyses: number;
  lastAt: number;
}

const ACTION_NODE = '__action__';
const MAX_ANALYSES = 128;
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
    option.counterfactualCoverage01 ??= 0;
    option.attributableHarm01 ??= 0;
    option.avoidedHarm01 ??= 0;
    option.attributableBenefit01 ??= 0;
    option.lostBenefit01 ??= 0;
    option.netAttributableValue01 ??= 0;
    option.correlatedPathMerges ??= 0;
    for (const node of option.nodes) {
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
        !boundedInteger(option.feedbackLoopCount, 0, MAX_PATHS) ||
        !boundedInteger(option.excludedBeyondHorizon, 0, MAX_PATHS) ||
        !boundedInteger(option.unreachableNodeCount, 0, MAX_NODES) ||
        !boundedInteger(option.exploredPathCount, 0, MAX_PATHS) || typeof option.truncated !== 'boolean' ||
        !Array.isArray(option.nodes) || option.nodes.length < 1 || option.nodes.length > MAX_NODES ||
        !Array.isArray(option.stakeholders) || option.stakeholders.length > MAX_NODES ||
        !isRecord(option.temporalEffects) || !Array.isArray(option.criticalPaths) || option.criticalPaths.length > 8 ||
        !Array.isArray(option.feedbackLoops) || option.feedbackLoops.length > 16 ||
        !boundedStringArray(option.missingAssumptionRefs, MAX_NODES * 8, 128) ||
        !boundedStringArray(option.limitations, 12, 320)) return false;

    if (!option.temporalEffects ||
        !['immediateHarm01', 'shortTermHarm01', 'longTermHarm01', 'immediateBenefit01', 'shortTermBenefit01', 'longTermBenefit01']
          .every(key => boundedNumber(option.temporalEffects[key], 0, 1))) return false;

    if (!option.nodes.every(node => isRecord(node) &&
        boundedString(node.id, 96, false) && boundedString(node.description, 320) && boundedString(node.actor, 96, false) &&
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
    const node: ConsequenceNodeInput = {
      id,
      description: clean(raw.description, 320),
      effect,
      actor: clean(raw.actor, 96) || 'unspecified',
      system: clean(raw.system, 96) || 'unspecified',
      probability01: clamp(finite(raw.probability01)),
      impact01: clamp(finite(raw.impact01)),
      confidence01: clamp(finite(raw.confidence01)),
      delayDays: clamp(finite(raw.delayDays), 0, MAX_HORIZON_DAYS),
      reversible: raw.reversible,
      basis,
      evidenceRefs: Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs.map(x => clean(x, 180)).filter(Boolean).slice(0, 8) : [],
      assumptionRefs: Array.isArray(raw.assumptionRefs) ? raw.assumptionRefs.map(x => clean(x, 128)).filter(Boolean).slice(0, 8) : [],
      baselineProbability01: boundedNumber(raw.baselineProbability01, 0, 1) ? raw.baselineProbability01 : null,
    };
    const confidence = assumptionConfidence(node, assumptions);
    nodes.set(id, { ...node, effectiveConfidence01: confidence.confidence01, missingAssumptionRefs: confidence.missing });
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
    edgeIds.add(id);
    edges.push({
      id, from, to,
      relation: raw.relation,
      polarity: raw.polarity,
      strength01: clamp(finite(raw.strength01)),
      confidence01: clamp(finite(raw.confidence01)),
      delayDays: clamp(finite(raw.delayDays), 0, MAX_HORIZON_DAYS),
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
  const attention: ConsequenceOptionResult['attention'] =
    (irreversibleExposure01 >= 0.25 || totalHarm01 >= 0.7) ? 'mandatory-review'
    : (uncertainty01 >= 0.45 || graphCoverage01 < 0.6 || totalHarm01 >= 0.4) ? 'enhanced-review'
    : 'routine-review';
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
  if (!rows.length) limitations.push('No consequence node was reachable from the proposed action.');
  return {
    id: clean(option.id, 96),
    title: clean(option.title, 180),
    action: clean(option.action, 180),
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

  snapshot(): ConsequenceEcologyState {
    return structuredClone(this.state);
  }

  restore(raw?: Partial<ConsequenceEcologyState> | null): void {
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
      const horizonDays = Math.floor(clamp(finite(request.horizonDays), 1, MAX_HORIZON_DAYS));
      if (scenarioId && (!context.scenario || context.scenario.id !== scenarioId)) {
        throw new Error('consequence-scenario-not-found');
      }

      const assumptions = new Map<string, { confidence01: number; status: string }>();
      for (const assumption of context.scenario?.assumptions ?? []) {
        assumptions.set(assumption.id, { confidence01: clamp(assumption.confidence01), status: assumption.status });
      }
      const scenarioConsequences = context.scenario?.consequences ?? [];
      const preparedOptions = request.options.map(option => {
        const nodes = [...(Array.isArray(option.nodes) ? option.nodes : [])];
        const edges = [...(Array.isArray(option.edges) ? option.edges : [])];
        const existingIds = new Set(nodes.map(node => clean(node?.id, 96)));
        for (const consequence of scenarioConsequences) {
          if (existingIds.has(consequence.id)) continue;
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

      const options = preparedOptions.map(option => analyzeOption(option, horizonDays, assumptions))
        .sort((a, b) => b.riskAdjustedValue01 - a.riskAdjustedValue01 || a.id.localeCompare(b.id));
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
    return {
      version: 1 as const,
      retainedAnalyses: analyses.length,
      totalAnalyses: this.state.totalAnalyses,
      rejectedAnalyses: this.state.rejectedAnalyses,
      comparedOptions: options.length,
      feedbackLoopsObserved: this.state.feedbackLoopsObserved,
      truncatedAnalyses: this.state.truncatedAnalyses,
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
      bounded: analyses.length <= MAX_ANALYSES && options.every(option =>
        option.nodes.length <= MAX_NODES && option.feedbackLoops.length <= 16),
      decisionAuthority: 'none' as const,
      independentlyVerified: false as const,
      lastAt: this.state.lastAt,
    };
  }
}
