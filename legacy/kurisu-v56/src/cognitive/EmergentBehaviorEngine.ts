/** Lightweight emergent behavior scheduler. No background loop; called opportunistically. */
import { readJson, writeJson } from './StateVault';
import { maybeMicroDream } from '../brain/microDream';
import { coreEnhancementHub } from './CoreEnhancementHub';

const KEY = 'kurisu_emergent_behavior_v1';
interface State { lastCreativeAt: number; lastDreamAt: number; creativeCount: number; }
const fresh = (): State => ({ lastCreativeAt: 0, lastDreamAt: 0, creativeCount: 0 });
function load() { return readJson<State>(KEY, fresh()); }
function save(s: State) { writeJson(KEY, s); }

export const emergentBehavior = {
  maybeIdle(curiosity: number, idleMs: number): string | null {
    const s = load();
    const now = Date.now();
    if (idleMs < 5 * 60_000) return null;
    if (now - s.lastDreamAt > 45 * 60_000) {
      const dream = maybeMicroDream(curiosity);
      if (dream) { s.lastDreamAt = now; save(s); return dream; }
    }
    if (curiosity > 72 && now - s.lastCreativeAt > 90 * 60_000 && Math.random() < 0.12) {
      s.lastCreativeAt = now; s.creativeCount++; save(s);
      const hints = coreEnhancementHub.styleHint();
      return hints.avgLength > 260
        ? 'У меня появилась странная гипотеза. Если хочешь, могу развернуть её и попробовать найти слабое место.'
        : 'Мне пришла одна странная мысль. Хочешь, поделюсь?';
    }
    return null;
  },
  snapshot() { return load(); }
};
