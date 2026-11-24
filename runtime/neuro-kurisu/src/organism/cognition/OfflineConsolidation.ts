import type { ConsolidatedMemory, OrganismDecisionTrace, OrganismGoal } from '../core/types.ts';

export interface ConsolidationResult {
  memories: ConsolidatedMemory[];
  goalUpdates: Array<{ id: string; confidenceDelta: number; progressDelta: number; reason: string }>;
  selfModel: { preferredActions: Record<string, number>; overrideRate: number; predictedActionAccuracy: number };
}

export class OfflineConsolidation {
  run(traces: OrganismDecisionTrace[], goals: OrganismGoal[]): ConsolidationResult {
    const selected = traces.filter(t => t.selected);
    const counts: Record<string, number> = {};
    let overrides = 0;
    let predictedCorrect = 0;
    let predictedTotal = 0;

    for (const t of selected) {
      const action = t.selected!.action;
      counts[action] = (counts[action] ?? 0) + 1;
      if (t.autonomousOverride) overrides += 1;
      const predicted = t.stateBefore.predictedNextAction;
      if (predicted !== 'none') { predictedTotal += 1; if (predicted === action) predictedCorrect += 1; }
    }

    const total = Math.max(1, selected.length);
    const memories: ConsolidatedMemory[] = [];
    if (selected.length) {
      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none';
      memories.push({
        id: `episode-${Date.now()}`,
        kind: 'episode',
        summary: `Consolidated ${selected.length} decision cycles; dominant action=${dominant}`,
        salience: Math.min(1, selected.length / 40),
        evidence: selected.slice(0, 12).map(t => `${t.tick}:${t.selected?.action ?? 'none'}:${t.autonomousOverride ? 'override' : 'follow'}`),
        createdAt: Date.now(),
      });
    }
    if (overrides) {
      memories.push({
        id: `agency-${Date.now()}`,
        kind: 'self-model',
        summary: `Autonomous override observed in ${(overrides / total * 100).toFixed(1)}% of cycles with an external request.`,
        salience: Math.min(1, overrides / 6),
        evidence: selected.filter(t => t.autonomousOverride).slice(0, 12).map(t => `tick=${t.tick}`),
        createdAt: Date.now(),
      });
    }
    if (predictedTotal) {
      memories.push({
        id: `self-prediction-${Date.now()}`,
        kind: 'self-model',
        summary: `Self-prediction accuracy over ${predictedTotal} evaluable cycles: ${(predictedCorrect / predictedTotal * 100).toFixed(1)}%.`,
        salience: 0.7,
        evidence: selected.filter(t => t.stateBefore.predictedNextAction !== 'none').slice(0, 12).map(t => `${t.tick}:pred=${t.stateBefore.predictedNextAction},actual=${t.selected?.action}`),
        createdAt: Date.now(),
      });
    }

    const goalUpdates = goals.filter(g => g.status === 'active' || g.status === 'candidate').map(g => {
      const related = selected.filter(t => t.selected?.goalId === g.id);
      const progressDelta = related.length ? Math.min(0.08, related.length * 0.01) : 0;
      return { id: g.id, confidenceDelta: related.length ? 0.02 : 0, progressDelta, reason: related.length ? `replayed ${related.length} decisions linked to goal` : 'no supporting episodes' };
    });

    return {
      memories,
      goalUpdates,
      selfModel: {
        preferredActions: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / total])),
        overrideRate: overrides / total,
        predictedActionAccuracy: predictedTotal ? predictedCorrect / predictedTotal : 0,
      },
    };
  }
}
