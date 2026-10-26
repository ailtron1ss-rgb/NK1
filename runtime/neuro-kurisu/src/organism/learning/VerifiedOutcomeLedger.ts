import { createHash } from 'node:crypto';

const TASK_MANIFEST_FIELDS = ['taskId', 'family', 'split', 'promptFingerprint', 'verifierId', 'version'] as const;
const VERIFIED_OUTCOME_FIELDS = [
  'taskId', 'taskVersion', 'method', 'seed', 'attempt', 'passed',
  'authority', 'verifierId', 'evidenceRef', 'observedAt',
] as const;
const LEDGER_SNAPSHOT_FIELDS = [
  'schemaVersion', 'manifest', 'manifestCount', 'acceptedOutcomes',
  'rejectedOutcomes', 'outcomes', 'rejections',
] as const;
const OUTCOME_REJECTION_FIELDS = ['code', 'taskId', 'method', 'detail'] as const;

/**
 * Read only own enumerable data properties. No caller-supplied getter is ever
 * invoked; additional properties are ignored rather than copied into trusted state.
 * Exceptions from unusual object/proxy introspection fail closed.
 */
function snapshotPlainDataRecord(value: unknown, expectedFields: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const field of expectedFields) {
      const descriptor = descriptors[field];
      if (!descriptor || descriptor.enumerable !== true || !('value' in descriptor)) return null;
      snapshot[field] = descriptor.value;
    }
    return snapshot;
  } catch {
    return null;
  }
}

/** Clone a dense array from own data descriptors without invoking index accessors. */
function snapshotPlainArray(value: unknown): unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (!lengthDescriptor || !('value' in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
    const length = lengthDescriptor.value as number;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || !keys.includes('length')) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot = new Array<unknown>(length);
    for (let index = 0; index < length; index++) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || descriptor.enumerable !== true || !('value' in descriptor)) return null;
      snapshot[index] = descriptor.value;
    }
    return snapshot;
  } catch {
    return null;
  }
}

export type OutcomeAuthority = 'independent-verifier' | 'human-review' | 'self-report';
export type EvaluationSplit = 'train' | 'validation' | 'holdout';

export interface TaskManifestEntry {
  taskId: string;
  family: string;
  split: EvaluationSplit;
  promptFingerprint: string;
  verifierId: string;
  version: string;
}

export interface VerifiedTaskOutcome {
  taskId: string;
  taskVersion: string;
  method: string;
  seed: number;
  attempt: number;
  passed: boolean;
  authority: OutcomeAuthority;
  verifierId: string;
  evidenceRef: string;
  observedAt: number;
}

export interface OutcomeRejection {
  code: 'unknown-task' | 'version-mismatch' | 'invalid-method' | 'invalid-seed' | 'invalid-attempt' |
    'self-report-not-authoritative' | 'verifier-mismatch' | 'missing-evidence' |
    'invalid-time' | 'duplicate-attempt' | 'invalid-outcome';
  taskId: string;
  method: string;
  detail: string;
}

export interface PairedMethodSummary {
  baseline: string;
  candidate: string;
  pairedN: number;
  baselinePassRate: number;
  candidatePassRate: number;
  absoluteGain: number;
  discordantCandidateWins: number;
  discordantBaselineWins: number;
  approximate95CI: [number, number] | null;
  /** Present only for seed-clustered comparisons; resamples independent seed aggregates. */
  bootstrap95CI?: [number, number] | null;
}

/**
 * Deterministic percentile bootstrap over independent seed-level aggregates.
 * This is a sensitivity interval, not a cure for too few independent seeds.
 */
function bootstrapMean95CI(values: number[], identity: string, replicates = 4000): [number, number] | null {
  if (values.length < 2) return null;
  const digest = createHash('sha256').update(identity + '\u0000' + values.map(value => value.toFixed(12)).join(',')).digest();
  let state = digest.readUInt32LE(0) || 0x9e3779b9;
  const random = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  const means = new Array<number>(replicates);
  for (let sample = 0; sample < replicates; sample++) {
    let total = 0;
    for (let i = 0; i < values.length; i++) total += values[Math.floor(random() * values.length)]!;
    means[sample] = total / values.length;
  }
  means.sort((a, b) => a - b);
  const quantile = (p: number): number => {
    const position = p * (means.length - 1);
    const lower = Math.floor(position);
    const fraction = position - lower;
    return means[lower]! + (means[Math.min(lower + 1, means.length - 1)]! - means[lower]!) * fraction;
  };
  return [Math.max(-1, quantile(0.025)), Math.min(1, quantile(0.975))];
}

