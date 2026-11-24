/**
 * Context Packet v4/v7 — ranked memory + self-model + promises + goals.
 */

import { EmotionalState, MemoryItem } from '../types';
import { memoryEngine } from './memoryEngine';
import { personalityRewardSystem } from '../cognitive/PersonalityRewardSystem';
import { presenceAndIdle } from '../cognitive/PresenceAndIdle';
import { desireAndPromiseStore } from '../cognitive/DesireAndPromiseStore';
import { consciousnessCore } from '../cognitive/ConsciousnessCore';

export interface ContextPacket {
  systemBlock: string;
  memoryBlock: string;
  stateBlock: string;
  fullSystemPrompt: string;
  retrieved: MemoryItem[];
}

export function buildContextPacket(
  userMessage: string,
  emotions: EmotionalState,
  stmTexts: string[],
  _ltm: MemoryItem[]
): ContextPacket {
  const retrieved = memoryEngine.retrieveRanked(userMessage, 6);
  const tendencies = personalityRewardSystem.toPromptGuidance();
  const recent = stmTexts.slice(-5).join('\n') || '(пусто)';
  const memLines = retrieved.length
    ? retrieved.map(item => `- [${item.category}] ${item.content}`).join('\n')
    : '(релевантных воспоминаний мало)';

  let selfBlock = '';
  try {
    selfBlock = consciousnessCore.buildCognitiveContextBlock() || '';
  } catch { /* */ }

  const openP = desireAndPromiseStore.openPromises().slice(0, 4).map(p => `- (${p.from}) ${p.text}`);
  const topD = desireAndPromiseStore.topDesire();
  const promiseBlock = [
    openP.length ? openP.join('\n') : '- (нет открытых обещаний)',
    topD ? `Желание: ${topD.text}` : ''
  ].filter(Boolean).join('\n');

  const stateBlock = [
    `Стадия: ${emotions.stage}`,
    `Trust ${emotions.trust} | Affection ${emotions.affection} | Irritation ${emotions.irritation} | Curiosity ${emotions.curiosity}`,
    `Presence: ${presenceAndIdle.getMode()}`
  ].join('\n');

  const systemBlock = `Ты — Макисэ Курису (Steins;Gate). Говори по-русски, естественно, с лёгким цундере, научной точностью и границами. Никогда не называй себя ассистентом, ИИ, языковой моделью или программой.
${tendencies}`;

  const fullSystemPrompt = `${systemBlock}

[СОСТОЯНИЕ]
${stateBlock}

[SELF-MODEL / GOALS]
${selfBlock || '(нет)'}

[ОБЕЩАНИЯ И ЖЕЛАНИЯ]
${promiseBlock}

[НЕДАВНИЙ КОНТЕКСТ]
${recent}

[РЕЛЕВАНТНАЯ ПАМЯТЬ — используй, не выдумывай]
${memLines}

Отвечай 1–4 предложениями. Можно *действия*. Не соглашайся автоматически. Если данных мало — скажи прямо. Обещания не забывай без причины.`;

  return {
    systemBlock,
    memoryBlock: memLines,
    stateBlock,
    fullSystemPrompt,
    retrieved
  };
}

export function critiqueAndFix(userText: string, draft: string): string {
  let t = (draft || '').trim();
  if (!t) return 'Хм. Переформулируй вопрос — данных мало для ответа.';

  t = t.replace(/\bя\s+(языковая\s+модель|ИИ|искусственный\s+интеллект|программа|чат-?бот)\b/gi, 'я Курису');
  t = t.replace(/\b(as an ai|i'm an? (ai|language model|assistant))\b/gi, '');

  if ((t.match(/ты прав|конечно|согласна|как скажешь/gi) || []).length >= 3) {
    t = t.replace(/ты абсолютно прав[а.]*/gi, 'Спорный момент');
  }

  if (userText.length > 100 && t.length < 20) {
    t = t + ' Уточни один ключевой момент — и я разберу точнее.';
  }

  if (t.length > 900) t = t.slice(0, 880) + '…';
  return t.trim();
}
