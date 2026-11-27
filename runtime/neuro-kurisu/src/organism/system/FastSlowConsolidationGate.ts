/**
 * Assimilation of `research/neurocore-v143/src/neurocore/current/fast_consolidation.py`
 * (stability-gated promotion of fast state into slow state).
 *
 * Potential benefit: the runtime already cools memories that look low-value, but nothing
 * decides when a cooled item has become *stable and useful* again. Without that gate a
 * cooled item either stays dormant forever or is revived on one lucky step. The gate
 * promotes only after a minimum number of observations, with bounded error/update norms,
 * and protects already-important coordinates by shrinking their blend factor. That turns
 * "revival" into an evidence-backed decision and prevents a single noisy outcome from
 * rewriting canonical state.
 *
 * Deliberate differences from the Python source: no tensors, so the gate returns a
 * decision plus an optional next slow vector; the promotion interval is owned by the
 * caller (the memory write policy), not by a trainer loop.
 */
export interface FastSlowConfig {
  blend01?: number;
  minimumFastNorm?: number;
  maximumErrorNorm?: number;
  maximumUpdateNorm?: number;
  minimumUpdates?: number;
  protectionStrength?: number;
}

export type FastSlowReason =
  | 'promoted'
  | 'insufficient-updates'
  | 'fast-norm-too-small'
  | 'error-not-stable'
  | 'update-not-stable'
  | 'shape-mismatch';

export interface FastSlowDecision {
  promote: boolean;
  reason: FastSlowReason;
  blend01: number;
  effectiveBlend01: number;
}

const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const norm = (values: number[]) => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));

export class FastSlowConsolidationGate {
  private readonly blend: number;
  private readonly minimumFastNorm: number;
  private readonly maximumErrorNorm: number;
  private readonly maximumUpdateNorm: number;
  private readonly minimumUpdates: number;
  private readonly protectionStrength: number;

  constructor(config: FastSlowConfig = {}) {
    const blend = Number(config.blend01 ?? 0.05);
    this.blend = blend > 0 && blend <= 1 ? blend : 0.05;
    this.minimumFastNorm = Math.max(0, Number(config.minimumFastNorm ?? 0.05));
    this.maximumErrorNorm = Math.max(0, Number(config.maximumErrorNorm ?? 0.2));
    this.maximumUpdateNorm = Math.max(0, Number(config.maximumUpdateNorm ?? 0.05));
    this.minimumUpdates = Math.max(0, Math.floor(Number(config.minimumUpdates ?? 8)));
    this.protectionStrength = Math.max(0, Number(config.protectionStrength ?? 0.5));
  }

  decide(input: { updateCount: number; fastNorm: number; lastErrorNorm: number; lastUpdateNorm: number; fast?: number[]; slow?: number[]; importance?: number[] }): FastSlowDecision {
    const updates = Math.max(0, Math.floor(Number(input.updateCount ?? 0)));
    const fastNorm = Math.max(0, Number(input.fastNorm ?? 0));
    const errorNorm = Math.max(0, Number(input.lastErrorNorm ?? 0));
    const updateNorm = Math.max(0, Number(input.lastUpdateNorm ?? 0));
    const base: FastSlowDecision = { promote: false, reason: 'insufficient-updates', blend01: this.blend, effectiveBlend01: 0 };
    if (updates < this.minimumUpdates) return base;
    if (fastNorm < this.minimumFastNorm) return { ...base, reason: 'fast-norm-too-small' };
    if (errorNorm > this.maximumErrorNorm) return { ...base, reason: 'error-not-stable' };
    if (updateNorm > this.maximumUpdateNorm) return { ...base, reason: 'update-not-stable' };
    if (input.fast && input.slow && input.fast.length !== input.slow.length) return { ...base, reason: 'shape-mismatch' };
    const effectiveBlend01 = this.effectiveBlend(input.fast ?? [], input.importance);
    return { promote: true, reason: 'promoted', blend01: this.blend, effectiveBlend01 };
  }

  /**
   * Importance-protected blend: an already-important coordinate keeps most of its value,
   * a low-importance coordinate is free to absorb new evidence.
   */
  private effectiveBlend(fast: number[], importance?: number[]): number {
    if (!importance || importance.length !== fast.length || this.protectionStrength <= 0) return this.blend;
    const mean = importance.reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0) / Math.max(1, importance.length);
    if (mean <= 1e-9) return this.blend;
    let total = 0;
    for (const value of importance) {
      const relative = Math.abs(Number(value) || 0) / mean;
      total += this.blend / (1 + this.protectionStrength * relative);
    }
    return clamp(total / Math.max(1, importance.length));
  }

  /** Numeric promotion: returns the next slow vector only when the gate promotes. */
  promote(input: { updateCount: number; lastErrorNorm: number; lastUpdateNorm: number; fast: number[]; slow: number[]; importance?: number[] }): { promoted: boolean; reason: FastSlowReason; blend01: number; slow: number[] } {
    const decision = this.decide({
      updateCount: input.updateCount,
      fastNorm: norm(input.fast),
      lastErrorNorm: input.lastErrorNorm,
      lastUpdateNorm: input.lastUpdateNorm,
      fast: input.fast,
      slow: input.slow,
      importance: input.importance,
    });
    if (!decision.promote) return { promoted: false, reason: decision.reason, blend01: 0, slow: input.slow.slice() };
    const mean = input.importance && input.importance.length === input.fast.length
      ? input.importance.reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0) / Math.max(1, input.importance.length)
      : 0;
    const slow = input.slow.map((value, index) => {
      const protection = mean > 1e-9 && input.importance
        ? this.blend / (1 + this.protectionStrength * (Math.abs(Number(input.importance[index]) || 0) / mean))
        : this.blend;
      return value + protection * input.fast[index]!;
    });
    return { promoted: true, reason: decision.reason, blend01: decision.effectiveBlend01, slow };
  }

  diagnostics(): { blend01: number; minimumUpdates: number; minimumFastNorm: number; maximumErrorNorm: number; maximumUpdateNorm: number; protectionStrength: number } {
    return {
      blend01: this.blend,
      minimumUpdates: this.minimumUpdates,
      minimumFastNorm: this.minimumFastNorm,
      maximumErrorNorm: this.maximumErrorNorm,
      maximumUpdateNorm: this.maximumUpdateNorm,
      protectionStrength: this.protectionStrength,
    };
  }
}
