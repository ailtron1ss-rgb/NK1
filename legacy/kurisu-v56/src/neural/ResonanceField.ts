/**
 * ResonanceField — single offline hub that unifies:
 * ToneEmotionNet → MicroNeuralLattice → hysteresis → embodiment/HUD cache.
 * All consumers should call resonate() once per turn, not re-run lattice ad hoc.
 */

import { runMicroLattice, LatticeSnapshot, latticeModuleCount } from './MicroNeuralLattice';
import { analyzeToneEmotion } from './ToneEmotionNet';
import { embodimentBus } from '../services/embodimentBus';

export type ResonanceName =
  | 'steady'
  | 'banter'
  | 'soft_tsun'
  | 'eureka'
  | 'spark_lab'
  | 'steel'
  | 'nickname_ire'
  | 'deep_guard'
  | string;

export interface ResonanceState {
  at: number;
  userPreview: string;
  lattice: LatticeSnapshot;
  /** smoothed module activations 0..1 */
  smooth: Record<string, number>;
  /** locked phase with hysteresis */
  phase: ResonanceName;
  phaseStableMs: number;
  intensity: number;
  promptBlock: string;
}

const KEY = 'kurisu_resonance_v1';

let last: ResonanceState | null = null;

function loadSmooth(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}').smooth || {};
  } catch {
    return {};
  }
}

function savePartial(s: ResonanceState) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        phase: s.phase,
        smooth: s.smooth,
        at: s.at
      })
    );
  } catch {
    /* private mode */
  }
}

function smoothActs(
  prev: Record<string, number>,
  mods: { id: string; activation: number }[],
  alpha = 0.42
): Record<string, number> {
  const out = { ...prev };
  for (const m of mods) {
    const p = out[m.id] ?? m.activation;
    out[m.id] = p * (1 - alpha) + m.activation * alpha;
  }
  // decay missing
  for (const k of Object.keys(out)) {
    if (!mods.some(m => m.id === k)) out[k] = (out[k] || 0) * 0.92;
  }
  return out;
}

function intensityOf(lattice: LatticeSnapshot, smooth: Record<string, number>): number {
  const top = lattice.top.slice(0, 3).reduce((s, m) => s + (smooth[m.id] ?? m.activation), 0) / 3;
  return Math.max(0.15, Math.min(1, top * 0.7 + lattice.tone.arousal * 0.3));
}

function phasePrompt(phase: string, intensity: number, lattice: LatticeSnapshot): string {
  const hints: Record<string, string> = {
    steady: 'Ровный собранный тон; ясность без театра.',
    banter: 'Лёгкая перепалка/сарказм допустимы; не унижай.',
    soft_tsun: 'Щит + крупица тепла; смущение маскируй коротко.',
    eureka: 'Озарение: неожиданный точный угол, можно чуть длиннее.',
    spark_lab: 'Наука + искра юмора лаборатории.',
    steel: 'Границы жёстко; ты не ассистент и не слуга.',
    nickname_ire: 'Раздражение на кличку — вспышка, потом контроль.',
    deep_guard: 'Глубокая тема: осторожно, без мелодрамы.'
  };
  const h = hints[phase] || hints.steady;
  return `[RESONANCE FIELD]
phase=${phase} intensity=${intensity.toFixed(2)} modules=${latticeModuleCount()} offline
${h}
tone=${lattice.tone.tone} emotion=${lattice.tone.emotion} humor=${lattice.humorAllowed ? 'yes' : 'no'}
top: ${lattice.top
    .slice(0, 5)
    .map(m => `${m.id}:${m.activation.toFixed(2)}`)
    .join(' ')}
Сшей фазу и top-модули в ОДИН ответ Курису. Не перечисляй систему.`;
}

/** Map phase → avatar expression hint */
function phaseToExpression(phase: string, toneEmo: string): string {
  if (phase === 'nickname_ire' || phase === 'steel') return 'tsundere_denial';
  if (phase === 'eureka' || phase === 'spark_lab') return 'focused';
  if (phase === 'soft_tsun') return 'embarrassed';
  if (phase === 'banter') return 'smug';
  if (phase === 'deep_guard') return 'looking_away';
  if (toneEmo === 'sadness') return 'sad';
  if (toneEmo === 'joy') return 'happy';
  if (toneEmo === 'anger') return 'angry';
  return 'thinking';
}

export const resonanceField = {
  /** Primary entry — call once per user turn */
  resonate(userMessage: string): ResonanceState {
    const lattice = runMicroLattice(userMessage || '');
    const prevSmooth = last?.smooth || loadSmooth();
    const smooth = smoothActs(prevSmooth, lattice.modules);
    const now = Date.now();

    // hysteresis: don't flip phase unless new phase clearly stronger or 2.5s passed
    let phase: ResonanceName = lattice.resonance;
    let phaseStableMs = 0;
    if (last) {
      phaseStableMs = now - (last.at || now);
      if (last.phase === lattice.resonance) {
        phase = last.phase;
      } else if (phaseStableMs < 2500) {
        // keep previous unless intensity spike
        const newI = intensityOf(lattice, smooth);
        if (newI < (last.intensity || 0) + 0.18) {
          phase = last.phase;
        }
      }
    }

    const intensity = intensityOf(lattice, smooth);
    // override lattice display resonance with locked phase for consumers
    const latticeView: LatticeSnapshot = { ...lattice, resonance: phase };

    const state: ResonanceState = {
      at: now,
      userPreview: (userMessage || '').slice(0, 160),
      lattice: latticeView,
      smooth,
      phase,
      phaseStableMs,
      intensity,
      promptBlock: phasePrompt(phase, intensity, latticeView)
    };
    last = state;
    savePartial(state);

    try {
      (window as any).__kurisuLattice = latticeView;
      (window as any).__kurisuResonance = state;
      embodimentBus.emit({
        emotion: phaseToExpression(phase, lattice.tone.emotion),
        breath: phase
      });
    } catch {
      /* SSR / no window */
    }
    return state;
  },

  get(): ResonanceState | null {
    return last || (typeof window !== 'undefined' ? (window as any).__kurisuResonance || null : null);
  },

  promptBlock(userMessage?: string): string {
    if (userMessage != null && userMessage !== '') {
      return this.resonate(userMessage).promptBlock;
    }
    return last?.promptBlock || this.resonate('').promptBlock;
  },

  expressionHint(): string {
    const s = this.get();
    if (!s) return 'thinking';
    return phaseToExpression(s.phase, s.lattice.tone.emotion);
  }
};

// safe offline self-test (no throw)
export function resonanceSelfTest(): { ok: boolean; detail: string } {
  try {
    const a = resonanceField.resonate('Кто ты?');
    const b = resonanceField.resonate('Ты милая');
    const c = resonanceField.resonate('Почему нейроны передают сигнал?');
    if (!a.promptBlock || !b.phase || !c.lattice.modules.length) {
      return { ok: false, detail: 'empty fields' };
    }
    if (latticeModuleCount() < 20) return { ok: false, detail: 'too few modules' };
    return {
      ok: true,
      detail: `modules=${latticeModuleCount()} phases=${a.phase}/${b.phase}/${c.phase}`
    };
  } catch (e) {
    return { ok: false, detail: String(e) };
  }
}
