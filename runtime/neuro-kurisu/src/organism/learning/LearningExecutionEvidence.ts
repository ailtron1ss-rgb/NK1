import type { LearningExecutionReceipt } from './LearningProcessSupervisor.ts';
import { recordPlannedLearningOutcome, validateLearningExperimentPlan, type LearningExperimentPlan } from './LearningExperimentPlan.ts';
import type { TaskManifestEntry, VerifiedTaskOutcome } from './VerifiedOutcomeLedger.ts';
import { VerifiedOutcomeLedger } from './VerifiedOutcomeLedger.ts';

export type IndependentlyCheckedOutcome = Omit<VerifiedTaskOutcome,
  'taskId' | 'taskVersion' | 'method' | 'seed' | 'verifierId'>;

/**
 * Bridges execution evidence to the canonical outcome ledger without conflating
 * process success with task success. A successful receipt is necessary but not
 * sufficient: the caller must provide an independently checked outcome and its
 * evidence reference. Receipts are not cryptographic attestations.
 */
export function recordExecutionBackedLearningOutcome(
  ledger: VerifiedOutcomeLedger,
  plan: LearningExperimentPlan,
  manifest: TaskManifestEntry[],
  runId: string,
  receipt: LearningExecutionReceipt,
  outcome: IndependentlyCheckedOutcome,
): { accepted: boolean; rejection?: ReturnType<VerifiedOutcomeLedger['record']>['rejection'] } {
  validateLearningExperimentPlan(plan, manifest);
  if (ledger.manifestFingerprint() !== plan.manifestFingerprint) {
    throw new Error('ledger manifest does not match experiment plan');
  }
  const run = plan.runs.find(item => item.runId === runId);
  if (!run) throw new Error('runId is not present in experiment plan');
  if (!receipt || receipt.schemaVersion !== 1 || receipt.runId !== runId ||
      receipt.planFingerprint !== plan.planFingerprint ||
      receipt.manifestFingerprint !== plan.manifestFingerprint ||
      !/^[a-f0-9]{64}$/i.test(receipt.commandFingerprint) ||
      receipt.status !== 'completed' || receipt.exitCode !== 0 ||
      receipt.outputTruncated || !Number.isFinite(receipt.startedAt) ||
      !Number.isFinite(receipt.finishedAt) || receipt.finishedAt < receipt.startedAt ||
      !receipt.executionId) {
    throw new Error('execution receipt does not prove a clean successful scheduled execution');
  }
  if (outcome.authority !== 'independent-verifier' && outcome.authority !== 'human-review') {
    throw new Error('execution-backed outcomes require independent verification or human review');
  }
  if (!outcome.evidenceRef?.trim()) throw new Error('independent verifier evidence reference is required');
  return recordPlannedLearningOutcome(ledger, plan, runId, outcome);
}

/** Small helper for consumers that need the exact manifest digest before running. */
export function learningExecutionManifestFingerprint(manifest: TaskManifestEntry[]): string {
  return new VerifiedOutcomeLedger(manifest).manifestFingerprint();
}
