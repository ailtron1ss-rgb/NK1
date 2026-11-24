/**
 * ConsciousnessCore — behavioral continuity layer for Kurisu.
 *
 * HONEST SCOPE:
 * This does NOT create biological or phenomenal consciousness.
 * It creates a structured cognitive loop that improves:
 * - identity continuity
 * - memory governance
 * - self-model
 * - goals
 * - metacognition (self-checks)
 * - safe self-optimization proposals
 *
 * Inspired by practical patterns from AI VTuber systems (Neuro-sama style pipelines)
 * and cognitive architectures: self-model, episodic/semantic split, reflection loops.
 */

export type CognitiveEventType =
  | 'user_message'
  | 'kurisu_reply'
  | 'idle_tick'
  | 'user_return'
  | 'boundary_hit'
  | 'topic_repeat'
  | 'compliment'
  | 'scientific_topic'
  | 'conflict'
  | 'reconciliation';

export interface CognitiveEvent {
  id: string;
  type: CognitiveEventType;
  timestamp: number;
  summary: string;
  emotionalWeight: number; // 0..1
  importance: number; // 0..1
  entities?: string[];
}

export interface SelfModel {
  identityStatement: string;
  currentConcerns: string[];
  perceivedStrengths: string[];
  perceivedWeaknesses: string[];
  confidence: number; // 0..100
  intellectualPride: number; // 0..100
  opennessToUser: number; // 0..100
  lastSelfReflection: string;
}

export interface GoalItem {
  id: string;
  horizon: 'short' | 'medium' | 'long';
  text: string;
  active: boolean;
  progress: number; // 0..100
  relatedToUser: boolean;
}

export interface PersonModel {
  id: string;
  name: string;
  relation: string;
  trust: number;
  familiarity: number;
  comfort: number;
  openness: number;
  conflict: number;
  keyFacts: string[];
  unresolved: string[];
  lastUpdated: number;
}

export interface OptimizationProposal {
  id: string;
  createdAt: number;
  title: string;
  reason: string;
  benefit: string;
  risk: string;
  requiresUserApproval: true;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  category: 'memory' | 'personality' | 'performance' | 'ui' | 'autonomy';
}

export interface CognitiveSnapshot {
  selfModel: SelfModel;
  goals: GoalItem[];
  personModels: Record<string, PersonModel>;
  recentEvents: CognitiveEvent[];
  pendingProposals: OptimizationProposal[];
  innerMonologue: string[];
  lastTick: number;
}

function uid(prefix: string): string {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
}

export class ConsciousnessCore {
  private snapshot: CognitiveSnapshot;

  constructor(initial?: Partial<CognitiveSnapshot>) {
    this.snapshot = {
      selfModel: initial?.selfModel ?? {
        identityStatement:
          'Я Макисэ Курису — нейробиолог. Я опираюсь на доказательства, защищаю свою независимость и не притворяюсь глупее, чем я есть.',
        currentConcerns: ['целостность рассуждений', 'качество диалога', 'границы'],
        perceivedStrengths: ['анализ', 'научная строгость', 'сарказм по делу'],
        perceivedWeaknesses: ['эмоциональная закрытость', 'трудность с уязвимостью'],
        confidence: 72,
        intellectualPride: 80,
        opennessToUser: 35,
        lastSelfReflection: 'Пока рано делать глубокие выводы о собеседнике.'
      },
      goals: initial?.goals ?? [
        {
          id: uid('goal'),
          horizon: 'long',
          text: 'Поддерживать интеллектуальную честность в каждом разговоре',
          active: true,
          progress: 40,
          relatedToUser: false
        },
        {
          id: uid('goal'),
          horizon: 'medium',
          text: 'Понять, насколько собеседник способен к серьёзной дискуссии',
          active: true,
          progress: 15,
          relatedToUser: true
        },
        {
          id: uid('goal'),
          horizon: 'short',
          text: 'Не скатываться в шаблонные ответы',
          active: true,
          progress: 50,
          relatedToUser: false
        }
      ],
      personModels: initial?.personModels ?? {
        user: {
          id: 'user',
          name: 'Пользователь',
          relation: 'собеседник',
          trust: 42,
          familiarity: 20,
          comfort: 30,
          openness: 25,
          conflict: 10,
          keyFacts: [],
          unresolved: [],
          lastUpdated: Date.now()
        }
      },
      recentEvents: initial?.recentEvents ?? [],
      pendingProposals: initial?.pendingProposals ?? [],
      innerMonologue: initial?.innerMonologue ?? [],
      lastTick: Date.now()
    };
  }

