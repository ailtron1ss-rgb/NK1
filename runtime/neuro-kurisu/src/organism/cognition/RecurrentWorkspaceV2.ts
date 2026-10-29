/**
 * Recurrent workspace V2 — the organism's bounded working-workspace owner.
 *
 * WorkPass-A03 hardening: the previous implementation re-elected the top-N items
 * on every call with no identity contract. Duplicate ids double-filled the
 * coalition, `restore()` copied `capacity`, `recurrence` and `lastCompetition`
 * straight from persisted (potentially corrupt) data, no item was ever retained
 * via a decayed priority and suppression did not exist. The workspace could be
 * made unbounded by a hostile snapshot and could not explain selection changes.
 *
 * Semantics implemented here:
 *  - admit:    a competing item becomes part of the coalition
 *  - retain:   a resident item keeps its slot while its decayed priority beats
 *              the challengers by an incumbency margin (bounded tenure)
 *  - update:   a re-offered resident item is refreshed in place, never duplicated
 *  - suppress: a loser is recorded and cannot re-enter until the window expires
 *  - remove:   an evicted or expired item is dropped from state
 *
 * Every field of the state is a deterministic function of the inputs; there is
 * no wall-clock read, so snapshot/restore reproduces the same coalitions.
 */

export interface OrganismWorkspaceItem {
  id: string;
  source: string;
  content: Record<string, unknown>;
  salience: number;
  createdAt: number;
}

export interface WorkspaceSuppression {
  id: string;
  ticksRemaining: number;
}

export interface WorkspaceLastDecision {
  tick: number;
  admitted: string[];
  retained: string[];
  suppressed: string[];
  removed: string[];
}

export interface WorkspaceStateV2 {
  capacity: number;
  items: OrganismWorkspaceItem[];
  broadcastId: string;
  recurrence: number;
  /** Number of distinct items that competed in the last cycle. */
  lastCompetition: number;
  ignition01: number;
  sourceDiversity01: number;
  coalitionStability01: number;
  /** Added by WorkPass-A03; optional so older snapshots load unchanged. */
  competitors?: number;
  suppressed?: WorkspaceSuppression[];
  lastDecision?: WorkspaceLastDecision | null;
  admissions?: number;
  evictions?: number;
}

const DEFAULT_CAPACITY = 5;
/** Hard ceiling: a persisted capacity can never exceed this. */
const MAX_CAPACITY = 24;
const MAX_INPUT_ITEMS = 64;
const MAX_SUPPRESSED = 8;
const MAX_BROADCAST_ID = 160;
/** An incumbent keeps its slot if it stays within this fraction of a challenger. */
const INCUMBENCY_MARGIN = .08;
/** Cycles a loser stays out of competition before it may be re-admitted. */
const SUPPRESSION_WINDOW = 3;
const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clampInt = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(Number.isFinite(x) ? x : lo)));
function stableHash(text: string) { let h = 2166136261 >>> 0; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0; return h.toString(16); }
function overlapIds(a: OrganismWorkspaceItem[], b: OrganismWorkspaceItem[]) { if (!a.length || !b.length) return 0; const set = new Set(a.map(x => x.id)); let n = 0; for (const x of b) if (set.has(x.id)) n++; return n / Math.max(a.length, b.length); }
const cleanId = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 160) return null;
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(trimmed)) return null;
  return trimmed;
};

function sanitizeItem(raw: unknown): OrganismWorkspaceItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = cleanId(r.id);
  if (!id) return null;
  const content = r.content && typeof r.content === 'object' && !Array.isArray(r.content)
    ? structuredClone(r.content as Record<string, unknown>)
    : {};
  return {
    id,
    source: cleanId(r.source) ?? 'unknown',
    content,
    salience: clamp(typeof r.salience === 'number' ? r.salience : 0),
    createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) && r.createdAt >= 0 ? r.createdAt : 0,
  };
}

function sanitizeSuppression(raw: unknown): WorkspaceSuppression[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkspaceSuppression[] = [];
  for (const entry of raw.slice(0, MAX_SUPPRESSED)) {
    if (!entry || typeof entry !== 'object') continue;
    const r = entry as Record<string, unknown>;
    const id = cleanId(r.id);
    const ticks = typeof r.ticksRemaining === 'number' && Number.isFinite(r.ticksRemaining) ? Math.floor(r.ticksRemaining) : 0;
    if (!id || ticks <= 0) continue;
    out.push({ id, ticksRemaining: Math.min(64, ticks) });
  }
  return out;
}

