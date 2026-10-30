import type { ActionKind } from '../core/types.ts';
import { sha256Stable } from '../core/StableSerialization.ts';

export interface ProjectPlanStep {
  dependsOn?: string[];
  minAttemptsBeforePromotion?: number;
  requiresExternalResearch?: boolean;
  requiresResearchPromotion?: boolean;
  requiresPriorResearchPromotion?: boolean;
  retryAfterTick?: number;
  lastFailureReason?: string;
  maxAttempts?: number;
  blocked?: boolean;
  failureAttempts?: number;
  id: string;
  action: ActionKind;
  preferredTool?: string;
  toolInput?: Record<string, unknown>;
  purpose: string;
  requiredEvidence01: number;
  expectedProgress01: number;
  completed: boolean;
  attempts: number;
  successes: number;
  /** Number of independently accepted, evidence-qualified attempts; weak attempts do not count. */
  qualifyingAttempts?: number;
  lastAt: number;
}

export type ProjectStepCheckpointStage =
  | 'prepared'
  | 'pending'
  | 'waiting-approval'
  | 'receipt-recorded'
  | 'reconciliation-required';

/**
 * Durable intent for one project-step tool call. This belongs to the project
 * executor snapshot so it is persisted with the step cursor and progress ledger.
 * An unresolved checkpoint is a hard gate: a different request may not replace it.
 */
export interface ProjectStepExecutionCheckpoint {
  version: 1;
  projectId: string;
  stepId: string;
  toolId: string;
  requestFingerprint: string;
  operationKey: string;
  decisionId: string;
  sequence: number;
  stage: ProjectStepCheckpointStage;
  startedAt: number;
  updatedAt: number;
  executionId?: string;
  outcomeClass?: string;
  approvalRequestId?: string;
}

export interface ProjectExecutionState {
  version: 7;
  projectId: string | null;
  steps: ProjectPlanStep[];
  cursor: number;
  cycles: number;
  completedSteps: number;
  validatedSteps: number;
  executionScore01: number;
  skillPromotionCandidate01: number;
  skillPromotions: number;
  lastAt: number;
  toolCalls: number;
  toolSuccesses: number;
  blockedCycles: number;
  reopenedSteps: number;
  lastReopenAt: number;
  lastTool?: string;
  lastToolError?: string;
  planRevision: number;
  startedAt: number;
  completedAt: number;
  lastDecisionAt: number;
  lastTick: number;
  lastOutcomeId?: string;
  lastOutcomeVerified: boolean;
  failedAttempts: number;
  /** Bounded dedupe ledger: one ActionGateway execution can affect project progress at most once. */
  processedOutcomeIds: string[];
  /** Monotonic operation generation; never reset when a resolved checkpoint is cleared. */
  operationSequence: number;
  /** At most one unresolved step operation per active project. */
  activeOperation?: ProjectStepExecutionCheckpoint;
}

const clamp = (n: number) =>
  Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

type OwnRead = { exists: boolean; valid: boolean; value?: unknown };
const ownData = (record: unknown, key: string): OwnRead => {
  if (!record || typeof record !== 'object') return { exists: false, valid: false };
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor) return { exists: false, valid: true };
    if (!Object.hasOwn(descriptor, 'value')) return { exists: true, valid: false };
    return { exists: true, valid: true, value: descriptor.value };
  } catch {
    return { exists: true, valid: false };
  }
};
const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
};
const safeString = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : undefined;
const safeCounter = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
const safeFinite = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
const safeArrayValues = (value: unknown, max: number): unknown[] => {
  if (!Array.isArray(value)) return [];
  const lengthRead = ownData(value, 'length');
  const length = lengthRead.valid && typeof lengthRead.value === 'number'
    ? Math.max(0, Math.min(max, Math.floor(lengthRead.value)))
    : 0;
  const start = Math.max(0, (lengthRead.value as number ?? 0) - max);
  const result: unknown[] = [];
  for (let index = start; index < start + length; index += 1) {
    const item = ownData(value, String(index));
    if (item.valid && item.exists) result.push(item.value);
  }
  return result;
};
const INVALID_JSON = Symbol('invalid-json-value');
const cloneSafeJson = (value: unknown, depth = 0): unknown | typeof INVALID_JSON => {
  if (depth > 6) return INVALID_JSON;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return typeof value === 'string' && value.length > 4096 ? INVALID_JSON : value;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : INVALID_JSON;
  if (Array.isArray(value)) {
    const values = safeArrayValues(value, 128);
    const lengthRead = ownData(value, 'length');
    if (!lengthRead.valid || typeof lengthRead.value !== 'number' || lengthRead.value > 128) return INVALID_JSON;
    const result: unknown[] = [];
    for (const item of values) {
      const cloned = cloneSafeJson(item, depth + 1);
      if (cloned === INVALID_JSON) return INVALID_JSON;
      result.push(cloned);
    }
    return result;
  }
  if (!isPlainRecord(value)) return INVALID_JSON;
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  let keys: string[];
  try { keys = Object.keys(value); } catch { return INVALID_JSON; }
  if (keys.length > 128) return INVALID_JSON;
  for (const key of keys) {
    const field = ownData(value, key);
    if (!field.valid) return INVALID_JSON;
    const cloned = cloneSafeJson(field.value, depth + 1);
    if (cloned === INVALID_JSON) return INVALID_JSON;
    Object.defineProperty(result, key, { value: cloned, enumerable: true, writable: true, configurable: true });
  }
  return result;
};

