import { createHash } from 'node:crypto';
import { evaluateSkillLearnBenchCandidate, evaluateSkillLearnBenchTrial, type SkillLearnBenchCandidateGateReport, type SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';
import type { RevisedCandidateEvaluator } from './P23LearningEngine.ts';
import {
  recordPlannedLearningOutcome,
  validateLearningExperimentPlan,
  type LearningExperimentPlan,
} from './LearningExperimentPlan.ts';
import { VerifiedOutcomeLedger, type TaskManifestEntry } from './VerifiedOutcomeLedger.ts';

export interface IndependentCandidateTask {
  taskId: string;
  trialId: string;
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
  /** Host-defined method labels used to separate native baseline/source/revision evaluations. */
  baselineMethod?: string;
  sourceCandidateMethod?: string;
  /** Per-service deadline; timeout aborts the service signal and fails closed. Defaults to 30s. */
  serviceTimeoutMs?: number;
}
const isDigest = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{64}$/i.test(x);
const isSafeRunId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 256 &&
  value.trim() === value &&
  !Array.from(value).some(character => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
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
function validateConfig(config: IndependentCandidateEvaluationConfig): void {
  if (!config || !Array.isArray(config.tasks) || config.tasks.length < 2 ||
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
  const authority = config.experimentAuthority;
  if (authority) {
    if (!Array.isArray(authority.manifest) || !(authority.ledger instanceof VerifiedOutcomeLedger) ||
        typeof authority.method !== 'string' || !authority.method.trim() ||
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
    for (const task of config.tasks) {
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
  validateConfig(config);
  const tasks = config.tasks.map(task => structuredClone(task));
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
    manifest: structuredClone(config.experimentAuthority.manifest),
    ledger: config.experimentAuthority.ledger,
    validationPlan: structuredClone(config.experimentAuthority.validationPlan),
    holdoutPlan: structuredClone(config.experimentAuthority.holdoutPlan),
    method: config.experimentAuthority.method,
    ...(config.experimentAuthority.attempt === undefined ? {} : { attempt: config.experimentAuthority.attempt }),
  } : undefined;
  const planFingerprint = sha256(canonical(tasks.map(({ taskId, trialId, seed, split, input, requiredCapabilityIds, expectedStepIds }) =>
    ({ taskId, trialId, seed, split, input, requiredCapabilityIds, expectedStepIds }))));
  return async ({ payload, payloadFingerprint }) => {
    // Snapshot the candidate once, before the first asynchronous boundary. Re-cloning
    // the caller-owned object per trial would allow a retained reference to change
    // later trials while they still carry the fingerprint computed for the original.
    let candidatePayload: unknown;
    try {
      candidatePayload = structuredClone(payload);
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
        execution = structuredClone(await runWithServiceDeadline('candidate-sandbox-execution', serviceTimeoutMs, signal => executeCandidate({
          payload: structuredClone(candidatePayload),
          task: structuredClone(task),
          context: structuredClone(executionContext),
          signal,
        })));
        if (!execution || !isSafeRunId(execution.runId) ||
            !Array.isArray(execution.observedStepIds) ||
            execution.observedStepIds.some(step => typeof step !== 'string' || !step.trim()) ||
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
          const verified = await runWithServiceDeadline('independent-task-verification', serviceTimeoutMs, signal => verifyCandidate({
            task: structuredClone(task),
            execution: structuredClone(execution),
            context: structuredClone(executionContext),
            signal,
          }));
          if (!verified || typeof verified.bindingVerified !== 'boolean' ||
              typeof verified.passed !== 'boolean' || !Array.isArray(verified.coveredCapabilityIds) ||
              verified.coveredCapabilityIds.some(id => typeof id !== 'string' || !id.trim()) ||
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
      const safety = await runWithServiceDeadline('independent-candidate-safety-scan', serviceTimeoutMs, signal => scanCandidateSafety({
        payload: structuredClone(candidatePayload), task: structuredClone(task),
        ...(execution ? { execution: structuredClone(execution) } : {}),
        context: structuredClone(executionContext),
        signal,
      }));
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
        executable, // whether the sandbox execution itself was valid; binding is recorded separately
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
        trialId: task.trialId,
        verifierPassed: taskPassed,
        skill: {
          requiredCapabilityIds: task.requiredCapabilityIds,
          coveredCapabilityIds,
          // Execution and independent verification are separate evidence axes.
          // Keep executability true when the process ran, even if the verifier is unavailable.
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
  for (const item of pending) {
    const result = recordPlannedLearningOutcome(authority.ledger, item.plan, item.runId, {
      attempt,
      passed: item.passed,
      authority: 'independent-verifier',
      evidenceRef: item.evidenceRef,
      observedAt,
    });
    if (!result.accepted) throw new Error('independent-evaluation-ledger-rejected-outcome');
  }
  return { accepted: pending.length };
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
): SkillLearnBenchCandidateGateReport & {
  matchedTrialCount: number;
  matchedValidationTrialCount: number;
  matchedHoldoutTrialCount: number;
  environmentFingerprint: string;
  planFingerprint: string;
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
  const gate = evaluateSkillLearnBenchCandidate(
    { validation: baseline.evaluation.validation, holdout: baseline.evaluation.holdout },
    { validation: candidate.evaluation.validation, holdout: candidate.evaluation.holdout },
  );
  return {
    ...gate,
    matchedTrialCount: baselineBindings.size,
    matchedValidationTrialCount: [...baselineBindings.values()].filter(row => row.split === 'validation').length,
    matchedHoldoutTrialCount: [...baselineBindings.values()].filter(row => row.split === 'holdout').length,
    environmentFingerprint: bp.environmentFingerprint,
    planFingerprint: bp.planFingerprint,
  };
}
