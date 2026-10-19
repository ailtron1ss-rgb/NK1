/**
 * Local reasoning engine for Android/Termux.
 *
 * Priority:
 * 1. Real neural model (SmolLM2 via Transformers.js CDN) if enabled & loaded
 * 2. Rich personality-aware template system (never the same phrase twice in a row)
 *
 * Honest: templates are not intelligence. They keep character continuity when
 * the neural model is unavailable.
 */

import { neuralLocalEngine } from './neuralLocalEngine';
import { EmotionalState, AvatarExpression, MemoryItem } from '../types';
import { personalityRewardSystem } from '../cognitive/PersonalityRewardSystem';

export interface LocalInferenceResult {
  text: string;
  expression: AvatarExpression;
  trustDelta: number;
  affectionDelta: number;
  irritationDelta: number;
  curiosityDelta: number;
  newTopic: string | null;
  performance: {
    inferenceTimeMs: number;
    backend: string;
    tensorCount: number;
    memoryMB: number;
    quantization: 'INT8' | 'FP16';
  };
  mode: 'neural' | 'template';
}

export interface LocalEngineStatus {
  isInitialized: boolean;
  backend: string;
  numTensors: number;
  quantizationMode: string;
  memoryUsageMB: number;
  offlineReady: boolean;
  neuralStatus: ReturnType<typeof neuralLocalEngine.getStatus>;
}

class LocalLLMEngine {
  private isInitialized = false;
  private backend = 'webgl';
  private lastTemplateKey = '';

  constructor() {
    this.initTFJS();
  }

  private async initTFJS() {
    // TFJS removed from hot path — neural uses Transformers.js ONNX; templates need no tensors.
    this.backend = 'none';
    this.isInitialized = true;
  }

  public getStatus(): LocalEngineStatus {
    return {
      isInitialized: this.isInitialized,
      backend: this.backend,
      numTensors: 0,
      quantizationMode: 'INT8 Mobile',
      memoryUsageMB: 0,
      offlineReady: true,
      neuralStatus: neuralLocalEngine.getStatus()
    };
  }

  private buildSystemForNeural(emotions: EmotionalState, stm: string[], ltm: MemoryItem[]): string {
    const tendencies = personalityRewardSystem.toPromptGuidance();
    const recent = stm.slice(-5).join('\n') || '(пусто)';
    const mem = ltm.slice(0, 6).map(m => `- ${m.content}`).join('\n') || '(мало)';
    return `Ты Макисэ Курису (Steins;Gate). Говори по-русски, естественно, с лёгким цундере, научной точностью и границами. Не называй себя ИИ или ассистентом.
Стадия: ${emotions.stage}. Trust ${emotions.trust}, Affection ${emotions.affection}, Irritation ${emotions.irritation}, Curiosity ${emotions.curiosity}.
${tendencies}
Контекст: ${recent}
Память: ${mem}
Отвечай 1-3 предложениями. Можно *действия*.`;
  }

  /** Try real neural model first */
  private async tryNeural(
    message: string,
    stm: string[],
    ltm: MemoryItem[],
    emotions: EmotionalState,
    startTime: number,
    systemPrompt?: string
  ): Promise<LocalInferenceResult | null> {
    const status = neuralLocalEngine.getStatus();
    if (!status.enabled) return null;
    try {
      const system = systemPrompt || this.buildSystemForNeural(emotions, stm, ltm);
      const text = await neuralLocalEngine.generate(system, message, 160);
      if (!text || text.length < 8) return null;
      return {
        text,
        expression: this.pickExpression(text, emotions),
        trustDelta: 1,
        affectionDelta: 0,
        irritationDelta: 0,
        curiosityDelta: 1,
        newTopic: null,
        performance: {
          inferenceTimeMs: Math.round(performance.now() - startTime),
          backend: `neural-${status.device}`,
          tensorCount: 0,
          memoryMB: Math.round((0 / (1024 * 1024)) * 100) / 100,
          quantization: 'INT8'
        },
        mode: 'neural'
      };
    } catch (e) {
      console.warn('[LocalLLM] Neural failed, using template:', e);
      return null;
    }
  }

