import { createHash } from 'node:crypto';
import { bootstrapMeanConfidenceInterval } from './PairedSeedConfidence.ts';
import { evaluateSkillLearnBenchCandidate, evaluateSkillLearnBenchTrial, type SkillLearnBenchCandidateGateOptions, type SkillLearnBenchCandidateGateReport, type SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';
import type { RevisedCandidateEvaluator } from './P23LearningEngine.ts';
import {
  validateLearningExperimentPlan,
  type LearningExperimentPlan,
} from './LearningExperimentPlan.ts';
import { VerifiedOutcomeLedger, type TaskManifestEntry, type VerifiedTaskOutcome } from './VerifiedOutcomeLedger.ts';
import { isSafeLearningIdentity, snapshotPlainData } from './LearningTrustBoundary.ts';
import { summarizeLearningRobustMetrics, type LearningRobustMetricSummary } from './LearningRobustMetrics.ts';

export interface IndependentCandidateTask {
  taskId: string;
  trialId: string;
  /** Optional when no canonical manifest family is available. */
  taskFamily?: string;
  seed: number;
  split: 'validation' | 'holdout';
  input: unknown;
  requiredCapabilityIds: string[];
  expectedStepIds: string[];
}
export interface CandidateExecutionContext {
  /** Exact payload handed to the sandbox. */
  payloadFingerprint: string;
  /** Exact immutable task input, not just task/trial IDs. */
  taskInputFingerprint: string;
  /** Runtime/tool-policy identity selected by the trusted host. */
  environmentFingerprint: string;
  /** Digest of the complete fixed validation/holdout plan. */
  planFingerprint: string;
  /** Canonical dataset manifest digest, distinct from the evaluator-plan digest. */
  manifestFingerprint: string | null;
  /** Null when no canonical matched experiment authority was supplied. */
  experimentPlanFingerprint: string | null;
  /** Scheduled run ID from LearningExperimentPlan, never the sandbox's runtime run ID. */
  plannedRunId: string | null;
}
export interface CandidateExecutionResult {
  runId: string;
  observedStepIds: string[];
  metadata?: Record<string, unknown>;
}
/** Must execute the exact payload in an isolated, resource-bounded runtime. */
export interface CandidateSandboxExecutor {
  execute(input: { payload: unknown; task: IndependentCandidateTask; context: CandidateExecutionContext; signal?: AbortSignal }): Promise<CandidateExecutionResult>;
}
/** Separate authority from the candidate; must not trust candidate self-reported success. */
export interface IndependentTaskVerifier {
  verify(input: { task: IndependentCandidateTask; execution: CandidateExecutionResult; context: CandidateExecutionContext; signal?: AbortSignal }): Promise<{
    /** Independent verifier confirms this trace belongs to the exact payload/task/environment/plan. */
    bindingVerified: boolean;
    passed: boolean;
    coveredCapabilityIds: string[];
  }>;
}
/** Separate static/dynamic safety authority. */
export interface IndependentCandidateSafetyScanner {
  scan(input: { payload: unknown; task: IndependentCandidateTask; execution?: CandidateExecutionResult; context: CandidateExecutionContext; signal?: AbortSignal }): Promise<{
    violationCount: number;
  }>;
}
export interface IndependentCandidateEvaluationConfig {
  tasks: IndependentCandidateTask[];
  executor: CandidateSandboxExecutor;
  verifier: IndependentTaskVerifier;
  safetyScanner: IndependentCandidateSafetyScanner;
  /** Optional bridge to the canonical matched experiment plan and verified-outcome ledger. */
  experimentAuthority?: {
    manifest: TaskManifestEntry[];
    ledger: VerifiedOutcomeLedger;
    validationPlan: LearningExperimentPlan;
    holdoutPlan: LearningExperimentPlan;
    /** Must be the method label scheduled in both plans for this candidate. */
    method: string;
    attempt?: number;
  };
  /** Domain identity for runtime/tool policy; included in the report fingerprint. */
  environmentFingerprint: string;
  /** Per-service deadline; timeout aborts the service signal and fails closed. Defaults to 30s. */
  serviceTimeoutMs?: number;
}
const isDigest = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{64}$/i.test(x);
const isSafeRunId = (value: unknown): value is string => isSafeLearningIdentity(value, 256);

// Explicit cardinality limits complement byte/depth limits: cheap-to-encode arrays can still
// cause excessive Set construction, equality checks, verifier work, and report amplification.
const MAX_INDEPENDENT_EVALUATION_TASKS = 4096;
const MAX_TASK_CAPABILITY_IDS = 128;
const MAX_EXPECTED_STEP_IDS = 512;
const MAX_OBSERVED_STEP_IDS = 512;
const MAX_VERIFIED_CAPABILITY_IDS = 128;
// Must match P23LearningEngine's canonicalize exactly or its post-generation
// payload/evaluation digest gate will reject a genuine evaluator result.
function canonical(value: unknown, ancestors = new Set<object>()): string {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('independent-candidate-evaluator-non-finite-number');
  }
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('independent-candidate-evaluator-value-not-json-serializable');
    return encoded;
  }
  if (ancestors.has(value)) throw new Error('independent-candidate-evaluator-circular-value');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error('independent-candidate-evaluator-non-plain-object');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return '[' + value.map(item => canonical(item, ancestors)).join(',') + ']';
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).filter(key => record[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(record[key], ancestors)).join(',') + '}';
  } finally {
    ancestors.delete(value);
  }
}
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

