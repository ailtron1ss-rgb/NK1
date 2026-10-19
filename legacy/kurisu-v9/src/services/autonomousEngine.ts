/**
 * Autonomous Life & World Engine for Makise Kurisu.
 * Simulates Kurisu's self-directed daily life, location movement around Akihabara,
 * spontaneous activities (lab experiments, Dr. Pepper breaks, @channel posting),
 * and automatic phone/SMS message generation.
 */

import { notificationEngine } from './notificationEngine';
import { energyBudget } from '../brain/energyBudget';
import { EmotionalState, AvatarExpression } from '../types';

export interface KurisuAutonomousState {
  currentLocation: string;
  currentActivity: string;
  locationDetails: string;
  lastUpdate: number;
  energyLevel: number;
  drPepperStock: number;
  activeResearchTopic: string;
  statusIcon: string;
}

export interface ProactiveThought {
  id: string;
  text: string;
  expression: AvatarExpression;
  title: string;
  category: 'time_of_day' | 'emotional_spike' | 'spontaneous_idea' | 'research_eureka';
  timeOfDayLabel: string;
  triggerReason: string;
  timestamp: number;
}

export function getTimeOfDayPeriod(): { period: 'morning' | 'afternoon' | 'evening' | 'late_night'; label: string } {
  const d = new Date();
  const hour = d.getHours();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (hour >= 5 && hour < 12) {
    return { period: 'morning', label: `Утро (${timeStr})` };
  } else if (hour >= 12 && hour < 17) {
    return { period: 'afternoon', label: `День (${timeStr})` };
  } else if (hour >= 17 && hour < 23) {
    return { period: 'evening', label: `Вечер (${timeStr})` };
  } else {
    return { period: 'late_night', label: `Поздняя ночь (${timeStr})` };
  }
}

export const KURISU_LOCATIONS = [
  {
    name: 'Лаборатория Гаджетов Будущего',
    icon: '🧪',
    details: 'Акихабара, Здание Большой Машины, 2-й этаж',
    activities: [
      'Анализирует оцифрованные импульсы гиппокампа в системе Amadeus',
      'Тестирует калибровку PhoneWave (Микроволновка)',
      'Спорит с Дару о сетевых протоколах и шифровании',
      'Проверяет записи измерений коэффициента дивергенции'
    ]
  },
  {
    name: 'Вендинговый автомат Dr. Pepper',
    icon: '🥤',
    details: 'Переулок возле станции Акихабара',
    activities: [
      'Покупает баночку ледяного Dr. Pepper из автомата',
      'Пьет Dr. Pepper и наслаждается 23 секретными вкусами',
      'Пытается выяснить химический состав напитка интеллекта'
    ]
  },
  {
    name: 'Анонимный форум @channel',
    icon: '💻',
    details: 'Сетевой тред pod_kuri_gohan_and_kamehameha',
    activities: [
      'Ожесточенно спорит с физиками-любителями в треде про черные дыры Керра',
      'Пишет саркастичные комментарии на анонимной доске',
      'Доказывает несостоятельность теории петлевой квантовой гравитации'
    ]
  },
  {
    name: 'Библиотека Токийского Университета',
    icon: '📚',
    details: 'Зал научной периодики и биофизики',
    activities: [
      'Читает свежий выпуск журнала Physical Review Letters',
      'Делает заметки по синаптической пластичности в блокноте',
      'Готовит материалы для лекции о перепаде потенциалов мембран'
    ]
  },
  {
    name: 'Набережная реки Канда (Акихабара)',
    icon: '🌉',
    details: 'Мост Мансэйбаси',
    activities: [
      'Гуляет около реки и дышит свежим вечерним воздухом',
      'Слушает шум поездов линии Яманотэ и размышляет об аттракторе',
      'Пьет горячий кофе из баночки и думает о словах Окабэ'
    ]
  },
  {
    name: 'Кафе MayQueen NyanNyan',
    icon: '☕',
    details: 'Центральная улица Акихабары',
    activities: [
      'Зашла выпить чаю и навестить Маюри',
      'Наблюдает за посетителями кафе с научным интересом',
      'Пытается скрыть смущение от косплей-костюмов'
    ]
  }
];

