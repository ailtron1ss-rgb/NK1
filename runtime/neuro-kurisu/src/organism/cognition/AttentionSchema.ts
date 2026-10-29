/**
 * Attention schema — canonical attention allocation owner for the organism.
 *
 * WorkPass-A03: the previous implementation accepted one pre-chosen target and
 * re-derived a three-way reason string at the call site. It could not compare
 * competing targets, it stored `Date.now()` inside persisted state (so replay
 * was not deterministic) and it had no way to express inhibition, hysteresis or
 * a resource-driven downgrade.
 *
 * This module is a bounded, deterministic *allocation* function over a
 * candidate list. It is a scheduling mechanism, not a claim of subjective
 * attention. Determinism rule: every field of the returned state is a pure
 * function of the inputs plus the allocator's own bounded state.
 */

export type AttentionResourceMode = 'full' | 'degraded' | 'minimal';

/** Per-factor contribution that produced the winning score. Values are the raw
 *  (clamped) factor inputs, so a decision can be re-derived and audited. */
export interface AttentionFactors {
  goal: number; relevance: number; urgency: number; novelty: number; uncertainty: number;
  predictedValue: number; emotion: number; resource: number; habituation: number; inhibition: number;
}

export interface AttentionCandidateInput {
  target: string;
  source?: string;
  /** Alignment with the active goal or goals (0..1). */
  goalRelevance01?: number;
  /** Fit to the current task/observation (0..1). */
  taskRelevance01?: number;
  urgency01?: number;
  novelty01?: number;
  uncertainty01?: number;
  predictedValue01?: number;
  /** Affective salience (0..1), e.g. emotion attention capture. */
  emotionalSalience01?: number;
  /** Fraction of the attention budget this target would consume (0..1). */
  resourceCost01?: number;
  /** Hard suppression requested by the caller (e.g. policy violation). */
  suppressed?: boolean;
}

export interface AttentionDecision {
  target: string;
  source: string;
  score: number;
  runnerUpTarget: string | null;
  margin: number;
  switched: boolean;
  previousTarget: string | null;
  dwell: number;
  reason: string;
  resourceMode: AttentionResourceMode;
  budget01: number;
  factors: AttentionFactors;
  /** Candidates not selected, plus caller-suppressed targets. Bounded. */
  inhibited: string[];
  considered: number;
  eligible: number;
}

export interface OrganismAttentionState {
  target: string;
  reason: string;
  salience: number;
  confidence: number;
  budget: number;
  inhibited: string[];
  switchedAt: number;
  /** Optional trace for allocator-driven decisions. Older snapshots without a
   *  decision keep loading unchanged (see normalizeAttentionState). */
  decision?: AttentionDecision;
}

export interface AttentionAllocatorState {
  version: 1;
  target: string | null;
  targetScore: number;
  dwell: number;
  /** tick -> (target -> ticks of inhibition remaining). Bounded by maxInhibited. */
  inhibition: Record<string, Record<string, number>>;
  switches: number;
  allocations: number;
  lastTick: number;
}

const FACTOR_WEIGHTS: Readonly<AttentionFactors> = { goal: .22, relevance: .16, urgency: .18, novelty: .10, uncertainty: .12, predictedValue: .12, emotion: .10, resource: .10, habituation: -.08, inhibition: -.20 };
const MAX_INHIBITED = 8;
const MAX_TARGET_LEN = 160;
const INHIBITION_AFTER_SWITCH = 3;
/** A challenger must beat the incumbent by this margin to take attention. */
const SWITCH_MARGIN = .035;
/** Repeated identical winners lose weight (habituation) but never below this. */
const MIN_HABITUATION = .55;

const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const finite01 = (x: unknown, fallback = 0) => typeof x === 'number' && Number.isFinite(x) ? clamp01(x) : fallback;
const cleanTarget = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_TARGET_LEN) return null;
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(trimmed)) return null;
  return trimmed;
};
function stableHash(text: string) { let h = 2166136261 >>> 0; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0; return h >>> 0; }

export function defaultAttentionAllocatorState(): AttentionAllocatorState {
  return { version: 1, target: null, targetScore: 0, dwell: 0, inhibition: {}, switches: 0, allocations: 0, lastTick: -1 };
}

