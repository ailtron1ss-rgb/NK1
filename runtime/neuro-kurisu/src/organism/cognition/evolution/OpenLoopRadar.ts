export type OpenLoopStatus = 'open' | 'blocked' | 'fulfilled' | 'cancelled';
export type OpenLoopOwner = 'user' | 'system';
export type OpenLoopKind = 'promise' | 'task' | 'waiting' | 'project_step' | 'dependency';

export interface OpenLoopClosureEvidence {
  kind: 'user-confirmation' | 'execution-receipt' | 'external-confirmation';
  reference: string;
  verifiedAt: number;
}
export interface OpenLoopRecord {
  id: string; title: string; description: string; kind: OpenLoopKind; owner: OpenLoopOwner;
  status: OpenLoopStatus; createdAt: number; updatedAt: number; dueAt: number | null;
  expiresAt: number | null; dependencies: string[]; priority: number; source: string;
  accepted: true; closureEvidence: OpenLoopClosureEvidence | null;
  cancellationReason: string | null; lastSurfacedAt: number;
}
export interface OpenLoopRadarState { version: 1; records: OpenLoopRecord[]; sequence: number; }
export interface OpenLoopCandidate {
  record: OpenLoopRecord; effectiveStatus: OpenLoopStatus | 'expired'; blockedBy: string[];
  overdueMs: number; risk01: number; shouldSurface: boolean;
  surfaceReason: 'overdue' | 'due-soon' | 'dependency-unblocked' | 'expired' | null;
}
export interface OpenLoopScanOptions { now?: number; dueSoonMs?: number; reminderCooldownMs?: number; quietUntil?: number; }

const MAX_RECORDS = 512, MAX_DEPENDENCIES = 32, MAX_TEXT = 500;
const TERMINAL = new Set<OpenLoopStatus>(['fulfilled', 'cancelled']);
const text = (v: unknown, max = MAX_TEXT): string => typeof v === 'string' ? v.trim().slice(0, max) : '';
const time = (v: unknown): number | null => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null;
const clamp01 = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function normalizeEvidence(value: unknown): OpenLoopClosureEvidence | null {
  if (!isObject(value)) return null;
  const kind = value.kind, reference = text(value.reference, 240), verifiedAt = time(value.verifiedAt);
  if (!reference || !verifiedAt || (kind !== 'user-confirmation' && kind !== 'execution-receipt' && kind !== 'external-confirmation')) return null;
  return { kind, reference, verifiedAt };
}
function normalizeRecord(value: unknown): OpenLoopRecord | null {
  if (!isObject(value)) return null;
  const id = text(value.id, 128), title = text(value.title, 180);
  const createdAt = time(value.createdAt), updatedAt = time(value.updatedAt);
  const kind = value.kind, owner = value.owner, status = value.status;
  if (!id || !title || !createdAt || !updatedAt || value.accepted !== true ||
    !['promise', 'task', 'waiting', 'project_step', 'dependency'].includes(String(kind)) ||
    (owner !== 'user' && owner !== 'system') ||
    (status !== 'open' && status !== 'blocked' && status !== 'fulfilled' && status !== 'cancelled')) return null;
  const dependencies = Array.isArray(value.dependencies)
    ? [...new Set(value.dependencies.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(Boolean))].slice(0, MAX_DEPENDENCIES) : [];
  const closureEvidence = normalizeEvidence(value.closureEvidence);
  if (status === 'fulfilled' && !closureEvidence) return null;
  return { id, title, description: text(value.description), kind: kind as OpenLoopKind, owner, status,
    createdAt, updatedAt, dueAt: time(value.dueAt), expiresAt: time(value.expiresAt), dependencies,
    priority: clamp01(value.priority), source: text(value.source, 120) || 'unknown', accepted: true,
    closureEvidence, cancellationReason: text(value.cancellationReason, 240) || null,
    lastSurfacedAt: time(value.lastSurfacedAt) ?? 0 };
}
export function defaultOpenLoopRadarState(): OpenLoopRadarState { return { version: 1, records: [], sequence: 0 }; }

