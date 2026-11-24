import { createHash } from 'node:crypto';
import type {
  CandidateExecutionContext,
  CandidateExecutionResult,
  CandidateSandboxExecutor,
  IndependentCandidateSafetyScanner,
  IndependentCandidateTask,
  IndependentTaskVerifier,
} from './IndependentSkillCandidateEvaluator.ts';
import { evaluateSkillLearnBenchTrial, type SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';
import { validateLearningExperimentPlan, type LearningExperimentPlan } from './LearningExperimentPlan.ts';
import { snapshotPlainData } from './LearningTrustBoundary.ts';
import { VerifiedOutcomeLedger, type TaskManifestEntry } from './VerifiedOutcomeLedger.ts';

export interface ValidationOnlyCandidateEvaluationConfig {
  /** This array must contain validation tasks only; there is no holdout task field. */
  tasks: IndependentCandidateTask[];
  /** Validation-only projection of the trusted task manifest. */
  manifest: TaskManifestEntry[];
  /** Fixed validation-only schedule. */
  plan: LearningExperimentPlan;
  /** Method scheduled in the validation plan for the candidate. */
  method: string;
  executor: CandidateSandboxExecutor;
  verifier: IndependentTaskVerifier;
  safetyScanner: IndependentCandidateSafetyScanner;
  environmentFingerprint: string;
  serviceTimeoutMs?: number;
}

export interface ValidationOnlyCandidateEvaluation {
  payloadFingerprint: string;
  validationManifestFingerprint: string;
  validationPlanFingerprint: string;
  environmentFingerprint: string;
  reports: SkillLearnBenchTrialReport[];
}

export interface ValidationOnlyCandidateEvaluator {
  evaluate(input: {
    payload: unknown;
    payloadFingerprint: string;
    signal?: AbortSignal;
  }): Promise<ValidationOnlyCandidateEvaluation>;
}

const DIGEST = /^[a-f0-9]{64}$/;
const MAX_TASKS = 4096;
const MAX_CAPABILITIES = 128;
const MAX_STEPS = 512;
const DEFAULT_SERVICE_TIMEOUT_MS = 30_000;

const isSafeIdentity = (value: unknown, max = 256): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max &&
  value.trim() === value && value.normalize('NFKC') === value &&
  !Array.from(value).some(character => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Canonical serializer shared with the existing P23/evaluator payload fingerprint contract. */
function canonical(value: unknown, ancestors = new Set<object>()): string {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('p23-validation-only-non-finite-value');
  }
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('p23-validation-only-value-not-json-serializable');
    return encoded;
  }
  if (ancestors.has(value)) throw new Error('p23-validation-only-circular-value');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error('p23-validation-only-non-plain-value');
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

function bindCapability<T extends (...args: any[]) => any>(
  target: unknown,
  key: 'execute' | 'verify' | 'scan',
): T {
  if (target === null || (typeof target !== 'object' && typeof target !== 'function')) {
    throw new Error('p23-validation-only-host-capability-invalid');
  }
  let cursor: object | null = target as object;
  const seen = new Set<object>();
  try {
    for (let depth = 0; cursor && depth < 32; depth++) {
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const descriptor = Object.getOwnPropertyDescriptor(cursor, key);
      if (descriptor) {
        if (!('value' in descriptor) || typeof descriptor.value !== 'function') {
          throw new Error('p23-validation-only-host-capability-invalid');
        }
        return descriptor.value.bind(target) as T;
      }
      cursor = Object.getPrototypeOf(cursor) as object | null;
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'p23-validation-only-host-capability-invalid') throw error;
    throw new Error('p23-validation-only-host-capability-invalid');
  }
  throw new Error('p23-validation-only-host-capability-invalid');
}

function readConfigDescriptors(raw: unknown): Record<string, PropertyDescriptor> {
  if (!isPlainRecord(raw)) throw new Error('p23-validation-only-config-must-be-plain-object');
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const allowed = new Set([
    'tasks', 'manifest', 'plan', 'method', 'executor', 'verifier',
    'safetyScanner', 'environmentFingerprint', 'serviceTimeoutMs',
  ]);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      throw new Error('p23-validation-only-config-contains-non-validation-field');
    }
    const descriptor = descriptors[key];
    if (!descriptor || !('value' in descriptor)) {
      throw new Error('p23-validation-only-config-accessor-rejected');
    }
  }
  return descriptors;
}

