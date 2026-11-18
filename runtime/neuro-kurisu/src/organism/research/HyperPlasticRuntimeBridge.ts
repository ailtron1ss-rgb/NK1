import type { CognitiveBudgetManager, CognitiveBudgetState, CognitiveOperation } from '../cognition/CognitiveBudgetManager.ts';
import type { B292CognitiveStateBusState } from '../system/B292CognitiveStateBus.ts';
import {
  hyperPlasticContextFromB292,
  type HyperPlasticLoRAAdapter,
  type HyperPlasticStrategy,
  type HyperPlasticTaskType,
} from './HyperPlasticNetwork.ts';
import { HyperPlasticNetwork } from './HyperPlasticNetwork.ts';

/** Narrow view of the canonical OrganismCore authority; this bridge never owns a budget. */
export interface HyperPlasticCoreBudgetAuthority {
  cognitiveBudgetOperationalSnapshot(): CognitiveBudgetState;
  cognitiveBudgetEstimateCost(
    operation: CognitiveOperation,
    context?: Parameters<CognitiveBudgetManager['estimateCost']>[1],
  ): number;
  cognitiveBudgetCanSpend(operation: CognitiveOperation, cost01?: number): boolean;
  cognitiveBudgetSpend(
    operation: CognitiveOperation,
    cost01?: number,
    informationGain01?: number,
    reason?: string,
  ): ReturnType<CognitiveBudgetManager['spend']>;
}
export interface HyperPlasticBudgetPort {
  snapshot(): CognitiveBudgetState;
  estimateCost(
    operation: CognitiveOperation,
    context?: Parameters<CognitiveBudgetManager['estimateCost']>[1],
  ): number;
  canSpend(operation: CognitiveOperation, cost01?: number): boolean;
  spend(
    operation: CognitiveOperation,
    cost01?: number,
    informationGain01?: number,
    meta?: { tick?: number; reason?: string },
  ): ReturnType<CognitiveBudgetManager['spend']>;
}
/** Adapt the real Core-owned budget APIs without constructing a second manager. */
export function hyperPlasticBudgetPortFromCore(core: HyperPlasticCoreBudgetAuthority): HyperPlasticBudgetPort {
  if (!core || typeof core.cognitiveBudgetOperationalSnapshot !== 'function' ||
      typeof core.cognitiveBudgetEstimateCost !== 'function' ||
      typeof core.cognitiveBudgetCanSpend !== 'function' ||
      typeof core.cognitiveBudgetSpend !== 'function') {
    throw new TypeError('ome26-core-budget-authority-unavailable');
  }
  return Object.freeze({
    snapshot: () => core.cognitiveBudgetOperationalSnapshot(),
    estimateCost: (operation, context) => core.cognitiveBudgetEstimateCost(operation, context),
    canSpend: (operation, cost01) => core.cognitiveBudgetCanSpend(operation, cost01),
    spend: (operation, cost01, informationGain01, meta) =>
      core.cognitiveBudgetSpend(operation, cost01, informationGain01, meta?.reason ?? 'ome26-hyper-plastic-shadow'),
  });
}

export interface HyperPlasticRuntimeProposalInput {
  state: B292CognitiveStateBusState;
  taskType: HyperPlasticTaskType;
  strategy: HyperPlasticStrategy;
  confidence01: number;
  baseModelFingerprint: string;
  /** Runtime cycle identity; if provided it must match the canonical B292 tick. */
  expectedTick?: number;
  budgetManager: HyperPlasticBudgetPort;
}

export type HyperPlasticRuntimeProposalResult =
  | {
      status: 'shadow-candidate';
      reason: 'generated';
      adapter: HyperPlasticLoRAAdapter;
      budgetSpent01: number;
      remainingBudget01: number;
    }
  | {
      status: 'blocked';
      reason: string;
      adapter: null;
      budgetSpent01: number;
      remainingBudget01: number;
    };

export interface HyperPlasticRuntimeBridgeSnapshot {
  version: 1;
  proposals: number;
  blocked: number;
  budgetRejected: number;
  duplicateTickRejected: number;
  generationFailures: number;
  lastAttemptTick: number;
  lastTick: number;
  lastStatus: 'idle' | 'shadow-candidate' | 'blocked';
  lastReason: string;
  lastAdapterFingerprint: string | null;
  lastBudgetSpent01: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/**
 * Research-only bridge from B292 + the single existing CognitiveBudgetManager.
 * It never applies an adapter, never changes base weights and never issues a
 * promotion permit. Every accepted proposal costs one explicit 'research' spend.
 */
export class HyperPlasticRuntimeBridge {
  private readonly network: HyperPlasticNetwork;
  private metrics: HyperPlasticRuntimeBridgeSnapshot = {
    version: 1,
    proposals: 0,
    blocked: 0,
    budgetRejected: 0,
    duplicateTickRejected: 0,
    generationFailures: 0,
    lastAttemptTick: -1,
    lastTick: -1,
    lastStatus: 'idle',
    lastReason: 'not-run',
    lastAdapterFingerprint: null,
    lastBudgetSpent01: 0,
  };

  constructor(network: HyperPlasticNetwork) {
    this.network = network;
  }

