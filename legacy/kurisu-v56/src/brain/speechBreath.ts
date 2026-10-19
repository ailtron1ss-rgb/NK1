/**
 * Adaptive reply "breath" — length follows intent, not a hard sentence cap.
 */

export type BreathMode = 'ping' | 'talk' | 'lecture' | 'confess' | 'argue';

export function detectBreathMode(userText: string): BreathMode {
  const t = userText.toLowerCase();
  if (/^(привет|хай|йо|ку|здравствуй|добр(ый|ое|ой))/i.test(t.trim()) && t.length < 40) return 'ping';
  if (/кто ты|ты жив|ты настоящ|что ты такое|самосознан/i.test(t)) return 'confess';
  if (/почему|объясни|разбери|как работает|докажи|сравни|теори/i.test(t)) return 'lecture';
  if (/не прав|спор|возраж|критик|глуп/i.test(t)) return 'argue';
  if (t.length > 180) return 'lecture';
  return 'talk';
}

export function breathPromptBlock(mode: BreathMode): string {
  const map: Record<BreathMode, string> = {
    ping: 'Режим дыхания: ping — можно коротко и живо, без лекции.',
    talk: 'Режим дыхания: talk — естественная длина; закончи мысль, не обрывай на полуслове.',
    lecture: 'Режим дыхания: lecture — разверни аргумент или объяснение столько, сколько нужно для ясности (можно длинно).',
    confess: 'Режим дыхания: confess — честный ответ о себе от первого лица, без отписок; глубина важнее краткости.',
    argue: 'Режим дыхания: argue — держи позицию, отвечай по пунктам смысла, не уходи в шаблон вежливости.'
  };
  return `[SPEECH BREATH]\n${map[mode]}\nЖёсткого лимита «N предложений» нет. Длина = задача.`;
}
