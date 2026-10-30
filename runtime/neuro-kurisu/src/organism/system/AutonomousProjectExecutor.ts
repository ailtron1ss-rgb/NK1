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
    this.state = {
      ...d,
      ...(raw ?? {}),
      version: 7,
      processedOutcomeIds: Array.isArray((raw as any)?.processedOutcomeIds) ? Array.from(new Set<string>((raw as any).processedOutcomeIds.map((id:any):string=>String(id??'').slice(0,180)).filter((id:string)=>Boolean(id)))).slice(-512) : [],
      toolCalls: Math.max(0, Math.floor(Number((raw as any)?.toolCalls ?? 0))),
      toolSuccesses: Math.max(0, Math.floor(Number((raw as any)?.toolSuccesses ?? 0))),
      blockedCycles: Math.max(0, Math.floor(Number((raw as any)?.blockedCycles ?? 0))),
      reopenedSteps: Math.max(0, Math.floor(Number((raw as any)?.reopenedSteps ?? 0))),
      lastReopenAt: Math.max(0, Number((raw as any)?.lastReopenAt ?? 0)),
      planRevision: Math.max(0, Math.floor(Number((raw as any)?.planRevision ?? 0))),
      startedAt: Math.max(0, Number((raw as any)?.startedAt ?? 0)),
      completedAt: Math.max(0, Number((raw as any)?.completedAt ?? 0)),
      lastDecisionAt: Math.max(0, Number((raw as any)?.lastDecisionAt ?? 0)),
      lastTick: Math.max(0, Math.floor(Number((raw as any)?.lastTick ?? 0))),
      lastOutcomeId: typeof (raw as any)?.lastOutcomeId === 'string' ? String((raw as any).lastOutcomeId).slice(0,160) : undefined,
      lastOutcomeVerified: Boolean((raw as any)?.lastOutcomeVerified),
      failedAttempts: Math.max(0, Math.floor(Number((raw as any)?.failedAttempts ?? 0))),
      steps: Array.isArray(raw?.steps) ? raw!.steps.slice(0, 6).map(step => ({ ...step, qualifyingAttempts: Math.max(0, Math.floor(Number(step.qualifyingAttempts ?? 0))), maxAttempts: Math.max(1, Math.min(8, Math.floor(Number(step.maxAttempts ?? 4)))), blocked: Boolean(step.blocked), failureAttempts: Math.max(0, Math.floor(Number(step.failureAttempts ?? 0))) })) : [],
      operationSequence: Math.max(0, Math.floor(Number((raw as any)?.operationSequence ?? 0))),
      activeOperation: undefined,
    };
    const op = (raw as any)?.activeOperation;
    const validStages = new Set<ProjectStepCheckpointStage>(['prepared','pending','waiting-approval','receipt-recorded','reconciliation-required']);
    if (op && typeof op === 'object' &&
      typeof op.projectId === 'string' && op.projectId.length > 0 && op.projectId.length <= 180 &&
      typeof op.stepId === 'string' && op.stepId.length > 0 && op.stepId.length <= 120 &&
      typeof op.toolId === 'string' && op.toolId.length > 0 && op.toolId.length <= 180 &&
      /^[a-f0-9]{64}$/i.test(String(op.requestFingerprint ?? '')) &&
      typeof op.operationKey === 'string' && op.operationKey.length > 0 && op.operationKey.length <= 160 && !/[\u0000-\u001f\u007f]/.test(op.operationKey) &&
      typeof op.decisionId === 'string' && op.decisionId.length > 0 && op.decisionId.length <= 180 &&
      Number.isFinite(Number(op.sequence)) && Number(op.sequence) >= 1 &&
      validStages.has(op.stage) && Number.isFinite(Number(op.startedAt)) && Number.isFinite(Number(op.updatedAt)) &&
      (!this.state.projectId || op.projectId === this.state.projectId)) {
      this.state.activeOperation = {
        version: 1, projectId: op.projectId, stepId: op.stepId, toolId: op.toolId,
        requestFingerprint: String(op.requestFingerprint).toLowerCase(),
        operationKey: op.operationKey, decisionId: op.decisionId,
        sequence: Math.max(1, Math.floor(Number(op.sequence))), stage: op.stage,
        startedAt: Math.max(0, Number(op.startedAt)), updatedAt: Math.max(0, Number(op.updatedAt)),
        ...(typeof op.executionId === 'string' && op.executionId.length <= 180 ? { executionId: op.executionId } : {}),
        ...(typeof op.outcomeClass === 'string' && op.outcomeClass.length <= 100 ? { outcomeClass: op.outcomeClass } : {}),
        ...(typeof op.approvalRequestId === 'string' && op.approvalRequestId.length <= 180 ? { approvalRequestId: op.approvalRequestId } : {}),
      };
      this.state.operationSequence = Math.max(this.state.operationSequence, this.state.activeOperation.sequence);
    }
    this.state.cursor = Math.max(0, Math.min(this.state.cursor, this.state.steps.length));
    for (const step of this.state.steps) { step.qualifyingAttempts = Math.max(0, Math.floor(Number(step.qualifyingAttempts ?? 0))); step.maxAttempts = Math.max(1, Math.min(8, Math.floor(Number(step.maxAttempts ?? 4)))); step.blocked = Boolean(step.blocked); step.failureAttempts = Math.max(0, Math.floor(Number(step.failureAttempts ?? 0))); }
    this.state.skillPromotionCandidate01 = clamp(this.state.skillPromotionCandidate01);
    this.state.skillPromotions = Math.max(0, Math.floor(this.state.skillPromotions));
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
