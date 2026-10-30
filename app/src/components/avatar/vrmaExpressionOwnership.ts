export const VRMA_SPEECH_VISEMES = Object.freeze(["aa", "ih", "ou", "ee", "oh"] as const);

export type VrmaExpressionOwnershipState = {
  activeExpressionKeys: string[];
  transitionExpressionKeys: string[];
  expressionTransitionRemaining: number;
};

function normalizeExpressionKeys(keys: readonly unknown[] | null | undefined): string[] {
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.filter((key): key is string => typeof key === "string" && key.trim().length > 0).map((key) => key.trim()))];
}

function finiteDuration(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function beginVrmaExpressionOwnershipTransition(
  previousKeys: readonly string[] | null | undefined,
  nextKeys: readonly string[] | null | undefined,
  fadeSeconds: number,
): VrmaExpressionOwnershipState {
  const activeExpressionKeys = normalizeExpressionKeys(nextKeys);
  const duration = finiteDuration(fadeSeconds);
  return {
    activeExpressionKeys,
    transitionExpressionKeys: duration > 0
      ? [...new Set([...normalizeExpressionKeys(previousKeys), ...activeExpressionKeys])]
      : [],
    expressionTransitionRemaining: duration,
  };
}

export function advanceVrmaExpressionOwnership(
  state: VrmaExpressionOwnershipState,
  deltaSeconds: number,
): VrmaExpressionOwnershipState {
  const remaining = Math.max(0, finiteDuration(state.expressionTransitionRemaining) - finiteDuration(deltaSeconds));
  return {
    activeExpressionKeys: normalizeExpressionKeys(state.activeExpressionKeys),
    transitionExpressionKeys: remaining > 0 ? normalizeExpressionKeys(state.transitionExpressionKeys) : [],
    expressionTransitionRemaining: remaining,
  };
}

export function getProtectedVrmaExpressionKeys(state: VrmaExpressionOwnershipState): Set<string> {
  const active = normalizeExpressionKeys(state.activeExpressionKeys);
  return new Set(state.expressionTransitionRemaining > 0
    ? [...active, ...normalizeExpressionKeys(state.transitionExpressionKeys)]
    : active);
}

export function getVrmaSpeechVisemeKeys(availableKeys: readonly string[] | null | undefined): string[] {
  const available = new Set(normalizeExpressionKeys(availableKeys));
  return VRMA_SPEECH_VISEMES.filter((key) => available.has(key));
}