export const defaultAutonomousProjectExecutor = (): ProjectExecutionState => ({
  version: 7,
  projectId: null,
  steps: [],
  cursor: 0,
  cycles: 0,
  completedSteps: 0,
  validatedSteps: 0,
  executionScore01: 0.15,
  skillPromotionCandidate01: 0,
  skillPromotions: 0,
  lastAt: 0,
  planRevision: 0,
  startedAt: 0,
  completedAt: 0,
  lastDecisionAt: 0,
  lastTick: 0,
  lastOutcomeId: undefined,
  lastOutcomeVerified: false,
  failedAttempts: 0,
  processedOutcomeIds: [],
  operationSequence: 0,
  activeOperation: undefined,
  toolCalls: 0,
  toolSuccesses: 0,
  blockedCycles: 0,
  reopenedSteps: 0,
  lastReopenAt: 0,
});

const makeSteps = (origin: string): ProjectPlanStep[] => {
  const researchSeed = String(process.env.NEURO_PROJECT_RESEARCH_URL ?? '').trim();
  const researchSeed2 = String(process.env.NEURO_PROJECT_RESEARCH_URL_2 ?? '').trim();
  const first: ProjectPlanStep =
    origin === 'identity'
      ? {
          id: 'observe',
          action: 'reflect',
          preferredTool: 'organism.project.evidence',
          purpose: 'уточнить расхождение собственной модели',
          requiredEvidence01: 0.58,
          expectedProgress01: 0.24,
          completed: false,
          attempts: 0,
          successes: 0,
          lastAt: 0,
          minAttemptsBeforePromotion: 1,
        }
      : origin === 'learned'
        ? {
            id: 'observe-social',
            action: 'respond',
            preferredTool: 'organism.project.context',
            purpose: 'получить социальное наблюдение',
            requiredEvidence01: 0.62,
            expectedProgress01: 0.24,
            completed: false,
            attempts: 0,
            successes: 0,
            lastAt: 0,
          }
        : origin === 'unresolved'
          ? {
              id: 'test',
              action: 'verify',
              preferredTool: 'organism.project.evidence',
              purpose: 'проверить гипотезу',
              requiredEvidence01: 0.72,
              expectedProgress01: 0.3,
              completed: false,
              attempts: 0,
              successes: 0,
              lastAt: 0,
              minAttemptsBeforePromotion: 1,
            }
          : {
              id: 'explore',
              action: 'explore',
              preferredTool: researchSeed ? 'organism.project.research' : 'organism.project.context',
              toolInput: researchSeed ? { url: researchSeed } : undefined,
              purpose: researchSeed ? 'извлечь внешнее наблюдение' : 'найти новое наблюдение',
              requiredEvidence01: 0.58,
              expectedProgress01: 0.26,
              completed: false,
              attempts: 0,
              successes: 0,
              lastAt: 0,
              minAttemptsBeforePromotion: 1,
            };

  const steps: ProjectPlanStep[] = [
    first,
    {
      id: 'repeat',
      action: first.action === 'respond' ? 'verify' : 'explore',
      preferredTool: 'organism.project.research',
      toolInput: researchSeed2 ? { url: researchSeed2 } : undefined,
      purpose: 'получить внешнее подтверждение из независимого источника',
      requiresExternalResearch: true,
      requiresResearchPromotion: true,
      requiredEvidence01: 0.78,
      expectedProgress01: 0.64,
      completed: false,
      attempts: 0,
      successes: 0,
      lastAt: 0,
      dependsOn: [first.id],
      minAttemptsBeforePromotion: 2,
    },
    {
      id: 'consolidate',
      action: 'reflect',
      preferredTool: 'organism.project.evidence',
      purpose: 'сопоставить исходы и закрепить навык после проверки источников',
      requiresPriorResearchPromotion: true,
      requiredEvidence01: 0.84,
      expectedProgress01: 0.94,
      completed: false,
      attempts: 0,
      successes: 0,
      lastAt: 0,
      dependsOn: ['repeat'],
      minAttemptsBeforePromotion: 2,
    },
  ];
  for (const step of steps) step.maxAttempts = step.maxAttempts ?? 4;
  return steps;
};

