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
const clamp = (x: number, fallback: number) => Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : fallback;
const boundedInteger = (value: number | undefined, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value!))) : fallback;
const valid = (x: RevisionObservation) => Boolean(
  x && x.taskId?.trim() && x.family?.trim() && x.method?.trim() &&
  Number.isSafeInteger(x.seed) && x.seed >= 0 &&
  Number.isSafeInteger(x.attempt) && x.attempt === 1 &&
  x.split === 'holdout' && typeof x.passed === 'boolean' &&
  (x.authority === 'independent-verifier' || x.authority === 'human-review') &&
  x.verifierId?.trim() && x.evidenceRef?.trim() &&
  (x.authority !== 'independent-verifier' || x.verifierId === x.expectedVerifierId)
);

/** Pair on exact task/version identity (taskId), seed and first attempt; retries and replayed evidence receipts are not independent samples. */
export function evaluateSkillRevision(
  observations: readonly RevisionObservation[],
  baselineMethod: string,
  candidateMethod: string,
  options: SkillRevisionGateOptions = {},
): SkillRevisionGateResult {
  if (!baselineMethod?.trim() || !candidateMethod?.trim() || baselineMethod === candidateMethod) {
    throw new Error('two distinct method names are required');
  }
  const minPairedTasks = boundedInteger(options.minPairedTasks, 8, 2, 10000);
  const minAbsoluteGain = clamp(options.minAbsoluteGain ?? .02, .02);
  const maxFamilyRegression = clamp(options.maxFamilyRegression ?? .10, .10);
  const byPair = new Map<string, Map<string, RevisionObservation>>();
  // A single verifier receipt cannot be replayed under multiple task IDs to manufacture sample size.
  const seenEvidenceReceipts = new Set<string>();
  let rejectedRows = 0;
  for (const row of observations) {
    if (!valid(row) || (row.method !== baselineMethod && row.method !== candidateMethod)) {
      rejectedRows++;
      continue;
    }
    const receiptKey = JSON.stringify([row.verifierId, row.evidenceRef.normalize('NFKC').trim()]);
    if (seenEvidenceReceipts.has(receiptKey)) { rejectedRows++; continue; }
    seenEvidenceReceipts.add(receiptKey);
    const key = JSON.stringify([row.taskId, row.seed, row.attempt]);
    const pair = byPair.get(key) ?? new Map<string, RevisionObservation>();
    if (pair.has(row.method)) { rejectedRows++; continue; }
    pair.set(row.method, row);
    byPair.set(key, pair);
  }
  const paired = [...byPair.values()].filter(pair => {
    if (!pair.has(baselineMethod) || !pair.has(candidateMethod)) return false;
    return pair.get(baselineMethod)!.family === pair.get(candidateMethod)!.family;
  });
  const n = paired.length;
  const baselinePassRate = n ? paired.reduce((s, p) => s + Number(p.get(baselineMethod)!.passed), 0) / n : 0;
  const candidatePassRate = n ? paired.reduce((s, p) => s + Number(p.get(candidateMethod)!.passed), 0) / n : 0;
  const absoluteGain = candidatePassRate - baselinePassRate;
  const families = new Map<string, Array<{ baseline: number; candidate: number }>>();
  for (const pair of paired) {
    const a = pair.get(baselineMethod)!;
    const b = pair.get(candidateMethod)!;
    if (a.family !== b.family) { rejectedRows++; continue; }
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
