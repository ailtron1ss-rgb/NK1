import type { ActionKind } from '../core/types.ts';

export type InnerImperativeSource = 'external' | 'endogenous' | 'continuity';
export type InnerImperativeMotive =
  | 'external-response'
  | 'homeostatic'
  | 'epistemic-gap'
  | 'unfinished-goal'
  | 'novelty-seeking'
  | 'social-connection'
  | 'continuity';

const ACTIONS: readonly ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const RESOURCE_INTENSIVE_ACTIONS = new Set<ActionKind>(['explore', 'verify', 'reflect']);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isAction = (value: unknown): value is ActionKind =>
  typeof value === 'string' && ACTIONS.includes(value as ActionKind);
const clamp01 = (value: unknown, fallback = 0.5): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
const safeGoalId = (value: unknown): string | null =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 256 &&
  value.trim() === value &&
  !/[\u0000-\u001f\u007f-\u009f]/u.test(value)
    ? value
    : null;

export interface InnerImperativeInput {
  tick: number;
  hasExternalRequest: boolean;
  spontaneous: boolean;
  proposedAction: ActionKind;
  selectedGoalId?: string | null;
  needs: {
    energy01: number;
    cognitiveLoad01: number;
    uncertainty01: number;
    novelty01: number;
    goalPressure01: number;
    socialNeed01: number;
  };
  embodiment: {
    awake: boolean;
    bodyEnergy01: number;
    cognitiveCapacity01: number;
    thermalStrain01: number;
  };
  predictionError01: number;
}

export interface InnerImperativeReceipt {
  id: string;
  source: InnerImperativeSource;
  motive: InnerImperativeMotive;
  reason: string;
  selectedGoalId: string | null;
  proposedAction: ActionKind;
  selectedAction: ActionKind;
  overridden: boolean;
  autonomous: boolean;
  confidence01: number;
  futureReviewRequired: boolean;
  resourceState: {
    energy01: number;
    bodyEnergy01: number;
    cognitiveCapacity01: number;
    cognitiveLoad01: number;
    uncertainty01: number;
    novelty01: number;
    goalPressure01: number;
    socialNeed01: number;
    thermalStrain01: number;
    predictionError01: number;
    awake: boolean;
  };
}

/**
 * Derive a bounded intention receipt from the existing organism state.
 *
 * This is a policy boundary, not a parallel goal generator: B272/B273 and the
 * canonical goal owner still generate/select goals. It only prevents an
 * autonomous, resource-expensive action when organism-level homeostasis says
 * the current capacity is constrained. Explicit user requests are not rewritten
 * here; the embodied action/recovery gates remain the final execution boundary.
 */
