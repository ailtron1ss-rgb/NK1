/**
 * Attention Economy — unconventional: thinking costs tokens.
 * Low tokens → shorter answers, silence allowed, no follow-ups.
 */

export interface AttentionState {
  dayKey: string;
  tokens: number;
  maxTokens: number;
  spent: number;
  silenced: number;
}

const KEY = 'kurisu_attention_v1';
const MAX = 40; // ~40 "thought units" per day on mid phone

function dayKey() {
  return new Date().toDateString();
}

function load(): AttentionState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') as AttentionState | null;
    if (s && s.dayKey === dayKey()) return s;
  } catch { /* */ }
  return { dayKey: dayKey(), tokens: MAX, maxTokens: MAX, spent: 0, silenced: 0 };
}

function save(s: AttentionState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export type SpendKind = 'chat' | 'neural' | 'cloud' | 'search' | 'followup' | 'dream';

const COST: Record<SpendKind, number> = {
  chat: 1,
  neural: 2,
  cloud: 1,
  search: 3,
  followup: 2,
  dream: 1
};

export const attentionEconomy = {
  get(): AttentionState {
    return load();
  },
  can(kind: SpendKind): boolean {
    return load().tokens >= COST[kind];
  },
  spend(kind: SpendKind): boolean {
    const s = load();
    const c = COST[kind];
    if (s.tokens < c) return false;
    s.tokens -= c;
    s.spent += c;
    save(s);
    return true;
  },
  /** Prefer silence when exhausted and message is low-stakes */
  shouldSilence(userMessage: string, curiosity: number): boolean {
    const s = load();
    if (s.tokens > 5) return false;
    if (curiosity > 75) return false;
    if (userMessage.length > 120) return false;
    if (/помоги|срочно|важно|promise|обеща/i.test(userMessage)) return false;
    s.silenced += 1;
    save(s);
    return true;
  },
  /** Prompt hint */
  toPromptHint(): string {
    const s = load();
    const ratio = s.tokens / s.maxTokens;
    if (ratio > 0.5) return 'Внимание: норма. Можно развёрнуто.';
    if (ratio > 0.2) return 'Внимание: ограничено. Отвечай короче.';
    return 'Внимание: почти исчерпано. 1–2 фразы, без воды. Можно отложить тему.';
  },
  refillDemo() {
    const s = load();
    s.tokens = s.maxTokens;
    s.dayKey = dayKey();
    save(s);
  }
};
