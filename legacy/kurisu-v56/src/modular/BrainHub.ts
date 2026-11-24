/**
 * Central hub — queries active modules, builds unified prompt slice + routing weights (MiCRo-style).
 */
import { moduleManager } from './ModuleManager';
import { HubContext, ModuleContribution } from './types';
import { registerBuiltinModules } from './builtinModules';
import { aceMemory } from './AceMemory';
import { neuroEngine } from '../cognitive/NeuroEngine';
import { logger } from '../services/logger';

let seeded = false;

export interface HubResult {
  contributions: ModuleContribution[];
  promptBlock: string;
  topExperts: string[];
  thoughtLines: string[];
}

export const brainHub = {
  ensureInit() {
    if (seeded) return;
    registerBuiltinModules();
    seeded = true;
    logger.info('BrainHub modules registered', moduleManager.list().length);
  },

  run(userMessage: string, stm: string[]): HubResult {
    this.ensureInit();
    const emo = neuroEngine.getEmotions();
    const ctx: HubContext = {
      userMessage,
      stm,
      emotions: emo as any
    };

    // ACE micro log
    aceMemory.add('micro', userMessage.slice(0, 160), 0, ['user']);

    const contributions: ModuleContribution[] = [];
    for (const m of moduleManager.activeContributors()) {
      try {
        const c = m.contribute!(ctx);
        if (c) contributions.push(c);
      } catch (e) {
        logger.warn('module fail ' + m.id, e);
        m.status = 'error';
      }
    }

    contributions.sort((a, b) => b.weight - a.weight);
    const top = contributions.slice(0, 4);
    const style = top.flatMap(c => c.styleHints).filter(Boolean);
    const notes = top.flatMap(c => c.notes.map(n => `[${c.moduleId}] ${n}`));
    const mem = top.flatMap(c => c.memoryHints).slice(0, 5);

    const ace = aceMemory.toPromptBlock(userMessage);
    const promptBlock = `[BRAIN HUB / MiCRo]
active experts: ${top.map(t => t.moduleId).join(', ')}
style: ${style.join('; ') || 'default Kurisu'}
notes:
${notes.slice(0, 8).map(n => '- ' + n).join('\n') || '- none'}
memory hints:
${mem.map(m => '- ' + m.slice(0, 100)).join('\n') || '- none'}

${ace}`;

    const thoughtLines = [
      `hub: experts ${top.map(t => t.moduleId).join('+')}`,
      ...notes.slice(0, 3)
    ];

    return {
      contributions,
      promptBlock,
      topExperts: top.map(t => t.moduleId),
      thoughtLines
    };
  }
};
