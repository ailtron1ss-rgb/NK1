/**
 * MiRU-inspired lightweight recurrent state.
 *
 * The 2025 MiRU paper proposes a simplified GRU variant with scaling
 * coefficients for continual learning. This module does not claim to be a
 * trained MiRU network; it uses the same engineering principle: a tiny
 * recurrent state with cheap multiplicative updates, suitable for mobile
 * control signals.
 */
import { readJson, writeJson, clamp } from './StateVault';

export interface MiRUState {
  h: number[];
  steps: number;
  lastAt: number;
}

const KEY = 'kurisu_miru_state_v1';
const N = 16;

function fresh(): MiRUState { return { h: Array(N).fill(0), steps: 0, lastAt: 0 }; }
function load(): MiRUState {
  const s = readJson<MiRUState>(KEY, fresh());
  return { ...fresh(), ...s, h: Array.isArray(s.h) ? s.h.slice(0, N) : Array(N).fill(0) };
}
function save(s: MiRUState) { writeJson(KEY, s); }

function feature(text: string, i: number) {
  let x = 2166136261 ^ i;
  for (let k = 0; k < text.length; k++) x = Math.imul(x ^ text.charCodeAt(k), 16777619);
  return ((x >>> 0) / 4294967295) * 2 - 1;
}

export const miruState = {
  update(text: string, energy = 0.5, novelty = 0.5) {
    const s = load();
    const e = clamp(energy, 0, 1);
    const n = clamp(novelty, 0, 1);
    const alpha = 0.12 + e * 0.10;
    for (let i = 0; i < N; i++) {
      const x = feature(text, i) * 0.75 + (i % 2 ? e : n) * 0.25;
      s.h[i] = clamp(s.h[i] * (1 - alpha) + x * alpha, -1, 1);
    }
    s.steps++;
    s.lastAt = Date.now();
    save(s);
    return this.snapshot();
  },
  snapshot() {
    const s = load();
    const mean = s.h.reduce((a, b) => a + b, 0) / N;
    const energy = s.h.reduce((a, b) => a + Math.abs(b), 0) / N;
    return { ...s, mean, energy };
  },
  promptHint(max = 500) {
    const s = this.snapshot();
    return `[MICRO-STATE] recurrent_mean=${s.mean.toFixed(2)} activation=${s.energy.toFixed(2)} steps=${s.steps}; use only as behavioral signal.`;
  }
};
