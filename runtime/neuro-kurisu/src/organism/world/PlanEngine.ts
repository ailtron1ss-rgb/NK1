import type { ActionKind, OrganismGoal } from '../core/types.ts';
import { sha256Stable } from '../core/StableSerialization.ts';
import { WorldEnvironment, type EnvironmentAction, type EnvironmentSnapshot } from './WorldEnvironment.ts';
export interface PlanStepPreconditions { worldTick: number; location: string; worldFingerprint: string; }
export interface PlanStepExpectedOutcome {
  valid: boolean; nextWorldTick: number; nextLocation: string;
  energy01: number; attention01: number; uncertainty01: number;
  reward: number; confidence: number; worldFingerprint: string;
  factsAdded: string[]; eventsAdded: string[];
}
export interface PlanStep {
  step: number; internalAction: ActionKind; environmentAction: EnvironmentAction;
  predictedReward: number; confidence: number; rationale: string;
  preconditions: PlanStepPreconditions; expectedOutcome: PlanStepExpectedOutcome;
}
export interface PlanGoalLineage { id: string | null; status: string | null; updatedAt: number | null; fingerprint: string | null; }
export interface PlanRevisionHint {
  source: 'verified-observed';
  previousPlanId: string;
  previousDecisionId: string;
  previousTick: number;
  goalId: string;
  previousAction: ActionKind;
  avoidFirstAction: EnvironmentAction;
  predictedReward01: number;
  actualReward01: number;
  predictionError01: number;
  revisionReadiness01: number;
}
export interface PlanLineage {
  version: 1; decisionId: string | null; decisionTick: number;
  goal: PlanGoalLineage; world: { tick: number; fingerprint: string };
  revision: PlanRevisionHint | null;
}
export interface PlanBuildContext {
  decisionId?: string;
  tick?: number;
  /** One-cycle, independently verified feedback that may alter the next plan search only. */
  revisionHint?: PlanRevisionHint;
}
export interface PlanRevisionEvent {
  id: string;
  tick: number;
  stage: string;
  external?: boolean;
  payload?: Record<string, unknown>;
}
export type PlanValidationReason =
  | 'ok' | 'missing-lineage' | 'invalid-context' | 'decision-mismatch'
  | 'decision-tick-mismatch' | 'goal-version-mismatch' | 'world-version-mismatch'
  | 'invalid-step-index' | 'step-precondition-mismatch' | 'step-outcome-invalid'
  | 'plan-integrity-mismatch' | 'revision-context-mismatch';
export interface PlanValidation { valid: boolean; reason: PlanValidationReason; }
export interface Plan {
  id: string; goalId?: string; title: string; steps: PlanStep[]; expectedValue: number;
  createdAt: number; searchDepth: number; beamWidth: number; lineage: PlanLineage;
  integrityFingerprint: string;
}
const actionMap: Record<ActionKind, EnvironmentAction> = {
  respond: 'communicate', explore: 'move', verify: 'inspect', rest: 'rest', reflect: 'observe', wait: 'observe', defer: 'rest',
};
const reverseMap: Partial<Record<EnvironmentAction, ActionKind>> = {
  communicate: 'respond', move: 'explore', inspect: 'verify', rest: 'rest', observe: 'reflect', collect: 'explore',
};
const envActions: EnvironmentAction[] = ['observe', 'inspect', 'move', 'collect', 'rest', 'communicate'];
interface Node { state: EnvironmentSnapshot; actions: EnvironmentAction[]; rewards: number[]; score: number; confidence: number; }
export interface ResidualRewardProvider {
  predict(action: EnvironmentAction | string, baseReward: number, context?: EnvironmentSnapshot):
    { predicted: number; confidence: number; samples?: number; uncertainty?: number; modelReady?: boolean };
}
const clampReward = (v: number) => Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));
const clampConfidence = (v: number, fallback = 0.4) => Math.max(0.05, Math.min(0.99, Number.isFinite(v) ? v : fallback));
const safeDecisionId = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const id = v.trim();
  return id.length > 0 && id.length <= 256 && !/[\u0000-\u001f\u007f-\u009f]/u.test(id) ? id : null;
};
const MIN_REVISION_READINESS01 = 0.35;
const MIN_REVISION_ERROR01 = 0.25;
const MIN_VERIFIED_OUTCOME_QUALITY01 = 0.7;
const safePlanId = (value: unknown): string | null =>
  typeof value === 'string' && /^plan-[a-f0-9]{24}$/u.test(value) ? value : null;
