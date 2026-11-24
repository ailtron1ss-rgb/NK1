/**
 * Micro-dream — speculative offline thoughts, NOT spoken as facts.
 * Stored as reflection category with low confidence tag.
 */

import { memoryEngine } from '../services/memoryEngine';
import { attentionEconomy } from './attentionEconomy';
import { getLabShift } from './labClock';

const DREAMS = [
  'Гипотеза: если память — сжатие, то сны — пересжатие с шумом… интересно.',
  'Надо бы проверить, не путаю ли я его привычки с желаемым сценарием.',
  'Аттракторное поле разговора сегодня странное. Или это просто недосып.',
  'Если он исчезнет надолго — что останется в stone-памяти? Жёсткий вопрос.',
  'Dr. Pepper закончился бы в настоящей лаборатории. Здесь хотя бы метафора цела.'
];

export function maybeMicroDream(curiosity: number): string | null {
  if (curiosity < 55) return null;
  if (!attentionEconomy.can('dream')) return null;
  if (Math.random() > 0.08) return null;
  attentionEconomy.spend('dream');
  const line = DREAMS[Math.floor(Math.random() * DREAMS.length)];
  const shift = getLabShift();
  try {
    memoryEngine.addLongTermMemory(
      'reflection',
      `[micro-dream|${shift}|low_conf] ${line}`,
      'dream',
      3
    );
  } catch { /* */ }
  return line;
}