export class AutonomousProjectExecutor {
  private state = defaultAutonomousProjectExecutor();

  restore(raw?: Partial<ProjectExecutionState> | null) {
    const d = defaultAutonomousProjectExecutor();
    if (raw == null) {
      // Do not let a routine "no active project" reset discard an operation that
      // may already have crossed the external side-effect boundary.
      if (this.hasUnresolvedStepOperation()) return;
      this.state = d;
      return;
    }
    if (!isPlainRecord(raw)) {
      if (this.hasUnresolvedStepOperation()) return;
      this.state = d;
      return;
    }
    const read = (key: string) => ownData(raw, key);
    const projectRead = read('projectId');
    const projectId = projectRead.valid
      ? (projectRead.value === null ? null : safeString(projectRead.value, 180) ?? null)
      : null;

    const stepsRead = read('steps');
    const steps: ProjectPlanStep[] = [];
    if (stepsRead.valid && Array.isArray(stepsRead.value)) {
      for (const rawStep of safeArrayValues(stepsRead.value, 6)) {
        if (!isPlainRecord(rawStep)) continue;
        const stepRead = (key: string) => ownData(rawStep, key);
        const id = safeString(stepRead('id').value, 120);
        const action = safeString(stepRead('action').value, 80);
        const purpose = safeString(stepRead('purpose').value, 500);
        const requiredEvidence = stepRead('requiredEvidence01').value;
        const expectedProgress = stepRead('expectedProgress01').value;
        const completed = stepRead('completed').value;
        if (!id || !action || !purpose ||
            typeof requiredEvidence !== 'number' || !Number.isFinite(requiredEvidence) ||
            typeof expectedProgress !== 'number' || !Number.isFinite(expectedProgress) ||
            typeof completed !== 'boolean') continue;
        const attempts = safeCounter(stepRead('attempts').value);
        const successes = Math.min(attempts, safeCounter(stepRead('successes').value));
        const lastAt = safeFinite(stepRead('lastAt').value);
        const step: ProjectPlanStep = {
          id,
          action: action as ActionKind,
          purpose,
          requiredEvidence01: clamp(requiredEvidence),
          expectedProgress01: clamp(expectedProgress),
          completed,
          attempts,
          successes,
          lastAt,
          qualifyingAttempts: Math.min(successes, safeCounter(stepRead('qualifyingAttempts').value)),
          maxAttempts: Math.max(1, Math.min(8, safeCounter(stepRead('maxAttempts').value, 4))),
          blocked: stepRead('blocked').value === true,
          failureAttempts: safeCounter(stepRead('failureAttempts').value),
        };
        const preferredTool = safeString(stepRead('preferredTool').value, 180);
        if (preferredTool) step.preferredTool = preferredTool;
        const minAttempts = stepRead('minAttemptsBeforePromotion').value;
        if (typeof minAttempts === 'number' && Number.isSafeInteger(minAttempts) && minAttempts > 0) step.minAttemptsBeforePromotion = Math.min(8, minAttempts);
        const retryAfterTick = stepRead('retryAfterTick').value;
        if (typeof retryAfterTick === 'number' && Number.isSafeInteger(retryAfterTick) && retryAfterTick >= 0) step.retryAfterTick = retryAfterTick;
        const lastFailureReason = safeString(stepRead('lastFailureReason').value, 180);
        if (lastFailureReason) step.lastFailureReason = lastFailureReason;
        for (const key of ['requiresExternalResearch', 'requiresResearchPromotion', 'requiresPriorResearchPromotion'] as const) {
          const flag = stepRead(key).value;
          if (typeof flag === 'boolean') step[key] = flag;
        }
        const dependsOnRead = stepRead('dependsOn');
        if (dependsOnRead.valid && Array.isArray(dependsOnRead.value)) {
          const dependencies = safeArrayValues(dependsOnRead.value, 6)
            .map((value) => safeString(value, 120))
            .filter((value): value is string => Boolean(value));
          if (dependencies.length) step.dependsOn = [...new Set(dependencies)];
        }
        const toolInputRead = stepRead('toolInput');
        if (toolInputRead.valid && toolInputRead.value !== undefined) {
          const toolInput = cloneSafeJson(toolInputRead.value);
          if (toolInput !== INVALID_JSON && isPlainRecord(toolInput)) step.toolInput = toolInput;
        }
        steps.push(step);
      }
    }

    const processedRead = read('processedOutcomeIds');
    const processedOutcomeIds = processedRead.valid
      ? [...new Set(safeArrayValues(processedRead.value, 2048)
          .map((value) => safeString(value, 180))
          .filter((value): value is string => Boolean(value)))].slice(-512)
      : [];
    const operationRead = read('activeOperation');
    let activeOperation: ProjectStepExecutionCheckpoint | undefined;
    if (operationRead.valid && isPlainRecord(operationRead.value)) {
      const rawOperation = operationRead.value;
      const field = (key: string) => ownData(rawOperation, key);
      const opProjectId = safeString(field('projectId').value, 180);
      const stepId = safeString(field('stepId').value, 120);
      const toolId = safeString(field('toolId').value, 180);
      const requestFingerprint = field('requestFingerprint').value;
      const operationKey = safeString(field('operationKey').value, 160);
      const decisionId = safeString(field('decisionId').value, 180);
      const sequence = field('sequence').value;
      const stage = field('stage').value;
      const startedAt = field('startedAt').value;
      const updatedAt = field('updatedAt').value;
      const validStages = ['prepared', 'pending', 'waiting-approval', 'receipt-recorded', 'reconciliation-required'];
      const identityValid = Boolean(
        opProjectId && stepId && toolId && operationKey && decisionId &&
        typeof requestFingerprint === 'string' && /^[a-f0-9]{64}$/i.test(requestFingerprint) &&
        typeof sequence === 'number' && Number.isSafeInteger(sequence) && sequence >= 1 &&
        typeof stage === 'string' && validStages.includes(stage) &&
        typeof startedAt === 'number' && Number.isFinite(startedAt) && startedAt >= 0 &&
        typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt >= 0 &&
        !/[\u0000-\u001f\u007f]/.test(operationKey)
      );
      if (identityValid) {
        activeOperation = {
          version: 1,
          projectId: opProjectId!,
          stepId: stepId!,
          toolId: toolId!,
          requestFingerprint: (requestFingerprint as string).toLowerCase(),
          operationKey: operationKey!,
          decisionId: decisionId!,
          sequence: sequence as number,
          stage: stage as ProjectStepCheckpointStage,
          startedAt: startedAt as number,
          updatedAt: updatedAt as number,
        };
        for (const [key, limit] of [['executionId', 180], ['outcomeClass', 100], ['approvalRequestId', 180]] as const) {
          const value = safeString(field(key).value, limit);
          if (value) activeOperation[key] = value;
        }
      }
    }

    // If a checkpoint and the plan disagree about project identity, the checkpoint
    // wins: keep the side-effect lock and discard only the incompatible plan cursor.
    let canonicalProjectId = projectId;
    let canonicalSteps = steps;
    if (activeOperation && canonicalProjectId && activeOperation.projectId !== canonicalProjectId &&
        activeOperation.stage !== 'prepared') {
      canonicalProjectId = activeOperation.projectId;
      canonicalSteps = [];
    } else if (activeOperation && !canonicalProjectId) {
      canonicalProjectId = activeOperation.projectId;
    }
    const completedFromSteps = canonicalSteps.filter((step) => step.completed).length;
    const state: ProjectExecutionState = {
      ...d,
      version: 7,
      projectId: canonicalProjectId,
      steps: canonicalSteps,
      cursor: Math.max(0, Math.min(safeCounter(read('cursor').value), canonicalSteps.length)),
      cycles: safeCounter(read('cycles').value),
      completedSteps: completedFromSteps,
      validatedSteps: Math.min(completedFromSteps, safeCounter(read('validatedSteps').value)),
      executionScore01: clamp(typeof read('executionScore01').value === 'number' ? read('executionScore01').value as number : d.executionScore01),
      skillPromotionCandidate01: clamp(typeof read('skillPromotionCandidate01').value === 'number' ? read('skillPromotionCandidate01').value as number : 0),
      skillPromotions: safeCounter(read('skillPromotions').value),
      lastAt: safeFinite(read('lastAt').value),
      toolCalls: safeCounter(read('toolCalls').value),
      toolSuccesses: safeCounter(read('toolSuccesses').value),
      blockedCycles: safeCounter(read('blockedCycles').value),
      reopenedSteps: safeCounter(read('reopenedSteps').value),
      lastReopenAt: safeFinite(read('lastReopenAt').value),
      lastTool: safeString(read('lastTool').value, 96),
      lastToolError: safeString(read('lastToolError').value, 180),
      planRevision: safeCounter(read('planRevision').value),
      startedAt: safeFinite(read('startedAt').value),
      completedAt: safeFinite(read('completedAt').value),
      lastDecisionAt: safeFinite(read('lastDecisionAt').value),
      lastTick: safeCounter(read('lastTick').value),
      lastOutcomeId: safeString(read('lastOutcomeId').value, 160),
      lastOutcomeVerified: read('lastOutcomeVerified').value === true,
      failedAttempts: safeCounter(read('failedAttempts').value),
      processedOutcomeIds,
      operationSequence: Math.max(safeCounter(read('operationSequence').value), activeOperation?.sequence ?? 0),
      activeOperation,
    };
    // Protect an existing in-memory checkpoint from an accessor-backed/invalid
    // attempted replacement. JSON snapshots are plain data, but public callers
    // should not be able to make restore evaluate arbitrary properties.
    const currentOperation = this.state.activeOperation;
    if (currentOperation && currentOperation.stage !== 'prepared') {
      // A stale or malformed snapshot must not erase or downgrade an in-flight side effect.
      if (!activeOperation || activeOperation.operationKey !== currentOperation.operationKey ||
          activeOperation.updatedAt < currentOperation.updatedAt) return;
    }
    if (!operationRead.valid && this.hasUnresolvedStepOperation()) return;
    this.state = state;
  }