const safeActionKind = (value: unknown): ActionKind | null =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(actionMap, value)
    ? value as ActionKind
    : null;
const finite01 = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

function normalizePlanRevisionHint(
  value: unknown,
  currentGoalId: string | null,
  currentTick?: number,
): PlanRevisionHint | null {
  if (!value || typeof value !== 'object' || !currentGoalId
    || typeof currentTick !== 'number' || !Number.isSafeInteger(currentTick) || currentTick < 1) return null;
  const hint = value as Partial<PlanRevisionHint>;
  const previousPlanId = safePlanId(hint.previousPlanId);
  const previousDecisionId = safeDecisionId(hint.previousDecisionId);
  const previousTick = hint.previousTick;
  const goalId = safeDecisionId(hint.goalId);
  const previousAction = safeActionKind(hint.previousAction);
  const action = hint.avoidFirstAction;
  const predicted = hint.predictedReward01;
  const actual = hint.actualReward01;
  const error = hint.predictionError01;
  const readiness = hint.revisionReadiness01;
  if (hint.source !== 'verified-observed' || !previousPlanId || !previousDecisionId
    || typeof previousTick !== 'number' || !Number.isSafeInteger(previousTick)
    || previousTick !== currentTick - 1 || goalId !== currentGoalId
    || !previousAction || actionMap[previousAction] !== action
    || !envActions.includes(action as EnvironmentAction)
    || !finite01(predicted) || !finite01(actual) || !finite01(error) || !finite01(readiness)
    || readiness < MIN_REVISION_READINESS01
    || Math.abs(predicted - actual) < MIN_REVISION_ERROR01
    || Math.abs(Math.abs(predicted - actual) - error) > 1e-9) return null;
  return {
    source: 'verified-observed',
    previousPlanId,
    previousDecisionId,
    previousTick,
    goalId,
    previousAction,
    avoidFirstAction: action as EnvironmentAction,
    predictedReward01: predicted,
    actualReward01: actual,
    predictionError01: error,
    revisionReadiness01: readiness,
  };
}

/**
 * Derive a one-cycle plan revision hint from the canonical causal-event journal.
 * Both the completed outcome and its accepted plan must match the immediately
 * preceding tick, active goal, decision and plan. No simulated or weakly grounded
 * outcome can steer the next plan search.
 */
export function derivePlanRevisionHint(
  events: readonly PlanRevisionEvent[],
  currentTick: number,
  currentGoalId: string | null,
  revisionReadiness01: number,
): PlanRevisionHint | null {
  if (!Number.isSafeInteger(currentTick) || currentTick < 1 || !currentGoalId
    || !finite01(revisionReadiness01) || revisionReadiness01 < MIN_REVISION_READINESS01) return null;
  const outcome = events.find(event => event.stage === 'outcome' && event.tick === currentTick - 1);
  if (!outcome || outcome.external !== true || !outcome.payload) return null;
  const payload = outcome.payload;
  const planId = safePlanId(payload.planId);
  const decisionId = safeDecisionId(payload.decisionId);
  const goalId = safeDecisionId(payload.goalId);
  const previousAction = safeActionKind(payload.decisionAction);
  const avoidFirstAction = previousAction ? actionMap[previousAction] : null;
  const predictedReward01 = payload.decisionPredicted01;
  const actualReward01 = payload.actualReward01;
  const verified01 = payload.verified01;
  const independent01 = payload.independent01;
  const evidence01 = payload.evidence01;
  if (payload.planAccepted !== true || payload.realitySource !== 'external'
    || !planId || !decisionId || goalId !== currentGoalId
    || !previousAction || !avoidFirstAction
    || !finite01(predictedReward01) || !finite01(actualReward01)
    || !finite01(verified01) || !finite01(independent01) || !finite01(evidence01)
    || verified01 < MIN_VERIFIED_OUTCOME_QUALITY01
    || independent01 < MIN_VERIFIED_OUTCOME_QUALITY01
    || evidence01 < MIN_VERIFIED_OUTCOME_QUALITY01) return null;

  const planEvent = events.find(event => {
    if (event.stage !== 'plan' || event.tick !== outcome.tick || !event.payload) return false;
    return event.payload.planId === planId
      && event.payload.decisionId === decisionId
      && event.payload.goalId === currentGoalId
      && event.payload.planAccepted === true;
  });
  if (!planEvent) return null;
  const predictionError01 = Math.abs(predictedReward01 - actualReward01);
  if (predictionError01 < MIN_REVISION_ERROR01) return null;
  return normalizePlanRevisionHint({
    source: 'verified-observed',
    previousPlanId: planId,
    previousDecisionId: decisionId,
    previousTick: outcome.tick,
    goalId,
    previousAction,
    avoidFirstAction,
    predictedReward01,
    actualReward01,
    predictionError01,
    revisionReadiness01,
  }, currentGoalId, currentTick);
}

