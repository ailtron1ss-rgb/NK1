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
export interface PlanLineage {
  version: 1; decisionId: string | null; decisionTick: number;
  goal: PlanGoalLineage; world: { tick: number; fingerprint: string };
}
export interface PlanBuildContext { decisionId?: string; tick?: number; }
export type PlanValidationReason =
  | 'ok' | 'missing-lineage' | 'invalid-context' | 'decision-mismatch'
  | 'decision-tick-mismatch' | 'goal-version-mismatch' | 'world-version-mismatch'
  | 'invalid-step-index' | 'step-precondition-mismatch' | 'step-outcome-invalid';
export interface PlanValidation { valid: boolean; reason: PlanValidationReason; }
export interface Plan {
  id: string; goalId?: string; title: string; steps: PlanStep[]; expectedValue: number;
  createdAt: number; searchDepth: number; beamWidth: number; lineage: PlanLineage;
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
    return {
      id: 'plan-' + sha256Stable({ lineage, environmentAction, safeReason }).slice(0, 24),
      goalId: goal?.id, title: goal?.title ?? 'Budget-constrained action', steps: [step],
      expectedValue: Number((boundedReward * confidence).toFixed(4)), createdAt, searchDepth: 1, beamWidth: 1, lineage,
    };
  }

  build(goal: OrganismGoal | null, preferred: ActionKind, depth = 4, beamWidth = 4, context?: PlanBuildContext): Plan {
    const searchDepth = Math.max(1, Math.min(6, Math.trunc(depth)));
    const width = Math.max(2, Math.min(6, Math.trunc(beamWidth)));
    const preferredEnv = actionMap[preferred], rootState = this.environment.snapshot();
    const lineage = buildLineage(goal, rootState, context);
    const root: Node = { state: rootState, actions: [], rewards: [], score: 0, confidence: 1 };
    let beam: Node[] = [root];
    const gamma = 0.84;
    for (let d = 0; d < searchDepth; d += 1) {
      const expanded: Node[] = [];
      for (const node of beam) {
        for (const action of envActions) {
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
    return {
      id: 'plan-' + sha256Stable({ lineage, actions: best.actions, expectedValue: best.score }).slice(0, 24),
      goalId: goal?.id, title: goal?.title ?? 'Explore the environment', steps,
      expectedValue: Number((best.score / Math.max(1, best.actions.length)).toFixed(4)),
      createdAt: Date.now(), searchDepth, beamWidth: width, lineage,
    };
  }

  /** Validate the exact decision, goal revision and root world snapshot. */
  validateContext(plan: Plan, goal: OrganismGoal | null, world: EnvironmentSnapshot, context?: PlanBuildContext): PlanValidation {
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
    if (lineage.world.tick !== world.tick || lineage.world.fingerprint !== worldFingerprint(world))
      return validation(false, 'world-version-mismatch');
    return validation(true, 'ok');
  }

  /** Validate one step against the exact predecessor world state. */
  validateStep(plan: Plan, stepIndex: number, world: EnvironmentSnapshot): PlanValidation {
    if (!Number.isSafeInteger(stepIndex) || stepIndex < 0 || stepIndex >= (plan?.steps?.length ?? 0))
      return validation(false, 'invalid-step-index');
    const step = plan.steps[stepIndex];
    const pre = step?.preconditions;
    if (!pre || pre.worldTick !== world.tick || pre.location !== world.location || pre.worldFingerprint !== worldFingerprint(world))
      return validation(false, 'step-precondition-mismatch');
    if (step.expectedOutcome?.valid !== true) return validation(false, 'step-outcome-invalid');
    return validation(true, 'ok');
  }
}
