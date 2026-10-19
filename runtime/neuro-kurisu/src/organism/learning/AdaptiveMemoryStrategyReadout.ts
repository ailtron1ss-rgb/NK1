import type { MemoryItem2 } from '../developmental/MemoryOS2.ts';
import type { ActionKind } from './PolicyAuthorityLedger.ts';

const ACTIONS: ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const clamp = (value: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(value) ? value : lo));
const DAY_MS = 86_400_000;
const MAX_ITEMS = 128;
const MAX_ENTRIES = 192;
const MAX_RECEIPTS = 64;

export interface VerifiedStrategyEvidenceRow {
  action: ActionKind;
  reward01: number;
  causalStrength01: number;
  learningQuality01?: number;
  stateGrounded: boolean;
  provenance: string;
  replayEligible?: boolean;
}

export interface VerifiedStrategyPattern {
  action: ActionKind;
  supportCount: number;
  evidenceCount: number;
  supportShare01: number;
  meanReward01: number;
  meanCausalStrength01: number;
  meanLearningQuality01: number;
}

/**
 * Derives a promotable strategy tag only from repeated, independently sourced,
 * state-grounded external outcome records. Ordinary runtime/replay rows cannot
 * mint a strategy memory by themselves.
 */
export function deriveVerifiedStrategyPattern(rows: readonly VerifiedStrategyEvidenceRow[]): VerifiedStrategyPattern | null {
  const trusted = rows.filter(row => row.provenance === 'external'
    && row.stateGrounded
    && row.replayEligible !== false
    && Number(row.causalStrength01) >= 0.5
    && Number(row.learningQuality01 ?? 0) >= 0.6
    && Number.isFinite(Number(row.reward01))
    && ACTIONS.includes(row.action));
  if (trusted.length < 3) return null;
  const byAction = new Map<ActionKind, VerifiedStrategyEvidenceRow[]>();
  for (const row of trusted) byAction.set(row.action, [...(byAction.get(row.action) ?? []), row]);
  const ranked = [...byAction.entries()].map(([action, support]) => {
    const mean = (pick: (row: VerifiedStrategyEvidenceRow) => number) => support.reduce((sum, row) => sum + pick(row), 0) / support.length;
    return {
      action,
      supportCount: support.length,
      evidenceCount: trusted.length,
      supportShare01: support.length / trusted.length,
      meanReward01: clamp(mean(row => Number(row.reward01))),
      meanCausalStrength01: clamp(mean(row => Number(row.causalStrength01))),
      meanLearningQuality01: clamp(mean(row => Number(row.learningQuality01 ?? 0))),
    };
  }).sort((a, b) => b.supportCount - a.supportCount || b.meanReward01 - a.meanReward01 || a.action.localeCompare(b.action));
  const best = ranked[0];
  if (!best || best.supportCount < 3 || best.supportShare01 < 0.6
      || best.meanReward01 < 0.65 || best.meanCausalStrength01 < 0.55
      || best.meanLearningQuality01 < 0.65) return null;
  return best;
}

export interface AdaptiveMemoryStrategyEntry {
  memoryId: string;
  action: ActionKind;
  source: string;
  rewardMean01: number;
  verifiedTrials: number;
  lastObservedAt: number;
  lastObservedTick: number;
}

export interface AdaptiveMemoryStrategyReceipt {
  tick: number;
  action: ActionKind;
  memoryIds: string[];
  reward01: number;
  verified: boolean;
  independent: boolean;
  accepted: boolean;
  at: number;
}

export interface AdaptiveMemoryStrategyPending {
  tick: number;
  queryHash: number;
  biasByAction: Partial<Record<ActionKind, number>>;
  confidenceByAction: Partial<Record<ActionKind, number>>;
  memoryIdsByAction: Partial<Record<ActionKind, string[]>>;
}

export interface AdaptiveMemoryStrategyState {
  version: 1;
  lastTick: number;
  preparedDecisions: number;
  eligibleMemories: number;
  verifiedOutcomes: number;
  rejectedOutcomes: number;
  entries: Record<string, AdaptiveMemoryStrategyEntry>;
  pending: AdaptiveMemoryStrategyPending | null;
  receipts: AdaptiveMemoryStrategyReceipt[];
}

export const defaultAdaptiveMemoryStrategyState = (): AdaptiveMemoryStrategyState => ({
  version: 1,
  lastTick: 0,
  preparedDecisions: 0,
  eligibleMemories: 0,
  verifiedOutcomes: 0,
  rejectedOutcomes: 0,
  entries: {},
  pending: null,
  receipts: [],
});

