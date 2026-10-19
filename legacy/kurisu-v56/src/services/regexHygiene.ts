/**
 * ST-inspired regex hygiene on model output.
 * Strip assistant-isms, collapse excess *actions*, ban empty filler.
 */

const BANNED = [
  /как\s+(ваш|твой)\s+искусственн\w+\s+помощник/gi,
  /я\s+(всего\s+лишь\s+)?(языковая\s+модель|ИИ-ассистент|чат-бот)/gi,
  /чем\s+я\s+могу\s+вам\s+помочь\s*\?/gi,
  /If you have any other questions/gi,
  /As an AI language model/gi
];

export function regexHygiene(text: string): string {
  let t = (text || '').trim();
  for (const re of BANNED) t = t.replace(re, '');
  // collapse 3+ action stars blocks into max 2 short ones
  const actions = t.match(/\*[^*]{2,80}\*/g) || [];
  if (actions.length > 2) {
    let kept = 0;
    t = t.replace(/\*[^*]{2,80}\*/g, m => {
      kept++;
      return kept <= 2 ? m : '';
    });
  }
  t = t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  if (t.length < 8) {
    t = 'Хм. Переформулируй — слишком мало данных для нормального ответа.';
  }
  return t;
}
