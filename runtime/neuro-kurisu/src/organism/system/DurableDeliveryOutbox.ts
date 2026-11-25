import { randomUUID } from 'node:crypto';
import { types as nodeUtilTypes } from 'node:util';

export type DurableDeliveryStatus = 'pending' | 'leased' | 'delivered' | 'cancelled' | 'dead-letter';
export type DurableDeliveryKind = 'task-completion' | 'initiative-message' | 'reminder' | 'notification' | 'custom';

export interface DurableDeliveryRecord {
  id: string;
  dedupeKey: string;
  kind: DurableDeliveryKind;
  payloadRef: string;
  sourceTaskId: string | null;
  initiativeId: string | null;
  decisionId: string | null;
  consentScopeVersion: string | null;
  createdAt: number;
  nextAttemptAt: number;
  expiresAt: number | null;
  attemptCount: number;
  status: DurableDeliveryStatus;
  leaseOwner: string | null;
  leaseUntil: number;
  deliveredAt: number | null;
  lastErrorCode: string | null;
}

export interface DurableDeliveryOutboxState {
  version: 1;
  sequence: number;
  records: DurableDeliveryRecord[];
}

export interface DurableDeliveryEnqueueInput {
  dedupeKey: string;
  kind: DurableDeliveryKind;
  /** Opaque host-owned pointer. Raw prompts, messages, credentials and file contents are forbidden. */
  payloadRef: string;
  sourceTaskId?: string | null;
  initiativeId?: string | null;
  decisionId?: string | null;
  consentScopeVersion?: string | null;
  expiresAt?: number | null;
  id?: string;
}

export interface DurableDeliveryEnqueueResult {
  record: DurableDeliveryRecord;
  duplicate: boolean;
}

export interface DurableDeliveryOutboxOptions {
  maxRecords?: number;
  maxAttempts?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
}

const MAX_RECORDS = 2048;
const MAX_ATTEMPTS = 8;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 60 * 60_000;
const MAX_LEASE_MS = 30 * 60_000;
const STATUSES = new Set<DurableDeliveryStatus>(['pending', 'leased', 'delivered', 'cancelled', 'dead-letter']);
const KINDS = new Set<DurableDeliveryKind>(['task-completion', 'initiative-message', 'reminder', 'notification', 'custom']);

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownValue(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor) return undefined;
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) throw new Error('delivery-outbox-accessor-rejected');
  return descriptor.value;
}

function safeText(value: unknown, max: number, required = false): string | null {
  if (value == null && !required) return null;
  if (typeof value !== 'string') throw new Error('delivery-outbox-string-invalid');
  const clean = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!clean || clean.length > max) throw new Error('delivery-outbox-string-bounds');
  return clean;
}

function safeTime(value: unknown, nullable = false): number | null {
  if (nullable && value == null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('delivery-outbox-time-invalid');
  return value;
}

function safeCounter(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new Error('delivery-outbox-counter-invalid');
  }
  return value;
}

function cloneRecord(record: DurableDeliveryRecord): DurableDeliveryRecord {
  return { ...record };
}

function terminal(status: DurableDeliveryStatus): boolean {
  return status === 'delivered' || status === 'cancelled' || status === 'dead-letter';
}

/**
 * Durable delivery obligations, not a transport or executor.
 *
 * The host owns recipient resolution, consent/quiet-hours policy and the actual send.
 * A successful send must be acknowledged only after authoritative recipient acceptance.
 * Ambiguous ActionGateway outcomes must be reconciled before retrying the outbox item.
 */
export class DurableDeliveryOutbox {
  private state: DurableDeliveryOutboxState = { version: 1, sequence: 0, records: [] };
  readonly maxRecords: number;
  readonly maxAttempts: number;
  readonly retryBaseMs: number;
  readonly retryMaxMs: number;

