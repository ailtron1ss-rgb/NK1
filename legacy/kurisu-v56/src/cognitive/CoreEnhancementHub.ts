/**
 * Core Enhancement Hub v27.
 * Mobile-first coordinator for small, deterministic cognitive upgrades.
 * It never stores or exposes chain-of-thought. The private scratch buffer contains
 * only compact control signals (intent, uncertainty, priorities and next actions).
 */
import { readJson, writeJson, clamp, uid } from './StateVault';
import { embedText, cosine } from '../brain/embeddings';
import { neuralPathways } from '../psyche/NeuralPathwayGraph';
import { livingPersona } from '../psyche/LivingPersona';
import { metaCognition } from './MetaCognition';
import { logger } from '../services/logger';

export interface RoutineSignal {
  key: string;
  label: string;
  count: number;
  lastAt: number;
  avgGapMs: number;
  confidence: number;
}

export interface PrivateCognitiveState {
  id: string;
  at: number;
  intent: string;
  uncertainty: number;
  emotionalEnergy: number;
  priorities: string[];
  nextAction: string;
}

export interface CoreEnhancementSnapshot {
  routines: RoutineSignal[];
  déjàVu: { similarity: number; matched: string } | null;
  style: { vocabulary: string[]; formality: number; avgLength: number };
  memory: { recalls: number; emotionalBoost: number; lastReviewAt: number };
  personality: ReturnType<typeof livingPersona.get>['traits'];
  meta: ReturnType<typeof metaCognition.snapshot>;
}

const ROUTINE_KEY = 'kurisu_routines_v2';
const SCRATCH_KEY = 'kurisu_private_cognitive_state_v1';
const MEMORY_META_KEY = 'kurisu_memory_association_v2';
const MAX_ROUTINES = 24;
const MAX_ASSOCIATIONS = 100;

function loadRoutines(): RoutineSignal[] { return readJson<RoutineSignal[]>(ROUTINE_KEY, []); }
function saveRoutines(v: RoutineSignal[]) { writeJson(ROUTINE_KEY, v.slice(0, MAX_ROUTINES)); }

function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length >= 4).slice(0, 18);
}

function updateRoutine(text: string) {
  const lower = text.toLowerCase();
  const candidates: Array<[string, string, boolean]> = [
    ['coding', 'часто возвращается к разработке', /termux|npm|typescript|react|код|программ|android/.test(lower)],
    ['science', 'любит научные темы', /физик|наук|нейрон|мозг|квант|эксперимент/.test(lower)],
    ['long_form', 'предпочитает развёрнутые сообщения', text.trim().length > 450],
    ['questions', 'часто задаёт вопросы', /[?？]/.test(text)],
    ['late_session', 'активен поздним вечером', (() => { const h = new Date().getHours(); return h >= 22 || h < 5; })()]
  ];
  const list = loadRoutines();
  const now = Date.now();
  for (const [key, label, hit] of candidates) {
    if (!hit) continue;
    let r = list.find(x => x.key === key);
    if (!r) { r = { key, label, count: 0, lastAt: now, avgGapMs: 0, confidence: 0.25 }; list.unshift(r); }
    const gap = r.lastAt ? now - r.lastAt : 0;
    if (gap > 60_000 && gap < 30 * 86400000) r.avgGapMs = r.avgGapMs ? r.avgGapMs * 0.8 + gap * 0.2 : gap;
    r.count++;
    r.lastAt = now;
    r.confidence = Math.min(1, r.confidence + 0.025);
  }
  list.sort((a, b) => b.confidence - a.confidence || b.count - a.count);
  saveRoutines(list);
}

function loadAssociations(): Array<{a: string; b: string; weight: number; lastAt: number}> {
  return readJson(MEMORY_META_KEY, []);
}
function saveAssociations(v: Array<{a: string; b: string; weight: number; lastAt: number}>) {
  v.sort((x, y) => y.weight - x.weight);
  writeJson(MEMORY_META_KEY, v.slice(0, MAX_ASSOCIATIONS));
}