const normalizeAction = (value: unknown): ActionKind | null => {
  const candidate = String(value ?? '').trim().toLowerCase();
  return ACTIONS.includes(candidate as ActionKind) ? candidate as ActionKind : null;
};

const tokenize = (value: string): string[] => [...new Set(
  (value.toLocaleLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]{2,}/gu) ?? []).slice(0, 256),
)];

const tokenOverlap = (left: string[], right: string[]): number => {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  let hits = 0;
  for (const token of left) if (rightSet.has(token)) hits++;
  return hits / Math.max(1, new Set([...left, ...right]).size);
};

const hashText = (value: string): number => {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
};

function explicitStrategyMarker(item: MemoryItem2): boolean {
  const tags = (item.tags ?? []).map(tag => String(tag).trim().toLowerCase());
  const source = String(item.source ?? '').trim().toLowerCase();
  const context = item.context ?? {};
  return tags.some(tag => ['nk:strategy', 'strategy-memory', 'adaptive-strategy'].includes(tag))
    || source.startsWith('nk:strategy:')
    || source.startsWith('will:strategy:')
    || (context.strategy === 'true' && ['adaptive', 'candidate', 'verified'].includes(String(context.strategyRole ?? '').toLowerCase()));
}

function strategyAction(item: MemoryItem2): ActionKind | null {
  const context = item.context ?? {};
  const direct = normalizeAction(context.strategyAction ?? context.action);
  if (direct) return direct;
  for (const tag of item.tags ?? []) {
    const match = String(tag).trim().toLowerCase().match(/^strategy:(respond|explore|verify|rest|reflect|wait|defer)$/);
    if (match) return normalizeAction(match[1]);
  }
  const sourceMatch = String(item.source ?? '').toLowerCase().match(/(?:nk|will):strategy:(respond|explore|verify|rest|reflect|wait|defer)(?::|$)/);
  return sourceMatch ? normalizeAction(sourceMatch[1]) : null;
}

function normalizeEntry(raw: unknown, memoryId: string): AdaptiveMemoryStrategyEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<AdaptiveMemoryStrategyEntry>;
  const action = normalizeAction(row.action);
  if (!action) return null;
  return {
    memoryId,
    action,
    source: String(row.source ?? '').slice(0, 160),
    rewardMean01: clamp(Number(row.rewardMean01 ?? 0.5)),
    verifiedTrials: Math.max(0, Math.min(100_000, Math.floor(Number(row.verifiedTrials ?? 0)))),
    lastObservedAt: Math.max(0, Number(row.lastObservedAt ?? 0)),
    lastObservedTick: Math.max(0, Math.floor(Number(row.lastObservedTick ?? 0))),
  };
}

/**
 * Evidence-only adapter from explicitly marked canonical memory items into the
 * existing PolicyAuthorityLedger. It never owns memory, chooses actions or
 * executes tools. Total policy influence is capped at +/-0.03 per action.
 */
export class AdaptiveMemoryStrategyReadout {
  private state = defaultAdaptiveMemoryStrategyState();