  snapshot() {
    return structuredClone(this.state);
  }

  activeStepOperation(): ProjectStepExecutionCheckpoint | null {
    return this.state.activeOperation ? structuredClone(this.state.activeOperation) : null;
  }

  prepareStepOperation(input: {
    projectId: string;
    stepId: string;
    toolId: string;
    requestFingerprint: string;
    idempotencyKey?: string;
    decisionId?: string;
  }): { ok: true; checkpoint: ProjectStepExecutionCheckpoint; reused: boolean } |
     { ok: false; error: 'project-step-reconciliation-required'; checkpoint: ProjectStepExecutionCheckpoint } {
    const projectId = String(input.projectId ?? '').trim().slice(0,180);
    const stepId = String(input.stepId ?? 'unplanned').trim().slice(0,120) || 'unplanned';
    const toolId = String(input.toolId ?? '').trim().slice(0,180);
    const requestFingerprint = String(input.requestFingerprint ?? '').toLowerCase();
    if (!projectId || !toolId || !/^[a-f0-9]{64}$/.test(requestFingerprint)) {
      throw new Error('project-step-checkpoint-invalid-identity');
    }
    const active = this.state.activeOperation;
    if (active) {
      const sameRequest = active.projectId === projectId && active.stepId === stepId &&
        active.toolId === toolId && active.requestFingerprint === requestFingerprint;
      if (sameRequest) return { ok: true, checkpoint: structuredClone(active), reused: true };
      // A prepared intent is persisted before executor entry; therefore it is safe
      // to supersede after a restart. Once marked pending, only reconciliation may
      // release it, even when a caller presents a different payload.
      if (active.stage !== 'prepared') {
        return { ok: false, error: 'project-step-reconciliation-required', checkpoint: structuredClone(active) };
      }
      this.state.activeOperation = undefined;
    }

    const sequence = Math.max(0, Math.floor(this.state.operationSequence)) + 1;
    this.state.operationSequence = sequence;
    const operationKey = input.idempotencyKey
      ? String(input.idempotencyKey).trim()
      : `project-step:${sha256Stable({ projectId, stepId, toolId, requestFingerprint, sequence }).slice(0,56)}`;
    const decisionId = input.decisionId
      ? String(input.decisionId).trim()
      : `decision:project-step:${sha256Stable({ projectId, stepId, toolId, requestFingerprint, sequence, operationKey }).slice(0,48)}`;
    const now = Date.now();
    const checkpoint: ProjectStepExecutionCheckpoint = {
      version: 1, projectId, stepId, toolId, requestFingerprint,
      operationKey, decisionId, sequence, stage: 'prepared', startedAt: now, updatedAt: now,
    };
    this.state.activeOperation = checkpoint;
    this.state.lastAt = now;
    return { ok: true, checkpoint: structuredClone(checkpoint), reused: false };
  }

