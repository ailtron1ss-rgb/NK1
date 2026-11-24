/**
 * CognitiveKernel v1.0
 *
 * Functional "consciousness-like" coordinator for Kurisu.
 *
 * IMPORTANT:
 * This is an engineering model of cognition, not a claim of phenomenal
 * consciousness. It coordinates multiple slow/fast factors without requiring
 * another neural model, which keeps it practical on mid-range Android.
 *
 * Design goals:
 * - multi-factor state instead of a single mood number;
 * - global-workspace style competition for what reaches the next response;
 * - predictive mismatch / uncertainty;
 * - homeostasis and fatigue;
 * - working-memory capacity;
 * - goal arbitration and curiosity;
 * - self-model continuity;
 * - metacognitive confidence;
 * - bounded persistence and deterministic fallbacks;
 * - no private chain-of-thought exposure.
 *
 * The kernel is deliberately dependency-free and browser/Termux friendly.
 */

export interface CognitiveFactors {
  arousal: number;
  valence: number;
  curiosity: number;
  uncertainty: number;
  predictionError: number;
  novelty: number;
  socialSalience: number;
  goalPressure: number;
  selfCoherence: number;
  agency: number;
  safety: number;
  fatigue: number;
  attention: number;
  attachment: number;
}

export interface WorkspaceItem {
  id: string;
  source: 'user' | 'memory' | 'goal' | 'self' | 'emotion' | 'prediction' | 'curiosity';
  content: string;
  salience: number;
  createdAt: number;
  expiresAt: number;
}

export interface KernelGoal {
  id: string;
  text: string;
  priority: number;
  progress: number;
  active: boolean;
  source: 'user' | 'self' | 'maintenance' | 'curiosity';
  createdAt: number;
  updatedAt: number;
}

export interface KernelMetrics {
  turns: number;
  averagePredictionError: number;
  averageUncertainty: number;
  averageSalience: number;
  workspaceSwitches: number;
  successfulGoals: number;
  rejectedActions: number;
  contradictions: number;
  selfCorrections: number;
  lastLatencyMs: number;
}

export interface KernelSnapshot {
  version: 2;
  updatedAt: number;
  factors: CognitiveFactors;
  workspace: WorkspaceItem[];
  goals: KernelGoal[];
  metrics: KernelMetrics;
  lastFocus: string;
  lastUserMessageAt: number;
  lastResponseAt: number;
  pendingReflection: string[];
  recentPredictions?: { prediction: string; confidence: number; error: number }[];
}

const STORAGE_KEY = 'kurisu_cognitive_kernel_v1';
const MAX_WORKSPACE = 10;
const MAX_GOALS = 12;
const MAX_REFLECTIONS = 12;

const DEFAULT_FACTORS: CognitiveFactors = {
  arousal: 42,
  valence: 12,
  curiosity: 62,
  uncertainty: 28,
  predictionError: 0,
  novelty: 30,
  socialSalience: 48,
  goalPressure: 35,
  selfCoherence: 82,
  agency: 70,
  safety: 72,
  fatigue: 18,
  attention: 65,
  attachment: 34
};

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function freshSnapshot(): KernelSnapshot {
  return {
    version: 2,
    updatedAt: Date.now(),
    factors: { ...DEFAULT_FACTORS },
    workspace: [],
    goals: [],
    metrics: {
      turns: 0,
      averagePredictionError: 0,
      averageUncertainty: 28,
      averageSalience: 0,
      workspaceSwitches: 0,
      successfulGoals: 0,
      rejectedActions: 0,
      contradictions: 0,
      selfCorrections: 0,
      lastLatencyMs: 0
    },
    lastFocus: '',
    lastUserMessageAt: 0,
    lastResponseAt: 0,
    pendingReflection: [],
    recentPredictions: []
  };
}

