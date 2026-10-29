import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { snapshotPlainData } from './LearningTrustBoundary.ts';

const ZERO_DIGEST = '0'.repeat(64);
const JOURNAL_SCHEMA_VERSION = 1 as const;
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

export type LearningFitnessDecision = 'fitness-accepted' | 'fitness-rejected';

export interface LearningFitnessSplitSummary {
  familiesEvaluated: number;
  familiesWithSufficientSeeds: number;
  seedCoverageFailures: number;
  confidenceBoundFailures: number;
  meanDelta: number | null;
  minimumLowerBound: number | null;
  maximumUpperBound: number | null;
}

export interface LearningFitnessJournalInput {
  recordedAt: number;
  candidateId: string;
  payloadFingerprint: string;
  evaluationFingerprint: string;
  planFingerprint: string;
  environmentFingerprint: string;
  decision: LearningFitnessDecision;
  reasonCodes: string[];
  matchedTrialCount: number;
  matchedValidationTrialCount: number;
  matchedHoldoutTrialCount: number;
  minimumValidationFamilies: number;
  minimumHoldoutFamilies: number;
  minimumValidationFamilyTasks: number;
  minimumHoldoutFamilyTasks: number;
  maximumValidationTaskRegression01: number;
  maximumValidationFamilyRegression01: number;
  maximumHoldoutRegression01: number;
  maximumHoldoutFamilyRegression01: number;
  minimumValidationFamilySeeds: number;
  minimumHoldoutFamilySeeds: number;
  confidenceLevel: number;
  bootstrapResamples: number;
  validation: LearningFitnessSplitSummary;
  holdout: LearningFitnessSplitSummary;
}

export interface LearningFitnessJournalEntry extends LearningFitnessJournalInput {
  schemaVersion: typeof JOURNAL_SCHEMA_VERSION;
  sequence: number;
  previousDigest: string;
  digest: string;
}

export interface LearningFitnessJournalRecentDecision {
  sequence: number;
  recordedAt: number;
  decision: LearningFitnessDecision;
  reasonCodes: string[];
  validation: Pick<LearningFitnessSplitSummary, 'meanDelta' | 'minimumLowerBound' | 'maximumUpperBound' | 'confidenceBoundFailures' | 'seedCoverageFailures'>;
  holdout: Pick<LearningFitnessSplitSummary, 'meanDelta' | 'minimumLowerBound' | 'maximumUpperBound' | 'confidenceBoundFailures' | 'seedCoverageFailures'>;
}

export interface LearningFitnessJournalDiagnostics {
  configured: true;
  available: true;
  totalDecisions: number;
  acceptedDecisions: number;
  rejectedDecisions: number;
  acceptanceRate01: number;
  rejectionCounts: Record<string, number>;
  meanValidationDelta: number | null;
  meanHoldoutDelta: number | null;
  latestValidationLowerBoundMinimum: number | null;
  latestHoldoutLowerBoundMinimum: number | null;
  lastDecisionAt: number | null;
  lastSequence: number;
  chainHead: string;
  recent: LearningFitnessJournalRecentDecision[];
}

export interface LearningFitnessJournalSink {
  /** Synchronously persist a privacy-filtered, hash-chained fitness decision. */
  recordFitnessDecision(input: LearningFitnessJournalInput): LearningFitnessJournalEntry;
  /** Optional readback for runtime metrics; implementations must never expose raw tasks/families. */
  snapshotDiagnostics?(recentLimit?: number): LearningFitnessJournalDiagnostics;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('learning-fitness-journal-value-not-json');
    return encoded;
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const row = value as Record<string, unknown>;
  return '{' + Object.keys(row).sort().map(key => JSON.stringify(key) + ':' + canonical(row[key])).join(',') + '}';
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

/** Retries of an identical gate decision do not inflate the learning trend. */
function decisionFingerprint(value: LearningFitnessJournalInput): string {
  const normalized = { ...value, recordedAt: 0 };
  return digest(normalized);
}

function decisionInputFromEntry(entry: LearningFitnessJournalEntry): LearningFitnessJournalInput {
  const {
    schemaVersion: _schemaVersion, sequence: _sequence,
    previousDigest: _previousDigest, digest: _digest, ...input
  } = entry;
  return input;
}

function safeInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
}

function safeMetric(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1);
}