  updateStepOperation(input: {
    operationKey: string;
    stage: ProjectStepCheckpointStage;
    executionId?: string;
    outcomeClass?: string;
    approvalRequestId?: string;
  }): ProjectStepExecutionCheckpoint | null {
    const active = this.state.activeOperation;
    if (!active || active.operationKey !== input.operationKey) return null;
    const allowed: Record<ProjectStepCheckpointStage, readonly ProjectStepCheckpointStage[]> = {
      prepared: ['prepared','pending','waiting-approval','receipt-recorded','reconciliation-required'],
      pending: ['pending','waiting-approval','receipt-recorded','reconciliation-required'],
      'waiting-approval': ['waiting-approval','pending','reconciliation-required'],
      'receipt-recorded': ['receipt-recorded','reconciliation-required'],
      'reconciliation-required': ['reconciliation-required','receipt-recorded','waiting-approval'],
    };
    if (!allowed[active.stage].includes(input.stage)) return structuredClone(active);
    active.stage = input.stage;
    active.updatedAt = Date.now();
    if (typeof input.executionId === 'string' && input.executionId.trim()) active.executionId = input.executionId.trim().slice(0,180);
    if (typeof input.outcomeClass === 'string' && input.outcomeClass.trim()) active.outcomeClass = input.outcomeClass.trim().slice(0,100);
    if (typeof input.approvalRequestId === 'string' && input.approvalRequestId.trim()) active.approvalRequestId = input.approvalRequestId.trim().slice(0,180);
    this.state.lastAt = active.updatedAt;
    return structuredClone(active);
  }