export const coreEnhancementHub = {
  observeInput(text: string, signals: { intent?: string; emotionalEnergy?: number; uncertainty?: number } = {}) {
    updateRoutine(text);
    const ts = tokens(text);
    const associations = loadAssociations();
    for (let i = 0; i < Math.min(ts.length, 8); i++) {
      for (let j = i + 1; j < Math.min(ts.length, 8); j++) {
        const a = ts[i], b = ts[j];
        const existing = associations.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
        if (existing) { existing.weight = Math.min(1, existing.weight + 0.025); existing.lastAt = Date.now(); }
        else associations.push({ a, b, weight: 0.12, lastAt: Date.now() });
      }
    }
    saveAssociations(associations);
    neuralPathways.associate(text, clamp((signals.emotionalEnergy ?? 50) / 100, 0, 1));
    livingPersona.observeUser(text, { deep: text.length > 220 });

    // Private control state: intentionally no prose reasoning.
    const state: PrivateCognitiveState = {
      id: uid('scratch'),
      at: Date.now(),
      intent: signals.intent || 'conversation',
      uncertainty: clamp(signals.uncertainty ?? 35, 0, 100),
      emotionalEnergy: clamp(signals.emotionalEnergy ?? 35, 0, 100),
      priorities: ['answer_user', text.length > 180 ? 'preserve_detail' : 'stay_direct', 'maintain_continuity'],
      nextAction: text.length > 500 ? 'structured_deep_answer' : 'natural_response'
    };
    writeJson(SCRATCH_KEY, state);
    return state;
  },

  detectDejaVu(query: string, candidates: string[]): { similarity: number; matched: string } | null {
    if (!query.trim() || !candidates.length) return null;
    const q = embedText(query);
    let best = { similarity: 0, matched: '' };
    for (const candidate of candidates.slice(0, 40)) {
      const score = Math.max(0, cosine(q, embedText(candidate)));
      if (score > best.similarity) best = { similarity: score, matched: candidate };
    }
    return best.similarity >= 0.78 ? best : null;
  },

  emotionalContagion(userEnergy: number, current: number): number {
    const target = clamp(userEnergy, 0, 100);
    return Math.round(clamp(current * 0.72 + target * 0.28, 0, 100));
  },

  styleHint() {
    const s = livingPersona.get();
    const routines = loadRoutines().filter(r => r.confidence >= 0.55).slice(0, 4);
    const vocab = routines.map(r => r.label);
    const formality = s.rhythm.averageUserChars < 100 ? 0.35 : s.rhythm.averageUserChars > 400 ? 0.55 : 0.45;
    return { vocabulary: vocab, formality, avgLength: s.rhythm.averageUserChars };
  },

  promptBlock(): string {
    const s = livingPersona.get();
    const routines = loadRoutines().filter(r => r.confidence >= 0.55).slice(0, 5);
    const associations = loadAssociations().slice(0, 6).map(x => `${x.a}↔${x.b}(${x.weight.toFixed(2)})`).join(' | ');
    return `[CORE ENHANCEMENTS]\nАдаптация: avgUserChars=${Math.round(s.rhythm.averageUserChars)} detail=${s.rhythm.preferredDetail.toFixed(2)}\nРутины (только если уместно): ${routines.map(r => `${r.label} ${Math.round(r.confidence * 100)}%`).join(' | ') || 'не установлены'}\nАссоциации памяти: ${associations || 'нет'}\nМетаправило: уверенность — это оценка, не доказательство; при сомнении признавай неопределённость. Не копируй сленг пользователя механически.`;
  },

  snapshot(): CoreEnhancementSnapshot {
    return {
      routines: loadRoutines().slice(0, 8),
      déjàVu: null,
      style: this.styleHint(),
      memory: { recalls: readJson<number>('kurisu_memory_recalls_v1', 0), emotionalBoost: readJson<number>('kurisu_memory_emotional_boost_v1', 0), lastReviewAt: readJson<number>('kurisu_memory_review_at_v1', 0) },
      personality: livingPersona.get().traits,
      meta: metaCognition.snapshot()
    };
  },

  reviewDaily() {
    const last = readJson<number>('kurisu_core_daily_review_v1', 0);
    if (Date.now() - last < 20 * 3600000) return { reviewed: false, reason: 'recent' };
    const routines = loadRoutines();
    const strong = routines.filter(r => r.confidence > 0.65).length;
    livingPersona.dailyEvolution({ interactions: strong, deepSessions: routines.find(r => r.key === 'long_form')?.count || 0 });
    metaCognition.review();
    writeJson('kurisu_core_daily_review_v1', Date.now());
    logger.info('Daily cognitive review completed', { strongRoutines: strong });
    return { reviewed: true, strongRoutines: strong };
  }
};