/**
 * An evidence ledger, not a learner. Only independently verifiable or human-
 * reviewed outcomes are authoritative. Model self-report is retained as a
 * rejection reason rather than being silently converted into training truth.
 */
export class VerifiedOutcomeLedger {
  private readonly manifest = new Map<string, TaskManifestEntry>();
  private readonly outcomes = new Map<string, VerifiedTaskOutcome>();
  private readonly rejections: OutcomeRejection[] = [];
  private readonly promptOwners = new Map<string, string>();

  constructor(entries: TaskManifestEntry[]) {
    if (!Array.isArray(entries)) throw new Error('task manifest must be an array');
    const safeEntries = snapshotPlainArray(entries);
    if (!safeEntries) throw new Error('task manifest must be a dense array of data entries');
    for (const rawEntry of safeEntries) {
      const fields = snapshotPlainDataRecord(rawEntry, TASK_MANIFEST_FIELDS);
      if (!fields) throw new Error('invalid task manifest entry');
      const entry = {
        taskId: fields.taskId,
        family: fields.family,
        split: fields.split,
        promptFingerprint: fields.promptFingerprint,
        verifierId: fields.verifierId,
        version: fields.version,
      };
      if (typeof entry.taskId !== 'string' || !entry.taskId.trim() ||
          typeof entry.family !== 'string' || !entry.family.trim() ||
          typeof entry.version !== 'string' || !entry.version.trim() ||
          typeof entry.verifierId !== 'string' || !entry.verifierId.trim() ||
          !['train', 'validation', 'holdout'].includes(entry.split as string) ||
          typeof entry.promptFingerprint !== 'string' ||
          !/^[a-f0-9]{64}$/i.test(entry.promptFingerprint)) {
        throw new Error('invalid task manifest entry');
      }
      if (this.manifest.has(entry.taskId)) throw new Error(`duplicate task id: ${entry.taskId}`);
      const fingerprint = entry.promptFingerprint.toLowerCase();
      const prior = this.promptOwners.get(fingerprint);
      if (prior) {
        const previous = this.manifest.get(prior)!;
        if (previous.split !== entry.split) {
          throw new Error(`cross-split prompt leakage: ${prior} / ${entry.taskId}`);
        }
      }
      this.promptOwners.set(fingerprint, entry.taskId);
      this.manifest.set(entry.taskId, Object.freeze({
        taskId: entry.taskId,
        family: entry.family,
        split: entry.split as EvaluationSplit,
        promptFingerprint: fingerprint,
        verifierId: entry.verifierId,
        version: entry.version,
      }));
    }
  }

  /** Stable digest for binding verifier artifacts to the exact task manifest. */
  manifestFingerprint(): string {
    const canonicalManifest = [...this.manifest.values()]
      .map(entry => ({
        taskId: entry.taskId,
        family: entry.family,
        split: entry.split,
        promptFingerprint: entry.promptFingerprint,
        verifierId: entry.verifierId,
        version: entry.version,
      }))
      .sort((a, b) => a.taskId.localeCompare(b.taskId));
    return createHash('sha256').update(JSON.stringify(canonicalManifest)).digest('hex');
  }

  static fingerprintPrompt(prompt: string): string {
    const normalized = String(prompt).normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
    return createHash('sha256').update(normalized).digest('hex');
  }

