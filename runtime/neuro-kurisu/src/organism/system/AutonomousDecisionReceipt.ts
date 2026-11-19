/**
 * Canonical owner for autonomous decision explainability.
 *
 * A receipt is assembled only from records the organism actually produced this
 * cycle: the selected intent, the governed candidate set, the drive snapshot,
 * the safety authorization and the goal that was admitted. It never invents a
 * retrospective narrative — `explain()` derives the answer from stored fields
 * and refuses to answer when the evidence needed for a claim is missing.
 *
 * The receipt is bounded, persisted with the rest of the system facet, and
 * fail-closed on restore: a record that cannot be structurally validated is
 * dropped rather than trusted.
 */
import type { ActionKind } from '../core/types.ts';

const ACTION_KINDS: ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const isAction = (value: unknown): value is ActionKind => typeof value === 'string' && ACTION_KINDS.includes(value as ActionKind);
const clamp01 = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
};
const isUnit = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const safeTick = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback);
const safeText = (value: unknown, max: number): string => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Bounded, ordered explanation of one autonomous decision. */
export interface DecisionReceipt {
  id: string;
  tick: number;
  at: number;
  /** What internal condition triggered deliberation this cycle. */
  trigger: string;
  /** Whether the cycle was driven by an external turn or was purely endogenous. */
  source: 'external' | 'endogenous';
  /** Normalized drive contributions that shaped the decision (magnitude only). */
  driveContributions: Record<string, number>;
  dominantDrive: string | null;
  /** The admitted endogenous goal this cycle, if any. */
  goalId: string | null;
  goalSource: 'internal' | 'external' | 'none';
  /** Ranked candidates considered, with their selection score and confidence. */
  candidates: Array<{ action: ActionKind; score01: number; confidence01: number; selected: boolean }>;
  /** Candidates that were considered and not chosen, in rank order. */
  rejected: Array<{ action: ActionKind; score01: number; reason: string }>;
  selectedAction: ActionKind | null;
  confidence01: number;
  /** Predicted resource cost of the selected action. */
  resourceCost01: number;
  /** Safety/governance decision attached to the selected action. */
  safety: { authorized: boolean; reason: string };
  /** Filled in when the outcome is known. */
  outcome?: { success01: number; reward01: number; surprise01: number; at: number };
  /** Filled in when the learning consequence is known. */
  learning?: { accepted: boolean; gain11: number; note: string };
  closedAt?: number;
}

export interface DecisionReceiptState {
  version: 1;
  created: number;
  closed: number;
  receipts: DecisionReceipt[];
}

export const defaultDecisionReceiptState = (): DecisionReceiptState => ({
  version: 1, created: 0, closed: 0, receipts: [],
});

export interface OpenDecisionReceiptInput {
  id: string;
  tick: number;
  at: number;
  trigger: string;
  source: 'external' | 'endogenous';
  driveContributions?: Record<string, number>;
  dominantDrive?: string | null;
  goalId?: string | null;
  goalSource?: 'internal' | 'external' | 'none';
  candidates?: Array<{ action: ActionKind; score: number; confidence: number }>;
  selectedAction: ActionKind | null;
  confidence01: number;
  resourceCost01: number;
  safety: { authorized: boolean; reason: string };
  maxCandidates?: number;
}

const RECEIPT_LIMIT = 96;
const CANDIDATE_LIMIT = 8;

/**
 * Evidence-linked decision receipts. This class owns receipt storage only; the
 * executive gate and the goal engines remain the authorities that decide.
 */
export class AutonomousDecisionReceiptLog {
  private state = defaultDecisionReceiptState();

  restore(raw?: Partial<DecisionReceiptState> | null): void {
    const d = defaultDecisionReceiptState();
    const r: Record<string, unknown> = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const items = Array.isArray(r.receipts) ? r.receipts.slice(-RECEIPT_LIMIT) : [];
    const receipts: DecisionReceipt[] = [];
    for (const item of items) {
      const parsed = parseReceipt(item);
      if (parsed) receipts.push(parsed);
    }
    receipts.sort((a, b) => b.tick - a.tick);
    this.state = {
      version: 1,
      created: Math.max(receipts.length, safeTick(r.created, 0)),
      closed: Math.max(receipts.filter(x => x.closedAt != null).length, safeTick(r.closed, 0)),
      receipts,
    };
  }

  snapshot(): DecisionReceiptState { return structuredClone(this.state); }

