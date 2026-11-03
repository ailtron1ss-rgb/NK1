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

export const DEFAULT_DIVERGENCE_POLICY: DivergencePolicy = Object.freeze({
  minPairs: 5,
  maxMeanDivergence: 0.15,
  maxInversionRate: 0.2,
});

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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try { const prototype = Object.getPrototypeOf(value); return prototype === Object.prototype || prototype === null; }
  catch { return false; }
}
function ownData(value: Record<string, unknown>, key: string): unknown {
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined; }
  catch { return undefined; }
}
function denseArray(value: unknown, maximum = 10_000): unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : Number.NaN;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > maximum) return null;
    const rows: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const item = Object.getOwnPropertyDescriptor(value, String(index));
      if (!item || !Object.prototype.hasOwnProperty.call(item, 'value')) return null;
      rows.push(item.value);
    }
    return rows;
  } catch { return null; }
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Policy is an authorization input, not a tuning hint. Reject malformed, inherited,
 * accessor-backed or out-of-range policy values rather than allowing NaN comparisons
 * to silently skip every refusal threshold.
 */
function readValidPolicy(value: unknown): DivergencePolicy | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const read = (key: keyof DivergencePolicy): number | null => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      return finite(descriptor.value);
    };
    const minPairs = read('minPairs');
    const maxMeanDivergence = read('maxMeanDivergence');
    const maxInversionRate = read('maxInversionRate');
    if (minPairs === null || !Number.isInteger(minPairs) || minPairs < 1 || minPairs > 10000) return null;
    if (maxMeanDivergence === null || maxMeanDivergence < 0 || maxMeanDivergence > 2) return null;
    if (maxInversionRate === null || maxInversionRate < 0 || maxInversionRate > 1) return null;
    return { minPairs, maxMeanDivergence, maxInversionRate };
  } catch {
    return null;
  }
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
  for (const raw of denseArray(observations) ?? []) {
    if (!isPlainRecord(raw)) continue;
    const rawId = ownData(raw, 'id');
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    const proxyGain = finite(ownData(raw, 'proxyGain'));
    const downstreamGain = finite(ownData(raw, 'downstreamGain'));
    if (!id || id.length > 128 || proxyGain === null || downstreamGain === null ||
        Math.abs(proxyGain) > 1 || Math.abs(downstreamGain) > 1 || seen.has(id)) continue;
    seen.add(id);
    rows.push({ id, proxyGain, downstreamGain });
  }

  const pairs = rows.length;
  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  const safePolicy = readValidPolicy(policy);
  if (!safePolicy) {
    return {
      decision: 'refused',
      reason: 'invalid-divergence-policy',
      pairs,
      meanProxyGain: mean(rows.map((r) => r.proxyGain)),
      meanDownstreamGain: mean(rows.map((r) => r.downstreamGain)),
      meanDivergence: 0,
      inversionRate: 0,
    };
  }

  if (pairs < safePolicy.minPairs) {
    return {
      decision: 'refused',
      reason: `insufficient-paired-observations:${pairs}<${safePolicy.minPairs}`,
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
  if (inversionRate > safePolicy.maxInversionRate) {
    decision = 'refused';
    reason = `inversion-rate:${inversionRate.toFixed(3)}>${safePolicy.maxInversionRate}`;
  } else if (meanDivergence > safePolicy.maxMeanDivergence) {
    decision = 'refused';
    reason = `mean-divergence:${meanDivergence.toFixed(3)}>${safePolicy.maxMeanDivergence}`;
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
  const normalizeRows = (value: readonly PairedRateSummary[]) => {
    const result: PairedRateSummary[] = [];
    for (const raw of denseArray(value) ?? []) {
      if (!isPlainRecord(raw)) continue;
      const family = ownData(raw, 'family');
      const baselinePassRate = finite(ownData(raw, 'baselinePassRate'));
      const candidatePassRate = finite(ownData(raw, 'candidatePassRate'));
      if ((family !== undefined && (typeof family !== 'string' || !family.trim() || family.length > 128)) ||
          baselinePassRate === null || candidatePassRate === null ||
          baselinePassRate < 0 || baselinePassRate > 1 || candidatePassRate < 0 || candidatePassRate > 1) continue;
      result.push({ ...(typeof family === 'string' ? { family: family.trim().normalize('NFKC') } : {}), baselinePassRate, candidatePassRate });
    }
    return result;
  };
  const downstreamByFamily = new Map<string, PairedRateSummary>();
  const duplicateDownstreamFamilies = new Set<string>();
  for (const row of normalizeRows(downstream)) {
    const family = typeof row.family === 'string' ? row.family : '';
    if (!family) continue;
    if (downstreamByFamily.has(family)) { downstreamByFamily.delete(family); duplicateDownstreamFamilies.add(family); continue; }
    if (!duplicateDownstreamFamilies.has(family)) downstreamByFamily.set(family, row);
  }
  const proxyByFamily = new Map<string, PairedRateSummary>();
  const duplicateProxyFamilies = new Set<string>();
  for (const row of normalizeRows(proxy)) {
    const family = typeof row.family === 'string' ? row.family : '';
    if (!family) continue;
    if (proxyByFamily.has(family)) { proxyByFamily.delete(family); duplicateProxyFamilies.add(family); continue; }
    if (!duplicateProxyFamilies.has(family)) proxyByFamily.set(family, row);
  }
  const observations: PairedObservation[] = [];
  for (const [family, row] of proxyByFamily) {
    if (duplicateProxyFamilies.has(family) || duplicateDownstreamFamilies.has(family)) continue;
    const match = downstreamByFamily.get(family);
    if (!match) continue;
    observations.push({
      id: family,
      proxyGain: (row.candidatePassRate as number) - (row.baselinePassRate as number),
      downstreamGain: (match.candidatePassRate as number) - (match.baselinePassRate as number),
    });
  }
  return observations;
}
