/**
 * Owner of the assimilated memory write policy (wave 1).
 *
 * Combines three mechanisms ported from `research/neurocore-v143`:
 * - `UncertaintyWriteGate`      (uncertainty_write.py)    — per-channel reliability gain;
 * - `HippoLegsCredit`           (hippo_credit.py)         — fixed-cost history of the error stream;
 * - `FastSlowConsolidationGate` (fast_consolidation.py)   — evidence-gated revival of cooled memories;
 * - `DeepWorkSelector`          (adaptive_compute.py)     — bounded "deep vs shallow" evaluation.
 *
 * Potential benefit: the retention economy decides *whether* a memory is worth keeping, but it
 * looks at one snapshot of signals. This policy adds the missing temporal and reliability
 * dimensions: how noisy the channel has been, whether the error regime just shifted, and
 * whether a cooled memory has been stable long enough to be revived. The effect on the
 * retention score is a bounded multiplier (default 0.75..1.25), so the policy can never invert
 * a decision on its own.
 *
 * Modes:
 * - `shadow` (default): decisions are recorded for evaluation, behaviour is unchanged;
 * - `active`: the bounded gain is applied to the salience input and a stable, cooled memory
 *   may avoid dormancy;
 * - `off`: no decisions, no state growth.
 */
import { DeepWorkSelector } from './DeepWorkSelector.ts';
import { FastSlowConsolidationGate } from './FastSlowConsolidationGate.ts';
import { HippoLegsCredit, type HippoLegsSnapshot } from './HippoLegsCredit.ts';
import { UncertaintyWriteGate, type UncertaintyWriteSnapshot } from './UncertaintyWriteGate.ts';

export type MemoryWritePolicyMode = 'off' | 'shadow' | 'active';

export interface MemoryWritePolicyConfig {
  mode?: MemoryWritePolicyMode;
  channel?: string;
  gainMin01?: number;
  gainMax01?: number;
  historyBoost01?: number;
  perIdLimit?: number;
  recentLimit?: number;
}

export interface MemoryWriteInput {
  tick: number;
  id: string;
  channel?: string;
  salience01: number;
  predictionError01: number;
  dormant?: boolean;
}

export interface MemoryWriteDecision {
  mode: MemoryWritePolicyMode;
  id: string;
  channel: string;
  reliability01: number;
  historyShift01: number;
  writeGain01: number;
  promote: boolean;
  deep: boolean;
  reason: string;
}

interface PerIdHistory { observations: number; lastError01: number; lastSalience01: number; lastUpdate01: number; }

export interface MemoryWritePolicySnapshot {
  version: 1;
  mode: MemoryWritePolicyMode;
  decisions: number;
  shadowDecisions: number;
  activeDecisions: number;
  meanWriteGain01: number;
  meanReliability01: number;
  promotions: number;
  regimeShifts: number;
  historyShift01: number;
  deepSelections: number;
  shallowSelections: number;
  evictionAdjusted: number;
  evictionShadowWouldAdjust: number;
  uncertainty: UncertaintyWriteSnapshot;
  hippo: HippoLegsSnapshot;
  perId: Record<string, PerIdHistory>;
  recent: Array<{ id: string; tick: number; writeGain01: number; promote: boolean; deep: boolean; reason: string }>;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(x) ? x : min));
const MODES: MemoryWritePolicyMode[] = ['off', 'shadow', 'active'];

export const resolveMemoryWritePolicyMode = (value?: string | null): MemoryWritePolicyMode => {
  const raw = String(value ?? '').trim().toLowerCase();
  return (MODES as string[]).includes(raw) ? (raw as MemoryWritePolicyMode) : 'shadow';
};

export class MemoryWritePolicy {
  private mode: MemoryWritePolicyMode;
  private readonly channel: string;
  private readonly gainMin: number;
  private readonly gainMax: number;
  private readonly historyBoost: number;
  private readonly perIdLimit: number;
  private readonly recentLimit: number;
  private readonly uncertainty = new UncertaintyWriteGate();
  private readonly hippo = new HippoLegsCredit();
  private readonly fastSlow = new FastSlowConsolidationGate();
  private readonly deepWork = new DeepWorkSelector();
  private decisions = 0;
  private shadowDecisions = 0;
  private activeDecisions = 0;
  private meanWriteGain01 = 1;
  private meanReliability01 = 0.5;
  private promotions = 0;
  private regimeShifts = 0;
  private historyShift01 = 0;
  private deepSelections = 0;
  private shallowSelections = 0;
  private evictionAdjusted = 0;
  private evictionShadowWouldAdjust = 0;
  private perId = new Map<string, PerIdHistory>();
  private recent: MemoryWritePolicySnapshot['recent'] = [];

