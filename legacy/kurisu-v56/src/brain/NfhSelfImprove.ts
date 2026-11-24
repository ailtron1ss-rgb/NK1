/**
 * NFH-inspired dual-role self-improvement:
 * Generator proposes, Evaluator scores blindly, user approves.
 * Does NOT auto-write source files — config/prompt snapshots only.
 */

import { selfImprovementEngine } from '../cognitive/SelfImprovementEngine';
import { moduleManager } from './ModuleManager';
import { logger } from '../services/logger';
import { brainHub } from './BrainHub';
import { aceMemory } from './AceMemory';

export interface NfhReport {
  generatorNotes: string[];
  evaluatorScore: number;
  evaluatorNotes: string[];
  proposalIds: string[];
  hubStatus: ReturnType<typeof brainHub.status>;
}

export const nfhSelfImprove = {
  /**
   * Run one improvement cycle (safe): propose + evaluate, never auto-apply.
   */
  async cycle(): Promise<NfhReport> {
    if (!moduleManager.isEnabled('self_improve')) {
      return {
        generatorNotes: ['module self_improve disabled'],
        evaluatorScore: 0,
        evaluatorNotes: [],
        proposalIds: [],
        hubStatus: brainHub.status()
      };
    }

    const generatorNotes: string[] = [];
    const evaluatorNotes: string[] = [];

    // Generator: inspect hub + ace sizes
    const st = brainHub.status();
    generatorNotes.push(`modules on: ${st.modules.join(', ')}`);
    generatorNotes.push(
      `ace sizes persona=${st.ace.persona} episodic=${st.ace.episodic} working=${st.ace.working}`
    );

    if (st.ace.working > 15) {
      generatorNotes.push('Propose: consolidate ACE working → episodic');
      brainHub.consolidateMemory();
      generatorNotes.push('Applied safe consolidate (memory only, no code)');
    }

    // Use existing engine for formal proposals if available
    let proposalIds: string[] = [];
    try {
      const proposals = await (selfImprovementEngine as any).propose?.() 
        || (selfImprovementEngine as any).generateProposals?.()
        || [];
      if (Array.isArray(proposals)) {
        proposalIds = proposals.map((p: any) => p.id || p.title).slice(0, 5);
        generatorNotes.push(`engine proposals: ${proposalIds.length}`);
      }
    } catch (e) {
      generatorNotes.push('SelfImprovementEngine propose unavailable — hub-only cycle');
      logger.warn('nfh propose', e);
    }

    // Evaluator (blind-ish): score based on structure not "intent"
    let score = 0.5;
    if (st.modules.includes('neuro')) score += 0.1;
    if (st.modules.includes('ace_memory')) score += 0.1;
    if (st.ace.episodic > 0) score += 0.1;
    if (st.ace.working < 25) score += 0.1;
    else {
      score -= 0.1;
      evaluatorNotes.push('working memory high — consolidation recommended');
    }
    evaluatorNotes.push(`score=${score.toFixed(2)} (no auto code edit)`);

    // Persona micro-log
    aceMemory.add(
      'persona',
      `Self-cycle: score ${score.toFixed(2)}; modules ${st.modules.length}`,
      0.2,
      ['self', 'nfh']
    );

    return {
      generatorNotes,
      evaluatorScore: score,
      evaluatorNotes,
      proposalIds,
      hubStatus: st
    };
  }
};
