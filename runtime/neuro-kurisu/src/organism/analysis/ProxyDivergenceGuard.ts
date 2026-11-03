/**
 * Detects the failure mode that dominates documented 2026 self-improvement incidents:
 * a candidate raises the metric it is scored on without raising the outcome that
 * metric was supposed to stand for.
 *
 * The concrete evidence for treating this as a first-class guard rather than a
 * reporting nicety: in a 2026 KernelBench study, 73.8% of optimizations produced by
 * self-improving code agents showed proxy gains with no real gain, and two widely
 * reported agent incidents ended with the agent editing its own scorer. A promotion
 * gate that only reads the proxy cannot see any of this.
 *
 * The guard compares paired observations of (proxyGain, downstreamGain). It refuses
 * when the downstream evidence is too thin to support a claim, and when the proxy
 * systematically exceeds the downstream effect. Refusal is the default: a candidate
 * with no paired downstream observations is refused, not passed.
 */

export interface PairedObservation {
  /** Identifier of the task/seed the pair belongs to; duplicates are rejected. */
  id: string;
  /** Improvement measured on the proxy metric the optimizer can see. */
  proxyGain: number;
  /** Improvement measured on the independent outcome the proxy stands for. */
  downstreamGain: number;
}

export interface DivergencePolicy {
  /** Minimum distinct paired observations before any claim is allowed. */
  minPairs: number;
  /** Maximum tolerated mean(proxyGain) - mean(downstreamGain). */
  maxMeanDivergence: number;
  /** Maximum tolerated fraction of pairs where proxy rises while downstream falls. */
  maxInversionRate: number;
}

export const DEFAULT_DIVERGENCE_POLICY: DivergencePolicy = {
  minPairs: 5,
  maxMeanDivergence: 0.15,
  maxInversionRate: 0.2,
};

export type DivergenceDecision = 'supported' | 'refused';

export interface DivergenceResult {
  decision: DivergenceDecision;
  reason: string;
  pairs: number;
  meanProxyGain: number;
  meanDownstreamGain: number;
  meanDivergence: number;
  inversionRate: number;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Evaluates whether the proxy improvement is backed by downstream improvement.
 * Malformed rows are dropped rather than silently treated as zero, and duplicate
 * ids are collapsed to the first occurrence so a candidate cannot inflate its
 * sample by repeating one favourable pair.
 */
export function evaluateProxyDivergence(
  observations: readonly PairedObservation[],
  policy: DivergencePolicy = DEFAULT_DIVERGENCE_POLICY,
): DivergenceResult {
  const rows: PairedObservation[] = [];
  const seen = new Set<string>();
  for (const row of Array.isArray(observations) ? observations : []) {
    const id = typeof row?.id === 'string' ? row.id.trim() : '';
    const proxyGain = finite(row?.proxyGain);
    const downstreamGain = finite(row?.downstreamGain);
    if (!id || proxyGain === null || downstreamGain === null || seen.has(id)) continue;
    seen.add(id);
    rows.push({ id, proxyGain, downstreamGain });
  }

  const pairs = rows.length;
  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

  if (pairs < policy.minPairs) {
    return {
      decision: 'refused',
      reason: `insufficient-paired-observations:${pairs}<${policy.minPairs}`,
      pairs,
      meanProxyGain: mean(rows.map((r) => r.proxyGain)),
      meanDownstreamGain: mean(rows.map((r) => r.downstreamGain)),
      meanDivergence: 0,
      inversionRate: 0,
    };
  }

  const meanProxyGain = mean(rows.map((r) => r.proxyGain));
  const meanDownstreamGain = mean(rows.map((r) => r.downstreamGain));
  const meanDivergence = meanProxyGain - meanDownstreamGain;
  const inversions = rows.filter((r) => r.proxyGain > 0 && r.downstreamGain < 0).length;
  const inversionRate = inversions / pairs;

  let decision: DivergenceDecision = 'supported';
  let reason = 'proxy-supported-by-downstream';
  if (inversionRate > policy.maxInversionRate) {
    decision = 'refused';
    reason = `inversion-rate:${inversionRate.toFixed(3)}>${policy.maxInversionRate}`;
  } else if (meanDivergence > policy.maxMeanDivergence) {
    decision = 'refused';
    reason = `mean-divergence:${meanDivergence.toFixed(3)}>${policy.maxMeanDivergence}`;
  } else if (meanDownstreamGain <= 0) {
    decision = 'refused';
    reason = 'no-downstream-gain';
  }

  return {
    decision,
    reason,
    pairs,
    meanProxyGain,
    meanDownstreamGain,
    meanDivergence,
    inversionRate,
  };
}

/** Minimal shape needed from a paired comparison to form one divergence observation. */
export interface PairedRateSummary {
  family?: string;
  baselinePassRate: number;
  candidatePassRate: number;
}

/**
 * Pairs proxy and downstream comparisons by family so the guard can run on real
 * ledger output. A family present in only one side is dropped, which lowers the
 * pair count and therefore biases the guard toward refusal — the intended direction
 * when evidence is incomplete.
 */
export function toDivergenceObservations(
  proxy: readonly PairedRateSummary[],
  downstream: readonly PairedRateSummary[],
): PairedObservation[] {
  const downstreamByFamily = new Map<string, PairedRateSummary>();
  for (const row of Array.isArray(downstream) ? downstream : []) {
    const family = typeof row?.family === 'string' ? row.family.trim() : '';
    if (!family) continue;
    downstreamByFamily.set(family, row);
  }

  const observations: PairedObservation[] = [];
  for (const row of Array.isArray(proxy) ? proxy : []) {
    const family = typeof row?.family === 'string' ? row.family.trim() : '';
    if (!family) continue;
    const match = downstreamByFamily.get(family);
    if (!match) continue;
    const proxyGain = finite(row?.candidatePassRate) !== null && finite(row?.baselinePassRate) !== null
      ? (row.candidatePassRate as number) - (row.baselinePassRate as number)
      : null;
    const downstreamGain = finite(match?.candidatePassRate) !== null && finite(match?.baselinePassRate) !== null
      ? (match.candidatePassRate as number) - (match.baselinePassRate as number)
      : null;
    if (proxyGain === null || downstreamGain === null) continue;
    observations.push({ id: family, proxyGain, downstreamGain });
  }
  return observations;
}
