import type { ActionKind } from './types.ts';

/** Single canonical action-cost table shared by policy learning and live action scoring. */
export const ACTION_COSTS: Readonly<Record<ActionKind, number>> = Object.freeze({
  respond: 0.18,
  explore: 0.42,
  verify: 0.36,
  rest: 0.05,
  reflect: 0.22,
  wait: 0.02,
  defer: 0.08,
});

export function actionCost(action: ActionKind): number {
  return ACTION_COSTS[action];
}