  constructor(config: MemoryWritePolicyConfig = {}) {
    this.mode = resolveMemoryWritePolicyMode(config.mode);
    this.channel = String(config.channel ?? 'content');
    this.gainMin = clamp(Number(config.gainMin01 ?? 0.75), 0.1, 1);
    this.gainMax = clamp(Number(config.gainMax01 ?? 1.25), this.gainMin, 4);
    this.historyBoost = clamp(Number(config.historyBoost01 ?? 0.25), 0, 1);
    this.perIdLimit = Math.max(16, Math.min(2048, Math.floor(Number(config.perIdLimit ?? 256))));
    this.recentLimit = Math.max(8, Math.min(256, Math.floor(Number(config.recentLimit ?? 64))));
  }

  setMode(mode: MemoryWritePolicyMode): void { this.mode = resolveMemoryWritePolicyMode(mode); }
  getMode(): MemoryWritePolicyMode { return this.mode; }

  decide(input: MemoryWriteInput): MemoryWriteDecision {
    const channel = String(input.channel ?? this.channel);
    const reliability01 = this.uncertainty.reliability01(channel);
    const gateGain = this.uncertainty.gain(channel);
    const boosted = gateGain * (1 + this.historyBoost * this.historyShift01);
    const writeGain01 = clamp(boosted, this.gainMin, this.gainMax);
    const history = this.history(input.id);
    const difficulty = this.deepWork.difficulty({ deltaMagnitude: clamp01(input.predictionError01), updateClip: 1, routeEntropy: 0, rank: 2 });
    const deep = this.deepWork.select([difficulty], { forceDeep: false }).mask[0] === true;
    const stability = this.fastSlow.decide({
      updateCount: history.observations,
      fastNorm: clamp01(input.salience01),
      lastErrorNorm: history.lastError01,
      lastUpdateNorm: history.lastUpdate01,
    });
    const promote = Boolean(input.dormant) && stability.promote;
    const reason = promote ? 'revived-stable-memory'
      : deep ? `deep:${stability.reason}`
      : `shallow:${stability.reason}`;
    if (this.mode !== 'off') {
      const next = this.decisions + 1;
      this.decisions = next;
      this.meanWriteGain01 = this.meanWriteGain01 * (next - 1) / next + writeGain01 / next;
      this.meanReliability01 = this.meanReliability01 * (next - 1) / next + reliability01 / next;
      if (this.mode === 'active') this.activeDecisions++; else this.shadowDecisions++;
      if (promote) this.promotions++;
      if (deep) this.deepSelections++; else this.shallowSelections++;
      this.recent = [{ id: String(input.id), tick: Math.max(0, Math.floor(Number(input.tick) || 0)), writeGain01, promote, deep, reason }, ...this.recent].slice(0, this.recentLimit);
    }
    return { mode: this.mode, id: String(input.id), channel, reliability01, historyShift01: this.historyShift01, writeGain01, promote, deep, reason };
  }

  /** Commit the outcome of one write so the next decision has history and reliability context. */
  observeOutcome(input: { tick: number; id: string; success01: number; predictionError01: number; retentionScore01?: number }): void {
    const error01 = clamp01(input.predictionError01);
    this.uncertainty.observe(this.channel, error01);
    const previousRead = this.hippo.read();
    const read = this.hippo.update(error01);
    const shift = clamp01(Math.abs(read - previousRead));
    if (shift > 0.15) this.regimeShifts++;
    this.historyShift01 = this.historyShift01 * 0.9 + shift * 0.1;
    const key = String(input.id);
    const history = this.perId.get(key) ?? { observations: 0, lastError01: 0, lastSalience01: 0, lastUpdate01: 0 };
    const salience = clamp01(Number(input.retentionScore01 ?? 0));
    const update = Math.abs(salience - history.lastSalience01);
    this.perId.set(key, {
      observations: history.observations + 1,
      lastError01: error01,
      lastSalience01: salience,
      lastUpdate01: update,
    });
    while (this.perId.size > this.perIdLimit) {
      const oldest = this.perId.keys().next().value;
      if (oldest === undefined) break;
      this.perId.delete(oldest);
    }
  }

  /**
   * Bounded multiplier for byte-budget eviction ranking: memories whose channel is reliable
   * and whose prediction error has been low are protected (weight > 1), noisy ones are
   * evicted earlier (weight < 1). Memories with no write-time observation get exactly 1, so the
   * default ordering is untouched; with one observation the effect is scaled to a third. Only
   * `active` returns a value other than 1; `shadow` records how often it would have.
   */
  evictionWeight01(id: string): number {
    const history = this.perId.get(String(id));
    if (!history || history.observations < 1) return 1;
    const reliability = this.uncertainty.reliability01(this.channel);
    const quality01 = clamp01(0.5 * reliability + 0.5 * (1 - history.lastError01));
    const target = clamp(0.85 + 0.35 * quality01 - 0.15 * history.lastUpdate01, 0.85, 1.2);
    // A memory usually carries a single write-time observation, so scale the effect by how
    // much evidence exists; a uniform multiplier would not change eviction order at all.
    const confidence = Math.min(1, history.observations / 3);
    const weight = 1 + (target - 1) * confidence;
    if (this.mode === 'off') return 1;
    if (Math.abs(weight - 1) < 0.01) return 1;
    if (this.mode === 'active') { this.evictionAdjusted++; return weight; }
    this.evictionShadowWouldAdjust++;
    return 1;
  }

