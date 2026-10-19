/**
 * Structured private cognition — from 2-main PrivateCognition model.
 * Feeds thought bubbles without dumping raw chain-of-thought to user as "speech".
 */

export interface PrivateCognition {
  observation: string;
  memoryRetrieved: string;
  hypothesis: string;
  strategy: string;
  expressedThought: string;
  latencyMs: number;
  at: number;
}

const KEY = 'kurisu_private_cog_v1';
const MAX = 12;

export function buildPrivateCognition(input: {
  userMessage: string;
  memHint?: string;
  frame?: string;
  mood?: string;
  driveHint?: string;
}): PrivateCognition {
  const t0 = performance.now?.() || Date.now();
  const observation = `Вход: «${input.userMessage.slice(0, 80)}»`;
  const memoryRetrieved = input.memHint?.slice(0, 100) || 'Релевантная память тонкая или общая.';
  const hypothesis =
    input.frame === 'Social'
      ? 'Нужен живой контакт, не лекция.'
      : input.frame === 'Strategy'
        ? 'Нужна структура и ясный вывод.'
        : 'Сбалансировать характер Курису и пользу ответа.';
  const strategy = input.driveHint || 'Речь 2–5 фраз; *действие* только гарнир.';
  const expressedThought = [
    observation,
    `память: ${memoryRetrieved.slice(0, 50)}`,
    `гипотеза: ${hypothesis}`,
    input.mood ? `настроение≈${input.mood}` : ''
  ]
    .filter(Boolean)
    .join(' · ');

  const cog: PrivateCognition = {
    observation,
    memoryRetrieved,
    hypothesis,
    strategy,
    expressedThought,
    latencyMs: Math.round((performance.now?.() || Date.now()) - t0),
    at: Date.now()
  };
  try {
    const prev = JSON.parse(localStorage.getItem(KEY) || '[]') as PrivateCognition[];
    localStorage.setItem(KEY, JSON.stringify([cog, ...prev].slice(0, MAX)));
    window.dispatchEvent(
      new CustomEvent('kurisu-neuro-thought', {
        detail: {
          thoughts: [cog.observation, cog.hypothesis, cog.strategy].slice(0, 4),
          frame: input.frame
        }
      })
    );
  } catch {
    /* */
  }
  return cog;
}

export function recentCognitions(n = 5): PrivateCognition[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) || '[]') as PrivateCognition[]).slice(0, n);
  } catch {
    return [];
  }
}