  constructor(options: DurableDeliveryOutboxOptions = {}) {
    this.maxRecords = options.maxRecords ?? MAX_RECORDS;
    this.maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
    this.retryBaseMs = options.retryBaseMs ?? RETRY_BASE_MS;
    this.retryMaxMs = options.retryMaxMs ?? RETRY_MAX_MS;
    if (!Number.isSafeInteger(this.maxRecords) || this.maxRecords < 1 || this.maxRecords > 8192) throw new Error('delivery-outbox-max-records-invalid');
    if (!Number.isSafeInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 32) throw new Error('delivery-outbox-max-attempts-invalid');
    if (!Number.isSafeInteger(this.retryBaseMs) || this.retryBaseMs < 100 || this.retryBaseMs > 60_000) throw new Error('delivery-outbox-retry-base-invalid');
    if (!Number.isSafeInteger(this.retryMaxMs) || this.retryMaxMs < this.retryBaseMs || this.retryMaxMs > 24 * 60 * 60_000) throw new Error('delivery-outbox-retry-max-invalid');
  }

  snapshot(): DurableDeliveryOutboxState {
    return { version: 1, sequence: this.state.sequence, records: this.state.records.map(cloneRecord) };
  }

  restore(raw?: unknown): void {
    if (raw == null) {
      this.state = { version: 1, sequence: 0, records: [] };
      return;
    }
    if (!plainRecord(raw)) throw new Error('delivery-outbox-state-invalid');
    if (ownValue(raw, 'version') !== 1) throw new Error('delivery-outbox-version-unsupported');
    const sequence = safeCounter(ownValue(raw, 'sequence'), Number.MAX_SAFE_INTEGER);
    const rows = ownValue(raw, 'records');
    if (!Array.isArray(rows) || nodeUtilTypes.isProxy(rows) || rows.length > this.maxRecords) throw new Error('delivery-outbox-records-invalid');
    const ids = new Set<string>();
    const dedupeKeys = new Set<string>();
    const records: DurableDeliveryRecord[] = [];
    for (const row of rows) {
      if (!plainRecord(row)) throw new Error('delivery-outbox-record-invalid');
      const id = safeText(ownValue(row, 'id'), 180, true)!;
      const dedupeKey = safeText(ownValue(row, 'dedupeKey'), 180, true)!;
      const kind = ownValue(row, 'kind');
      const status = ownValue(row, 'status');
      if (!KINDS.has(kind as DurableDeliveryKind) || !STATUSES.has(status as DurableDeliveryStatus)) throw new Error('delivery-outbox-enum-invalid');
      if (ids.has(id) || dedupeKeys.has(dedupeKey)) throw new Error('delivery-outbox-duplicate-identity');
      ids.add(id);
      dedupeKeys.add(dedupeKey);
      const leaseOwner = safeText(ownValue(row, 'leaseOwner'), 120);
      const leaseUntil = safeTime(ownValue(row, 'leaseUntil'))!;
      const deliveredAt = safeTime(ownValue(row, 'deliveredAt'), true);
      if (status === 'leased' && (!leaseOwner || leaseUntil <= 0)) throw new Error('delivery-outbox-lease-invalid');
      if (status !== 'leased' && (leaseOwner !== null || leaseUntil !== 0)) throw new Error('delivery-outbox-stale-lease');
      if (status === 'delivered' && deliveredAt === null) throw new Error('delivery-outbox-delivery-receipt-missing');
      if (status !== 'delivered' && deliveredAt !== null) throw new Error('delivery-outbox-delivery-receipt-unexpected');
      records.push({
        id,
        dedupeKey,
        kind: kind as DurableDeliveryKind,
        payloadRef: safeText(ownValue(row, 'payloadRef'), 240, true)!,
        sourceTaskId: safeText(ownValue(row, 'sourceTaskId'), 180),
        initiativeId: safeText(ownValue(row, 'initiativeId'), 180),
        decisionId: safeText(ownValue(row, 'decisionId'), 180),
        consentScopeVersion: safeText(ownValue(row, 'consentScopeVersion'), 120),
        createdAt: safeTime(ownValue(row, 'createdAt'))!,
        nextAttemptAt: safeTime(ownValue(row, 'nextAttemptAt'))!,
        expiresAt: safeTime(ownValue(row, 'expiresAt'), true),
        attemptCount: safeCounter(ownValue(row, 'attemptCount'), this.maxAttempts),
        status: status as DurableDeliveryStatus,
        leaseOwner,
        leaseUntil,
        deliveredAt,
        lastErrorCode: safeText(ownValue(row, 'lastErrorCode'), 80),
      });
    }
    this.state = { version: 1, sequence, records };
  }