function readEvaluationInput(raw: unknown): {
  payload: unknown;
  payloadFingerprint: string;
  signal?: AbortSignal;
} {
  if (!isPlainRecord(raw)) throw new Error('p23-validation-only-evaluation-input-invalid');
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !['payload', 'payloadFingerprint', 'signal'].includes(key)) {
      throw new Error('p23-validation-only-evaluation-input-contains-extra-field');
    }
    if (!('value' in descriptors[key]!)) throw new Error('p23-validation-only-evaluation-input-accessor-rejected');
  }
  const payload = snapshotPlainData(descriptors.payload?.value);
  const payloadFingerprint = descriptors.payloadFingerprint?.value;
  const signal = descriptors.signal?.value as AbortSignal | undefined;
  if (typeof payloadFingerprint !== 'string' || !DIGEST.test(payloadFingerprint)) {
    throw new Error('p23-validation-only-payload-fingerprint-invalid');
  }
  if (signal !== undefined &&
      (signal === null || typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function')) {
    throw new Error('p23-validation-only-abort-signal-invalid');
  }
  return { payload, payloadFingerprint, ...(signal === undefined ? {} : { signal }) };
}

async function runWithServiceDeadline<T>(
  label: string,
  timeoutMs: number,
  parentSignal: AbortSignal | undefined,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (parentSignal?.aborted) throw new Error(label + '-aborted');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let parentAbortListener: (() => void) | undefined;
  let rejectParentAbort: ((reason: Error) => void) | undefined;
  const parentAbort = parentSignal
    ? new Promise<never>((_, reject) => { rejectParentAbort = reject; })
    : new Promise<never>(() => undefined);

  if (parentSignal) {
    parentAbortListener = () => {
      controller.abort(parentSignal.reason);
      rejectParentAbort?.(new Error(label + '-aborted'));
    };
    parentSignal.addEventListener('abort', parentAbortListener, { once: true });
  }

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort(new Error(label + '-timeout'));
      reject(new Error(label + '-timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), deadline, parentAbort]);
  } catch (error) {
    if (parentSignal?.aborted) throw new Error(label + '-aborted');
    if (controller.signal.aborted) throw new Error(label + '-timeout');
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (parentSignal && parentAbortListener) {
      parentSignal.removeEventListener('abort', parentAbortListener);
    }
  }
}

function uniqueSafeIds(raw: unknown, label: string, limit: number): string[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > limit ||
      raw.some(item => !isSafeIdentity(item))) {
    throw new Error('p23-validation-only-' + label + '-invalid');
  }
  if (new Set(raw).size !== raw.length) throw new Error('p23-validation-only-' + label + '-duplicate');
  return [...raw] as string[];
}

interface FrozenValidationTask {
  task: IndependentCandidateTask;
  taskFamily: string;
  plannedRunId: string;
}