  record(outcome: VerifiedTaskOutcome): { accepted: boolean; rejection?: OutcomeRejection } {
    const fields = snapshotPlainDataRecord(outcome, VERIFIED_OUTCOME_FIELDS);
    const safeOutcome = fields as unknown as VerifiedTaskOutcome | null;
    const safeTaskId = typeof safeOutcome?.taskId === 'string' ? safeOutcome.taskId : '';
    const safeMethod = typeof safeOutcome?.method === 'string' ? safeOutcome.method : '';
    const task = safeOutcome ? this.manifest.get(safeTaskId) : undefined;
    let code: OutcomeRejection['code'] | undefined;
    let detail = '';
    if (!safeOutcome || typeof safeOutcome.taskId !== 'string' ||
        typeof safeOutcome.taskVersion !== 'string' || typeof safeOutcome.verifierId !== 'string' ||
        typeof safeOutcome.evidenceRef !== 'string' || typeof safeOutcome.passed !== 'boolean' ||
        !['independent-verifier', 'human-review', 'self-report'].includes(safeOutcome.authority)) {
      code = 'invalid-outcome'; detail = 'outcome shape or authority fields are malformed';
    }
    else if (!task) { code = 'unknown-task'; detail = 'task is not in the versioned manifest'; }
    else if (task.version !== safeOutcome.taskVersion) { code = 'version-mismatch'; detail = 'outcome references a different task version'; }
    else if (typeof safeOutcome.method !== 'string' || !safeOutcome.method.trim()) { code = 'invalid-method'; detail = 'method must be a non-empty string'; }
    else if (!Number.isSafeInteger(safeOutcome.seed) || safeOutcome.seed < 0) { code = 'invalid-seed'; detail = 'seed must be a non-negative safe integer'; }
    else if (!Number.isSafeInteger(safeOutcome.attempt) || safeOutcome.attempt < 1) { code = 'invalid-attempt'; detail = 'attempt must be a positive safe integer'; }
    else if (safeOutcome.authority === 'self-report') { code = 'self-report-not-authoritative'; detail = 'self-assessed success cannot become ground truth'; }
    else if (safeOutcome.authority === 'independent-verifier' && task.verifierId !== safeOutcome.verifierId) { code = 'verifier-mismatch'; detail = 'verifier does not match the manifest'; }
    else if (!safeOutcome.evidenceRef.trim()) { code = 'missing-evidence'; detail = 'accepted outcomes require an evidence reference'; }
    else if (typeof safeOutcome.observedAt !== 'number' || !Number.isFinite(safeOutcome.observedAt) || safeOutcome.observedAt <= 0) { code = 'invalid-time'; detail = 'observedAt must be a positive finite timestamp'; }
    const key = code ? '' : this.key(safeOutcome!);
    if (!code && this.outcomes.has(key)) { code = 'duplicate-attempt'; detail = 'this task/method/seed/attempt already has an outcome'; }
    if (code) {
      const rejection: OutcomeRejection = { code, taskId: safeTaskId, method: safeMethod, detail };
      this.rejections.push(rejection);
      return { accepted: false, rejection };
    }
    // Store only the schema fields captured above; caller-owned extra fields and getters are never copied.
    this.outcomes.set(key, Object.freeze({ ...safeOutcome! }));
    return { accepted: true };
  }

  comparePaired(baseline: string, candidate: string, split: EvaluationSplit = 'holdout'): PairedMethodSummary {
    return this.compareFiltered(baseline, candidate, split);
  }

  comparePairedByFamily(
    baseline: string,
    candidate: string,
    split: EvaluationSplit = 'holdout',
  ): Array<PairedMethodSummary & { family: string }> {
    const families = [...new Set([...this.manifest.values()]
      .filter(task => task.split === split)
      .map(task => task.family))].sort();
    return families.map(family => ({
      family,
      ...this.compareFiltered(baseline, candidate, split, family),
    }));
  }

  /**
   * Compare methods with seed as the independent statistical unit.
   * Every included seed must contain attempt-1 outcomes for both methods on
   * every task in the selected split (and family, when supplied). This avoids
   * treating correlated task cells or retries as independent samples.
   */
  comparePairedBySeed(baseline: string, candidate: string, split: EvaluationSplit = 'holdout'): PairedMethodSummary {
    return this.compareFilteredBySeed(baseline, candidate, split);
  }

  /** Family-stratified counterpart to comparePairedBySeed. */
  comparePairedByFamilyAndSeed(
    baseline: string,
    candidate: string,
    split: EvaluationSplit = 'holdout',
  ): Array<PairedMethodSummary & { family: string }> {
    const families = [...new Set([...this.manifest.values()]
      .filter(task => task.split === split)
      .map(task => task.family))].sort();
    return families.map(family => ({
      family,
      ...this.compareFilteredBySeed(baseline, candidate, split, family),
    }));
  }

