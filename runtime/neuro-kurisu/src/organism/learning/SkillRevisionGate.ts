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
  value.trim() === value && value.normalize('NFKC') === value &&
  !Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f);
  });

const toPlainDataRecord = (value: unknown): Record<string, unknown> | undefined => {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const record: Record<string, unknown> = Object.create(null);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      // Never invoke untrusted getters while evaluating evidence. Snapshot own
      // data properties before reading any identity or outcome field.
      if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) return undefined;
      record[key] = descriptor.value;
    }
    return record;
  } catch {
    // Proxies and exotic objects can throw during reflection; treat them as invalid rows.
    return undefined;
  }
};

/** Validate and detach untrusted runtime data, not just the TypeScript surface type. */
const parseObservation = (value: unknown): RevisionObservation | undefined => {
  const row = toPlainDataRecord(value);
  if (!row) return undefined;
  const taskId = row.taskId;
  const taskVersion = row.taskVersion;
  const family = row.family;
  const split = row.split;
  const method = row.method;
  const seed = row.seed;
  const attempt = row.attempt;
  const passed = row.passed;
  const authority = row.authority;
  const verifierId = row.verifierId;
  const expectedVerifierId = row.expectedVerifierId;
  const evidenceRef = row.evidenceRef;
  if (!isBoundedText(taskId, 256) ||
      !isBoundedText(taskVersion, 128) ||
      !isBoundedText(family, 128) ||
      !isBoundedText(method, 128) ||
      !isBoundedText(verifierId, 128) ||
      !isBoundedText(expectedVerifierId, 128) ||
      !isBoundedText(evidenceRef, 512) ||
      !Number.isSafeInteger(seed) || (seed as number) < 0 ||
      !Number.isSafeInteger(attempt) || attempt !== 1 ||
      split !== 'holdout' || typeof passed !== 'boolean' ||
      (authority !== 'independent-verifier' && authority !== 'human-review')) {
    return undefined;
  }
  if (authority === 'independent-verifier' && verifierId !== expectedVerifierId) return undefined;
  return {
    taskId,
    taskVersion,
    family,
    split,
    method,
    seed: seed as number,
    attempt: attempt as number,
    passed,
    authority,
    verifierId,
    expectedVerifierId,
    evidenceRef,
  };
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
  const optionValues = toPlainDataRecord(options);
  if (!optionValues) throw new Error('revision gate options must be a plain data object');
  const minPairedTasks = boundedInteger(optionValues.minPairedTasks as number | undefined, 8, 2, 10000);
  const minAbsoluteGain = clamp((optionValues.minAbsoluteGain as number | undefined) ?? .02, .02);
  const maxFamilyRegression = clamp((optionValues.maxFamilyRegression as number | undefined) ?? .10, .10);
  const byPair = new Map<string, Map<string, RevisionObservation[]>>();
  const receiptCounts = new Map<string, number>();
  let rejectedRows = 0;
  for (const input of observations) {
    const row = parseObservation(input);
    if (!row || (row.method !== baselineMethod && row.method !== candidateMethod)) {
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
