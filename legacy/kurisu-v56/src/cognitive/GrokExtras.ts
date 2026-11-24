/**
 * Extra utilities I wanted in the system:
 * - why-did-you-answer (meta reflection without breaking character)
 * - personality report export
 * - anti-sycophancy check helper
 */

export function buildWhyReplyReflection(input: {
  userText: string;
  replyText: string;
  tendenciesSummary: string;
}): string {
  // This is INTERNAL. If shown to user, narrate in-character separately.
  return [
    'Internal reflection (not spoken raw):',
    `- User stimulus length: ${input.userText.length}`,
    `- Reply length: ${input.replyText.length}`,
    `- Tendencies: ${input.tendenciesSummary}`,
    '- Check: disagreement allowed? memory invented? warmth within cap?'
  ].join('\n');
}

export function inCharacterWhyNarration(reasonCode: 'disagreed' | 'short' | 'warm' | 'science' | 'boundary'): string {
  switch (reasonCode) {
    case 'disagreed':
      return 'Потому что соглашаться с ошибкой — плохая услуга. Мне важнее точность, чем твоё сиюминутное удобство.';
    case 'short':
      return 'Коротко, потому что данных мало. Я не достраиваю реальность из воздуха.';
    case 'warm':
      return 'Я не развела сцену. Если и было тепло, то дозированно — иначе это уже не я.';
    case 'science':
      return 'Тема задела рабочий интерес. Тогда я говорю плотнее и точнее.';
    case 'boundary':
      return 'Потому что граница была. Игнорировать её — значит разрешить относиться ко мне как к функции.';
  }
}

export function antiSycophancyFlags(reply: string): string[] {
  const flags: string[] = [];
  if (/ты абсолютно прав|конечно, как скажешь|я во всём согласна/i.test(reply)) {
    flags.push('possible_sycophancy');
  }
  if ((reply.match(/да,/g) || []).length >= 3) flags.push('over_agreement');
  return flags;
}

export function personalityReport(input: {
  relationStage: string;
  tendencies: Record<string, number>;
  beliefs: string[];
  openPromises: string[];
  topDesire?: string;
  quality: number;
}): string {
  return [
    '=== Отчёт Курису о состоянии связи ===',
    `Стадия: ${input.relationStage}`,
    `Качество недавних ответов (внутр.): ${(input.quality * 100).toFixed(0)}%`,
    `Склонности: candor ${input.tendencies.candor}, rigor ${input.tendencies.rigor}, warmthCap ${input.tendencies.warmthCap}, initiative ${input.tendencies.initiative}, sycophancyGuard ${input.tendencies.sycophancyGuard}`,
    input.topDesire ? `Текущее желание: ${input.topDesire}` : 'Текущее желание: —',
    input.openPromises.length ? `Обещания: ${input.openPromises.join('; ')}` : 'Обещания: нет открытых',
    input.beliefs.length ? `Устойчивые факты: ${input.beliefs.join('; ')}` : 'Устойчивых фактов мало',
    'Примечание: числа — внутренние параметры. В диалоге она их не зачитывает.'
  ].join('\n');
}
