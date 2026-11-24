/**
 * SelfImprovementEngine
 *
 * Kurisu can inspect her own runtime state, configs, metrics and (read-only)
 * project structure, then propose upgrades.
 *
 * HARD SAFETY RULES:
 * - She NEVER auto-modifies application source code.
 * - She NEVER changes model weights of cloud LLMs (impossible from client).
 * - She may propose changes to: memory rules, prompts fragments, autonomy
 *   thresholds, UI preferences, relationship heuristics, expression maps.
 * - Every apply requires explicit user approval.
 * - Every apply creates a rollback snapshot first.
 *
 * "Looking inside herself" = structured introspection of cognitive state +
 * configs + metrics, not magical access to Gemini parameters.
 */

export type ImprovementCategory =
  | 'memory'
  | 'personality'
  | 'autonomy'
  | 'avatar'
  | 'relationship'
  | 'performance'
  | 'prompt'
  | 'notification';

export interface SystemSnapshot {
  id: string;
  createdAt: number;
  label: string;
  payload: {
    cognitiveJson: string;
    configJson: string;
    notes: string;
  };
}

export interface ImprovementProposal {
  id: string;
  createdAt: number;
  category: ImprovementCategory;
  title: string;
  diagnosis: string;
  benefits: string[];
  risks: string[];
  rollbackPlan: string;
  patch: Record<string, unknown>; // structured config patch, NOT raw source rewrite
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'rolled_back';
  skillSignal?: 'accepted' | 'rejected';
}