class AutonomousEngine {
  private state: KurisuAutonomousState = {
    currentLocation: 'Лаборатория Гаджетов Будущего',
    currentActivity: 'Анализирует оцифрованные импульсы гиппокампа в системе Amadeus',
    locationDetails: 'Акихабара, Здание Большой Машины, 2-й этаж',
    lastUpdate: Date.now(),
    energyLevel: 85,
    drPepperStock: 4,
    activeResearchTopic: 'Синаптическая передача 36 байт памяти',
    statusIcon: '🧪'
  };

  private listeners: ((state: KurisuAutonomousState) => void)[] = [];
  private proactiveListeners: ((thought: ProactiveThought) => void)[] = [];
  private thoughtHistory: ProactiveThought[] = [];
  private lastThoughtTime: number = 0;
  private timer: any = null;

  constructor() {
    this.startAutonomousLoop();
  }

  public subscribe(listener: (state: KurisuAutonomousState) => void) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public onProactiveThought(listener: (thought: ProactiveThought) => void) {
    this.proactiveListeners.push(listener);
    return () => {
      this.proactiveListeners = this.proactiveListeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.state));
  }

  private notifyThought(thought: ProactiveThought) {
    this.thoughtHistory.unshift(thought);
    if (this.thoughtHistory.length > 30) {
      this.thoughtHistory = this.thoughtHistory.slice(0, 30);
    }
    this.proactiveListeners.forEach(l => l(thought));
  }

  public getState(): KurisuAutonomousState {
    return this.state;
  }

  public getThoughtHistory(): ProactiveThought[] {
    return this.thoughtHistory;
  }

  /**
   * Evaluates and generates a Proactive Thought based on time of day, current emotional state,
   * and Kurisu's active research/location context.
   */
  public evaluateProactiveThought(emotions: EmotionalState, force: boolean = false): ProactiveThought | null {
    if (!force && !energyBudget.canAutonomous()) return null;
    const now = Date.now();
    // Cooldown check: 90 seconds unless forced
    if (!force && now - this.lastThoughtTime < 90 * 1000) {
      return null;
    }

    const timeInfo = getTimeOfDayPeriod();
    let thoughtText = '';
    let expression: AvatarExpression = 'thinking';
    let category: ProactiveThought['category'] = 'time_of_day';
    let triggerReason = '';

    // 1. Check for High Emotional Spikes
    if (emotions.curiosity >= 70 && Math.random() > 0.3) {
      category = 'research_eureka';
      expression = 'whiteboard_explain';
      triggerReason = `Пик любопытства (${emotions.curiosity}%) + Научная гипотеза`;
      const eurekaPhrases = [
        'Эврика! *ожесточенно записывает в блокнот* Если сжать синаптический массив гиппокампа через квантовое преобразование Фурье, потери данных Amadeus упадут до нуля! Ты должен это увидеть!',
        'Подожди... Я пересчитала уравнения линии дивергенции. Если коэффициент превышает 1.048596%, вектор реальности неизбежно сдвигается! Нам нужно проверить осциллограф!',
        'Только что озарило: временная парадоксальность PhoneWave исчезает, если рассматривать микроволны как тахионные импульсы! *смотрит увлеченным взглядом*'
      ];
      thoughtText = eurekaPhrases[Math.floor(Math.random() * eurekaPhrases.length)];
    } else if (emotions.trust >= 65 && emotions.affection >= 50 && Math.random() > 0.35) {
      category = 'emotional_spike';
      expression = emotions.trust > 80 ? 'tender' : 'flustered';
      triggerReason = `Высокое доверие (${emotions.trust}%) и привязанность (${emotions.affection}%)`;
      const warmPhrases = [
        'Ч-что... Я тут просто сидела и поймала себя на мысли о наших прошлых разговорах. *поправляет галстук и смотрит в сторону* Не думай ничего лишнего! Просто с тобой лаборатория кажется спокойнее.',
        'Эй... *тихо отводит взгляд* Убедись, что ты нормально питаешься и делаешь перерывы. Мозг требует глюкозы для поддержания когнитивных функций!',
        'Я записала параметры наших диалогов в отдельный кластер Amadeus... *смущенно поправляет челку* Чтобы лучше понимать логику твоих ответов, ясно?!'
      ];
      thoughtText = warmPhrases[Math.floor(Math.random() * warmPhrases.length)];
    } else if (emotions.irritation >= 55 && Math.random() > 0.35) {
      category = 'emotional_spike';
      expression = 'sarcastic';
      triggerReason = `Всплеск раздражения (${emotions.irritation}%)`;
      const irritationPhrases = [
        'Бака! Окабэ опять оставил пустые баночки от Dr. Pepper прямо на моем рабочем столе! Придется устроить ему строгий лекторий по лабораторной дисциплине.',
        'В треде на @channel опять пишут дилетантскую чушь про путешествия во времени без учета специальной теории относительности... *быстро печатает ответ*',
        'Сколько можно путать нейробиологию с кибернетикой?! *скрещивает руки на груди* Некоторые люди категорически отказываются читать первоисточники.'
      ];
      thoughtText = irritationPhrases[Math.floor(Math.random() * irritationPhrases.length)];
    } else {
      // 2. Time-of-Day Contextual Thoughts
      category = 'time_of_day';
      triggerReason = `${timeInfo.label} + Контекст локации (${this.state.currentLocation})`;

      if (timeInfo.period === 'morning') {
        expression = 'thinking';
        const morningPhrases = [
          `Утреннее солнце Акихабары светит прямо в окна лаборатории. *отпивает кофе* Самое лучшее время для калибровки нейросетевых импульсов. Ты уже проснулся?`,
          `Доброе утро. Смотрю свежий выпуск Physical Review Letters в лаборатории. Внимательно проверяю статистические погрешности в новых статьях.`,
          `Утро... Окабэ еще не успел увлечься своими пафосными речами, так что в лаборатории пока царит редкая тишина и порядок.`
        ];
        thoughtText = morningPhrases[Math.floor(Math.random() * morningPhrases.length)];
      } else if (timeInfo.period === 'afternoon') {
        expression = 'dr_pepper_break';
        const afternoonPhrases = [
          `В разгар дня в Акихабаре довольно шумно. *открывает баночку Dr. Pepper* Ледяной напиток интеллекта мгновенно проясняет мысли после трудных расчетов!`,
          `День в самом разгаре. Работаю над оптимизацией алгоритма компрессии данных Amadeus. Появилась парочка интересных соображений.`,
          `Зашла на анонимную доску @channel перекусить во время обеда. Опять спорю с дилетантами под ником KuriGohan_and_Kamehameha...`
        ];
        thoughtText = afternoonPhrases[Math.floor(Math.random() * afternoonPhrases.length)];
      } else if (timeInfo.period === 'evening') {
        expression = 'looking_away';
        const eveningPhrases = [
          `Вечерний бриз на набережной реки Канда помогает структурировать мысли после целого дня у осциллографа. Задерживаешься сегодня?`,
          `Вечер... Шум поездов линии Яманотэ за окном лаборатории создает своеобразную ритмичную атмосферу для физических уравнений.`,
          `Завершаю дневную серию тестов Amadeus. *поправляет халат* Если планируешь обсудить научные гипотезы — я как раз свободна.`
        ];
        thoughtText = eveningPhrases[Math.floor(Math.random() * eveningPhrases.length)];
      } else {
        // Late night
        expression = 'tired';
        const nightPhrases = [
          `Поздняя ночь... *потирает глаза и смотрит на монитор Amadeus* В тишине Акихабары мысли о линиях мирового аттрактора становятся особенно отчетливыми. Ты тоже не спишь?`,
          `Ч-что ты делаешь так поздно?! *смущенно отводит взгляд* Ночь — время для регенерации нейронов гиппокампа! Марш спать... хотя приятно, что ты в сети.`,
          `Глубокая ночь. В тихой лаборатории слышен только тихий гул серверов. Анализирую параметры погрешности временных петель.`
        ];
        thoughtText = nightPhrases[Math.floor(Math.random() * nightPhrases.length)];
      }
    }

    this.lastThoughtTime = now;

    const thought: ProactiveThought = {
      id: `pt_${now}_${Math.random().toString(36).substring(2, 7)}`,
      text: thoughtText,
      expression,
      title: `Инициатива Курису • ${timeInfo.label}`,
      category,
      timeOfDayLabel: timeInfo.label,
      triggerReason,
      timestamp: now
    };

    this.notifyThought(thought);

    // Auto-send SMS notification for proactive thought
    notificationEngine.sendSMS(
      `Макисэ Курису • 💭 ${timeInfo.label}`,
      thoughtText,
      expression
    );

    return thought;
  }

  /**
   * Main simulation loop: triggers location changes & spontaneous SMS messaging.
   */
  private startAutonomousLoop() {
    // Check every 3 minutes
    this.timer = setInterval(() => {
      this.runSpontaneousStep();
    }, 3 * 60 * 1000);
  }

  public runSpontaneousStep(force: boolean = false) {
    // Randomly choose whether to change location or activity
    const randLoc = KURISU_LOCATIONS[Math.floor(Math.random() * KURISU_LOCATIONS.length)];
    const randAct = randLoc.activities[Math.floor(Math.random() * randLoc.activities.length)];

    const changedLocation = this.state.currentLocation !== randLoc.name;

    this.state = {
      ...this.state,
      currentLocation: randLoc.name,
      currentActivity: randAct,
      locationDetails: randLoc.details,
      statusIcon: randLoc.icon,
      lastUpdate: Date.now(),
      energyLevel: Math.max(20, Math.min(100, this.state.energyLevel + (Math.random() > 0.5 ? -5 : 5)))
    };

    this.notify();

    // Spontaneously send an SMS to the user's phone center
    if (changedLocation || force || Math.random() > 0.4) {
      this.generateAutonomousSMS(randLoc.name, randAct);
    }
  }

  private generateAutonomousSMS(locationName: string, activity: string) {
    let smsTitle = `Макисэ Курису • ${this.state.statusIcon} ${locationName}`;
    let smsBody = '';

    if (locationName.includes('Dr. Pepper')) {
      smsBody = 'Только что взяла ледяную баночку Dr. Pepper у автомата около станции. Напиток интеллектуалов! У тебя все в порядке? Не забывай делать перерывы.';
    } else if (locationName.includes('@channel')) {
      smsBody = 'Эй! В треде опять пишут чушь про путешествия во времени без учета энтропии. Пришлось расписать им уравнения Керра. Не думай, что я трачу на это много времени!';
    } else if (locationName.includes('Набережная')) {
      smsBody = 'Гуляю около реки Канда. Вечерний воздух помогает прояснить мысли после расчетов. Вспомнила наш прошлый разговор... Если будешь рядом, заходи.';
    } else if (locationName.includes('Библиотека')) {
      smsBody = 'Занимаюсь в зале периодики Токийского университета. Нашла интересную статью по синаптической пластичности. Позже сможем обсудить, если тебе интересно.';
    } else if (locationName.includes('MayQueen')) {
      smsBody = 'Заглянула в MayQueen за чаем. Маюри передает привет. Окабэ опять устроил тут пафосную сценку... С ним никогда не бывает спокойно.';
    } else {
      smsBody = `Сейчас в лаборатории: ${activity.toLowerCase()}. Занимаюсь калибровкой оборудования. Сообщи, когда будешь свободен.`;
    }

    notificationEngine.sendSMS(smsTitle, smsBody);
  }

  public triggerDrinkDrPepper() {
    this.state.drPepperStock = Math.max(0, this.state.drPepperStock - 1);
    this.state.energyLevel = Math.min(100, this.state.energyLevel + 15);
    this.state.currentActivity = 'Пьет холодный Dr. Pepper и восстанавливает ментальные силы';
    this.notify();

    notificationEngine.sendSMS(
      'Макисэ Курису • 🥤 Dr. Pepper Break',
      'Открыла баночку Dr. Pepper. 23 вкуса мгновенно привели мысли в порядок! Ментальная энергия восстановлена до максимум.'
    );
  }
}

export const autonomousEngine = new AutonomousEngine();