export function deriveInnerImperative(input: InnerImperativeInput): InnerImperativeReceipt {
  if (!isRecord(input)) throw new TypeError('inner-imperative-input-required');
  if (!Number.isSafeInteger(input.tick) || input.tick < 0) {
    throw new RangeError('inner-imperative-tick-must-be-a-non-negative-safe-integer');
  }
  if (!isAction(input.proposedAction)) throw new TypeError('inner-imperative-proposed-action-invalid');

  const needs = isRecord(input.needs) ? input.needs : {};
  const body = isRecord(input.embodiment) ? input.embodiment : {};
  const hasExternalRequest = input.hasExternalRequest === true;
  const spontaneous = input.spontaneous === true;
  const awake = body.awake === true;

  const energy01 = clamp01(needs.energy01);
  const bodyEnergy01 = clamp01(body.bodyEnergy01);
  const cognitiveCapacity01 = clamp01(body.cognitiveCapacity01);
  const cognitiveLoad01 = clamp01(needs.cognitiveLoad01);
  const uncertainty01 = clamp01(needs.uncertainty01);
  const novelty01 = clamp01(needs.novelty01);
  const goalPressure01 = clamp01(needs.goalPressure01);
  const socialNeed01 = clamp01(needs.socialNeed01);
  const thermalStrain01 = clamp01(body.thermalStrain01);
  const predictionError01 = clamp01(input.predictionError01);
  const effectiveEnergy01 = Math.min(energy01, bodyEnergy01);
  const autonomous = !hasExternalRequest && spontaneous;
  const futureReviewRequired = uncertainty01 >= 0.55 || predictionError01 >= 0.55;

  let source: InnerImperativeSource = hasExternalRequest
    ? 'external'
    : spontaneous ? 'endogenous' : 'continuity';
  let motive: InnerImperativeMotive = 'continuity';
  let reason = hasExternalRequest
    ? 'external-request-priority'
    : spontaneous ? 'continue-current-intention' : 'no-autonomous-pulse';
  let selectedAction = input.proposedAction;

  const criticalResourceFloor =
    !awake ||
    effectiveEnergy01 <= 0.12 ||
    cognitiveCapacity01 <= 0.14 ||
    thermalStrain01 >= 0.92 ||
    cognitiveLoad01 >= 0.96;
  const resourceConstrained =
    effectiveEnergy01 <= 0.22 ||
    cognitiveCapacity01 <= 0.24 ||
    thermalStrain01 >= 0.84 ||
    cognitiveLoad01 >= 0.90;
  const actionIsResourceIntensive = RESOURCE_INTENSIVE_ACTIONS.has(input.proposedAction);

  if (hasExternalRequest) {
    motive = 'external-response';
  } else if (!spontaneous) {
    motive = 'continuity';
  } else if (
    criticalResourceFloor ||
    (resourceConstrained && actionIsResourceIntensive)
  ) {
    motive = 'homeostatic';
    if (!awake) reason = 'sleep-boundary-defers-autonomous-action';
    else if (thermalStrain01 >= 0.84) reason = 'thermal-strain-needs-recovery';
    else if (cognitiveCapacity01 <= 0.24 || cognitiveLoad01 >= 0.90) reason = 'cognitive-capacity-needs-recovery';
    else if (effectiveEnergy01 <= 0.22) reason = 'energy-budget-needs-recovery';
    else reason = 'homeostatic-resource-floor';
    selectedAction = awake ? 'rest' : 'wait';
  } else if (resourceConstrained) {
    motive = 'homeostatic';
    reason = 'resource-pressure-recorded-without-action-override';
  } else if (uncertainty01 >= 0.68 || predictionError01 >= 0.68) {
    motive = 'epistemic-gap';
    reason = 'uncertainty-or-prediction-error-needs-review';
  } else if (goalPressure01 >= 0.72) {
    motive = 'unfinished-goal';
    reason = 'active-goal-pressure-needs-resolution';
  } else if (novelty01 >= 0.68) {
    motive = 'novelty-seeking';
    reason = 'novel-state-offers-information-gain';
  } else if (socialNeed01 >= 0.68) {
    motive = 'social-connection';
    reason = 'social-continuity-needs-attention';
  }

  const overridden = selectedAction !== input.proposedAction;
  const confidence01 = hasExternalRequest
    ? 0.95
    : overridden
      ? 0.88
      : motive === 'epistemic-gap' ? 0.66
      : motive === 'unfinished-goal' ? 0.64
      : motive === 'novelty-seeking' ? 0.60
      : motive === 'social-connection' ? 0.58
      : motive === 'homeostatic' ? 0.76
      : spontaneous ? 0.55 : 0.50;

  return {
    id: `inner-intent:${input.tick}`,
    source,
    motive,
    reason,
    selectedGoalId: safeGoalId(input.selectedGoalId),
    proposedAction: input.proposedAction,
    selectedAction,
    overridden,
    autonomous,
    confidence01,
    futureReviewRequired,
    resourceState: {
      energy01,
      bodyEnergy01,
      cognitiveCapacity01,
      cognitiveLoad01,
      uncertainty01,
      novelty01,
      goalPressure01,
      socialNeed01,
      thermalStrain01,
      predictionError01,
      awake,
    },
  };
}
