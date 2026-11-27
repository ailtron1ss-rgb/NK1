/**
 * Assimilation of `research/neurocore-v143/src/neurocore/current/hippo_credit.py`
 * (HiPPO-LegS fixed history state) into the NK1 runtime.
 *
 * Potential benefit: an order-N (default 8) fixed-cost summary of the recent outcome
 * stream. Unlike an EWMA it keeps a compressed polynomial history, so the read-out
 * reacts to a *shift* of the error process, not only to its current level. The memory
 * write policy uses that shift to raise/lower write gain when the organism's error
 * regime changes, and the summary costs O(N^2) per step with no growing buffer.
 *
 * Deliberate differences from the Python source:
 * - scalar signal (input_dim = 1); the runtime feeds one aggregated outcome per step;
 * - `normalize` defaults to false, because normalising a scalar trace would erase the
 *   magnitude that the regime detector needs;
 * - no torch: the transition matrices are built once with plain number arrays and the
 *   bilinear discretisation is solved by Gauss-Jordan elimination with partial pivoting.
 */
export interface HippoLegsConfig {
  order?: number;
  dt?: number;
  clip?: number;
  normalize?: boolean;
  reconstructionScale?: number;
}

export interface HippoLegsSnapshot {
  version: 1;
  order: number;
  state: number[];
}

const DEFAULTS = { order: 8, dt: 0.1, clip: 4, normalize: false, reconstructionScale: 1 };

const identity = (n: number): number[][] => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

function solve(a: number[][], b: number[][]): number[][] {
  const n = a.length;
  const m = b[0]?.length ?? 0;
  const aug = a.map((row, i) => [...row, ...Array.from({ length: m }, (_, j) => b[i]![j] ?? 0)]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(aug[row]![col]!) > Math.abs(aug[pivot]![col]!)) pivot = row;
    if (Math.abs(aug[pivot]![col]!) < 1e-12) throw new Error('hippo-legs-singular-transition');
    if (pivot !== col) { const tmp = aug[pivot]!; aug[pivot] = aug[col]!; aug[col] = tmp; }
    const scale = aug[col]![col]!;
    for (let j = col; j < n + m; j++) aug[col]![j] = aug[col]![j]! / scale;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row]![col]!;
      if (factor === 0) continue;
      for (let j = col; j < n + m; j++) aug[row]![j] = aug[row]![j]! - factor * aug[col]![j]!;
    }
  }
  return aug.map(row => row.slice(n));
}

const matMul = (a: number[][], b: number[][]): number[][] =>
  a.map(row => b[0]!.map((_, j) => row.reduce((sum, value, k) => sum + value * b[k]![j]!, 0)));

export class HippoLegsCredit {
  readonly order: number;
  private readonly dt: number;
  private readonly clip: number;
  private readonly normalize: boolean;
  private readonly scale: number;
  private readonly aDiscrete: number[][];
  private readonly bDiscrete: number[];
  private readonly c: number[];
  private state: number[];
  private observations = 0;

  constructor(config: HippoLegsConfig = {}) {
    const order = Math.max(2, Math.min(32, Math.floor(Number(config.order ?? DEFAULTS.order))));
    this.order = order;
    this.dt = Number.isFinite(config.dt) ? Math.max(1e-4, Number(config.dt)) : DEFAULTS.dt;
    this.clip = Number.isFinite(config.clip) ? Math.max(1e-3, Number(config.clip)) : DEFAULTS.clip;
    this.normalize = config.normalize ?? DEFAULTS.normalize;
    this.scale = Number.isFinite(config.reconstructionScale) ? Number(config.reconstructionScale) : DEFAULTS.reconstructionScale;
    const n = order;
    const r = Array.from({ length: n }, (_, i) => 2 * i + 1);
    // M[i][j] = -((i>=j ? r[j] : 0) - (i===j ? i : 0)); T = diag(sqrt(r)); A = T M T^-1
    const t = r.map(value => Math.sqrt(value));
    const a = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
      const m = -((i >= j ? r[j]! : 0) - (i === j ? i : 0));
      return (t[i]! * m) / t[j]!;
    }));
    const b = t.slice();
    this.c = t.map((value, i) => value * (i % 2 === 0 ? 1 : -1));
    const half = 0.5 * this.dt;
    const left = identity(n).map((row, i) => row.map((value, j) => value - half * a[i]![j]!));
    const rightA = identity(n).map((row, i) => row.map((value, j) => value + half * a[i]![j]!));
    this.aDiscrete = solve(left, rightA);
    const rightB = b.map(value => [this.dt * value]);
    this.bDiscrete = solve(left, rightB).map(row => row[0]!);
    this.state = new Array(n).fill(0);
  }

  /** Reconstructed history trace *before* the current sample is committed. */
  read(): number {
    let trace = 0;
    for (let i = 0; i < this.order; i++) trace += this.c[i]! * this.state[i]!;
    trace *= this.scale;
    trace = Math.max(-this.clip, Math.min(this.clip, trace));
    if (this.normalize) {
      const norm = Math.max(0.25, Math.abs(trace));
      trace = trace / norm;
    }
    return trace;
  }

  update(signal: number): number {
    if (!Number.isFinite(signal)) throw new Error('hippo-legs-non-finite-signal');
    const clampedSignal = Math.max(-this.clip, Math.min(this.clip, signal));
    const next = new Array(this.order).fill(0);
    for (let i = 0; i < this.order; i++) {
      let value = this.bDiscrete[i]! * clampedSignal;
      for (let j = 0; j < this.order; j++) value += this.aDiscrete[i]![j]! * this.state[j]!;
      next[i] = Math.max(-this.clip, Math.min(this.clip, value));
    }
    this.state = next;
    this.observations++;
    return this.read();
  }

  reset(): void {
    this.state = new Array(this.order).fill(0);
    this.observations = 0;
  }

  stateNorm(): number {
    return Math.sqrt(this.state.reduce((sum, value) => sum + value * value, 0));
  }

  get sampleCount(): number { return this.observations; }

  snapshot(): HippoLegsSnapshot {
    return { version: 1, order: this.order, state: this.state.slice() };
  }

  restore(raw?: Partial<HippoLegsSnapshot> | null): void {
    if (!raw || raw.order !== this.order || !Array.isArray(raw.state)) { this.reset(); return; }
    this.state = raw.state.slice(0, this.order).map(value => (Number.isFinite(value) ? Math.max(-this.clip, Math.min(this.clip, Number(value))) : 0));
    while (this.state.length < this.order) this.state.push(0);
  }
}

export const defaultHippoLegsConfig = (): Required<HippoLegsConfig> => ({ ...DEFAULTS });