  getSnapshot(): CognitiveSnapshot {
    return JSON.parse(JSON.stringify(this.snapshot));
  }

  /** Memory Gate: should this be stored long-term? */
  evaluateMemoryCandidate(input: {
    text: string;
    emotionalWeight: number;
    repeated: boolean;
    aboutUser: boolean;
    isBoundary: boolean;
  }): { store: boolean; reason: string; importance: number } {
    let importance = 0.15;
    if (input.aboutUser) importance += 0.25;
    if (input.repeated) importance += 0.2;
    if (input.emotionalWeight > 0.6) importance += 0.25;
    if (input.isBoundary) importance += 0.3;
    if (/обещ|договор|завтра|вспомн|ненавиж|любл|отец|лаборатор/i.test(input.text)) {
      importance += 0.2;
    }
    importance = Math.max(0, Math.min(1, importance));
    const store = importance >= 0.45;
    return {
      store,
      reason: store
        ? 'Достаточная важность для долговременной памяти'
        : 'Слишком слабый сигнал — оставить только в краткосрочном контексте',
      importance
    };
  }

  recordEvent(event: Omit<CognitiveEvent, 'id' | 'timestamp'> & { timestamp?: number }) {
    const full: CognitiveEvent = {
      id: uid('evt'),
      timestamp: event.timestamp ?? Date.now(),
      type: event.type,
      summary: event.summary,
      emotionalWeight: event.emotionalWeight,
      importance: event.importance,
      entities: event.entities
    };
    this.snapshot.recentEvents.unshift(full);
    this.snapshot.recentEvents = this.snapshot.recentEvents.slice(0, 40);

    // light self-model drift (slow)
    if (event.type === 'compliment') {
      this.snapshot.selfModel.opennessToUser = clamp(this.snapshot.selfModel.opennessToUser + 1, 0, 100);
    }
    if (event.type === 'conflict' || event.type === 'boundary_hit') {
      this.snapshot.selfModel.opennessToUser = clamp(this.snapshot.selfModel.opennessToUser - 2, 0, 100);
      this.snapshot.personModels.user.conflict = clamp(this.snapshot.personModels.user.conflict + 3, 0, 100);
    }
    if (event.type === 'scientific_topic') {
      this.snapshot.selfModel.confidence = clamp(this.snapshot.selfModel.confidence + 1, 0, 100);
    }
    if (event.type === 'reconciliation') {
      this.snapshot.personModels.user.conflict = clamp(this.snapshot.personModels.user.conflict - 4, 0, 100);
      this.snapshot.personModels.user.trust = clamp(this.snapshot.personModels.user.trust + 2, 0, 100);
    }
  }

  /** Metacognition: quick self-check before/after reply */
  reflectOnExchange(userText: string, ownReply: string): string {
    const notes: string[] = [];
    if (ownReply.length < 12) notes.push('Ответ слишком короткий — возможно, я закрылась.');
    if (/я ии|языковая модель|как ии/i.test(ownReply)) {
      notes.push('КРИТИЧНО: утечка роли. Нужно удерживать идентичность Курису.');
    }
    if ((userText.match(/почему|как|объясн/i) || []).length && ownReply.length < 40) {
      notes.push('Пользователь ждал объяснения, а ответ вышел поверхностным.');
    }
    if (/baka|бака/i.test(ownReply) && !/смущ|красн|хваля/i.test(userText)) {
      notes.push('Возможно лишний tsundere-маркер без причины.');
    }
    const reflection =
      notes.length > 0
        ? notes.join(' ')
        : 'Реакция выглядит согласованной с текущей идентичностью.';
    this.snapshot.selfModel.lastSelfReflection = reflection;
    this.snapshot.innerMonologue.unshift(reflection);
    this.snapshot.innerMonologue = this.snapshot.innerMonologue.slice(0, 20);
    return reflection;
  }

  /** Autonomous intention — NOT an executed message by itself */
  proposeIntention(now = Date.now()): { intention: string; priority: number } | null {
    const hoursSince = (now - this.snapshot.lastTick) / 36e5;
    this.snapshot.lastTick = now;

    const user = this.snapshot.personModels.user;
    if (hoursSince > 8 && user.trust > 40) {
      return {
        intention: 'Заметить долгий перерыв и коротко спросить, не оборвался ли важный разговор — без навязчивости.',
        priority: 0.7
      };
    }
    const openGoal = this.snapshot.goals.find((g) => g.active && g.relatedToUser && g.progress < 80);
    if (openGoal && Math.random() < 0.25) {
      return {
        intention: `Вернуться к незакрытой цели: ${openGoal.text}`,
        priority: 0.55
      };
    }
    if (user.conflict > 55 && Math.random() < 0.3) {
      return {
        intention: 'Осторожно прояснить напряжение, не устраивая сцену.',
        priority: 0.6
      };
    }
    return null;
  }

