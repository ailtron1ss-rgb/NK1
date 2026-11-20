import type { WorldModel2 } from './WorldModel2.ts';
import { SharedFutureEngine, defaultSharedFutureState, type SharedFutureState, type SharedFutureOutcomeRecord } from './SharedFutureEngine.ts';
import { WorldForge, type WorldForgeAdversarialFocus, type WorldForgeCase, type WorldForgeEvaluation, type WorldForgeState, type WorldForgeStepResult } from './WorldForge.ts';

export interface FutureSimulationResult {
  path: Array<{ action: string; reward: number; uncertainty: number; confidence: number }>;
  expectedReward: number;
  uncertainty: number;
  horizon: number;
}
export interface FutureSimulatorState {
  runs: number;
  last: Array<{ action: string; reward: number }>;
  version: number;
  /** Optional for backward compatibility with pre-Shared-Future snapshots. */
  sharedFuture?: SharedFutureState;
}
export const defaultFutureSimulator = (): FutureSimulatorState => ({
  runs: 0,
  last: [],
  version: 1,
  sharedFuture: defaultSharedFutureState(),
});

export class FutureSimulator {
  private state = defaultFutureSimulator();
  readonly sharedFuture = new SharedFutureEngine();
  /** Ephemeral synthetic laboratory; evaluator state is never persisted. */
  readonly #worldForge = new WorldForge();

  generateWorldForgeScenarios(input: { split: 'train' | 'validation'; seed: number; count?: number; difficulty01?: number }): WorldForgeCase[] {
    return this.#worldForge.generateRuntimeScenarios(input);
  }

  generateAdversarialWorldForgeScenarios(input: { seed: number; count: number; difficulty01: number; focus: WorldForgeAdversarialFocus; candidateMultiplier?: number }): WorldForgeCase[] {
    return this.#worldForge.generateAdversarialRuntimeScenarios(input);
  }

  startWorldForgeScenario(scenario: WorldForgeCase): WorldForgeState | null {
    return this.#worldForge.startScenario(scenario);
  }

  stepWorldForgeScenario(state: unknown, action: unknown): WorldForgeStepResult {
    return this.#worldForge.step(state, action);
  }

  evaluateWorldForgeSession(scenario: WorldForgeCase, state: unknown): WorldForgeEvaluation {
    return this.#worldForge.evaluateSession(scenario, state);
  }

  releaseWorldForgeScenario(scenarioId: string): void {
    this.#worldForge.releaseEvaluator(scenarioId);
  }

  restore(
    s: FutureSimulatorState | undefined,
    options: { validateIndependentlyVerifiedOutcome?: (outcome: SharedFutureOutcomeRecord) => boolean } = {},
  ): void {
    this.state = {
      ...defaultFutureSimulator(),
      ...(s ?? {}),
      last: Array.isArray(s?.last) ? s!.last.slice(-32) : [],
    };
    // Older snapshots do not have this field; restore() deliberately keeps them valid.
    this.sharedFuture.restore(s?.sharedFuture, options.validateIndependentlyVerifiedOutcome);
  }

  simulate(model: WorldModel2, actions: string[], baseReward: number): FutureSimulationResult {
    const r = model.rollout(actions.slice(0, 6), baseReward);
    this.state.runs++;
    this.state.last = [...this.state.last, { action: actions.join('>'), reward: r.reward }].slice(-32);
    // This is a model projection, never an observed outcome or a factual prediction.
    // Recording it must not break the existing preview path if the ledger is at capacity.
    try {
      this.sharedFuture.recordRuntimeForecast({
        path: r.path,
        expectedReward: r.reward,
        uncertainty: r.uncertainty,
        horizon: r.path.length,
      });
    } catch {
      // Future-scenario capture is an auxiliary projection; rollout remains authoritative.
    }
    return { path: r.path, expectedReward: r.reward, uncertainty: r.uncertainty, horizon: r.path.length };
  }

  snapshot(): FutureSimulatorState {
    return {
      ...structuredClone(this.state),
      sharedFuture: this.sharedFuture.snapshot(),
    };
  }
}
