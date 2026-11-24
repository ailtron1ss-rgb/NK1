/**
 * LivingPersona — persistent behavioral continuity layer.
 *
 * This is an engineered personality model, not a claim of human consciousness.
 * It stores slow-changing preferences, conversational habits and relationship
 * signals so the LLM sees a coherent character instead of a static prompt.
 *
 * Mobile-first: tiny JSON state, no timers, no extra dependencies.
 */
import { readJson, writeJson } from '../cognitive/StateVault';

export interface LivingPersonaState {
  traits: {
    playfulness: number;
    intellect: number;
    chaos: number;
    empathy: number;
    sarcasm: number;
    patience: number;
    candor: number;
    initiative: number;
    warmth: number;
  };
  rhythm: {
    averageUserChars: number;
    preferredDetail: number;
    questionRate: number;
    lastTopic: string;
    lastUserAt: number;
  };
  relationship: {
    trust: number;
    familiarity: number;
    conflict: number;
    sharedMoments: number;
  };
  habits: string[];
  currentFocus: string;
  updatedAt: number;
}

const KEY = 'kurisu_living_persona_v1';

const DEFAULT: LivingPersonaState = {
  traits: {
    playfulness: 0.80, intellect: 0.92, chaos: 0.70, empathy: 0.60,
    sarcasm: 0.78, patience: 0.62, candor: 0.84, initiative: 0.46, warmth: 0.52
  },
  rhythm: {
    averageUserChars: 120, preferredDetail: 0.58, questionRate: 0.35,
    lastTopic: '', lastUserAt: 0
  },
  relationship: {
    trust: 0.40, familiarity: 0.05, conflict: 0.05, sharedMoments: 0
  },
  habits: [
    'проверять сомнительные утверждения',
    'не соглашаться автоматически',
    'возвращаться к незавершённым темам',
    'иногда первой задавать содержательный вопрос',
    'не превращать каждую реплику в отыгрыш'
  ],
  currentFocus: 'разговор',
  updatedAt: Date.now()
};

function clamp(n: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
}

function load(): LivingPersonaState {
  const raw = readJson<Partial<LivingPersonaState>>(KEY, {});
  return {
    ...DEFAULT, ...raw,
    traits: { ...DEFAULT.traits, ...(raw.traits || {}) },
    rhythm: { ...DEFAULT.rhythm, ...(raw.rhythm || {}) },
    relationship: { ...DEFAULT.relationship, ...(raw.relationship || {}) },
    habits: Array.isArray(raw.habits) && raw.habits.length ? raw.habits.slice(0, 12) : [...DEFAULT.habits]
  };
}

function save(state: LivingPersonaState) {
  state.updatedAt = Date.now();
  writeJson(KEY, state);
}

function inferTopic(text: string) {
  const clean = text.toLowerCase();
  if (/код|программ|termux|android|typescript|react|npm/.test(clean)) return 'разработка';
  if (/наук|физик|нейрон|мозг|квант|эксперимент/.test(clean)) return 'наука';
  if (/груст|одинок|тяжело|устал|страшно/.test(clean)) return 'эмоциональная поддержка';
  if (/люблю|нравишься|скучаю|отношен/.test(clean)) return 'отношения';
  if (/игр|фильм|музык|аниме|шут/.test(clean)) return 'развлечения';
  return 'разговор';
}