  private history(id: string): PerIdHistory {
    return this.perId.get(String(id)) ?? { observations: 0, lastError01: 0, lastSalience01: 0, lastUpdate01: 0 };
  }

  diagnostics() {
    return {
      mode: this.mode,
      decisions: this.decisions,
      shadowDecisions: this.shadowDecisions,
      activeDecisions: this.activeDecisions,
      meanWriteGain01: this.meanWriteGain01,
      meanReliability01: this.meanReliability01,
      promotions: this.promotions,
      regimeShifts: this.regimeShifts,
      historyShift01: this.historyShift01,
      deepSelections: this.deepSelections,
      shallowSelections: this.shallowSelections,
      evictionAdjusted: this.evictionAdjusted,
      evictionShadowWouldAdjust: this.evictionShadowWouldAdjust,
      trackedMemories: this.perId.size,
      uncertainty: this.uncertainty.diagnostics(),
      fastSlow: this.fastSlow.diagnostics(),
      deepWork: this.deepWork.diagnostics(),
      hippo: { order: this.hippo.order, samples: this.hippo.sampleCount, stateNorm: this.hippo.stateNorm() },
      recent: this.recent.slice(0, 8),
    };
  }

  snapshot(): MemoryWritePolicySnapshot {
    return {
      version: 1,
      mode: this.mode,
      decisions: this.decisions,
      shadowDecisions: this.shadowDecisions,
      activeDecisions: this.activeDecisions,
      meanWriteGain01: this.meanWriteGain01,
      meanReliability01: this.meanReliability01,
      promotions: this.promotions,
      regimeShifts: this.regimeShifts,
      historyShift01: this.historyShift01,
      deepSelections: this.deepSelections,
      shallowSelections: this.shallowSelections,
      evictionAdjusted: this.evictionAdjusted,
      evictionShadowWouldAdjust: this.evictionShadowWouldAdjust,
      uncertainty: this.uncertainty.snapshot(),
      hippo: this.hippo.snapshot(),
      perId: Object.fromEntries(this.perId),
      recent: this.recent.slice(),
    };
  }

  restore(raw?: Partial<MemoryWritePolicySnapshot> | null): void {
    this.decisions = Math.max(0, Math.floor(Number(raw?.decisions ?? 0)));
    this.shadowDecisions = Math.max(0, Math.floor(Number(raw?.shadowDecisions ?? 0)));
    this.activeDecisions = Math.max(0, Math.floor(Number(raw?.activeDecisions ?? 0)));
    this.meanWriteGain01 = clamp(Number(raw?.meanWriteGain01 ?? 1), this.gainMin, this.gainMax);
    this.meanReliability01 = clamp01(Number(raw?.meanReliability01 ?? 0.5));
    this.promotions = Math.max(0, Math.floor(Number(raw?.promotions ?? 0)));
    this.regimeShifts = Math.max(0, Math.floor(Number(raw?.regimeShifts ?? 0)));
    this.historyShift01 = clamp01(Number(raw?.historyShift01 ?? 0));
    this.deepSelections = Math.max(0, Math.floor(Number(raw?.deepSelections ?? 0)));
    this.shallowSelections = Math.max(0, Math.floor(Number(raw?.shallowSelections ?? 0)));
    this.evictionAdjusted = Math.max(0, Math.floor(Number(raw?.evictionAdjusted ?? 0)));
    this.evictionShadowWouldAdjust = Math.max(0, Math.floor(Number(raw?.evictionShadowWouldAdjust ?? 0)));
    this.uncertainty.restore(raw?.uncertainty);
    this.hippo.restore(raw?.hippo);
    this.perId.clear();
    for (const [key, value] of Object.entries(raw?.perId ?? {}).slice(0, this.perIdLimit)) {
      if (!value || typeof value !== 'object') continue;
      this.perId.set(key, {
        observations: Math.max(0, Math.floor(Number(value.observations ?? 0))),
        lastError01: clamp01(Number(value.lastError01 ?? 0)),
        lastSalience01: clamp01(Number(value.lastSalience01 ?? 0)),
        lastUpdate01: clamp01(Number(value.lastUpdate01 ?? 0)),
      });
    }
    this.recent = Array.isArray(raw?.recent)
      ? raw!.recent.slice(0, this.recentLimit).map(row => ({
        id: String(row?.id ?? ''),
        tick: Math.max(0, Math.floor(Number(row?.tick ?? 0))),
        writeGain01: clamp(Number(row?.writeGain01 ?? 1), this.gainMin, this.gainMax),
        promote: Boolean(row?.promote),
        deep: Boolean(row?.deep),
        reason: String(row?.reason ?? '').slice(0, 120),
      }))
      : [];
  }
}

export const defaultMemoryWritePolicySnapshot = (): MemoryWritePolicySnapshot => new MemoryWritePolicy({ mode: 'off' }).snapshot();
