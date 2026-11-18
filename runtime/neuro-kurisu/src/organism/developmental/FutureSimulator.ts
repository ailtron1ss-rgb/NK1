import type { WorldModel2 } from './WorldModel2.ts';
import { SharedFutureEngine, defaultSharedFutureState, type SharedFutureState, type SharedFutureOutcomeRecord } from './SharedFutureEngine.ts';
import { WorldForge, type WorldForgeCase, type WorldForgeEvaluation, type WorldForgeState, type WorldForgeStepResult } from './WorldForge.ts';
import {
  ConsequenceEcologyEngine,
  defaultConsequenceEcologyState,
  type ConsequenceEcologyContext,
  type ConsequenceEcologyRequest,
  type ConsequenceEcologyState,
} from './ConsequenceEcology.ts';

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
  /** Optional for backward compatibility with snapshots written before Consequence Ecology. */
  consequenceEcology?: ConsequenceEcologyState;
}
export const defaultFutureSimulator = (): FutureSimulatorState => ({
  runs: 0,
  last: [],
  version: 1,
  sharedFuture: defaultSharedFutureState(),
  consequenceEcology: defaultConsequenceEcologyState(),
});

export class FutureSimulator {
  private state = defaultFutureSimulator();
  readonly sharedFuture = new SharedFutureEngine();
  /** Consequence Ecology is an analysis/evidence ledger, never an action executor. */
  readonly consequenceEcology = new ConsequenceEcologyEngine();
  /** Ephemeral synthetic laboratory; evaluator state is never persisted. */
  readonly #worldForge = new WorldForge();

  constructor() {
    // Bind calibration to the canonical Shared Future outcome ledger. Callers cannot submit
    // a caller-constructed object with `independentlyVerified: true` to enter the trust ledger.
    this.consequenceEcology.setVerifiedOutcomeResolver(outcomeId =>
      this.sharedFuture.listOutcomes().find(row => row.id === outcomeId) ?? null);
  }

  generateWorldForgeScenarios(input: { split: 'train' | 'validation'; seed: number; count?: number; difficulty01?: number }): WorldForgeCase[] {
    return this.#worldForge.generateRuntimeScenarios(input);
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

  analyzeConsequences(
    request: ConsequenceEcologyRequest,
    context: Omit<ConsequenceEcologyContext, 'scenario'> = {},
  ) {
    const scenarioId = typeof request?.scenarioId === 'string' ? request.scenarioId.trim() : '';
    const scenario = scenarioId ? this.sharedFuture.getScenario(scenarioId) : null;
    if (scenarioId && !scenario) throw new Error('consequence-scenario-not-found');
    return this.consequenceEcology.analyze(request, {
      ...context,
      scenario,
      // Decision identity must come from the canonical Shared Future action-binding ledger.
      resolveDecision: decisionId => this.sharedFuture.getDecisionByActionBindingDecisionId(decisionId),
    });
  }

  recordVerifiedConsequenceOutcome(input: { outcomeId: string; analysisId: string; optionId: string }) {
    const outcomeId = typeof input?.outcomeId === 'string' ? input.outcomeId.trim() : '';
    if (!outcomeId) throw new Error('consequence-outcome-id-required');
    return this.consequenceEcology.recordVerifiedOutcome({
      outcomeId,
      analysisId: input.analysisId,
      optionId: input.optionId,
    });
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
    // SharedFuture.restore has already revalidated each independent outcome against the supplied
    // external verifier. Reuse that canonical admitted record; do not invoke an external verifier twice.
    this.sharedFuture.restore(s?.sharedFuture, options.validateIndependentlyVerifiedOutcome);
    this.consequenceEcology.restore(s?.consequenceEcology, outcomeId => {
      const outcome = this.sharedFuture.listOutcomes().find(row => row.id === outcomeId);
      return outcome?.authority === 'independent-external' && outcome.independentlyVerified === true
        ? outcome
        : null;
    });
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
      consequenceEcology: this.consequenceEcology.snapshot(),
    };
  }
}