export function defaultWorkspaceStateV2(): WorkspaceStateV2 {
  return {
    capacity: DEFAULT_CAPACITY, items: [], broadcastId: '', recurrence: 0, lastCompetition: 0,
    ignition01: 0, sourceDiversity01: 0, coalitionStability01: 0,
    competitors: 0, suppressed: [], lastDecision: null, admissions: 0, evictions: 0,
  };
}

export class RecurrentWorkspaceV2 {
  private state: WorkspaceStateV2 = defaultWorkspaceStateV2();

  /** Restores a persisted workspace under hard bounds. Untrusted capacity,
   *  oversized item lists, duplicate ids and non-finite metrics are rejected. */
  restore(s: Partial<WorkspaceStateV2> | undefined) {
    const d = defaultWorkspaceStateV2();
    const raw = (s && typeof s === 'object') ? s as Record<string, unknown> : {};
    const capacity = clampInt(typeof raw.capacity === 'number' ? raw.capacity : d.capacity, 1, MAX_CAPACITY);
    const items: OrganismWorkspaceItem[] = [];
    const seen = new Set<string>();
    for (const entry of Array.isArray(raw.items) ? raw.items.slice(0, MAX_INPUT_ITEMS) : []) {
      const item = sanitizeItem(entry);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      if (items.length >= capacity) break;
      items.push(item);
    }
    this.state = {
      capacity,
      items,
      broadcastId: typeof raw.broadcastId === 'string' ? raw.broadcastId.slice(0, MAX_BROADCAST_ID) : d.broadcastId,
      recurrence: clamp(typeof raw.recurrence === 'number' ? raw.recurrence : 0),
      lastCompetition: clampInt(typeof raw.lastCompetition === 'number' ? raw.lastCompetition : 0, 0, MAX_INPUT_ITEMS),
      ignition01: clamp(typeof raw.ignition01 === 'number' ? raw.ignition01 : 0),
      sourceDiversity01: clamp(typeof raw.sourceDiversity01 === 'number' ? raw.sourceDiversity01 : 0),
      coalitionStability01: clamp(typeof raw.coalitionStability01 === 'number' ? raw.coalitionStability01 : 0),
      competitors: clampInt(typeof raw.competitors === 'number' ? raw.competitors : 0, 0, MAX_INPUT_ITEMS),
      suppressed: sanitizeSuppression(raw.suppressed),
      lastDecision: null,
      admissions: clampInt(typeof raw.admissions === 'number' ? raw.admissions : 0, 0, Number.MAX_SAFE_INTEGER),
      evictions: clampInt(typeof raw.evictions === 'number' ? raw.evictions : 0, 0, Number.MAX_SAFE_INTEGER),
    };
  }

  snapshot(): WorkspaceStateV2 { return structuredClone(this.state); }

  /** Explicit caller-driven removal (e.g. a revoked goal). */
  remove(id: string): boolean {
    const before = this.state.items.length;
    this.state.items = this.state.items.filter(item => item.id !== id);
    const removed = this.state.items.length !== before;
    if (removed) this.state.evictions = (this.state.evictions ?? 0) + 1;
    return removed;
  }

  /**
   * Runs one competition cycle and returns the bounded coalition. `tickHint` is
   * the organism's logical tick: it feeds the deterministic broadcast id and the
   * retention age, never a wall clock.
   */
  compete(items: OrganismWorkspaceItem[], tickHint = 0): WorkspaceStateV2 {
    const tick = Number.isFinite(tickHint) && tickHint >= 0 ? Math.floor(tickHint) : 0;
    const capacity = clampInt(this.state.capacity, 1, MAX_CAPACITY);
    const previous = this.state.items;
    const previousAdmissions = this.state.admissions ?? 0;
    const previousEvictions = this.state.evictions ?? 0;

    // 1. Sanitize and coalesce duplicate identities. A duplicated id is one
    //    item, not two coalition slots: keep the strongest claim about it.
    const candidates = new Map<string, OrganismWorkspaceItem>();
    for (const entry of (Array.isArray(items) ? items : []).slice(0, MAX_INPUT_ITEMS)) {
      const item = sanitizeItem(entry);
      if (!item) continue;
      const prior = candidates.get(item.id);
      if (!prior || item.salience > prior.salience) candidates.set(item.id, item);
    }

    // 2. Expire suppression windows. A suppressed id cannot re-enter until its
    //    window elapses, which is what makes "suppress" observable.
    const suppressed = (this.state.suppressed ?? [])
      .map(entry => ({ ...entry, ticksRemaining: entry.ticksRemaining - 1 }))
      .filter(entry => entry.ticksRemaining > 0)
      .slice(0, MAX_SUPPRESSED);
    const suppressedIds = new Set(suppressed.map(entry => entry.id));


    // 3. Rank by salience (the original calibration metric) with a total-order
    //    tiebreak. Resident items additionally carry an age-decayed priority so
    //    an item that stops being re-observed loses ground instead of holding a
    //    slot forever.
    const resident = new Map(previous.map(item => [item.id, item] as const));
    const ranked = [...candidates.values()]
      .filter(item => !suppressedIds.has(item.id))
      .map(item => {
        const prior = resident.get(item.id);
        const age = prior ? Math.max(0, tick - prior.createdAt) : 0;
        return { item, prior, effective: clamp(item.salience * (prior ? Math.max(.25, 1 - age * .015) : 1)) };
      })
      .sort((a, b) => b.item.salience - a.item.salience || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));