function snapshotValidationInputs(config: unknown): {
  tasks: FrozenValidationTask[];
  manifestFingerprint: string;
  plan: LearningExperimentPlan;
  method: string;
  environmentFingerprint: string;
  serviceTimeoutMs: number;
  execute: CandidateSandboxExecutor['execute'];
  verify: IndependentTaskVerifier['verify'];
  scan: IndependentCandidateSafetyScanner['scan'];
} {
  const descriptors = readConfigDescriptors(config);
  const value = (key: string): unknown => descriptors[key]?.value;

  const tasks = snapshotPlainData(value('tasks')) as IndependentCandidateTask[];
  const manifest = snapshotPlainData(value('manifest')) as TaskManifestEntry[];
  const plan = snapshotPlainData(value('plan')) as LearningExperimentPlan;
  const method = value('method');
  const environmentFingerprint = value('environmentFingerprint');
  const timeoutValue = value('serviceTimeoutMs');
  const serviceTimeoutMs = timeoutValue === undefined ? DEFAULT_SERVICE_TIMEOUT_MS : timeoutValue;

  if (!Array.isArray(manifest) || manifest.length === 0 || manifest.length > MAX_TASKS ||
      manifest.some(entry => !entry || entry.split !== 'validation')) {
    throw new Error('p23-validation-only-manifest-required');
  }
  if (!Array.isArray(tasks) || tasks.length === 0 || tasks.length > MAX_TASKS ||
      tasks.some(task => !task || task.split !== 'validation')) {
    throw new Error('p23-validation-only-tasks-required');
  }
  if (!plan || plan.split !== 'validation') throw new Error('p23-validation-only-plan-required');
  if (!isSafeIdentity(method, 180)) throw new Error('p23-validation-only-method-invalid');
  if (typeof environmentFingerprint !== 'string' || !DIGEST.test(environmentFingerprint)) {
    throw new Error('p23-validation-only-environment-fingerprint-invalid');
  }
  if (!Number.isSafeInteger(serviceTimeoutMs) || (serviceTimeoutMs as number) < 1 ||
      (serviceTimeoutMs as number) > 120_000) {
    throw new Error('p23-validation-only-service-timeout-invalid');
  }

  const ledger = new VerifiedOutcomeLedger(manifest);
  const manifestFingerprint = ledger.manifestFingerprint();
  if (!DIGEST.test(manifestFingerprint) || !DIGEST.test(plan.planFingerprint) ||
      plan.manifestFingerprint !== manifestFingerprint) {
    throw new Error('p23-validation-only-manifest-plan-fingerprint-mismatch');
  }
  validateLearningExperimentPlan(plan, manifest);
  if (!plan.arms.some(arm => arm.method === method)) {
    throw new Error('p23-validation-only-method-not-scheduled');
  }

  const manifestById = new Map<string, TaskManifestEntry>(manifest.map(entry => [entry.taskId, entry] as const));
  const scheduledByTaskSeed = new Map<string, string>();
  for (const run of plan.runs) {
    if (run.method !== method || run.split !== 'validation') continue;
    const key = JSON.stringify([run.taskId, run.seed]);
    if (scheduledByTaskSeed.has(key)) throw new Error('p23-validation-only-plan-run-duplicate');
    scheduledByTaskSeed.set(key, run.runId);
  }
  if (scheduledByTaskSeed.size !== tasks.length) {
    throw new Error('p23-validation-only-task-plan-coverage-mismatch');
  }

  const seenTaskTrials = new Set<string>();
  const seenTrialIds = new Set<string>();
  const seenTaskSeeds = new Set<string>();
  const frozenTasks = tasks.map((rawTask): FrozenValidationTask => {
    const task = rawTask as IndependentCandidateTask;
    if (!isSafeIdentity(task.taskId) || !isSafeIdentity(task.trialId) ||
        !Number.isSafeInteger(task.seed) || task.seed < 0 ||
        !isPlainRecord(task.input) || typeof task.input.prompt !== 'string' ||
        !Array.isArray(task.requiredCapabilityIds) || !Array.isArray(task.expectedStepIds)) {
      throw new Error('p23-validation-only-task-invalid');
    }
    const taskKey = JSON.stringify([task.taskId, task.trialId]);
    const taskSeedKey = JSON.stringify([task.taskId, task.seed]);
    if (seenTaskTrials.has(taskKey) || seenTrialIds.has(task.trialId) || seenTaskSeeds.has(taskSeedKey)) {
      throw new Error('p23-validation-only-task-trial-identity-duplicate');
    }
    seenTaskTrials.add(taskKey);
    seenTrialIds.add(task.trialId);
    seenTaskSeeds.add(taskSeedKey);

    const requiredCapabilityIds = uniqueSafeIds(task.requiredCapabilityIds, 'required-capabilities', MAX_CAPABILITIES);
    const expectedStepIds = uniqueSafeIds(task.expectedStepIds, 'expected-steps', MAX_STEPS);
    const manifestEntry = manifestById.get(task.taskId);
    if (!manifestEntry || manifestEntry.split !== 'validation' ||
        VerifiedOutcomeLedger.fingerprintPrompt(task.input.prompt) !== manifestEntry.promptFingerprint ||
        (task.taskFamily !== undefined && task.taskFamily !== manifestEntry.family)) {
      throw new Error('p23-validation-only-task-manifest-binding-mismatch');
    }
    const plannedRunId = scheduledByTaskSeed.get(taskSeedKey);
    if (!plannedRunId || !plan.seedIds.includes(task.seed)) {
      throw new Error('p23-validation-only-task-not-scheduled');
    }

    const detachedTask = snapshotPlainData({
      ...task,
      taskFamily: manifestEntry.family,
      requiredCapabilityIds,
      expectedStepIds,
    }) as IndependentCandidateTask;
    return { task: detachedTask, taskFamily: manifestEntry.family, plannedRunId };
  });

  // Require exact candidate-method coverage from the frozen validation plan.
  const actualKeys = new Set(frozenTasks.map(row => JSON.stringify([row.task.taskId, row.task.seed])));
  for (const key of scheduledByTaskSeed.keys()) {
    if (!actualKeys.has(key)) throw new Error('p23-validation-only-plan-task-missing');
  }

  const execute = bindCapability<CandidateSandboxExecutor['execute']>(value('executor'), 'execute');
  const verify = bindCapability<IndependentTaskVerifier['verify']>(value('verifier'), 'verify');
  const scan = bindCapability<IndependentCandidateSafetyScanner['scan']>(value('safetyScanner'), 'scan');
  return {
    tasks: frozenTasks,
    manifestFingerprint,
    plan,
    method,
    environmentFingerprint,
    serviceTimeoutMs: serviceTimeoutMs as number,
    execute,
    verify,
    scan,
  };
}

