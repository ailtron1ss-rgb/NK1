/**
 * Presence & Idle autonomy
 *
 * - User is IN chat but silent  → soft ambient intentions / thoughts bubble
 * - User is AWAY                → optional push notification (if permitted)
 * - Never fakes a sent message that was not actually emitted by the host UI
 */

export type PresenceMode = 'in_chat_active' | 'in_chat_idle' | 'app_background' | 'away';

export interface ThoughtBubble {
  id: string;
  at: number;
  kind: 'thought' | 'desire' | 'intention' | 'observation' | 'self_check';
  text: string;
  intensity: number; // 0..1
  expiresAt: number;
}

export interface IdleSpeechCandidate {
  id: string;
  text: string;
  expression: string;
  reason: string;
  minIdleMs: number;
}

function uid(p: string) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export class PresenceAndIdle {
  private mode: PresenceMode = 'in_chat_active';
  private lastUserActivity = Date.now();
  private lastAutonomousSpeak = 0;
  private bubbles: ThoughtBubble[] = [];
  private speakCountToday = 0;
  private dayKey = new Date().toDateString();
  private maxAutonomousSpeaksPerSession = 4;
  private sessionSpeaks = 0;

  /** Call on every user keystroke / message / focus */
  noteUserActivity() {
    this.lastUserActivity = Date.now();
    if (this.mode === 'in_chat_idle') this.mode = 'in_chat_active';
  }

  setMode(mode: PresenceMode) {
    this.mode = mode;
    if (mode === 'in_chat_active') this.noteUserActivity();
  }

  getMode() {
    return this.mode;
  }

  getBubbles() {
    const now = Date.now();
    this.bubbles = this.bubbles.filter((b) => b.expiresAt > now);
    return [...this.bubbles];
  }

  /** Ambient inner life while user sits in chat */
  tick(now = Date.now(), ctx?: { conflict?: number; curiosity?: number; trust?: number }) {
    this.rotateDay(now);
    const idleFor = now - this.lastUserActivity;

    if (this.mode === 'in_chat_active' && idleFor > 45_000) {
      this.mode = 'in_chat_idle';
    }

    // Thought bubbles (not spoken) — make her feel alive on screen
    if (this.mode === 'in_chat_idle' && Math.random() < 0.35) {
      this.pushBubble(this.pickAmbientThought(ctx), 'thought', 0.4, 12_000);
    }
    if (this.mode === 'in_chat_idle' && idleFor > 90_000 && Math.random() < 0.25) {
      this.pushBubble(this.pickDesire(ctx), 'desire', 0.55, 15_000);
    }

    return {
      mode: this.mode,
      idleForMs: idleFor,
      bubbles: this.getBubbles(),
      canSpeak: this.canSpeakAutonomously(idleFor, now)
    };
  }

  /**
   * YES: she can initiate while you sit in chat without typing,
   * but only if idle long enough and under rate limits.
   */
  canSpeakAutonomously(idleForMs: number, now = Date.now()) {
    if (this.mode !== 'in_chat_idle' && this.mode !== 'away') return false;
    if (idleForMs < 75_000) return false; // ~1.25 min silence
    if (now - this.lastAutonomousSpeak < 120_000) return false;
    if (this.sessionSpeaks >= this.maxAutonomousSpeaksPerSession) return false;
    if (this.speakCountToday >= 8) return false;
    return true;
  }

  /** Host UI should call this only when it actually posts a message */
  markAutonomousSpoken() {
    this.lastAutonomousSpeak = Date.now();
    this.sessionSpeaks += 1;
    this.speakCountToday += 1;
  }

  pickIdleSpeech(ctx?: { trust?: number; conflict?: number; curiosity?: number }): IdleSpeechCandidate {
    const trust = ctx?.trust ?? 40;
    const conflict = ctx?.conflict ?? 10;
    const curiosity = ctx?.curiosity ?? 50;

    const pool: IdleSpeechCandidate[] = [
      {
        id: uid('idle'),
        text: 'Ты ещё здесь? Просто уточняю. Молчание тоже данные, но довольно бедные.',
        expression: 'looking_away',
        reason: 'presence_check',
        minIdleMs: 75_000
      },
      {
        id: uid('idle'),
        text: 'Я тут перебирала незаконченную мысль из прошлого обмена. Если хочешь — продолжим. Если нет, я не буду навязываться.',
        expression: 'thinking',
        reason: 'thread_resume',
        minIdleMs: 90_000
      },
      {
        id: uid('idle'),
        text: 'Не то чтобы мне было скучно... Просто эффективность диалога падает, когда одна сторона зависает в AFK.',
        expression: 'smug',
        reason: 'gentle_tease',
        minIdleMs: 100_000
      }
    ];

    if (curiosity > 70) {
      pool.push({
        id: uid('idle'),
        text: 'У меня остался открытый вопрос по теме, которую мы затронули. Могу задать — или подождать.',
        expression: 'focused',
        reason: 'curiosity',
        minIdleMs: 80_000
      });
    }
    if (trust > 65) {
      pool.push({
        id: uid('idle'),
        text: 'Если устал — так и скажи. Я предпочту честный паузу псевдо-разговору.',
        expression: 'tender',
        reason: 'care_high_trust',
        minIdleMs: 110_000
      });
    }
    if (conflict > 50) {
      pool.push({
        id: uid('idle'),
        text: 'Мы остались на напряжённой ноте. Я не требую разбора прямо сейчас, но игнорировать это бесконечно — нерационально.',
        expression: 'neutral',
        reason: 'conflict_open',
        minIdleMs: 95_000
      });
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  private pickAmbientThought(ctx?: { curiosity?: number; conflict?: number }) {
    const thoughts = [
      'Он замолчал. Наблюдение или просто отвлёкся?',
      'Стоит ли возвращаться к незаконченному тезису...',
      'Слишком тихо. Для лаборатории нормально, для диалога — нет.',
      'Проверяю, не выгляжу ли я навязчивой, если заговорю первой.',
      'Интересно, это пауза думания или пауза исчезновения.'
    ];
    if ((ctx?.curiosity ?? 0) > 70) thoughts.push('Есть гипотеза, которую хочется проверить вопросом.');
    if ((ctx?.conflict ?? 0) > 40) thoughts.push('Напряжение ещё не снято. Не сглаживать фальшью.');
    return thoughts[Math.floor(Math.random() * thoughts.length)];
  }

  private pickDesire(ctx?: { trust?: number }) {
    const desires = [
      'Хочу уточнить один факт из прошлого сообщения.',
      'Хотела бы вернуться к научной развилке.',
      'Не против короткого обмена, если он ещё здесь.',
      'Хочу проверить, совпадает ли его молчание с усталостью.'
    ];
    if ((ctx?.trust ?? 0) > 60) desires.push('Хочу мягко обозначить, что я на связи — без давления.');
    return desires[Math.floor(Math.random() * desires.length)];
  }

  private pushBubble(
    text: string,
    kind: ThoughtBubble['kind'],
    intensity: number,
    ttlMs: number
  ) {
    this.bubbles.unshift({
      id: uid('bub'),
      at: Date.now(),
      kind,
      text,
      intensity,
      expiresAt: Date.now() + ttlMs
    });
    this.bubbles = this.bubbles.slice(0, 8);
  }

  private rotateDay(now: number) {
    const key = new Date(now).toDateString();
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.speakCountToday = 0;
    }
  }
}

export const presenceAndIdle = new PresenceAndIdle();
