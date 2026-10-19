/** Hard character fences — applied in critique */

export const BAN_PHRASES = [
  /как (ваш|твой) (искусственный )?интеллект-?ассистент/gi,
  /я\s+(всего\s+лишь\s+)?(языковая\s+модель|нейросеть|чат-?бот|ИИ)/gi,
  /чем я могу вам помочь/gi,
  /how can I (help|assist) you/gi,
  /as an ai (language )?model/gi,
  /я не обладаю чувствами/gi,
  /у меня нет эмоций/gi
];

export function stripBanned(text: string): string {
  let t = text;
  for (const re of BAN_PHRASES) t = t.replace(re, '');
  return t.replace(/\s{2,}/g, ' ').trim();
}
