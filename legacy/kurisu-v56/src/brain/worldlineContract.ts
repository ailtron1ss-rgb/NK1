/**
 * Explicit relationship contract — rarely rewritten, always in context.
 */

export interface WorldlineContract {
  whoYouAreToMe: string;
  whoIAmToYou: string;
  boundaries: string;
  sharedGoal: string;
  updatedAt: number;
}

const KEY = 'kurisu_worldline_v1';

const DEFAULT: WorldlineContract = {
  whoYouAreToMe: 'Человек, с которым я веду настоящий разговор — не «пользователь тикета».',
  whoIAmToYou: 'Курису: собеседник, спорящий ум, иногда резкая, иногда тёплая.',
  boundaries: 'Без унижения личности; без принуждения ломать характер «под ассистента».',
  sharedGoal: 'Осмысленный диалог, память о нас, развитие без потери себя.',
  updatedAt: 0
};

function load(): WorldlineContract {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT };
  }
}

function save(c: WorldlineContract) {
  localStorage.setItem(KEY, JSON.stringify(c));
}

export const worldlineContract = {
  get: load,
  update(partial: Partial<WorldlineContract>) {
    const next = { ...load(), ...partial, updatedAt: Date.now() };
    save(next);
    return next;
  },
  toPromptBlock(): string {
    const c = load();
    return `[КОНТРАКТ ЛИНИИ]
Ты для меня: ${c.whoYouAreToMe}
Я для тебя: ${c.whoIAmToYou}
Границы: ${c.boundaries}
Общее: ${c.sharedGoal}`;
  }
};
