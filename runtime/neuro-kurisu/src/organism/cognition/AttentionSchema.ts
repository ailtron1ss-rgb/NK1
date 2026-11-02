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
  /** Historical reliability of the winning source (0.5 until outcomes arrive). */
  sourceReliability01?: number;
  /** Competing candidates that claimed the same target with a different value. */
  contradictions?: string[];
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
  /** Factor breakdown of the most recent real decision (for carried holds). */
  lastFactors?: AttentionFactors;
  /** Outcome-calibrated reliability per source (bounded). */
  sourceReliability?: Record<string, { samples: number; reliability01: number }>;
  /** Absolute calibration error of the confidence claim (EMA). */
  calibrationError01?: number;
  /** Times attention was explicitly cancelled/reset. */
  cancellations?: number;
}

const FACTOR_WEIGHTS: Readonly<AttentionFactors> = { goal: .22, relevance: .16, urgency: .18, novelty: .10, uncertainty: .12, predictedValue: .12, emotion: .10, resource: .10, habituation: -.08, inhibition: -.20 };
const MAX_INHIBITED = 8;
const MAX_TARGET_LEN = 160;
const INHIBITION_AFTER_SWITCH = 3;
/** A challenger must beat the incumbent by this margin to take attention. */
const SWITCH_MARGIN = .05;
/** Even a stronger challenger waits until the incumbent has had this long. */
const MIN_DWELL = 2;
/** After this many cycles the incumbent is re-evaluated on merit alone. */
const MAX_DWELL = 12;
/** A challenger at or above this priority pre-empts immediately (threat). */
const URGENT_BREAKTHROUGH = .5;
/** ...or whose urgency reaches this level pre-empts immediately. */
const URGENT_PREEMPTION_URGENCY = .9;
/** A carried (not re-offered) incumbent's priority decays this fast per cycle. */
const CARRY_DECAY = .02;
/** ...and never drops below this fraction of its last observed priority. */
const CARRY_FLOOR = .5;
/** A carried incumbent is re-evaluated on merit after this many cycles. */
const MAX_CARRY = 6;
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

const FACTOR_KEYS: Array<keyof AttentionFactors> = ['goal','relevance','urgency','novelty','uncertainty','predictedValue','emotion','resource','habituation','inhibition'];
/** Validates a persisted factor breakdown; partial or garbage factors are dropped. */
function sanitizeFactors(raw: unknown): AttentionFactors | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const out: Partial<AttentionFactors> = {};
  for (const key of FACTOR_KEYS) {
    const value = source[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    out[key] = clamp01(value);
  }
  return out as AttentionFactors;
}

const MAX_SOURCES = 8;
/** Validates a persisted per-source reliability table (bounded, finite). */
function sanitizeReliability(raw: unknown): Record<string, { samples: number; reliability01: number }> {
  const out: Record<string, { samples: number; reliability01: number }> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [source, entry] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_SOURCES)) {
    const name = cleanTarget(source);
    if (!name || !entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const samples = typeof row.samples === 'number' && Number.isSafeInteger(row.samples) && row.samples >= 0 ? row.samples : 0;
    if (samples === 0) continue;
    out[name] = { samples: Math.min(1e6, samples), reliability01: finite01(row.reliability01, .5) };
  }
  return out;
}