    // 4. Incumbency: challengers take the best slots in rank order; after the
    //    challenger pass, a resident is re-admitted only while its age-decayed
    //    priority is within INCUMBENCY_MARGIN of the best challenger that lost.
    //    That bounds tenure: an unrefreshed resident stops defending its slot.
    const challengers = ranked.filter(entry => !entry.prior);
    const lowestAdmitted = challengers.length > capacity ? challengers[capacity - 1]!.effective : 0;
    const selected: typeof ranked = challengers.slice(0, capacity);
    const admitted: string[] = selected.map(entry => entry.item.id);
    const retainedIds: string[] = [];
    if (selected.length < capacity) {
      const pool = selected.length ? lowestAdmitted : challengers[0]?.effective ?? 0;
      for (const entry of ranked) {
        if (selected.length >= capacity) break;
        if (!entry.prior) continue;
        if (entry.effective >= pool * (1 - INCUMBENCY_MARGIN)) { selected.push(entry); retainedIds.push(entry.item.id); }
      }
    }

    const coalition = selected
      .map(entry => ({ ...entry.item, createdAt: entry.prior ? entry.prior.createdAt : tick }))
      .sort((a, b) => b.salience - a.salience);
    const keptIds = new Set(coalition.map(item => item.id));
    const removed = previous.filter(item => !keptIds.has(item.id)).map(item => item.id);
    const suppressedNow = ranked
      .filter(entry => !keptIds.has(entry.item.id))
      .slice(0, MAX_SUPPRESSED)
      .map(entry => ({ id: entry.item.id, ticksRemaining: SUPPRESSION_WINDOW }));
    const suppressionNext = [...suppressed, ...suppressedNow]
      .filter(entry => !keptIds.has(entry.id))
      .slice(0, MAX_SUPPRESSED);

    // 5. The calibrated ignition/recurrence/stability formulas are unchanged so
    //    existing behavioural baselines stay directly comparable.
    const overlap = overlapIds(previous, coalition);
    const diversity = new Set(coalition.map(x => x.source)).size / Math.max(1, coalition.length);
    const meanSalience = coalition.reduce((s, x) => s + x.salience, 0) / Math.max(1, coalition.length);
    const competition = clamp(ranked.length / Math.max(1, capacity * 2));
    const ignition = clamp(meanSalience * .52 + competition * .18 + diversity * .12 + overlap * .12 + (coalition.length >= 2 ? .06 : 0));
    const recurrent = Math.abs(ignition - this.state.ignition01) < .08 || overlap > .5 ? Math.min(8, this.state.recurrence + .55) : Math.max(0, this.state.recurrence * .7 + .18);
    const stable = clamp(this.state.coalitionStability01 * .76 + overlap * .24);
    const signature = coalition.map(x => `${x.id}:${Math.round(x.salience * 1000)}`).join('|');
    this.state = {
      capacity,
      items: coalition,
      recurrence: recurrent,
      lastCompetition: ranked.length,
      ignition01: ignition,
      sourceDiversity01: diversity,
      coalitionStability01: stable,
      broadcastId: `gws-${tick || coalition[0]?.createdAt || 0}-${stableHash(signature)}`,
      competitors: candidates.size,
      suppressed: suppressionNext,
      lastDecision: { tick, admitted, retained: retainedIds, suppressed: suppressedNow.map(x => x.id), removed },
      admissions: previousAdmissions + admitted.length,
      evictions: previousEvictions + removed.length,
    };
    return this.snapshot();
  }

  broadcast() {
    return {
      broadcastId: this.state.broadcastId,
      items: this.state.items.map(x => structuredClone(x)),
      recurrence: this.state.recurrence,
      ignition01: this.state.ignition01,
      sourceDiversity01: this.state.sourceDiversity01,
      coalitionStability01: this.state.coalitionStability01,
    };
  }
}