  /**
   * A pending operation may already have crossed the ActionGateway side-effect
   * boundary. Only a never-submitted prepared intent or a receipt whose projection
   * has been durably applied may be cleared by the caller.
   */
  clearStepOperation(operationKey: string): boolean {
    const active = this.state.activeOperation;
    if (!active || active.operationKey !== operationKey) return false;
    if (active.stage !== 'prepared' && active.stage !== 'receipt-recorded') return false;
    this.state.activeOperation = undefined;
    this.state.lastAt = Date.now();
    return true;
  }

  hasUnresolvedStepOperation(): boolean {
    const stage = this.state.activeOperation?.stage;
    return Boolean(stage && stage !== 'prepared');
  }

  ensure(project: { id: string; origin: string }) {
    const active = this.state.activeOperation;
    if (active && active.stage !== 'prepared') {
      // Never reset the executor while a side effect or its result projection
      // still needs reconciliation, even if the current project has changed.
      if (this.state.projectId !== project.id) return this.snapshot();
      if (this.state.steps.length) return this.snapshot();
      this.state.steps = makeSteps(project.origin);
      this.state.planRevision = Math.max(1, this.state.planRevision);
      this.state.startedAt = this.state.startedAt || Date.now();
      this.state.lastAt = Date.now();
      return this.snapshot();
    }
    if (this.state.projectId === project.id && this.state.steps.length) {
      return this.snapshot();
    }
    this.state = defaultAutonomousProjectExecutor();
    this.state.projectId = project.id;
    this.state.steps = makeSteps(project.origin);
    for (const step of this.state.steps) step.qualifyingAttempts = 0;
    this.state.planRevision=1;
    this.state.startedAt=Date.now();
    this.state.lastAt = this.state.startedAt;
    return this.snapshot();
  }

  currentStep() {
    return this.state.steps.find((s, i) => i === this.state.cursor && !s.completed) ?? null;
  }

  private selectReadyStep(tick:number): ProjectPlanStep | null {
    if(!this.state.steps.length) return null;
    const total=this.state.steps.length;
    const start=Math.max(0, Math.min(this.state.cursor, total-1));
    const order=[...Array(total-start).keys()].map(i=>start+i).concat([...Array(start).keys()]);
    for(const index of order){
      const step=this.state.steps[index];
      if(step.completed || step.blocked) continue;
      if(step.retryAfterTick != null && tick < step.retryAfterTick) continue;
      const deps=step.dependsOn ?? [];
      if(deps.some(id => !this.state.steps.find(s => s.id === id)?.completed)) continue;
      this.state.cursor=index;
      return step;
    }
    return null;
  }

  readyStep(tick:number): ProjectPlanStep | null { this.state.lastTick=Math.max(this.state.lastTick,Math.floor(Number(tick)||0)); return this.selectReadyStep(tick); }

  canAttempt(tick:number): boolean {
    this.state.lastTick=Math.max(this.state.lastTick,Math.floor(Number(tick)||0));
    const step=this.selectReadyStep(tick);
    if(step) return true;
    this.state.blockedCycles++;
    return false;
  }

  reopenBlockedStep(input:{tick:number;reason:string}): boolean {
    const step=this.currentStep();
    if(!step || !step.blocked) return false;
    step.blocked=false;
    step.failureAttempts=0;
    step.retryAfterTick=undefined;
    step.lastFailureReason=`reopened:${String(input.reason||'new-evidence').slice(0,140)}`;
    this.state.reopenedSteps++;
    this.state.lastReopenAt=Date.now();
    this.state.lastAt=this.state.lastReopenAt;
    return true;
  }