  restore(raw?: Partial<AdaptiveMemoryStrategyState> | null) {
    const entries: Record<string, AdaptiveMemoryStrategyEntry> = {};
    for (const [memoryId, value] of Object.entries(raw?.entries ?? {}).slice(-MAX_ENTRIES)) {
      const entry = normalizeEntry(value, memoryId);
      if (entry) entries[memoryId] = entry;
    }
    const d = defaultAdaptiveMemoryStrategyState();
    const pending = raw?.pending && Number.isFinite(raw.pending.tick) ? {
      tick: Math.max(0, Math.floor(Number(raw.pending.tick))),
      queryHash: Math.max(0, Math.floor(Number(raw.pending.queryHash ?? 0))),
      biasByAction: this.cleanActionMap(raw.pending.biasByAction, true),
      confidenceByAction: this.cleanActionMap(raw.pending.confidenceByAction, false),
      memoryIdsByAction: Object.fromEntries(Object.entries(raw.pending.memoryIdsByAction ?? {})
        .filter(([action, ids]) => normalizeAction(action) && Array.isArray(ids))
        .map(([action, ids]) => [action, [...new Set((ids as unknown[]).map(String))].slice(0, 8)])) as Partial<Record<ActionKind, string[]>>,
    } : null;
    this.state = {
      ...d,
      ...raw,
      version: 1,
      lastTick: Math.max(0, Math.floor(Number(raw?.lastTick ?? 0))),
      preparedDecisions: Math.max(0, Math.floor(Number(raw?.preparedDecisions ?? 0))),
      eligibleMemories: Math.max(0, Math.floor(Number(raw?.eligibleMemories ?? 0))),
      verifiedOutcomes: Math.max(0, Math.floor(Number(raw?.verifiedOutcomes ?? 0))),
      rejectedOutcomes: Math.max(0, Math.floor(Number(raw?.rejectedOutcomes ?? 0))),
      entries,
      pending,
      receipts: Array.isArray(raw?.receipts) ? raw!.receipts!.slice(-MAX_RECEIPTS).map(receipt => ({
        tick: Math.max(0, Math.floor(Number(receipt.tick ?? 0))),
        action: normalizeAction(receipt.action) ?? 'defer',
        memoryIds: Array.isArray(receipt.memoryIds) ? [...new Set(receipt.memoryIds.map(String))].slice(0, 8) : [],
        reward01: clamp(Number(receipt.reward01 ?? 0)),
        verified: Boolean(receipt.verified),
        independent: Boolean(receipt.independent),
        accepted: Boolean(receipt.accepted),
        at: Math.max(0, Number(receipt.at ?? 0)),
      })) : [],
    };
  }

  snapshot(): AdaptiveMemoryStrategyState { return structuredClone(this.state); }

  prepare(input: { items: readonly MemoryItem2[]; query: string; tick: number; at: number }): AdaptiveMemoryStrategyPending {
    const queryTokens = tokenize(String(input.query ?? ''));
    const biasByAction: Partial<Record<ActionKind, number>> = {};
    const confidenceByAction: Partial<Record<ActionKind, number>> = {};
    const memoryIdsByAction: Partial<Record<ActionKind, string[]>> = {};
    let eligible = 0;
    const at = Math.max(0, Number(input.at) || 0);

    for (const item of input.items.slice(0, MAX_ITEMS)) {
      if (!explicitStrategyMarker(item)) continue;
      const action = strategyAction(item);
      if (!action || item.dormant || item.epistemicStatus === 'quarantined') continue;
      eligible++;
      const contentTokens = tokenize(`${item.content} ${(item.tags ?? []).join(' ')}`);
      const overlap = queryTokens.length ? tokenOverlap(queryTokens, contentTokens) : 0.25;
      const globalStrategy = String(item.context?.strategyGlobal ?? '').toLowerCase() === 'true';
      const relevance = clamp(Math.max(overlap, globalStrategy ? 0.15 : 0));
      if (relevance < (queryTokens.length ? 0.06 : 0.01)) continue;

      let entry = this.state.entries[item.id];
      if (!entry) {
        entry = this.state.entries[item.id] = {
          memoryId: item.id, action, source: String(item.source ?? '').slice(0, 160),
          rewardMean01: 0.5, verifiedTrials: 0, lastObservedAt: at,
          lastObservedTick: Math.max(0, Math.floor(Number(input.tick) || 0)),
        };
      } else {
        entry.lastObservedAt = at;
        entry.lastObservedTick = Math.max(0, Math.floor(Number(input.tick) || 0));
      }
      memoryIdsByAction[action] = [...new Set([...(memoryIdsByAction[action] ?? []), item.id])].slice(0, 8);
      const contextBiasRaw = Number(item.context?.strategyActionBias01 ?? 0);
      const explicitBias = Number.isFinite(contextBiasRaw) ? Math.max(-1, Math.min(1, contextBiasRaw)) * 0.03 : 0;
      const learnedBias = entry ? (entry.rewardMean01 - 0.5) * 0.06 : 0;
      const ageMs = Math.max(0, at - Number(item.evidenceFreshnessAt ?? item.observedAt ?? item.createdAt ?? at));
      const freshness = Math.pow(2, -ageMs / (7 * DAY_MS));
      const authority = clamp(Number(item.sourceAuthority01 ?? 0.5));
      const evidenceQuality = clamp(Number(item.confidence ?? 0.5))
        * (0.4 + 0.6 * clamp(Number(item.salience ?? 0.5)))
        * (0.5 + 0.5 * authority)
        * freshness;
      const contribution = Math.max(-0.03, Math.min(0.03, explicitBias + learnedBias)) * evidenceQuality * relevance;
      confidenceByAction[action] = Math.max(confidenceByAction[action] ?? 0, clamp(evidenceQuality * relevance));
      if (Math.abs(contribution) <= 1e-8) continue;
      biasByAction[action] = Math.max(-0.03, Math.min(0.03, (biasByAction[action] ?? 0) + contribution));
    }

    this.pruneEntries();
    const pending: AdaptiveMemoryStrategyPending = {
      tick: Math.max(0, Math.floor(Number(input.tick) || 0)),
      queryHash: hashText(String(input.query ?? '')),
      biasByAction,
      confidenceByAction,
      memoryIdsByAction,
    };
    this.state.lastTick = pending.tick;
    this.state.preparedDecisions++;
    this.state.eligibleMemories = eligible;
    this.state.pending = pending;
    return structuredClone(pending);
  }

