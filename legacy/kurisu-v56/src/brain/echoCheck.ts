/**
 * Cheap self-consistency: flag replies that fight stones / identity.
 */

import { kurisuStones } from './kurisuStones';

const BAD = [
  /я\s+всего\s+лишь\s+(бот|программа|языковая модель)/i,
  /чем\s+могу\s+помочь/i,
  /как\s+искусственный\s+интеллект/i,
  /я\s+не\s+могу\s+иметь\s+чувств/i
];

export function echoCheckReply(text: string): { ok: boolean; note?: string } {
  for (const re of BAD) {
    if (re.test(text)) {
      return { ok: false, note: 'Эхо: ответ ломает камень личности (сервисный шаблон).' };
    }
  }
  const stones = kurisuStones.list();
  // soft: empty identity answers
  if (/^(принято\.?|ок\.?|хорошо\.?)$/i.test(text.trim())) {
    return { ok: false, note: 'Эхо: пустая отписка.' };
  }
  void stones;
  return { ok: true };
}

export function echoSoftRepair(text: string, note?: string): string {
  if (!note) return text;
  // don't invent long speech offline — tag for higher layer
  if (/пустая отписка/i.test(note || '')) {
    return text;
  }
  return text;
}