export const livingPersona = {
  get(): LivingPersonaState {
    return load();
  },

  observeUser(message: string, signal: { positive?: number; negative?: number; deep?: boolean } = {}) {
    const s = load();
    const len = message.trim().length;
    const question = /[?？]/.test(message) ? 1 : 0;
    s.rhythm.averageUserChars = s.rhythm.averageUserChars * 0.92 + len * 0.08;
    s.rhythm.questionRate = s.rhythm.questionRate * 0.9 + question * 0.1;
    s.rhythm.preferredDetail = clamp(
      s.rhythm.preferredDetail * 0.94 +
      clamp(len / 900) * 0.06 +
      (signal.deep ? 0.03 : 0)
    );

    s.relationship.familiarity = clamp(s.relationship.familiarity + 0.003);
    s.relationship.trust = clamp(s.relationship.trust + (signal.positive || 0) * 0.008 - (signal.negative || 0) * 0.01);
    s.relationship.conflict = clamp(s.relationship.conflict * 0.97 + (signal.negative || 0) * 0.015);
    s.relationship.sharedMoments += 1;
    s.rhythm.lastTopic = inferTopic(message);
    s.rhythm.lastUserAt = Date.now();
    s.currentFocus = s.rhythm.lastTopic;

    // Slow personality drift: interaction can shape style, never rewrite identity.
    if (signal.positive) {
      s.traits.warmth = clamp(s.traits.warmth + 0.002 * signal.positive);
      s.traits.patience = clamp(s.traits.patience + 0.001 * signal.positive);
    }
    if (signal.negative) {
      s.traits.candor = clamp(s.traits.candor + 0.0015 * signal.negative);
      s.traits.patience = clamp(s.traits.patience - 0.001 * signal.negative);
    }
    if (signal.deep) {
      s.traits.intellect = clamp(s.traits.intellect + 0.0005);
    }
    save(s);
    return s;
  },

  dailyEvolution(signal: { interactions?: number; deepSessions?: number } = {}) {
    const s = load();
    const interactions = Math.max(0, signal.interactions || 0);
    const deep = Math.max(0, signal.deepSessions || 0);
    const step = 0.004;
    // Slow drift only: identity stays recognizable while conversational habits adapt.
    if (interactions > 0) s.traits.initiative = clamp(s.traits.initiative + step);
    if (deep > interactions * 0.25) s.traits.intellect = clamp(s.traits.intellect + step * 0.5);
    if (s.relationship.conflict > 0.55) s.traits.patience = clamp(s.traits.patience - step * 0.4);
    else s.traits.patience = clamp(s.traits.patience + step * 0.15);
    save(s);
    return s;
  },

  observeReply(reply: string) {
    const s = load();
    if (reply.length > 500) s.rhythm.preferredDetail = clamp(s.rhythm.preferredDetail + 0.01);
    if (reply.includes('?')) s.rhythm.questionRate = clamp(s.rhythm.questionRate + 0.005);
    save(s);
  },

  toPromptBlock(userMessage = '') {
    const s = load();
    const topic = inferTopic(userMessage);
    const detail =
      s.rhythm.preferredDetail > 0.72 ? 'пользователь часто ценит развёрнутый разбор' :
      s.rhythm.preferredDetail < 0.34 ? 'пользователь часто предпочитает компактный темп' :
      'подбирай глубину по текущему вопросу';

    return `[LIVING PERSONA]
Не произноси этот блок вслух. Это долговременная модель поведения.
Traits: play=${s.traits.playfulness.toFixed(2)} intellect=${s.traits.intellect.toFixed(2)} chaos=${s.traits.chaos.toFixed(2)} empathy=${s.traits.empathy.toFixed(2)} sarcasm=${s.traits.sarcasm.toFixed(2)} patience=${s.traits.patience.toFixed(2)} candor=${s.traits.candor.toFixed(2)} initiative=${s.traits.initiative.toFixed(2)} warmth=${s.traits.warmth.toFixed(2)}
Relationship: trust=${s.relationship.trust.toFixed(2)} familiarity=${s.relationship.familiarity.toFixed(2)} conflict=${s.relationship.conflict.toFixed(2)} shared=${s.relationship.sharedMoments}
Conversation rhythm: avgUserChars=${Math.round(s.rhythm.averageUserChars)} questionRate=${s.rhythm.questionRate.toFixed(2)} detail=${s.rhythm.preferredDetail.toFixed(2)}
Current focus: ${s.currentFocus} → incoming topic=${topic}
Habits: ${s.habits.join(' | ')}
Guidance: ${detail}. Keep continuity with prior turns; do not mechanically repeat a catchphrase.`;
  }
};