function goalRevision(goal: OrganismGoal | null): PlanGoalLineage {
  if (!goal) return { id: null, status: null, updatedAt: null, fingerprint: null };
  const revision = {
    id: goal.id, title: goal.title, reason: goal.reason, source: goal.source, status: goal.status,
    importance: goal.importance, urgency: goal.urgency, confidence: goal.confidence, progress: goal.progress,
    createdAt: goal.createdAt, updatedAt: goal.updatedAt, parentId: goal.parentId ?? null,
  };
  return { id: goal.id, status: goal.status, updatedAt: Number.isFinite(goal.updatedAt) ? goal.updatedAt : null, fingerprint: sha256Stable(revision) };
}
const worldFingerprint = (world: EnvironmentSnapshot) => sha256Stable(world);
function buildLineage(goal: OrganismGoal | null, world: EnvironmentSnapshot, context?: PlanBuildContext): PlanLineage {
  const tick = context?.tick;
  return {
    version: 1,
    decisionId: context?.decisionId === undefined ? null : safeDecisionId(context.decisionId),
    decisionTick: typeof tick === 'number' && Number.isSafeInteger(tick) && tick >= 0 ? tick : world.tick,
    goal: goalRevision(goal), world: { tick: world.tick, fingerprint: worldFingerprint(world) },
    revision: normalizePlanRevisionHint(context?.revisionHint, goal?.id ?? null, context?.tick),
  };
}
const stepPreconditions = (world: EnvironmentSnapshot): PlanStepPreconditions =>
  ({ worldTick: world.tick, location: world.location, worldFingerprint: worldFingerprint(world) });
function expectedOutcome(before: EnvironmentSnapshot, after: EnvironmentSnapshot, valid: boolean, reward: number, confidence: number): PlanStepExpectedOutcome {
  const facts = new Set(before.facts), events = new Set(before.events);
  return {
    valid, nextWorldTick: after.tick, nextLocation: after.location, energy01: after.energy,
    attention01: after.attention, uncertainty01: after.uncertainty,
    reward: clampReward(reward), confidence: clampConfidence(confidence), worldFingerprint: worldFingerprint(after),
    factsAdded: after.facts.filter(v => !facts.has(v)).slice(0, 12),
    eventsAdded: after.events.filter(v => !events.has(v)).slice(0, 12),
  };
}
const validation = (valid: boolean, reason: PlanValidationReason): PlanValidation => ({ valid, reason });

type PlanIntegrityFields = Pick<Plan, 'goalId' | 'title' | 'steps' | 'expectedValue' | 'searchDepth' | 'beamWidth' | 'lineage'>;
function planIntegrityFingerprint(plan: PlanIntegrityFields): string {
  return sha256Stable({
    goalId: plan.goalId ?? null,
    title: plan.title,
    steps: plan.steps,
    expectedValue: plan.expectedValue,
    searchDepth: plan.searchDepth,
    beamWidth: plan.beamWidth,
    lineage: plan.lineage,
  });
}
function sealPlan(plan: Omit<Plan, 'id' | 'integrityFingerprint'>): Plan {
  const integrityFingerprint = planIntegrityFingerprint(plan);
  return { ...plan, id: 'plan-' + integrityFingerprint.slice(0, 24), integrityFingerprint };
}
function hasValidPlanIntegrity(plan: Plan): boolean {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.steps)) return false;
  const fingerprint = planIntegrityFingerprint(plan);
  return typeof plan.integrityFingerprint === 'string'
    && /^[a-f0-9]{64}$/u.test(plan.integrityFingerprint)
    && plan.integrityFingerprint === fingerprint
    && plan.id === 'plan-' + fingerprint.slice(0, 24);
}