  /** Records the reasoning that produced a decision. Idempotent per id. */
  open(input: OpenDecisionReceiptInput): DecisionReceipt {
    const id = safeText(input.id, 128) || `receipt:${safeTick(input.tick)}`;
    const existing = this.state.receipts.find(x => x.id === id);
    if (existing) return structuredClone(existing);
    const limit = Math.max(1, Math.min(CANDIDATE_LIMIT, Math.floor(input.maxCandidates ?? CANDIDATE_LIMIT)));
    const ranked = (input.candidates ?? [])
      .filter(c => isAction(c.action))
      .map(c => ({ action: c.action, score01: clamp01(c.score), confidence01: clamp01(c.confidence) }))
      .sort((a, b) => b.score01 - a.score01 || a.action.localeCompare(b.action))
      .slice(0, limit);
    const candidates = ranked.map(c => ({ ...c, selected: c.action === input.selectedAction }));
    const rejected = candidates.filter(c => !c.selected).map(c => ({ action: c.action, score01: c.score01, reason: 'lower-ranked-alternative' }));
    const driveContributions: Record<string, number> = {};
    for (const [name, value] of Object.entries(input.driveContributions ?? {})) {
      const key = safeText(name, 32);
      if (key) driveContributions[key] = clamp01(value);
    }
    const receipt: DecisionReceipt = {
      id,
      tick: safeTick(input.tick),
      at: safeTick(input.at, Date.now()),
      trigger: safeText(input.trigger, 160) || 'unspecified',
      source: input.source === 'external' ? 'external' : 'endogenous',
      driveContributions,
      dominantDrive: input.dominantDrive ? safeText(input.dominantDrive, 32) : null,
      goalId: input.goalId ? safeText(input.goalId, 128) : null,
      goalSource: input.goalSource === 'internal' || input.goalSource === 'external' ? input.goalSource : 'none',
      candidates,
      rejected,
      selectedAction: isAction(input.selectedAction) ? input.selectedAction : null,
      confidence01: clamp01(input.confidence01),
      resourceCost01: clamp01(input.resourceCost01),
      safety: { authorized: Boolean(input.safety?.authorized), reason: safeText(input.safety?.reason, 160) || 'unspecified' },
    };
    this.state.receipts = [receipt, ...this.state.receipts].slice(0, RECEIPT_LIMIT);
    this.state.created++;
    return structuredClone(receipt);
  }

  /** Attaches the observed outcome to the most recent open receipt for a tick. */
  close(tick: number, outcome: { success01: number; reward01: number; surprise01: number; at: number }): boolean {
    const receipt = this.state.receipts.find(x => x.tick === safeTick(tick) && x.closedAt == null);
    if (!receipt) return false;
    receipt.outcome = { success01: clamp01(outcome.success01), reward01: clamp01(outcome.reward01), surprise01: clamp01(outcome.surprise01), at: safeTick(outcome.at, Date.now()) };
    receipt.closedAt = receipt.outcome.at;
    this.state.closed++;
    return true;
  }

  /** Attaches the learning consequence (e.g. accepted goal revision) to a receipt. */
  recordLearning(tick: number, learning: { accepted: boolean; gain11: number; note: string }): boolean {
    const receipt = this.state.receipts.find(x => x.tick === safeTick(tick));
    if (!receipt) return false;
    receipt.learning = { accepted: Boolean(learning.accepted), gain11: Number.isFinite(learning.gain11) ? Math.max(-1, Math.min(1, learning.gain11)) : 0, note: safeText(learning.note, 120) };
    return true;
  }

  latest(): DecisionReceipt | null {
    return this.state.receipts[0] ? structuredClone(this.state.receipts[0]) : null;
  }

  forTick(tick: number): DecisionReceipt | null {
    const receipt = this.state.receipts.find(x => x.tick === safeTick(tick));
    return receipt ? structuredClone(receipt) : null;
  }

  /**
   * Derives a plain-language explanation strictly from the stored receipt. The
   * answer lists only facts present in the record; when the outcome or learning
   * consequence is not yet known it says so instead of inventing one.
   */
  explain(tick?: number): { answer: string; receipt: DecisionReceipt } | null {
    const receipt = tick == null ? this.latest() : this.forTick(tick);
    if (!receipt) return null;
    const parts: string[] = [];
    parts.push(`Triggered by ${receipt.trigger} (${receipt.source} cycle).`);
    const drives = Object.entries(receipt.driveContributions).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (drives.length) parts.push(`Strongest drives: ${drives.map(([name, v]) => `${name}=${v.toFixed(2)}`).join(', ')}${receipt.dominantDrive ? ` (dominant ${receipt.dominantDrive})` : ''}.`);
    if (receipt.goalId) parts.push(`Goal ${receipt.goalId} (${receipt.goalSource}) was the admitted objective.`);
    if (receipt.selectedAction) parts.push(`Selected ${receipt.selectedAction} at confidence ${receipt.confidence01.toFixed(2)} and predicted cost ${receipt.resourceCost01.toFixed(2)}.`);
    else parts.push('No action was selected this cycle.');
    if (receipt.rejected.length) parts.push(`Rejected alternatives: ${receipt.rejected.map(r => `${r.action} (${r.reason})`).join(', ')}.`);
    parts.push(`Safety: ${receipt.safety.authorized ? 'authorized' : 'blocked'} (${receipt.safety.reason}).`);
    parts.push(receipt.outcome ? `Outcome: success ${receipt.outcome.success01.toFixed(2)}, reward ${receipt.outcome.reward01.toFixed(2)}.` : 'Outcome not yet observed.');
    parts.push(receipt.learning ? `Learning: ${receipt.learning.accepted ? 'accepted' : 'rejected'} (${receipt.learning.note}).` : 'Learning consequence not yet recorded.');
    return { answer: parts.join(' '), receipt };
  }

