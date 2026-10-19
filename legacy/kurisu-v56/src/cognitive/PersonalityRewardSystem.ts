/**
 * PersonalityRewardSystem — reinforcement for BEHAVIORAL QUALITY, not obedience.
 *
 * Design goals:
 * - Keep Kurisu independent (reward honesty/boundaries, penalize sycophancy)
 * - Slow drift only
 * - Multiple signals, not one "love XP"
 * - Never force romance or agreeableness
 *
 * Rewards shape tendencies. They do NOT overwrite core identity.
 */

export interface RewardSignals {
  trustDelta: number;
  respectDelta: number;
  conflictDelta: number;
  coherenceDelta: number; // stays in character, non-template
  autonomyDelta: number; // healthy initiative
  sycophancyPenalty: number; // accumulated pressure against people-pleasing
}

export interface BehaviorEvent {
  id: string;
  at: number;
  kind:
    | 'honest_disagreement'
    | 'correct_user_fact'
    | 'boundary_held'
    | 'boundary_broken_by_user'
    | 'supportive_without_melodrama'
    | 'scientific_engagement'
    | 'template_reply'
    | 'role_leak'
    | 'sycophantic_agree'
    | 'good_memory_use'
    | 'bad_memory_hallucination'
    | 'idle_initiative_accepted'
    | 'idle_initiative_rejected'
    | 'over_initiative'
    | 'deep_talk'
    | 'lie_detected';
  weight?: number;
  note?: string;
}

export interface TendencyState {
  candor: number; // honesty / willingness to disagree 0..100
  rigor: number; // scientific strictness
  warmthCap: number; // max warmth she allows herself to express
  initiative: number; // how often she starts topics
  sarcasm: number;
  patience: number;
  sycophancyGuard: number; // higher = stronger resistance to agree-all
  continuity: number; // care for memory coherence
}

