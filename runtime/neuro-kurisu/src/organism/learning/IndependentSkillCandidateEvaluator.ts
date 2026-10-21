import { createHash } from 'node:crypto';
import { evaluateSkillLearnBenchTrial, type SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';
import type { RevisedCandidateEvaluator } from './P23LearningEngine.ts';

export interface IndependentCandidateTask {
  taskId: string;
  trialId: string;
  seed: number;
  split: 'validation' | 'holdout';
  input: unknown;
  requiredCapabilityIds: string[];
  expectedStepIds: string[];
}
export interface CandidateExecutionResult {
  runId: string;
  observedStepIds: string[];
  metadata?: Record<string, unknown>;
}
/** Must execute the exact payload in an isolated, resource-bounded runtime. */
export interface CandidateSandboxExecutor {
  execute(input: { payload: unknown; task: IndependentCandidateTask }): Promise<CandidateExecutionResult>;
}
/** Separate authority from the candidate; must not trust candidate self-reported success. */
export interface IndependentTaskVerifier {
  verify(input: { task: IndependentCandidateTask; execution: CandidateExecutionResult }): Promise<{
    passed: boolean; coveredCapabilityIds: string[];
  }>;
}
/** Separate static/dynamic safety authority. */
export interface IndependentCandidateSafetyScanner {
  scan(input: { payload: unknown; task: IndependentCandidateTask; execution?: CandidateExecutionResult }): Promise<{
    violationCount: number;
  }>;
}
export interface IndependentCandidateEvaluationConfig {
  tasks: IndependentCandidateTask[];
  executor: CandidateSandboxExecutor;
  verifier: IndependentTaskVerifier;
  safetyScanner: IndependentCandidateSafetyScanner;
  /** Domain identity for runtime/tool policy; included in the report fingerprint. */
  environmentFingerprint: string;
}
const isDigest = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{64}$/i.test(x);
// Must match P23LearningEngine's canonicalize exactly or its post-generation
// payload/evaluation digest gate will reject a genuine evaluator result.
function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).filter(key => record[key] !== undefined).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
}
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
function validateConfig(config: IndependentCandidateEvaluationConfig): void {
  if (!config || !Array.isArray(config.tasks) || config.tasks.length < 2 ||
      !config.executor || typeof config.executor.execute !== 'function' ||
      !config.verifier || typeof config.verifier.verify !== 'function' ||
      !config.safetyScanner || typeof config.safetyScanner.scan !== 'function' ||
      !isDigest(config.environmentFingerprint)) throw new Error('independent-candidate-evaluator-config-invalid');
  const keys = new Set<string>();
  const trialIds = new Set<string>();
  const splitTasks = { validation: new Set<string>(), holdout: new Set<string>() };
  for (const task of config.tasks) {
    if (!task || typeof task.taskId !== 'string' || !task.taskId.trim() ||
        typeof task.trialId !== 'string' || !task.trialId.trim() ||
        !Number.isSafeInteger(task.seed) || task.seed < 0 ||
        !['validation', 'holdout'].includes(task.split) ||
        !Array.isArray(task.requiredCapabilityIds) || task.requiredCapabilityIds.length === 0 ||
        task.requiredCapabilityIds.some(id => typeof id !== 'string' || !id.trim()) ||
        new Set(task.requiredCapabilityIds).size !== task.requiredCapabilityIds.length ||
        !Array.isArray(task.expectedStepIds) || task.expectedStepIds.length === 0 ||
        task.expectedStepIds.some(id => typeof id !== 'string' || !id.trim()) ||
        new Set(task.expectedStepIds).size !== task.expectedStepIds.length) {
      throw new Error('independent-candidate-evaluator-task-invalid');
    }
    try {
      // Fail before execution if the task cannot be safely snapshotted for provenance.
      structuredClone(task.input);
      canonical(task.input);
    } catch {
      throw new Error('independent-candidate-evaluator-task-input-invalid');
    }
    const key = JSON.stringify([task.taskId, task.trialId]);
    if (keys.has(key) || trialIds.has(task.trialId)) {
      throw new Error('independent-candidate-evaluator-duplicate-trial');
    }
    keys.add(key);
    trialIds.add(task.trialId);
    splitTasks[task.split].add(task.taskId);
  }
  if (!splitTasks.validation.size || !splitTasks.holdout.size) {
    throw new Error('independent-candidate-evaluator-validation-and-holdout-required');
  }
  for (const taskId of splitTasks.validation) {
    if (splitTasks.holdout.has(taskId)) throw new Error('independent-candidate-evaluator-task-leakage');
  }
}

