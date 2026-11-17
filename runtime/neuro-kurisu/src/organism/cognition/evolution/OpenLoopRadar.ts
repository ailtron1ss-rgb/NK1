export type OpenLoopStatus = 'open' | 'blocked' | 'fulfilled' | 'cancelled';
export type OpenLoopOwner = 'user' | 'system';
export type OpenLoopKind = 'promise' | 'task' | 'waiting' | 'project_step' | 'dependency';

export interface OpenLoopClosureEvidence {
  kind: 'user-confirmation' | 'execution-receipt' | 'external-confirmation';
  reference: string;
  verifiedAt: number;
}
export interface OpenLoopRecord {
  id: string;
  title: string;
  description: string;
  kind: OpenLoopKind;
  owner: OpenLoopOwner;
  status: OpenLoopStatus;
  createdAt: number;
  updatedAt: number;
  dueAt: number | null;
  expiresAt: number | null;
  dependencies: string[];
  priority: number;
  source: string;
  accepted: true;
  closureEvidence: OpenLoopClosureEvidence | null;
  cancellationReason: string | null;
  lastSurfacedAt: number;
  /** Set only when a previously blocked record becomes actionable. */
  unblockedAt: number;
}
export interface OpenLoopRadarState { version: 1; records: OpenLoopRecord[]; sequence: number; }
export interface OpenLoopCandidate {
  record: OpenLoopRecord;
  effectiveStatus: OpenLoopStatus | 'expired';
  blockedBy: string[];
  overdueMs: number;
  risk01: number;
  shouldSurface: boolean;
  surfaceReason: 'overdue' | 'due-soon' | 'dependency-unblocked' | 'expired' | null;
}
export interface OpenLoopScanOptions { now?: number; dueSoonMs?: number; reminderCooldownMs?: number; quietUntil?: number; }

const MAX_RECORDS = 512;
const MAX_RESTORE_RECORDS = MAX_RECORDS * 4;
const MAX_DEPENDENCIES = 32;
const MAX_TEXT = 500;
const TERMINAL = new Set<OpenLoopStatus>(['fulfilled', 'cancelled']);