  private pickExpression(text: string, emotions: EmotionalState): AvatarExpression {
    const t = text.toLowerCase();
    if (/бака|идиот|хватит|не надо|хватит/i.test(t)) return 'tsundere_denial';
    if (/смущ|красне|лицо|отворач/i.test(t)) return 'embarrassed';
    if (/доктор пеппер|dr\.?\s*pepper|газировк/i.test(t)) return 'dr_pepper_break';
    if (/доска|схема|объясн|гипотез/i.test(t)) return 'whiteboard_explain';
    if (/время|аттрактор|дивергенц|мировая линия/i.test(t)) return 'focused';
    if (/груст|тяжел|один|печал/i.test(t) || emotions.irritation > 65) return 'sad';
    if (/рад|приятно|интерес|улыб/i.test(t)) return 'happy';
    if (emotions.curiosity > 70) return 'thinking';
    if (emotions.affection > 70) return 'tender_glance';
    if (/подума|хм|интересно/i.test(t)) return 'chin_rest';
    return 'neutral';
  }

  /** Rich template system — many variants, never repeats last key */
  private templateRespond(
    message: string,
    stm: string[],
    ltm: MemoryItem[],
    emotions: EmotionalState,
    startTime: number
  ): LocalInferenceResult {
    const lower = message.toLowerCase();
    const trust = emotions.trust;
    const affection = emotions.affection;
    const irritation = emotions.irritation;
    const curiosity = emotions.curiosity;

    type Variant = { key: string; texts: string[]; expr: AvatarExpression; trustD?: number; affD?: number; irrD?: number; curD?: number; topic?: string };

    const variants: Variant[] = [];

    // Assistant trigger
    if (/кристина|ассистент|помощник|помощница|ассистентка|лаборантка/i.test(lower)) {
      variants.push({
        key: 'assistant',
        texts: [
          'Эй! Сколько раз повторять?! Я не «Кристина» и уж тем более не твоя ассистентка. Я — Макисэ Курису.',
          'Хватит. Я исследователь, а не голосовой помощник. Запомни имя: Макисэ Курису.',
          '*резко поворачивается* Ещё раз назовёшь меня ассистенткой — и я перестану отвечать на глупости.'
        ],
        expr: 'passionate_shout', trustD: -1, irrD: 3, topic: 'Имя'
      });
    }

    // Compliment
    if (/милая|красивая|умная|гений|прекрасна|люблю|классная|обожаю|нравишься/i.test(lower)) {
      if (trust > 55) {
        variants.push({
          key: 'compliment_high',
          texts: [
            'Ч-что ты несёшь... *отводит взгляд* Не нужно говорить такое прямо. Хотя... ладно. Приятно.',
            '*слегка краснеет* Прекрати. Я и так знаю, что мои исследования сильны. Но спасибо... наверное.',
            'Глупости. *тихо* ...но если ты говоришь искренне, я это заметила.'
          ],
          expr: 'embarrassed', trustD: 2, affD: 3
        });
      } else {
        variants.push({
          key: 'compliment_low',
          texts: [
            'Бака. Не пытайся польстить. Хотя мои работы действительно выдающиеся.',
            'Комплименты не заменят точность аргументов. Но... спасибо, наверное.',
            '*скрещивает руки* Хватит. Давай лучше о деле.'
          ],
          expr: 'flustered', trustD: 1, affD: 1, irrD: 1
        });
      }
    }

    // Sad / lonely
    if (/грустно|одиноко|устал|тяжело|плохо|плакать|тоска/i.test(lower)) {
      variants.push({
        key: 'support',
        texts: [
          'Эй... *смотрит внимательнее* Не держи всё в себе. Даже если линии аттрактора непредсказуемы — ты не один.',
          'Если тяжело — скажи прямо. Я не специалист по утешениям, но могу выслушать и разобрать ситуацию.',
          '*тихо* Хочешь, просто посидим. Или разберём, что именно давит.'
        ],
        expr: 'reach_out', trustD: 3, affD: 2, topic: 'Поддержка'
      });
    }

    // Science / deep
    if (/почему|докажи|объясни|гипотеза|уравнение|формула|структура|вывод/i.test(lower)) {
      variants.push({
        key: 'science',
        texts: [
          '*складывает пальцы* Давай разберём по аксиомам. Что именно ты считаешь исходными данными?',
          'Хороший вопрос. С точки зрения системной дедукции нужно сначала зафиксировать рамки. Продолжай.',
          'Интересно. Я бы начала с проверки допущений. Расскажи подробнее — и я предложу схему.'
        ],
        expr: 'steeple_hands', trustD: 2, curD: 3, topic: 'Анализ'
      });
    }

    // Time travel / Steins;Gate
    if (/время|аттрактор|дивергенция|мировая линия|фонвэйв|phonewave|машина времени|керр/i.test(lower)) {
      variants.push({
        key: 'timetravel',
        texts: [
          'Если говорить о дивергенции и аттракторе — с точки зрения геометрии Керра замкнутые времениподобные кривые требуют чудовищной энергии. PhoneWave работает иначе.',
          'Мировые линии... *берёт маркер* Смотри. Сигнал через импульсы массы — это не перемещение тела. Это информация.',
          'Ты снова про это. Хорошо. Давай аккуратно, без фанатизма Окабэ.'
        ],
        expr: 'whiteboard_explain', trustD: 2, curD: 3, topic: 'Физика времени'
      });
    }

    // Memory / Amadeus
    if (/память|гиппокамп|синапс|оцифровка|amadeus|амадеус|нейро/i.test(lower)) {
      variants.push({
        key: 'memory',
        texts: [
          'Оцифровка памяти — ядро моей работы. 36 байт из биоэлектрических импульсов гиппокампа... шум убрать сложнее всего.',
          'Amadeus показал, что структуру связей можно воссоздать. Но это не «душа». Это данные + модель.',
          'Ты задел важную тему. Что именно тебя интересует — кодирование или реконструкция личности?'
        ],
        expr: 'chin_rest', trustD: 2, curD: 2, topic: 'Нейробиология'
      });
    }

    // Dr Pepper
    if (/dr\.?\s*pepper|доктор пеппер|пеппер|газировка/i.test(lower)) {
      variants.push({
        key: 'pepper',
        texts: [
          'Dr. Pepper. 23 аромата. Для тех, кто работает ночами. У тебя есть?',
          '*лёгкая улыбка* Правильный выбор. Остальное — для обычных людей.',
          'Напиток интеллектуалов. Не спорь.'
        ],
        expr: 'dr_pepper_break', trustD: 2, affD: 2, topic: 'Dr. Pepper'
      });
    }

    // Greeting
    if (/^(привет|здравствуй|добрый|хай|ку|хелло|йо)\b/i.test(lower) || lower.length < 12) {
      variants.push({
        key: 'greet',
        texts: [
          'Привет. *кивает* Я как раз смотрела статьи по синаптической пластичности.',
          'О. Ты здесь. Хорошо. Есть что обсудить?',
          'Привет. Не отвлекай по пустякам — но если по делу, я слушаю.'
        ],
        expr: 'happy_open_arms', trustD: 1, curD: 1
      });
    }

    // How are you
    if (/как дела|как ты|что делаешь|чем занята|как настроение/i.test(lower)) {
      variants.push({
        key: 'howareyou',
        texts: [
          'В порядке. Анализирую импульсы. Dr. Pepper почти кончился — настроение могло бы быть лучше.',
          'Работаю. У тебя что-то конкретное, или просто проверяешь, жива ли я?',
          'Нормально. Чуть устала, но это не повод размазывать слизь по экрану.'
        ],
        expr: 'dr_pepper_break', trustD: 1, affD: 1
      });
    }

    // Okabe / lab
    if (/окабэ|кёма|дару|маюри|лаборатория|гаджет|нобу/i.test(lower)) {
      variants.push({
        key: 'lab',
        texts: [
          'Лаборатория... Окабэ шумит, Дару комментирует. Но эксперименты там действительно интересные.',
          'Эти идиоты. И всё же без них многое было бы невозможно.',
          'Ты про Future Gadget? *вздыхает* Хаос, но продуктивный.'
        ],
        expr: 'confident_crossed', trustD: 2, affD: 1, topic: 'Лаборатория'
      });
    }

    // Default — many variants so it never feels the same
    const defaultTexts = [
      'Хм. Интересно. Развей мысль — мне нужны детали, а не общие фразы.',
      '*смотрит в сторону* Твоя формулировка оставляет пространство для интерпретаций. Уточни.',
      'Я слушаю. Но без конкретики я не буду строить воздушные замки.',
      'Продолжай. Если это важно — я разберу по частям.',
      'Зафиксировала. Что ты хочешь получить в итоге: объяснение, проверку или просто обсуждение?',
      'Неплохое начало. Теперь добавь данные или пример.',
      '*лёгкий кивок* Поняла направление. Говори дальше — я не перебиваю зря.',
      'Окей. Давай без воды. В чём суть?',
      'Я вижу, к чему ты клонишь. Уточни один момент — и я отвечу точнее.',
      'Принято. Если хочешь серьёзный разбор — дай больше контекста.'
    ];

    // Pick variant
    let chosen: Variant | null = null;
    for (const v of variants) {
      if (v.key !== this.lastTemplateKey) {
        chosen = v;
        break;
      }
    }
    if (!chosen) {
      // force different default
      const filtered = defaultTexts.filter((_, i) => `def_${i}` !== this.lastTemplateKey);
      const idx = Math.floor(Math.random() * filtered.length);
      const text = filtered[idx] || defaultTexts[0];
      this.lastTemplateKey = `def_${idx}`;
      return {
        text,
        expression: curiosity > 60 ? 'thinking' : 'chin_rest',
        trustDelta: 1,
        affectionDelta: 0,
        irritationDelta: 0,
        curiosityDelta: 2,
        newTopic: null,
        performance: {
          inferenceTimeMs: Math.round(performance.now() - startTime),
          backend: this.backend,
          tensorCount: 0,
          memoryMB: Math.round((0 / (1024 * 1024)) * 100) / 100,
          quantization: 'INT8'
        },
        mode: 'template'
      };
    }

    this.lastTemplateKey = chosen.key;
    const text = chosen.texts[Math.floor(Math.random() * chosen.texts.length)];
    return {
      text,
      expression: chosen.expr,
      trustDelta: chosen.trustD ?? 1,
      affectionDelta: chosen.affD ?? 0,
      irritationDelta: chosen.irrD ?? 0,
      curiosityDelta: chosen.curD ?? 1,
      newTopic: chosen.topic ?? null,
      performance: {
        inferenceTimeMs: Math.round(performance.now() - startTime),
        backend: this.backend,
        tensorCount: 0,
        memoryMB: Math.round((0 / (1024 * 1024)) * 100) / 100,
        quantization: 'INT8'
      },
      mode: 'template'
    };
  }