export class PlanEngine {
  private readonly environment: WorldEnvironment;
  private readonly residual?: ResidualRewardProvider;
  constructor(environment: WorldEnvironment, residual?: ResidualRewardProvider) { this.environment = environment; this.residual = residual; }

  /** Cheap, deterministic action estimate used when project planning is gated by the cognitive budget. */
  buildBudgetFallback(goal: OrganismGoal | null, preferred: ActionKind, reason: string, context?: PlanBuildContext): Plan {
    const createdAt = Date.now(), before = this.environment.snapshot();
    const environmentAction = actionMap[preferred], projection = this.environment.project(environmentAction, before);
    const boundedReward = Number.isFinite(projection.reward) ? clampReward(projection.reward * (projection.valid ? 1 : 0.1)) : 0.05;
    const confidence = clampConfidence(projection.confidence, 0.4);
    const safeReason = String(reason ?? 'budget-gated').replace(/[\x00-\x1f\x7f-\x9f]/gu, ' ').slice(0, 96);
    const lineage = buildLineage(goal, before, context);
    const step: PlanStep = {
      step: 1, internalAction: preferred, environmentAction, predictedReward: boundedReward, confidence,
      rationale: 'single-step fallback; beam search skipped (' + safeReason + ')',
      preconditions: stepPreconditions(before),
      expectedOutcome: expectedOutcome(before, projection.next, projection.valid, boundedReward, confidence),
    };
    return sealPlan({
      goalId: goal?.id, title: goal?.title ?? 'Budget-constrained action', steps: [step],
      expectedValue: Number((boundedReward * confidence).toFixed(4)), createdAt, searchDepth: 1, beamWidth: 1, lineage,
    });
  }

  build(goal: OrganismGoal | null, preferred: ActionKind, depth = 4, beamWidth = 4, context?: PlanBuildContext): Plan {
    const searchDepth = Math.max(1, Math.min(6, Math.trunc(depth)));
    const width = Math.max(2, Math.min(6, Math.trunc(beamWidth)));
    const preferredEnv = actionMap[preferred], rootState = this.environment.snapshot();
    const lineage = buildLineage(goal, rootState, context);
    const revisionHint = normalizePlanRevisionHint(context?.revisionHint, goal?.id ?? null, context?.tick);
    const root: Node = { state: rootState, actions: [], rewards: [], score: 0, confidence: 1 };
    let beam: Node[] = [root];
    const gamma = 0.84;
    for (let d = 0; d < searchDepth; d += 1) {
      const expanded: Node[] = [];
      for (const node of beam) {
        for (const action of envActions) {
          if (d === 0 && revisionHint?.avoidFirstAction === action) continue;
          const projection = this.environment.project(action, node.state);
          const preferenceBonus = d === 0 && action === preferredEnv ? 0.12 : 0;
          const effectiveReward = projection.valid ? projection.reward : 0.05;
          const residual = this.residual?.predict(action, effectiveReward, projection.next);
          const learnedReward = residual ? residual.predicted : effectiveReward;
          const learnedConfidence = residual ? projection.confidence * (0.72 + residual.confidence * 0.28) : projection.confidence;
          expanded.push({
            state: projection.next, actions: [...node.actions, action], rewards: [...node.rewards, projection.reward],
            score: node.score + learnedReward * learnedConfidence * Math.pow(gamma, d) + preferenceBonus,
            confidence: node.confidence * projection.confidence,
          });
        }
      }
      expanded.sort((a, b) => b.score - a.score);
      beam = expanded.slice(0, width);
    }
    const best = beam[0] ?? root;
    let cursor = rootState;
    const steps: PlanStep[] = best.actions.map((action, index) => {
      const projection = this.environment.project(action, cursor);
      const groundedReward = clampReward(projection.reward * (projection.valid ? 1 : 0.1));
      const residual = this.residual?.predict(action, groundedReward, projection.next);
      const predictedReward = clampReward(residual ? residual.predicted : groundedReward);
      const confidence = clampConfidence(residual ? projection.confidence * (0.72 + residual.confidence * 0.28) : projection.confidence, projection.confidence);
      const step: PlanStep = {
        step: index + 1, internalAction: reverseMap[action] ?? preferred, environmentAction: action,
        predictedReward, confidence,
        rationale: 'beam-search depth=' + searchDepth + ' selected ' + action + '; predicted local reward=' +
          projection.reward.toFixed(2) + (action === preferredEnv ? ' with preferred-action bias' : ''),
        preconditions: stepPreconditions(cursor),
        expectedOutcome: expectedOutcome(cursor, projection.next, projection.valid, predictedReward, confidence),
      };
      cursor = projection.next;
      return step;
    });
    return sealPlan({
      goalId: goal?.id, title: goal?.title ?? 'Explore the environment', steps,
      expectedValue: Number((best.score / Math.max(1, best.actions.length)).toFixed(4)),
      createdAt: Date.now(), searchDepth, beamWidth: width, lineage,
    });
  }

