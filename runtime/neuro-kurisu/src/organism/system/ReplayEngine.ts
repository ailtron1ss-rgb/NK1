import type { OrganismDecisionTrace } from '../core/types.ts';

export interface ReplaySummary { input: number; selectedActions: Record<string, number>; autonomousDecisions: number; deterministicSignature: string; }

function signature(input: OrganismDecisionTrace[]): string {
  return input.map(t => `${t.tick}:${t.selected?.goalId ?? 'none'}:${t.selected?.action ?? 'none'}:${t.autonomousOverride ? 1 : 0}:${(t.selected?.confidence ?? 0).toFixed(3)}`).join('|');
}

export class ReplayEngine {
  summarize(traces: OrganismDecisionTrace[]): ReplaySummary {
    const selectedActions: Record<string, number> = {};
    let autonomousDecisions = 0;
    for (const t of traces) { const a = t.selected?.action ?? 'none'; selectedActions[a] = (selectedActions[a] ?? 0) + 1; if (t.autonomousOverride) autonomousDecisions += 1; }
    return { input: traces.length, selectedActions, autonomousDecisions, deterministicSignature: signature(traces) };
  }
}