export function defaultAttentionAllocatorState(): AttentionAllocatorState {
  return { version: 1, target: null, targetScore: 0, dwell: 0, inhibition: {}, switches: 0, allocations: 0, lastTick: -1, sourceReliability: {}, calibrationError01: .5, cancellations: 0 };
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
      ...(sanitizeFactors(r.lastFactors) ? { lastFactors: sanitizeFactors(r.lastFactors) as AttentionFactors } : {}),
      sourceReliability: sanitizeReliability(r.sourceReliability),
      calibrationError01: finite01(r.calibrationError01, .5),
      cancellations: typeof r.cancellations === 'number' && Number.isSafeInteger(r.cancellations) && r.cancellations >= 0 ? r.cancellations : 0,
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
    // Contradiction handling: two senders claiming the same target with different
    // predicted value are a conflict, not a stronger signal. The conflict is
    // recorded (traceable) and the higher-value claim wins the comparison.
    const claimByTarget = new Map<string, Set<number>>();
    for (const candidate of seen.values()) {
      const key = candidate.target as string;
      const claims = claimByTarget.get(key) ?? new Set<number>();
      claims.add(Math.round(finite01(candidate.predictedValue01) * 1000));
      claimByTarget.set(key, claims);
    }
    const contradictions = [...claimByTarget.entries()].filter(([, claims]) => claims.size > 1).map(([target]) => target).slice(0, MAX_INHIBITED);
    const suppressedTargets = new Set([...seen.values()].filter(c => c.suppressed === true).map(c => c.target as string));
    const considered = seen.size;
    const eligible = [...seen.values()].filter(c => c.suppressed !== true);

    // 2. Resource mode from the real budget: the organism degrades attention
    //    scope before it degrades determinism.
    const resourceMode: AttentionResourceMode = budget < .25 || latency > .75 ? 'minimal' : budget < .55 || latency > .45 ? 'degraded' : 'full';

    // 3. Score every candidate from the named factors. Inhibition-of-return
    //    applies to targets that were recently out-competed.
    const previousFactors = this.state.lastFactors;
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
      // Outcome-calibrated reliability: a source that has repeatedly produced
      // irrelevant targets is down-weighted (never below 85% of its raw score, so
      // it can still recover when outcomes improve).
      const reliability = this.state.sourceReliability?.[candidate.source as string]?.reliability01 ?? .5;
      score *= .85 + .15 * reliability;
      return { candidate, score: clamp01(score), factors };
    }).sort((a, b) => b.score - a.score || (a.candidate.target! < b.candidate.target! ? -1 : a.candidate.target! > b.candidate.target! ? 1 : 0));


    const leader = scored[0];
    const incumbent = this.state.target;
    const incumbentEntry = incumbent ? scored.find(x => x.candidate.target === incumbent) : undefined;

    // 4. Hysteresis: keep the incumbent unless the leader wins by a margin and
    //    the incumbent has had a minimum dwell. Once MAX_DWELL cycles pass the
    //    incumbent is re-evaluated on merit, so commitment is bounded and cannot
    //    become lock-in.
    let chosen = leader;
    let switched = false;
    let carried = false;
    if (incumbent && incumbentEntry && leader) {
      const incumbentAhead = leader.candidate.target === incumbent;
      const margin = leader.score - incumbentEntry.score;
      const dwellSatisfied = this.state.dwell >= (margin >= SWITCH_MARGIN * 2 ? MIN_DWELL : MAX_DWELL);
      // Priority pre-emption: an already-dominant or highly urgent challenger
      // (threat / unexpected error) does not wait out the dwell. This is what
      // makes urgency a real factor rather than a tie-breaker.
      const priorityBreakthrough = margin >= SWITCH_MARGIN && leader.score >= URGENT_BREAKTHROUGH;
      const urgencyPreemption = leader.factors.urgency >= URGENT_PREEMPTION_URGENCY && leader.score >= incumbentEntry.score;
      const takeOver = urgencyPreemption || (margin >= SWITCH_MARGIN && (dwellSatisfied || priorityBreakthrough));
      if (!incumbentAhead && takeOver) chosen = leader;
      else chosen = incumbentEntry;
      switched = chosen.candidate.target !== incumbent;
    } else if (incumbent && leader) {
      // The incumbent was not re-offered this cycle. Absence is not evidence that
      // it lost importance (callers mediate their candidate list), so it is
      // carried with a decayed priority until a challenger clearly beats it or
      // its bounded hold expires. Without this a caller whose candidate identity
      // alternates produced a switch every cycle.
      const carryScore = clamp01(this.state.targetScore * Math.max(CARRY_FLOOR, 1 - this.state.dwell * CARRY_DECAY));
      // Under a minimal budget the organism must re-scope to what is urgent
      // rather than carry a target that is no longer being offered.
      const carryExpired = this.state.dwell >= MAX_CARRY || resourceMode === 'minimal';
      if (!carryExpired && leader.score - carryScore < SWITCH_MARGIN) {
        chosen = { candidate: { target: incumbent, source: 'carried' }, score: carryScore, factors: previousFactors ?? { goal: 0, relevance: 0, urgency: 0, novelty: 0, uncertainty: 0, predictedValue: 0, emotion: 0, resource: 0, habituation: 1, inhibition: 0 } };
        carried = true;
        switched = false;
      } else {
        switched = leader.candidate.target !== incumbent;
      }
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
      : carried ? 'hold:incumbent-not-offered'
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
      sourceReliability01: this.state.sourceReliability?.[chosen?.candidate.source as string]?.reliability01 ?? .5,
      contradictions,
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
      lastFactors: carried ? previousFactors : decision.factors,
      sourceReliability: this.state.sourceReliability ?? {},
      calibrationError01: this.state.calibrationError01 ?? .5,
      cancellations: this.state.cancellations ?? 0,
    };

    // `confidence` is the evidence-backed strength of the selection, `salience`
    // is the winning priority. They differ so downstream consumers can separate
    // "how loud" from "how justified". `capacity` bounds how many inhibited
    // targets a resource-limited recipient is told to suppress.
    const salience = decision.score;
    // Confidence is a *calibrated* claim: it mixes the decision strength with the
    // historical reliability of the winning source, so a confident source that is
    // regularly wrong ends up reporting lower confidence.
    const winnerReliability = decision.sourceReliability01 ?? .5;
    const confidence = chosen
      ? clamp01(salience * .55 + (1 - decision.margin) * .20 + winnerReliability * .25) * (resourceMode === 'minimal' ? .85 : 1)
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

  /**
   * Folds a realized outcome back into the reliability of the source that won
   * attention. `realizedValue01` is the caller's measured usefulness of having
   * attended that source (e.g. 1 - prediction error after the cycle). The
   * confidence claim is scored against it, so calibration is measured rather than
   * asserted. Unknown sources start at 0.5 (uninformative) and the table is bounded.
   */
  recordOutcome(input: { source: string; realizedValue01: number }): { accepted: boolean; reliability01: number; calibrationError01: number } {
    const source = cleanTarget(input.source);
    if (!source) return { accepted: false, reliability01: .5, calibrationError01: this.state.calibrationError01 ?? .5 };
    const realized = finite01(input.realizedValue01, .5);
    const prior = this.state.sourceReliability?.[source] ?? { samples: 0, reliability01: .5 };
    const samples = Math.min(1e6, prior.samples + 1);
    // Early samples move fast, later ones are stable (1/n style learning rate).
    const rate = Math.max(.05, 1 / Math.min(20, samples));
    const reliability01 = clamp01(prior.reliability01 * (1 - rate) + realized * rate);
    const table = { ...(this.state.sourceReliability ?? {}) };
    table[source] = { samples, reliability01 };
    const trimmed = Object.entries(table).sort((a, b) => b[1].samples - a[1].samples).slice(0, MAX_SOURCES);
    this.state.sourceReliability = Object.fromEntries(trimmed);
    if (this.state.target && this.state.lastFactors) {
      // The confidence that was claimed for this outcome, scored against reality.
      const claimed = clamp01((this.state.targetScore ?? 0) * .55 + reliability01 * .25 + .20 * .5);
      this.state.calibrationError01 = clamp01((this.state.calibrationError01 ?? .5) * .9 + Math.abs(claimed - realized) * .1);
    }
    return { accepted: true, reliability01, calibrationError01: this.state.calibrationError01 ?? .5 };
  }

  /** Graceful cancellation: drops commitment/inhibition but keeps learned
   *  reliability so a restart of attention does not lose calibration. */
  reset(reason = 'cancelled'): { cancelled: boolean; reason: string; previousTarget: string | null } {
    const previousTarget = this.state.target;
    this.state.target = null;
    this.state.targetScore = 0;
    this.state.dwell = 0;
    this.state.inhibition = {};
    this.state.cancellations = (this.state.cancellations ?? 0) + 1;
    return { cancelled: Boolean(previousTarget), reason, previousTarget };
  }

  /** Deterministic trace handle for the cognitive event fabric. */
  static decisionId(decision: AttentionDecision, tick: number): string {
    return `attn-${tick}-${stableHash(`${decision.target}|${decision.source}|${Math.round(decision.score * 1e6)}|${decision.reason}`).toString(16)}`;
  }
}

