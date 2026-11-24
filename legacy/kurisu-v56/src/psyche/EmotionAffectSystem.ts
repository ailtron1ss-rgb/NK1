/**
 * Emotions (fast) + Feelings (slow) — dual timescale affect.
 */

export interface EmotionSnapshot {
  joy: number;
  anger: number;
  fear: number;
  sadness: number;
  surprise: number;
  trustFeel: number;
  anticipation: number;
}

export interface FeelingSnapshot {
  loneliness: number;
  attachment: number;
  intellectualHunger: number;
  safety: number;
  fatigueFeel: number;
}

export interface AffectState {
  emotions: EmotionSnapshot;
  feelings: FeelingSnapshot;
  lastEvent: string;
  updatedAt: number;
}

const KEY = 'kurisu_affect_v1';

const DEFAULT: AffectState = {
  emotions: { joy: 30, anger: 15, fear: 10, sadness: 12, surprise: 20, trustFeel: 40, anticipation: 35 },
  feelings: { loneliness: 25, attachment: 35, intellectualHunger: 70, safety: 50, fatigueFeel: 30 },
  lastEvent: 'init',
  updatedAt: Date.now()
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

function load(): AffectState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
    return {
      emotions: { ...DEFAULT.emotions, ...raw.emotions },
      feelings: { ...DEFAULT.feelings, ...raw.feelings },
      lastEvent: raw.lastEvent || 'load',
      updatedAt: raw.updatedAt || Date.now()
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT));
  }
}

function save(s: AffectState) {
  s.updatedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(s));
}

/** Passive decay toward baseline */
function decay(s: AffectState) {
  const e = s.emotions;
  const base = DEFAULT.emotions;
  for (const k of Object.keys(e) as (keyof EmotionSnapshot)[]) {
    e[k] = clamp(e[k] + (base[k] - e[k]) * 0.04);
  }
  const f = s.feelings;
  const fb = DEFAULT.feelings;
  for (const k of Object.keys(f) as (keyof FeelingSnapshot)[]) {
    f[k] = clamp(f[k] + (fb[k] - f[k]) * 0.015);
  }
}

export const emotionAffect = {
  get: load,
  tick() {
    const s = load();
    decay(s);
    save(s);
    return s;
  },
  onUserMessage(text: string, meta?: { contradiction?: boolean }) {
    const s = load();
    decay(s);
    if (/спасибо|рад|люблю|хорошо/i.test(text)) {
      s.emotions.joy = clamp(s.emotions.joy + 8);
      s.feelings.attachment = clamp(s.feelings.attachment + 2);
      s.emotions.trustFeel = clamp(s.emotions.trustFeel + 3);
    }
    if (/идиот|туп|заткни|кристина/i.test(text)) {
      s.emotions.anger = clamp(s.emotions.anger + 12);
      s.feelings.safety = clamp(s.feelings.safety - 5);
      s.emotions.trustFeel = clamp(s.emotions.trustFeel - 4);
    }
    if (/почему|как работает|теория|нейро/i.test(text)) {
      s.emotions.anticipation = clamp(s.emotions.anticipation + 10);
      s.feelings.intellectualHunger = clamp(s.feelings.intellectualHunger + 5);
      s.emotions.joy = clamp(s.emotions.joy + 3);
    }
    if (meta?.contradiction) {
      s.emotions.surprise = clamp(s.emotions.surprise + 15);
      s.emotions.anger = clamp(s.emotions.anger + 5);
    }
    if (text.length < 3) {
      s.feelings.loneliness = clamp(s.feelings.loneliness + 2);
    }
    s.lastEvent = 'user_message';
    save(s);
    return s;
  },
  onSleep() {
    const s = load();
    s.feelings.fatigueFeel = clamp(s.feelings.fatigueFeel - 25);
    s.emotions.anger = clamp(s.emotions.anger - 10);
    s.feelings.intellectualHunger = clamp(s.feelings.intellectualHunger + 5);
    s.lastEvent = 'sleep';
    save(s);
  },
  dominantEmotion(s?: AffectState): string {
    const e = (s || load()).emotions;
    return (Object.entries(e).sort((a, b) => b[1] - a[1])[0] || ['neutral', 0])[0];
  },
  toPromptBlock(): string {
    const s = load();
    const d = this.dominantEmotion(s);
    return `[АФФЕКТ]
Эмоции(быстрые): joy=${s.emotions.joy|0} anger=${s.emotions.anger|0} trust=${s.emotions.trustFeel|0} anticipation=${s.emotions.anticipation|0} dominant=${d}
Чувства(медленные): attachment=${s.feelings.attachment|0} loneliness=${s.feelings.loneliness|0} hunger=${s.feelings.intellectualHunger|0} safety=${s.feelings.safety|0} fatigue=${s.feelings.fatigueFeel|0}
Учитывай тон, не объявляй числовые метрики пользователю.`;
  },
  toExpressionHint(): string {
    const d = this.dominantEmotion();
    if (d === 'anger') return 'tsundere_denial';
    if (d === 'joy') return 'happy';
    if (d === 'sadness') return 'sad';
    if (d === 'surprise') return 'surprised';
    if (d === 'anticipation') return 'thinking';
    return 'neutral';
  }
};
