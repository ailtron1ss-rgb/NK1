import { cosineSimilarity as cosine } from '../core/NumericPrimitives.ts';
export interface WorkspaceCandidateV2 {
  id: string;
  source: string;
  features: number[];
  salience: number;
  content?: Record<string, unknown>;
}

export interface WorkspaceDecisionCreditCandidate {
  id: string;
  source: string;
  weight01: number;
  features: number[];
  eligible: boolean;
}

export interface WorkspaceDecisionCreditReceipt {
  decisionId: string;
  tick: number;
  action: string;
  at: number;
  coalition: WorkspaceDecisionCreditCandidate[];
  outcomeIds: string[];
  lastOutcomeAt: number;
}

export interface GlobalWorkspaceSubstrateState {
  version: 1;
  capacity: number;
  featureDim: number;
  latentDim: number;
  temperature: number;
  latent: number[];
  gateWeights: number[];
  gateBias: number;
  recurrentWeights: number[][];
  broadcastWeights: number[][];
  selectedIds: string[];
  weights: number[];
  ignition01: number;
  recurrence01: number;
  diversity01: number;
  broadcast01: number;
  cycles: number;
  lesion: { recurrence: boolean; broadcast: boolean; competition: boolean };
  decisionReceipts: WorkspaceDecisionCreditReceipt[];
  learning: {
    samples: number;
    rewardMean01: number;
    gateUpdates: number;
    decisionsRegistered: number;
    outcomesApplied: number;
    outcomesReplayed: number;
    outcomesUnmatched: number;
    expiredDecisionReceipts: number;
  };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clamp11 = (x: number) => Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
const tanh = (x: number) => Math.tanh(Number.isFinite(x) ? x : 0);
const sigmoid = (x: number) => 1 / (1 + Math.exp(-Math.max(-8, Math.min(8, x))));
const stableSeed = (seed: number) => {
  let x = seed | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x45d9f3b);
  x ^= x >>> 16;
  x = Math.imul(x, 0x45d9f3b);
  x ^= x >>> 16;
  return x | 0;
};
const weight = (seed: number, scale = 0.04) => (((stableSeed(seed) >>> 0) / 4294967295) * 2 - 1) * scale;
const matrix = (rows: number, cols: number, seed: number, scale = 0.04) =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => weight(seed + r * 131 + c * 17, scale)));

function vector(raw: unknown, size: number) {
  const out = new Array(size).fill(0);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < Math.min(size, raw.length); i++) out[i] = clamp11(Number(raw[i]));
  return out;
}

const defaultState = (): GlobalWorkspaceSubstrateState => ({
  version: 1,
  capacity: 5,
  featureDim: 12,
  latentDim: 24,
  temperature: 0.22,
  latent: new Array(24).fill(0),
  gateWeights: Array.from({ length: 12 }, (_, i) => weight(21000 + i, 0.07)),
  gateBias: 0,
  recurrentWeights: matrix(24, 24, 22000, 0.03),
  broadcastWeights: matrix(16, 24, 23000, 0.035),
  selectedIds: [],
  weights: [],
  ignition01: 0,
  recurrence01: 0,
  diversity01: 0,
  broadcast01: 0,
  cycles: 0,
  lesion: { recurrence: false, broadcast: false, competition: false },
  decisionReceipts: [],
  learning: {
    samples: 0, rewardMean01: 0.5, gateUpdates: 0,
    decisionsRegistered: 0, outcomesApplied: 0, outcomesReplayed: 0,
    outcomesUnmatched: 0, expiredDecisionReceipts: 0,
  },
});

/**
 * Central recurrent workspace substrate. It is a research/engineering mechanism,
 * not a consciousness detector or a claim of subjective experience.
 *
 * Competition selects a bounded coalition; recurrence carries the selected
 * content into the next latent state; broadcast exposes a compressed global
 * representation to other modules. Each component can be lesioned independently
 * for causal tests.
 */
export class GlobalWorkspaceSubstrateV2 {
  private state = defaultState();
  private lastAdmission = { inputCount: 0, uniqueCount: 0, admittedCount: 0, duplicateCount: 0, invalidCount: 0, overflowCount: 0, admittedBySource: {} as Record<string, number> };
  private lastSelectedCandidates: WorkspaceCandidateV2[] = [];

  snapshot() { return structuredClone(this.state); }