  private compareFilteredBySeed(
    baseline: string,
    candidate: string,
    split: EvaluationSplit,
    family?: string,
  ): PairedMethodSummary {
    if (!baseline || !candidate || baseline === candidate) throw new Error('two distinct method names are required');
    const expectedTasks = [...this.manifest.values()]
      .filter(task => task.split === split && (family === undefined || task.family === family))
      .map(task => task.taskId).sort();
    const bySeed = new Map<number, Map<string, Map<string, VerifiedTaskOutcome>>>();
    for (const outcome of this.outcomes.values()) {
      const task = this.manifest.get(outcome.taskId)!;
      if (task.split !== split || (family !== undefined && task.family !== family) ||
          (outcome.method !== baseline && outcome.method !== candidate) || outcome.attempt !== 1) continue;
      const taskRows = bySeed.get(outcome.seed) ?? new Map<string, Map<string, VerifiedTaskOutcome>>();
      const methodRows = taskRows.get(task.taskId) ?? new Map<string, VerifiedTaskOutcome>();
      methodRows.set(outcome.method, outcome);
      taskRows.set(task.taskId, methodRows);
      bySeed.set(outcome.seed, taskRows);
    }
    const paired: Array<{ seed: number; baseline: number; candidate: number }> = [];
    for (const [seed, taskRows] of [...bySeed.entries()].sort((a, b) => a[0] - b[0])) {
      // Fail closed on incomplete seed coverage: never compare different task sets.
      if (!expectedTasks.length || expectedTasks.some(taskId => {
        const methods = taskRows.get(taskId);
        return !methods?.has(baseline) || !methods?.has(candidate);
      })) continue;
      const b = expectedTasks.reduce((sum, taskId) => sum + Number(taskRows.get(taskId)!.get(baseline)!.passed), 0) / expectedTasks.length;
      const c = expectedTasks.reduce((sum, taskId) => sum + Number(taskRows.get(taskId)!.get(candidate)!.passed), 0) / expectedTasks.length;
      paired.push({ seed, baseline: b, candidate: c });
    }
    const n = paired.length;
    const baselinePassRate = n ? paired.reduce((sum, row) => sum + row.baseline, 0) / n : 0;
    const candidatePassRate = n ? paired.reduce((sum, row) => sum + row.candidate, 0) / n : 0;
    const differences = paired.map(row => row.candidate - row.baseline);
    const absoluteGain = n ? differences.reduce((sum, value) => sum + value, 0) / n : 0;
    // Only complete paired seeds define the sample and its deterministic bootstrap stream.
    // Unrelated incomplete seeds must not perturb an otherwise identical estimate.
    const bootstrap95CI = bootstrapMean95CI(
      differences,
      JSON.stringify({ baseline, candidate, split, family: family ?? null, seeds: paired.map(row => row.seed) }),
    );
    let approximate95CI: [number, number] | null = null;
    if (n > 1) {
      const variance = differences.reduce((sum, value) => sum + (value - absoluteGain) ** 2, 0) / (n - 1);
      const critical = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262,
        2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093,
        2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
      const t = n - 1 < critical.length ? critical[n - 1]! : 1.96;
      const margin = t * Math.sqrt(variance / n);
      approximate95CI = [Math.max(-1, absoluteGain - margin), Math.min(1, absoluteGain + margin)];
    }
    return {
      baseline, candidate, pairedN: n, baselinePassRate, candidatePassRate, absoluteGain,
      discordantCandidateWins: differences.filter(value => value > 0).length,
      discordantBaselineWins: differences.filter(value => value < 0).length,
      approximate95CI,
      bootstrap95CI,
    };
  }
  private compareFiltered(
    baseline: string,
    candidate: string,
    split: EvaluationSplit,
    family?: string,
  ): PairedMethodSummary {
    if (!baseline || !candidate || baseline === candidate) throw new Error('two distinct method names are required');
    const rows = new Map<string, Map<string, VerifiedTaskOutcome>>();
    for (const outcome of this.outcomes.values()) {
      const task = this.manifest.get(outcome.taskId)!;
      if (task.split !== split || (family !== undefined && task.family !== family) ||
          (outcome.method !== baseline && outcome.method !== candidate)) continue;
      const pairKey = JSON.stringify([task.taskId, outcome.seed, outcome.attempt]);
      const pair = rows.get(pairKey) ?? new Map<string, VerifiedTaskOutcome>();
      pair.set(outcome.method, outcome);
      rows.set(pairKey, pair);
    }
    const pairs = [...rows.values()].filter(p => p.has(baseline) && p.has(candidate));
    const n = pairs.length;
    const b = pairs.reduce((sum, p) => sum + Number(p.get(baseline)!.passed), 0);
    const c = pairs.reduce((sum, p) => sum + Number(p.get(candidate)!.passed), 0);
    const differences = pairs.map(p => Number(p.get(candidate)!.passed) - Number(p.get(baseline)!.passed));
    const gain = n ? (c - b) / n : 0;
    const variance = n > 1 ? differences.reduce((sum, x) => sum + (x - gain) ** 2, 0) / (n - 1) : 0;
    const se = n > 1 ? Math.sqrt(variance / n) : 0;
    return {
      baseline, candidate, pairedN: n,
      baselinePassRate: n ? b / n : 0,
      candidatePassRate: n ? c / n : 0,
      absoluteGain: gain,
      discordantCandidateWins: pairs.filter(p => p.get(candidate)!.passed && !p.get(baseline)!.passed).length,
      discordantBaselineWins: pairs.filter(p => !p.get(candidate)!.passed && p.get(baseline)!.passed).length,
      approximate95CI: n > 1 ? [Math.max(-1, gain - 1.96 * se), Math.min(1, gain + 1.96 * se)] : null,
    };
  }