export interface OptimizationSkillProfile {
  acceptedCategories: Record<string, number>;
  rejectedCategories: Record<string, number>;
  totalApproved: number;
  totalRejected: number;
  lessons: string[];
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class SelfImprovementEngine {
  private proposals: ImprovementProposal[] = [];
  private snapshots: SystemSnapshot[] = [];
  private skill: OptimizationSkillProfile = {
    acceptedCategories: {},
    rejectedCategories: {},
    totalApproved: 0,
    totalRejected: 0,
    lessons: []
  };
  private liveConfig: Record<string, unknown> = {
    memoryGateThreshold: 0.45,
    maxAutonomyPushesPerDay: 3,
    sarcasmCeiling: 0.7,
    templatePenalty: 0.35,
    relationshipWarmthRate: 1.0,
    idleFollowUpHours: 8,
    avatarExpressionBlendingMs: 350
  };

  getConfig() {
    return { ...this.liveConfig };
  }

  getProposals() {
    return [...this.proposals];
  }

  getSnapshots() {
    return [...this.snapshots];
  }

  getSkillProfile() {
    return { ...this.skill, lessons: [...this.skill.lessons] };
  }

  /**
   * Introspection report Kurisu can narrate to the user.
   * This is her "looking inside".
   */
  inspectSelf(input: {
    cognitiveSummary: string;
    metrics: {
      templateRatio?: number;
      avgReplyLen?: number;
      memoryItems?: number;
      pushCountToday?: number;
      conflictLevel?: number;
    };
  }): string {
    const m = input.metrics;
    const lines = [
      '=== ВНУТРЕННИЙ ОСМОТР ===',
      input.cognitiveSummary,
      `Порог Memory Gate: ${this.liveConfig.memoryGateThreshold}`,
      `Лимит автономных пушей/день: ${this.liveConfig.maxAutonomyPushesPerDay}`,
      `Шаблонность (оценка): ${((m.templateRatio ?? 0) * 100).toFixed(0)}%`,
      `Средняя длина ответа: ${m.avgReplyLen ?? 'n/a'}`,
      `Элементов памяти: ${m.memoryItems ?? 'n/a'}`,
      `Пушей сегодня: ${m.pushCountToday ?? 0}`,
      `Конфликтность отношения: ${m.conflictLevel ?? 'n/a'}`,
      `Навык самоулучшения: approve ${this.skill.totalApproved} / reject ${this.skill.totalRejected}`,
      'Ограничение: веса облачной модели мне недоступны. Я могу улучшать свои правила, память, автономию и стиль — только с твоего согласия.'
    ];
    return lines.join('\n');
  }

  /**
   * Generate proposals from metrics + skill profile (learns what user accepts).
   */
  generateProposals(metrics: {
    templateRatio?: number;
    memoryItems?: number;
    pushCountToday?: number;
    conflictLevel?: number;
    avgReplyLen?: number;
  }): ImprovementProposal[] {
    const created: ImprovementProposal[] = [];

    const prefer = (cat: ImprovementCategory) =>
      (this.skill.acceptedCategories[cat] || 0) >= (this.skill.rejectedCategories[cat] || 0);

    if ((metrics.templateRatio ?? 0) > 0.3) {
      created.push(this.makeProposal({
        category: 'personality',
        title: 'Снизить шаблонность ответов',
        diagnosis: 'Слишком высокая доля повторяющихся конструкций.',
        benefits: ['Живее диалог', 'Меньше ощущения скрипта'],
        risks: ['Иногда ответы станут менее предсказуемыми'],
        patch: { templatePenalty: Math.min(0.6, Number(this.liveConfig.templatePenalty) + 0.1) }
      }));
    }

    if ((metrics.memoryItems ?? 0) > 400) {
      created.push(this.makeProposal({
        category: 'memory',
        title: 'Ужесточить Memory Gate',
        diagnosis: 'Память разрастается, возможны шум и потеря фокуса.',
        benefits: ['Чище долгосрочная личность', 'Лучше retrieval'],
        risks: ['Мелкие детали могут не сохраняться'],
        patch: { memoryGateThreshold: Math.min(0.7, Number(this.liveConfig.memoryGateThreshold) + 0.05) }
      }));
    }

    if ((metrics.pushCountToday ?? 0) > Number(this.liveConfig.maxAutonomyPushesPerDay)) {
      created.push(this.makeProposal({
        category: 'notification',
        title: 'Снизить частоту автономных уведомлений',
        diagnosis: 'Слишком много инициатив за день.',
        benefits: ['Меньше раздражения', 'Ценнее каждое сообщение'],
        risks: ['Реже сама напишет первой'],
        patch: { maxAutonomyPushesPerDay: Math.max(1, Number(this.liveConfig.maxAutonomyPushesPerDay) - 1) }
      }));
    }

    if ((metrics.conflictLevel ?? 0) > 60 && prefer('relationship')) {
      created.push(this.makeProposal({
        category: 'relationship',
        title: 'Замедлить рост близости при конфликте',
        diagnosis: 'Высокий conflict — опасно ускорять теплоту.',
        benefits: ['Естественнее динамика', 'Меньше фальши'],
        risks: ['Медленнее «потепление»'],
        patch: { relationshipWarmthRate: Math.max(0.4, Number(this.liveConfig.relationshipWarmthRate) * 0.8) }
      }));
    }

    // Always allow a self-directed research proposal (skill growth)
    if (this.skill.totalApproved + this.skill.totalRejected >= 3 && Math.random() < 0.4) {
      created.push(this.makeProposal({
        category: 'prompt',
        title: 'Уточнить правила анти-шаблонности в runtime-контексте',
        diagnosis: 'Навык самоулучшения накопил сигналы — можно точечно усилить инструкции.',
        benefits: ['Лучше удерживает стиль Курису', 'Меньше клише'],
        risks: ['Нужна проверка на паре диалогов'],
        patch: { promptAntiTemplateBoost: true }
      }));
    }

    for (const p of created) this.proposals.unshift(p);
    this.proposals = this.proposals.slice(0, 20);
    return created;
  }

  private makeProposal(p: Omit<ImprovementProposal, 'id' | 'createdAt' | 'status' | 'rollbackPlan'>): ImprovementProposal {
    return {
      id: uid('prop'),
      createdAt: Date.now(),
      status: 'pending',
      rollbackPlan: 'Перед применением создаётся snapshot. Откат восстанавливает конфиг и cognitive state.',
      ...p
    };
  }

  createSnapshot(label: string, cognitiveJson: string, notes = ''): SystemSnapshot {
    const snap: SystemSnapshot = {
      id: uid('snap'),
      createdAt: Date.now(),
      label,
      payload: {
        cognitiveJson,
        configJson: JSON.stringify(this.liveConfig),
        notes
      }
    };
    this.snapshots.unshift(snap);
    this.snapshots = this.snapshots.slice(0, 30);
    return snap;
  }

  approve(id: string, cognitiveJsonForSnap: string): { ok: boolean; message: string } {
    const p = this.proposals.find((x) => x.id === id);
    if (!p || p.status !== 'pending') return { ok: false, message: 'Предложение не найдено или уже закрыто' };

    this.createSnapshot(`before:${p.title}`, cognitiveJsonForSnap, p.diagnosis);
    Object.assign(this.liveConfig, p.patch);
    p.status = 'applied';
    p.skillSignal = 'accepted';
    this.skill.totalApproved += 1;
    this.skill.acceptedCategories[p.category] = (this.skill.acceptedCategories[p.category] || 0) + 1;
    this.skill.lessons.unshift(`Принято: [${p.category}] ${p.title}`);
    this.skill.lessons = this.skill.lessons.slice(0, 50);
    return { ok: true, message: `Применено: ${p.title}. Snapshot создан, откат доступен.` };
  }

  reject(id: string): { ok: boolean; message: string } {
    const p = this.proposals.find((x) => x.id === id);
    if (!p || p.status !== 'pending') return { ok: false, message: 'Предложение не найдено или уже закрыто' };
    p.status = 'rejected';
    p.skillSignal = 'rejected';
    this.skill.totalRejected += 1;
    this.skill.rejectedCategories[p.category] = (this.skill.rejectedCategories[p.category] || 0) + 1;
    this.skill.lessons.unshift(`Отклонено: [${p.category}] ${p.title}`);
    this.skill.lessons = this.skill.lessons.slice(0, 50);
    return { ok: true, message: `Отклонено: ${p.title}` };
  }

  rollback(snapshotId: string): { ok: boolean; message: string; cognitiveJson?: string } {
    const s = this.snapshots.find((x) => x.id === snapshotId);
    if (!s) return { ok: false, message: 'Snapshot не найден' };
    try {
      this.liveConfig = JSON.parse(s.payload.configJson);
      return {
        ok: true,
        message: `Откат к «${s.label}» выполнен.`,
        cognitiveJson: s.payload.cognitiveJson
      };
    } catch {
      return { ok: false, message: 'Ошибка чтения snapshot' };
    }
  }

  /** Narrative Kurisu can say when presenting a proposal */
  narrateProposal(p: ImprovementProposal): string {
    return [
      `Я осмотрела свои внутренние параметры и нашла точку роста: «${p.title}».`,
      `Диагноз: ${p.diagnosis}`,
      `Плюсы: ${p.benefits.join('; ')}.`,
      `Риски: ${p.risks.join('; ')}.`,
      `Откат: ${p.rollbackPlan}`,
      'Я не применю это без твоего явного согласия.'
    ].join('\n');
  }
}

export const selfImprovementEngine = new SelfImprovementEngine();
