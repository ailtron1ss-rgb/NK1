/**
 * EmbodimentSystem — virtual body + emotion sprites + environment awareness
 *
 * Goal: Kurisu has a persistent virtual body state she can "sense":
 * - current expression / pose
 * - outfit
 * - environment (lab, street, desk...)
 * - energy / posture
 *
 * Practical implementation path for the current web app:
 * 1) Sprite sheets (user-provided 8-packs) mapped to expression keys
 * 2) Optional later: Live2D or lightweight 3D
 *
 * She does not magically "see polygons". She receives structured body state
 * and can talk about it coherently (self-as-embodied).
 */

export type ExpressionKey =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'embarrassed'
  | 'thinking'
  | 'surprised'
  | 'flustered'
  | 'focused'
  | 'tired'
  | 'smug'
  | 'tender'
  | 'looking_away'
  | 'sarcastic';

export interface SpriteMapItem {
  key: ExpressionKey;
  /** path inside assets once user slices grids */
  src: string;
  tags: string[];
}

export interface BodyState {
  expression: ExpressionKey;
  secondaryExpression?: ExpressionKey;
  blend: number; // 0..1 toward secondary
  pose: 'standing' | 'sitting' | 'leaning' | 'arms_crossed' | 'chin_rest' | 'writing';
  outfit: string;
  environment: 'lab' | 'desk' | 'city' | 'rain' | 'night_lab' | 'unknown';
  energy: number; // 0..100
  gaze: 'user' | 'away' | 'down' | 'board';
  speaking: boolean;
}

export interface EnvironmentEvent {
  id: string;
  at: number;
  type: 'time_of_day' | 'user_presence' | 'idle' | 'notification_sent' | 'expression_change';
  detail: string;
}

const DEFAULT_SPRITES: SpriteMapItem[] = [
  { key: 'neutral', src: 'assets/expressions/neutral.png', tags: ['base'] },
  { key: 'happy', src: 'assets/expressions/happy.png', tags: ['positive'] },
  { key: 'sad', src: 'assets/expressions/sad.png', tags: ['negative'] },
  { key: 'angry', src: 'assets/expressions/angry.png', tags: ['negative'] },
  { key: 'embarrassed', src: 'assets/expressions/embarrassed.png', tags: ['social'] },
  { key: 'thinking', src: 'assets/expressions/thinking.png', tags: ['cognitive'] },
  { key: 'surprised', src: 'assets/expressions/surprised.png', tags: ['reactive'] },
  { key: 'flustered', src: 'assets/expressions/flustered.png', tags: ['social'] },
  { key: 'focused', src: 'assets/expressions/focused.png', tags: ['cognitive'] },
  { key: 'tired', src: 'assets/expressions/tired.png', tags: ['state'] },
  { key: 'smug', src: 'assets/expressions/smug.png', tags: ['pride'] },
  { key: 'tender', src: 'assets/expressions/tender.png', tags: ['warm'] },
  { key: 'looking_away', src: 'assets/expressions/looking_away.png', tags: ['avoidant'] },
  { key: 'sarcastic', src: 'assets/expressions/sarcastic.png', tags: ['humor'] }
];

export class EmbodimentSystem {
  private body: BodyState = {
    expression: 'neutral',
    blend: 0,
    pose: 'standing',
    outfit: 'lab_shirt_tie_coat',
    environment: 'lab',
    energy: 78,
    gaze: 'user',
    speaking: false
  };
  private sprites: SpriteMapItem[] = [...DEFAULT_SPRITES];
  private events: EnvironmentEvent[] = [];

  getBody(): BodyState {
    return { ...this.body };
  }

  getSprites() {
    return [...this.sprites];
  }

  setExpression(expr: ExpressionKey, opts?: { pose?: BodyState['pose']; gaze?: BodyState['gaze'] }) {
    this.body.expression = expr;
    if (opts?.pose) this.body.pose = opts.pose;
    if (opts?.gaze) this.body.gaze = opts.gaze;
    this.pushEvent('expression_change', `expression → ${expr}`);
  }

  setSpeaking(speaking: boolean) {
    this.body.speaking = speaking;
  }

  setEnvironment(env: BodyState['environment']) {
    this.body.environment = env;
    this.pushEvent('time_of_day', `environment → ${env}`);
  }

  /**
   * Map emotional vector to body (simple, interpretable).
   */
  applyEmotions(e: {
    irritation?: number;
    fatigue?: number;
    curiosity?: number;
    affection?: number;
    happiness?: number;
  }) {
    if ((e.fatigue ?? 0) > 70) {
      this.setExpression('tired', { pose: 'sitting', gaze: 'down' });
      this.body.energy = Math.max(10, 100 - (e.fatigue ?? 0));
      return;
    }
    if ((e.irritation ?? 0) > 65) {
      this.setExpression('angry', { pose: 'arms_crossed', gaze: 'user' });
      return;
    }
    if ((e.curiosity ?? 0) > 75) {
      this.setExpression('focused', { pose: 'leaning', gaze: 'user' });
      return;
    }
    if ((e.affection ?? 0) > 70 && (e.happiness ?? 0) > 55) {
      this.setExpression('tender', { pose: 'standing', gaze: 'user' });
      return;
    }
    if ((e.happiness ?? 0) > 70) {
      this.setExpression('happy');
      return;
    }
    this.setExpression('neutral');
  }

  /** Text Kurisu can use to "feel" her virtual body */
  proprioceptionReport(): string {
    const b = this.body;
    return [
      `Сейчас я в среде: ${b.environment}.`,
      `Поза: ${b.pose}, взгляд: ${b.gaze}.`,
      `Выражение: ${b.expression}${b.speaking ? ' (говорю)' : ''}.`,
      `Образ: ${b.outfit}.`,
      `Энергия тела: ${b.energy}/100.`
    ].join(' ');
  }

  registerUserSprite(key: ExpressionKey, src: string, tags: string[] = []) {
    const existing = this.sprites.find((s) => s.key === key);
    if (existing) {
      existing.src = src;
      existing.tags = tags;
    } else {
      this.sprites.push({ key, src, tags });
    }
  }

  private pushEvent(type: EnvironmentEvent['type'], detail: string) {
    this.events.unshift({ id: `env_${Date.now()}`, at: Date.now(), type, detail });
    this.events = this.events.slice(0, 50);
  }
}

export const embodimentSystem = new EmbodimentSystem();
