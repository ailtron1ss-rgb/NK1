/**
 * Sleep / night consolidation — batch job, not continuous dreaming.
 */

import { memoryEngine } from '../services/memoryEngine';
import { desireAndPromiseStore } from '../cognitive/DesireAndPromiseStore';
import { consciousnessCore } from '../cognitive/ConsciousnessCore';

export interface SleepReport {
  at: number;
  memory: { consolidatedCount: number; neuralPathwaysCreated: number };
  openPromises: string[];
  morningQuestion: string;
  daySummary: string;
}

export function runSleepCycle(): SleepReport {
  const mem = memoryEngine.consolidateMemories();
  const open = desireAndPromiseStore.openPromises().map(p => p.text);
  const top = desireAndPromiseStore.topDesire();
  let daySummary = 'День закрыт. Память прорежена, важные пути сохранены.';
  try {
    const block = consciousnessCore.buildCognitiveContextBlock();
    daySummary = `Рефлексия: ${block.slice(0, 280)}`;
  } catch { /* optional */ }

  const morningQuestion = top
    ? `Утром: всё ещё актуально желание «${top.text}»?`
    : open[0]
      ? `Утром: что с обещанием «${open[0]}»?`
      : 'Утром: что для тебя сейчас важнее всего в нашем проекте?';

  try {
    memoryEngine.addLongTermMemory(
      'episodic',
      `[Сон] ${daySummary} | Вопрос: ${morningQuestion}`,
      'sleep_cycle',
      6
    );
  } catch { /* */ }

  return {
    at: Date.now(),
    memory: mem,
    openPromises: open,
    morningQuestion,
    daySummary
  };
}