  completeToolStep(input:{tick:number;tool:string;verified:boolean;evidence01:number;externalResearchVerified?:boolean;researchPromoted?:boolean;executionId?:string;stepId?:string}): ProjectPlanStep|null {
    this.state.lastTick=Math.max(this.state.lastTick,Math.floor(Number(input.tick)||0));
    // Correlate the outcome with the step that initiated it. Without this binding, a
    // delayed/replayed result for a completed step could advance the next step when it
    // happens to use the same tool. Legacy callers fall back to a conservative tick key.
    const outcomeId=String(input.executionId??'').trim().slice(0,160) || `legacy:${this.state.projectId??'none'}:${Math.floor(Number(input.tick)||0)}:${String(input.tool).slice(0,96)}:${String(input.stepId??'').slice(0,80)}`;
    if(this.state.processedOutcomeIds.includes(outcomeId)) return null;
    const step=this.selectReadyStep(input.tick);
    // Validate the whole binding before consuming the receipt ID. A result that
    // belongs to another step, lacks verification, or has not passed its research
    // gates must not poison the idempotency ledger for a later valid reconciliation.
    if(!step || step.preferredTool!==input.tool || !input.verified)return null;
    if(input.stepId && step.id!==input.stepId)return null;
    if(step.requiresExternalResearch && input.externalResearchVerified!==true)return null;
    if((step.requiresResearchPromotion || step.requiresPriorResearchPromotion) && input.researchPromoted!==true)return null;
    this.state.processedOutcomeIds=[...this.state.processedOutcomeIds,outcomeId].slice(-512);

    const evidence01=clamp(input.evidence01);
    const requiredEvidence01=clamp(step.requiredEvidence01);
    const hasRequiredEvidence=evidence01>=requiredEvidence01;
    this.state.cycles++;
    step.attempts++;
    step.lastAt=Date.now();
    this.state.lastOutcomeVerified=true;
    this.state.lastOutcomeId=outcomeId;

    if(hasRequiredEvidence) {
      step.successes++;
      step.qualifyingAttempts=Math.max(0,Math.floor(Number(step.qualifyingAttempts??0)))+1;
      step.failureAttempts=0;
      const minimumAttempts=Math.max(1,Math.floor(Number(step.minAttemptsBeforePromotion??1)));
      if(step.qualifyingAttempts>=minimumAttempts) {
        step.completed=true;
        step.blocked=false;
        step.retryAfterTick=undefined;
        step.lastFailureReason=undefined;
        this.state.completedSteps++;
        if(evidence01>=.78)this.state.validatedSteps++;
        if(this.state.completedSteps>=this.state.steps.length)this.state.completedAt=Date.now();
        const next=this.state.steps.findIndex(candidate=>!candidate.completed&&!candidate.blocked);
        if(next>=0)this.state.cursor=next;
        this.state.executionScore01=clamp(this.state.executionScore01*.92+.08*evidence01);
        this.state.skillPromotionCandidate01=clamp(this.state.skillPromotionCandidate01*.86+.14*(evidence01>=.78?1:.55));
      } else {
        // The evidence is adequate but the plan explicitly requires more than one
        // execution before promotion. Keep the step active and yield one tick rather
        // than falsely declaring completion or spinning in the same cycle.
        step.retryAfterTick=Math.max(0,Math.floor(Number(input.tick)||0))+1;
        step.lastFailureReason=`awaiting-minimum-qualifying-attempts:${step.qualifyingAttempts}/${minimumAttempts}`;
        this.state.executionScore01=clamp(this.state.executionScore01*.995);
      }
    } else {
      // Tool-level verification is not the same thing as satisfying this project's
      // evidence threshold. Do not award step success or skill progress on weak evidence.
      step.failureAttempts=Math.max(0,Math.floor(step.failureAttempts??0))+1;
      step.lastFailureReason=`insufficient-evidence:${evidence01.toFixed(3)}<${requiredEvidence01.toFixed(3)}`;
      step.retryAfterTick=Math.max(0,Math.floor(Number(input.tick)||0))+Math.min(16,1<<Math.min(4,Math.max(0,step.failureAttempts-1)));
      if(step.failureAttempts>=Math.max(1,step.maxAttempts??4)) {
        step.blocked=true;
        step.lastFailureReason=`max-attempts-exceeded:insufficient-evidence:${step.attempts}`;
      }
      this.state.executionScore01=clamp(this.state.executionScore01*.98);
      this.state.skillPromotionCandidate01=clamp(this.state.skillPromotionCandidate01*.97);
    }
    this.state.planRevision++;
    this.state.lastAt=Date.now();
    // Callers use a non-null return as permission to advance project progress and
    // promote learned skills. Return only on actual step completion, never merely
    // because an action produced a verified but insufficient/early result.
    return step.completed ? structuredClone(step) : null;
  }

