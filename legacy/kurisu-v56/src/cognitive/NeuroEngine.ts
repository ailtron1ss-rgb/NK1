/**
 * NeuroEngine — multi-layer cognitive control for "Neuro-Kurisu".
 * Not phenomenal consciousness: structured traits → frames → emotion → decision → expression.
 * Designed for mid-range Android: pure TS, no TFLite requirement.
 */

export type CognitiveFrame = 'Play' | 'Strategy' | 'Chaos' | 'Social' | 'Learn';

export interface PersonalityTraits {
  playfulness: number;
  intellect: number;
  chaos: number;
  empathy: number;
  sarcasm: number;
}

export interface EmotionVector {
  happiness: number;
  sadness: number;
  anger: number;
  surprise: number;
  embarrassment: number;
  curiosity: number;
  trust: number;
  irritation: number;
  updatedAt: number;
}

export interface NeuroDecision {
  frame: CognitiveFrame;
  traits: PersonalityTraits;
  emotions: EmotionVector;
  intent: string;
  sentiment: 'pos' | 'neg' | 'neu' | 'mix';
  expressionHint: string;
  motionHint: string;
  promptBlock: string;
  thoughtTrace: string[];
}

const TRAITS_KEY = 'kurisu_neuro_traits_v1';
const EMO_KEY = 'kurisu_neuro_emotions_v1';

const DEFAULT_TRAITS: PersonalityTraits = {
  playfulness: 0.8,
  intellect: 0.92,
  chaos: 0.7,
  empathy: 0.6,
  sarcasm: 0.78
};