/**
 * Normalizes a persisted attention record. Old or partially corrupt snapshots
 * must never inject non-finite numbers or oversized strings into allocation.
 */
export function normalizeAttentionState(raw: unknown, fallbackTarget = 'internal-state'): OrganismAttentionState {
  const source = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw as Record<string, unknown> : {};
  const target = cleanTarget(source.target) ?? cleanTarget(fallbackTarget) ?? 'internal-state';
  const inhibited = Array.isArray(source.inhibited)
    ? source.inhibited.map(cleanTarget).filter((x): x is string => x !== null).slice(0, MAX_INHIBITED)
    : [];
  const switchedAt = typeof source.switchedAt === 'number' && Number.isFinite(source.switchedAt) && source.switchedAt >= 0 ? source.switchedAt : 0;
  const decision = source.decision && typeof source.decision === 'object' && !Array.isArray(source.decision) ? source.decision as AttentionDecision : undefined;
  return {
    target,
    reason: typeof source.reason === 'string' ? source.reason.slice(0, MAX_TARGET_LEN) : 'unspecified',
    salience: finite01(source.salience),
    confidence: finite01(source.confidence, .2),
    budget: finite01(source.budget, .82),
    inhibited,
    switchedAt,
    ...(decision ? { decision } : {}),
  };
}

/** Backwards-compatible single-target constructor used by migrations and defaults. */
export function attend(opts: { target: string; reason: string; salience: number; confidence: number; budget: number; inhibit?: string[]; tick?: number }): OrganismAttentionState {
  const tick = typeof opts.tick === 'number' && Number.isFinite(opts.tick) && opts.tick >= 0 ? opts.tick : 0;
  return normalizeAttentionState({
    target: opts.target,
    reason: opts.reason,
    salience: clamp01(opts.salience),
    confidence: clamp01(opts.confidence),
    budget: clamp01(opts.budget),
    // `switchedAt` is a logical tick, not a wall clock: replay must reproduce it.
    switchedAt: tick,
    inhibited: [...(opts.inhibit ?? [])].slice(0, MAX_INHIBITED),
  }, opts.target);
}

/**
 * Deterministic multi-factor attention allocator with hysteresis,
 * inhibition-of-return, habituation and a resource-constrained fallback.
 */
export class AttentionAllocator {
  private state = defaultAttentionAllocatorState();

  snapshot(): AttentionAllocatorState { return structuredClone(this.state); }

  restore(raw: unknown): void {
    const base = defaultAttentionAllocatorState();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { this.state = base; return; }
    const r = raw as Partial<AttentionAllocatorState>;
    const inhibition: Record<string, Record<string, number>> = {};
    if (r.inhibition && typeof r.inhibition === 'object' && !Array.isArray(r.inhibition)) {
      for (const [tickKey, row] of Object.entries(r.inhibition).slice(-64)) {
        if (!/^\d+$/.test(tickKey) || !row || typeof row !== 'object' || Array.isArray(row)) continue;
        const clean: Record<string, number> = {};
        for (const [target, remaining] of Object.entries(row as Record<string, unknown>).slice(0, MAX_INHIBITED)) {
          const name = cleanTarget(target);
          if (!name || typeof remaining !== 'number' || !Number.isFinite(remaining) || remaining <= 0) continue;
          clean[name] = Math.min(64, Math.floor(remaining));
        }
        if (Object.keys(clean).length) inhibition[tickKey] = clean;
      }
    }
    this.state = {
      version: 1,
      target: cleanTarget(r.target),
      targetScore: finite01(r.targetScore),
      dwell: typeof r.dwell === 'number' && Number.isFinite(r.dwell) && r.dwell >= 0 ? Math.min(1e6, Math.floor(r.dwell)) : 0,
      inhibition,
      switches: typeof r.switches === 'number' && Number.isSafeInteger(r.switches) && r.switches >= 0 ? r.switches : 0,
      allocations: typeof r.allocations === 'number' && Number.isSafeInteger(r.allocations) && r.allocations >= 0 ? r.allocations : 0,
      lastTick: typeof r.lastTick === 'number' && Number.isSafeInteger(r.lastTick) && r.lastTick >= -1 ? r.lastTick : -1,
    };
  }

