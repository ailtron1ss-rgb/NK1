/**
 * Second arrow — optional short follow-up after a pause if curiosity high & budget allows.
 */

import { energyBudget } from './energyBudget';

export interface PendingFollowUp {
  text: string;
  dueAt: number;
}

let pending: PendingFollowUp | null = null;

export const followUpEngine = {
  maybeSchedule(opts: {
    curiosity: number;
    lastReply: string;
    userMessage: string;
  }) {
    if (opts.curiosity < 72) return;
    if (!energyBudget.canAutonomous()) return;
    if (opts.lastReply.length < 20) return;
    // don't spam
    if (pending && pending.dueAt > Date.now()) return;

    const ideas = [
      'Кстати… ты это к эксперименту вёл или просто так спросил?',
      'Если хочешь, разберём на один уровень глубже — но только если не отмажешься.',
      'У меня остался ещё один вопрос по этому. Ответишь?',
      'Хм. Запишу это в заметки лаборатории. Ты не против?'
    ];
    const text = ideas[Math.floor(Math.random() * ideas.length)];
    pending = { text, dueAt: Date.now() + 45000 + Math.random() * 30000 };
    energyBudget.recordAutonomous();
  },
  poll(): string | null {
    if (!pending) return null;
    if (Date.now() < pending.dueAt) return null;
    const t = pending.text;
    pending = null;
    return t;
  },
  cancel() {
    pending = null;
  }
};
