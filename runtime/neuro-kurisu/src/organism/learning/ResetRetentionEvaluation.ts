/**
 * Matched, outcome-based retention evaluation across hard process resets.
 *
 * Inspired by the protocol distinction in retention-bench: a stateless prior
 * (P), uninterrupted ceiling (C), and reset-survival arm R(k) must be measured
 * on the same task/seed/manifest cells. This module scores evidence; it does
 * not perform process resets or claim that persistence implies abstraction.
 *
 * Statistical unit: seed-level aggregate, never individual task cells.
 */
export type ResetRetentionArm = 'P' | 'C' | `R(${number})`;

export interface ResetRetentionObservation {
  arm: ResetRetentionArm;
  seed: number;
  taskId: string;
  family: string;
  manifestFingerprint: string;
  score: number;
  authority: 'independent-verifier';
  evidenceRef: string;
}

export interface RetentionEstimate {
  resetEvery: number;
  pairedSeeds: number;
  eligibleTaskCount: number;
  excludedTaskCount: number;
  meanPrior: number;
  meanCeiling: number;
  meanReset: number;
  normalizedRetention: number | null;
  seedLevel95CI: [number, number] | null;
  perFamily: Array<{
    family: string;
    taskCount: number;
    normalizedRetention: number | null;
  }>;
}

export interface ResetRetentionReport {
  manifestFingerprint: string;
  estimates: RetentionEstimate[];
  excludedTaskIds: string[];
  observationCount: number;
}

function assertScore(score: number, label: string): void {
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error(`${label} score must be finite and in [0, 1]`);
  }
}

function tCritical95(df: number): number {
  const table = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306,
    2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101,
    2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048,
    2.045, 2.042];
  return df < table.length ? table[df]! : 1.96;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function confidenceInterval(values: number[]): [number, number] | null {
  if (values.length < 2) return null;
  const center = mean(values);
  const variance = values.reduce((sum, x) => sum + (x - center) ** 2, 0) / (values.length - 1);
  const margin = tCritical95(values.length - 1) * Math.sqrt(variance / values.length);
  return [center - margin, center + margin];
}

function parseResetEvery(arm: string): number | null {
  const match = /^R\(([1-9]\d*)\)$/.exec(arm);
  return match ? Number(match[1]) : null;
}

/**
 * Evaluate hard-reset retention with strict matched-cell identity.
 * A task contributes only when P, C and every requested R(k) arm have the
 * same manifest, task ID and seed. C-P <= epsilon is excluded as unlearnable.
 */
