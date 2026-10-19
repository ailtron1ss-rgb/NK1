import { eventBus } from '../brain/eventBus';
import { globalState } from './GlobalState';
import { neuroEngine } from '../cognitive/NeuroEngine';
import { aceMemory } from '../brain/AceMemory';
import { logger } from '../services/logger';

const START_KEY = 'kurisu_life_start_v1';
const LAST_REFLECT = 'kurisu_last_reflect_v1';

function lifeStart() {
  try {
    let s = localStorage.getItem(START_KEY);
    if (!s) {
      s = String(Date.now());
      localStorage.setItem(START_KEY, s);
    }
    return Number(s);
  } catch {
    return Date.now();
  }
}

export const internalClock = {
  ageMs() {
    return Date.now() - lifeStart();
  },
  ageHours() {
    return this.ageMs() / 3600000;
  },
  tick() {
    const n = globalState.bumpTick();
    neuroEngine.getEmotions();
    try {
      const last = Number(localStorage.getItem(LAST_REFLECT) || '0');
      if (Date.now() - last > 3600000) {
        localStorage.setItem(LAST_REFLECT, String(Date.now()));
        this.reflect();
      }
    } catch {
      /* */
    }
    eventBus.emit('hub_tick' as any, { tick: n, ageH: this.ageHours() });
    return n;
  },
  reflect() {
    try {
      aceMemory.consolidate?.();
      aceMemory.add(
        'episodic',
        `Self-reflection @${new Date().toISOString().slice(0, 16)}: tick ${globalState.snapshot().internalTick}`,
        0.1,
        ['reflect', 'self']
      );
      logger.info('hourly reflect');
      eventBus.emit('synergy_reflect' as any, { at: Date.now() });
    } catch (e) {
      logger.warn('reflect fail', e);
    }
  }
};