function safeTolerance(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

const SPLIT_KEYS = [
  'familiesEvaluated', 'familiesWithSufficientSeeds', 'seedCoverageFailures',
  'confidenceBoundFailures', 'meanDelta', 'minimumLowerBound', 'maximumUpperBound',
] as const;

const INPUT_KEYS = [
  'recordedAt', 'candidateId', 'payloadFingerprint', 'evaluationFingerprint',
  'planFingerprint', 'environmentFingerprint', 'decision', 'reasonCodes',
  'matchedTrialCount', 'matchedValidationTrialCount', 'matchedHoldoutTrialCount',
  'minimumValidationFamilies', 'minimumHoldoutFamilies',
  'minimumValidationFamilyTasks', 'minimumHoldoutFamilyTasks',
  'maximumValidationTaskRegression01', 'maximumValidationFamilyRegression01',
  'maximumHoldoutRegression01', 'maximumHoldoutFamilyRegression01',
  'minimumValidationFamilySeeds', 'minimumHoldoutFamilySeeds',
  'confidenceLevel', 'bootstrapResamples', 'validation', 'holdout',
] as const;

const ENTRY_KEYS = [
  'schemaVersion', 'sequence', ...INPUT_KEYS, 'previousDigest', 'digest',
] as const;

function validateSplit(value: unknown): value is LearningFitnessSplitSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const split = value as Record<string, unknown>;
  return hasExactKeys(split, SPLIT_KEYS) &&
    safeInteger(split.familiesEvaluated, 10_000) &&
    safeInteger(split.familiesWithSufficientSeeds, 10_000) &&
    split.familiesWithSufficientSeeds <= split.familiesEvaluated &&
    safeInteger(split.seedCoverageFailures, 10_000) &&
    safeInteger(split.confidenceBoundFailures, 10_000) &&
    safeMetric(split.meanDelta) && safeMetric(split.minimumLowerBound) && safeMetric(split.maximumUpperBound);
}

function validateInput(value: unknown): asserts value is LearningFitnessJournalInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('learning-fitness-journal-input-invalid');
  const x = value as Record<string, unknown>;
  if (!hasExactKeys(x, INPUT_KEYS)) throw new Error('learning-fitness-journal-input-fields-invalid');
  const digestPattern = /^[a-f0-9]{64}$/;
  if (!safeInteger(x.recordedAt) || typeof x.candidateId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,255}$/.test(x.candidateId) ||
      typeof x.payloadFingerprint !== 'string' || !digestPattern.test(x.payloadFingerprint) ||
      typeof x.evaluationFingerprint !== 'string' || !digestPattern.test(x.evaluationFingerprint) ||
      typeof x.planFingerprint !== 'string' || !digestPattern.test(x.planFingerprint) ||
      typeof x.environmentFingerprint !== 'string' || !digestPattern.test(x.environmentFingerprint) ||
      !['fitness-accepted', 'fitness-rejected'].includes(String(x.decision)) ||
      !Array.isArray(x.reasonCodes) || x.reasonCodes.length > 64 ||
      x.reasonCodes.some(code => typeof code !== 'string' || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(code)) ||
      !safeInteger(x.matchedTrialCount, 1_000_000) || !safeInteger(x.matchedValidationTrialCount, 1_000_000) ||
      !safeInteger(x.matchedHoldoutTrialCount, 1_000_000) ||
      x.matchedValidationTrialCount + x.matchedHoldoutTrialCount !== x.matchedTrialCount ||
      !safeInteger(x.minimumValidationFamilies, 10_000) || x.minimumValidationFamilies < 1 ||
      !safeInteger(x.minimumHoldoutFamilies, 10_000) || x.minimumHoldoutFamilies < 1 ||
      !safeInteger(x.minimumValidationFamilyTasks, 10_000) || x.minimumValidationFamilyTasks < 1 ||
      !safeInteger(x.minimumHoldoutFamilyTasks, 10_000) || x.minimumHoldoutFamilyTasks < 1 ||
      !safeTolerance(x.maximumValidationTaskRegression01) ||
      !safeTolerance(x.maximumValidationFamilyRegression01) ||
      !safeTolerance(x.maximumHoldoutRegression01) ||
      !safeTolerance(x.maximumHoldoutFamilyRegression01) ||
      !safeInteger(x.minimumValidationFamilySeeds, 1000) || x.minimumValidationFamilySeeds < 1 ||
      !safeInteger(x.minimumHoldoutFamilySeeds, 1000) || x.minimumHoldoutFamilySeeds < 1 ||
      typeof x.confidenceLevel !== 'number' || !Number.isFinite(x.confidenceLevel) || x.confidenceLevel <= 0.5 || x.confidenceLevel >= 1 ||
      !safeInteger(x.bootstrapResamples, 50_000) || x.bootstrapResamples < 100 ||
      !validateSplit(x.validation) || !validateSplit(x.holdout)) {
    throw new Error('learning-fitness-journal-input-invalid');
  }
  if ((x.decision === 'fitness-accepted') !== (x.reasonCodes.length === 0)) {
    throw new Error('learning-fitness-journal-decision-reasons-mismatch');
  }
}