const text = (value: unknown, max = MAX_TEXT): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const time = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
const clamp01 = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Read only own data properties. Restoring persisted input must not execute getters. */
function ownData(value: unknown, key: string): unknown {
  if (!isObject(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
}
function safeArray(value: unknown, limit: number): unknown[] | null {
  if (!Array.isArray(value)) return null;
  const length = Math.min(value.length, limit);
  const items: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
    items.push(descriptor.value);
  }
  return items;
}
function normalizeEvidence(value: unknown): OpenLoopClosureEvidence | null {
  if (!isObject(value)) return null;
  const kind = ownData(value, 'kind');
  const reference = text(ownData(value, 'reference'), 240);
  const verifiedAt = time(ownData(value, 'verifiedAt'));
  if (!reference || !verifiedAt ||
      (kind !== 'user-confirmation' && kind !== 'execution-receipt' && kind !== 'external-confirmation')) return null;
  return { kind, reference, verifiedAt };
}
function normalizeRecord(value: unknown): OpenLoopRecord | null {
  if (!isObject(value)) return null;
  const id = text(ownData(value, 'id'), 128);
  const title = text(ownData(value, 'title'), 180);
  const createdAt = time(ownData(value, 'createdAt'));
  const updatedAt = time(ownData(value, 'updatedAt'));
  const kind = ownData(value, 'kind');
  const owner = ownData(value, 'owner');
  const status = ownData(value, 'status');
  if (!id || !title || !createdAt || !updatedAt || ownData(value, 'accepted') !== true ||
      (kind !== 'promise' && kind !== 'task' && kind !== 'waiting' && kind !== 'project_step' && kind !== 'dependency') ||
      (owner !== 'user' && owner !== 'system') ||
      (status !== 'open' && status !== 'blocked' && status !== 'fulfilled' && status !== 'cancelled')) return null;

  const rawDependencies = ownData(value, 'dependencies');
  let dependencies: string[] = [];
  if (rawDependencies !== undefined) {
    const entries = safeArray(rawDependencies, MAX_DEPENDENCIES * 4);
    if (!entries) return null;
    dependencies = [...new Set(entries.map(entry => text(entry, 128)).filter(Boolean))].slice(0, MAX_DEPENDENCIES);
  }
  const closureEvidence = normalizeEvidence(ownData(value, 'closureEvidence'));
  if (status === 'fulfilled' && !closureEvidence) return null;
  const cancellationReason = text(ownData(value, 'cancellationReason'), 240) || null;
  if (status === 'cancelled' && !cancellationReason) return null;

  return {
    id, title, description: text(ownData(value, 'description')), kind, owner, status,
    createdAt, updatedAt,
    dueAt: time(ownData(value, 'dueAt')),
    expiresAt: time(ownData(value, 'expiresAt')),
    dependencies,
    priority: clamp01(ownData(value, 'priority')),
    source: text(ownData(value, 'source'), 120) || 'unknown',
    accepted: true,
    closureEvidence,
    cancellationReason,
    lastSurfacedAt: time(ownData(value, 'lastSurfacedAt')) ?? 0,
    unblockedAt: time(ownData(value, 'unblockedAt')) ?? 0,
  };
}
export function defaultOpenLoopRadarState(): OpenLoopRadarState {
  return { version: 1, records: [], sequence: 0 };
}

/**
 * Domain engine for accepted obligations. It does not notify, schedule, perform
 * network calls, or infer acceptance from memory. Host code owns cadence and UI.
 */
export class OpenLoopRadar {
  private state = defaultOpenLoopRadarState();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) { this.now = now; }

  restore(value: unknown): void {
    const version = ownData(value, 'version');
    const rawRecords = safeArray(ownData(value, 'records'), MAX_RESTORE_RECORDS);
    if (!isObject(value) || version !== 1 || !rawRecords) {
      this.state = defaultOpenLoopRadarState();
      return;
    }

    const byId = new Map<string, OpenLoopRecord>();
    for (const raw of rawRecords) {
      const record = normalizeRecord(raw);
      if (record && !byId.has(record.id)) byId.set(record.id, record);
    }

    const cyclicIds = this.findCyclicRecords(byId);
    for (const id of cyclicIds) byId.delete(id);

    // Drop records whose dependency was malformed, cyclic, truncated or absent.
    // Keeping them as permanently blocked would turn corruption into a fake task.
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, record] of byId) {
        if (record.dependencies.some(dependency => !byId.has(dependency))) {
          byId.delete(id);
          changed = true;
        }
      }
    }

    if (byId.size > MAX_RECORDS) throw new Error('open-loop-state-capacity-exceeded');
    const records = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
    const maxSequence = records.reduce((max, record) => {
      const match = /^open-loop-\d+-(\d+)$/.exec(record.id);
      return match ? Math.max(max, Number(match[1]) || 0) : max;
    }, 0);
    const suppliedSequence = ownData(value, 'sequence');
    const sequence = typeof suppliedSequence === 'number' && Number.isSafeInteger(suppliedSequence) && suppliedSequence >= 0
      ? suppliedSequence : 0;
    this.state = { version: 1, records, sequence: Math.max(maxSequence, sequence) };
    this.reconcileDependencies();
  }

  snapshot(): OpenLoopRadarState { return structuredClone(this.state); }

  register(input: {
    title: string;
    description?: string;
    kind: OpenLoopKind;
    owner: OpenLoopOwner;
    accepted: boolean;
    source: string;
    dueAt?: number | null;
    expiresAt?: number | null;
    dependencies?: string[];
    priority?: number;
  }): OpenLoopRecord {
    const title = text(input?.title, 180);
    if (!title) throw new TypeError('title must be a non-empty string');
    if (input.accepted !== true) throw new Error('explicit-acceptance-required');
    if (input.owner !== 'user' && input.owner !== 'system') throw new TypeError('owner is invalid');
    if (input.kind !== 'promise' && input.kind !== 'task' && input.kind !== 'waiting' &&
        input.kind !== 'project_step' && input.kind !== 'dependency') throw new TypeError('kind is invalid');

    const now = this.safeNow();
    const dueAt = input.dueAt == null ? null : time(input.dueAt);
    const expiresAt = input.expiresAt == null ? null : time(input.expiresAt);
    if (input.dueAt != null && !dueAt) throw new TypeError('dueAt must be a positive safe integer timestamp');
    if (input.expiresAt != null && !expiresAt) throw new TypeError('expiresAt must be a positive safe integer timestamp');
    if (dueAt && expiresAt && expiresAt < dueAt) throw new RangeError('expiresAt must not precede dueAt');

    if (input.dependencies != null && !Array.isArray(input.dependencies)) throw new TypeError('dependencies must be an array');
    const dependencies = [...new Set((input.dependencies ?? []).map(value => {
      if (typeof value !== 'string' || !value.trim()) throw new TypeError('dependency ids must be non-empty strings');
      return value.trim().slice(0, 128);
    }))].slice(0, MAX_DEPENDENCIES);
    if (dependencies.length > MAX_DEPENDENCIES) throw new RangeError('too-many-open-loop-dependencies');
    for (const dependency of dependencies) {
      if (!this.state.records.some(record => record.id === dependency)) throw new Error('unknown-dependency:' + dependency);
    }

    const protectedTerminalIds = new Set(
      this.state.records.filter(record => !TERMINAL.has(record.status)).flatMap(record => record.dependencies),
    );
    const retained = this.state.records.filter(record => !TERMINAL.has(record.status) || protectedTerminalIds.has(record.id));
    if (retained.length >= MAX_RECORDS) throw new Error('open-loop-capacity-exhausted');

    const nextSequence = this.state.sequence + 1;
    const record: OpenLoopRecord = {
      id: `open-loop-${now}-${nextSequence}`,
      title,
      description: text(input.description),
      kind: input.kind,
      owner: input.owner,
      status: dependencies.some(id => !this.isSatisfied(id)) ? 'blocked' : 'open',
      createdAt: now,
      updatedAt: now,
      dueAt,
      expiresAt,
      dependencies,
      priority: clamp01(input.priority),
      source: text(input.source, 120) || 'unspecified',
      accepted: true,
      closureEvidence: null,
      cancellationReason: null,
      lastSurfacedAt: 0,
      unblockedAt: 0,
    };
    this.state.sequence = nextSequence;
    this.state.records = [record, ...retained];
    return structuredClone(record);
  }

  fulfill(id: string, evidence: OpenLoopClosureEvidence): OpenLoopRecord {
    const record = this.requireActive(id);
    const normalized = normalizeEvidence(evidence);
    if (!normalized) throw new TypeError('valid-closure-evidence-required');
    const now = this.safeNow();
    if (normalized.verifiedAt > now) throw new RangeError('closure-evidence-cannot-be-from-the-future');
    if (normalized.verifiedAt < record.createdAt) throw new RangeError('closure-evidence-predates-obligation');
    record.status = 'fulfilled';
    record.closureEvidence = normalized;
    record.updatedAt = now;
    this.reconcileDependencies();
    return structuredClone(record);
  }

  cancel(id: string, reason: string): OpenLoopRecord {
    const record = this.requireActive(id);
    const cancellationReason = text(reason, 240);
    if (!cancellationReason) throw new TypeError('cancellation-reason-required');
    record.status = 'cancelled';
    record.cancellationReason = cancellationReason;
    record.updatedAt = this.safeNow();
    this.reconcileDependencies();
    return structuredClone(record);
  }

  reopen(id: string, reason: string): OpenLoopRecord {
    const record = this.state.records.find(item => item.id === id);
    if (!record || !TERMINAL.has(record.status)) throw new Error('record-not-reopenable');
    const note = text(reason, 240);
    if (!note) throw new TypeError('reopen-reason-required');
    record.status = record.dependencies.some(dependency => !this.isSatisfied(dependency)) ? 'blocked' : 'open';
    record.closureEvidence = null;
    record.cancellationReason = null;
    record.updatedAt = this.safeNow();
    record.unblockedAt = 0;
    record.description = [record.description, `Reopened: ${note}`].filter(Boolean).join('\n').slice(0, MAX_TEXT);
    this.reconcileDependencies();
    return structuredClone(record);
  }

  scan(options: OpenLoopScanOptions = {}): OpenLoopCandidate[] {
    const now = time(options.now) ?? this.safeNow();
    const dueSoonMs = Number.isSafeInteger(options.dueSoonMs) && (options.dueSoonMs as number) >= 0
      ? options.dueSoonMs as number : 24 * 60 * 60 * 1000;
    const cooldown = Number.isSafeInteger(options.reminderCooldownMs) && (options.reminderCooldownMs as number) >= 0
      ? options.reminderCooldownMs as number : 6 * 60 * 60 * 1000;
    const quietUntil = time(options.quietUntil) ?? 0;

    return this.state.records.flatMap(record => {
      if (TERMINAL.has(record.status)) return [];
      const blockedBy = record.dependencies.filter(id => !this.isSatisfied(id));
      const effectiveStatus = record.expiresAt !== null && record.expiresAt <= now
        ? 'expired' : blockedBy.length ? 'blocked' : 'open';
      const overdueMs = record.dueAt !== null ? Math.max(0, now - record.dueAt) : 0;
      const dueSoon = record.dueAt !== null && record.dueAt > now && record.dueAt - now <= dueSoonMs;
      const dependencyUnblocked = record.unblockedAt > 0 && record.unblockedAt > record.lastSurfacedAt;
      const surfaceReason = effectiveStatus === 'expired' ? 'expired'
        : blockedBy.length > 0 ? null
          : dependencyUnblocked ? 'dependency-unblocked'
            : overdueMs > 0 ? 'overdue'
              : dueSoon ? 'due-soon' : null;
      const risk01 = Math.min(1,
        record.priority * 0.45 +
        Math.min(1, overdueMs / (7 * 24 * 60 * 60 * 1000)) * 0.4 +
        (blockedBy.length ? 0.15 : 0));
      const cooldownElapsed = record.lastSurfacedAt === 0 || now - record.lastSurfacedAt >= cooldown;
      const shouldSurface = surfaceReason !== null && now >= quietUntil && cooldownElapsed;
      return [{
        record: structuredClone(record), effectiveStatus, blockedBy, overdueMs, risk01, shouldSurface, surfaceReason,
      }];
    }).sort((a, b) =>
      Number(b.shouldSurface) - Number(a.shouldSurface) ||
      b.risk01 - a.risk01 ||
      (a.record.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.record.dueAt ?? Number.MAX_SAFE_INTEGER));
  }

  markSurfaced(id: string): void {
    const record = this.requireActive(id);
    const candidate = this.scan({ now: this.safeNow(), reminderCooldownMs: 0 }).find(item => item.record.id === id);
    if (!candidate?.shouldSurface) throw new Error('open-loop-not-ready-to-surface');
    const now = this.safeNow();
    record.lastSurfacedAt = now;
    record.updatedAt = now;
  }

  private safeNow(): number {
    const value = this.now();
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
  }

  private requireActive(id: string): OpenLoopRecord {
    const record = this.state.records.find(item => item.id === id);
    if (!record) throw new Error('open-loop-not-found');
    if (TERMINAL.has(record.status)) throw new Error('open-loop-already-closed');
    return record;
  }

  private isSatisfied(id: string): boolean {
    const record = this.state.records.find(item => item.id === id);
    return !!record && record.status === 'fulfilled' && !!record.closureEvidence;
  }

  private reconcileDependencies(): void {
    for (const record of this.state.records) {
      if (TERMINAL.has(record.status)) continue;
      const blocked = record.dependencies.some(dependency => !this.isSatisfied(dependency));
      if (blocked && record.status !== 'blocked') {
        record.status = 'blocked';
        record.unblockedAt = 0;
        record.updatedAt = this.safeNow();
      } else if (!blocked && record.status === 'blocked') {
        const now = this.safeNow();
        record.status = 'open';
        record.unblockedAt = now;
        record.updatedAt = now;
      }
    }
  }

  private findCyclicRecords(records: Map<string, OpenLoopRecord>): Set<string> {
    const visiting = new Map<string, number>();
    const visited = new Set<string>();
    const stack: string[] = [];
    const cyclic = new Set<string>();
    const visit = (id: string): void => {
      if (visited.has(id)) return;
      const cycleStart = visiting.get(id);
      if (cycleStart !== undefined) {
        for (const member of stack.slice(cycleStart)) cyclic.add(member);
        return;
      }
      visiting.set(id, stack.length);
      stack.push(id);
      const record = records.get(id);
      for (const dependency of record?.dependencies ?? []) {
        if (records.has(dependency)) visit(dependency);
      }
      stack.pop();
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of records.keys()) visit(id);
    return cyclic;
  }
}
