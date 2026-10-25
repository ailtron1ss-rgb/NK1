import type { CognitiveDependencyState } from './CognitiveDependencyGraph.ts';

export interface CognitiveRoutingPolicy {
  /** Optional speculative simulations are bounded by, never expanded beyond, the resource allocator. */
  maxCounterfactualBranches: number;
  /** Matched alternate-world projections are optional and can be skipped under pressure. */
  allowMatchedCounterfactual: boolean;
  reason: 'resource-budget' | 'active-interrupt' | 'critical-interrupt' | 'governance-pressure';
  interruptPriority01: number;
  /** Non-resource interrupts may shorten the next cognitive cycle, never below 75% of its normal delay. */
  cognitiveCycleDelayMultiplier01: number;
}

/**
 * Narrow adapter between dependency routing and optional speculative work.
 * It never selects/replaces the canonical action and can only reduce an existing budget.
 */
export function resolveCognitiveRoutingPolicy(
  dependency: Pick<CognitiveDependencyState, 'wakeMask' | 'interrupt'>,
  resourceBudgetBranches: number,
): CognitiveRoutingPolicy {
  const baseBranches = typeof resourceBudgetBranches === 'number' && Number.isFinite(resourceBudgetBranches)
    ? Math.max(0, Math.min(3, Math.floor(resourceBudgetBranches)))
    : 0;
  const rawInterrupt = dependency?.interrupt;
  const active = rawInterrupt?.active === true;
  const priority = typeof rawInterrupt?.priority01 === 'number' && Number.isFinite(rawInterrupt.priority01)
    ? Math.max(0, Math.min(1, rawInterrupt.priority01))
    : 0;
  const type = typeof rawInterrupt?.type === 'string'
    ? (rawInterrupt.type.trim().toLowerCase() || 'none')
    : 'none';
  const criticalType = type === 'thermal-critical' || type === 'resource-critical' || type === 'memory-pressure';
  const governanceActive =
    typeof dependency?.wakeMask === 'number' &&
    Number.isSafeInteger(dependency.wakeMask) &&
    (dependency.wakeMask & 64) !== 0;

  // Critical severity is itself authoritative; a contradictory inactive flag must not reopen speculative work.
  if (criticalType || (active && priority >= 0.90)) {
    return {
      maxCounterfactualBranches: 0,
      allowMatchedCounterfactual: false,
      reason: 'critical-interrupt',
      interruptPriority01: priority,
      cognitiveCycleDelayMultiplier01: criticalType ? 1 : Math.max(0.75, 1 - priority * 0.25),
    };
  }
  if (active) {
    return {
      maxCounterfactualBranches: Math.min(baseBranches, 1),
      allowMatchedCounterfactual: false,
      reason: 'active-interrupt',
      interruptPriority01: priority,
      cognitiveCycleDelayMultiplier01: Math.max(0.75, 1 - priority * 0.25),
    };
  }
  if (governanceActive) {
    return {
      maxCounterfactualBranches: Math.min(baseBranches, 1),
      allowMatchedCounterfactual: false,
      reason: 'governance-pressure',
      interruptPriority01: priority,
      cognitiveCycleDelayMultiplier01: 1,
    };
  }
  return {
    maxCounterfactualBranches: baseBranches,
    allowMatchedCounterfactual: baseBranches > 0,
    reason: 'resource-budget',
    interruptPriority01: priority,
    cognitiveCycleDelayMultiplier01: 1,
  };
}