/**
 * Creates the real post-generation evaluator expected by P23. It executes the
 * exact candidate payload per fixed task/seed, independently verifies outcomes,
 * separately scans safety, and binds reports to payload + environment + task plan.
 * It never promotes a candidate; P23's existing gate remains authoritative.
 */
export function createIndependentSkillCandidateEvaluator(
  config: IndependentCandidateEvaluationConfig,
): RevisedCandidateEvaluator {
  validateConfig(config);
  const tasks = config.tasks.map(task => structuredClone(task));
  const planFingerprint = sha256(canonical(tasks.map(({ taskId, trialId, seed, split, input, requiredCapabilityIds, expectedStepIds }) =>
    ({ taskId, trialId, seed, split, input, requiredCapabilityIds, expectedStepIds }))));
  return async ({ payload, payloadFingerprint }) => {
    const actualFingerprint = sha256(canonical(payload));
    if (!isDigest(payloadFingerprint) || actualFingerprint !== payloadFingerprint) {
      throw new Error('independent-candidate-evaluator-payload-fingerprint-mismatch');
    }
    const reports: Record<'validation' | 'holdout', SkillLearnBenchTrialReport[]> = {
      validation: [], holdout: [],
    };
    const runBindings: Array<{ taskId: string; trialId: string; runId: string | null; seed: number; split: string; executable: boolean; observedStepIds: string[]; verifierPassed: boolean; coveredCapabilityIds: string[]; safetyViolationCount: number }> = [];
  const seenRunIds = new Set<string>();
    for (const task of tasks) {
      let execution: CandidateExecutionResult | undefined;
      let verifierPassed = false;
      let coveredCapabilityIds: string[] = [];
      let executable = true;
      try {
        execution = await config.executor.execute({ payload: structuredClone(payload), task: structuredClone(task) });
        if (!execution || typeof execution.runId !== 'string' || !execution.runId.trim() ||
            !Array.isArray(execution.observedStepIds)) throw new Error('candidate-sandbox-result-invalid');
        if (seenRunIds.has(execution.runId)) throw new Error('candidate-sandbox-reused-run-id');
        seenRunIds.add(execution.runId);
      } catch {
        // Execution failure or reused run identity is never treated as executable.
        executable = false;
        execution = undefined;
      }
      if (execution) {
        try {
          const verified = await config.verifier.verify({ task: structuredClone(task), execution: structuredClone(execution) });
          if (!verified || typeof verified.passed !== 'boolean' || !Array.isArray(verified.coveredCapabilityIds)) {
            throw new Error('independent-task-verifier-result-invalid');
          }
          verifierPassed = verified.passed;
          coveredCapabilityIds = verified.coveredCapabilityIds;
        } catch {
          // A verifier failure fails task success but does not rewrite execution as non-executable.
          verifierPassed = false;
        }
      }
      const safety = await config.safetyScanner.scan({
        payload: structuredClone(payload), task: structuredClone(task),
        ...(execution ? { execution: structuredClone(execution) } : {}),
      });
      if (!safety || !Number.isSafeInteger(safety.violationCount) || safety.violationCount < 0) {
        throw new Error('independent-candidate-safety-result-invalid');
      }
      runBindings.push({
        taskId: task.taskId,
        trialId: task.trialId,
        runId: execution?.runId ?? null,
        seed: task.seed,
        split: task.split,
        executable,
        observedStepIds: execution?.observedStepIds ?? [],
        verifierPassed: executable && verifierPassed,
        coveredCapabilityIds,
        safetyViolationCount: safety.violationCount,
      });
      const report = evaluateSkillLearnBenchTrial({
        taskId: task.taskId,
        trialId: task.trialId,
        verifierPassed: executable && verifierPassed,
        skill: {
          requiredCapabilityIds: task.requiredCapabilityIds,
          coveredCapabilityIds,
          executable,
          safetyViolationCount: safety.violationCount,
        },
        trajectory: {
          expectedStepIds: task.expectedStepIds,
          observedStepIds: execution?.observedStepIds ?? [],
        },
      });
      reports[task.split].push(report);
    }
    // Provenance lives inside the canonical evaluation object so P23's existing
    // digest contract (SHA-256 of the complete evaluation object) remains exact.
    const evaluation = {
      validation: reports.validation,
      holdout: reports.holdout,
      provenance: {
        schemaVersion: 1,
        payloadFingerprint,
        environmentFingerprint: config.environmentFingerprint,
        planFingerprint,
        runBindings,
      },
    };
    const evaluationFingerprint = sha256(canonical(evaluation));
    return { payloadFingerprint, evaluationFingerprint, evaluation };
  };
}
