/**
 * Verified skill-revision gate.
 *
 * Adapted from Voyager/Memento-Skills' iterative skill repair and SkillLearnBench's
 * outcome-focused evaluation: a revision is a proposal until paired, independently
 * checked held-out task outcomes show improvement. This module never mutates live skills.
 */
export type RevisionAuthority = 'independent-verifier' | 'human-review' | 'self-report';
export interface RevisionObservation {
  taskId: string;
  family: string;
  split: 'train' | 'validation' | 'holdout';
  method: string;
  seed: number;
  attempt: number;
  passed: boolean;
  authority: RevisionAuthority;
  verifierId: string;
  expectedVerifierId: string;
  evidenceRef: string;
}
export interface SkillRevisionGateOptions {
  minPairedTasks?: number;
  minAbsoluteGain?: number;
  maxFamilyRegression?: number;
}
export interface SkillRevisionGateResult {
  accepted: boolean;
  reason: string;
  pairedN: number;
  baselinePassRate: number;
  candidatePassRate: number;
  absoluteGain: number;
  familyGains: Array<{ family: string; pairedN: number; gain: number }>;
  rejectedRows: number;
}
const nonEmptyText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** Treat runtime/persisted rows as untrusted values; malformed fields are rejected, never invoked. */
const valid = (value: unknown): value is RevisionObservation => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const x = value as Record<string, unknown>;
  if (!nonEmptyText(x.taskId) || !nonEmptyText(x.family) || !nonEmptyText(x.method) ||
      !Number.isSafeInteger(x.seed) || Number(x.seed) < 0 ||
      !Number.isSafeInteger(x.attempt) || x.attempt !== 1 ||
      x.split !== 'holdout' || typeof x.passed !== 'boolean' ||
      (x.authority !== 'independent-verifier' && x.authority !== 'human-review') ||
      !nonEmptyText(x.verifierId) || !nonEmptyText(x.evidenceRef)) return false;
  return x.authority !== 'independent-verifier' || x.verifierId === x.expectedVerifierId;
};

/** Pair on exact task/version identity (taskId), seed and first attempt; retries and replayed evidence receipts are not independent samples. */
export function evaluateSkillRevision(
  observations: readonly RevisionObservation[],
  baselineMethod: string,
  candidateMethod: string,
  options: SkillRevisionGateOptions = {},
): SkillRevisionGateResult {
  if (typeof baselineMethod !== 'string' || baselineMethod.trim().length === 0 ||
      typeof candidateMethod !== 'string' || candidateMethod.trim().length === 0 ||
      baselineMethod === candidateMethod) {
    throw new Error('two distinct method names are required');
  }
  if (!Array.isArray(observations)) throw new Error('revision observations must be an array');
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('skill revision gate options must be an object');
  }
  const minPairedTasks = options.minPairedTasks === undefined ? 8 : options.minPairedTasks;
  const minAbsoluteGain = options.minAbsoluteGain === undefined ? .02 : options.minAbsoluteGain;
  const maxFamilyRegression = options.maxFamilyRegression === undefined ? .10 : options.maxFamilyRegression;
  if (!Number.isSafeInteger(minPairedTasks) || minPairedTasks < 2 || minPairedTasks > 10000) {
    throw new Error('skill revision minPairedTasks must be an integer from 2 to 10000');
  }
  if (typeof minAbsoluteGain !== 'number' || !Number.isFinite(minAbsoluteGain) ||
      minAbsoluteGain < 0 || minAbsoluteGain > 1) {
    throw new Error('skill revision minAbsoluteGain must be a finite number from 0 to 1');
  }
  if (typeof maxFamilyRegression !== 'number' || !Number.isFinite(maxFamilyRegression) ||
      maxFamilyRegression < 0 || maxFamilyRegression > 1) {
    throw new Error('skill revision maxFamilyRegression must be a finite number from 0 to 1');
  }
  const byPair = new Map<string, Map<string, RevisionObservation>>();
  // A single verifier receipt cannot be replayed under multiple task IDs to manufacture sample size.
  const seenEvidenceReceipts = new Set<string>();
  let rejectedRows = 0;
  for (const row of observations) {
    if (!valid(row) || (row.method !== baselineMethod && row.method !== candidateMethod)) {
      rejectedRows++;
      continue;
    }
    const receiptKey = JSON.stringify([row.method, row.verifierId, row.evidenceRef.normalize('NFKC').trim()]);
    if (seenEvidenceReceipts.has(receiptKey)) { rejectedRows++; continue; }
    seenEvidenceReceipts.add(receiptKey);
    const key = JSON.stringify([row.taskId, row.seed, row.attempt]);
    const pair = byPair.get(key) ?? new Map<string, RevisionObservation>();
    if (pair.has(row.method)) { rejectedRows++; continue; }
    pair.set(row.method, row);
    byPair.set(key, pair);
  }
  const paired: Map<string, RevisionObservation>[] = [];
  for (const pair of byPair.values()) {
    const baseline = pair.get(baselineMethod);
    const candidate = pair.get(candidateMethod);
    if (!baseline || !candidate) continue;
    if (baseline.family !== candidate.family) {
      // Count a rejected cross-family pair once; it is not a valid comparison.
      rejectedRows++;
      continue;
    }
    paired.push(pair);
  }
  const n = paired.length;
  const baselinePassRate = n ? paired.reduce((s, p) => s + Number(p.get(baselineMethod)!.passed), 0) / n : 0;
  const candidatePassRate = n ? paired.reduce((s, p) => s + Number(p.get(candidateMethod)!.passed), 0) / n : 0;
  const absoluteGain = candidatePassRate - baselinePassRate;
  const families = new Map<string, Array<{ baseline: number; candidate: number }>>();
  for (const pair of paired) {
    const a = pair.get(baselineMethod)!;
    const b = pair.get(candidateMethod)!;
    const rows = families.get(a.family) ?? [];
    rows.push({ baseline: Number(a.passed), candidate: Number(b.passed) });
    families.set(a.family, rows);
  }
  const familyGains = [...families.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([family, rows]) => ({
    family, pairedN: rows.length,
    gain: rows.reduce((s, row) => s + row.candidate - row.baseline, 0) / rows.length,
  }));
  const severeRegression = familyGains.find(row => row.pairedN >= 2 && row.gain < -maxFamilyRegression);
  const accepted = n >= minPairedTasks && absoluteGain >= minAbsoluteGain && !severeRegression;
  const reason = n < minPairedTasks ? 'insufficient-independent-heldout-pairs' :
    severeRegression ? 'heldout-family-regression' :
    absoluteGain < minAbsoluteGain ? 'no-material-heldout-improvement' :
    'heldout-gate-passed-proposal-only';
  return { accepted, reason, pairedN: n, baselinePassRate, candidatePassRate, absoluteGain, familyGains, rejectedRows };
}
