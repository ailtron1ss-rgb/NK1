/**
 * Assimilation of `research/neurocore-v143/src/neurocore/current/uncertainty_write.py`
 * (diagonal uncertainty / reliability gain for a recurrent write).
 *
 * Potential benefit: a channel whose residuals have been large recently is poorly
 * calibrated, so writing into it again is likely to add noise; a channel with small
 * residuals is reliable and can accept a stronger write. The gain is bounded
 * [gainMin, gainMax] and normalised, so it can only attenuate or amplify a write by a
 * known factor and can never invert a decision. This is the cheap, parameter-free half
 * of the memory write policy: no learned weights, no extra state owner.
 *
 * Deliberate differences from the Python source: named channels instead of a tensor
 * axis, and the EWMA/gain update is applied per observation of one channel.
 */
export interface UncertaintyWriteConfig {
  varianceDecay01?: number;
  floor?: number;
  gainMin?: number;
  gainMax?: number;
  normalization?: boolean;
}

export interface UncertaintyWriteSnapshot {
  version: 1;
  channels: string[];
  variance: Record<string, number>;
  gain: Record<string, number>;
  observations: number;
}

const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

export class UncertaintyWriteGate {
  private readonly decay: number;
  private readonly floor: number;
  private readonly gainMin: number;
  private readonly gainMax: number;
  private readonly normalization: boolean;
  private variance = new Map<string, number>();
  private gainByChannel = new Map<string, number>();
  private observations = 0;

  constructor(config: UncertaintyWriteConfig = {}) {
    const decay = Number(config.varianceDecay01 ?? 0.98);
    this.decay = decay > 0 && decay < 1 ? decay : 0.98;
    this.floor = Number.isFinite(config.floor) ? Math.max(1e-6, Number(config.floor)) : 1e-3;
    const min = Number(config.gainMin ?? 0.25);
    const max = Number(config.gainMax ?? 1.5);
    this.gainMin = min > 0 && min <= max ? min : 0.25;
    this.gainMax = max >= this.gainMin ? max : 1.5;
    this.normalization = config.normalization ?? true;
  }

  /** Update the residual variance of one channel and return its bounded reliability gain. */
  observe(channel: string, residual: number): number {
    const key = String(channel);
    const value = Number.isFinite(residual) ? Math.abs(residual) : 0;
    const previous = this.variance.get(key) ?? 1;
    const variance = this.decay * previous + (1 - this.decay) * value * value;
    this.variance.set(key, variance);
    const gain = this.computeGain(variance);
    this.gainByChannel.set(key, gain);
    this.observations++;
    return gain;
  }

  private computeGain(variance: number): number {
    const raw = 1 / Math.sqrt(Math.max(this.floor, variance));
    const gain = this.normalization ? raw / Math.max(1e-6, this.meanGain()) : raw;
    return Math.max(this.gainMin, Math.min(this.gainMax, gain));
  }

  /** Normalisation uses every channel seen so far, so the gain stays scale-free. */
  private meanGain(): number {
    const values = [...this.variance.values()].map(variance => 1 / Math.sqrt(Math.max(this.floor, variance)));
    return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  }

  gain(channel: string): number {
    return this.gainByChannel.get(String(channel)) ?? 1;
  }

  /** Fraction of clamped range, useful as a scalar "reliability01" for downstream scoring. */
  reliability01(channel: string): number {
    const gain = this.gain(channel);
    const span = Math.max(1e-6, this.gainMax - this.gainMin);
    return clamp((gain - this.gainMin) / span);
  }

  diagnostics(): { observations: number; channels: number; meanGain: number; minGain: number; maxGain: number; floor: number } {
    const gains = [...this.gainByChannel.values()];
    return {
      observations: this.observations,
      channels: gains.length,
      meanGain: gains.length ? gains.reduce((sum, value) => sum + value, 0) / gains.length : 1,
      minGain: gains.length ? Math.min(...gains) : 1,
      maxGain: gains.length ? Math.max(...gains) : 1,
      floor: this.floor,
    };
  }

  snapshot(): UncertaintyWriteSnapshot {
    return {
      version: 1,
      channels: [...this.gainByChannel.keys()],
      variance: Object.fromEntries(this.variance),
      gain: Object.fromEntries(this.gainByChannel),
      observations: this.observations,
    };
  }

  restore(raw?: Partial<UncertaintyWriteSnapshot> | null): void {
    this.variance.clear();
    this.gainByChannel.clear();
    this.observations = 0;
    if (!raw) return;
    for (const [key, value] of Object.entries(raw.variance ?? {})) {
      const number = Number(value);
      if (Number.isFinite(number) && number >= 0) this.variance.set(key, number);
    }
    for (const [key, value] of Object.entries(raw.gain ?? {})) {
      const number = Number(value);
      if (Number.isFinite(number)) this.gainByChannel.set(key, Math.max(this.gainMin, Math.min(this.gainMax, number)));
    }
    this.observations = Math.max(0, Math.floor(Number(raw.observations ?? 0)));
  }
}
