/**
 * Central Hub — orchestrates modular brain departments (Neuro-sama style ecosystem).
 * Pipeline: input → modules → aggregated prompt context → (LLM outside) → post-actions.
 */

import { neuroEngine, NeuroDecision } from '../cognitive/NeuroEngine';
import { aceMemory } from './AceMemory';
import { activateExperts, expertsPromptBlock, ExpertVote } from './MicroExperts';
import { moduleManager } from './ModuleManager';
import { eventBus } from './eventBus';
import { logger } from '../services/logger';

export interface HubPacket {
  neuro?: NeuroDecision;
  experts: ExpertVote[];
  aceBlock: string;
  expertsBlock: string;
  neuroBlock: string;
  thoughtTrace: string[];
  expressionHint: string;
  motionHint: string;
}

class BrainHub {
  /**
   * Run modular pipeline before LLM generation.
   */
  processInput(userMessage: string): HubPacket {
    const thoughts: string[] = [];
    thoughts.push('hub: receive input');

    let neuro: NeuroDecision | undefined;
    let neuroBlock = '';
    let expressionHint = 'neutral';
    let motionHint = 'Idle';

    if (moduleManager.isEnabled('neuro')) {
      neuro = neuroEngine.decide(userMessage, []);
      neuroBlock = neuro.promptBlock;
      expressionHint = neuro.expressionHint;
      motionHint = neuro.motionHint;
      thoughts.push(...neuro.thoughtTrace);
    } else {
      thoughts.push('hub: neuro disabled');
    }

    let experts: ExpertVote[] = [];
    let expertsBlock = '';
    if (moduleManager.isEnabled('micro_experts')) {
      experts = activateExperts(userMessage);
      expertsBlock = expertsPromptBlock(experts);
      thoughts.push(`experts: ${experts[0]?.id}/${experts[1]?.id}`);
    }

    let aceBlock = '';
    if (moduleManager.isEnabled('ace_memory')) {
      aceMemory.add('micro', `user: ${userMessage.slice(0, 120)}`, 0, ['turn']);
      aceMemory.add('working', userMessage.slice(0, 200), 0, ['stm']);
      aceBlock = aceMemory.toPromptBlock(userMessage);
      thoughts.push('ace: retrieved');
    }

    try {
      window.dispatchEvent(
        new CustomEvent('kurisu-neuro-thought', {
          detail: { thoughts: thoughts.slice(0, 6), frame: neuro?.frame }
        })
      );
      (window as any).__kurisuNeuro = neuro;
      (window as any).__kurisuHub = { experts, expressionHint };
    } catch {
      /* */
    }

    eventBus.emit('hub_tick' as any, { experts: experts.map(e => e.id) });
    logger.debug('hub process', experts[0]?.id);

    return {
      neuro,
      experts,
      aceBlock,
      expertsBlock,
      neuroBlock,
      thoughtTrace: thoughts,
      expressionHint,
      motionHint
    };
  }

  /** After reply — write episodic if emotional */
  afterReply(userMessage: string, reply: string, valence = 0) {
    if (!moduleManager.isEnabled('ace_memory')) return;
    aceMemory.add('working', `kurisu: ${reply.slice(0, 200)}`, valence, ['reply']);
    if (Math.abs(valence) > 0.35 || reply.length > 120) {
      aceMemory.add(
        'episodic',
        `Диалог: «${userMessage.slice(0, 60)}» → «${reply.slice(0, 80)}»`,
        valence,
        ['dialogue']
      );
    }
  }

  consolidateMemory() {
    if (!moduleManager.isEnabled('ace_memory')) return { promoted: 0 };
    return aceMemory.consolidate();
  }

  status() {
    return {
      modules: moduleManager.list().filter(m => m.enabled).map(m => m.id),
      ace: aceMemory.snapshot()
    };
  }
}

export const brainHub = new BrainHub();
