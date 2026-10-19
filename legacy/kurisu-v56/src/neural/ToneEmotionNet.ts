/**
 * Tiny multi-head "embryo" net for tone / emotion / arousal from text.
 * Fixed projection + lexicons — mobile-safe, no heavy deps.
 */

import { embedText, cosine } from '../brain/embeddings';

export interface ToneReport {
  tone: 'warm' | 'neutral' | 'cold' | 'playful' | 'hostile' | 'curious' | 'intimate';
  emotion: string;
  valence: number;
  arousal: number;
  formality: number;
  humorCue: number;
  scores: Record<string, number>;
  promptBlock: string;
}

const PROTO: Record<string, string> = {
  joy: 'рад счастлив люблю классно ура смех улыбка хорошо мило',
  anger: 'злюсь бесит ненавижу идиот тупой заткнись раздражает',
  sadness: 'грустно плохо устал одинок пусто тяжело плачу жаль',
  fear: 'боюсь страшно тревога опасно паника волнуюсь',
  curiosity: 'почему как работает интересно теория гипотеза странно',
  play: 'хах лол шутка прикол сарказм иронично хаха',
  affection: 'спасибо родной милая заботь обнимаю люблю тебя'
};

const protoVecs: Record<string, Float32Array> = {};
for (const [k, v] of Object.entries(PROTO)) {
  protoVecs[k] = embedText(v);
}

function lexiconBoost(text: string): Record<string, number> {
  const t = text.toLowerCase();
  const b: Record<string, number> = {};
  for (const [k, words] of Object.entries(PROTO)) {
    let s = 0;
    for (const w of words.split(' ')) {
      if (t.includes(w)) s += 1;
    }
    b[k] = s;
  }
  if (/[?]/.test(t)) b.curiosity = (b.curiosity || 0) + 1.5;
  if (/!{2,}/.test(t)) b.anger = (b.anger || 0) + 0.5;
  if (/\b(хах|ахах|лол)/i.test(t)) b.play = (b.play || 0) + 2;
  return b;
}

export function analyzeToneEmotion(text: string): ToneReport {
  const vec = embedText(text || '');
  const scores: Record<string, number> = {};
  for (const [k, pv] of Object.entries(protoVecs)) {
    scores[k] = Math.max(0, cosine(vec, pv));
  }
  const boost = lexiconBoost(text || '');
  for (const [k, v] of Object.entries(boost)) {
    scores[k] = (scores[k] || 0) + v * 0.15;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const emotion = ranked[0]?.[0] || 'neutral';
  const valence =
    (scores.joy || 0) * 0.8 +
    (scores.affection || 0) * 0.6 +
    (scores.play || 0) * 0.3 -
    (scores.anger || 0) * 0.9 -
    (scores.sadness || 0) * 0.7 -
    (scores.fear || 0) * 0.5;
  const arousal = Math.min(
    1,
    (scores.anger || 0) * 0.5 +
      (scores.fear || 0) * 0.4 +
      (scores.curiosity || 0) * 0.35 +
      (scores.play || 0) * 0.3 +
      ((text || '').length > 120 ? 0.1 : 0)
  );

  let tone: ToneReport['tone'] = 'neutral';
  if (scores.play > 0.35) tone = 'playful';
  else if (scores.anger > 0.4) tone = 'hostile';
  else if (scores.affection > 0.35) tone = 'warm';
  else if (scores.curiosity > 0.35) tone = 'curious';
  else if (valence < -0.25) tone = 'cold';
  else if (valence > 0.25) tone = 'warm';

  const formality = /пожалуйста|уважаем|прошу|здравствуйте/i.test(text || '')
    ? 0.7
    : /хах|лол|блин/i.test(text || '')
      ? 0.2
      : 0.45;
  const humorCue = Math.min(1, (scores.play || 0) * 1.2 + (/шутк|прикол|сарказм/i.test(text || '') ? 0.3 : 0));

  const promptBlock = `[TONE-EMOTION NET]
tone=${tone} emotion=${emotion} valence=${valence.toFixed(2)} arousal=${arousal.toFixed(2)} humor=${humorCue.toFixed(2)} formality=${formality.toFixed(2)}
Подстрой тон: ${tone}; лёгкий сарказм/шутка если humor>0.35 и не hostile.`;

  return {
    tone,
    emotion,
    valence: Math.max(-1, Math.min(1, valence)),
    arousal,
    formality,
    humorCue,
    scores,
    promptBlock
  };
}
