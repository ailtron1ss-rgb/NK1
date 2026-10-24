import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { snapshotPlainData } from './LearningTrustBoundary.ts';

const ZERO_DIGEST = '0'.repeat(64);
const SCHEMA_VERSION = 1 as const;
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;

export type LearningLifecycleEventKind =
  | 'promotion-rejected'
  | 'activation-intent'
  | 'activation-confirmed'
  | 'activation-failed'
  | 'activation-outcome-unknown'
  | 'activation-reconciled-active'
  | 'activation-reconciled-not-currently-active';

export interface LearningLifecycleEventInput {
  recordedAt: number;
  attemptId: string;
  candidateId: string;
  skillId: string;
  candidateVersion: number;
  payloadFingerprint: string;
  evaluationFingerprint: string;
  planFingerprint: string;
  environmentFingerprint: string;
  event: LearningLifecycleEventKind;
  reasonCodes: string[];
  activatedVersion: number | null;
}

export interface LearningLifecycleEventEntry extends LearningLifecycleEventInput {
  schemaVersion: typeof SCHEMA_VERSION;
  sequence: number;
  previousDigest: string;
  digest: string;
}

export interface LearningLifecycleJournalRecentEvent {
  sequence: number;
  recordedAt: number;
  attemptId: string;
  event: LearningLifecycleEventKind;
  skillId: string;
  candidateVersion: number;
  activatedVersion: number | null;
  reasonCodes: string[];
}

export interface LearningLifecycleJournalDiagnostics {
  configured: true;
  available: true;
  eventCount: number;
  promotionRejectedCount: number;
  activationIntentCount: number;
  activationConfirmedCount: number;
  activationFailedCount: number;
  activationOutcomeUnknownCount: number;
  activationReconciledActiveCount: number;
  activationReconciledNotCurrentlyActiveCount: number;
  pendingActivationCount: number;
  latestEventAt: number | null;
  lastSequence: number;
  chainHead: string;
  recent: LearningLifecycleJournalRecentEvent[];
}

/** Resolve a distinct JSONL sibling without ever reusing the organism state file. */
export function learningLifecycleJournalPathForStateFile(stateFile: string): string {
  if (typeof stateFile !== 'string' || !stateFile.trim() || stateFile.includes('\u0000')) {
    throw new Error('learning-lifecycle-journal-state-path-invalid');
  }
  return stateFile.toLowerCase().endsWith('.json')
    ? stateFile.replace(/\.json$/i, '.learning-lifecycle.jsonl')
    : `${stateFile}.learning-lifecycle.jsonl`;
}

export interface LearningLifecycleJournalSink {
  /** Persist an exact, privacy-filtered lifecycle transition. */
  recordLifecycleEvent(input: LearningLifecycleEventInput): LearningLifecycleEventEntry;
  /** Aggregates only; no payloads, prompts, task rows, or raw receipts. */
  snapshotDiagnostics?(recentLimit?: number): LearningLifecycleJournalDiagnostics;
  readAll?(): LearningLifecycleEventEntry[];
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('learning-lifecycle-journal-value-not-json');
    return encoded;
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const row = value as Record<string, unknown>;
  return '{' + Object.keys(row).sort().map(key => JSON.stringify(key) + ':' + canonical(row[key])).join(',') + '}';
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function safeCounter(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
}

function safeDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

const INPUT_KEYS = [
  'recordedAt', 'attemptId', 'candidateId', 'skillId', 'candidateVersion',
  'payloadFingerprint', 'evaluationFingerprint', 'planFingerprint',
  'environmentFingerprint', 'event', 'reasonCodes', 'activatedVersion',
] as const;
const ENTRY_KEYS = ['schemaVersion', 'sequence', ...INPUT_KEYS, 'previousDigest', 'digest'] as const;
const EVENT_KINDS: readonly LearningLifecycleEventKind[] = [
  'promotion-rejected', 'activation-intent', 'activation-confirmed', 'activation-failed', 'activation-outcome-unknown',
  'activation-reconciled-active', 'activation-reconciled-not-currently-active',
];

function validateInput(raw: unknown): asserts raw is LearningLifecycleEventInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('learning-lifecycle-journal-input-invalid');
  }
  const value = raw as Record<string, unknown>;
  if (!exactKeys(value, INPUT_KEYS) ||
      !safeCounter(value.recordedAt, 1) ||
      typeof value.attemptId !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.attemptId) ||
      typeof value.candidateId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,255}$/.test(value.candidateId) ||
      typeof value.skillId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,255}$/.test(value.skillId) ||
      !safeCounter(value.candidateVersion, 1, 1_000_000_000) ||
      !safeDigest(value.payloadFingerprint) || !safeDigest(value.evaluationFingerprint) ||
      !safeDigest(value.planFingerprint) || !safeDigest(value.environmentFingerprint) ||
      !EVENT_KINDS.includes(value.event as LearningLifecycleEventKind) ||
      !Array.isArray(value.reasonCodes) || value.reasonCodes.length > 16 ||
      value.reasonCodes.some(code => typeof code !== 'string' || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(code)) ||
      !(value.activatedVersion === null || safeCounter(value.activatedVersion, 1, 1_000_000_000))) {
    throw new Error('learning-lifecycle-journal-input-invalid');
  }
  const event = value.event as LearningLifecycleEventKind;
  const reasons = value.reasonCodes as string[];
  const version = value.activatedVersion as number | null;
  if ((event === 'activation-intent' && (version !== null || reasons.length !== 0)) ||
      (event === 'activation-confirmed' && (version === null || reasons.length !== 0)) ||
      ((event === 'promotion-rejected' || event === 'activation-failed' || event === 'activation-outcome-unknown' || event === 'activation-reconciled-not-currently-active') && (version !== null || reasons.length === 0)) ||
      ((event === 'activation-reconciled-active') && (version === null || reasons.length !== 0))) {
    throw new Error('learning-lifecycle-journal-event-shape-invalid');
  }
}

