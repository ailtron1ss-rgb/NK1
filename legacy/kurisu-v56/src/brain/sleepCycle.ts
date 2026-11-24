/**
 * Multi-stage sleep: light → deep consolidation → REM-like association → wake.
 */

import { memoryEngine } from '../services/memoryEngine';
import { desireAndPromiseStore } from '../cognitive/DesireAndPromiseStore';
import { consciousnessCore } from '../cognitive/ConsciousnessCore';
import { neuralPathways } from '../psyche/NeuralPathwayGraph';
import { emotionAffect } from '../psyche/EmotionAffectSystem';
import { perceptionModel } from '../psyche/PerceptionModel';
import { personalityCore } from '../psyche/PersonalityCore';
import { attentionEconomy } from './attentionEconomy';
import { eventBus } from './eventBus';
import { dailyPlan } from './dailyPlan';
import { sleepDreamEngine } from '../cognitive/SleepDreamEngine';

export type SleepStage = 'light' | 'deep' | 'rem' | 'wake';

export interface SleepReport {
  at: number;
  stages: { stage: SleepStage; detail: string }[];
  memory: { consolidatedCount: number; neuralPathwaysCreated: number };
  pathways: { boosted: number; pruned: number; newBridges: number };
  openPromises: string[];
  morningQuestion: string;
  daySummary: string;
  wakeLine: string;
}

export function runSleepCycle(): SleepReport {
  const stages: SleepReport['stages'] = [];
  perceptionModel.setChannel('sleep');
  eventBus.emit('night', { phase: 'start' });

  // LIGHT — surface review
  stages.push({
    stage: 'light',
    detail: 'Сброс острого аффекта, подготовка к консолидации'
  });
  emotionAffect.onSleep();

  // DEEP — memory consolidate
  const mem = memoryEngine.consolidateMemories();
  stages.push({
    stage: 'deep',
    detail: `Память: ${mem.consolidatedCount} записей, pathways flags: ${mem.neuralPathwaysCreated}`
  });

  // REM — associative bridges
  const pathways = neuralPathways.consolidateDuringSleep();
  const dream = sleepDreamEngine.run();
  stages.push({
    stage: 'rem',
    detail: `Связи: +boost ${pathways.boosted}, prune ${pathways.pruned}, bridges ${pathways.newBridges}; dream rehearsal ${dream.rehearsals}`
  });

  // mild personality drift after sleep (lab mind resets)
  personalityCore.drift({ rigor: 0.3, curiosity: 0.4, caution: -0.2 });

  const open = desireAndPromiseStore.openPromises().map(p => p.text);
  const top = desireAndPromiseStore.topDesire();
  let daySummary = 'День закрыт.';
  try {
    daySummary = `Рефлексия: ${consciousnessCore.buildCognitiveContextBlock().slice(0, 220)}`;
  } catch { /* */ }

  const morningQuestion = top
    ? `Утром: желание «${top.text}» ещё в силе?`
    : open[0]
      ? `Утром: обещание «${open[0]}» — что с ним?`
      : 'Утром: что сегодня важнее — теория или ты?';

  attentionEconomy.refillDemo();
  dailyPlan.refresh();

  const wakeLine = [
    'Я снова здесь.',
    pathways.newBridges > 0 ? `Во сне сомкнулось ${pathways.newBridges} новых связей.` : 'Сон был тихим.',
    morningQuestion
  ].join(' ');

  stages.push({ stage: 'wake', detail: wakeLine });

  try {
    memoryEngine.addLongTermMemory(
      'episodic',
      `[Сон|deep+rem] ${daySummary} | bridges=${pathways.newBridges} | ${morningQuestion}`,
      'sleep_cycle',
      7
    );
  } catch { /* */ }

  try { localStorage.setItem('kurisu_post_sleep_wake', wakeLine); } catch { /* */ }
  perceptionModel.setChannel('chat');
  eventBus.emit('night', { phase: 'wake' });

  return {
    at: Date.now(),
    stages,
    memory: mem,
    pathways,
    openPromises: open,
    morningQuestion,
    daySummary,
    wakeLine
  };
}
