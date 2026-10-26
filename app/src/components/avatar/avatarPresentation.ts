import type { ActionKind } from "@/organism/types";

export interface AvatarGaze {
  x: number;
  y: number;
}

const GAZE_BY_ACTION: Record<ActionKind, AvatarGaze> = {
  explore: { x: 0.24, y: 0.04 },
  verify: { x: 0.14, y: -0.10 },
  reflect: { x: -0.19, y: -0.14 },
  respond: { x: 0.01, y: 0.01 },
  wait: { x: -0.035, y: -0.005 },
  rest: { x: -0.06, y: 0.075 },
};

const clamp = (value: number, low: number, high: number, fallback: number): number =>
  Math.max(low, Math.min(high, Number.isFinite(value) ? value : fallback));

/** Action/valence → gaze shared by Live2D intent and the original SVG. */
export function deriveAvatarGaze(action: ActionKind, valence: number): AvatarGaze {
  const base = GAZE_BY_ACTION[action] ?? GAZE_BY_ACTION.wait;
  const boundedValence = clamp(valence, 0, 1, 0.5);
  return {
    x: clamp(base.x + (boundedValence - 0.5) * 0.16, -0.4, 0.4, base.x),
    y: clamp(base.y, -0.4, 0.4, 0),
  };
}
