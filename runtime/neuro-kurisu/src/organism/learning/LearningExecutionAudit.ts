import type { LearningExecutionReceipt } from './LearningProcessSupervisor.ts';
import { validateLearningExperimentPlan, type LearningExperimentPlan } from './LearningExperimentPlan.ts';
import type { TaskManifestEntry } from './VerifiedOutcomeLedger.ts';

export interface LearningExecutionArmAudit {
  arm: string;
  method: string;
  planned: number;
  cleanCompleted: number;
  failedOrInvalid: number;
  missing: number;
  completionRate: number;
}
export interface LearningExecutionAudit {
  schemaVersion: 1;
  planFingerprint: string;
  manifestFingerprint: string;
  plannedRuns: number;
  uniqueScheduledRunsObserved: number;
  cleanCompleted: number;
  failedOrInvalid: number;
  missing: number;
  orphanReceipts: number;
  duplicateReceipts: number;
  complete: boolean;
  arms: LearningExecutionArmAudit[];
  issues: Array<{ code: string; runId: string; detail: string }>;
}

/**
 * Audits execution coverage only. A clean process exit is not a successful
 * learning outcome; independent verifier results belong in VerifiedOutcomeLedger.
 */
export function auditLearningExecutionCoverage(
  plan: LearningExperimentPlan,
  manifest: TaskManifestEntry[],
  receipts: LearningExecutionReceipt[],
): LearningExecutionAudit {
  validateLearningExperimentPlan(plan, manifest);
  if (!Array.isArray(receipts)) throw new Error('receipts must be an array');
  const scheduled = new Map(plan.runs.map(run => [run.runId, run]));
  const byRun = new Map<string, LearningExecutionReceipt[]>();
  const issues: LearningExecutionAudit['issues'] = [];
  let orphanReceipts = 0;
  for (const receipt of receipts) {
    const runId = typeof receipt?.runId === 'string' ? receipt.runId : '';
    const run = scheduled.get(runId);
    if (!run) {
      orphanReceipts++;
      issues.push({ code: 'orphan-receipt', runId, detail: 'receipt does not map to a scheduled run' });
      continue;
    }
    const bucket = byRun.get(runId) ?? [];
    bucket.push(receipt);
    byRun.set(runId, bucket);
    if (receipt.planFingerprint !== plan.planFingerprint ||
        receipt.manifestFingerprint !== plan.manifestFingerprint ||
        receipt.schemaVersion !== 2 ||
        !/^[a-f0-9]{64}$/i.test(receipt.commandFingerprint ?? '') ||
        !receipt.executionId || !Number.isFinite(receipt.startedAt) ||
        !Number.isFinite(receipt.finishedAt) || receipt.finishedAt < receipt.startedAt) {
      issues.push({ code: 'invalid-receipt', runId, detail: 'receipt identity or timing fields are invalid' });
    }
  }
  let cleanCompleted = 0;
  let failedOrInvalid = 0;
  let missing = 0;
  let duplicateReceipts = 0;
  for (const run of plan.runs) {
    const matching = byRun.get(run.runId) ?? [];
    if (matching.length === 0) {
      missing++;
      issues.push({ code: 'missing-receipt', runId: run.runId, detail: 'scheduled run has no execution receipt' });
    } else if (matching.length > 1) {
      duplicateReceipts += matching.length - 1;
      failedOrInvalid++;
      issues.push({ code: 'duplicate-receipt', runId: run.runId, detail: 'multiple receipts map to one scheduled run' });
    } else {
      const receipt = matching[0]!;
      const identityValid = receipt.schemaVersion === 2 &&
        receipt.planFingerprint === plan.planFingerprint &&
        receipt.manifestFingerprint === plan.manifestFingerprint &&
        /^[a-f0-9]{64}$/i.test(receipt.commandFingerprint ?? '') &&
        Boolean(receipt.executionId) && Number.isFinite(receipt.startedAt) &&
        Number.isFinite(receipt.finishedAt) && receipt.finishedAt >= receipt.startedAt;
      if (identityValid && receipt.status === 'completed' && receipt.exitCode === 0 && !receipt.outputTruncated) {
        cleanCompleted++;
      } else {
        failedOrInvalid++;
        issues.push({ code: 'failed-execution', runId: run.runId, detail: 'execution did not finish cleanly or receipt is invalid' });
      }
    }
  }
  const arms = plan.arms.map(arm => {
    const armRuns = plan.runs.filter(run => run.arm === arm.arm);
    const successful = armRuns.filter(run => {
      const matching = byRun.get(run.runId) ?? [];
      if (matching.length !== 1) return false;
      const r = matching[0]!;
      return r.schemaVersion === 2 && r.planFingerprint === plan.planFingerprint &&
        r.manifestFingerprint === plan.manifestFingerprint &&
        /^[a-f0-9]{64}$/i.test(r.commandFingerprint ?? '') && Boolean(r.executionId) &&
        Number.isFinite(r.startedAt) && Number.isFinite(r.finishedAt) && r.finishedAt >= r.startedAt &&
        r.status === 'completed' && r.exitCode === 0 && !r.outputTruncated;
    }).length;
    const absent = armRuns.filter(run => !byRun.has(run.runId)).length;
    const bad = armRuns.length - successful - absent;
    return {
      arm: arm.arm, method: arm.method, planned: armRuns.length,
      cleanCompleted: successful, failedOrInvalid: bad, missing: absent,
      completionRate: armRuns.length ? successful / armRuns.length : 0,
    };
  });
  return {
    schemaVersion: 1, planFingerprint: plan.planFingerprint, manifestFingerprint: plan.manifestFingerprint,
    plannedRuns: plan.runs.length, uniqueScheduledRunsObserved: byRun.size,
    cleanCompleted, failedOrInvalid, missing, orphanReceipts, duplicateReceipts,
    complete: cleanCompleted === plan.runs.length && !orphanReceipts && !duplicateReceipts && !issues.length,
    arms, issues,
  };
}
