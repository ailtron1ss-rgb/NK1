/**
 * Interoceptive precision allocation for a bounded cognitive workspace.
 *
 * Allocates a finite attention/precision budget across internal need channels.
 * The selector is driven by the organism's current body-state estimate, not by
 * external task salience alone. This is a small computational hypothesis, not
 * a literal model of the insula or a claim of biological equivalence.
 *
 * Inspired by dynamic homeostatic prioritisation (Grimbly et al., 2026,
 * arXiv:2608.04232) and the finite-resource attention mechanisms in Will.
 */
export const INTEROCEPTIVE_CHANNELS = ['energy', 'thermal', 'cognitiveLoad', 'sleepPressure'] as const;
export type InteroceptiveChannel = typeof INTEROCEPTIVE_CHANNELS[number];
export type InteroceptiveNeedVector = Record<InteroceptiveChannel, number>;
export interface InteroceptivePrecisionInput extends InteroceptiveNeedVector {
  attentionBudget01?: number;
}
export interface InteroceptivePrecisionAllocation {
  budget01: number;
  allocation01: InteroceptiveNeedVector;
  share01: InteroceptiveNeedVector;
  urgency01: InteroceptiveNeedVector;
  dominantChannel: InteroceptiveChannel | 'none';
  entropy01: number;
}
const clamp01 = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const TEMPERATURE = 0.22;
const MIN_SHARE = 0.08;

export class InteroceptivePrecisionAllocator {
  allocate(input: InteroceptivePrecisionInput): InteroceptivePrecisionAllocation {
    const urgency01: InteroceptiveNeedVector = {
      energy: clamp01(1 - clamp01(input.energy)),
      thermal: clamp01(input.thermal),
      cognitiveLoad: clamp01(input.cognitiveLoad),
      sleepPressure: clamp01(input.sleepPressure),
    };
    const budget01 = clamp01(input.attentionBudget01 ?? 1);
    const maximum = Math.max(...INTEROCEPTIVE_CHANNELS.map(channel => urgency01[channel]));
    const exponentials = INTEROCEPTIVE_CHANNELS.map(channel =>
      Math.exp((urgency01[channel] - maximum) / TEMPERATURE)
    );
    const total = exponentials.reduce((sum, value) => sum + value, 0);
    const softmax = exponentials.map(value => total > 0 ? value / total : 1 / INTEROCEPTIVE_CHANNELS.length);
    const distributable = 1 - MIN_SHARE * INTEROCEPTIVE_CHANNELS.length;
    const shares = softmax.map(value => MIN_SHARE + distributable * value);
    const share01 = Object.fromEntries(INTEROCEPTIVE_CHANNELS.map((channel, index) =>
      [channel, shares[index]]
    )) as InteroceptiveNeedVector;
    const allocation01 = Object.fromEntries(INTEROCEPTIVE_CHANNELS.map(channel =>
      [channel, budget01 * share01[channel]]
    )) as InteroceptiveNeedVector;
    const dominantIndex = shares.indexOf(Math.max(...shares));
    const entropy = shares.reduce((sum, share) => sum - share * Math.log(Math.max(share, Number.EPSILON)), 0);
    const entropy01 = clamp01(entropy / Math.log(INTEROCEPTIVE_CHANNELS.length));
    return {
      budget01,
      allocation01,
      share01,
      urgency01,
      dominantChannel: budget01 > 0 ? INTEROCEPTIVE_CHANNELS[dominantIndex] : 'none',
      entropy01,
    };
  }
}