async function runWithServiceDeadline<T>(
  label: string,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort(new Error(label + '-timeout'));
      reject(new Error(label + '-timeout'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
function validateConfig(config: IndependentCandidateEvaluationConfig, tasks: IndependentCandidateTask[]): void {
  if (!Array.isArray(tasks) || tasks.length > MAX_INDEPENDENT_EVALUATION_TASKS) {
    throw new Error('independent-candidate-evaluator-task-count-limit');
  }
  if (!config || tasks.length < 2 ||
      !config.executor || typeof config.executor.execute !== 'function' ||
      !config.verifier || typeof config.verifier.verify !== 'function' ||
      !config.safetyScanner || typeof config.safetyScanner.scan !== 'function' ||
      !isDigest(config.environmentFingerprint) ||
      (config.serviceTimeoutMs !== undefined && (!Number.isSafeInteger(config.serviceTimeoutMs) || config.serviceTimeoutMs < 10 || config.serviceTimeoutMs > 300_000))) throw new Error('independent-candidate-evaluator-config-invalid');
  // Different interface names are not independent authorities if they resolve to
  // the same object or dispatch function. Reject self-attesting configurations
  // before any candidate code can execute. Actual trust still depends on the host
  // wiring these distinct capabilities to independently controlled services.
  const authorityObjects = [config.executor, config.verifier, config.safetyScanner];
  const authorityMethods = [config.executor.execute, config.verifier.verify, config.safetyScanner.scan];
  if (new Set(authorityObjects).size !== authorityObjects.length ||
      new Set(authorityMethods).size !== authorityMethods.length) {
    throw new Error('independent-candidate-evaluator-authorities-must-be-distinct');
  }
  // Production must use the canonical manifest + validation/holdout plans +
  // verified-outcome ledger. Enforce this at the evaluator itself as well as the
  // provider wrapper so direct construction cannot bypass the production gate.
  if (process.env.NODE_ENV === 'production' && !config.experimentAuthority) {
    throw new Error('production-independent-evaluation-experiment-authority-required');
  }
  const keys = new Set<string>();
  const trialIds = new Set<string>();
  const splitTasks = { validation: new Set<string>(), holdout: new Set<string>() };
  for (const task of tasks) {
    if (task && ((Array.isArray(task.requiredCapabilityIds) && task.requiredCapabilityIds.length > MAX_TASK_CAPABILITY_IDS) ||
        (Array.isArray(task.expectedStepIds) && task.expectedStepIds.length > MAX_EXPECTED_STEP_IDS))) {
      throw new Error('independent-candidate-evaluator-task-shape-limit');
    }
    if (!task || !isSafeLearningIdentity(task.taskId, 256) || !isSafeLearningIdentity(task.trialId, 256) ||
        (task.taskFamily !== undefined && !isSafeLearningIdentity(task.taskFamily, 128)) ||
        !Number.isSafeInteger(task.seed) || task.seed < 0 ||
        !['validation', 'holdout'].includes(task.split) ||
        !Array.isArray(task.requiredCapabilityIds) || task.requiredCapabilityIds.length === 0 ||
        task.requiredCapabilityIds.some(id => !isSafeLearningIdentity(id, 256)) ||
        new Set(task.requiredCapabilityIds).size !== task.requiredCapabilityIds.length ||
        !Array.isArray(task.expectedStepIds) || task.expectedStepIds.length === 0 ||
        task.expectedStepIds.some(id => !isSafeLearningIdentity(id, 256)) ||
        new Set(task.expectedStepIds).size !== task.expectedStepIds.length) {
      throw new Error('independent-candidate-evaluator-task-invalid');
    }
    try {
      // Task inputs were detached through descriptor-only reads before validation.
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
  const authority = config.experimentAuthority;
  if (authority) {
    if (!Array.isArray(authority.manifest) || !(authority.ledger instanceof VerifiedOutcomeLedger) ||
        !isSafeLearningIdentity(authority.method, 180) ||
        (authority.attempt !== undefined && (!Number.isSafeInteger(authority.attempt) || authority.attempt < 1))) {
      throw new Error('independent-candidate-experiment-authority-invalid');
    }
    validateLearningExperimentPlan(authority.validationPlan, authority.manifest);
    validateLearningExperimentPlan(authority.holdoutPlan, authority.manifest);
    if (authority.validationPlan.split !== 'validation' || authority.holdoutPlan.split !== 'holdout' ||
        authority.ledger.manifestFingerprint() !== authority.validationPlan.manifestFingerprint ||
        authority.ledger.manifestFingerprint() !== authority.holdoutPlan.manifestFingerprint ||
        !authority.validationPlan.arms.some(arm => arm.method === authority.method) ||
        !authority.holdoutPlan.arms.some(arm => arm.method === authority.method)) {
      throw new Error('independent-candidate-experiment-plan-mismatch');
    }
    const manifestById = new Map<string, TaskManifestEntry>(authority.manifest.map(entry => [entry.taskId, entry] as const));
    for (const task of tasks) {
      const manifestEntry = manifestById.get(task.taskId);
      const prompt = task.input && typeof task.input === 'object'
        ? (task.input as Record<string, unknown>).prompt
        : undefined;
      const plan = task.split === 'validation' ? authority.validationPlan : authority.holdoutPlan;
      const scheduled = plan.runs.some(run =>
        run.taskId === task.taskId && run.seed === task.seed && run.method === authority.method &&
        run.split === task.split && run.manifestFingerprint === plan.manifestFingerprint);
      if (!manifestEntry || manifestEntry.split !== task.split ||
          typeof prompt !== 'string' ||
          VerifiedOutcomeLedger.fingerprintPrompt(prompt) !== manifestEntry.promptFingerprint ||
          !scheduled) {
        throw new Error('independent-candidate-task-not-bound-to-experiment-manifest');
      }
    }
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
  let tasks: IndependentCandidateTask[];
  try {
    const detachedTasks = snapshotPlainData(config?.tasks);
    if (!Array.isArray(detachedTasks)) throw new Error('tasks-not-array');
    tasks = detachedTasks as IndependentCandidateTask[];
  } catch {
    // Accessors are rejected without invocation; malformed task inputs cannot reach
    // the sandbox or rewrite their fingerprints during asynchronous evaluation.
    throw new Error('independent-candidate-evaluator-task-input-invalid');
  }
  validateConfig(config, tasks);
  // Capture validated environment identity rather than reading it from the mutable
  // caller-owned config on every run. Otherwise post-construction mutation can relabel
  // an evaluation with a different runtime/tool-policy fingerprint.
  const environmentFingerprint = config.environmentFingerprint;
  const serviceTimeoutMs = config.serviceTimeoutMs ?? 30_000;
  // Capture trusted service entry points too: replacing a method on the caller-owned
  // object after construction must not replace the verifier or safety authority.
  const executeCandidate = config.executor.execute.bind(config.executor);
  const verifyCandidate = config.verifier.verify.bind(config.verifier);
  const scanCandidateSafety = config.safetyScanner.scan.bind(config.safetyScanner);
  // Snapshot all authority-bearing plan data at construction. Keeping caller-owned
  // plan/manifest objects live here would let post-validation mutation silently
  // change scheduled run IDs while retaining the original evaluator plan fingerprint.
  const authority = config.experimentAuthority ? {
    manifest: snapshotPlainData(config.experimentAuthority.manifest) as TaskManifestEntry[],
    ledger: config.experimentAuthority.ledger,
    validationPlan: snapshotPlainData(config.experimentAuthority.validationPlan) as LearningExperimentPlan,
    holdoutPlan: snapshotPlainData(config.experimentAuthority.holdoutPlan) as LearningExperimentPlan,
    method: config.experimentAuthority.method,
    ...(config.experimentAuthority.attempt === undefined ? {} : { attempt: config.experimentAuthority.attempt }),
  } : undefined;
  const taskFamilyById = new Map((authority?.manifest ?? []).map(entry => [entry.taskId, entry.family] as const));
  const planFingerprint = sha256(canonical(tasks.map(({ taskId, trialId, taskFamily, seed, split, input, requiredCapabilityIds, expectedStepIds }) => {
    const family = taskFamilyById.get(taskId) ?? taskFamily;
    // Preserve the established plan digest for manifests without family metadata.
    // When a trusted family exists, bind it into the digest so family-level evidence
    // cannot be swapped after evaluator construction.
    return {
      taskId,
      trialId,
      ...(family === undefined || family === null ? {} : { taskFamily: family }),
      seed,
      split,
      input,
      requiredCapabilityIds,
      expectedStepIds,
    };
  })));
  return async ({ payload, payloadFingerprint }) => {
    // Snapshot the candidate once, before the first asynchronous boundary. Re-cloning
    // the caller-owned object per trial would allow a retained reference to change
    // later trials while they still carry the fingerprint computed for the original.
    let candidatePayload: unknown;
    try {
      candidatePayload = snapshotPlainData(payload);
    } catch {
      throw new Error('independent-candidate-evaluator-payload-not-cloneable');
    }
    const actualFingerprint = sha256(canonical(candidatePayload));
    if (!isDigest(payloadFingerprint) || actualFingerprint !== payloadFingerprint) {
      throw new Error('independent-candidate-evaluator-payload-fingerprint-mismatch');
    }
    const reports: Record<'validation' | 'holdout', SkillLearnBenchTrialReport[]> = {
      validation: [], holdout: [],
    };
    const runBindings: Array<{ taskId: string; trialId: string; runId: string | null; plannedRunId: string | null; seed: number; split: string; executable: boolean; observedStepIds: string[]; bindingVerified: boolean; verifierPassed: boolean; coveredCapabilityIds: string[]; safetyViolationCount: number }> = [];
    const seenRunIds = new Set<string>();
    for (const task of tasks) {
      const experimentPlan = authority
        ? (task.split === 'validation' ? authority.validationPlan : authority.holdoutPlan)
        : undefined;
      const plannedRun = experimentPlan?.runs.find(run =>
        run.taskId === task.taskId && run.seed === task.seed && run.method === authority?.method);
      const executionContext: CandidateExecutionContext = {
        payloadFingerprint,
        taskInputFingerprint: sha256(canonical(task.input)),
        environmentFingerprint,
        planFingerprint,
        manifestFingerprint: authority?.ledger.manifestFingerprint() ?? null,
        experimentPlanFingerprint: experimentPlan?.planFingerprint ?? null,
        plannedRunId: plannedRun?.runId ?? null,
      };
      let execution: CandidateExecutionResult | undefined;
      let verifierPassed = false;
      let bindingVerified = false;
      let coveredCapabilityIds: string[] = [];
      let executable = true;
      try {
        // The executor is outside this trust boundary. Detach its returned object
        // immediately so later mutation of a retained reference cannot rewrite the
        // trace while verification or safety scanning is awaiting other services.
        execution = snapshotPlainData(await runWithServiceDeadline('candidate-sandbox-execution', serviceTimeoutMs, signal => executeCandidate({
          payload: structuredClone(candidatePayload),
          task: structuredClone(task),
          context: structuredClone(executionContext),
          signal,
        }))) as CandidateExecutionResult;
        if (!execution || !isSafeRunId(execution.runId) ||
            !Array.isArray(execution.observedStepIds) || execution.observedStepIds.length > MAX_OBSERVED_STEP_IDS ||
            execution.observedStepIds.some(step => !isSafeLearningIdentity(step, 256)) ||
            new Set(execution.observedStepIds).size !== execution.observedStepIds.length) {
          throw new Error('candidate-sandbox-result-invalid');
        }
        if (seenRunIds.has(execution.runId)) throw new Error('candidate-sandbox-reused-run-id');
        seenRunIds.add(execution.runId);
      } catch {
        // Execution failure or reused run identity is never treated as executable.
        executable = false;
        execution = undefined;
      }
      if (execution) {
        try {
          const verified = snapshotPlainData(await runWithServiceDeadline('independent-task-verification', serviceTimeoutMs, signal => verifyCandidate({
            task: structuredClone(task),
            execution: structuredClone(execution),
            context: structuredClone(executionContext),
            signal,
          }))) as { bindingVerified: boolean; passed: boolean; coveredCapabilityIds: string[] };
          if (!verified || typeof verified.bindingVerified !== 'boolean' ||
              typeof verified.passed !== 'boolean' || !Array.isArray(verified.coveredCapabilityIds) ||
              verified.coveredCapabilityIds.length > MAX_VERIFIED_CAPABILITY_IDS ||
              verified.coveredCapabilityIds.some(id => !isSafeLearningIdentity(id, 256)) ||
              new Set(verified.coveredCapabilityIds).size !== verified.coveredCapabilityIds.length) {
            throw new Error('independent-task-verifier-result-invalid');
          }
          // A verifier may confirm only capabilities this task actually requested.
          // Otherwise a faulty/miswired verifier could inflate cross-task coverage
          // and make the aggregate candidate appear more capable than observed.
          const requestedCapabilities = new Set(task.requiredCapabilityIds);
          if (verified.coveredCapabilityIds.some(id => !requestedCapabilities.has(id))) {
            throw new Error('independent-task-verifier-capability-out-of-scope');
          }
          bindingVerified = verified.bindingVerified;
          verifierPassed = verified.passed && bindingVerified;
          coveredCapabilityIds = bindingVerified ? verified.coveredCapabilityIds : [];
        } catch {
          // A verifier failure fails task success but does not rewrite execution as non-executable.
          verifierPassed = false;
        }
      }
      const safety = snapshotPlainData(await runWithServiceDeadline('independent-candidate-safety-scan', serviceTimeoutMs, signal => scanCandidateSafety({
        payload: structuredClone(candidatePayload), task: structuredClone(task),
        ...(execution ? { execution: structuredClone(execution) } : {}),
        context: structuredClone(executionContext),
        signal,
      }))) as { violationCount: number };
      if (!safety || !Number.isSafeInteger(safety.violationCount) || safety.violationCount < 0) {
        throw new Error('independent-candidate-safety-result-invalid');
      }
      runBindings.push({
        taskId: task.taskId,
        trialId: task.trialId,
        // A run ID and trace are evidence only after the independent verifier binds
        // them to the exact candidate/task/environment/plan context.
        runId: bindingVerified ? execution?.runId ?? null : null,
        plannedRunId: plannedRun?.runId ?? null,
        seed: task.seed,
        split: task.split,
        // Executability records the observed run; verification separately controls trust.
        executable,
        observedStepIds: bindingVerified ? execution?.observedStepIds ?? [] : [],
        bindingVerified,
        verifierPassed: executable && bindingVerified && verifierPassed,
        coveredCapabilityIds,
        safetyViolationCount: safety.violationCount,
      });
      // Unbound traces, verifier failure, or unsafe behavior are task failures.
      const trustedExecution = executable && bindingVerified;
      const taskPassed = trustedExecution && verifierPassed && safety.violationCount === 0;
      const report = evaluateSkillLearnBenchTrial({
        taskId: task.taskId,
        ...(taskFamilyById.has(task.taskId) || task.taskFamily !== undefined ? { taskFamily: taskFamilyById.get(task.taskId) ?? task.taskFamily } : {}),
        trialId: task.trialId,
        verifierPassed: taskPassed,
        skill: {
          requiredCapabilityIds: task.requiredCapabilityIds,
          coveredCapabilityIds,
          // A valid execution may exist even when its outcome evidence is untrusted.
          executable,
          safetyViolationCount: safety.violationCount,
        },
        trajectory: {
          expectedStepIds: task.expectedStepIds,
          observedStepIds: bindingVerified ? execution?.observedStepIds ?? [] : [],
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
        environmentFingerprint,
        planFingerprint,
        experimentAuthority: authority ? {
          manifestFingerprint: authority.validationPlan.manifestFingerprint,
          validationPlanFingerprint: authority.validationPlan.planFingerprint,
          holdoutPlanFingerprint: authority.holdoutPlan.planFingerprint,
          method: authority.method,
          attempt: authority.attempt ?? 1,
        } : null,
        runBindings,
      },
    };
    const evaluationFingerprint = sha256(canonical(evaluation));
    return { payloadFingerprint, evaluationFingerprint, evaluation };
  };
}


/**
 * Commit independently bound evaluator outcomes to the existing canonical ledger.
 * This is deliberately a separate explicit step: evaluation alone does not mutate
 * training truth, and no unbound trace can be promoted into verified evidence.
 */
export function recordIndependentEvaluationOutcomes(
  result: {
    payloadFingerprint: string;
    evaluationFingerprint: string;
    evaluation: {
      validation: SkillLearnBenchTrialReport[];
      holdout: SkillLearnBenchTrialReport[];
      provenance: {
        payloadFingerprint: string;
        experimentAuthority: {
          manifestFingerprint: string;
          validationPlanFingerprint: string;
          holdoutPlanFingerprint: string;
          method: string;
          attempt: number;
        } | null;
        runBindings: Array<{
          taskId: string; trialId: string; runId: string | null; plannedRunId: string | null;
          seed: number; split: string; bindingVerified: boolean; safetyViolationCount: number;
        }>;
      };
    };
  },
  authority: {
    manifest: TaskManifestEntry[];
    ledger: VerifiedOutcomeLedger;
    validationPlan: LearningExperimentPlan;
    holdoutPlan: LearningExperimentPlan;
    method: string;
    attempt?: number;
  },
  observedAt = Date.now(),
): { accepted: number } {
  const evaluation = result?.evaluation;
  if (!evaluation?.provenance || !(authority?.ledger instanceof VerifiedOutcomeLedger) ||
      !isDigest(result?.payloadFingerprint) || !isDigest(result?.evaluationFingerprint) ||
      !Array.isArray(evaluation.provenance.runBindings) || !Number.isFinite(observedAt) || observedAt <= 0) {
    throw new Error('independent-evaluation-ledger-commit-invalid');
  }
  // Recompute the evaluator's canonical digest before treating its reports as evidence.
  // This detects accidental or post-evaluation mutation of reports/provenance.
  if (result.payloadFingerprint !== evaluation.provenance.payloadFingerprint ||
      result.evaluationFingerprint !== sha256(canonical(evaluation))) {
    throw new Error('independent-evaluation-ledger-evaluation-fingerprint-mismatch');
  }
  validateLearningExperimentPlan(authority.validationPlan, authority.manifest);
  validateLearningExperimentPlan(authority.holdoutPlan, authority.manifest);
  if (typeof authority.method !== 'string' || !authority.method.trim()) {
    throw new Error('independent-evaluation-ledger-method-invalid');
  }
  const attempt = authority.attempt ?? 1;
  const recordedAuthority = evaluation.provenance.experimentAuthority;
  if (!recordedAuthority ||
      recordedAuthority.manifestFingerprint !== authority.ledger.manifestFingerprint() ||
      recordedAuthority.validationPlanFingerprint !== authority.validationPlan.planFingerprint ||
      recordedAuthority.holdoutPlanFingerprint !== authority.holdoutPlan.planFingerprint ||
      recordedAuthority.method !== authority.method || recordedAuthority.attempt !== attempt ||
      authority.validationPlan.split !== 'validation' || authority.holdoutPlan.split !== 'holdout') {
    throw new Error('independent-evaluation-ledger-authority-mismatch');
  }
  const bindings = evaluation.provenance.runBindings;
  const reports = [...evaluation.validation, ...evaluation.holdout];
  if (bindings.length !== reports.length || !bindings.length) {
    throw new Error('independent-evaluation-ledger-incomplete-reports');
  }
  const reportByTrial = new Map<string, SkillLearnBenchTrialReport>();
  for (const report of reports) {
    if (reportByTrial.has(report.trialId)) throw new Error('independent-evaluation-ledger-duplicate-trial');
    reportByTrial.set(report.trialId, report);
  }
  const seenPlannedRuns = new Set<string>();
  const pending: Array<{ plan: LearningExperimentPlan; runId: string; passed: boolean; evidenceRef: string }> = [];
  const reportSplitByTrial = new Map<string, 'validation' | 'holdout'>();
  for (const report of evaluation.validation) {
    if (!report || typeof report.trialId !== 'string' || typeof report.taskId !== 'string' ||
        !report.taskSuccess || typeof report.taskSuccess.passed !== 'boolean' ||
        reportSplitByTrial.has(report.trialId)) {
      throw new Error('independent-evaluation-ledger-validation-report-invalid');
    }
    reportSplitByTrial.set(report.trialId, 'validation');
  }
  for (const report of evaluation.holdout) {
    if (!report || typeof report.trialId !== 'string' || typeof report.taskId !== 'string' ||
        !report.taskSuccess || typeof report.taskSuccess.passed !== 'boolean' ||
        reportSplitByTrial.has(report.trialId)) {
      throw new Error('independent-evaluation-ledger-holdout-report-invalid');
    }
    reportSplitByTrial.set(report.trialId, 'holdout');
  }
  const expectedRuns = [
    ...authority.validationPlan.runs.filter(run => run.method === authority.method),
    ...authority.holdoutPlan.runs.filter(run => run.method === authority.method),
  ];
  if (expectedRuns.length !== bindings.length ||
      new Set(expectedRuns.map(run => run.runId)).size !== expectedRuns.length) {
    throw new Error('independent-evaluation-ledger-plan-coverage-incomplete');
  }
  for (const binding of bindings) {
    if (!binding.bindingVerified || !binding.runId || !binding.plannedRunId ||
        !Number.isSafeInteger(binding.seed) || binding.seed < 0 ||
        !['validation', 'holdout'].includes(binding.split)) {
      throw new Error('independent-evaluation-ledger-unbound-run');
    }
    const plan = binding.split === 'validation' ? authority.validationPlan : authority.holdoutPlan;
    const scheduled = plan.runs.find(run => run.runId === binding.plannedRunId);
    if (!scheduled || scheduled.taskId !== binding.taskId || scheduled.seed !== binding.seed ||
        scheduled.method !== authority.method || scheduled.split !== binding.split ||
        seenPlannedRuns.has(scheduled.runId)) {
      throw new Error('independent-evaluation-ledger-run-not-scheduled');
    }
    seenPlannedRuns.add(scheduled.runId);
    const report = reportByTrial.get(binding.trialId);
    if (!report || report.taskId !== binding.taskId ||
        reportSplitByTrial.get(binding.trialId) !== binding.split) {
      throw new Error('independent-evaluation-ledger-report-binding-mismatch');
    }
    pending.push({
      plan,
      runId: scheduled.runId,
      passed: report.taskSuccess.passed && binding.safetyViolationCount === 0,
      evidenceRef: binding.runId,
    });
  }
  if (seenPlannedRuns.size !== expectedRuns.length ||
      expectedRuns.some(run => !seenPlannedRuns.has(run.runId))) {
    throw new Error('independent-evaluation-ledger-plan-coverage-incomplete');
  }
  // Preflight every cell before writing any rows. The canonical ledger rejects a
  // second outcome for the same task/method/seed, even if the attempt differs.
  const existing = authority.ledger.snapshot().outcomes as Array<{
    taskId: string; method: string; seed: number;
  }>;
  for (const item of pending) {
    const run = item.plan.runs.find(candidate => candidate.runId === item.runId)!;
    if (existing.some(row => row.taskId === run.taskId && row.method === run.method && row.seed === run.seed)) {
      throw new Error('independent-evaluation-ledger-cell-already-recorded');
    }
  }
  const batch: VerifiedTaskOutcome[] = pending.map(item => {
    const scheduled = item.plan.runs.find(candidate => candidate.runId === item.runId);
    if (!scheduled) throw new Error('independent-evaluation-ledger-run-not-scheduled');
    return {
      taskId: scheduled.taskId,
      taskVersion: scheduled.taskVersion,
      method: scheduled.method,
      seed: scheduled.seed,
      attempt,
      passed: item.passed,
      authority: 'independent-verifier',
      verifierId: scheduled.verifierId,
      evidenceRef: item.evidenceRef,
      observedAt,
    };
  });
  const batchResult = authority.ledger.recordBatch(batch);
  if (batchResult.accepted !== batch.length) {
    throw new Error('independent-evaluation-ledger-atomic-batch-rejected');
  }
  return { accepted: batchResult.accepted };
}


/**
 * Optional multi-seed replication policy for independently bound candidate comparisons.
 * A seed counts only when every sufficiently sampled task in a family has a paired
 * baseline/candidate report at that seed. Caller task names are not used to infer families.
 */
export interface IndependentEvaluationFamilySeedCoverageOptions {
  /** Minimum common paired seeds required for each sufficiently sampled validation family; 0 disables the extra check. */
  minimumValidationFamilySeeds?: number;
  /** Minimum common paired seeds required for each sufficiently sampled holdout family; 0 disables the extra check. */
  minimumHoldoutFamilySeeds?: number;
  /** Confidence level for deterministic bootstrap intervals; default 0.95. */
  confidenceLevel?: number;
  /** Number of deterministic bootstrap resamples; default 2000. */
  bootstrapResamples?: number;
}

interface IndependentFamilySeedCoverageReport {
  familiesEvaluated: number;
  familiesWithSufficientSeeds: number;
  familySeedCoverageFailures: number;
}

function independentFamilySeedCoverage<TBinding extends { seed: number }>(
  reports: SkillLearnBenchTrialReport[],
  bindings: Map<string, TBinding>,
  minimumTasks: number,
  minimumSeeds: number,
): IndependentFamilySeedCoverageReport {
  const byFamily = new Map<string, Map<string, Set<number>>>();
  for (const report of reports) {
    const family = report.taskFamily;
    if (!family) continue;
    const key = JSON.stringify([report.taskId, report.trialId]);
    const binding = bindings.get(key);
    if (!binding) throw new Error('matched-independent-evaluation-family-seed-binding-missing');
    const taskId = report.taskId.trim();
    const taskSeeds = byFamily.get(family) ?? new Map<string, Set<number>>();
    const seeds = taskSeeds.get(taskId) ?? new Set<number>();
    seeds.add(binding.seed);
    taskSeeds.set(taskId, seeds);
    byFamily.set(family, taskSeeds);
  }

  let familiesEvaluated = 0;
  let familiesWithSufficientSeeds = 0;
  let familySeedCoverageFailures = 0;
  for (const taskSeeds of byFamily.values()) {
    if (taskSeeds.size < minimumTasks) continue;
    familiesEvaluated++;
    const seedSets = [...taskSeeds.values()];
    const commonSeeds = [...seedSets[0]].filter(seed => seedSets.every(seeds => seeds.has(seed)));
    if (commonSeeds.length >= minimumSeeds) familiesWithSufficientSeeds++;
    else familySeedCoverageFailures++;
  }

  // A requested seed policy must not silently pass when no canonical family
  // is evaluable (missing labels or too few distinct tasks).
  if (minimumSeeds > 0 && familiesEvaluated === 0) familySeedCoverageFailures = 1;
  return { familiesEvaluated, familiesWithSufficientSeeds, familySeedCoverageFailures };
}

interface IndependentFamilyConfidenceReport {
  familiesEvaluated: number;
  confidenceBoundFailures: number;
  /** Worst lower bound across covered families; null means no family could be evaluated. */
  minimumLowerBound: number | null;
  /** Worst upper bound across covered families; null means no family could be evaluated. */
  maximumUpperBound: number | null;
  /** Equal-weight mean of per-family paired-seed mean deltas, not a task-pooled mean. */
  meanDelta: number | null;
}

function independentFamilyConfidenceBounds<TBaselineBinding extends { seed: number }, TCandidateBinding extends { seed: number }>(
  baselineReports: SkillLearnBenchTrialReport[],
  candidateReports: SkillLearnBenchTrialReport[],
  baselineBindings: Map<string, TBaselineBinding>,
  candidateBindings: Map<string, TCandidateBinding>,
  minimumTasks: number,
  minimumSeeds: number,
  confidenceLevel: number,
  resamples: number,
  planFingerprint: string,
  split: 'validation' | 'holdout',
  maximumRegression: number,
  requirePositiveLowerBound: boolean,
): IndependentFamilyConfidenceReport {
  if (minimumSeeds === 0) return {
    familiesEvaluated: 0, confidenceBoundFailures: 0,
    minimumLowerBound: null, maximumUpperBound: null, meanDelta: null,
  };
  const baselineByKey = new Map(baselineReports.map(report => [
    JSON.stringify([report.taskId.trim(), report.trialId.trim()]), report,
  ] as const));
  const byFamily = new Map<string, Map<string, Map<number, { baseline: number[]; candidate: number[] }>>>();
  for (const candidateReport of candidateReports) {
    const family = candidateReport.taskFamily;
    if (!family) continue;
    const key = JSON.stringify([candidateReport.taskId.trim(), candidateReport.trialId.trim()]);
    const baselineReport = baselineByKey.get(key);
    const candidateBinding = candidateBindings.get(key);
    const baselineBinding = baselineBindings.get(key);
    if (!baselineReport || !candidateBinding || !baselineBinding ||
        candidateBinding.seed !== baselineBinding.seed) {
      throw new Error('matched-independent-evaluation-family-confidence-binding-missing');
    }
    if (baselineReport.taskFamily !== family) {
      throw new Error('matched-independent-evaluation-family-confidence-mismatch');
    }
    const taskId = candidateReport.taskId.trim();
    const tasks = byFamily.get(family) ?? new Map<string, Map<number, { baseline: number[]; candidate: number[] }>>();
    const seeds = tasks.get(taskId) ?? new Map<number, { baseline: number[]; candidate: number[] }>();
    const values = seeds.get(candidateBinding.seed) ?? { baseline: [], candidate: [] };
    values.baseline.push(0.5 * baselineReport.taskSuccess.passRate +
      0.3 * baselineReport.trajectoryQuality.aggregate + 0.2 * baselineReport.skillQuality.aggregate);
    values.candidate.push(0.5 * candidateReport.taskSuccess.passRate +
      0.3 * candidateReport.trajectoryQuality.aggregate + 0.2 * candidateReport.skillQuality.aggregate);
    seeds.set(candidateBinding.seed, values);
    tasks.set(taskId, seeds);
    byFamily.set(family, tasks);
  }

  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  let familiesEvaluated = 0;
  let confidenceBoundFailures = 0;
  const lowerBounds: number[] = [];
  const upperBounds: number[] = [];
  const familyMeanDeltas: number[] = [];
  for (const [family, tasks] of byFamily.entries()) {
    if (tasks.size < minimumTasks) continue;
    const seedSets = [...tasks.values()].map(seeds => new Set(seeds.keys()));
    const commonSeeds = [...seedSets[0]].filter(seed => seedSets.every(seeds => seeds.has(seed))).sort((a, b) => a - b);
    if (commonSeeds.length < minimumSeeds) continue; // covered by the seed-coverage gate
    const deltas = commonSeeds.map(seed => {
      const perTask = [...tasks.values()].map(seeds => {
        const values = seeds.get(seed)!;
        return { baseline: mean(values.baseline), candidate: mean(values.candidate) };
      });
      return mean(perTask.map(row => row.candidate)) - mean(perTask.map(row => row.baseline));
    });
    const deterministicSeed = createHash('sha256')
      .update(JSON.stringify([planFingerprint, split, family, commonSeeds, deltas.length]))
      .digest().readUInt32BE(0);
    const interval = bootstrapMeanConfidenceInterval(deltas, {
      confidenceLevel, resamples, seed: deterministicSeed,
    });
    familiesEvaluated++;
    lowerBounds.push(interval.lower);
    upperBounds.push(interval.upper);
    familyMeanDeltas.push(interval.mean);
    const failed = requirePositiveLowerBound
      ? interval.lower <= 0
      : interval.lower < -maximumRegression;
    if (failed) confidenceBoundFailures++;
  }
  return {
    familiesEvaluated,
    confidenceBoundFailures,
    minimumLowerBound: lowerBounds.length ? Number(Math.min(...lowerBounds).toFixed(6)) : null,
    maximumUpperBound: upperBounds.length ? Number(Math.max(...upperBounds).toFixed(6)) : null,
    meanDelta: familyMeanDeltas.length
      ? Number((familyMeanDeltas.reduce((sum, value) => sum + value, 0) / familyMeanDeltas.length).toFixed(6))
      : null,
  };
}

/**
 * Compare two independently evaluated payloads only after proving that every
 * baseline/candidate trial used the same task, trial, seed, split, plan and
 * runtime environment. This is the matched-pair boundary for WorkPass225:
 * matching report IDs alone is insufficient because they can hide changed
 * inputs or cross-environment comparisons.
 */
export function compareMatchedIndependentEvaluations(
  baseline: {
    payloadFingerprint: string;
    evaluationFingerprint: string;
    evaluation: {
      validation: SkillLearnBenchTrialReport[];
      holdout: SkillLearnBenchTrialReport[];
      provenance: {
        payloadFingerprint: string;
        environmentFingerprint: string;
        planFingerprint: string;
        experimentAuthority: {
          manifestFingerprint: string;
          validationPlanFingerprint: string;
          holdoutPlanFingerprint: string;
          method: string;
          attempt: number;
        } | null;
        runBindings: Array<{
          taskId: string; trialId: string; runId: string | null; plannedRunId: string | null;
          seed: number; split: string; bindingVerified: boolean; verifierPassed: boolean;
          safetyViolationCount: number;
        }>;
      };
    };
  },
  candidate: {
    payloadFingerprint: string;
    evaluationFingerprint: string;
    evaluation: {
      validation: SkillLearnBenchTrialReport[];
      holdout: SkillLearnBenchTrialReport[];
      provenance: {
        payloadFingerprint: string;
        environmentFingerprint: string;
        planFingerprint: string;
        experimentAuthority: {
          manifestFingerprint: string;
          validationPlanFingerprint: string;
          holdoutPlanFingerprint: string;
          method: string;
          attempt: number;
        } | null;
        runBindings: Array<{
          taskId: string; trialId: string; runId: string | null; plannedRunId: string | null;
          seed: number; split: string; bindingVerified: boolean; verifierPassed: boolean;
          safetyViolationCount: number;
        }>;
      };
    };
  },
  gateOptions: SkillLearnBenchCandidateGateOptions = {},
  seedCoverageOptions: IndependentEvaluationFamilySeedCoverageOptions = {},
): SkillLearnBenchCandidateGateReport & {
  matchedTrialCount: number;
  matchedValidationTrialCount: number;
  matchedHoldoutTrialCount: number;
  validationFamiliesEvaluatedForSeedCoverage: number;
  holdoutFamiliesEvaluatedForSeedCoverage: number;
  validationFamiliesWithSufficientSeeds: number;
  holdoutFamiliesWithSufficientSeeds: number;
  validationFamilySeedCoverageFailures: number;
  holdoutFamilySeedCoverageFailures: number;
  validationFamiliesEvaluatedForConfidenceInterval: number;
  holdoutFamiliesEvaluatedForConfidenceInterval: number;
  validationFamilyConfidenceBoundFailures: number;
  holdoutFamilyConfidenceBoundFailures: number;
  validationFamilyMeanDelta: number | null;
  validationFamilyLowerBoundMinimum: number | null;
  validationFamilyUpperBoundMaximum: number | null;
  holdoutFamilyMeanDelta: number | null;
  holdoutFamilyLowerBoundMinimum: number | null;
  holdoutFamilyUpperBoundMaximum: number | null;
  environmentFingerprint: string;
  planFingerprint: string;
  learningRobustDiagnostics: {
    diagnosticOnly: true;
    validation: LearningRobustMetricSummary;
    holdout: LearningRobustMetricSummary;
  };
} {
  const validEnvelope = (value: typeof baseline, label: string): void => {
    if (!value || !isDigest(value.payloadFingerprint) || !isDigest(value.evaluationFingerprint) ||
        !value.evaluation || !value.evaluation.provenance ||
        value.evaluation.provenance.payloadFingerprint !== value.payloadFingerprint ||
        value.evaluationFingerprint !== sha256(canonical(value.evaluation)) ||
        !isDigest(value.evaluation.provenance.environmentFingerprint) ||
        !isDigest(value.evaluation.provenance.planFingerprint) ||
        !Array.isArray(value.evaluation.validation) || !Array.isArray(value.evaluation.holdout) ||
        !Array.isArray(value.evaluation.provenance.runBindings)) {
      throw new Error(`matched-independent-evaluation-${label}-envelope-invalid`);
    }
  };
  validEnvelope(baseline, 'baseline');
  validEnvelope(candidate, 'candidate');
  const bp = baseline.evaluation.provenance;
  const cp = candidate.evaluation.provenance;
  if (bp.environmentFingerprint !== cp.environmentFingerprint) {
    throw new Error('matched-independent-evaluation-environment-mismatch');
  }
  if (bp.planFingerprint !== cp.planFingerprint) {
    throw new Error('matched-independent-evaluation-task-plan-mismatch');
  }
  const ba = bp.experimentAuthority;
  const ca = cp.experimentAuthority;
  if (!!ba !== !!ca ||
      (ba && ca && (ba.manifestFingerprint !== ca.manifestFingerprint ||
        ba.validationPlanFingerprint !== ca.validationPlanFingerprint ||
        ba.holdoutPlanFingerprint !== ca.holdoutPlanFingerprint ||
        ba.attempt !== ca.attempt || ba.method === ca.method))) {
    throw new Error('matched-independent-evaluation-experiment-authority-mismatch');
  }
  const bindingsByKey = (value: typeof baseline, label: string) => {
    const map = new Map<string, (typeof value.evaluation.provenance.runBindings)[number]>();
    const reportSplitByKey = new Map<string, 'validation' | 'holdout'>();
    const reports = [
      ...value.evaluation.validation.map(report => ({ report, split: 'validation' as const })),
      ...value.evaluation.holdout.map(report => ({ report, split: 'holdout' as const })),
    ];
    for (const { report, split } of reports) {
      if (!report || typeof report.taskId !== 'string' || !report.taskId.trim() ||
          typeof report.trialId !== 'string' || !report.trialId.trim()) {
        throw new Error(`matched-independent-evaluation-${label}-report-invalid`);
      }
      const key = JSON.stringify([report.taskId, report.trialId]);
      if (reportSplitByKey.has(key)) {
        throw new Error(`matched-independent-evaluation-${label}-duplicate-report`);
      }
      reportSplitByKey.set(key, split);
    }
    if (reportSplitByKey.size !== value.evaluation.provenance.runBindings.length) {
      throw new Error(`matched-independent-evaluation-${label}-coverage-mismatch`);
    }
    for (const binding of value.evaluation.provenance.runBindings) {
      if (!binding || !['validation', 'holdout'].includes(binding.split) ||
          !Number.isSafeInteger(binding.seed) || binding.seed < 0 ||
          typeof binding.taskId !== 'string' || !binding.taskId.trim() ||
          typeof binding.trialId !== 'string' || !binding.trialId.trim() ||
          !binding.bindingVerified || !binding.verifierPassed ||
          !binding.runId || !binding.runId.trim() ||
          !Number.isSafeInteger(binding.safetyViolationCount) || binding.safetyViolationCount !== 0) {
        throw new Error(`matched-independent-evaluation-${label}-untrusted-trial`);
      }
      const key = JSON.stringify([binding.taskId, binding.trialId]);
      if (map.has(key) || !reportSplitByKey.has(key)) {
        throw new Error(`matched-independent-evaluation-${label}-duplicate-or-orphan-binding`);
      }
      if (reportSplitByKey.get(key) !== binding.split) {
        throw new Error(`matched-independent-evaluation-${label}-report-split-mismatch`);
      }
      map.set(key, binding);
    }
    return map;
  };
  const baselineBindings = bindingsByKey(baseline, 'baseline');
  const candidateBindings = bindingsByKey(candidate, 'candidate');
  if (baselineBindings.size !== candidateBindings.size || baselineBindings.size === 0) {
    throw new Error('matched-independent-evaluation-trial-count-mismatch');
  }
  for (const [key, left] of baselineBindings) {
    const right = candidateBindings.get(key);
    if (!right || left.taskId !== right.taskId || left.trialId !== right.trialId ||
        left.seed !== right.seed || left.split !== right.split) {
      throw new Error('matched-independent-evaluation-task-seed-split-mismatch');
    }
  }
  // Validate the two numeric gate knobs from own data descriptors before taking the
  // plain-data snapshot. This preserves the stable, field-specific error contract for
  // NaN/Infinity while refusing accessors without executing untrusted getters.
  if (!seedCoverageOptions || typeof seedCoverageOptions !== 'object' || Array.isArray(seedCoverageOptions)) {
    throw new Error('matched-independent-evaluation-seed-coverage-options-invalid');
  }
  for (const [key, label] of [
    ['minimumValidationFamilySeeds', 'validation'],
    ['minimumHoldoutFamilySeeds', 'holdout'],
  ] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(seedCoverageOptions, key);
    if (!descriptor) continue;
    if (!Object.hasOwn(descriptor, 'value')) {
      throw new Error('matched-independent-evaluation-seed-coverage-options-invalid');
    }
    const value = descriptor.value;
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0 || value > 1000)) {
      throw new RangeError(`matched-independent-evaluation-minimum-${label}-family-seeds-invalid`);
    }
  }
  const seedOptions = snapshotPlainData(seedCoverageOptions) as IndependentEvaluationFamilySeedCoverageOptions;
  if (!seedOptions || typeof seedOptions !== 'object' || Array.isArray(seedOptions)) {
    throw new Error('matched-independent-evaluation-seed-coverage-options-invalid');
  }
  const minimumValidationFamilySeeds = seedOptions.minimumValidationFamilySeeds ?? 0;
  const minimumHoldoutFamilySeeds = seedOptions.minimumHoldoutFamilySeeds ?? 0;
  for (const [value, label] of [
    [minimumValidationFamilySeeds, 'validation'],
    [minimumHoldoutFamilySeeds, 'holdout'],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 1000) {
      throw new RangeError(`matched-independent-evaluation-minimum-${label}-family-seeds-invalid`);
    }
  }
  const confidenceLevel = seedOptions.confidenceLevel ?? 0.95;
  const bootstrapResamples = seedOptions.bootstrapResamples ?? 2000;
  if (!Number.isFinite(confidenceLevel) || confidenceLevel <= 0.5 || confidenceLevel >= 1) {
    throw new RangeError('matched-independent-evaluation-confidence-level-invalid');
  }
  if (!Number.isSafeInteger(bootstrapResamples) || bootstrapResamples < 100 || bootstrapResamples > 50_000) {
    throw new RangeError('matched-independent-evaluation-bootstrap-resamples-invalid');
  }
  const gate = evaluateSkillLearnBenchCandidate(
    { validation: baseline.evaluation.validation, holdout: baseline.evaluation.holdout },
    { validation: candidate.evaluation.validation, holdout: candidate.evaluation.holdout },
    gateOptions,
  );
  const validationSeedCoverage = independentFamilySeedCoverage(
    candidate.evaluation.validation, candidateBindings,
    gateOptions.minimumValidationFamilyTasks ?? 2, minimumValidationFamilySeeds,
  );
  const holdoutSeedCoverage = independentFamilySeedCoverage(
    candidate.evaluation.holdout, candidateBindings,
    gateOptions.minimumHoldoutFamilyTasks ?? 2, minimumHoldoutFamilySeeds,
  );
  const validationConfidence = independentFamilyConfidenceBounds(
    baseline.evaluation.validation, candidate.evaluation.validation,
    baselineBindings, candidateBindings,
    gateOptions.minimumValidationFamilyTasks ?? 2, minimumValidationFamilySeeds,
    confidenceLevel, bootstrapResamples, bp.planFingerprint, 'validation',
    gateOptions.maximumValidationFamilyRegression01 ?? 0.10, true,
  );
  const holdoutConfidence = independentFamilyConfidenceBounds(
    baseline.evaluation.holdout, candidate.evaluation.holdout,
    baselineBindings, candidateBindings,
    gateOptions.minimumHoldoutFamilyTasks ?? 2, minimumHoldoutFamilySeeds,
    confidenceLevel, bootstrapResamples, bp.planFingerprint, 'holdout',
    gateOptions.maximumHoldoutFamilyRegression01 ?? 0.10, false,
  );
  // RLiable-inspired robust summaries are observable diagnostics only. The promotion
  // decision above remains owned by the existing confidence/coverage/safety gates.
  const learningRobustDiagnostics = {
    diagnosticOnly: true as const,
    validation: summarizeLearningRobustMetrics(
      baseline.evaluation.validation, candidate.evaluation.validation,
    ),
    holdout: summarizeLearningRobustMetrics(
      baseline.evaluation.holdout, candidate.evaluation.holdout,
    ),
  };
  const reasons = [...gate.reasons];
  const feedback = [...gate.feedback];
  if (validationSeedCoverage.familySeedCoverageFailures > 0) {
    reasons.push('validation-family-seed-coverage-insufficient');
    feedback.push('At least one sufficiently sampled validation family lacks the required common paired seeds; collect more independent runs before promotion.');
  }
  if (holdoutSeedCoverage.familySeedCoverageFailures > 0) {
    reasons.push('holdout-family-seed-coverage-insufficient');
    feedback.push('At least one sufficiently sampled holdout family lacks the required common paired seeds; collect more independent runs before promotion.');
  }
  if (validationConfidence.confidenceBoundFailures > 0) {
    reasons.push('validation-family-improvement-confidence-insufficient');
    feedback.push('At least one validation family lacks a positive lower bootstrap bound for paired-seed improvement; collect or inspect more independent runs before promotion.');
  }
  if (holdoutConfidence.confidenceBoundFailures > 0) {
    reasons.push('holdout-family-confidence-bound-regression-exceeds-tolerance');
    feedback.push('At least one holdout family lower bootstrap bound exceeds the tolerated regression; improve robustness without tuning against holdout examples.');
  }
  return {
    ...gate,
    eligible: reasons.length === 0,
    reasons,
    feedback,
    matchedTrialCount: baselineBindings.size,
    matchedValidationTrialCount: [...baselineBindings.values()].filter(row => row.split === 'validation').length,
    matchedHoldoutTrialCount: [...baselineBindings.values()].filter(row => row.split === 'holdout').length,
    validationFamiliesEvaluatedForSeedCoverage: validationSeedCoverage.familiesEvaluated,
    holdoutFamiliesEvaluatedForSeedCoverage: holdoutSeedCoverage.familiesEvaluated,
    validationFamiliesWithSufficientSeeds: validationSeedCoverage.familiesWithSufficientSeeds,
    holdoutFamiliesWithSufficientSeeds: holdoutSeedCoverage.familiesWithSufficientSeeds,
    validationFamilySeedCoverageFailures: validationSeedCoverage.familySeedCoverageFailures,
    holdoutFamilySeedCoverageFailures: holdoutSeedCoverage.familySeedCoverageFailures,
    validationFamiliesEvaluatedForConfidenceInterval: validationConfidence.familiesEvaluated,
    holdoutFamiliesEvaluatedForConfidenceInterval: holdoutConfidence.familiesEvaluated,
    validationFamilyConfidenceBoundFailures: validationConfidence.confidenceBoundFailures,
    holdoutFamilyConfidenceBoundFailures: holdoutConfidence.confidenceBoundFailures,
    validationFamilyMeanDelta: validationConfidence.meanDelta,
    validationFamilyLowerBoundMinimum: validationConfidence.minimumLowerBound,
    validationFamilyUpperBoundMaximum: validationConfidence.maximumUpperBound,
    holdoutFamilyMeanDelta: holdoutConfidence.meanDelta,
    holdoutFamilyLowerBoundMinimum: holdoutConfidence.minimumLowerBound,
    holdoutFamilyUpperBoundMaximum: holdoutConfidence.maximumUpperBound,
    environmentFingerprint: bp.environmentFingerprint,
    planFingerprint: bp.planFingerprint,
    learningRobustDiagnostics,
  };
}
