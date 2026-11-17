import type { CognitiveBudgetManager, CognitiveBudgetState } from '../cognition/CognitiveBudgetManager.ts';
import type { B292CognitiveStateBusState } from '../system/B292CognitiveStateBus.ts';
import {
  hyperPlasticContextFromB292,
  type HyperPlasticLoRAAdapter,
  type HyperPlasticStrategy,
  type HyperPlasticTaskType,
} from './HyperPlasticNetwork.ts';
import { HyperPlasticNetwork } from './HyperPlasticNetwork.ts';

export interface HyperPlasticRuntimeProposalInput {
  state: B292CognitiveStateBusState;
  taskType: HyperPlasticTaskType;
  strategy: HyperPlasticStrategy;
  confidence01: number;
  baseModelFingerprint: string;
  budgetManager: CognitiveBudgetManager;
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
    const budget = input.budgetManager.snapshot() as CognitiveBudgetState & { remaining01: number };
    const remaining = clamp01(budget.remaining01);
    if (budget.mode === 'sleep' || budget.mode === 'defer') {
      return block(`budget-mode-blocked:${budget.mode}`, remaining);
    }
    if (!Number.isSafeInteger(input.state.tick) || input.state.tick < 0 ||
        !Number.isFinite(input.state.readiness01) || !Number.isFinite(input.state.stability01) ||
        !Number.isFinite(input.state.uncertainty01)) {
      return block('cognitive-state-invalid', remaining);
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

    const estimatedCost01 = input.budgetManager.estimateCost('research', {
      complexity01: clamp01(input.state.cognitiveLoad01 * 0.65 + input.state.uncertainty01 * 0.35),
      thermal01: input.state.thermal01,
    });
    if (!Number.isFinite(estimatedCost01) || estimatedCost01 <= 0 || estimatedCost01 > 1) {
      return block('research-cost-invalid', remaining);
    }
    if (!input.budgetManager.canSpend('research', estimatedCost01)) {
      this.metrics = { ...this.metrics, budgetRejected: this.metrics.budgetRejected + 1 };
      return block('research-budget-rejected', remaining);
    }
    const spend = input.budgetManager.spend(
      'research',
      estimatedCost01,
      clamp01(input.state.uncertainty01 * 0.55 + input.state.novelty01 * 0.45),
      { tick: input.state.tick, reason: 'ome26-hyper-plastic-shadow-candidate' },
    );
    if (!spend.accepted) {
      this.metrics = { ...this.metrics, budgetRejected: this.metrics.budgetRejected + 1 };
      return block('research-budget-rejected', spend.remaining01, 0);
    }

    const generated = this.network.generateCandidate(
      context,
      input.baseModelFingerprint,
      input.state.tick,
    );
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
