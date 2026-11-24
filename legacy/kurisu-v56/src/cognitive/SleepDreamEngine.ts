/**
 * Sleep/Dream rehearsal layer.
 *
 * It creates small synthetic rehearsal prompts from recent memories instead of
 * performing on-device gradient training. This keeps RAM/battery bounded.
 */
import { memoryEngine } from '../services/memoryEngine';
import { continuumMemory } from './ContinuumMemory';
import { alasLearning } from './ALASLearning';
import { readJson, writeJson } from './StateVault';

const KEY = 'kurisu_dream_rehearsal_v1';

export interface DreamRehearsal {
  at: number;
  prompt: string;
  memoryIds: string[];
  quality: number;
}

export const sleepDreamEngine = {
  run(now = Date.now()) {
    const recent = memoryEngine.getAllMemories().slice(-24);
    const selected = recent
      .filter(m => (m.emotionalWeight || 0) >= 6 || (m.accessCount || 0) >= 2)
      .slice(-8);
    const cues = selected.map(m => m.content.slice(0, 180));
    if (!cues.length) return { rehearsals: 0, lessons: 0 };
    const prompt = `Свяжи эти воспоминания в один урок без выдумывания фактов:\n${cues.join('\n— ')}`;
    continuumMemory.merge(cues, 'episodic', 0.7);
    const lesson = alasLearning.capture(
      'Как сохранить полезный смысл этого опыта?',
      `Нужно удержать устойчивые факты и контекст, а не запоминать случайные формулировки. Материалы: ${cues.join(' | ')}`,
      0.62
    );
    const item: DreamRehearsal = { at: now, prompt, memoryIds: selected.map(m => m.id), quality: 0.62 };
    const prev = readJson<DreamRehearsal[]>(KEY, []);
    writeJson(KEY, [item, ...prev].slice(0, 20));
    return { rehearsals: 1, lessons: lesson ? 1 : 0 };
  },

  recent() { return readJson<DreamRehearsal[]>(KEY, []).slice(0, 12); }
};