export function evaluateResetRetention(
  observations: ResetRetentionObservation[],
  options: { resetEvery: number[]; epsilon?: number },
): ResetRetentionReport {
  const epsilon = options.epsilon ?? 1e-6;
  if (!Array.isArray(observations) || !observations.length) throw new Error('observations must be non-empty');
  if (!Array.isArray(options.resetEvery) || !options.resetEvery.length) throw new Error('resetEvery must be non-empty');
  if (!Number.isFinite(epsilon) || epsilon < 0) throw new Error('epsilon must be finite and non-negative');
  const ks = [...new Set(options.resetEvery)];
  if (ks.length !== options.resetEvery.length || ks.some(k => !Number.isSafeInteger(k) || k < 1)) {
    throw new Error('resetEvery values must be distinct positive safe integers');
  }
  const fingerprint = observations[0]!.manifestFingerprint;
  if (!/^[a-f0-9]{64}$/i.test(fingerprint)) throw new Error('manifestFingerprint must be SHA-256 hex');
  const requiredArms = ['P', 'C', ...ks.map(k => `R(${k})`)];
  const seen = new Set<string>();
  const cells = new Map<string, Map<string, ResetRetentionObservation>>();
  for (const row of observations) {
    if (!row || row.manifestFingerprint !== fingerprint) throw new Error('all observations must share one manifest fingerprint');
    if (!/^[a-f0-9]{64}$/i.test(row.manifestFingerprint)) throw new Error('manifestFingerprint must be SHA-256 hex');
    if (!Number.isSafeInteger(row.seed) || row.seed < 0) throw new Error('seed must be a non-negative safe integer');
    if (typeof row.taskId !== 'string' || !row.taskId.trim()) throw new Error('taskId must be non-empty');
    if (typeof row.family !== 'string' || !row.family.trim()) throw new Error('family must be non-empty');
    if (row.authority !== 'independent-verifier') throw new Error('only independent-verifier outcomes are eligible');
    if (typeof row.evidenceRef !== 'string' || !row.evidenceRef.trim()) throw new Error('evidenceRef must be non-empty');
    assertScore(row.score, row.taskId);
    if (!requiredArms.includes(row.arm)) throw new Error(`unexpected arm: ${row.arm}`);
    const identity = `${row.taskId}\u0000${row.seed}\u0000${row.arm}`;
    if (seen.has(identity)) throw new Error('duplicate task/seed/arm observation');
    seen.add(identity);
    const key = `${row.taskId}\u0000${row.seed}`;
    if (!cells.has(key)) cells.set(key, new Map());
    cells.get(key)!.set(row.arm, row);
  }
  // Task identity must have one stable family across seeds and arms.
  const familyByTask = new Map<string, string>();
  for (const row of observations) {
    const prior = familyByTask.get(row.taskId);
    if (prior !== undefined && prior !== row.family) throw new Error('task family must be stable across observations');
    familyByTask.set(row.taskId, row.family);
  }
  const byK = new Map<number, Array<{ seed: number; prior: number; ceiling: number; reset: number; normalized: number; family: string; taskId: string }>>();
  for (const k of ks) byK.set(k, []);
  const excluded = new Set<string>();
  const eligibleKeysBySeed = new Map<number, Set<string>>();
  const allTaskIds = [...familyByTask.keys()].sort();
  const seeds = [...new Set(observations.map(row => row.seed))].sort((a, b) => a - b);
  for (const taskId of allTaskIds) {
    for (const seed of seeds) {
      const cell = cells.get(`${taskId}\u0000${seed}`);
      if (!cell) continue;
      if (requiredArms.some(arm => !cell.has(arm))) throw new Error(`incomplete matched arms for task ${taskId}, seed ${seed}`);
      const p = cell.get('P')!.score;
      const c = cell.get('C')!.score;
      if (c - p <= epsilon) {
        excluded.add(taskId);
        continue;
      }
      for (const k of ks) {
        const r = cell.get(`R(${k})`)!.score;
        byK.get(k)!.push({ seed, prior: p, ceiling: c, reset: r, normalized: (r - p) / (c - p), family: familyByTask.get(taskId)!, taskId });
      }
      if (!eligibleKeysBySeed.has(seed)) eligibleKeysBySeed.set(seed, new Set());
      eligibleKeysBySeed.get(seed)!.add(taskId);
    }
  }
  // Every seed included in uncertainty must cover the same eligible task set.
  const eligibleTaskIds = allTaskIds.filter(taskId => !excluded.has(taskId));
  const seedRows = seeds.filter(seed => eligibleTaskIds.every(taskId => eligibleKeysBySeed.get(seed)?.has(taskId)));
  if (seedRows.length < 2 && eligibleTaskIds.length > 0) {
    // A single matched seed is useful descriptively, but cannot support a CI.
  }
  const estimates: RetentionEstimate[] = ks.map(k => {
    const rows = byK.get(k)!.filter(row => seedRows.includes(row.seed));
    const seedMetrics = seedRows.map(seed => {
      const matched = rows.filter(row => row.seed === seed);
      return matched.length ? mean(matched.map(row => row.normalized)) : NaN;
    }).filter(Number.isFinite);
    const familyNames = [...new Set(rows.map(row => row.family))].sort();
    return {
      resetEvery: k,
      pairedSeeds: seedMetrics.length,
      eligibleTaskCount: eligibleTaskIds.length,
      excludedTaskCount: excluded.size,
      meanPrior: mean(rows.map(row => row.prior)),
      meanCeiling: mean(rows.map(row => row.ceiling)),
      meanReset: mean(rows.map(row => row.reset)),
      normalizedRetention: seedMetrics.length ? mean(seedMetrics) : null,
      seedLevel95CI: confidenceInterval(seedMetrics),
      perFamily: familyNames.map(family => {
        const familyRows = rows.filter(row => row.family === family);
        const familySeedMeans = seedRows.map(seed => mean(familyRows.filter(row => row.seed === seed).map(row => row.normalized)))
          .filter(Number.isFinite);
        return { family, taskCount: new Set(familyRows.map(row => row.taskId)).size, normalizedRetention: familySeedMeans.length ? mean(familySeedMeans) : null };
      }),
    };
  });
  return {
    manifestFingerprint: fingerprint,
    estimates,
    excludedTaskIds: [...excluded].sort(),
    observationCount: observations.length,
  };
}
