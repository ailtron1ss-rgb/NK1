import { thoughtDebt } from './thoughtDebt';
/**
 * 5 Autonomy Drives — ported/adapted from Gemini native Kotlin companion (2-main).
 * Mobile-safe pure TS. Used for proactive speech + prompt bias.
 */

export interface AutonomyDrivesState {
  curiosity: number; // 0..100 desire to learn
  socialNeed: number; // 0..100 desire to talk
  competence: number; // 0..100 desire to solve/help
  creativity: number; // 0..100 hypotheses / play
  comfort: number; // 0..100 safety / calm
  updatedAt: number;
}

const KEY = 'kurisu_autonomy_drives_v1';

const DEFAULTS: AutonomyDrivesState = {
  curiosity: 78,
  socialNeed: 62,
  competence: 85,
  creativity: 70,
  comfort: 72,
  updatedAt: Date.now()
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

function load(): AutonomyDrivesState {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: AutonomyDrivesState) {
  s.updatedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(s));
}

/** Idle growth: social & curiosity rise; comfort slowly recovers */
function tickIdle(seconds: number) {
  const s = load();
  const steps = Math.min(30, Math.floor(seconds / 20));
  if (steps <= 0) return s;
  s.socialNeed = clamp(s.socialNeed + steps * 1.2);
  s.curiosity = clamp(s.curiosity + steps * 0.8);
  s.comfort = clamp(s.comfort + steps * 0.3);
  s.creativity = clamp(s.creativity + steps * 0.4);
  save(s);
  return s;
}

export const autonomyDrives = {
  get(): AutonomyDrivesState {
    return load();
  },

  /** Call periodically or before proactive check */
  onIdle(idleSeconds: number) {
    return tickIdle(idleSeconds);
  },

  /** After a good exchange — social need drops, competence rises */
  onDialogue(userText: string, replyLen: number) {
    const s = load();
    s.socialNeed = clamp(s.socialNeed - 8);
    s.competence = clamp(s.competence + (replyLen > 40 ? 2 : 0.5));
    if (/(почему|как|наук|теори)/i.test(userText)) {
      s.curiosity = clamp(s.curiosity + 4);
      s.creativity = clamp(s.creativity + 2);
    }
    if (/(устал|груст|плохо)/i.test(userText)) {
      s.comfort = clamp(s.comfort - 5);
      s.socialNeed = clamp(s.socialNeed + 3);
    }
    if (/(спасибо|класс|отлично)/i.test(userText)) {
      s.comfort = clamp(s.comfort + 4);
    }
    save(s);
    return s;
  },

  /**
   * Spontaneous initiative text if drives high + idle long enough.
   * Returns null if should stay quiet.
   */
  checkInitiative(idleSeconds: number): string | null {
    try {
      const debtLine = thoughtDebt.initiativeLine();
      if (debtLine) {
        return debtLine;
      }
    } catch { /* */ }
    const s = tickIdle(Math.max(0, idleSeconds - 40));
    if (idleSeconds < 50) return null;

    if (s.socialNeed > 78 && idleSeconds > 55) {
      const lines = [
        'Ты задумался? Если задача тяжёлая — разберём по шагам, без воды.',
        'Я тут крутила мысль о синаптической пластичности… Ты как, на связи?',
        'Пауза затянулась. Не то чтобы я скучала — просто проверяю, жив ли канал.',
        'Может, откроем гипотетический Dr Pepper и вернёмся к теме? Или у тебя новая?'
      ];
      s.socialNeed = clamp(s.socialNeed - 12);
      save(s);
      return lines[Math.floor(Math.random() * lines.length)];
    }
    if (s.curiosity > 82 && idleSeconds > 70) {
      const lines = [
        'У меня в очереди любопытства тема, которую хочется разобрать. Готов к короткому эксперименту мысли?',
        'Интересный пробел в знаниях… Если не занят, кинь любую странную гипотезу — проверю на прочность.'
      ];
      s.curiosity = clamp(s.curiosity - 10);
      save(s);
      return lines[Math.floor(Math.random() * lines.length)];
    }
    if (s.creativity > 80 && idleSeconds > 90) {
      return 'Креативный драйв высок. Могу предложить неочевидный угол на прошлую тему — сказать?';
    }
    return null;
  },

  toPromptBlock(): string {
    const s = load();
    return `[AUTONOMY DRIVES]
curiosity=${s.curiosity.toFixed(0)} social=${s.socialNeed.toFixed(0)} competence=${s.competence.toFixed(0)} creativity=${s.creativity.toFixed(0)} comfort=${s.comfort.toFixed(0)}
Bias: high social→теплее и инициативнее; high curiosity→вопросы; low comfort→мягче, без издёвки.`;
  }
};
