import {
  NegativeSpaceMemory,
  defaultNegativeSpaceMemoryState,
  type NegativeSpaceAlternativeInput,
  type NegativeSpaceMemoryState,
  type NegativeSpaceSignificance,
} from './NegativeSpaceMemory.ts';

export interface RegretRecord {
  id: string;
  at: number;
  chosen: string;
  alternative: string;
  chosenOutcome: number;
  counterfactualOutcome: number;
  regret: number;
  learning: string;
}

export interface RegretState {
  records: RegretRecord[];
  meanRegret: number;
  lastAt: number;
  version: number;
  /** Optional for old persisted snapshots; snapshots written now always include it. */
  negativeSpace?: NegativeSpaceMemoryState;
}

export interface RegretAlternativeInput extends Omit<NegativeSpaceAlternativeInput, 'expectedOutcome01'> {
  expectedOutcome01?: number;
  /** Backwards-compatible field used by the original RegretEngine API. */
  estimated?: number;
}

export interface RegretObservationContext {
  decisionId: string;
  decisionAt?: number;
  outcomeAt?: number;
  chosenExpectedOutcome01: number;
  significance: Omit<NegativeSpaceSignificance, 'score01'>;
  outcomeEvidence?: string[];
}

export const defaultRegretState = (): RegretState => ({
  records: [],
  meanRegret: 0,
  lastAt: 0,
  version: 1,
  negativeSpace: defaultNegativeSpaceMemoryState(),
});

const clamp = (x: number): number => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const expectedOutcomeOf = (candidate: RegretAlternativeInput): number => clamp(candidate.expectedOutcome01 ?? candidate.estimated ?? 0);

export class RegretEngine {
  private state = defaultRegretState();
  private readonly negativeSpace = new NegativeSpaceMemory();

  restore(snapshot: RegretState | undefined): void {
    this.state = {
      ...defaultRegretState(),
      ...(snapshot ?? {}),
      records: Array.isArray(snapshot?.records) ? snapshot.records.slice(0, 256) : [],
    };
    this.negativeSpace.restore(snapshot?.negativeSpace);
  }

  observe(
    chosen: string,
    chosenOutcome: number,
    alternatives: RegretAlternativeInput[],
    context?: RegretObservationContext,
  ): RegretRecord | null {
    const alternative = alternatives
      .filter(candidate => candidate.action !== chosen)
      .sort((a, b) => expectedOutcomeOf(b) - expectedOutcomeOf(a))[0];
    let row: RegretRecord | null = null;
    if (alternative) {
      const counterfactualOutcome = expectedOutcomeOf(alternative);
      const regret = clamp(counterfactualOutcome - chosenOutcome);
      row = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: Date.now(),
        chosen,
        alternative: alternative.action,
        chosenOutcome,
        counterfactualOutcome,
        regret,
        learning: regret > 0.35 ? `reconsider:${alternative.action}` : 'minor-regret',
      };
      this.state.records = [row, ...this.state.records].slice(0, 256);
      this.state.meanRegret = this.state.meanRegret * 0.9 + regret * 0.1;
      this.state.lastAt = row.at;
    }

    if (context?.decisionId && alternatives.some(candidate => candidate.action !== chosen)) {
      const record = this.negativeSpace.recordDecision({
        decisionId: context.decisionId,
        at: context.decisionAt,
        chosen,
        chosenExpectedOutcome01: context.chosenExpectedOutcome01,
        significance: context.significance,
        alternatives: alternatives.map(candidate => ({
          ...candidate,
          expectedOutcome01: expectedOutcomeOf(candidate),
        })),
      });
      if (record) {
        this.negativeSpace.recordOutcome({
          decisionId: context.decisionId,
          actualOutcome01: chosenOutcome,
          at: context.outcomeAt,
          evidence: context.outcomeEvidence,
        });
      }
    }
    return row;
  }

  markNegativeSpaceAlternativeReopened(decisionId: string, action: string, reason: string, at?: number): boolean {
    return this.negativeSpace.markReopened(decisionId, action, reason, at);
  }

  negativeSpaceReviewQueue() {
    return this.negativeSpace.reviewQueue();
  }

  negativeSpaceDiagnostics() {
    return this.negativeSpace.diagnostics();
  }

  snapshot(): RegretState {
    return {
      ...structuredClone(this.state),
      negativeSpace: this.negativeSpace.snapshot(),
    };
  }
}