function inputFromEntry(entry: LearningLifecycleEventEntry): LearningLifecycleEventInput {
  const { schemaVersion: _schema, sequence: _sequence, previousDigest: _previous, digest: _digest, ...input } = entry;
  return input;
}

function eventFingerprint(input: LearningLifecycleEventInput): string {
  return hash({ ...input, recordedAt: 0 });
}

function sameAttemptIdentity(a: LearningLifecycleEventInput, b: LearningLifecycleEventInput): boolean {
  return a.attemptId === b.attemptId && a.candidateId === b.candidateId &&
    a.skillId === b.skillId && a.candidateVersion === b.candidateVersion &&
    a.payloadFingerprint === b.payloadFingerprint &&
    a.evaluationFingerprint === b.evaluationFingerprint &&
    a.planFingerprint === b.planFingerprint &&
    a.environmentFingerprint === b.environmentFingerprint;
}

function validateTransition(entries: readonly LearningLifecycleEventEntry[], next: LearningLifecycleEventInput, allowIdenticalDuplicate = true): void {
  const prior = entries.map(entry => inputFromEntry(entry)).filter(input => input.attemptId === next.attemptId);
  if (prior.some(input => !sameAttemptIdentity(input, next))) {
    throw new Error('learning-lifecycle-journal-attempt-identity-conflict');
  }
  const duplicate = prior.find(input => input.event === next.event);
  if (duplicate) {
    if (eventFingerprint(duplicate) !== eventFingerprint(next)) {
      throw new Error('learning-lifecycle-journal-event-conflict');
    }
    if (!allowIdenticalDuplicate) throw new Error('learning-lifecycle-journal-duplicate-chain-event');
    return;
  }
  const terminal = prior.some(input =>
    input.event === 'promotion-rejected' || input.event === 'activation-confirmed' || input.event === 'activation-failed' || input.event === 'activation-reconciled-active' || input.event === 'activation-reconciled-not-currently-active');
  if (terminal) throw new Error('learning-lifecycle-journal-terminal-attempt');
  if (next.event === 'promotion-rejected' || next.event === 'activation-intent') {
    if (prior.length !== 0) throw new Error('learning-lifecycle-journal-transition-invalid');
    return;
  }
  if (next.event === 'activation-reconciled-active' || next.event === 'activation-reconciled-not-currently-active') {
    const crashAfterIntent = prior.length === 1 && prior[0].event === 'activation-intent';
    const explicitUnknown = prior.length === 2 &&
      prior[0].event === 'activation-intent' && prior[1].event === 'activation-outcome-unknown';
    if (!crashAfterIntent && !explicitUnknown) {
      throw new Error('learning-lifecycle-journal-transition-invalid');
    }
    return;
  }
  if (prior.length === 2 && prior[0].event === 'activation-intent' && prior[1].event === 'activation-outcome-unknown') {
    throw new Error('learning-lifecycle-journal-reconciliation-required');
  }
  if (prior.length !== 1 || prior[0].event !== 'activation-intent') {
    throw new Error('learning-lifecycle-journal-transition-invalid');
  }
}