  /** Validate the exact decision, goal revision and root world snapshot. */
  validateContext(plan: Plan, goal: OrganismGoal | null, world: EnvironmentSnapshot, context?: PlanBuildContext): PlanValidation {
    if (!hasValidPlanIntegrity(plan)) return validation(false, 'plan-integrity-mismatch');
    const lineage = plan?.lineage;
    if (!lineage || lineage.version !== 1) return validation(false, 'missing-lineage');
    if (context?.decisionId !== undefined) {
      const id = safeDecisionId(context.decisionId);
      if (!id) return validation(false, 'invalid-context');
      if (lineage.decisionId !== id) return validation(false, 'decision-mismatch');
    }
    if (context?.tick !== undefined) {
      if (typeof context.tick !== 'number' || !Number.isSafeInteger(context.tick) || context.tick < 0) return validation(false, 'invalid-context');
      if (lineage.decisionTick !== context.tick) return validation(false, 'decision-tick-mismatch');
    }
    const currentGoal = goalRevision(goal);
    if (lineage.goal.id !== currentGoal.id || lineage.goal.fingerprint !== currentGoal.fingerprint)
      return validation(false, 'goal-version-mismatch');
    const expectedRevision = normalizePlanRevisionHint(context?.revisionHint, goal?.id ?? null, context?.tick);
    if (sha256Stable(lineage.revision ?? null) !== sha256Stable(expectedRevision))
      return validation(false, 'revision-context-mismatch');
    if (lineage.world.tick !== world.tick || lineage.world.fingerprint !== worldFingerprint(world))
      return validation(false, 'world-version-mismatch');
    return validation(true, 'ok');
  }

  /** Validate one step against the exact predecessor world state. */
  validateStep(plan: Plan, stepIndex: number, world: EnvironmentSnapshot): PlanValidation {
    if (!hasValidPlanIntegrity(plan)) return validation(false, 'plan-integrity-mismatch');
    if (!Number.isSafeInteger(stepIndex) || stepIndex < 0 || stepIndex >= (plan?.steps?.length ?? 0))
      return validation(false, 'invalid-step-index');
    const step = plan.steps[stepIndex];
    const pre = step?.preconditions;
    if (!pre || pre.worldTick !== world.tick || pre.location !== world.location || pre.worldFingerprint !== worldFingerprint(world))
      return validation(false, 'step-precondition-mismatch');
    if (step.expectedOutcome?.valid !== true || !envActions.includes(step.environmentAction))
      return validation(false, 'step-outcome-invalid');
    const projection = this.environment.project(step.environmentAction, world);
    const projectedOutcome = expectedOutcome(
      world, projection.next, projection.valid, step.expectedOutcome.reward, step.expectedOutcome.confidence,
    );
    if (!projection.valid || sha256Stable(projectedOutcome) !== sha256Stable(step.expectedOutcome))
      return validation(false, 'step-outcome-invalid');
    return validation(true, 'ok');
  }
}