  static restoreSnapshot(value: unknown): VerifiedOutcomeLedger {
    const fields = snapshotPlainDataRecord(value, LEDGER_SNAPSHOT_FIELDS);
    if (!fields || fields.schemaVersion !== 2 ||
        !Number.isSafeInteger(fields.manifestCount) || Number(fields.manifestCount) < 0 ||
        !Number.isSafeInteger(fields.acceptedOutcomes) || Number(fields.acceptedOutcomes) < 0 ||
        !Number.isSafeInteger(fields.rejectedOutcomes) || Number(fields.rejectedOutcomes) < 0) {
      throw new Error('unsupported or malformed ledger snapshot');
    }
    const manifest = snapshotPlainArray(fields.manifest);
    const outcomes = snapshotPlainArray(fields.outcomes);
    const rejections = snapshotPlainArray(fields.rejections);
    if (!manifest || !outcomes || !rejections) throw new Error('unsupported or malformed ledger snapshot arrays');

    const ledger = new VerifiedOutcomeLedger(manifest as TaskManifestEntry[]);
    if (fields.manifestCount !== ledger.manifest.size) throw new Error('manifest count mismatch');
    for (const outcome of outcomes) {
      const result = ledger.record(outcome as VerifiedTaskOutcome);
      if (!result.accepted) throw new Error(`snapshot contains invalid accepted outcome: ${result.rejection?.code}`);
    }
    if (ledger.outcomes.size !== fields.acceptedOutcomes) throw new Error('accepted outcome count mismatch');
    const allowed = new Set<OutcomeRejection['code']>([
      'unknown-task', 'version-mismatch', 'invalid-method', 'invalid-seed', 'invalid-attempt',
      'self-report-not-authoritative', 'verifier-mismatch', 'missing-evidence', 'invalid-time', 'duplicate-attempt', 'invalid-outcome',
    ]);
    for (const rawItem of rejections) {
      const item = snapshotPlainDataRecord(rawItem, OUTCOME_REJECTION_FIELDS);
      if (!item || !allowed.has(item.code as OutcomeRejection['code']) ||
          typeof item.taskId !== 'string' || typeof item.method !== 'string' || typeof item.detail !== 'string') {
        throw new Error('snapshot contains malformed rejection record');
      }
      ledger.rejections.push({
        code: item.code as OutcomeRejection['code'],
        taskId: item.taskId,
        method: item.method,
        detail: item.detail,
      });
    }
    if (ledger.rejections.length !== fields.rejectedOutcomes) throw new Error('rejected outcome count mismatch');
    return ledger;
  }

  snapshot() {
    return {
      schemaVersion: 2,
      manifest: [...this.manifest.values()].map(x => ({ ...x })),
      manifestCount: this.manifest.size,
      acceptedOutcomes: this.outcomes.size,
      rejectedOutcomes: this.rejections.length,
      rejectionCounts: this.rejections.reduce((counts, item) => {
        counts[item.code] = (counts[item.code] ?? 0) + 1;
        return counts;
      }, {} as Record<string, number>),
      outcomes: [...this.outcomes.values()].map(x => ({ ...x })),
      rejections: this.rejections.map(x => ({ ...x })),
    };
  }

  private key(x: VerifiedTaskOutcome) {
    return [x.taskId, x.method, x.seed, x.attempt].join('\u0000');
  }
}