import type { ActionKind } from '../core/types.ts';

export interface ProjectPlanStep {
  dependsOn?: string[];
  minAttemptsBeforePromotion?: number;
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
  lastAt: number;
}

export interface ProjectExecutionState {
  version: 4;
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
}

const clamp = (n: number) =>
  Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export const defaultAutonomousProjectExecutor = (): ProjectExecutionState => ({
  version: 4,
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
  lastOutcomeVerified: false,
  failedAttempts: 0,
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
      preferredTool: researchSeed2 ? 'organism.project.research' : (first.action === 'respond' ? 'organism.project.evidence' : 'organism.project.context'),
      toolInput: researchSeed2 ? { url: researchSeed2 } : undefined,
      purpose: researchSeed2 ? 'повторить наблюдение независимым внешним источником' : 'повторить наблюдение независимым способом',
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
      purpose: 'сопоставить исходы и закрепить навык',
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
      version: 4,
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
      steps: Array.isArray(raw?.steps) ? raw!.steps.slice(0, 6).map(step => ({ ...step, maxAttempts: Math.max(1, Math.min(8, Math.floor(Number(step.maxAttempts ?? 4)))), blocked: Boolean(step.blocked), failureAttempts: Math.max(0, Math.floor(Number(step.failureAttempts ?? 0))) })) : [],
    };
    this.state.cursor = Math.max(0, Math.min(this.state.cursor, this.state.steps.length));
    for (const step of this.state.steps) { step.maxAttempts = Math.max(1, Math.min(8, Math.floor(Number(step.maxAttempts ?? 4)))); step.blocked = Boolean(step.blocked); step.failureAttempts = Math.max(0, Math.floor(Number(step.failureAttempts ?? 0))); }
    this.state.skillPromotionCandidate01 = clamp(this.state.skillPromotionCandidate01);
    this.state.skillPromotions = Math.max(0, Math.floor(this.state.skillPromotions));
  }

  snapshot() {
    return structuredClone(this.state);
  }

  ensure(project: { id: string; origin: string }) {
    if (this.state.projectId === project.id && this.state.steps.length) {
      return this.snapshot();
    }
    this.state = defaultAutonomousProjectExecutor();
    this.state.projectId = project.id;
    this.state.steps = makeSteps(project.origin);
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

  completeToolStep(input:{tick:number;tool:string;verified:boolean;evidence01:number}): ProjectPlanStep|null {
    this.state.lastTick=Math.max(this.state.lastTick,Math.floor(Number(input.tick)||0));
    const step=this.selectReadyStep(input.tick);
    if(!step || step.preferredTool!==input.tool || !input.verified)return null;
    this.state.cycles++; step.attempts++; step.successes++; step.lastAt=Date.now();
    this.state.lastOutcomeVerified=Boolean(input.verified);
    this.state.lastOutcomeId=`tool-outcome:${this.state.projectId??'none'}:${input.tick}:${input.tool}`;
    if(input.evidence01>=step.requiredEvidence01){
      step.completed=true; step.blocked=false; step.failureAttempts=0; step.retryAfterTick=undefined; step.lastFailureReason=undefined; this.state.completedSteps++;
      if(input.evidence01>=.78)this.state.validatedSteps++;
      if(this.state.completedSteps>=this.state.steps.length) this.state.completedAt=Date.now();
      const next=this.state.steps.findIndex(candidate=>!candidate.completed&&!candidate.blocked); if(next>=0)this.state.cursor=next;
    }
    this.state.executionScore01=clamp(this.state.executionScore01*.92+.08*(.68*clamp(input.evidence01)+.32));
    this.state.skillPromotionCandidate01=clamp(this.state.skillPromotionCandidate01*.86+.14*(input.evidence01>=.78?1:.55));
    this.state.planRevision++;
    this.state.lastAt=Date.now();
    return structuredClone(step);
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
      if(step){
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
    if (input.success01 >= 0.62) step.successes++;
    step.lastAt = Date.now();

    if (
      input.relevant &&
      input.success01 >= 0.62 &&
      input.evidence01 >= step.requiredEvidence01 &&
      step.attempts >= Math.max(1, step.minAttemptsBeforePromotion ?? 1)
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
    const successSignal = input.relevant
      ? clamp(input.success01 / Math.max(0.1, expected))
      : 0;
    const evidenceSignal = input.evidence01 >= step.requiredEvidence01 ? 1 : 0;
    const delta = input.relevant
      ? 0.62 * successSignal + 0.38 * evidenceSignal
      : 0;
    this.state.executionScore01 = clamp(
      this.state.executionScore01 * 0.92 + delta * 0.08,
    );

    const stability = clamp(
      step.successes / Math.max(1, Math.min(step.attempts, 3)),
    );
    const validated = input.evidence01 >= step.requiredEvidence01 ? 1 : 0;
    this.state.skillPromotionCandidate01 = clamp(
      0.88 * this.state.skillPromotionCandidate01 +
        0.12 * (0.65 * stability + 0.35 * validated),
    );
    if (input.skillPromoted) this.state.skillPromotions++;

    this.state.lastAt = Date.now();
    return structuredClone(step);
  }

  planHealth(tick=this.state.lastTick) {
    this.state.lastTick=Math.max(this.state.lastTick,Math.floor(Number(tick)||0));
    const total=this.state.steps.length;
    const blocked=this.state.steps.filter(s=>s.blocked).length;
    const ready=this.state.steps.filter(s=>{
      if(s.completed||s.blocked)return false;
      if(s.retryAfterTick!=null && s.retryAfterTick>tick)return false;
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