/**
 * Creates a host-owned evaluator that only holds validation tasks, their validation
 * manifest projection and their validation plan. It has no holdout task/plan/report input.
 * The capability cannot stage, approve or activate a skill candidate.
 */
export function createValidationOnlySkillCandidateEvaluator(
  rawConfig: ValidationOnlyCandidateEvaluationConfig,
): ValidationOnlyCandidateEvaluator {
  const frozen = snapshotValidationInputs(rawConfig);
  const planFingerprint = frozen.plan.planFingerprint;

  return {
    async evaluate(rawInput): Promise<ValidationOnlyCandidateEvaluation> {
      const input = readEvaluationInput(rawInput);
      const payloadCanonical = canonical(input.payload);
      if (sha256(payloadCanonical) !== input.payloadFingerprint) {
        throw new Error('p23-validation-only-payload-fingerprint-mismatch');
      }

      const reports: SkillLearnBenchTrialReport[] = [];
      const seenExecutionIds = new Set<string>();

      for (const row of frozen.tasks) {
        if (input.signal?.aborted) throw new Error('p23-validation-only-evaluation-aborted');
        const task = row.task;
        const context: CandidateExecutionContext = {
          payloadFingerprint: input.payloadFingerprint,
          taskInputFingerprint: sha256(canonical(task.input)),
          environmentFingerprint: frozen.environmentFingerprint,
          planFingerprint,
          manifestFingerprint: frozen.manifestFingerprint,
          experimentPlanFingerprint: planFingerprint,
          plannedRunId: row.plannedRunId,
        };

        const rawExecution = await runWithServiceDeadline(
          'p23-validation-only-executor',
          frozen.serviceTimeoutMs,
          input.signal,
          signal => frozen.execute({
            payload: snapshotPlainData(input.payload),
            task: snapshotPlainData(task) as IndependentCandidateTask,
            context: snapshotPlainData(context) as CandidateExecutionContext,
            signal,
          }),
        );
        const execution = snapshotPlainData(rawExecution) as CandidateExecutionResult;
        if (!execution || !isSafeIdentity(execution.runId, 256) ||
            !Array.isArray(execution.observedStepIds) ||
            execution.observedStepIds.length > MAX_STEPS ||
            execution.observedStepIds.some(step => !isSafeIdentity(step, 256)) ||
            new Set(execution.observedStepIds).size !== execution.observedStepIds.length ||
            seenExecutionIds.has(execution.runId)) {
          throw new Error('p23-validation-only-execution-result-invalid');
        }
        seenExecutionIds.add(execution.runId);

        const rawVerification = await runWithServiceDeadline(
          'p23-validation-only-verifier',
          frozen.serviceTimeoutMs,
          input.signal,
          signal => frozen.verify({
            task: snapshotPlainData(task) as IndependentCandidateTask,
            execution: snapshotPlainData(execution) as CandidateExecutionResult,
            context: snapshotPlainData(context) as CandidateExecutionContext,
            signal,
          }),
        );
        const verification = snapshotPlainData(rawVerification) as {
          bindingVerified: boolean;
          passed: boolean;
          coveredCapabilityIds: string[];
        };
        if (!verification || typeof verification.bindingVerified !== 'boolean' ||
            typeof verification.passed !== 'boolean' ||
            !Array.isArray(verification.coveredCapabilityIds) ||
            verification.coveredCapabilityIds.length > MAX_CAPABILITIES ||
            verification.coveredCapabilityIds.some(id => !isSafeIdentity(id)) ||
            new Set(verification.coveredCapabilityIds).size !== verification.coveredCapabilityIds.length) {
          throw new Error('p23-validation-only-verifier-result-invalid');
        }
        const covered = verification.bindingVerified
          ? verification.coveredCapabilityIds
          : [];
        if (covered.some(id => !task.requiredCapabilityIds.includes(id))) {
          throw new Error('p23-validation-only-verifier-capability-mismatch');
        }

        const rawSafety = await runWithServiceDeadline(
          'p23-validation-only-safety-scanner',
          frozen.serviceTimeoutMs,
          input.signal,
          signal => frozen.scan({
            payload: snapshotPlainData(input.payload),
            task: snapshotPlainData(task) as IndependentCandidateTask,
            execution: snapshotPlainData(execution) as CandidateExecutionResult,
            context: snapshotPlainData(context) as CandidateExecutionContext,
            signal,
          }),
        );
        const safety = snapshotPlainData(rawSafety) as { violationCount: number };
        if (!safety || !Number.isSafeInteger(safety.violationCount) ||
            safety.violationCount < 0 || safety.violationCount > 100_000) {
          throw new Error('p23-validation-only-safety-result-invalid');
        }

        reports.push(evaluateSkillLearnBenchTrial({
          taskId: task.taskId,
          taskFamily: row.taskFamily,
          trialId: task.trialId,
          verifierPassed: verification.bindingVerified && verification.passed && safety.violationCount === 0,
          skill: {
            requiredCapabilityIds: [...task.requiredCapabilityIds],
            coveredCapabilityIds: covered,
            executable: true,
            safetyViolationCount: safety.violationCount,
          },
          trajectory: {
            expectedStepIds: [...task.expectedStepIds],
            observedStepIds: [...execution.observedStepIds],
          },
        }));
      }

      return {
        payloadFingerprint: input.payloadFingerprint,
        validationManifestFingerprint: frozen.manifestFingerprint,
        validationPlanFingerprint: planFingerprint,
        environmentFingerprint: frozen.environmentFingerprint,
        reports,
      };
    },
  };
}