/** Deterministic obligation registry. No notifications, network calls, or implicit commitments. */
export class OpenLoopRadar {
  private state = defaultOpenLoopRadarState();
  private readonly now: () => number;
  constructor(now: () => number = Date.now) { this.now = now; }
  restore(value: unknown): void {
    if (!isObject(value) || value.version !== 1 || !Array.isArray(value.records)) { this.state = defaultOpenLoopRadarState(); return; }
    const records = new Map<string, OpenLoopRecord>();
    for (const raw of value.records.slice(0, MAX_RECORDS * 2)) {
      const record = normalizeRecord(raw); if (record && !records.has(record.id)) records.set(record.id, record);
    }
    const sorted = [...records.values()].sort((a,b) => b.updatedAt-a.updatedAt || a.id.localeCompare(b.id)).slice(0, MAX_RECORDS);
    const maxSequence = sorted.reduce((max, record) => { const m = /^open-loop-\d+-(\d+)$/.exec(record.id); return m ? Math.max(max, Number(m[1]) || 0) : max; }, 0);
    const supplied = typeof value.sequence === 'number' && Number.isSafeInteger(value.sequence) && value.sequence >= 0 ? value.sequence : 0;
    this.state = { version: 1, records: sorted, sequence: Math.max(maxSequence, supplied) };
    this.reconcileDependencies();
  }
  snapshot(): OpenLoopRadarState { return structuredClone(this.state); }
  register(input: { title: string; description?: string; kind: OpenLoopKind; owner: OpenLoopOwner; accepted: boolean;
    source: string; dueAt?: number | null; expiresAt?: number | null; dependencies?: string[]; priority?: number }): OpenLoopRecord {
    const title = text(input?.title, 180);
    if (!title) throw new TypeError('title must be a non-empty string');
    if (input.accepted !== true) throw new Error('explicit-acceptance-required');
    if (input.owner !== 'user' && input.owner !== 'system') throw new TypeError('owner is invalid');
    if (!['promise','task','waiting','project_step','dependency'].includes(input.kind)) throw new TypeError('kind is invalid');
    const now = this.safeNow(), dueAt = input.dueAt == null ? null : time(input.dueAt), expiresAt = input.expiresAt == null ? null : time(input.expiresAt);
    if (input.dueAt != null && !dueAt) throw new TypeError('dueAt must be a positive safe integer timestamp');
    if (input.expiresAt != null && !expiresAt) throw new TypeError('expiresAt must be a positive safe integer timestamp');
    if (dueAt && expiresAt && expiresAt < dueAt) throw new RangeError('expiresAt must not precede dueAt');
    const dependencies = [...new Set((input.dependencies ?? []).map(v => text(v,128)).filter(Boolean))].slice(0,MAX_DEPENDENCIES);
    for (const dependency of dependencies) if (!this.state.records.some(r => r.id === dependency)) throw new Error('unknown-dependency:' + dependency);
    this.state.sequence += 1;
    const record: OpenLoopRecord = { id: `open-loop-${now}-${this.state.sequence}`, title, description: text(input.description),
      kind: input.kind, owner: input.owner, status: dependencies.some(id => !this.isSatisfied(id)) ? 'blocked' : 'open',
      createdAt: now, updatedAt: now, dueAt, expiresAt, dependencies, priority: clamp01(input.priority),
      source: text(input.source,120) || 'unspecified', accepted: true, closureEvidence: null,
      cancellationReason: null, lastSurfacedAt: 0 };
    this.state.records = [record,...this.state.records].slice(0,MAX_RECORDS);
    return structuredClone(record);
  }
  fulfill(id: string, evidence: OpenLoopClosureEvidence): OpenLoopRecord {
    const record = this.requireActive(id), normalized = normalizeEvidence(evidence);
    if (!normalized) throw new TypeError('valid-closure-evidence-required');
    const now = this.safeNow(); if (normalized.verifiedAt > now) throw new RangeError('closure-evidence-cannot-be-from-the-future');
    record.status = 'fulfilled'; record.closureEvidence = normalized; record.updatedAt = now;
    this.reconcileDependencies(); return structuredClone(record);
  }
  cancel(id: string, reason: string): OpenLoopRecord {
    const record = this.requireActive(id), cancellationReason = text(reason,240);
    if (!cancellationReason) throw new TypeError('cancellation-reason-required');
    record.status = 'cancelled'; record.cancellationReason = cancellationReason; record.updatedAt = this.safeNow();
    this.reconcileDependencies(); return structuredClone(record);
  }
  reopen(id: string, reason: string): OpenLoopRecord {
    const record = this.state.records.find(r => r.id === id);
    if (!record || !TERMINAL.has(record.status)) throw new Error('record-not-reopenable');
    const note = text(reason,240); if (!note) throw new TypeError('reopen-reason-required');
    record.status = record.dependencies.some(dep => !this.isSatisfied(dep)) ? 'blocked' : 'open';
    record.closureEvidence = null; record.cancellationReason = null; record.updatedAt = this.safeNow();
    record.description = [record.description, `Reopened: ${note}`].filter(Boolean).join('\n').slice(0,MAX_TEXT);
    this.reconcileDependencies(); return structuredClone(record);
  }
  scan(options: OpenLoopScanOptions = {}): OpenLoopCandidate[] {
    const now = time(options.now) ?? this.safeNow();
    const dueSoonMs = Number.isSafeInteger(options.dueSoonMs) && (options.dueSoonMs as number) >= 0 ? options.dueSoonMs as number : 86400000;
    const cooldown = Number.isSafeInteger(options.reminderCooldownMs) && (options.reminderCooldownMs as number) >= 0 ? options.reminderCooldownMs as number : 21600000;
    const quietUntil = time(options.quietUntil) ?? 0;
    return this.state.records.flatMap(record => {
      if (TERMINAL.has(record.status)) return [];
      const blockedBy = record.dependencies.filter(id => !this.isSatisfied(id));
      const effectiveStatus = record.expiresAt !== null && record.expiresAt <= now ? 'expired' : blockedBy.length ? 'blocked' : 'open';
      const overdueMs = record.dueAt !== null ? Math.max(0,now-record.dueAt) : 0;
      const dueSoon = record.dueAt !== null && record.dueAt > now && record.dueAt-now <= dueSoonMs;
      const surfaceReason = effectiveStatus === 'expired' ? 'expired' : overdueMs > 0 ? 'overdue' : dueSoon ? 'due-soon' : record.status === 'blocked' && blockedBy.length === 0 ? 'dependency-unblocked' : null;
      const risk01 = Math.min(1,record.priority*0.45+Math.min(1,overdueMs/604800000)*0.4+(blockedBy.length?0.15:0));
      const shouldSurface = surfaceReason !== null && now >= quietUntil && now-record.lastSurfacedAt >= cooldown;
      return [{ record: structuredClone(record), effectiveStatus, blockedBy, overdueMs, risk01, shouldSurface, surfaceReason }];
    }).sort((a,b) => Number(b.shouldSurface)-Number(a.shouldSurface) || b.risk01-a.risk01 || (a.record.dueAt??Number.MAX_SAFE_INTEGER)-(b.record.dueAt??Number.MAX_SAFE_INTEGER));
  }
  markSurfaced(id: string): void { const record = this.requireActive(id); record.lastSurfacedAt = this.safeNow(); record.updatedAt = this.safeNow(); }
  private safeNow(): number { const value = this.now(); return Number.isSafeInteger(value)&&value>0 ? value : 1; }
  private requireActive(id: string): OpenLoopRecord {
    const record = this.state.records.find(r => r.id === id);
    if (!record) throw new Error('open-loop-not-found');
    if (TERMINAL.has(record.status)) throw new Error('open-loop-already-closed');
    return record;
  }
  private isSatisfied(id: string): boolean { const record = this.state.records.find(r => r.id === id); return !!record && record.status === 'fulfilled' && !!record.closureEvidence; }
  private reconcileDependencies(): void {
    for (const record of this.state.records) {
      if (TERMINAL.has(record.status)) continue;
      const next = record.dependencies.some(id => !this.isSatisfied(id)) ? 'blocked' : 'open';
      if (record.status !== next) { record.status = next; record.updatedAt = this.safeNow(); }
    }
  }
}