function verifyEntry(raw: unknown, sequence: number, previousDigest: string): LearningLifecycleEventEntry {
  let detached: unknown;
  try { detached = snapshotPlainData(raw); }
  catch { throw new Error('learning-lifecycle-journal-entry-data-boundary-rejected'); }
  if (!detached || typeof detached !== 'object' || Array.isArray(detached)) {
    throw new Error('learning-lifecycle-journal-entry-invalid');
  }
  const value = detached as LearningLifecycleEventEntry;
  if (!exactKeys(value as unknown as Record<string, unknown>, ENTRY_KEYS)) {
    throw new Error('learning-lifecycle-journal-entry-fields-invalid');
  }
  const { digest: storedDigest, ...body } = value;
  if (value.schemaVersion !== SCHEMA_VERSION || value.sequence !== sequence ||
      value.previousDigest !== previousDigest || !safeDigest(storedDigest)) {
    throw new Error('learning-lifecycle-journal-chain-invalid');
  }
  const input = { ...body } as Record<string, unknown>;
  delete input.schemaVersion;
  delete input.sequence;
  delete input.previousDigest;
  validateInput(input);
  if (hash(body) !== storedDigest) throw new Error('learning-lifecycle-journal-digest-mismatch');
  return value;
}

/**
 * Durable append-only lifecycle evidence for the final P23 activation boundary.
 * The intent is written before activation; a missing terminal event leaves an
 * explicit pending attempt instead of falsely asserting activation or failure.
 */
export class JsonlLearningLifecycleJournal implements LearningLifecycleJournalSink {
  private readonly filePath: string;
  private readonly maxBytes: number;
  private cache: { size: number; mtimeMs: number; ctimeMs: number; ino: number; entries: LearningLifecycleEventEntry[] } | null = null;

  constructor(filePath: string, maxBytes = DEFAULT_MAX_BYTES) {
    this.filePath = filePath;
    this.maxBytes = maxBytes;
    if (typeof filePath !== 'string' || !filePath.trim() || filePath.includes('\u0000') ||
        !safeCounter(maxBytes, 1024, 256 * 1024 * 1024)) {
      throw new Error('learning-lifecycle-journal-config-invalid');
    }
  }

