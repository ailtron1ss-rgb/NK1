import type { ActionKind, EmotionLabel, MemoryRecord, Needs } from "./types";

export interface WorkspaceContent {
  selected: string[];
  broadcast: Record<string, string>;
}

/** One global workspace. Coalitions compete; winner is broadcast. Capacity 4. */
export function ignite(input: {
  observation: string;
  memories: MemoryRecord[];
  needs: Needs;
  emotion: EmotionLabel;
  predictionError: number;
  option: ActionKind;
  inner: string;
}): WorkspaceContent {
  const candidates: Array<{ id: string; w: number; text: string }> = [
    { id: "obs", w: 0.9, text: input.observation.slice(0, 160) },
    { id: "emotion", w: 0.35 + (input.emotion === "calm" ? 0 : 0.25), text: `emotion:${input.emotion}` },
    { id: "error", w: input.predictionError, text: `pe=${input.predictionError.toFixed(3)}` },
    { id: "energy", w: Math.abs(input.needs.energy - 0.72), text: `energy=${input.needs.energy.toFixed(2)}` },
    { id: "social", w: input.needs.socialNeed, text: `socialNeed=${input.needs.socialNeed.toFixed(2)}` },
    { id: "option", w: 0.4, text: `option=${input.option}` },
    { id: "inner", w: 0.3, text: input.inner.slice(0, 120) },
    ...input.memories.slice(0, 4).map((m, i) => ({
      id: `mem:${m.id}`,
      w: 0.28 + m.salience * 0.4,
      text: m.text.slice(0, 100),
    })),
  ];
  candidates.sort((a, b) => b.w - a.w);
  const selected = candidates.slice(0, 4);
  const broadcast: Record<string, string> = {};
  for (const c of selected) broadcast[c.id] = c.text;
  return { selected: selected.map((c) => c.id), broadcast };
}