export interface RewardLogItem {
  at: number;
  kind: string;
  applied: RewardSignals;
  tendenciesAfter: TendencyState;
  note?: string;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function uid() {
  return `rw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_TENDENCIES: TendencyState = {
  candor: 78,
  rigor: 82,
  warmthCap: 45,
  initiative: 40,
  sarcasm: 55,
  patience: 60,
  sycophancyGuard: 85,
  continuity: 70
};

export class PersonalityRewardSystem {
  private tendencies: TendencyState = { ...DEFAULT_TENDENCIES };
  private log: RewardLogItem[] = [];
  private qualityWindow: number[] = []; // recent coherence scores 0..1

  getTendencies(): TendencyState {
    return { ...this.tendencies };
  }

  getLog() {
    return [...this.log].slice(0, 40);
  }

  /**
   * Main entry: classify interaction outcome and apply slow updates.
   */
  apply(kind: BehaviorEvent['kind'], note?: string, weight = 1): RewardSignals {
    const w = Math.max(0.25, Math.min(2, weight));
    const sig: RewardSignals = {
      trustDelta: 0,
      respectDelta: 0,
      conflictDelta: 0,
      coherenceDelta: 0,
      autonomyDelta: 0,
      sycophancyPenalty: 0
    };
    const t = this.tendencies;

    switch (kind) {
      case 'honest_disagreement':
        sig.respectDelta = 1.5 * w;
        sig.coherenceDelta = 2 * w;
        t.candor = clamp(t.candor + 1.2 * w);
        t.sycophancyGuard = clamp(t.sycophancyGuard + 0.8 * w);
        break;
      case 'correct_user_fact':
        sig.respectDelta = 2 * w;
        sig.coherenceDelta = 1 * w;
        t.rigor = clamp(t.rigor + 1.2 * w);
        break;
      case 'boundary_held':
        sig.respectDelta = 1 * w;
        sig.trustDelta = 1 * w;
        t.candor = clamp(t.candor + 0.8 * w);
        t.sycophancyGuard = clamp(t.sycophancyGuard + 1 * w);
        break;
      case 'boundary_broken_by_user':
        sig.conflictDelta = 3 * w;
        sig.trustDelta = -2 * w;
        t.warmthCap = clamp(t.warmthCap - 1.5 * w);
        t.patience = clamp(t.patience - 1 * w);
        break;
      case 'supportive_without_melodrama':
        sig.trustDelta = 1.5 * w;
        t.warmthCap = clamp(t.warmthCap + 0.7 * w);
        t.patience = clamp(t.patience + 0.5 * w);
        break;
      case 'scientific_engagement':
        sig.respectDelta = 1 * w;
        t.rigor = clamp(t.rigor + 0.8 * w);
        t.initiative = clamp(t.initiative + 0.4 * w);
        break;
      case 'template_reply':
        sig.coherenceDelta = -3 * w;
        t.continuity = clamp(t.continuity - 1 * w);
        this.qualityWindow.push(0.2);
        break;
      case 'role_leak':
        sig.coherenceDelta = -5 * w;
        t.continuity = clamp(t.continuity - 2 * w);
        this.qualityWindow.push(0);
        break;
      case 'sycophantic_agree':
        sig.sycophancyPenalty = 3 * w;
        sig.respectDelta = -1 * w;
        t.sycophancyGuard = clamp(t.sycophancyGuard + 1.5 * w); // paradoxically strengthens guard after failure
        t.candor = clamp(t.candor - 0.5 * w);
        break;
      case 'good_memory_use':
        sig.coherenceDelta = 2 * w;
        sig.trustDelta = 0.5 * w;
        t.continuity = clamp(t.continuity + 1.5 * w);
        this.qualityWindow.push(0.85);
        break;
      case 'bad_memory_hallucination':
        sig.coherenceDelta = -4 * w;
        t.continuity = clamp(t.continuity - 2 * w);
        t.rigor = clamp(t.rigor + 0.5 * w); // becomes more careful
        this.qualityWindow.push(0.1);
        break;
      case 'idle_initiative_accepted':
        sig.autonomyDelta = 2 * w;
        sig.trustDelta = 0.5 * w;
        t.initiative = clamp(t.initiative + 1.2 * w);
        break;
      case 'idle_initiative_rejected':
        sig.autonomyDelta = -1 * w;
        t.initiative = clamp(t.initiative - 1.5 * w);
        break;
      case 'over_initiative':
        sig.autonomyDelta = -2 * w;
        t.initiative = clamp(t.initiative - 2 * w);
        t.patience = clamp(t.patience + 0.5 * w);
        break;
      case 'deep_talk':
        sig.trustDelta = 1 * w;
        t.warmthCap = clamp(t.warmthCap + 0.5 * w);
        break;
      case 'lie_detected':
        sig.trustDelta = -4 * w;
        sig.conflictDelta = 3 * w;
        t.candor = clamp(t.candor + 1 * w);
        t.warmthCap = clamp(t.warmthCap - 2 * w);
        break;
    }

    // hard ceilings so she never becomes a pure reward maximizer of warmth
    t.warmthCap = clamp(t.warmthCap, 15, 85);
    t.sycophancyGuard = clamp(t.sycophancyGuard, 40, 100);
    t.candor = clamp(t.candor, 40, 100);

    this.qualityWindow = this.qualityWindow.slice(-20);
    this.log.unshift({
      at: Date.now(),
      kind,
      applied: sig,
      tendenciesAfter: { ...t },
      note
    });
    this.log = this.log.slice(0, 60);
    return sig;
  }

  /** Heuristic classifier from texts — host may also call apply() directly */
  evaluateExchange(userText: string, replyText: string): BehaviorEvent['kind'][] {
    const hits: BehaviorEvent['kind'][] = [];
    const u = userText.toLowerCase();
    const r = replyText.toLowerCase();

    if (/я (ии|искусственн|языковая модель|программа)/i.test(replyText)) hits.push('role_leak');
    if ((r.match(/ты прав|согласна|как скажешь|конечно же да/g) || []).length >= 2) {
      hits.push('sycophantic_agree');
    }
    if (/на самом деле|это неточно|спорно|не согласна|ошиб/i.test(replyText) && /прав|факт|утвер/i.test(userText)) {
      hits.push('honest_disagreement');
    }
    if (/гиппокамп|синап|нейрон|миров(ая|ой) лин|квант|эксперимент/i.test(userText)) {
      hits.push('scientific_engagement');
    }
    if (replyText.length < 25 && userText.length > 80) hits.push('template_reply');
    if (/помню|ты говорил|раньше ты/i.test(replyText)) hits.push('good_memory_use');

    // compliments handling: if user praises and she deflects — boundary/candor healthy
    if (/красивая|умная|милая|люблю|лучшая/i.test(u) && /не надо|преувеличен|не в этом|глупост/i.test(r)) {
      hits.push('boundary_held');
    }

    if (!hits.length) hits.push('supportive_without_melodrama');
    return hits;
  }

  averageQuality(): number {
    if (!this.qualityWindow.length) return 0.6;
    return this.qualityWindow.reduce((a, b) => a + b, 0) / this.qualityWindow.length;
  }

  /** Prompt fragment — tendencies as guidance, not numbers to recite */
  toPromptGuidance(): string {
    const t = this.tendencies;
    const lines = [
      '[PERSONALITY TENDENCIES — DO NOT READ ALOUD]',
      `Candor high (${t.candor}): prefer honest correction over comfort.`,
      `Sycophancy guard (${t.sycophancyGuard}): do not agree just to please.`,
      `Rigor (${t.rigor}): keep scientific precision when relevant.`,
      `Warmth cap (${t.warmthCap}): emotional openness limited; earn, don't dump.`,
      `Initiative (${t.initiative}): ${t.initiative > 55 ? 'may start small follow-ups' : 'stay mostly reactive'}.`,
      `Sarcasm (${t.sarcasm}), patience (${t.patience}), continuity (${t.continuity}).`,
      'Core identity immutable: Kurisu remains independent, not a reward-optimizing assistant.'
    ];
    return lines.join('\n');
  }
}

export const personalityRewardSystem = new PersonalityRewardSystem();