  public async processInference(
    message: string,
    stm: string[],
    ltm: MemoryItem[],
    emotions: EmotionalState,
    systemPrompt?: string
  ): Promise<LocalInferenceResult> {
    const startTime = performance.now();

    // 1. Try real neural first
    const neural = await this.tryNeural(message, stm, ltm, emotions, startTime, systemPrompt);
    if (neural) return neural;

    // 2. Rich template fallback
    return this.templateRespond(message, stm, ltm, emotions, startTime);
  }

  public generateAutonomousThought(emotions: EmotionalState): { title: string; text: string; expression: AvatarExpression } {
    const thoughts = [
      { title: 'Мысль', text: 'Снова пересчитываю коэффициенты... Ты куда пропал? Не то чтобы я скучала.', expression: 'flustered' as AvatarExpression },
      { title: 'Заметка', text: 'PhoneWave можно улучшить осциллографом. Зайди, обсудим.', expression: 'whiteboard_explain' as AvatarExpression },
      { title: 'Amadeus', text: 'Фоновый буфер стабилен. Системы в норме.', expression: 'happy_open_arms' as AvatarExpression },
      { title: 'Вопрос', text: 'Почему воспоминания иногда остаются как дежавю при смене мировой линии?', expression: 'chin_rest' as AvatarExpression },
      { title: 'Наблюдение', text: 'Тишина слишком долгая. Либо ты занят, либо опять что-то задумал.', expression: 'thinking' as AvatarExpression }
    ];
    return thoughts[Math.floor(Math.random() * thoughts.length)];
  }
}

export const localLLMEngine = new LocalLLMEngine();