  observeToolResult(input:{tick:number;tool:string;ok:boolean;error?:string}):void {
    this.state.lastTick=Math.max(this.state.lastTick,Math.floor(Number(input.tick)||0));
    this.state.toolCalls++;
    this.state.lastTool=input.tool.slice(0,96);
    if(input.ok){ this.state.toolSuccesses++; this.state.lastToolError=undefined; }
    else {
      this.state.failedAttempts++;
      this.state.lastToolError=String(input.error ?? 'tool-failed').slice(0,180);
      const step=this.selectReadyStep(input.tick);
      if(step && step.preferredTool===input.tool){
        step.lastFailureReason=this.state.lastToolError;
        step.failureAttempts = Math.max(0, Math.floor(step.failureAttempts ?? 0)) + 1;
        step.retryAfterTick=input.tick + Math.min(16, 1 << Math.min(4, Math.max(0, step.failureAttempts - 1)));
        if (step.failureAttempts >= Math.max(1, step.maxAttempts ?? 4)) {
              step.blocked = true;
          this.state.planRevision++;
          step.lastFailureReason = `max-attempts-exceeded:${step.attempts}`;
        }
      }
    }
    this.state.lastAt=Date.now();
  }

  bias(action: ActionKind, projectScore01: number) {
    const step = this.currentStep();
    if (!step) return 0;
    const match = step.action === action ? 1 : 0;
    return clamp(match * (0.035 + 0.055 * projectScore01));
  }

  observe(input: {
    action: ActionKind;
    success01: number;
    evidence01: number;
    relevant: boolean;
    tick: number;
    skillPromoted?: boolean;
  }) {
    this.state.lastTick=Math.max(this.state.lastTick,Math.floor(Number(input.tick)||0));
    const step = this.selectReadyStep(input.tick);
    if (!step) return null;

    this.state.cycles++;
    step.attempts++;
    const qualified = Boolean(input.relevant && input.success01 >= 0.62 && input.evidence01 >= step.requiredEvidence01);
    if (qualified) {
      step.successes++;
      step.qualifyingAttempts = Math.max(0, Math.floor(Number(step.qualifyingAttempts ?? 0))) + 1;
    }
    step.lastAt = Date.now();

    if (
      qualified &&
      (step.qualifyingAttempts ?? 0) >= Math.max(1, step.minAttemptsBeforePromotion ?? 1)
    ) {
      step.completed = true;
      step.blocked = false;
      step.failureAttempts = 0;
      step.retryAfterTick = undefined;
      step.lastFailureReason = undefined;
      this.state.completedSteps++;
      if (input.evidence01 >= 0.78) this.state.validatedSteps++;
      const next=this.state.steps.findIndex((candidate)=>!candidate.completed && !candidate.blocked);
      if(next>=0) this.state.cursor=next;
    }

    const expected = step.expectedProgress01;
    // Unqualified internal outcomes can inform ordinary cognition, but they must not
    // inflate project-execution fitness or skill-promotion readiness.
    const successSignal = qualified
      ? clamp(input.success01 / Math.max(0.1, expected))
      : 0;
    const evidenceSignal = qualified ? 1 : 0;
    const delta = qualified ? 0.62 * successSignal + 0.38 * evidenceSignal : 0;
    this.state.executionScore01 = clamp(
      this.state.executionScore01 * (qualified ? 0.92 : 0.985) + delta * (qualified ? 0.08 : 0),
    );

    const stability = clamp(
      (step.qualifyingAttempts ?? 0) / Math.max(1, Math.min(step.attempts, 3)),
    );
    const validated = qualified && input.evidence01 >= step.requiredEvidence01 ? 1 : 0;
    this.state.skillPromotionCandidate01 = clamp(
      0.88 * this.state.skillPromotionCandidate01 +
        0.12 * (qualified ? (0.65 * stability + 0.35 * validated) : 0),
    );
    if (input.skillPromoted && qualified) this.state.skillPromotions++;

    this.state.lastAt = Date.now();
    return structuredClone(step);
  }

  planHealth(tick=this.state.lastTick) {
    // This is a query/read model: inspecting health must never advance the durable
    // executor clock or affect a later retry/backoff decision.
    const atTick=Math.max(0,Math.floor(Number(tick)||0));
    const total=this.state.steps.length;
    const blocked=this.state.steps.filter(s=>s.blocked).length;
    const ready=this.state.steps.filter(s=>{
      if(s.completed||s.blocked)return false;
      if(s.retryAfterTick!=null && s.retryAfterTick>atTick)return false;
      const deps=s.dependsOn??[];
      return deps.every(id=>this.state.steps.find(candidate=>candidate.id===id)?.completed);
    }).length;
    return {projectId:this.state.projectId,total,completed:this.state.completedSteps,validated:this.state.validatedSteps,blocked,ready,progress01:this.progress01(),executionScore01:this.state.executionScore01,skillPromotionCandidate01:this.state.skillPromotionCandidate01,planRevision:this.state.planRevision,failedAttempts:this.state.failedAttempts};
  }

  progress01() {
    return this.state.steps.length
      ? clamp(this.state.completedSteps / this.state.steps.length)
      : 0;
  }
}
