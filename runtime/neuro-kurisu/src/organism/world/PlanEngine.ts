import type { ActionKind, OrganismGoal } from '../core/types.ts';
import { WorldEnvironment, type EnvironmentAction, type EnvironmentSnapshot } from './WorldEnvironment.ts';

export interface PlanStep {
  step: number;
  internalAction: ActionKind;
  environmentAction: EnvironmentAction;
  predictedReward: number;
  confidence: number;
  rationale: string;
}

export interface Plan {
  id: string;
  goalId?: string;
  title: string;
  steps: PlanStep[];
  expectedValue: number;
  createdAt: number;
  searchDepth: number;
  beamWidth: number;
}

const actionMap: Record<ActionKind, EnvironmentAction> = {
  respond: 'communicate', explore: 'move', verify: 'inspect', rest: 'rest', reflect: 'observe', wait: 'observe', defer: 'rest',
};
const reverseMap: Partial<Record<EnvironmentAction, ActionKind>> = {
  communicate: 'respond', move: 'explore', inspect: 'verify', rest: 'rest', observe: 'reflect', collect: 'explore',
};
const envActions: EnvironmentAction[] = ['observe', 'inspect', 'move', 'collect', 'rest', 'communicate'];

interface Node { state: EnvironmentSnapshot; actions: EnvironmentAction[]; rewards: number[]; score: number; confidence: number; }

export interface ResidualRewardProvider { predict(action: EnvironmentAction | string, baseReward: number, context?: EnvironmentSnapshot): { predicted: number; confidence: number; samples?: number; uncertainty?: number; modelReady?: boolean }; }

export class PlanEngine {
  private readonly environment: WorldEnvironment;
  private readonly residual?: ResidualRewardProvider;
  constructor(environment: WorldEnvironment, residual?: ResidualRewardProvider) { this.environment = environment; this.residual = residual; }

  build(goal: OrganismGoal | null, preferred: ActionKind, depth = 4, beamWidth = 4): Plan {
    const searchDepth = Math.max(1, Math.min(6, Math.trunc(depth)));
    const width = Math.max(2, Math.min(6, Math.trunc(beamWidth)));
    const preferredEnv = actionMap[preferred];
    const root: Node = { state: this.environment.snapshot(), actions: [], rewards: [], score: 0, confidence: 1 };
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
          const learnedConfidence = residual ? (projection.confidence * (0.72 + residual.confidence * 0.28)) : projection.confidence;
          const stepScore = learnedReward * learnedConfidence * Math.pow(gamma, d) + preferenceBonus;
          const nextActions = [...node.actions, action];
          expanded.push({
            state: projection.next,
            actions: nextActions,
            rewards: [...node.rewards, projection.reward],
            score: node.score + stepScore,
            confidence: node.confidence * projection.confidence,
          });
        }
      }
      expanded.sort((a, b) => b.score - a.score);
      beam = expanded.slice(0, width);
    }

    const best = beam[0] ?? root;
    const steps = best.actions.map((action, index) => {
      const projected = this.environment.projectSequence(best.actions.slice(0, index + 1));
      const reward = projected.rewards.at(-1) ?? 0;
      const confidence = projected.confidences.at(-1) ?? 0.4;
      const internalAction = reverseMap[action] ?? preferred;
      return {
        step: index + 1,
        internalAction,
        environmentAction: action,
        predictedReward: this.residual ? this.residual.predict(action, reward * (projected.validities.at(-1) ?? true ? 1 : 0.1), projected.next).predicted : reward * (projected.validities.at(-1) ?? true ? 1 : 0.1),
        confidence: this.residual ? Math.max(0.18, confidence * (0.72 + this.residual.predict(action, reward, projected.next).confidence * 0.28)) : confidence,
        rationale: `beam-search depth=${searchDepth} selected ${action}; predicted local reward=${reward.toFixed(2)}${action === preferredEnv ? ' with preferred-action bias' : ''}`,
      };
    });

    return {
      id: `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      goalId: goal?.id,
      title: goal?.title ?? 'Explore the environment',
      steps,
      expectedValue: Number((best.score / Math.max(1, best.actions.length)).toFixed(4)),
      createdAt: Date.now(),
      searchDepth,
      beamWidth: width,
    };
  }
}