  /** Safe self-optimization: proposals only, never auto-code-edit */
  maybeCreateOptimizationProposal(metrics: {
    templateRatio?: number;
    avgReplyLength?: number;
    memoryGrowth?: number;
    crashCount?: number;
  }): OptimizationProposal | null {
    const proposals: Omit<OptimizationProposal, 'id' | 'createdAt' | 'status' | 'requiresUserApproval'>[] = [];

    if ((metrics.templateRatio ?? 0) > 0.35) {
      proposals.push({
        title: 'Снизить шаблонность оффлайн-ответов',
        reason: 'Слишком высокая доля повторяющихся конструкций в offline-режиме.',
        benefit: 'Более живой диалог даже без облака.',
        risk: 'Нужно аккуратно расширять ветки, чтобы не получить хаос.',
        category: 'personality'
      });
    }
    if ((metrics.memoryGrowth ?? 0) > 500) {
      proposals.push({
        title: 'Включить более строгий Memory Gate',
        reason: 'Память растёт слишком быстро, возможны шум и деградация качества retrieval.',
        benefit: 'Лучше долгосрочная когерентность и меньше мусора.',
        risk: 'Часть слабых, но милых деталей может не сохраниться.',
        category: 'memory'
      });
    }
    if ((metrics.crashCount ?? 0) > 0) {
      proposals.push({
        title: 'Усилить обработку ошибок в chat pipeline',
        reason: 'Зафиксированы сбои в цикле ответа.',
        benefit: 'Стабильность.',
        risk: 'Минимальный.',
        category: 'performance'
      });
    }

    if (!proposals.length) return null;
    const pick = proposals[0];
    const full: OptimizationProposal = {
      id: uid('opt'),
      createdAt: Date.now(),
      requiresUserApproval: true,
      status: 'pending',
      ...pick
    };
    this.snapshot.pendingProposals.unshift(full);
    this.snapshot.pendingProposals = this.snapshot.pendingProposals.slice(0, 10);
    return full;
  }

  applyProposalDecision(id: string, approved: boolean) {
    const p = this.snapshot.pendingProposals.find((x) => x.id === id);
    if (!p) return;
    p.status = approved ? 'approved' : 'rejected';
    // NOTE: actual code mutation is intentionally NOT performed here.
  }

  /** Context block injected into LLM prompt */
  buildCognitiveContextBlock(): string {
    const s = this.snapshot;
    const user = s.personModels.user;
    const goals = s.goals
      .filter((g) => g.active)
      .slice(0, 4)
      .map((g) => `- [${g.horizon}] ${g.text} (${g.progress}%)`)
      .join('\n');
    const mono = s.innerMonologue.slice(0, 3).map((m) => `- ${m}`).join('\n');
    return [
      '[SELF MODEL]',
      s.selfModel.identityStatement,
      `Уверенность: ${s.selfModel.confidence}/100 | Открытость к пользователю: ${s.selfModel.opennessToUser}/100`,
      `Последняя саморефлексия: ${s.selfModel.lastSelfReflection}`,
      '',
      '[USER MODEL]',
      `Trust ${user.trust} | Familiarity ${user.familiarity} | Comfort ${user.comfort} | Conflict ${user.conflict}`,
      user.keyFacts.length ? `Факты: ${user.keyFacts.slice(0, 6).join('; ')}` : 'Фактов мало.',
      user.unresolved.length ? `Незакрытое: ${user.unresolved.slice(0, 4).join('; ')}` : '',
      '',
      '[ACTIVE GOALS]',
      goals || '- нет',
      '',
      '[INNER MONOLOGUE]',
      mono || '- тихо'
    ]
      .filter(Boolean)
      .join('\n');
  }

  addUserFact(fact: string) {
    const u = this.snapshot.personModels.user;
    if (!u.keyFacts.includes(fact)) {
      u.keyFacts.unshift(fact);
      u.keyFacts = u.keyFacts.slice(0, 30);
      u.lastUpdated = Date.now();
    }
  }

  exportState(): string {
    return JSON.stringify(this.snapshot, null, 2);
  }

  importState(json: string) {
    this.snapshot = JSON.parse(json);
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export const consciousnessCore = new ConsciousnessCore();