  diagnostics() {
    return {
      version: 1,
      created: this.state.created,
      closed: this.state.closed,
      stored: this.state.receipts.length,
      explainable: this.state.receipts.filter(r => r.closedAt != null).length,
      lastTick: this.state.receipts[0]?.tick ?? null,
    };
  }
}

function parseReceipt(value: unknown): DecisionReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = safeText(item.id, 128);
  if (!id) return null;
  const candidates = (Array.isArray(item.candidates) ? item.candidates : [])
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object' && !Array.isArray(c))
    .filter(c => isAction(c.action) && isUnit(c.score01) && isUnit(c.confidence01))
    .map(c => ({ action: c.action as ActionKind, score01: c.score01 as number, confidence01: c.confidence01 as number, selected: Boolean(c.selected) }))
    .slice(0, CANDIDATE_LIMIT);
  const rejected = (Array.isArray(item.rejected) ? item.rejected : [])
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object' && !Array.isArray(c))
    .filter(c => isAction(c.action) && isUnit(c.score01))
    .map(c => ({ action: c.action as ActionKind, score01: c.score01 as number, reason: safeText(c.reason, 80) || 'lower-ranked-alternative' }))
    .slice(0, CANDIDATE_LIMIT);
  const driveContributions: Record<string, number> = {};
  const rawDrives = item.driveContributions && typeof item.driveContributions === 'object' && !Array.isArray(item.driveContributions) ? item.driveContributions as Record<string, unknown> : {};
  for (const [name, value01] of Object.entries(rawDrives)) {
    const key = safeText(name, 32);
    if (key && isUnit(value01)) driveContributions[key] = value01;
  }
  const safetyRaw = item.safety && typeof item.safety === 'object' && !Array.isArray(item.safety) ? item.safety as Record<string, unknown> : {};
  const outcomeRaw = item.outcome && typeof item.outcome === 'object' && !Array.isArray(item.outcome) ? item.outcome as Record<string, unknown> : null;
  const learningRaw = item.learning && typeof item.learning === 'object' && !Array.isArray(item.learning) ? item.learning as Record<string, unknown> : null;
  const goalSource = item.goalSource === 'internal' || item.goalSource === 'external' ? item.goalSource : 'none';
  return {
    id,
    tick: safeTick(item.tick),
    at: safeTick(item.at, Date.now()),
    trigger: safeText(item.trigger, 160) || 'unspecified',
    source: item.source === 'external' ? 'external' : 'endogenous',
    driveContributions,
    dominantDrive: item.dominantDrive ? safeText(item.dominantDrive, 32) : null,
    goalId: item.goalId ? safeText(item.goalId, 128) : null,
    goalSource,
    candidates,
    rejected,
    selectedAction: isAction(item.selectedAction) ? item.selectedAction : null,
    confidence01: clamp01(item.confidence01),
    resourceCost01: clamp01(item.resourceCost01),
    safety: { authorized: Boolean(safetyRaw.authorized), reason: safeText(safetyRaw.reason, 160) || 'unspecified' },
    ...(outcomeRaw && isUnit(outcomeRaw.success01) && isUnit(outcomeRaw.reward01) && isUnit(outcomeRaw.surprise01)
      ? { outcome: { success01: outcomeRaw.success01, reward01: outcomeRaw.reward01, surprise01: outcomeRaw.surprise01, at: safeTick(outcomeRaw.at, Date.now()) } }
      : {}),
    ...(learningRaw && typeof learningRaw.accepted === 'boolean' && Number.isFinite(Number(learningRaw.gain11))
      ? { learning: { accepted: learningRaw.accepted, gain11: Math.max(-1, Math.min(1, Number(learningRaw.gain11))), note: safeText(learningRaw.note, 120) } }
      : {}),
    ...(Number.isFinite(Number(item.closedAt)) ? { closedAt: safeTick(item.closedAt) } : {}),
  };
}