  enqueue(input: DurableDeliveryEnqueueInput, at = Date.now()): DurableDeliveryEnqueueResult {
    if (!input || typeof input !== 'object') throw new Error('delivery-outbox-input-invalid');
    if (!Number.isSafeInteger(at) || at < 0) throw new Error('delivery-outbox-time-invalid');
    const dedupeKey = safeText(input.dedupeKey, 180, true)!;
    const existing = this.state.records.find(record => record.dedupeKey === dedupeKey);
    if (existing) return { record: cloneRecord(existing), duplicate: true };
    if (!KINDS.has(input.kind)) throw new Error('delivery-outbox-kind-invalid');
    const payloadRef = safeText(input.payloadRef, 240, true)!;
    const expiresAt = input.expiresAt === undefined ? null : safeTime(input.expiresAt, true);
    if (expiresAt !== null && expiresAt <= at) throw new Error('delivery-outbox-expiry-not-future');
    this.pruneTerminalRecords();
    if (this.state.records.length >= this.maxRecords) throw new Error('delivery-outbox-capacity-reached');
    const id = safeText(input.id ?? randomUUID(), 180, true)!;
    if (this.state.records.some(record => record.id === id)) throw new Error('delivery-outbox-id-conflict');
    this.state.sequence += 1;
    const record: DurableDeliveryRecord = {
      id,
      dedupeKey,
      kind: input.kind,
      payloadRef,
      sourceTaskId: safeText(input.sourceTaskId, 180),
      initiativeId: safeText(input.initiativeId, 180),
      decisionId: safeText(input.decisionId, 180),
      consentScopeVersion: safeText(input.consentScopeVersion, 120),
      createdAt: at,
      nextAttemptAt: at,
      expiresAt,
      attemptCount: 0,
      status: 'pending',
      leaseOwner: null,
      leaseUntil: 0,
      deliveredAt: null,
      lastErrorCode: null,
    };
    this.state.records.push(record);
    return { record: cloneRecord(record), duplicate: false };
  }