  propose(input: HyperPlasticRuntimeProposalInput): HyperPlasticRuntimeProposalResult {
    const block = (reason: string, remainingBudget01 = 0, budgetSpent01 = 0): HyperPlasticRuntimeProposalResult => {
      this.metrics = {
        ...this.metrics,
        blocked: this.metrics.blocked + 1,
        lastTick: Number.isSafeInteger(input?.state?.tick) ? input.state.tick : -1,
        lastStatus: 'blocked',
        lastReason: reason,
        lastAdapterFingerprint: null,
        lastBudgetSpent01: budgetSpent01,
      };
      return { status: 'blocked', reason, adapter: null, budgetSpent01, remainingBudget01 };
    };

    if (!input || !input.state || !input.budgetManager ||
        typeof input.budgetManager.snapshot !== 'function' ||
        typeof input.budgetManager.estimateCost !== 'function' ||
        typeof input.budgetManager.canSpend !== 'function' ||
        typeof input.budgetManager.spend !== 'function') {
      return block('budget-or-cognitive-state-unavailable');
    }
    if (!Number.isSafeInteger(input.state.tick) || input.state.tick < 0 ||
        (input.expectedTick !== undefined &&
          (!Number.isSafeInteger(input.expectedTick) || input.expectedTick !== input.state.tick))) {
      return block('cognitive-state-tick-mismatch');
    }
    if (input.strategy === 'defer') return block('strategy-deferred');
    if (typeof input.baseModelFingerprint !== 'string' ||
        !/^sha256:[a-f0-9]{64}$/i.test(input.baseModelFingerprint)) {
      return block('base-model-fingerprint-invalid');
    }
    if (input.state.tick <= this.metrics.lastAttemptTick) {
      this.metrics = { ...this.metrics, duplicateTickRejected: this.metrics.duplicateTickRejected + 1 };
      return block('duplicate-tick');
    }
    if (!Number.isFinite(input.state.readiness01) || !Number.isFinite(input.state.stability01) ||
        !Number.isFinite(input.state.uncertainty01)) {
      return block('cognitive-state-invalid');
    }
    let budget: CognitiveBudgetState;
    try {
      budget = input.budgetManager.snapshot();
    } catch {
      return block('budget-snapshot-failed');
    }
    if (!budget || !Number.isFinite(budget.remaining01) || budget.remaining01 < 0 || budget.remaining01 > 1) {
      return block('budget-snapshot-invalid');
    }
    const remaining = clamp01(budget.remaining01);
    if (budget.mode === 'sleep' || budget.mode === 'defer') {
      return block(`budget-mode-blocked:${budget.mode}`, remaining);
    }
    if (input.state.readiness01 < 0.30 || input.state.stability01 < 0.35) {
      return block('cognitive-state-not-ready', remaining);
    }
    if (input.state.uncertainty01 > 0.90) {
      return block('uncertainty-above-ceiling', remaining);
    }
    if (remaining < 0.25) return block('resource-budget-below-floor', remaining);

    let context;
    try {
      context = hyperPlasticContextFromB292(input.state, {
        taskType: input.taskType,
        strategy: input.strategy,
        confidence01: input.confidence01,
        resourceBudget01: remaining,
      });
    } catch {
      return block('cognitive-context-invalid', remaining);
    }

    let estimatedCost01: number;
    try {
      estimatedCost01 = input.budgetManager.estimateCost('research', {
        complexity01: clamp01(input.state.cognitiveLoad01 * 0.65 + input.state.uncertainty01 * 0.35),
        thermal01: input.state.thermal01,
      });
    } catch {
      return block('research-cost-estimation-failed', remaining);
    }
    if (!Number.isFinite(estimatedCost01) || estimatedCost01 <= 0 || estimatedCost01 > 1) {
      return block('research-cost-invalid', remaining);
    }
    let canSpend: boolean;
    try {
      canSpend = input.budgetManager.canSpend('research', estimatedCost01);
    } catch {
      return block('budget-authority-failed', remaining);
    }
    if (!canSpend) {
      this.metrics = { ...this.metrics, budgetRejected: this.metrics.budgetRejected + 1 };
      return block('research-budget-rejected', remaining);
    }
    // Claim the canonical cognitive tick before debit. A retry on this tick
    // must not spend a second research operation if the first result was uncertain.
    this.metrics = { ...this.metrics, lastAttemptTick: input.state.tick };
    let spend: ReturnType<HyperPlasticBudgetPort['spend']>;
    try {
      spend = input.budgetManager.spend(
        'research',
        estimatedCost01,
        clamp01(input.state.uncertainty01 * 0.55 + input.state.novelty01 * 0.45),
        { tick: input.state.tick, reason: 'ome26-hyper-plastic-shadow-candidate' },
      );
    } catch {
      return block('budget-spend-result-uncertain', remaining);
    }
    if (!spend.accepted) {
      this.metrics = { ...this.metrics, budgetRejected: this.metrics.budgetRejected + 1 };
      return block('research-budget-rejected', spend.remaining01, 0);
    }

    let generated: ReturnType<HyperPlasticNetwork['generateCandidate']>;
    try {
      generated = this.network.generateCandidate(
        context,
        input.baseModelFingerprint,
        input.state.tick,
      );
    } catch {
      this.metrics = { ...this.metrics, generationFailures: this.metrics.generationFailures + 1 };
      return block('generation-failed-after-budget-spend', spend.remaining01, spend.spent01);
    }
    if (generated.status !== 'candidate') {
      return block(`generation-fallback-after-budget-spend:${generated.reason}`, spend.remaining01, spend.spent01);
    }
    this.metrics = {
      ...this.metrics,
      proposals: this.metrics.proposals + 1,
      lastTick: input.state.tick,
      lastStatus: 'shadow-candidate',
      lastReason: 'generated',
      lastAdapterFingerprint: generated.adapter.fingerprint,
      lastBudgetSpent01: spend.spent01,
    };
    return {
      status: 'shadow-candidate',
      reason: 'generated',
      adapter: generated.adapter,
      budgetSpent01: spend.spent01,
      remainingBudget01: spend.remaining01,
    };
  }

  snapshot(): HyperPlasticRuntimeBridgeSnapshot {
    return { ...this.metrics };
  }
}
