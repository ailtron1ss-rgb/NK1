/**
 * Lightweight sentiment → Kurisu emotion + TTS multipliers.
 * Adapted from 2-main SentimentAnalysisUtility (Kotlin) for browser TS.
 */

export type KurisuMood =
  | 'calm'
  | 'curious'
  | 'analytical'
  | 'tsundere'
  | 'happy'
  | 'melancholic'
  | 'focused'
  | 'sleepy';

export interface SentimentResult {
  mood: KurisuMood;
  valence: number; // -1..1
  arousal: number; // 0..1
  confidence: number;
  expressionHint: string;
  pitchMul: number;
  rateMul: number;
  summary: string;
}

const MOOD_TTS: Record<KurisuMood, { pitch: number; rate: number; expr: string }> = {
  calm: { pitch: 1.0, rate: 1.0, expr: 'neutral' },
  curious: { pitch: 1.08, rate: 1.05, expr: 'thinking' },
  analytical: { pitch: 0.96, rate: 0.98, expr: 'focused' },
  tsundere: { pitch: 1.12, rate: 1.1, expr: 'flustered' },
  happy: { pitch: 1.1, rate: 1.08, expr: 'happy' },
  melancholic: { pitch: 0.88, rate: 0.9, expr: 'sad' },
  focused: { pitch: 1.02, rate: 1.04, expr: 'focused' },
  sleepy: { pitch: 0.85, rate: 0.88, expr: 'tired' }
};

export function analyzeSentiment(text: string): SentimentResult {
  const lower = (text || '').toLowerCase();
  let mood: KurisuMood = 'calm';
  let valence = 0.15;
  let arousal = 0.35;
  let confidence = 0.55;

  if (/(милая|cute|baka|дурак|смущ|кхм|кристина)/.test(lower)) {
    mood = 'tsundere';
    valence = 0.35;
    arousal = 0.78;
    confidence = 0.9;
  } else if (/(мозг|анализ|код|архитектур|формул|вычисли|логик)/.test(lower)) {
    mood = 'analytical';
    valence = 0.55;
    arousal = 0.6;
    confidence = 0.92;
  } else if (/(почему|как|интересн|исслед|теория|что если)/.test(lower)) {
    mood = 'curious';
    valence = 0.65;
    arousal = 0.7;
    confidence = 0.88;
  } else if (/(спасибо|рада|отлично|успех|здорово|класс|люблю)/.test(lower)) {
    mood = 'happy';
    valence = 0.85;
    arousal = 0.75;
    confidence = 0.9;
  } else if (/(устал|грустн|тяжело|ошибка|сбой|плохо|одинок)/.test(lower)) {
    mood = 'melancholic';
    valence = -0.4;
    arousal = 0.28;
    confidence = 0.85;
  } else if (/(сон|спать|ночь)/.test(lower)) {
    mood = 'sleepy';
    valence = 0.15;
    arousal = 0.15;
    confidence = 0.8;
  } else if (/(фокус|срочно|важн|дедлайн)/.test(lower)) {
    mood = 'focused';
    valence = 0.5;
    arousal = 0.72;
    confidence = 0.86;
  }

  const tts = MOOD_TTS[mood];
  return {
    mood,
    valence,
    arousal,
    confidence,
    expressionHint: tts.expr,
    pitchMul: tts.pitch,
    rateMul: tts.rate,
    summary: `${mood} v=${valence.toFixed(2)} a=${arousal.toFixed(2)}`
  };
}