  readAll(): LearningLifecycleEventEntry[] {
    if (!existsSync(this.filePath)) {
      this.cache = null;
      return [];
    }
    const stat = lstatSync(this.filePath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('learning-lifecycle-journal-file-type-invalid');
    if (stat.size > this.maxBytes) throw new Error('learning-lifecycle-journal-size-limit');
    if (this.cache && this.cache.size === stat.size && this.cache.mtimeMs === stat.mtimeMs &&
        this.cache.ctimeMs === stat.ctimeMs && this.cache.ino === stat.ino) {
      return this.cache.entries.map(entry => structuredClone(entry));
    }
    const text = readFileSync(this.filePath, 'utf8');
    if (text && !text.endsWith('\n')) throw new Error('learning-lifecycle-journal-truncated-final-line');
    const lines = text ? text.slice(0, -1).split('\n') : [];
    if (lines.some(line => line.trim().length === 0)) throw new Error('learning-lifecycle-journal-blank-line');
    const entries: LearningLifecycleEventEntry[] = [];
    let previous = ZERO_DIGEST;
    for (let index = 0; index < lines.length; index++) {
      let parsed: unknown;
      try { parsed = JSON.parse(lines[index]); }
      catch { throw new Error('learning-lifecycle-journal-json-invalid'); }
      const entry = verifyEntry(parsed, index + 1, previous);
      validateTransition(entries, inputFromEntry(entry), false);
      entries.push(entry);
      previous = entry.digest;
    }
    const after = lstatSync(this.filePath);
    if (after.isSymbolicLink() || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs ||
        after.ctimeMs !== stat.ctimeMs || after.ino !== stat.ino) {
      throw new Error('learning-lifecycle-journal-concurrent-modification');
    }
    this.cache = {
      size: after.size, mtimeMs: after.mtimeMs, ctimeMs: after.ctimeMs, ino: after.ino,
      entries: entries.map(entry => structuredClone(entry)),
    };
    return entries.map(entry => structuredClone(entry));
  }

  recordLifecycleEvent(raw: LearningLifecycleEventInput): LearningLifecycleEventEntry {
    let detached: unknown;
    try { detached = snapshotPlainData(raw); }
    catch { throw new Error('learning-lifecycle-journal-input-data-boundary-rejected'); }
    validateInput(detached);
    mkdirSync(dirname(this.filePath), { recursive: true });
    const lockPath = this.filePath + '.lock';
    let lockFd: number | null = null;
    let fileFd: number | null = null;
    try {
      try { lockFd = openSync(lockPath, 'wx', 0o600); }
      catch { throw new Error('learning-lifecycle-journal-write-lock-held'); }
      writeFileSync(lockFd, String(process.pid), 'utf8');
      fsyncSync(lockFd);
      const existing = this.readAll();
      validateTransition(existing, detached as LearningLifecycleEventInput);
      const fingerprint = eventFingerprint(detached as LearningLifecycleEventInput);
      const duplicate = existing.find(entry =>
        entry.attemptId === (detached as LearningLifecycleEventInput).attemptId &&
        entry.event === (detached as LearningLifecycleEventInput).event);
      if (duplicate) {
        if (eventFingerprint(inputFromEntry(duplicate)) !== fingerprint) {
          throw new Error('learning-lifecycle-journal-event-conflict');
        }
        return structuredClone(duplicate);
      }
      const previous = existing[existing.length - 1];
      const body = {
        schemaVersion: SCHEMA_VERSION,
        sequence: existing.length + 1,
        ...(detached as LearningLifecycleEventInput),
        previousDigest: previous?.digest ?? ZERO_DIGEST,
      };
      const entry: LearningLifecycleEventEntry = { ...body, digest: hash(body) };
      const line = JSON.stringify(entry) + '\n';
      const existingBytes = existsSync(this.filePath) ? lstatSync(this.filePath).size : 0;
      const lineBytes = Buffer.byteLength(line, 'utf8');
      if (existingBytes + lineBytes > this.maxBytes) throw new Error('learning-lifecycle-journal-size-limit');
      if (existsSync(this.filePath) && lstatSync(this.filePath).isSymbolicLink()) {
        throw new Error('learning-lifecycle-journal-file-type-invalid');
      }
      fileFd = openSync(this.filePath, 'a', 0o600);
      writeFileSync(fileFd, line, 'utf8');
      fsyncSync(fileFd);
      const after = lstatSync(this.filePath);
      if (after.isSymbolicLink() || !after.isFile() || after.size !== existingBytes + lineBytes) {
        this.cache = null;
        throw new Error('learning-lifecycle-journal-append-not-atomic');
      }
      this.cache = {
        size: after.size, mtimeMs: after.mtimeMs, ctimeMs: after.ctimeMs, ino: after.ino,
        entries: [...existing, entry].map(row => structuredClone(row)),
      };
      return entry;
    } finally {
      if (fileFd !== null) closeSync(fileFd);
      if (lockFd !== null) {
        closeSync(lockFd);
        rmSync(lockPath, { force: true });
      }
    }
  }

  snapshotDiagnostics(recentLimit = 20): LearningLifecycleJournalDiagnostics {
    if (!Number.isSafeInteger(recentLimit) || recentLimit < 1 || recentLimit > 100) {
      throw new RangeError('learning-lifecycle-journal-diagnostics-recent-limit-invalid');
    }
    const entries = this.readAll();
    const inputs = entries.map(entry => inputFromEntry(entry));
    const terminalAttemptIds = new Set(inputs.filter(input =>
      input.event === 'promotion-rejected' || input.event === 'activation-confirmed' || input.event === 'activation-failed' || input.event === 'activation-reconciled-active' || input.event === 'activation-reconciled-not-currently-active',
    ).map(input => input.attemptId));
    const last = entries[entries.length - 1] ?? null;
    return {
      configured: true,
      available: true,
      eventCount: entries.length,
      promotionRejectedCount: inputs.filter(input => input.event === 'promotion-rejected').length,
      activationIntentCount: inputs.filter(input => input.event === 'activation-intent').length,
      activationConfirmedCount: inputs.filter(input => input.event === 'activation-confirmed').length,
      activationFailedCount: inputs.filter(input => input.event === 'activation-failed').length,
      activationOutcomeUnknownCount: inputs.filter(input => input.event === 'activation-outcome-unknown').length,
      activationReconciledActiveCount: inputs.filter(input => input.event === 'activation-reconciled-active').length,
      activationReconciledNotCurrentlyActiveCount: inputs.filter(input => input.event === 'activation-reconciled-not-currently-active').length,
      pendingActivationCount: inputs.filter(input => input.event === 'activation-intent' && !terminalAttemptIds.has(input.attemptId)).length,
      latestEventAt: last?.recordedAt ?? null,
      lastSequence: last?.sequence ?? 0,
      chainHead: last?.digest ?? ZERO_DIGEST,
      recent: entries.slice(-recentLimit).map(entry => ({
        sequence: entry.sequence,
        recordedAt: entry.recordedAt,
        attemptId: entry.attemptId,
        event: entry.event,
        skillId: entry.skillId,
        candidateVersion: entry.candidateVersion,
        activatedVersion: entry.activatedVersion,
        reasonCodes: [...entry.reasonCodes],
      })),
    };
  }
}
