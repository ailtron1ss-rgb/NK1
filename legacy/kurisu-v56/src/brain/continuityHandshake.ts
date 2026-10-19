/**
 * Continuity handshake — on startup Kurisu "wakes" with memory of user.
 */

import { memoryEngine } from '../services/memoryEngine';
import { desireAndPromiseStore } from '../cognitive/DesireAndPromiseStore';
import { dailyPlan } from './dailyPlan';
import { narrativeLog } from './narrativeLog';
import { getLabShift, labShiftStyleHint } from './labClock';

export function buildWakeMessage(): string {
  const shift = getLabShift();
  const plan = dailyPlan.get();
  const open = desireAndPromiseStore.openPromises().slice(0, 2);
  const topMem = memoryEngine.retrieveRanked('пользователь отношения лаборатория', 3);
  const memBit = topMem[0]?.content?.slice(0, 90);

  const parts: string[] = [];
  parts.push(labShiftStyleHint(shift).replace('Смена:', 'Снова на связи.').slice(0, 80));

  if (memBit) {
    parts.push(`Из памяти: ${memBit}${memBit.length >= 90 ? '…' : ''}`);
  } else {
    parts.push('Память о тебе пока тонкая — не жди телепатии.');
  }

  if (open.length) {
    parts.push(`Открыто: ${open.map(p => p.text).join('; ')}`);
  }

  const todo = plan.items.find(i => !i.done);
  if (todo) {
    parts.push(`Сегодня себе: ${todo.text}`);
  }

  const narr = narrativeLog.recent(1)[0];
  if (narr) parts.push(`Последнее: ${narr}`);
  parts.push('Ну. Говори.');
  return parts.join(' ');
}
