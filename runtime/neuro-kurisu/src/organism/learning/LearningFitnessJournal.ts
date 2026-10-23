import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  minimumPairedSeedsPerFamily: number;
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

export interface LearningFitnessJournalSink {
  /** Synchronously persist a privacy-filtered, hash-chained fitness decision. */
  recordFitnessDecision(input: LearningFitnessJournalInput): LearningFitnessJournalEntry;
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

function safeInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
}

function safeMetric(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1);
}

function validateSplit(value: unknown): value is LearningFitnessSplitSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const split = value as Record<string, unknown>;
  return safeInteger(split.familiesEvaluated, 10_000) &&
    safeInteger(split.familiesWithSufficientSeeds, 10_000) &&
    split.familiesWithSufficientSeeds <= split.familiesEvaluated &&
    safeInteger(split.seedCoverageFailures, 10_000) &&
    safeInteger(split.confidenceBoundFailures, 10_000) &&
    safeMetric(split.meanDelta) && safeMetric(split.minimumLowerBound) && safeMetric(split.maximumUpperBound);
}

function validateInput(value: unknown): asserts value is LearningFitnessJournalInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('learning-fitness-journal-input-invalid');
  const x = value as Record<string, unknown>;
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
      !safeInteger(x.minimumPairedSeedsPerFamily, 1000) || x.minimumPairedSeedsPerFamily < 1 ||
      typeof x.confidenceLevel !== 'number' || !Number.isFinite(x.confidenceLevel) || x.confidenceLevel <= 0.5 || x.confidenceLevel >= 1 ||
      !safeInteger(x.bootstrapResamples, 50_000) || x.bootstrapResamples < 100 ||
      !validateSplit(x.validation) || !validateSplit(x.holdout)) {
    throw new Error('learning-fitness-journal-input-invalid');
  }
  if ((x.decision === 'fitness-accepted') !== (x.reasonCodes.length === 0)) {
    throw new Error('learning-fitness-journal-decision-reasons-mismatch');
  }
}

function entryBody(entry: LearningFitnessJournalEntry): Omit<LearningFitnessJournalEntry, 'digest'> {
  const { digest: _digest, ...body } = entry;
  return body;
}

function verifyEntry(value: unknown, expectedSequence: number, expectedPrevious: string): LearningFitnessJournalEntry {
  let detached: unknown;
  try { detached = snapshotPlainData(value); }
  catch { throw new Error('learning-fitness-journal-entry-data-boundary-rejected'); }
  if (!detached || typeof detached !== 'object' || Array.isArray(detached)) throw new Error('learning-fitness-journal-entry-invalid');
  const x = detached as LearningFitnessJournalEntry;
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
  constructor(private readonly filePath: string, private readonly maxBytes = DEFAULT_MAX_BYTES) {
    if (typeof filePath !== 'string' || !filePath.trim() || filePath.includes('\u0000') ||
        !safeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 512 * 1024 * 1024) {
      throw new Error('learning-fitness-journal-config-invalid');
    }
  }

  readAll(): LearningFitnessJournalEntry[] {
    if (!existsSync(this.filePath)) return [];
    const stat = lstatSync(this.filePath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('learning-fitness-journal-file-type-invalid');
    if (stat.size > this.maxBytes) throw new Error('learning-fitness-journal-size-limit');
    const text = readFileSync(this.filePath, 'utf8');
    if (text && !text.endsWith('\n')) throw new Error('learning-fitness-journal-truncated-final-line');
    const lines = text.split('\n').filter(line => line.length > 0);
    const entries: LearningFitnessJournalEntry[] = [];
    let previous = ZERO_DIGEST;
    for (let index = 0; index < lines.length; index++) {
      let parsed: unknown;
      try { parsed = JSON.parse(lines[index]); }
      catch { throw new Error('learning-fitness-journal-json-invalid'); }
      const entry = verifyEntry(parsed, index + 1, previous);
      entries.push(entry); previous = entry.digest;
    }
    return entries;
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
      return entry;
    } finally {
      if (fileFd !== null) closeSync(fileFd);
      if (lockFd !== null) {
        closeSync(lockFd);
        rmSync(lockPath, { force: true });
      }
    }
  }
}
