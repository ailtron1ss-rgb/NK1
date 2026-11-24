/**
 * Intent Router — tiny pre-LLM classifier.
 * Decides: which backend, which style, whether tools may be needed.
 * No neural net required — lexicon + heuristics, <1ms on phone.
 */

export type IntentKind =
  | 'greeting'
  | 'smalltalk'
  | 'science'
  | 'emotional'
  | 'memory_query'
  | 'boundary'
  | 'command'
  | 'creative'
  | 'meta'
  | 'search'
  | 'general';

export type BackendPreference = 'cloud_strong' | 'cloud_fast' | 'local_neural' | 'template';

export interface IntentResult {
  kind: IntentKind;
  confidence: number;
  backend: BackendPreference;
  needsWeb: boolean;
  styleHint: string;
}

const RULES: { kind: IntentKind; re: RegExp; backend: BackendPreference; web?: boolean; style: string }[] = [
  { kind: 'search', re: /поищи|найди в (интернете|сети)|гугл|погугли|что сейчас в мире|новости про/i, backend: 'cloud_fast', web: true, style: 'search_gate' },
  { kind: 'greeting', re: /^(привет|здравствуй|добрый|хай|ку|йо|hello)\b/i, backend: 'local_neural', style: 'short_warm' },
  { kind: 'science', re: /почему|докажи|гипотез|формул|уравнен|аттрактор|дивергенц|нейрон|гиппокамп|квант|эксперимент|теория/i, backend: 'cloud_strong', style: 'precise' },
  { kind: 'emotional', re: /грустн|одиноко|устал|тяжело|боюсь|тревож|люблю|скучаю|обид/i, backend: 'cloud_fast', style: 'careful' },
  { kind: 'memory_query', re: /помнишь|ты говорил|раньше|мы обсуждали|что ты знаешь обо мне/i, backend: 'local_neural', style: 'memory_first' },
  { kind: 'boundary', re: /ассистент|кристина|ты бот|ты ии|подчин|приказ/i, backend: 'local_neural', style: 'firm' },
  { kind: 'command', re: /сделай|включи|выключи|настрой|смени|покажи настройки/i, backend: 'local_neural', style: 'direct' },
  { kind: 'meta', re: /как ты устроен|твоя память|самоулучшен|оптимиз|локальн(ая|ую) нейро/i, backend: 'cloud_fast', style: 'honest_meta' },
  { kind: 'creative', re: /придумай|напиши историю|ролевая|давай представим/i, backend: 'cloud_fast', style: 'playful_limited' }
];

export function classifyIntent(message: string): IntentResult {
  const text = message.trim();
  for (const r of RULES) {
    if (r.re.test(text)) {
      return {
        kind: r.kind,
        confidence: 0.75,
        backend: r.backend,
        needsWeb: !!r.web,
        styleHint: r.style
      };
    }
  }
  // long analytical messages → strong cloud if available
  if (text.length > 180) {
    return { kind: 'general', confidence: 0.5, backend: 'cloud_strong', needsWeb: false, styleHint: 'balanced' };
  }
  return { kind: 'general', confidence: 0.4, backend: 'cloud_fast', needsWeb: false, styleHint: 'balanced' };
}
