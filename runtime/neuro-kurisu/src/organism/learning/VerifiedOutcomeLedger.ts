import { createHash } from 'node:crypto';

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
    for (const entry of entries) {
      if (!entry.taskId || !entry.family || !entry.version || !entry.verifierId ||
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
      this.manifest.set(entry.taskId, Object.freeze({ ...entry, promptFingerprint: fingerprint }));
    }
  }

  static fingerprintPrompt(prompt: string): string {
    const normalized = String(prompt).normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
    return createHash('sha256').update(normalized).digest('hex');
  }

  record(outcome: VerifiedTaskOutcome): { accepted: boolean; rejection?: OutcomeRejection } {
    const safeTaskId = typeof outcome?.taskId === 'string' ? outcome.taskId : '';
    const safeMethod = typeof outcome?.method === 'string' ? outcome.method : '';
    const task = this.manifest.get(safeTaskId);
    let code: OutcomeRejection['code'] | undefined;
    let detail = '';
    if (!outcome || typeof outcome !== 'object' || typeof outcome.taskId !== 'string' ||
        typeof outcome.taskVersion !== 'string' || typeof outcome.verifierId !== 'string' ||
        typeof outcome.evidenceRef !== 'string' || typeof outcome.passed !== 'boolean' ||
        !['independent-verifier', 'human-review', 'self-report'].includes(outcome.authority)) {
      code = 'invalid-outcome'; detail = 'outcome shape or authority fields are malformed';
    }
    else if (!task) { code = 'unknown-task'; detail = 'task is not in the versioned manifest'; }
    else if (task.version !== outcome.taskVersion) { code = 'version-mismatch'; detail = 'outcome references a different task version'; }
    else if (typeof outcome.method !== 'string' || !outcome.method.trim()) { code = 'invalid-method'; detail = 'method must be a non-empty string'; }
    else if (!Number.isSafeInteger(outcome.seed) || outcome.seed < 0) { code = 'invalid-seed'; detail = 'seed must be a non-negative safe integer'; }
    else if (!Number.isSafeInteger(outcome.attempt) || outcome.attempt < 1) { code = 'invalid-attempt'; detail = 'attempt must be a positive safe integer'; }
    else if (outcome.authority === 'self-report') { code = 'self-report-not-authoritative'; detail = 'self-assessed success cannot become ground truth'; }
    else if (outcome.authority === 'independent-verifier' && task.verifierId !== outcome.verifierId) { code = 'verifier-mismatch'; detail = 'verifier does not match the manifest'; }
    else if (!outcome.evidenceRef.trim()) { code = 'missing-evidence'; detail = 'accepted outcomes require an evidence reference'; }
    else if (!Number.isFinite(outcome.observedAt) || outcome.observedAt <= 0) { code = 'invalid-time'; detail = 'observedAt must be a positive finite timestamp'; }
    const key = code ? '' : this.key(outcome);
    if (!code && this.outcomes.has(key)) { code = 'duplicate-attempt'; detail = 'this task/method/seed/attempt already has an outcome'; }
    if (code) {
      const rejection: OutcomeRejection = { code, taskId: safeTaskId, method: safeMethod, detail };
      this.rejections.push(rejection);
      return { accepted: false, rejection };
    }
    this.outcomes.set(key, Object.freeze({ ...outcome }));
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
    if (!value || typeof value !== 'object') throw new Error('invalid ledger snapshot');
    const snapshot = value as {
      schemaVersion?: unknown; manifest?: unknown; manifestCount?: unknown;
      acceptedOutcomes?: unknown; rejectedOutcomes?: unknown;
      outcomes?: unknown; rejections?: unknown;
    };
    if (snapshot.schemaVersion !== 2 || !Array.isArray(snapshot.manifest) ||
        !Array.isArray(snapshot.outcomes) || !Array.isArray(snapshot.rejections)) {
      throw new Error('unsupported or malformed ledger snapshot');
    }
    const ledger = new VerifiedOutcomeLedger(snapshot.manifest as TaskManifestEntry[]);
    if (snapshot.manifestCount !== ledger.manifest.size) throw new Error('manifest count mismatch');
    for (const outcome of snapshot.outcomes as VerifiedTaskOutcome[]) {
      const result = ledger.record(outcome);
      if (!result.accepted) throw new Error(`snapshot contains invalid accepted outcome: ${result.rejection?.code}`);
    }
    if (ledger.outcomes.size !== snapshot.acceptedOutcomes) throw new Error('accepted outcome count mismatch');
    const allowed = new Set<OutcomeRejection['code']>([
      'unknown-task', 'version-mismatch', 'invalid-method', 'invalid-seed', 'invalid-attempt',
      'self-report-not-authoritative', 'verifier-mismatch', 'missing-evidence', 'invalid-time', 'duplicate-attempt', 'invalid-outcome',
    ]);
    for (const item of snapshot.rejections as OutcomeRejection[]) {
      if (!item || !allowed.has(item.code) || typeof item.taskId !== 'string' ||
          typeof item.method !== 'string' || typeof item.detail !== 'string') {
        throw new Error('snapshot contains malformed rejection record');
      }
      ledger.rejections.push({ ...item });
    }
    if (ledger.rejections.length !== snapshot.rejectedOutcomes) throw new Error('rejected outcome count mismatch');
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
