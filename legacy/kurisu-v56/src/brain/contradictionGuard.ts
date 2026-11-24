/**
 * Light contradiction guard — flags when user statement conflicts with stone/high-weight memory.
 */

import { memoryEngine } from '../services/memoryEngine';
import { eventBus } from './eventBus';

const NEG = /(не|нет|никогда|неправда|ошиб)/;

export function checkUserContradiction(userMessage: string): string | null {
  const ranked = memoryEngine.retrieveRanked(userMessage, 4);
  const msg = userMessage.toLowerCase();
  for (const m of ranked) {
    if ((m.emotionalWeight || 0) < 7 && m.retentionPriority !== 'neural_pathway') continue;
    const content = m.content.toLowerCase();
    // naive: memory asserts X, user says not X with shared tokens
    const memTokens = content.split(/\s+/).filter(t => t.length > 4).slice(0, 6);
    const overlap = memTokens.filter(t => msg.includes(t));
    if (overlap.length >= 2 && NEG.test(msg) && !NEG.test(content)) {
      eventBus.emit('contradiction', { memory: m.content.slice(0, 120), user: userMessage.slice(0, 120) });
      return `Ранее в памяти: «${m.content.slice(0, 100)}». Ты сейчас как будто отрицаешь это — уточни.`;
    }
  }
  return null;
}
