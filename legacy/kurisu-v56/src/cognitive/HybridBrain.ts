/** Hybrid Brain: deterministic controls + neural/cloud generation. */
import { moduleManager } from '../brain/ModuleManager';

export type CognitiveBackend = 'rules' | 'neural' | 'cloud';
export interface HybridDecision {
  backend: CognitiveBackend;
  confidence: number;
  reasons: string[];
}

export const hybridBrain = {
  choose(input: { offline: boolean; localReady: boolean; cloudReady: boolean; complexity: number; energy: 'eco'|'balanced'|'full' }): HybridDecision {
    const reasons: string[] = [];
    if (input.offline) {
      if (input.localReady) { reasons.push('offline-local'); return { backend: 'neural', confidence: 0.72, reasons }; }
      reasons.push('offline-no-local'); return { backend: 'rules', confidence: 0.35, reasons };
    }
    if (input.energy === 'eco' && input.complexity < 45 && input.localReady) {
      reasons.push('eco-local'); return { backend: 'neural', confidence: 0.68, reasons };
    }
    if (input.cloudReady) {
      reasons.push('cloud-quality');
      return { backend: 'cloud', confidence: input.complexity > 70 ? 0.9 : 0.78, reasons };
    }
    if (input.localReady) { reasons.push('local-fallback'); return { backend: 'neural', confidence: 0.65, reasons }; }
    reasons.push('rule-fallback'); return { backend: 'rules', confidence: 0.3, reasons };
  },
  modules() { return moduleManager.list(); }
};