  pendingCandidate(at = Date.now()): DurableDeliveryRecord | null {
    if (!Number.isSafeInteger(at) || at < 0) throw new Error('delivery-outbox-time-invalid');
    const candidate = this.state.records
      .filter(record => record.status === 'pending' && record.nextAttemptAt <= at && (record.expiresAt === null || record.expiresAt > at))
      .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt || a.createdAt - b.createdAt || a.id.localeCompare(b.id))[0];
    return candidate ? cloneRecord(candidate) : null;
  }

  reapExpiredLeases(at = Date.now()): number {
    if (!Number.isSafeInteger(at) || at < 0) throw new Error('delivery-outbox-time-invalid');
    let changed = 0;
    for (const record of this.state.records) {
      if (record.expiresAt !== null && record.expiresAt <= at && !terminal(record.status)) {
        record.status = 'cancelled';
        record.lastErrorCode = 'delivery-expired';
        this.clearLease(record);
        changed += 1;
        continue;
      }
      if (record.status === 'leased' && record.leaseUntil <= at) {
        this.clearLease(record);
        if (record.attemptCount >= this.maxAttempts) {
          record.status = 'dead-letter';
          record.lastErrorCode = 'delivery-lease-expired';
        } else {
          record.status = 'pending';
          record.nextAttemptAt = at;
          record.lastErrorCode = 'delivery-lease-expired';
        }
        changed += 1;
      }
    }
    return changed;
  }

  claim(id: string, leaseOwner: string, at = Date.now(), leaseMs = 30_000): DurableDeliveryRecord | null {
    const safeId = safeText(id, 180, true)!;
    const owner = safeText(leaseOwner, 120, true)!;
    if (!Number.isSafeInteger(at) || at < 0 || !Number.isSafeInteger(leaseMs) || leaseMs < 1000 || leaseMs > MAX_LEASE_MS) {
      throw new Error('delivery-outbox-lease-bounds');
    }
    this.reapExpiredLeases(at);
    const record = this.state.records.find(item => item.id === safeId);
    if (!record || record.status !== 'pending' || record.nextAttemptAt > at || (record.expiresAt !== null && record.expiresAt <= at)) return null;
    record.status = 'leased';
    record.leaseOwner = owner;
    record.leaseUntil = at + leaseMs;
    record.attemptCount = Math.min(this.maxAttempts, record.attemptCount + 1);
    return cloneRecord(record);
  }

  claimNext(leaseOwner: string, at = Date.now(), leaseMs = 30_000): DurableDeliveryRecord | null {
    const candidate = this.pendingCandidate(at);
    return candidate ? this.claim(candidate.id, leaseOwner, at, leaseMs) : null;
  }

  acknowledge(id: string, leaseOwner: string, deliveredAt = Date.now()): boolean {
    const record = this.leasedRecord(id, leaseOwner);
    if (!record || !Number.isSafeInteger(deliveredAt) || deliveredAt < 0 || record.leaseUntil <= deliveredAt) return false;
    record.status = 'delivered';
    record.deliveredAt = deliveredAt;
    record.lastErrorCode = null;
    this.clearLease(record);
    return true;
  }

  recordFailure(id: string, leaseOwner: string, errorCode: string, attemptedAt = Date.now()): boolean {
    const record = this.leasedRecord(id, leaseOwner);
    if (!record || !Number.isSafeInteger(attemptedAt) || attemptedAt < 0 || record.leaseUntil <= attemptedAt) return false;
    record.lastErrorCode = safeText(errorCode, 80, true)!;
    this.clearLease(record);
    if (record.expiresAt !== null && record.expiresAt <= attemptedAt) {
      record.status = 'cancelled';
      record.lastErrorCode = 'delivery-expired';
      return true;
    }
    if (record.attemptCount >= this.maxAttempts) {
      record.status = 'dead-letter';
      return true;
    }
    const exponent = Math.min(20, Math.max(0, record.attemptCount - 1));
    const delay = Math.min(this.retryMaxMs, this.retryBaseMs * (2 ** exponent));
    record.status = 'pending';
    record.nextAttemptAt = attemptedAt + delay;
    return true;
  }

  cancel(id: string, reasonCode: string): boolean {
    const record = this.state.records.find(item => item.id === id);
    if (!record || record.status !== 'pending') return false;
    record.status = 'cancelled';
    record.lastErrorCode = safeText(reasonCode, 80, true)!;
    return true;
  }

  get(id: string): DurableDeliveryRecord | null {
    const record = this.state.records.find(item => item.id === id);
    return record ? cloneRecord(record) : null;
  }

  diagnostics() {
    const counts = { pending: 0, leased: 0, delivered: 0, cancelled: 0, deadLetter: 0 };
    let attempts = 0;
    for (const record of this.state.records) {
      if (record.status === 'dead-letter') counts.deadLetter += 1;
      else counts[record.status] += 1;
      attempts += record.attemptCount;
    }
    return {
      version: 1 as const,
      total: this.state.records.length,
      ...counts,
      attempts,
      capacity: this.maxRecords,
      maxAttempts: this.maxAttempts,
    };
  }

  private leasedRecord(id: string, leaseOwner: string): DurableDeliveryRecord | null {
    const safeId = safeText(id, 180, true)!;
    const owner = safeText(leaseOwner, 120, true)!;
    const record = this.state.records.find(item => item.id === safeId);
    return record && record.status === 'leased' && record.leaseOwner === owner ? record : null;
  }

  private clearLease(record: DurableDeliveryRecord): void {
    record.leaseOwner = null;
    record.leaseUntil = 0;
  }

  private pruneTerminalRecords(): void {
    if (this.state.records.length < this.maxRecords) return;
    const terminalRows = this.state.records.filter(record => terminal(record.status)).sort((a, b) => a.createdAt - b.createdAt);
    while (this.state.records.length >= this.maxRecords && terminalRows.length > 0) {
      const candidate = terminalRows.shift()!;
      const index = this.state.records.findIndex(record => record.id === candidate.id);
      if (index >= 0) this.state.records.splice(index, 1);
    }
  }
}
