/**
 * Curiosity drive — queues genuine questions when under-stimulated.
 */

import { energyBudget } from './energyBudget';
import { attentionEconomy } from './attentionEconomy';
import { eventBus } from './eventBus';

const QUESTIONS = [
  'Слушай… что для тебя сейчас важнее: теория или просто не быть одному?',
  'Ты вообще спишь нормально, или опять ночной режим как у меня в смене?',
  'Если бы Amadeus стал слишком похож на человека — ты бы испугался или обрадовался?',
  'Какую одну вещь в себе ты бы не хотел, чтобы я «оптимизировала»?',
  'Мы всё ещё в эксперименте или уже просто… разговариваем?'
];

const KEY = 'kurisu_curiosity_q_at';

export const curiosityDrive = {
  maybeQueue(curiosity: number, lastUserAt: number): string | null {
    if (curiosity < 68) return null;
    if (Date.now() - lastUserAt < 120000) return null; // user active recently
    if (!energyBudget.canAutonomous()) return null;
    if (!attentionEconomy.can('followup')) return null;
    const last = Number(localStorage.getItem(KEY) || 0);
    if (Date.now() - last < 25 * 60 * 1000) return null;
    if (Math.random() > 0.35) return null;

    energyBudget.recordAutonomous();
    attentionEconomy.spend('followup');
    localStorage.setItem(KEY, String(Date.now()));
    const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    eventBus.emit('kurisu_reply', { kind: 'curiosity', text: q });
    return q;
  }
};