function verifyEntry(value: unknown, expectedSequence: number, expectedPrevious: string): LearningFitnessJournalEntry {
  let detached: unknown;
  try { detached = snapshotPlainData(value); }
  catch { throw new Error('learning-fitness-journal-entry-data-boundary-rejected'); }
  if (!detached || typeof detached !== 'object' || Array.isArray(detached)) throw new Error('learning-fitness-journal-entry-invalid');
  const x = detached as LearningFitnessJournalEntry;
  if (!hasExactKeys(x as unknown as Record<string, unknown>, ENTRY_KEYS)) {
    throw new Error('learning-fitness-journal-entry-fields-invalid');
  }
  const { digest: storedDigest, ...body } = x;
  if (x.schemaVersion !== JOURNAL_SCHEMA_VERSION || x.sequence !== expectedSequence ||
      x.previousDigest !== expectedPrevious || typeof storedDigest !== 'string' || !/^[a-f0-9]{64}$/.test(storedDigest)) {
    throw new Error('learning-fitness-journal-chain-invalid');
  }
  const input = { ...body } as Record<string, unknown>;
  delete input.schemaVersion; delete input.sequence; delete input.previousDigest;
  validateInput(input);
  if (digest(body) !== storedDigest) throw new Error('learning-fitness-journal-digest-mismatch');
  return x;
}

/**
 * Append-only JSONL decision journal for P23 fitness gating.
 * It records aggregate diagnostics only: never prompts, family names, task IDs,
 * or individual holdout rows. Any malformed/tampered existing chain fails closed.
 */
export class JsonlLearningFitnessJournal implements LearningFitnessJournalSink {
  private readonly filePath: string;
  private readonly maxBytes: number;
  private cache: {
    size: number; mtimeMs: number; ctimeMs: number; ino: number;
    entries: LearningFitnessJournalEntry[];
  } | null = null;

  constructor(filePath: string, maxBytes = DEFAULT_MAX_BYTES) {
    this.filePath = filePath;
    this.maxBytes = maxBytes;
    if (typeof filePath !== 'string' || !filePath.trim() || filePath.includes('\u0000') ||
        !safeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 512 * 1024 * 1024) {
      throw new Error('learning-fitness-journal-config-invalid');
    }
  }

