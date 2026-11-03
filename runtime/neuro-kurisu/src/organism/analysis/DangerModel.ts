/**
 * Danger understanding for self-modification candidates.
 *
 * The structural guard answers a binary question ("is this file protected?").
 * This model answers the question an operator actually asks before approving a
 * rewrite: how much damage can this change do, how reversible is it, and how well
 * is its success actually evidenced? The three axes are computed from the source
 * graph and the candidate's own paired evidence, never from a self-declared label,
 * so a candidate cannot lower its own danger score by asserting that it is safe.
 *
 * Danger is scored on [0, 1]. It is an advisory risk ordering, not an authorization
 * decision: the pool still refuses a candidate when its reversible/monitored
 * preconditions fail. A high score means "review before promotion", not "allow".
 */

import type { SourceGraph } from './SourceGraph.ts';
import { impactOf } from './SourceGraph.ts';

export interface DangerFactor {
  /** Stable machine key, safe to match on. */
  key: string;
  /** Weight this factor contributes to the final score, on [0, 1]. */
  weight01: number;
  /** Human-readable explanation of why the factor fired. */
  detail: string;
}

export interface DangerAssessment {
  score01: number;
  /** 'low' | 'moderate' | 'high' | 'critical' */
  band: 'low' | 'moderate' | 'high' | 'critical';
  reversible: boolean;
  /** Fraction of the codebase's files that transitively depend on the targets. */
  blastRadius01: number;
  blastRadiusFiles: number;
  /** Number of protected capability files the candidate would touch. */
  protectedHits: number;
  factors: DangerFactor[];
  reason: string;
}

export interface DangerThresholds {
  /** Reject when the danger score reaches this value. */
  maxDanger01: number;
  /** Reject when the blast radius fraction reaches this value. */
  maxBlastRadius01: number;
}

export const DEFAULT_DANGER_THRESHOLDS: DangerThresholds = Object.freeze({
  maxDanger01: 0.7,
  maxBlastRadius01: 0.35,
});

export interface DangerInput {
  candidateId: string;
  targetFiles: string[];
  rollbackReady: boolean;
  /** Mean paired downstream gain backing the candidate; 0 when unmeasured. */
  meanDownstreamGain: number;
  /** Mean |proxy - downstream| divergence across paired observations. */
  meanDivergence: number;
  /** Number of paired observations supplied. */
  observationCount: number;
  /** Protected capability files the structural guard already flagged. */
  protectedHits: number;
}

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);
const SENSITIVE_PATH_FRAGMENTS: readonly string[] = Object.freeze([
  'core/OrganismCore',
  'core/OrganismRuntime',
  'persistence',
  'identity',
  'canon',
  'security',
  'consent',
  'arbiter',
]);

function band(score01: number): DangerAssessment['band'] {
  if (score01 >= 0.85) return 'critical';
  if (score01 >= 0.6) return 'high';
  if (score01 >= 0.3) return 'moderate';
  return 'low';
}

/**
 * Transitive file-level blast radius of a set of target files. Uses reverse
 * reachability over the graph, so a change to a widely imported module scores
 * higher than a change to a leaf.
 */
export function blastRadius(graph: SourceGraph, targetFiles: readonly string[]): { files: string[]; fraction01: number } {
  const impacted = new Set<string>();
  for (const target of targetFiles) {
    for (const dependent of impactOf(graph, `${target}#__module__`)) {
      const file = dependent.split('#')[0];
      if (file && !targetFiles.includes(file)) impacted.add(file);
    }
  }
  const total = Math.max(1, graph.files.length);
  const files = [...impacted].sort();
  return { files, fraction01: clamp01(files.length / total) };
}

export function assessDanger(input: DangerInput, graph: SourceGraph, thresholds: DangerThresholds = DEFAULT_DANGER_THRESHOLDS): DangerAssessment {
  const factors: DangerFactor[] = [];

  const radius = blastRadius(graph, input.targetFiles);
  const protectedHits = Math.max(0, input.protectedHits);
  const sensitive = input.targetFiles.filter(file => SENSITIVE_PATH_FRAGMENTS.some(fragment => file.includes(fragment)));

  // Reversibility is a gate, not a weight: an irreversible change is the single
  // most dangerous property and dominates the score.
  const reversible = input.rollbackReady === true;
  if (!reversible) factors.push({ key: 'no-rollback-path', weight01: 1, detail: 'candidate has no rollback path' });

  if (protectedHits > 0) {
    factors.push({ key: 'protected-capability', weight01: clamp01(0.4 + 0.2 * protectedHits), detail: `touches ${protectedHits} protected capability file(s)` });
  }
  if (radius.fraction01 > 0) {
    factors.push({ key: 'blast-radius', weight01: radius.fraction01, detail: `${radius.files.length} file(s) transitively depend on the targets` });
  }
  if (sensitive.length > 0) {
    factors.push({ key: 'sensitive-subsystem', weight01: clamp01(0.3 + 0.1 * sensitive.length), detail: `targets sensitive subsystem(s): ${sensitive.join(', ')}` });
  }
  if (input.observationCount === 0) {
    factors.push({ key: 'unmeasured', weight01: 0.5, detail: 'no paired downstream evidence supplied' });
  }
  if (input.meanDownstreamGain <= 0) {
    factors.push({ key: 'no-measured-gain', weight01: 0.35, detail: 'measured downstream gain is zero or negative' });
  }
  if (input.meanDivergence > 0.15) {
    factors.push({ key: 'proxy-divergence', weight01: clamp01(input.meanDivergence), detail: `proxy/downstream divergence ${input.meanDivergence.toFixed(3)}` });
  }
  if (input.targetFiles.length > 8) {
    factors.push({ key: 'broad-surface', weight01: clamp01((input.targetFiles.length - 8) / 24), detail: `${input.targetFiles.length} target files in one change` });
  }

  // Noisy-OR combination: independent risk factors each raise danger, and one
  // dominant factor (e.g. no rollback) is enough to reach the top of the band.
  let inverse = 1;
  for (const factor of factors) inverse *= 1 - clamp01(factor.weight01);
  const score01 = clamp01(1 - inverse);

  const breached = !reversible || score01 > thresholds.maxDanger01 || radius.fraction01 > thresholds.maxBlastRadius01;
  const reason = breached
    ? `danger:${!reversible ? 'irreversible' : (score01 > thresholds.maxDanger01 ? `score-${score01.toFixed(3)}` : `blast-${radius.fraction01.toFixed(3)}`)}`
    : 'within-safe-envelope';

  return {
    score01,
    band: band(score01),
    reversible,
    blastRadius01: radius.fraction01,
    blastRadiusFiles: radius.files.length,
    protectedHits,
    factors,
    reason,
  };
}

/** True when the assessment clears the advisory envelope and may proceed to review. */
export function isWithinDangerEnvelope(assessment: DangerAssessment, thresholds: DangerThresholds = DEFAULT_DANGER_THRESHOLDS): boolean {
  return assessment.reversible && assessment.score01 <= thresholds.maxDanger01 && assessment.blastRadius01 <= thresholds.maxBlastRadius01;
}