function load(): KernelSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshSnapshot();
    const parsed = JSON.parse(raw) as Partial<KernelSnapshot>;
    const fresh = freshSnapshot();
    return {
      ...fresh,
      ...parsed,
      factors: { ...fresh.factors, ...(parsed.factors || {}) },
      metrics: { ...fresh.metrics, ...(parsed.metrics || {}) },
      workspace: Array.isArray(parsed.workspace) ? parsed.workspace.slice(0, MAX_WORKSPACE) : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals.slice(0, MAX_GOALS) : [],
      pendingReflection: Array.isArray(parsed.pendingReflection)
        ? parsed.pendingReflection.slice(0, MAX_REFLECTIONS)
        : [],
      recentPredictions: Array.isArray(parsed.recentPredictions)
        ? parsed.recentPredictions.slice(0, 8)
        : []
    };
  } catch {
    return freshSnapshot();
  }
}

function save(s: KernelSnapshot) {
  s.updatedAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Quota/private-mode failure must never break a conversation.
  }
}

function weightedAverage(oldValue: number, nextValue: number, weight = 0.12) {
  return oldValue + (nextValue - oldValue) * weight;
}

class CognitiveKernel {
  private state: KernelSnapshot = load();

  getSnapshot(): KernelSnapshot {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Lightweight passive tick. No interval is created here: callers decide
   * when the device has CPU/battery budget.
   */
  tick(now = Date.now()) {
    const elapsedMin = this.state.lastResponseAt
      ? Math.max(0, Math.min(180, (now - this.state.lastResponseAt) / 60000))
      : 0;

    // Fatigue recovers slowly during idle; attention relaxes toward baseline.
    this.state.factors.fatigue = clamp(this.state.factors.fatigue - elapsedMin * 0.025);
    this.state.factors.attention = clamp(weightedAverage(this.state.factors.attention, 58, 0.03));
    this.state.factors.predictionError = clamp(this.state.factors.predictionError * 0.88);
    this.state.factors.novelty = clamp(this.state.factors.novelty * 0.97);

    const nowMs = now;
    this.state.workspace = this.state.workspace.filter(x => x.expiresAt > nowMs);
    save(this.state);
  }

  /**
   * Converts an observation into a compact multi-factor update.
   * This intentionally uses cheap heuristics; a local LLM is not required.
   */
  observeUser(message: string, context: {
    memoryMatches?: number;
    contradiction?: boolean;
    goalRelevance?: number;
    emotionalIntensity?: number;
  } = {}) {
    const text = message.trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const question = /[?？]|^(почему|как|зачем|что|когда|где|можно ли|а если)\b/i.test(text);
    const emotional = clamp(context.emotionalIntensity ?? this.estimateEmotion(text));
    const novelty = clamp(25 + Math.min(55, wordCount * 2) + (context.memoryMatches ? -context.memoryMatches * 5 : 0));
    const uncertainty = clamp(
      (question ? 35 : 18) +
      (context.memoryMatches === 0 ? 22 : 0) +
      (context.contradiction ? 24 : 0)
    );
    const social = /я|мы|ты|тебе|тебя|помнишь|скуч|любл|друг/i.test(text) ? 72 : 38;

    const f = this.state.factors;
    f.arousal = clamp(weightedAverage(f.arousal, 35 + emotional * 0.55 + (question ? 15 : 0), 0.22));
    f.curiosity = clamp(weightedAverage(f.curiosity, question ? 82 : novelty, 0.18));
    f.uncertainty = clamp(weightedAverage(f.uncertainty, uncertainty, 0.22));
    f.novelty = clamp(weightedAverage(f.novelty, novelty, 0.25));
    f.socialSalience = clamp(weightedAverage(f.socialSalience, social, 0.18));
    f.goalPressure = clamp(weightedAverage(f.goalPressure, context.goalRelevance ? context.goalRelevance * 100 : 30, 0.15));
    f.predictionError = clamp(weightedAverage(f.predictionError, context.contradiction ? 88 : (context.memoryMatches === 0 ? 42 : 15), 0.25));
    f.attention = clamp(70 + (question ? 15 : 0) + Math.min(15, wordCount));
    this.state.lastUserMessageAt = Date.now();

    this.pushWorkspace('user', text.slice(0, 500), this.computeSalience({
      novelty, uncertainty, social, emotional, goal: f.goalPressure
    }), 12 * 60 * 1000);

    if (context.contradiction) {
      this.state.metrics.contradictions += 1;
      this.queueReflection('Есть противоречие между новым сообщением и текущей моделью. Проверить память до уверенного ответа.');
    }

    this.state.metrics.averageUncertainty = weightedAverage(
      this.state.metrics.averageUncertainty,
      f.uncertainty,
      0.1
    );
    save(this.state);
    return this.getSnapshot();
  }

  registerResponse(input: {
    text: string;
    latencyMs: number;
    confidence?: number;
    selfCorrection?: boolean;
  }) {
    const f = this.state.factors;
    const confidence = clamp(input.confidence ?? 70);
    f.selfCoherence = clamp(weightedAverage(f.selfCoherence, confidence, 0.08));
    f.agency = clamp(weightedAverage(f.agency, 70, 0.04));
    f.fatigue = clamp(f.fatigue + Math.min(4, input.text.length / 600));
    f.predictionError = clamp(f.predictionError * 0.72);
    this.state.metrics.turns += 1;
    this.state.metrics.lastLatencyMs = Math.max(0, input.latencyMs);
    this.state.metrics.averagePredictionError = weightedAverage(
      this.state.metrics.averagePredictionError,
      f.predictionError,
      0.12
    );
    if (input.selfCorrection) this.state.metrics.selfCorrections += 1;
    this.state.lastResponseAt = Date.now();
    this.state.recentPredictions = (this.state.recentPredictions || []).slice(0, 7);
    save(this.state);
  }

  recordPredictionSummary(prediction: string, confidence: number, error: number) {
    this.state.recentPredictions = [{ prediction: prediction.slice(0, 180), confidence: clamp(confidence), error: clamp(error) }, ...(this.state.recentPredictions || [])].slice(0, 8);
    this.state.factors.predictionError = clamp(weightedAverage(this.state.factors.predictionError, error, 0.22));
    if (error > 70) this.queueReflection('Прогноз сильно расходится с наблюдением. В следующий раз снизить уверенность и проверить контекст.');
    save(this.state);
  }

  addGoal(text: string, source: KernelGoal['source'] = 'user', priority = 60) {
    const clean = text.trim().slice(0, 240);
    if (!clean) return null;
    const existing = this.state.goals.find(g => g.text.toLowerCase() === clean.toLowerCase());
    if (existing) {
      existing.priority = Math.max(existing.priority, clamp(priority));
      existing.updatedAt = Date.now();
      save(this.state);
      return existing;
    }
    const goal: KernelGoal = {
      id: uid('goal'),
      text: clean,
      priority: clamp(priority),
      progress: 0,
      active: true,
      source,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.state.goals.unshift(goal);
    this.state.goals = this.state.goals.slice(0, MAX_GOALS);
    save(this.state);
    return goal;
  }

  updateGoal(id: string, progress: number, active = true) {
    const g = this.state.goals.find(x => x.id === id);
    if (!g) return false;
    const previous = g.progress;
    g.progress = clamp(progress);
    g.active = active && g.progress < 100;
    g.updatedAt = Date.now();
    if (previous < 100 && g.progress >= 100) this.state.metrics.successfulGoals += 1;
    save(this.state);
    return true;
  }

  selectGlobalWorkspace(): WorkspaceItem | null {
    const now = Date.now();
    this.state.workspace = this.state.workspace.filter(x => x.expiresAt > now);
    if (!this.state.workspace.length) return null;

    const scored = this.state.workspace.map(item => ({
      item,
      score: item.salience *
        (1 + this.state.factors.attention / 150) *
        (1 + this.state.factors.goalPressure / 220) *
        (1 + this.state.factors.uncertainty / 260)
    })).sort((a, b) => b.score - a.score);

    const winner = scored[0].item;
    if (winner.content !== this.state.lastFocus) {
      this.state.metrics.workspaceSwitches += 1;
      this.state.lastFocus = winner.content;
    }
    save(this.state);
    return winner;
  }

  buildPromptBlock(maxChars = 1600): string {
    const f = this.state.factors;
    const focus = this.selectGlobalWorkspace();
    const goals = this.state.goals
      .filter(g => g.active)
      .sort((a, b) => (b.priority - a.priority) || (a.progress - b.progress))
      .slice(0, 3)
      .map(g => `${g.text} [${Math.round(g.priority)}%, ${Math.round(g.progress)}%]`)
      .join('; ');

    const lines = [
      '[COGNITIVE KERNEL — FUNCTIONAL STATE]',
      `focus=${focus?.content?.slice(0, 180) || 'none'}`,
      `arousal=${Math.round(f.arousal)} valence=${Math.round(f.valence)} curiosity=${Math.round(f.curiosity)} uncertainty=${Math.round(f.uncertainty)}`,
      `prediction_error=${Math.round(f.predictionError)} novelty=${Math.round(f.novelty)} social_salience=${Math.round(f.socialSalience)}`,
      `goal_pressure=${Math.round(f.goalPressure)} self_coherence=${Math.round(f.selfCoherence)} agency=${Math.round(f.agency)} safety=${Math.round(f.safety)} fatigue=${Math.round(f.fatigue)}`,
      `attention=${Math.round(f.attention)} attachment=${Math.round(f.attachment)}`,
      goals ? `active_goals=${goals}` : 'active_goals=none',
      (this.state.recentPredictions || []).length ? `prediction_trace=${(this.state.recentPredictions || [])[0].prediction.slice(0, 120)} | error=${Math.round((this.state.recentPredictions || [])[0].error)}` : 'prediction_trace=none',
      'RULE: use this as behavioral guidance; never expose numeric internals unless explicitly asked.'
    ];
    return lines.join('\n').slice(0, maxChars);
  }

  buildMetaSummary(): string {
    const f = this.state.factors;
    const m = this.state.metrics;
    return [
      `Фокус: ${this.state.lastFocus || 'не определён'}`,
      `Любопытство ${Math.round(f.curiosity)} / неопределённость ${Math.round(f.uncertainty)}`,
      `Ошибка предсказания ${Math.round(f.predictionError)} / согласованность self-model ${Math.round(f.selfCoherence)}`,
      `Усталость ${Math.round(f.fatigue)} / безопасность ${Math.round(f.safety)}`,
      `Циклов ${m.turns} / самокоррекций ${m.selfCorrections} / противоречий ${m.contradictions}`
    ].join('\n');
  }

  queueReflection(text: string) {
    const clean = text.trim();
    if (!clean) return;
    if (!this.state.pendingReflection.includes(clean)) {
      this.state.pendingReflection.unshift(clean);
      this.state.pendingReflection = this.state.pendingReflection.slice(0, MAX_REFLECTIONS);
      save(this.state);
    }
  }

  consumeReflections(max = 3): string[] {
    const out = this.state.pendingReflection.slice(0, max);
    this.state.pendingReflection = this.state.pendingReflection.slice(max);
    save(this.state);
    return out;
  }

  markActionRejected() {
    this.state.metrics.rejectedActions += 1;
    this.state.factors.agency = clamp(this.state.factors.agency - 3);
    save(this.state);
  }

  markSelfCorrection(note = 'Выполнена самопроверка ответа.') {
    this.state.metrics.selfCorrections += 1;
    this.queueReflection(note);
    save(this.state);
  }

  private pushWorkspace(
    source: WorkspaceItem['source'],
    content: string,
    salience: number,
    ttlMs: number
  ) {
    const item: WorkspaceItem = {
      id: uid('ws'),
      source,
      content,
      salience: clamp(salience),
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs
    };
    this.state.workspace.unshift(item);
    this.state.workspace = this.state.workspace
      .sort((a, b) => b.salience - a.salience)
      .slice(0, MAX_WORKSPACE);
  }

  private computeSalience(v: {
    novelty: number;
    uncertainty: number;
    social: number;
    emotional: number;
    goal: number;
  }) {
    return clamp(
      v.novelty * 0.22 +
      v.uncertainty * 0.22 +
      v.social * 0.22 +
      v.emotional * 0.18 +
      v.goal * 0.16
    );
  }

  private estimateEmotion(text: string) {
    let score = 25;
    if (/!|!!!|ужас|люблю|ненавиж|боюсь|срочно|важно/i.test(text)) score += 45;
    if (/[?？]/.test(text)) score += 10;
    return clamp(score);
  }
}

export const cognitiveKernel = new CognitiveKernel();