  biasForAction(action: ActionKind, tick: number): number {
    if (!this.state.pending || this.state.pending.tick !== tick) return 0;
    return Math.max(-0.03, Math.min(0.03, Number(this.state.pending.biasByAction[action] ?? 0)));
  }

  recordOutcome(input: { tick: number; action: ActionKind; reward01: number; verified: boolean; independent: boolean; at?: number }) {
    const pending = this.state.pending;
    const memoryIds = pending?.tick === input.tick ? (pending.memoryIdsByAction[input.action] ?? []) : [];
    const accepted = Boolean(input.verified && input.independent && memoryIds.length > 0 && Number.isFinite(input.reward01));
    const receipt: AdaptiveMemoryStrategyReceipt = {
      tick: Math.max(0, Math.floor(Number(input.tick) || 0)),
      action: input.action,
      memoryIds: [...memoryIds],
      reward01: clamp(Number(input.reward01 ?? 0)),
      verified: Boolean(input.verified),
      independent: Boolean(input.independent),
      accepted,
      at: Math.max(0, Number(input.at ?? 0)),
    };
    this.state.receipts = [...this.state.receipts, receipt].slice(-MAX_RECEIPTS);
    if (!accepted) {
      if (memoryIds.length) this.state.rejectedOutcomes++;
      return { accepted: false, updated: 0 };
    }

    let updated = 0;
    for (const memoryId of memoryIds.slice(0, 8)) {
      const previous = this.state.entries[memoryId];
      if (!previous || previous.action !== input.action) continue;
      const trials = Math.min(100_000, previous.verifiedTrials + 1);
      const alpha = Math.min(0.25, 1 / Math.max(1, trials));
      previous.rewardMean01 = clamp(previous.rewardMean01 * (1 - alpha) + receipt.reward01 * alpha);
      previous.verifiedTrials = trials;
      previous.lastObservedAt = receipt.at;
      previous.lastObservedTick = receipt.tick;
      updated++;
    }
    this.state.verifiedOutcomes++;
    this.pruneEntries();
    return { accepted: true, updated };
  }

  diagnostics() {
    const entries = Object.values(this.state.entries);
    return {
      version: 1,
      owner: 'MemoryOS2',
      policyOwner: 'PolicyAuthorityLedger',
      preparedDecisions: this.state.preparedDecisions,
      eligibleMemories: this.state.eligibleMemories,
      trackedStrategies: entries.length,
      verifiedOutcomes: this.state.verifiedOutcomes,
      rejectedOutcomes: this.state.rejectedOutcomes,
      pendingTick: this.state.pending?.tick ?? null,
      lastBiasByAction: { ...(this.state.pending?.biasByAction ?? {}) },
      maxAbsoluteBias01: Math.max(0, ...Object.values(this.state.pending?.biasByAction ?? {}).map(value => Math.abs(Number(value ?? 0)))),
      independentEvidenceRequired: true,
      materializesMemory: false,
    };
  }

  private cleanActionMap(raw: unknown, signed: boolean): Partial<Record<ActionKind, number>> {
    if (!raw || typeof raw !== 'object') return {};
    const result: Partial<Record<ActionKind, number>> = {};
    for (const [key, value] of Object.entries(raw)) {
      const action = normalizeAction(key);
      const number = Number(value);
      if (!action || !Number.isFinite(number)) continue;
      result[action] = signed ? Math.max(-0.03, Math.min(0.03, number)) : clamp(number);
    }
    return result;
  }

  private pruneEntries() {
    const entries = Object.values(this.state.entries).sort((a, b) => b.lastObservedAt - a.lastObservedAt);
    this.state.entries = Object.fromEntries(entries.slice(0, MAX_ENTRIES).map(entry => [entry.memoryId, entry]));
  }
}
