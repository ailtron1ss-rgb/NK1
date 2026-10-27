import { createHash } from 'node:crypto';
import type { VerifiedOutcomeLedger, EvaluationSplit } from './VerifiedOutcomeLedger.ts';
import { hasAuthenticatedOutcomeEvidence } from './VerifiedOutcomeArtifact.ts';

export interface VerifiedSessionTrainingExample {
  schemaVersion: 1;
  exampleId: string;
  taskId: string;
  taskVersion: string;
  family: string;
  promptFingerprint: string;
  split: 'train' | 'validation';
  method: string;
  seed: number;
  attempt: number;
  passed: boolean;
  authority: 'independent-verifier' | 'human-review';
  verifierId: string;
  evidenceRefDigest: string;
  observedAt: number;
}

export interface HoldoutAggregate {
  split: 'holdout';
  family: string;
  method: string;
  outcomeCount: number;
  passCount: number;
  passRate: number;
  independentSeedCount: number;
}

const MIN_HOLDOUT_AGGREGATE_OUTCOMES = 5;

export interface VerifiedSessionDataset {
  schemaVersion: 1;
  manifestFingerprint: string;
  /** Stable content identity, independent of export time. */
  datasetFingerprint: string;
  generatedAt: number;
  training: VerifiedSessionTrainingExample[];
  validation: VerifiedSessionTrainingExample[];
  holdoutAggregates: HoldoutAggregate[];
  rejectedSelfReports: number;
}

/**
 * Converts the authoritative P23 outcome ledger into a dataset without treating
 * model self-reports as labels. Raw evidence references are hashed so local paths,
 * URLs, query strings or accidentally embedded credentials cannot escape.
 * Holdout is emitted only as aggregate statistics, never as per-example rows.
 */
export function buildVerifiedSessionDataset(
  ledger: VerifiedOutcomeLedger,
  snapshotOverride?: ReturnType<VerifiedOutcomeLedger['snapshot']>,
): VerifiedSessionDataset {
  // Callers that derive multiple fingerprints from one evaluation must pass the same
  // immutable snapshot through every adapter; do not silently reread a changing ledger.
  const snapshot = snapshotOverride ?? ledger.snapshot();
  const manifest = new Map(snapshot.manifest.map(task => [task.taskId, task]));
  const training: VerifiedSessionTrainingExample[] = [];
  const validation: VerifiedSessionTrainingExample[] = [];
  const holdout = new Map<string, { family: string; method: string; n: number; passed: number; seeds: Set<number> }>();

  for (const outcome of snapshot.outcomes) {
    const task = manifest.get(outcome.taskId);
    if (!task || task.version !== outcome.taskVersion) continue;
    if (outcome.authority === 'self-report' || !hasAuthenticatedOutcomeEvidence(ledger, outcome.evidenceRef)) continue;
    if (task.split === 'holdout') {
      const key = JSON.stringify([task.family, outcome.method]);
      const aggregate = holdout.get(key) ?? { family: task.family, method: outcome.method, n: 0, passed: 0, seeds: new Set<number>() };
      aggregate.n++;
      aggregate.passed += Number(outcome.passed);
      aggregate.seeds.add(outcome.seed);
      holdout.set(key, aggregate);
      continue;
    }
    if (task.split !== 'train' && task.split !== 'validation') continue;
    const evidenceRefDigest = createHash('sha256').update(outcome.evidenceRef).digest('hex');
    const identity = JSON.stringify([
      task.taskId, task.version, outcome.method, outcome.seed, outcome.attempt,
      outcome.passed, outcome.verifierId, evidenceRefDigest,
    ]);
    const example: VerifiedSessionTrainingExample = {
      schemaVersion: 1,
      exampleId: createHash('sha256').update(identity).digest('hex'),
      taskId: task.taskId,
      taskVersion: task.version,
      family: task.family,
      promptFingerprint: task.promptFingerprint,
      split: task.split,
      method: outcome.method,
      seed: outcome.seed,
      attempt: outcome.attempt,
      passed: outcome.passed,
      authority: outcome.authority,
      verifierId: outcome.verifierId,
      evidenceRefDigest,
      observedAt: outcome.observedAt,
    };
    (task.split === 'train' ? training : validation).push(example);
  }

  // Small groups can reveal individual holdout labels even when IDs are omitted.
  // Suppress them rather than publishing a pass rate for one or two observations.
  const holdoutAggregates: HoldoutAggregate[] = [...holdout.values()]
    .filter(row => row.n >= MIN_HOLDOUT_AGGREGATE_OUTCOMES && row.seeds.size >= MIN_HOLDOUT_AGGREGATE_OUTCOMES)
    .map(row => ({
      split: 'holdout' as const,
      family: row.family,
      method: row.method,
      outcomeCount: row.n,
      passCount: row.passed,
      passRate: row.n ? row.passed / row.n : 0,
      independentSeedCount: row.seeds.size,
    }))
    .sort((a, b) => a.family.localeCompare(b.family) || a.method.localeCompare(b.method));

  const sortExamples = (rows: VerifiedSessionTrainingExample[]) => rows.sort((a, b) =>
    a.taskId.localeCompare(b.taskId) || a.method.localeCompare(b.method) ||
    a.seed - b.seed || a.attempt - b.attempt,
  );

  const sortedTraining = sortExamples(training);
  const sortedValidation = sortExamples(validation);
  // Stable fingerprint lets downstream generators/evaluators bind results to the
  // exact verified dataset rather than merely to a task manifest or export time.
  const datasetIdentity = {
    schemaVersion: 1,
    manifestFingerprint: ledger.manifestFingerprint(),
    training: sortedTraining,
    validation: sortedValidation,
    holdoutAggregates,
    rejectedSelfReports: snapshot.rejectionCounts['self-report-not-authoritative'] ?? 0,
  };
  const datasetFingerprint = createHash('sha256')
    .update(JSON.stringify(datasetIdentity))
    .digest('hex');

  return {
    ...datasetIdentity,
    datasetFingerprint,
    generatedAt: Date.now(),
  };
}
