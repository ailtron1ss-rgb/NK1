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
  /** Version of the exact manifest task; task IDs may be reused when prompts evolve. */
  taskVersion: string;
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
const isBoundedText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max &&
  value.trim() === value && !Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f);
  });

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/** Validate runtime data, not just TypeScript types: evidence can cross process boundaries. */
const valid = (value: unknown): value is RevisionObservation => {
  if (!isPlainRecord(value)) return false;
  const row = value;
  if (!isBoundedText(row.taskId, 256) ||
      !isBoundedText(row.taskVersion, 128) ||
      !isBoundedText(row.family, 128) ||
      !isBoundedText(row.method, 128) ||
      !isBoundedText(row.verifierId, 128) ||
      !isBoundedText(row.expectedVerifierId, 128) ||
      !isBoundedText(row.evidenceRef, 512) ||
      !Number.isSafeInteger(row.seed) || (row.seed as number) < 0 ||
      !Number.isSafeInteger(row.attempt) || row.attempt !== 1 ||
      row.split !== 'holdout' || typeof row.passed !== 'boolean' ||
      (row.authority !== 'independent-verifier' && row.authority !== 'human-review')) {
    return false;
  }
  return row.authority !== 'independent-verifier' || row.verifierId === row.expectedVerifierId;
};

/** Pair on exact task ID + manifest version + seed + first attempt; retries and replayed evidence receipts are not independent samples. */
export function evaluateSkillRevision(
  observations: readonly RevisionObservation[],
  baselineMethod: string,
  candidateMethod: string,
  options: SkillRevisionGateOptions = {},
): SkillRevisionGateResult {
  if (!isBoundedText(baselineMethod, 128) || !isBoundedText(candidateMethod, 128) ||
      baselineMethod === candidateMethod) {
    throw new Error('two distinct bounded method names are required');
  }
  if (!Array.isArray(observations)) throw new Error('revision observations must be an array');
  if (!isPlainRecord(options)) throw new Error('revision gate options must be a plain object');
  const minPairedTasks = boundedInteger(options.minPairedTasks, 8, 2, 10000);
  const minAbsoluteGain = clamp(options.minAbsoluteGain ?? .02, .02);
  const maxFamilyRegression = clamp(options.maxFamilyRegression ?? .10, .10);
  const byPair = new Map<string, Map<string, RevisionObservation[]>>();
  const receiptCounts = new Map<string, number>();
  let rejectedRows = 0;
  for (const row of observations) {
    if (!valid(row) || (row.method !== baselineMethod && row.method !== candidateMethod)) {
      rejectedRows++;
      continue;
    }
    const receiptKey = row.evidenceRef.normalize('NFKC').trim();
    receiptCounts.set(receiptKey, (receiptCounts.get(receiptKey) ?? 0) + 1);
    const key = JSON.stringify([row.taskId, row.taskVersion, row.seed, row.attempt]);
    const pair = byPair.get(key) ?? new Map<string, RevisionObservation[]>();
    const methodRows = pair.get(row.method) ?? [];
    methodRows.push(row);
    pair.set(row.method, methodRows);
    byPair.set(key, pair);
  }

  // Duplicate identities invalidate every colliding row. First-write-wins would
  // make the score depend on attacker-controlled input order.
  const duplicateReceipts = new Set([...receiptCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([receipt]) => receipt));
  const paired: Array<Map<string, RevisionObservation>> = [];
  for (const byMethod of byPair.values()) {
    const usable = new Map<string, RevisionObservation>();
    for (const [method, methodRows] of byMethod) {
      if (methodRows.length !== 1) {
        rejectedRows += methodRows.length;
        continue;
      }
      const row = methodRows[0]!;
      if (duplicateReceipts.has(row.evidenceRef.normalize('NFKC').trim())) {
        rejectedRows++;
        continue;
      }
      usable.set(method, row);
    }
    if (!usable.has(baselineMethod) || !usable.has(candidateMethod)) continue;
    if (usable.get(baselineMethod)!.family !== usable.get(candidateMethod)!.family) {
      rejectedRows += 2;
      continue;
    }
    paired.push(usable);
  }
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
