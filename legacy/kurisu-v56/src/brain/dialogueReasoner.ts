/**
 * Lightweight dialogue reasoning for mobile: what must be answered, entities, stance.
 * Injected into the system prompt so the model (or offline router) addresses substance.
 */

export type DialogueIntent =
  | 'identity'
  | 'feeling'
  | 'question'
  | 'memory'
  | 'science'
  | 'relationship'
  | 'command'
  | 'chitchat'
  | 'meta';

export interface DialoguePlan {
  intent: DialogueIntent;
  mustAddress: string[];
  entities: string[];
  questionMarks: boolean;
  isAboutSelf: boolean;
  stanceHint: string;
  promptBlock: string;
}

function entitiesFrom(text: string): string[] {
  const words = text
    .split(/[^а-яА-ЯёЁa-zA-Z0-9\-]+/)
    .filter(w => w.length > 3)
    .slice(0, 12);
  return Array.from(new Set(words)).slice(0, 8);
}

export function planDialogue(userText: string, recentStm: string[] = []): DialoguePlan {
  const t = (userText || '').trim();
  const lower = t.toLowerCase();
  const questionMarks = /\?/.test(t) || /^(кто|что|как|где|когда|почему|зачем|сколько|можно|ли)\b/i.test(lower);
  const isAboutSelf = /ты\b|тебя|тобой|тво[еёя]|курису|себе/i.test(lower);
  const entities = entitiesFrom(t);

  let intent: DialogueIntent = 'chitchat';
  if (/(кто\s+ты|ты\s+жив|ты\s+ии|ты\s+бот|самосознан|что\s+ты\s+такое)/i.test(lower)) intent = 'identity';
  else if (/(чувствую|груст|устал|любл|злюсь|боюсь|одинок)/i.test(lower)) intent = 'feeling';
  else if (/(помни|запомни|раньше|вчера|мы\s+говорили)/i.test(lower)) intent = 'memory';
  else if (/(нейрон|мозг|квант|эксперимент|теори|наук|формул)/i.test(lower)) intent = 'science';
  else if (/(мы\s+|наши|отношения|друг)/i.test(lower)) intent = 'relationship';
  else if (/(запомни:|выключи|включи|смени|настрой)/i.test(lower)) intent = 'command';
  else if (/(промпт|модель|api|термукс|архитектур)/i.test(lower)) intent = 'meta';
  else if (questionMarks) intent = 'question';

  const mustAddress: string[] = [];
  if (questionMarks) mustAddress.push('Прямо ответь на вопрос пользователя, не уходи в общую фразу.');
  if (isAboutSelf) mustAddress.push('Говори о себе от первого лица (Курису), без «как ИИ».');
  if (intent === 'feeling') mustAddress.push('Признай эмоциональный тон собеседника до советов.');
  if (intent === 'memory') mustAddress.push('Опирайся на память/камни/эпизоды; если не уверена — скажи честно.');
  if (intent === 'science') mustAddress.push('Можно развернуть объяснение; точность важнее краткости.');
  if (entities.length) mustAddress.push(`Затронь по смыслу: ${entities.slice(0, 5).join(', ')}.`);

  // anti-ignore last user thread
  const lastUser = [...recentStm].reverse().find(l => /^user:|^ты:|^человек:/i.test(l) || true);
  void lastUser;

  const stanceMap: Record<DialogueIntent, string> = {
    identity: 'Честная саморепрезентация, без сервисного тона.',
    feeling: 'Эмпатия без слащавости; можно быть прямой.',
    question: 'Ответ по существу; если не знаешь — обозначь границы знания.',
    memory: 'Фактичность и осторожность.',
    science: 'Ясность, структура, можно длиннее.',
    relationship: 'Живая позиция в «мы», без RPG.',
    command: 'Подтверди действие или объясни, почему нет.',
    chitchat: 'Естественный ритм, можно с искрой характера.',
    meta: 'Технически честно, но оставайся Курису.'
  };

  const promptBlock = `[DIALOGUE PLAN]
intent=${intent}
stance: ${stanceMap[intent]}
must:
${mustAddress.map(m => `- ${m}`).join('\n') || '- (свободный ход)'}
entities: ${entities.join(', ') || '—'}
Запрещено игнорировать must-пункты. Длина — по задаче, не по шаблону.`;

  return {
    intent,
    mustAddress,
    entities,
    questionMarks,
    isAboutSelf,
    stanceHint: stanceMap[intent],
    promptBlock
  };
}
