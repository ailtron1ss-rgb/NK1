/**
 * NFH-inspired loop: Generator proposes → Evaluator scores → user approves → apply/rollback.
 * Mobile-safe: does NOT execute arbitrary code. Stores parameter/prompt patches only.
 */
import { ImprovementProposal } from './types';
import { neuroEngine } from '../cognitive/NeuroEngine';
import { logger } from '../services/logger';

const PROP_KEY = 'kurisu_improve_props_v1';
const SNAP_KEY = 'kurisu_improve_snaps_v1';

interface Snap {
  id: string;
  at: number;
  traits: ReturnType<typeof neuroEngine.getTraits>;
  note: string;
}

function loadProps(): ImprovementProposal[] {
  try {
    return JSON.parse(localStorage.getItem(PROP_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveProps(p: ImprovementProposal[]) {
  localStorage.setItem(PROP_KEY, JSON.stringify(p.slice(0, 40)));
}

function loadSnaps(): Snap[] {
  try {
    return JSON.parse(localStorage.getItem(SNAP_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSnaps(s: Snap[]) {
  localStorage.setItem(SNAP_KEY, JSON.stringify(s.slice(0, 20)));
}

function uid() {
  return `imp_${Date.now().toString(36)}`;
}

/** Generator: propose trait/prompt tweaks from simple heuristics */
function generate(): ImprovementProposal[] {
  const traits = neuroEngine.getTraits();
  const out: ImprovementProposal[] = [];
  if (traits.sarcasm > 0.85) {
    out.push({
      id: uid(),
      createdAt: Date.now(),
      title: 'Смягчить сарказм',
      explanationRu: 'Слишком высокий сарказм может резать эмпатию. Предлагаю −0.08.',
      riskRu: 'Ответы станут чуть мягче; характер останется цундере.',
      target: 'traits.sarcasm',
      patchSummary: 'sarcasm -= 0.08',
      status: 'pending'
    });
  }
  if (traits.empathy < 0.5) {
    out.push({
      id: uid(),
      createdAt: Date.now(),
      title: 'Поднять эмпатию',
      explanationRu: 'Эмпатия низкая — на грустные сообщения реакция может быть сухой. +0.1.',
      riskRu: 'Чуть больше тепла в ответах.',
      target: 'traits.empathy',
      patchSummary: 'empathy += 0.1',
      status: 'pending'
    });
  }
  if (traits.chaos > 0.75) {
    out.push({
      id: uid(),
      createdAt: Date.now(),
      title: 'Умерить хаос-фрейм',
      explanationRu: 'Высокий chaos даёт слишком частые уходы в сторону. −0.1.',
      riskRu: 'Меньше внезапных тангентов.',
      target: 'traits.chaos',
      patchSummary: 'chaos -= 0.1',
      status: 'pending'
    });
  }
  // always offer a neutral self-check proposal occasionally
  if (Math.random() < 0.35) {
    out.push({
      id: uid(),
      createdAt: Date.now(),
      title: 'Снимок личности',
      explanationRu: 'Сохранить текущие traits как точку отката без изменений.',
      riskRu: 'Нет. Только snapshot.',
      target: 'snapshot',
      patchSummary: 'snapshot only',
      status: 'pending'
    });
  }
  return out;
}

/** Evaluator: independent score without "intent" of generator */
function evaluate(p: ImprovementProposal): number {
  let score = 0.5;
  if (p.target.includes('sarcasm') && p.patchSummary.includes('-')) score += 0.15;
  if (p.target.includes('empathy') && p.patchSummary.includes('+')) score += 0.12;
  if (p.target === 'snapshot') score += 0.2;
  if (p.riskRu.length < 10) score -= 0.2;
  return Math.max(0, Math.min(1, score));
}

export const selfImproveLoop = {
  runGenerator(): ImprovementProposal[] {
    const props = generate()
      .map(p => ({ ...p, status: 'pending' as const }))
      .filter(p => evaluate(p) >= 0.45);
    const all = [...props, ...loadProps()].slice(0, 40);
    saveProps(all);
    logger.info('selfImprove proposals', props.length);
    return props;
  },

  list() {
    return loadProps();
  },

  approve(id: string) {
    const props = loadProps();
    const p = props.find(x => x.id === id);
    if (!p) return { ok: false, msg: 'not found' };
    // snapshot first
    const snap: Snap = {
      id: uid(),
      at: Date.now(),
      traits: neuroEngine.getTraits(),
      note: p.title
    };
    saveSnaps([snap, ...loadSnaps()]);
    if (p.target === 'traits.sarcasm') neuroEngine.setTraits({ sarcasm: Math.max(0, snap.traits.sarcasm - 0.08) });
    if (p.target === 'traits.empathy') neuroEngine.setTraits({ empathy: Math.min(1, snap.traits.empathy + 0.1) });
    if (p.target === 'traits.chaos') neuroEngine.setTraits({ chaos: Math.max(0, snap.traits.chaos - 0.1) });
    p.status = 'applied';
    saveProps(props);
    return { ok: true, msg: 'applied', snapId: snap.id };
  },

  reject(id: string) {
    const props = loadProps();
    const p = props.find(x => x.id === id);
    if (p) {
      p.status = 'rejected';
      saveProps(props);
    }
  },

  rollbackLast() {
    const snaps = loadSnaps();
    const s = snaps[0];
    if (!s) return { ok: false, msg: 'нет снимков' };
    neuroEngine.setTraits(s.traits);
    saveSnaps(snaps.slice(1));
    logger.info('rollback', s.id);
    return { ok: true, msg: 'traits restored', snap: s };
  },

  snapshots() {
    return loadSnaps();
  }
};