  readAll(): LearningFitnessJournalEntry[] {
    if (!existsSync(this.filePath)) {
      this.cache = null;
      return [];
    }
    const stat = lstatSync(this.filePath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('learning-fitness-journal-file-type-invalid');
    if (stat.size > this.maxBytes) throw new Error('learning-fitness-journal-size-limit');
    if (this.cache && this.cache.size === stat.size && this.cache.mtimeMs === stat.mtimeMs &&
        this.cache.ctimeMs === stat.ctimeMs && this.cache.ino === stat.ino) {
      return this.cache.entries.map(entry => structuredClone(entry));
    }
    const text = readFileSync(this.filePath, 'utf8');
    if (text && !text.endsWith('\n')) throw new Error('learning-fitness-journal-truncated-final-line');
    const rawLines = text.split('\n');
    const lines = text ? rawLines.slice(0, -1) : [];
    if (lines.some(line => line.trim().length === 0)) throw new Error('learning-fitness-journal-blank-line');
    const entries: LearningFitnessJournalEntry[] = [];
    let previous = ZERO_DIGEST;
    for (let index = 0; index < lines.length; index++) {
      let parsed: unknown;
      try { parsed = JSON.parse(lines[index]); }
      catch { throw new Error('learning-fitness-journal-json-invalid'); }
      const entry = verifyEntry(parsed, index + 1, previous);
      entries.push(entry); previous = entry.digest;
    }
    const after = lstatSync(this.filePath);
    if (after.isSymbolicLink() || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs ||
        after.ctimeMs !== stat.ctimeMs || after.ino !== stat.ino) {
      throw new Error('learning-fitness-journal-concurrent-modification');
    }
    this.cache = {
      size: after.size, mtimeMs: after.mtimeMs, ctimeMs: after.ctimeMs, ino: after.ino,
      entries: entries.map(entry => structuredClone(entry)),
    };
    return entries.map(entry => structuredClone(entry));
  }

  snapshotDiagnostics(recentLimit = 20): LearningFitnessJournalDiagnostics {
    if (!Number.isSafeInteger(recentLimit) || recentLimit < 1 || recentLimit > 100) {
      throw new RangeError('learning-fitness-journal-diagnostics-recent-limit-invalid');
    }
    const entries = this.readAll();
    const accepted = entries.filter(entry => entry.decision === 'fitness-accepted');
    const rejected = entries.filter(entry => entry.decision === 'fitness-rejected');
    const rejectionCounts: Record<string, number> = {};
    for (const entry of rejected) {
      for (const reason of entry.reasonCodes) rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
    }
    const mean = (values: Array<number | null>) => {
      const available = values.filter((value): value is number => value !== null);
      return available.length
        ? Number((available.reduce((sum, value) => sum + value, 0) / available.length).toFixed(6))
        : null;
    };
    const last = entries[entries.length - 1] ?? null;
    const recent = entries.slice(-recentLimit).map(entry => ({
      sequence: entry.sequence,
      recordedAt: entry.recordedAt,
      decision: entry.decision,
      reasonCodes: [...entry.reasonCodes],
      validation: {
        meanDelta: entry.validation.meanDelta,
        minimumLowerBound: entry.validation.minimumLowerBound,
        maximumUpperBound: entry.validation.maximumUpperBound,
        confidenceBoundFailures: entry.validation.confidenceBoundFailures,
        seedCoverageFailures: entry.validation.seedCoverageFailures,
      },
      holdout: {
        meanDelta: entry.holdout.meanDelta,
        minimumLowerBound: entry.holdout.minimumLowerBound,
        maximumUpperBound: entry.holdout.maximumUpperBound,
        confidenceBoundFailures: entry.holdout.confidenceBoundFailures,
        seedCoverageFailures: entry.holdout.seedCoverageFailures,
      },
    }));
    return {
      configured: true,
      available: true,
      totalDecisions: entries.length,
      acceptedDecisions: accepted.length,
      rejectedDecisions: rejected.length,
      acceptanceRate01: entries.length ? Number((accepted.length / entries.length).toFixed(6)) : 0,
      rejectionCounts: Object.fromEntries(Object.entries(rejectionCounts).sort(([a], [b]) => a.localeCompare(b))),
      meanValidationDelta: mean(entries.map(entry => entry.validation.meanDelta)),
      meanHoldoutDelta: mean(entries.map(entry => entry.holdout.meanDelta)),
      latestValidationLowerBoundMinimum: last?.validation.minimumLowerBound ?? null,
      latestHoldoutLowerBoundMinimum: last?.holdout.minimumLowerBound ?? null,
      lastDecisionAt: last?.recordedAt ?? null,
      lastSequence: last?.sequence ?? 0,
      chainHead: last?.digest ?? ZERO_DIGEST,
      recent,
    };
  }

  recordFitnessDecision(rawInput: LearningFitnessJournalInput): LearningFitnessJournalEntry {
    let detached: unknown;
    try { detached = snapshotPlainData(rawInput); }
    catch { throw new Error('learning-fitness-journal-input-data-boundary-rejected'); }
    validateInput(detached);
    mkdirSync(dirname(this.filePath), { recursive: true });
    const lockPath = this.filePath + '.lock';
    let lockFd: number | null = null;
    let fileFd: number | null = null;
    try {
      try { lockFd = openSync(lockPath, 'wx', 0o600); }
      catch { throw new Error('learning-fitness-journal-write-lock-held'); }
      writeFileSync(lockFd, String(process.pid), 'utf8');
      fsyncSync(lockFd);
      const existing = this.readAll();
      const fingerprint = decisionFingerprint(detached as LearningFitnessJournalInput);
      const duplicate = existing.find(entry => decisionFingerprint(decisionInputFromEntry(entry)) === fingerprint);
      if (duplicate) return structuredClone(duplicate);
      const prior = existing[existing.length - 1];
      const body = {
        schemaVersion: JOURNAL_SCHEMA_VERSION,
        sequence: existing.length + 1,
        ...(detached as LearningFitnessJournalInput),
        previousDigest: prior?.digest ?? ZERO_DIGEST,
      };
      const entry: LearningFitnessJournalEntry = { ...body, digest: digest(body) };
      const line = JSON.stringify(entry) + '\n';
      const existingBytes = existsSync(this.filePath) ? lstatSync(this.filePath).size : 0;
      if (existingBytes + Buffer.byteLength(line, 'utf8') > this.maxBytes) throw new Error('learning-fitness-journal-size-limit');
      if (existsSync(this.filePath) && lstatSync(this.filePath).isSymbolicLink()) throw new Error('learning-fitness-journal-file-type-invalid');
      fileFd = openSync(this.filePath, 'a', 0o600);
      writeFileSync(fileFd, line, 'utf8');
      fsyncSync(fileFd);
      const after = lstatSync(this.filePath);
      if (after.isSymbolicLink() || !after.isFile() || after.size !== existingBytes + Buffer.byteLength(line, 'utf8')) {
        this.cache = null;
        throw new Error('learning-fitness-journal-append-not-atomic');
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
        unlinkSync(lockPath);
      }
    }
  }
}
