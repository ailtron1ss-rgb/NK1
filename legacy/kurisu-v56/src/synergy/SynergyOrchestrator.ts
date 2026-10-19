import { globalState, MetaTags } from './GlobalState';
import { internalClock } from './InternalClock';
import { neuroEngine } from '../cognitive/NeuroEngine';
import { aceMemory } from '../brain/AceMemory';
import { eventBus } from '../brain/eventBus';
import { logger } from '../services/logger';
import { powerGovernor } from '../services/powerGovernor';

export interface Priorities {
  empathy: number;
  logic: number;
  play: number;
  memory: number;
  avatar: number;
  voice: number;
}

function prioritiesFromContext(userMessage?: string): Priorities {
  const emo = neuroEngine.getEmotions();
  const msg = (userMessage || '').toLowerCase();
  const p: Priorities = {
    empathy: 0.4 + emo.sadness * 0.4,
    logic: 0.35,
    play: 0.3 + emo.happiness * 0.2,
    memory: 0.4,
    avatar: 0.5,
    voice: 0.4
  };
  if (/(устал|груст|плохо|одинок)/.test(msg)) {
    p.empathy += 0.35;
    p.play -= 0.1;
  }
  if (/(почему|как|докажи|план|логик)/.test(msg)) {
    p.logic += 0.4;
    p.memory += 0.15;
  }
  if (/(хах|шутк|прикол)/.test(msg)) {
    p.play += 0.35;
  }
  if (powerGovernor.preferCloudOnly()) {
    p.memory -= 0.05;
    p.avatar -= 0.1;
  }
  return p;
}

function driftTraits(tags: MetaTags) {
  const t = neuroEngine.getTraits();
  const d = 0.002;
  if (tags.valence > 0.3) {
    neuroEngine.setTraits({
      empathy: Math.min(1, t.empathy + d),
      playfulness: Math.min(1, t.playfulness + d * 0.5)
    });
  } else if (tags.valence < -0.4) {
    neuroEngine.setTraits({
      sarcasm: Math.min(1, t.sarcasm + d),
      empathy: Math.max(0, t.empathy + d * 0.3)
    });
  }
}

let loopStarted = false;
let lastIdleAct = 0;

export const synergyOrchestrator = {
  onPerceive(userMessage: string) {
    internalClock.tick();
    const pri = prioritiesFromContext(userMessage);
    const snap = globalState.snapshot();
    (window as any).__kurisuPriorities = pri;
    (window as any).__kurisuGlobal = snap;
    globalState.pushAction(`perceive:${userMessage.slice(0, 60)}`);
    eventBus.emit('user_message', { text: userMessage, priorities: pri as any });
    logger.debug('synergy perceive', pri.empathy);
    return pri;
  },

  onAct(userMessage: string, reply: string, tags?: Partial<MetaTags>) {
    const meta = globalState.tag({
      valence: /спасибо|рад|хорош/i.test(userMessage)
        ? 0.4
        : /зл|туп|кристин/i.test(userMessage)
          ? -0.5
          : 0,
      importance: reply.length > 80 ? 0.6 : 0.4,
      category: 'dialogue',
      ...tags
    });
    aceMemory.add('working', `U: ${userMessage.slice(0, 80)} | K: ${reply.slice(0, 80)}`, meta.valence, [
      meta.category,
      'dialogue'
    ]);
    if (Math.abs(meta.valence) > 0.35) {
      aceMemory.add('episodic', reply.slice(0, 160), meta.valence, ['salient']);
    }
    driftTraits(meta);
    globalState.pushAction(`reply:${reply.slice(0, 60)}`);
    eventBus.emit('kurisu_reply', { text: reply, meta: meta as any });
    return meta;
  },

  startStreamingLoop() {
    if (loopStarted || typeof window === 'undefined') return;
    loopStarted = true;
    const pulse = () => {
      try {
        internalClock.tick();
        const power = powerGovernor.get();
        (window as any).__kurisuPower = power;
        if (Date.now() - lastIdleAct > 10 * 60 * 1000 && power.mode === 'normal') {
          lastIdleAct = Date.now();
          aceMemory.add('micro', 'idle pulse — curiosity background', 0.05, ['idle']);
          eventBus.emit('low_attention', { reason: 'idle_pulse' });
        }
      } catch {
        /* */
      }
      setTimeout(pulse, 60000);
    };
    setTimeout(pulse, 15000);
    logger.info('synergy streaming loop on');
  },

  priorities(userMessage?: string) {
    return prioritiesFromContext(userMessage);
  }
};
