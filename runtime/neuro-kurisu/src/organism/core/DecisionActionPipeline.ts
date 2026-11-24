import type { IntentCandidate } from './types.ts';

export interface DecisionCandidateTrace {
  action: string;
  fullRaw: number;
  ablatedRaw: number;
  causalContribution: number;
}

export interface LearnedOutcomeEstimate {
  action: string;
  expectedReward01: number;
  confidence01: number;
  samples: number;
}

export interface EpistemicDecisionTrace {
  action: string;
  uncertainty01: number;
  novelty01: number;
  epistemicValue01: number;
  learnability01: number;
  cost01: number;
  adjustment: number;
}

export interface RankedDecision {
  candidates: IntentCandidate[];
  trace: DecisionCandidateTrace[];
  rehearsal: Array<{ action: string; expectedReward01: number; confidence01: number; adjustment: number }>;
  epistemic: EpistemicDecisionTrace[];
}

export class DecisionActionPipeline {
  private lastRehearsal: Array<{ action: string; expectedReward01: number; confidence01: number; adjustment: number }> = [];
  private lastEpistemic: EpistemicDecisionTrace[] = [];
  rank(candidates: IntentCandidate[], trace: DecisionCandidateTrace[] = [], learned: LearnedOutcomeEstimate[] = [], context: { epistemicPressure01?: number; cognitiveLoad01?: number; externalRequested?: boolean } = {}): RankedDecision {
    const byAction = new Map(learned.map(item => [item.action, item]));
    const sortedCurrent = [...candidates].sort((a, b) => b.score - a.score);
    const topScore = sortedCurrent[0]?.score ?? 0;
    const secondScore = sortedCurrent[1]?.score ?? 0;
    const closeSet = new Set(sortedCurrent.filter(c => topScore - c.score <= .055).map(c => c.action));
    const rehearsal = sortedCurrent.map(candidate => {
      const estimate = byAction.get(candidate.action);
      if (!estimate || !closeSet.has(candidate.action) || estimate.samples < 3 || estimate.confidence01 < .58) {
        return { action: candidate.action, expectedReward01: estimate?.expectedReward01 ?? .5, confidence01: estimate?.confidence01 ?? 0, adjustment: 0 };
      }
      const valueSignal = (estimate.expectedReward01 - .5) * 2;
      const adjustment = Math.max(-.032, Math.min(.032, valueSignal * estimate.confidence01 * .032));
      candidate.score += adjustment;
      candidate.predictedUtility = Math.max(0, Math.min(1, candidate.predictedUtility + adjustment * .60));
      return { action: candidate.action, expectedReward01: estimate.expectedReward01, confidence01: estimate.confidence01, adjustment };
    });
    // B346: knowledge-seeking arbitration. The organism can prefer actions that
    // reduce uncertainty when internal epistemic pressure is high. This is derived
    // from its own outcome history rather than from an action-specific constant.
    const epistemicPressure = Math.max(0, Math.min(1, context.epistemicPressure01 ?? 0));
    const cognitiveLoad = Math.max(0, Math.min(1, context.cognitiveLoad01 ?? 0));
    const externalRequested = Boolean(context.externalRequested);
    const epistemic = sortedCurrent.map(candidate => {
      const estimate = byAction.get(candidate.action);
      const confidence01 = estimate?.confidence01 ?? 0;
      const samples = estimate?.samples ?? 0;
      const uncertainty01 = Math.max(0, Math.min(1, 1 - confidence01));
      const novelty01 = Math.max(0, Math.min(1, 1 - Math.min(1, samples / 12)));
      const candidateConfidence01 = Math.max(0, Math.min(1, candidate.confidence ?? .5));
      const cost01 = Math.max(0, Math.min(1, candidate.predictedCost ?? .5));
      const learnability01 = Math.max(0, Math.min(1, (1 - candidateConfidence01) * (.55 + .45 * novelty01)));
      const informationOpportunity01 = Math.max(0, Math.min(1, uncertainty01 * (.35 + .65 * novelty01) * (.65 + .35 * learnability01) * (1 - .40 * cost01)));
      const gate = externalRequested ? 0 : Math.max(0, Math.min(1, epistemicPressure * (1 - cognitiveLoad * .55)));
      const epistemicValue01 = informationOpportunity01 * gate;
      const adjustment = Math.max(0, Math.min(.018, epistemicValue01 * .018));
      candidate.score += adjustment;
      candidate.predictedUtility = Math.max(0, Math.min(1, candidate.predictedUtility + adjustment * .45));
      return { action: candidate.action, uncertainty01, novelty01, epistemicValue01, learnability01, cost01, adjustment };
    });
    const ranked = [...candidates].sort((a, b) => b.score - a.score);
    this.lastRehearsal = rehearsal.map(x => ({ ...x }));
    this.lastEpistemic = epistemic.map(x => ({ ...x }));
    return { candidates: ranked, trace: trace.map((item) => ({ ...item })), rehearsal, epistemic };
  }

  diagnostics(){
    return { version:2, lastRehearsal:this.lastRehearsal.map(x=>({...x})), lastEpistemic:this.lastEpistemic.map(x=>({...x})), activeCount:this.lastRehearsal.filter(x=>Math.abs(x.adjustment)>.0001).length, epistemicActiveCount:this.lastEpistemic.filter(x=>x.adjustment>.0001).length };
  }

  top(trace: DecisionCandidateTrace[], field: 'fullRaw' | 'ablatedRaw'): string | null {
    if (!trace.length) return null;
    return [...trace].sort((a, b) => b[field] - a[field])[0]?.action ?? null;
  }

  lesionChangesAction(trace: DecisionCandidateTrace[]): boolean {
    return this.top(trace, 'fullRaw') !== this.top(trace, 'ablatedRaw');
  }
}