  restore(raw?: Partial<GlobalWorkspaceSubstrateState> | null) {
    const d = defaultState();
    const r = raw ?? {};
    const arr = (v: unknown, n: number) => vector(v, n);
    const mat = (v: unknown, rows: number, cols: number, seed: number) => {
      if (!Array.isArray(v)) return matrix(rows, cols, seed, 0.03);
      return Array.from({ length: rows }, (_, i) => Array.isArray(v[i]) ? vector(v[i], cols) : matrix(1, cols, seed + i, 0.03)[0]);
    };
    this.state = {
      ...d,
      ...r,
      latent: arr(r.latent, d.latentDim),
      gateWeights: arr(r.gateWeights, d.featureDim),
      gateBias: Number.isFinite(Number(r.gateBias)) ? Number(r.gateBias) : d.gateBias,
      recurrentWeights: mat(r.recurrentWeights, d.latentDim, d.latentDim, 22000),
      broadcastWeights: mat(r.broadcastWeights, 16, d.latentDim, 23000),
      selectedIds: Array.isArray(r.selectedIds) ? r.selectedIds.slice(0, d.capacity).filter((id): id is string => typeof id === 'string').slice(0, d.capacity) : [],
      weights: Array.isArray(r.weights) ? r.weights.slice(0, d.capacity).map(value => clamp01(Number(value))) : [],
      lesion: { ...d.lesion, ...(r.lesion ?? {}) },
      decisionReceipts: (() => {
        const receipts = Array.isArray(r.decisionReceipts) ? r.decisionReceipts.slice(-64) : [];
        const seen = new Set<string>();
        const clean: WorkspaceDecisionCreditReceipt[] = [];
        for (const raw of receipts) {
          if (!raw || typeof raw !== 'object' || typeof (raw as any).decisionId !== 'string' ||
              typeof (raw as any).action !== 'string') continue;
          const decisionId = String((raw as any).decisionId).trim();
          const action = String((raw as any).action).trim();
          if (!decisionId || decisionId.length > 180 || /[\\u0000-\\u001f\\u007f]/.test(decisionId) ||
              !action || action.length > 80 || /[\\u0000-\\u001f\\u007f]/.test(action) || seen.has(decisionId)) continue;
          const coalition = Array.isArray((raw as any).coalition) ? (raw as any).coalition.slice(0, d.capacity).flatMap((candidate: any) => {
            if (!candidate || typeof candidate.id !== 'string' || typeof candidate.source !== 'string') return [];
            return [{
              id: candidate.id.slice(0, 180),
              source: candidate.source.slice(0, 64),
              weight01: clamp01(Number(candidate.weight01)),
              features: vector(candidate.features, d.featureDim),
              eligible: candidate.eligible === true,
            }];
          }) : [];
          clean.push({
            decisionId, action,
            tick: Math.max(0, Math.floor(Number((raw as any).tick ?? 0))),
            at: Math.max(0, Number((raw as any).at ?? 0)),
            coalition,
            outcomeIds: Array.isArray((raw as any).outcomeIds)
              ? (raw as any).outcomeIds.filter((id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 180).slice(-8)
              : [],
            lastOutcomeAt: Math.max(0, Number((raw as any).lastOutcomeAt ?? 0)),
          });
          seen.add(decisionId);
        }
        return clean.slice(-64);
      })(),
      learning: {
        ...d.learning,
        ...(r.learning ?? {}),
        samples: Math.max(0, Math.floor(Number(r.learning?.samples ?? d.learning.samples))),
        rewardMean01: clamp01(Number(r.learning?.rewardMean01 ?? d.learning.rewardMean01)),
        gateUpdates: Math.max(0, Math.floor(Number(r.learning?.gateUpdates ?? d.learning.gateUpdates))),
        decisionsRegistered: Math.max(0, Math.floor(Number(r.learning?.decisionsRegistered ?? d.learning.decisionsRegistered))),
        outcomesApplied: Math.max(0, Math.floor(Number(r.learning?.outcomesApplied ?? d.learning.outcomesApplied))),
        outcomesReplayed: Math.max(0, Math.floor(Number(r.learning?.outcomesReplayed ?? d.learning.outcomesReplayed))),
        outcomesUnmatched: Math.max(0, Math.floor(Number(r.learning?.outcomesUnmatched ?? d.learning.outcomesUnmatched))),
        expiredDecisionReceipts: Math.max(0, Math.floor(Number(r.learning?.expiredDecisionReceipts ?? d.learning.expiredDecisionReceipts))),
      },
    };
  }

  private score(candidate: WorkspaceCandidateV2, context: number[]) {
    const features = vector(candidate.features, this.state.featureDim);
    let z = this.state.gateBias + Math.log(Math.max(1e-4, candidate.salience));
    for (let i = 0; i < features.length; i++) z += this.state.gateWeights[i] * features[i];
    for (let i = 0; i < Math.min(context.length, features.length); i++) z += 0.03 * context[i] * features[i];
    return z;
  }

  private updateLatent(coalition: WorkspaceCandidateV2[], selectionWeights: number[]) {
    const source = this.state.latentDim === 0 ? [] : new Array(this.state.latentDim).fill(0);
    for (let k = 0; k < coalition.length; k++) {
      const f = vector(coalition[k].features, this.state.featureDim);
      const w = selectionWeights[k] ?? 0;
      for (let j = 0; j < source.length; j++) source[j] += w * f[j % f.length];
    }
    const prev = this.state.latent;
    const next = new Array(this.state.latentDim).fill(0);
    for (let j = 0; j < next.length; j++) {
      let z = source[j % this.state.featureDim] ?? 0;
      if (this.state.lesion.recurrence) {
        next[j] = tanh(z);
        continue;
      }
      const row = this.state.recurrentWeights[j] ?? [];
      for (let i = 0; i < prev.length; i++) z += row[i] * prev[i];
      next[j] = tanh(z);
    }
    return next;
  }

  compete(candidates: WorkspaceCandidateV2[], context: number[] = []) {
    // Admission is bounded and score-ranked rather than input-order-ranked.
    // This prevents a noisy/high-volume source from occupying the first 64 slots
    // merely because it emitted its candidates earlier in the array.
    const inputCount = Array.isArray(candidates) ? candidates.length : 0;
    const boundedInput = Array.isArray(candidates) ? candidates.slice(0, 512) : [];
    const byId = new Map<string, { c: WorkspaceCandidateV2; score: number }>();
    let invalidCount = 0;
    let duplicateCount = 0;
    for (const raw of boundedInput) {
      if (!raw || typeof raw.id !== 'string' || !raw.id.trim()) {
        invalidCount++;
        continue;
      }
      const c: WorkspaceCandidateV2 = {
        ...raw,
        id: raw.id.trim(),
        source: typeof raw.source === 'string' && raw.source.trim() ? raw.source.trim().slice(0, 64) : 'unknown',
        features: vector(raw.features, this.state.featureDim),
        salience: clamp01(raw.salience),
      };
      const score = this.score(c, context);
      const previous = byId.get(c.id);
      if (previous) {
        duplicateCount++;
        if (score > previous.score) byId.set(c.id, { c, score });
      } else {
        byId.set(c.id, { c, score });
      }
    }
    const rankedAll = [...byId.values()].sort((a, b) =>
      b.score - a.score || (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0));
    // Reserve an initial share for each represented source. If fewer than 64
    // candidates exist, the second pass fills the remaining capacity globally.
    const sourceCount = new Set(rankedAll.map(x => x.c.source)).size;
    const sourceQuota = Math.max(1, Math.ceil(64 / Math.max(1, sourceCount)));
    const admitted: typeof rankedAll = [];
    const sourceCounts = new Map<string, number>();
    for (const item of rankedAll) {
      const count = sourceCounts.get(item.c.source) ?? 0;
      if (count >= sourceQuota) continue;
      admitted.push(item);
      sourceCounts.set(item.c.source, count + 1);
      if (admitted.length === 64) break;
    }
    if (admitted.length < 64) {
      const admittedIds = new Set(admitted.map(x => x.c.id));
      for (const item of rankedAll) {
        if (admitted.length === 64) break;
        if (admittedIds.has(item.c.id)) continue;
        admitted.push(item);
        admittedIds.add(item.c.id);
      }
    }
    const admittedBySource: Record<string, number> = {};
    for (const item of admitted) admittedBySource[item.c.source] = (admittedBySource[item.c.source] ?? 0) + 1;
    this.lastAdmission = {
      inputCount,
      uniqueCount: byId.size,
      admittedCount: admitted.length,
      duplicateCount,
      invalidCount,
      overflowCount: Math.max(0, rankedAll.length - admitted.length) + Math.max(0, inputCount - boundedInput.length),
      admittedBySource,
    };
    const usable = admitted.map(x => x.c);
    if (!usable.length) {
      this.lastSelectedCandidates = [];
      this.state.selectedIds = [];
      this.state.weights = [];
      this.state.ignition01 = 0;
      this.state.diversity01 = 0;
      this.state.broadcast01 = 0;
      this.state.cycles++;
      return this.snapshot();
    }
    const max = Math.max(...admitted.map(x => x.score));
    const exp = admitted.map(x => this.state.lesion.competition ? 1 : Math.exp(Math.max(-8, Math.min(8, (x.score - max) / this.state.temperature))));
    const denom = exp.reduce((s, x) => s + x, 0);
    const probs = exp.map(x => x / Math.max(1e-9, denom));
    const ranked = admitted.map((x, i) => ({ ...x, p: probs[i] }));
    // The final broadcast coalition is also source-balanced. Admission fairness
    // alone is insufficient if the top-k selector immediately collapses back to
    // the highest-volume/highest-salience producer.
    const coalitionSourceCount = new Set(ranked.map(x => x.c.source)).size;
    const coalitionQuota = Math.max(1, Math.ceil(this.state.capacity / Math.max(1, coalitionSourceCount)));
    const coalition: typeof ranked = [];
    const coalitionSourceCounts = new Map<string, number>();
    // Decision candidates remain represented so the workspace can influence the
    // canonical selector; other domains enrich that decision rather than replace it.
    const leadingDecision = ranked.find(item => item.c.source === 'decision');
    if (leadingDecision) {
      coalition.push(leadingDecision);
      coalitionSourceCounts.set('decision', 1);
    }
    const selectedIds = new Set(coalition.map(item => item.c.id));
    for (const item of ranked) {
      if (selectedIds.has(item.c.id)) continue;
      const count = coalitionSourceCounts.get(item.c.source) ?? 0;
      if (count >= coalitionQuota) continue;
      coalition.push(item);
      selectedIds.add(item.c.id);
      coalitionSourceCounts.set(item.c.source, count + 1);
      if (coalition.length === this.state.capacity) break;
    }
    if (coalition.length < this.state.capacity) {
      const selected = new Set(coalition.map(x => x.c.id));
      for (const item of ranked) {
        if (coalition.length === this.state.capacity) break;
        if (selected.has(item.c.id)) continue;
        coalition.push(item);
        selected.add(item.c.id);
      }
    }
    const coalitionWeights = coalition.map(x => x.p / Math.max(1e-9, coalition.reduce((s, y) => s + y.p, 0)));
    const nextLatent = this.updateLatent(coalition.map(x => x.c), coalitionWeights);
    const similarity = cosine(this.state.latent, nextLatent);
    const sourceDiversity = new Set(coalition.map(x => x.c.source)).size / Math.max(1, coalition.length);
    const meanSalience = coalition.reduce((s, x) => s + x.c.salience, 0) / Math.max(1, coalition.length);
    const concentration = coalitionWeights.reduce((s, x) => s + x * x, 0);
    const ignition = clamp01(meanSalience * 0.48 + (1 - concentration) * 0.18 + sourceDiversity * 0.16 + Math.max(0, similarity) * 0.18);

    this.state.latent = nextLatent;
    this.state.selectedIds = coalition.map(x => x.c.id);
    this.state.weights = coalitionWeights.slice();
    this.lastSelectedCandidates = coalition.map(x => structuredClone(x.c));
    this.state.ignition01 = ignition;
    this.state.recurrence01 = this.state.lesion.recurrence ? 0 : clamp01(Math.max(0, similarity) * 0.7 + ignition * 0.3);
    this.state.diversity01 = clamp01(sourceDiversity);
    this.state.broadcast01 = this.state.lesion.broadcast ? 0 : clamp01(ignition * (0.55 + sourceDiversity * 0.45));
    this.state.cycles++;
    return this.snapshot();
  }

  broadcast() {
    if (this.state.lesion.broadcast) return new Array(16).fill(0);
    const out = new Array(16).fill(0);
    for (let i = 0; i < out.length; i++) {
      const row = this.state.broadcastWeights[i] ?? [];
      let z = 0;
      for (let j = 0; j < this.state.latentDim; j++) z += (row[j] ?? 0) * (this.state.latent[j] ?? 0);
      out[i] = tanh(z) * this.state.broadcast01;
    }
    return out;
  }

  globalState() {
    return {
      latent: this.state.latent.slice(),
      broadcast: this.broadcast(),
      selectedIds: this.state.selectedIds.slice(),
      selectionWeights: this.state.weights.slice(),
      ignition01: this.state.ignition01,
      recurrence01: this.state.recurrence01,
      diversity01: this.state.diversity01,
      broadcast01: this.state.broadcast01,
      lesion: structuredClone(this.state.lesion),
    };
  }

  /**
   * Freeze the selected coalition against one immutable OrganismDecisionTrace.
   * Later competitions cannot overwrite this decision's learning eligibility.
   */
  registerDecision(input: { decisionId: string; tick: number; action: string; at?: number }) {
    const decisionId = typeof input?.decisionId === 'string' ? input.decisionId.trim() : '';
    const action = typeof input?.action === 'string' ? input.action.trim() : '';
    if (!decisionId || decisionId.length > 180 || /[\\u0000-\\u001f\\u007f]/.test(decisionId) ||
        !action || action.length > 80 || /[\\u0000-\\u001f\\u007f]/.test(action)) {
      return { recorded: false as const, replayed: false, reason: 'invalid-decision-identity' };
    }
    const tick = Math.max(0, Math.floor(Number(input.tick ?? 0)));
    const at = Math.max(0, Number(input.at ?? Date.now()));
    const existing = this.state.decisionReceipts.find(receipt => receipt.decisionId === decisionId);
    if (existing) {
      if (existing.tick !== tick || existing.action !== action) {
        return { recorded: false as const, replayed: false, reason: 'decision-id-conflict' };
      }
      return { recorded: false as const, replayed: true, receipt: structuredClone(existing) };
    }
    const selected = new Map(this.lastSelectedCandidates.map((candidate, index) => [
      candidate.id,
      { candidate, weight01: this.state.weights[index] ?? 0 },
    ]));
    const coalition = this.state.selectedIds.flatMap((id, index) => {
      const row = selected.get(id);
      if (!row) return [];
      return [{
        id: row.candidate.id,
        source: row.candidate.source,
        weight01: clamp01(row.weight01),
        features: vector(row.candidate.features, this.state.featureDim),
        eligible: row.candidate.source === 'decision' && row.candidate.content?.action === action,
      }];
    });
    if (!coalition.length) return { recorded: false as const, replayed: false, reason: 'empty-decision-coalition' };
    if (this.state.decisionReceipts.length >= 64) {
      const settledIndex = this.state.decisionReceipts.findIndex(receipt => receipt.outcomeIds.length > 0);
      this.state.decisionReceipts.splice(settledIndex >= 0 ? settledIndex : 0, 1);
      this.state.learning.expiredDecisionReceipts++;
    }
    const receipt: WorkspaceDecisionCreditReceipt = {
      decisionId, tick, action, at, coalition, outcomeIds: [], lastOutcomeAt: 0,
    };
    this.state.decisionReceipts = [...this.state.decisionReceipts, receipt];
    this.state.learning.decisionsRegistered++;
    return { recorded: true as const, replayed: false, receipt: structuredClone(receipt) };
  }

  /**
   * Apply reward only to the decision-time action candidate. Evidence from a
   * newer workspace competition is never substituted for a missing receipt.
   */
  learnOutcomeForDecision(input: {
    decisionId: string;
    outcomeId?: string;
    reward01: number;
    learningRate?: number;
    learningScale01?: number;
    at?: number;
  }) {
    const decisionId = typeof input?.decisionId === 'string' ? input.decisionId.trim() : '';
    const outcomeId = typeof input?.outcomeId === 'string' && input.outcomeId.trim()
      ? input.outcomeId.trim()
      : decisionId ? `workspace-outcome:${decisionId}` : '';
    if (!decisionId || decisionId.length > 180 || /[\\u0000-\\u001f\\u007f]/.test(decisionId) ||
        !outcomeId || outcomeId.length > 180 || /[\\u0000-\\u001f\\u007f]/.test(outcomeId)) {
      return { updated: false as const, replayed: false, reason: 'invalid-outcome-identity' };
    }
    const receipt = this.state.decisionReceipts.find(candidate => candidate.decisionId === decisionId);
    if (!receipt) {
      this.state.learning.outcomesUnmatched++;
      return { updated: false as const, replayed: false, reason: 'decision-receipt-not-found' };
    }
    if (receipt.outcomeIds.includes(outcomeId)) {
      this.state.learning.outcomesReplayed++;
      return { updated: false as const, replayed: true, reason: 'outcome-already-applied' };
    }
    if (receipt.outcomeIds.length >= 8) {
      return { updated: false as const, replayed: false, reason: 'decision-outcome-capacity-reached' };
    }
    const eligible = receipt.coalition.filter(candidate => candidate.eligible);
    if (!eligible.length) {
      this.state.learning.outcomesUnmatched++;
      return { updated: false as const, replayed: false, reason: 'decision-action-not-in-coalition' };
    }
    const reward = clamp01(input.reward01);
    const baseline = this.state.learning.rewardMean01;
    const error = reward - baseline;
    const learningRate = Math.max(0, Math.min(0.2, Number(input.learningRate ?? 0.02)));
    const learningScale01 = clamp01(Number(input.learningScale01 ?? 1));
    const totalWeight = eligible.reduce((sum, candidate) => sum + candidate.weight01, 0);
    const denominator = Math.max(1e-9, totalWeight);
    const update = learningRate * learningScale01 * error * 0.08;
    for (const candidate of eligible) {
      const normalizedWeight = candidate.weight01 / denominator;
      for (let i = 0; i < this.state.gateWeights.length; i++) {
        const gradient = clamp11(candidate.features[i] ?? 0) * normalizedWeight;
        this.state.gateWeights[i] = clamp11(this.state.gateWeights[i] + update * gradient);
      }
    }
    this.state.gateBias = clamp11(this.state.gateBias + learningRate * learningScale01 * error * 0.02);
    this.state.learning.rewardMean01 = clamp01(baseline * 0.98 + reward * 0.02);
    this.state.learning.samples++;
    this.state.learning.gateUpdates++;
    this.state.learning.outcomesApplied++;
    receipt.outcomeIds = [...receipt.outcomeIds, outcomeId].slice(-8);
    receipt.lastOutcomeAt = Math.max(0, Number(input.at ?? Date.now()));
    return {
      updated: true as const, replayed: false, decisionId, outcomeId,
      error01: Math.abs(error), tdErrorSigned: error, creditedCandidates: eligible.length,
    };
  }

  learnReward(reward01: number, learningRate = 0.02) {
    const reward = clamp01(reward01);
    const baseline = this.state.learning.rewardMean01;
    const error = reward - baseline;
    this.state.learning.rewardMean01 = baseline * 0.98 + reward * 0.02;
    if (!this.state.selectedIds.length) return { error01: Math.abs(error), updated: false };
    const update = learningRate * error;
    for (let k = 0; k < this.state.selectedIds.length; k++) {
      const sign = (this.state.weights[k] ?? 0) - 1 / Math.max(1, this.state.selectedIds.length);
      for (let i = 0; i < this.state.gateWeights.length; i++) {
        const featureSign = ((stableSeed((k + 1) * 997 + i * 37) >>> 0) / 4294967295) * 2 - 1;
        this.state.gateWeights[i] = clamp11(this.state.gateWeights[i] + update * sign * featureSign * 0.05);
      }
    }
    this.state.gateBias = clamp11(this.state.gateBias + update * 0.04);
    this.state.learning.samples++;
    this.state.learning.gateUpdates++;
    return { error01: Math.abs(error), updated: true };
  }

  setLesion(partial: Partial<GlobalWorkspaceSubstrateState['lesion']>) {
    this.state.lesion = { ...this.state.lesion, ...partial };
    return structuredClone(this.state.lesion);
  }

  diagnostics() {
    return {
      cycles: this.state.cycles,
      admission: { ...this.lastAdmission },
      selectedCount: this.state.selectedIds.length,
      ignition01: this.state.ignition01,
      recurrence01: this.state.recurrence01,
      broadcast01: this.state.broadcast01,
      learningSamples: this.state.learning.samples,
      gateUpdates: this.state.learning.gateUpdates,
      pendingDecisionReceipts: this.state.decisionReceipts.filter(receipt => receipt.outcomeIds.length === 0).length,
      decisionReceipts: this.state.decisionReceipts.length,
      outcomesApplied: this.state.learning.outcomesApplied,
      outcomesReplayed: this.state.learning.outcomesReplayed,
      outcomesUnmatched: this.state.learning.outcomesUnmatched,
      expiredDecisionReceipts: this.state.learning.expiredDecisionReceipts,
      lesions: structuredClone(this.state.lesion),
    };
  }
}