const DEFAULT_EMO: EmotionVector = {
  happiness: 0.35,
  sadness: 0.12,
  anger: 0.1,
  surprise: 0.15,
  embarrassment: 0.12,
  curiosity: 0.55,
  trust: 0.4,
  irritation: 0.15,
  updatedAt: Date.now()
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function loadTraits(): PersonalityTraits {
  try {
    return { ...DEFAULT_TRAITS, ...JSON.parse(localStorage.getItem(TRAITS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_TRAITS };
  }
}

function loadEmotions(): EmotionVector {
  try {
    const e = { ...DEFAULT_EMO, ...JSON.parse(localStorage.getItem(EMO_KEY) || '{}') };
    // decay ~0.02 per minute toward baseline
    const mins = (Date.now() - (e.updatedAt || Date.now())) / 60000;
    if (mins > 0.5) {
      // Requested decay: roughly 0.02 of the distance to baseline per minute,
      // with a hard floor at baseline rather than a sudden 35% jump.
      const retain = Math.max(0, 1 - mins * 0.02);
      const base = DEFAULT_EMO;
      (Object.keys(base) as (keyof EmotionVector)[]).forEach(k => {
        if (k === 'updatedAt') return;
        const cur = e[k] as number;
        const b = base[k] as number;
        (e as any)[k] = b + (cur - b) * retain;
      });
      e.updatedAt = Date.now();
      saveEmotions(e);
    }
    return e;
  } catch {
    return { ...DEFAULT_EMO };
  }
}

function saveEmotions(e: EmotionVector) {
  e.updatedAt = Date.now();
  localStorage.setItem(EMO_KEY, JSON.stringify(e));
}

function analyzeSentiment(text: string): 'pos' | 'neg' | 'neu' | 'mix' {
  const t = text.toLowerCase();
  const pos = /(спасибо|рад|люблю|хорошо|класс|интересн|крут)/.test(t);
  const neg = /(плохо|устал|груст|ненавиж|злюсь|больно|одинок)/.test(t);
  if (pos && neg) return 'mix';
  if (pos) return 'pos';
  if (neg) return 'neg';
  return 'neu';
}

function analyzeIntent(text: string): string {
  const t = text.toLowerCase();
  if (/(почему|как работает|объясн|теория|наук)/.test(t)) return 'science';
  if (/(как дела|что думаешь|привет|пока)/.test(t)) return 'social';
  if (/(шутк|хах|лол|прикол)/.test(t)) return 'play';
  if (/(помоги|сделай|надо|план)/.test(t)) return 'strategy';
  if (/(кристина|туп|идиот)/.test(t)) return 'boundary';
  return 'chat';
}

function pickFrame(
  intent: string,
  sentiment: string,
  traits: PersonalityTraits,
  emo: EmotionVector
): CognitiveFrame {
  if (intent === 'science' || (traits.intellect > 0.85 && intent === 'strategy')) return 'Strategy';
  if (intent === 'boundary' || emo.anger > 0.55 || emo.irritation > 0.6) return 'Chaos';
  if (intent === 'play' || (traits.playfulness > 0.7 && sentiment === 'pos')) return 'Play';
  if (intent === 'social' || sentiment === 'neg') {
    if (traits.empathy > 0.5 && sentiment === 'neg') return 'Social';
  }
  if (emo.curiosity > 0.6 || intent === 'chat') {
    if (Math.random() < traits.chaos * 0.25) return 'Chaos';
    if (Math.random() < traits.playfulness * 0.3) return 'Play';
    return 'Learn';
  }
  if (sentiment === 'neg') return 'Social';
  return 'Strategy';
}

/** 70% new stimulus + 30% previous — emotional inertia */
function blend(prev: number, target: number) {
  return clamp01(target * 0.7 + prev * 0.3);
}

function bumpEmotions(emo: EmotionVector, intent: string, sentiment: string, text: string) {
  const prev = { ...emo };
  let th = prev.happiness, ts = prev.sadness, ta = prev.anger, ti = prev.irritation;
  let tc = prev.curiosity, tt = prev.trust, te = prev.embarrassment, tsu = prev.surprise;
  if (sentiment === 'pos') {
    th += 0.08; tt += 0.04; ts -= 0.03;
  }
  if (sentiment === 'neg') {
    ts += 0.07; tc += 0.05; th -= 0.03;
  }
  if (intent === 'boundary' || /кристина/i.test(text)) {
    ta += 0.14; ti += 0.12; te += 0.06;
  }
  if (intent === 'science') {
    tc += 0.1; th += 0.04;
  }
  if (intent === 'play') {
    th += 0.07; tsu += 0.05;
  }
  emo.happiness = blend(prev.happiness, th);
  emo.sadness = blend(prev.sadness, ts);
  emo.anger = blend(prev.anger, ta);
  emo.irritation = blend(prev.irritation, ti);
  emo.curiosity = blend(prev.curiosity, tc);
  emo.trust = blend(prev.trust, tt);
  emo.embarrassment = blend(prev.embarrassment, te);
  emo.surprise = blend(prev.surprise, tsu);
  emo.updatedAt = Date.now();
  saveEmotions(emo);
}

function expressionFrom(emo: EmotionVector, frame: CognitiveFrame): string {
  if (emo.anger > 0.55 || emo.irritation > 0.6) return 'angry';
  if (emo.embarrassment > 0.5) return 'flustered';
  if (emo.surprise > 0.55) return 'surprised';
  if (emo.sadness > 0.5) return 'sad';
  if (emo.happiness > 0.55) return 'happy';
  if (frame === 'Strategy' || frame === 'Learn') return 'thinking';
  if (frame === 'Play') return 'smile';
  return 'neutral';
}

function motionFrom(frame: CognitiveFrame, expr: string): string {
  if (expr === 'angry') return 'TapHead';
  if (expr === 'flustered') return 'TapBody';
  if (frame === 'Play') return 'Idle';
  return 'Idle';
}

class NeuroEngine {
  decide(userMessage: string, retrievedMemoryLines: string[] = []): NeuroDecision {
    const traits = loadTraits();
    const emotions = loadEmotions();
    const sentiment = analyzeSentiment(userMessage);
    const intent = analyzeIntent(userMessage);
    bumpEmotions(emotions, intent, sentiment, userMessage);
    const frame = pickFrame(intent, sentiment, traits, emotions);
    const expressionHint = expressionFrom(emotions, frame);
    const motionHint = motionFrom(frame, expressionHint);

    const thoughtTrace = [
      `input: «${userMessage.slice(0, 60)}»`,
      `sentiment=${sentiment} intent=${intent}`,
      `frame=${frame}`,
      `emo H${emotions.happiness.toFixed(2)} C${emotions.curiosity.toFixed(2)} Ir${emotions.irritation.toFixed(2)}`,
      retrievedMemoryLines[0] ? `mem: ${retrievedMemoryLines[0].slice(0, 50)}` : 'mem: thin',
      `expr→${expressionHint}`
    ];

    const frameGuide: Record<CognitiveFrame, string> = {
      Play: 'тон игривый, лёгкая подколка, энергия; без детского сюсюканья',
      Strategy: 'аналитично, по шагам, точные формулировки',
      Chaos: 'неожиданный угол, сарказм, короткая вспышка характера',
      Social: 'теплее, эмпатия без мелодрамы, живой разговор',
      Learn: 'любопытство, уточняющий вопрос, исследование темы'
    };

    const promptBlock = `[NEURO ENGINE]
traits: play=${traits.playfulness.toFixed(2)} intellect=${traits.intellect.toFixed(2)} chaos=${traits.chaos.toFixed(2)} empathy=${traits.empathy.toFixed(2)} sarcasm=${traits.sarcasm.toFixed(2)}
frame: ${frame} — ${frameGuide[frame]}
emotions: happy=${emotions.happiness.toFixed(2)} sad=${emotions.sadness.toFixed(2)} anger=${emotions.anger.toFixed(2)} curious=${emotions.curiosity.toFixed(2)} trust=${emotions.trust.toFixed(2)} irrit=${emotions.irritation.toFixed(2)} embar=${emotions.embarrassment.toFixed(2)}
intent=${intent} sentiment=${sentiment}
RULES: Говори естественно. Длина ответа определяется задачей и разговорным ритмом; не существует минимального или максимального числа предложений в стиле личности. *действие* только как гарнир. Не RPG-локации.
HUMAN: иногда короткая пауза «мм…» / «подожди…» в начале уместна; можно слегка поправить себя; не идеальный робот-секретарь.
SELF: изредка можно упомянуть своё состояние (устала/заинтересована) без нытья.`;

    return {
      frame,
      traits,
      emotions,
      intent,
      sentiment,
      expressionHint,
      motionHint,
      promptBlock,
      thoughtTrace
    };
  }

  getTraits() {
    return loadTraits();
  }

  getEmotions() {
    return loadEmotions();
  }

  setTraits(partial: Partial<PersonalityTraits>) {
    const t = { ...loadTraits(), ...partial };
    localStorage.setItem(TRAITS_KEY, JSON.stringify(t));
  }
}

export const neuroEngine = new NeuroEngine();

/** Human-like deliberation delay (ms) before showing final reply */
export function thinkingDelayMs(decision: NeuroDecision): number {
  const base = decision.frame === 'Strategy' || decision.frame === 'Learn' ? 900 : 450;
  const chaos = decision.traits.chaos * 400;
  return Math.round(base + Math.random() * chaos);
}