  /**
   * Allocates attention. `tick` is the organism's logical tick; a non-increasing
   * tick is rejected so replay cannot silently merge two cycles into one.
   */
  allocate(input: {
    tick: number;
    candidates: AttentionCandidateInput[];
    attentionBudget01: number;
    /** Number of inhibited targets the recipient should treat as suppressed. */
    capacity?: number;
    /** Buys latency under pressure: minimal mode only attends to urgent targets. */
    latencyPressure01?: number;
  }): OrganismAttentionState {

    if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new RangeError('attention tick must be a non-negative safe integer');
    if (input.tick <= this.state.lastTick) throw new RangeError('attention tick must strictly increase');
    const budget = finite01(input.attentionBudget01, .5);
    const latency = finite01(input.latencyPressure01, 0);
    const capacity = Math.max(1, Math.min(MAX_INHIBITED, Math.floor(Number(input.capacity ?? 3)) || 3));

    // 1. Sanitize candidates: reject malformed targets, collapse duplicates by
    //    target+source keeping the strongest claim, then drop suppressed items.
    const seen = new Map<string, AttentionCandidateInput>();
    for (const raw of Array.isArray(input.candidates) ? input.candidates.slice(0, 32) : []) {
      if (!raw || typeof raw !== 'object') continue;
      const target = cleanTarget(raw.target);
      if (!target) continue;
      const source = cleanTarget(raw.source) ?? 'unknown';
      const key = `${target}\u0000${source}`;
      const normalized: AttentionCandidateInput = { ...raw, target, source };
      const prior = seen.get(key);
      if (!prior || finite01(normalized.predictedValue01) > finite01(prior.predictedValue01)) seen.set(key, normalized);
    }
    const suppressedTargets = new Set([...seen.values()].filter(c => c.suppressed === true).map(c => c.target as string));
    const considered = seen.size;
    const eligible = [...seen.values()].filter(c => c.suppressed !== true);

    // 2. Resource mode from the real budget: the organism degrades attention
    //    scope before it degrades determinism.
    const resourceMode: AttentionResourceMode = budget < .25 || latency > .75 ? 'minimal' : budget < .55 || latency > .45 ? 'degraded' : 'full';

    // 3. Score every candidate from the named factors. Inhibition-of-return
    //    applies to targets that were recently out-competed.
    const inhibitionRow = this.state.inhibition[String(input.tick)] ?? {};
    const scored = eligible.map(candidate => {
      const factors: AttentionFactors = {
        goal: finite01(candidate.goalRelevance01),
        relevance: finite01(candidate.taskRelevance01),
        urgency: finite01(candidate.urgency01),
        novelty: finite01(candidate.novelty01),
        uncertainty: finite01(candidate.uncertainty01),
        predictedValue: finite01(candidate.predictedValue01),
        emotion: finite01(candidate.emotionalSalience01),
        resource: clamp01(1 - finite01(candidate.resourceCost01)),
        habituation: this.state.target === candidate.target ? MIN_HABITUATION : 1,
        inhibition: inhibitionRow[candidate.target as string] ? 1 : 0,
      };
      let score = 0;
      for (const key of Object.keys(FACTOR_WEIGHTS) as Array<keyof AttentionFactors>) score += FACTOR_WEIGHTS[key] * factors[key];
      // Resource pressure shrinks non-urgent targets more than urgent ones, so a
      // low budget narrows scope instead of stopping allocation outright.
      if (resourceMode !== 'full') score *= 1 - (1 - budget) * (1 - factors.urgency) * (resourceMode === 'minimal' ? .55 : .28);
      // Under minimal resources a non-urgent target cannot win attention at all;
      // degradation must be observable, not cosmetic.
      if (resourceMode === 'minimal' && factors.urgency < .55) score = 0;
      return { candidate, score: clamp01(score), factors };
    }).sort((a, b) => b.score - a.score || (a.candidate.target! < b.candidate.target! ? -1 : a.candidate.target! > b.candidate.target! ? 1 : 0));


    const leader = scored[0];
    const incumbent = this.state.target;
    const incumbentEntry = incumbent ? scored.find(x => x.candidate.target === incumbent) : undefined;

    // 4. Hysteresis: keep the incumbent unless the leader wins by a margin. This
    //    is what prevents attention thrash between near-equal targets.
    let chosen = leader;
    let switched = false;
    if (incumbent && incumbentEntry && leader) {
      const beatsIncumbent = leader.candidate.target !== incumbent && leader.score - incumbentEntry.score >= SWITCH_MARGIN;
      if (!beatsIncumbent) chosen = incumbentEntry;
      switched = chosen.candidate.target !== incumbent;
    } else if (incumbent && leader) {
      switched = leader.candidate.target !== incumbent;
    }

    const previousTarget = incumbent;
    const dwell = chosen && chosen.candidate.target === incumbent ? Math.min(1e6, this.state.dwell + 1) : 1;
    const runnerUpEntry = scored.find(x => x !== chosen);
    const inhibitedTargets = [...new Set([...scored.filter(x => x !== chosen).map(x => x.candidate.target as string), ...suppressedTargets])]
      .filter(target => target !== chosen?.candidate.target).slice(0, MAX_INHIBITED);

    // 5. Inhibition-of-return bookkeeping, bounded: entries expire after
    //    INHIBITION_AFTER_SWITCH ticks and the table keeps at most 64 ticks.
    const inhibition: Record<string, Record<string, number>> = {};
    for (const [tickKey, row] of Object.entries(this.state.inhibition).slice(-63)) {
      const next: Record<string, number> = {};
      for (const [target, remaining] of Object.entries(row)) if (remaining > 1) next[target] = remaining - 1;
      if (Object.keys(next).length) inhibition[tickKey] = next;
    }
    if (switched && previousTarget && !inhibition[String(input.tick)]?.[previousTarget]) {
      const row = { ...(inhibition[String(input.tick)] ?? {}) };
      row[previousTarget] = INHIBITION_AFTER_SWITCH;
      inhibition[String(input.tick)] = row;
    }

    const target = chosen?.candidate.target ?? 'internal-state';
    const reason = !leader ? 'fallback:no-eligible-candidate'
      : resourceMode === 'minimal' ? 'resource:minimal-budget'
        : switched ? 'switch:challenger-margin'
          : incumbent && chosen?.candidate.target === incumbent ? 'hold:incumbent-within-margin'
            : 'select:first-allocation';
    const decision: AttentionDecision = {
      target,
      source: chosen?.candidate.source ?? 'fallback',
      score: chosen?.score ?? 0,
      runnerUpTarget: runnerUpEntry?.candidate.target ?? null,
      margin: chosen && runnerUpEntry ? clamp01(chosen.score - runnerUpEntry.score) : 0,
      switched: switched && Boolean(chosen),
      previousTarget,
      dwell,
      reason,
      resourceMode,
      budget01: budget,
      factors: chosen?.factors ?? { goal: 0, relevance: 0, urgency: 0, novelty: 0, uncertainty: 0, predictedValue: 0, emotion: 0, resource: 0, habituation: 1, inhibition: 0 },
      inhibited: inhibitedTargets,
      considered,
      eligible: eligible.length,
    };
    const switchedAt = decision.switched || incumbent === null ? input.tick : Math.min(this.state.lastTick, input.tick);
    this.state = {
      version: 1,
      target: chosen ? target : this.state.target,
      targetScore: chosen?.score ?? this.state.targetScore,
      dwell: chosen ? dwell : this.state.dwell,
      inhibition,
      switches: this.state.switches + (decision.switched ? 1 : 0),
      allocations: this.state.allocations + 1,
      lastTick: input.tick,
    };

    // `confidence` is the evidence-backed strength of the selection, `salience`
    // is the winning priority. They differ so downstream consumers can separate
    // "how loud" from "how justified". `capacity` bounds how many inhibited
    // targets a resource-limited recipient is told to suppress.
    const salience = decision.score;
    const confidence = chosen
      ? clamp01(salience * .72 + (1 - decision.margin) * .28) * (resourceMode === 'minimal' ? .85 : 1)
      : 0;
    return {
      target,
      reason,
      salience,
      confidence: clamp01(confidence),
      budget,
      inhibited: inhibitedTargets.slice(0, Math.max(1, Math.min(capacity, MAX_INHIBITED))),
      switchedAt,
      decision,
    };
  }

  /** Deterministic trace handle for the cognitive event fabric. */
  static decisionId(decision: AttentionDecision, tick: number): string {
    return `attn-${tick}-${stableHash(`${decision.target}|${decision.source}|${Math.round(decision.score * 1e6)}|${decision.reason}`).toString(16)}`;
  }
}

