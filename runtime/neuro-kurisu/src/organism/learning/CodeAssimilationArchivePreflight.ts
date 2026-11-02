import { createHash } from 'node:crypto';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';
import { normalizeCodeAssimilationCandidate, type CodeAssimilationCandidate } from './CodeAssimilationContracts.ts';

export type CodeAssimilationArchiveEntryKind =
  | 'file'
  | 'directory'
  | 'symlink'
  | 'hardlink'
  | 'fifo'
  | 'block-device'
  | 'character-device';

export interface CodeAssimilationArchiveEntryInput {
  path: string;
  kind: CodeAssimilationArchiveEntryKind;
  compressedSizeBytes: number;
  uncompressedSizeBytes: number;
}

export interface CodeAssimilationArchivePreflightLimits {
  maxArchiveBytes: number;
  maxEntries: number;
  maxFiles: number;
  maxDirectories: number;
  maxPathLength: number;
  maxPathDepth: number;
  maxFileBytes: number;
  maxTotalExpandedBytes: number;
  maxCompressionRatio: number;
  maxNestedArchives: number;
}

export interface CodeAssimilationCanonicalArchiveEntry {
  readonly path: string;
  readonly kind: 'file' | 'directory';
  readonly compressedSizeBytes: number;
  readonly uncompressedSizeBytes: number;
}

export interface CodeAssimilationArchivePreflightInput {
  candidate: CodeAssimilationCandidate;
  /** SHA-256 of the exact archive bytes, verified by the caller before parsing. */
  archiveSha256: string;
  /** Actual byte length of the downloaded archive, not an HTTP Content-Length claim. */
  archiveBytes: number;
  parserId: string;
  parserVersion: string;
  entries: unknown;
  /** Caller may lower, but never raise, any host default limit. */
  limits?: Partial<CodeAssimilationArchivePreflightLimits>;
}

export interface CodeAssimilationArchivePreflightReport {
  readonly schemaVersion: 1;
  readonly accepted: true;
  readonly candidateId: string;
  readonly candidateFingerprint: string;
  readonly sourceFingerprint: string;
  readonly archiveSha256: string;
  readonly archiveBytes: number;
  readonly parserId: string;
  readonly parserVersion: string;
  readonly limits: Readonly<CodeAssimilationArchivePreflightLimits>;
  readonly entryCount: number;
  readonly fileCount: number;
  readonly directoryCount: number;
  readonly nestedArchiveCount: number;
  readonly totalCompressedBytes: number;
  readonly totalUncompressedBytes: number;
  readonly entries: readonly CodeAssimilationCanonicalArchiveEntry[];
  readonly treeFingerprint: string;
  readonly reportFingerprint: string;
}

const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DEFAULT_LIMITS: Readonly<CodeAssimilationArchivePreflightLimits> = Object.freeze({
  maxArchiveBytes: 200 * 1024 * 1024,
  maxEntries: 25_000,
  maxFiles: 20_000,
  maxDirectories: 10_000,
  maxPathLength: 512,
  maxPathDepth: 32,
  maxFileBytes: 64 * 1024 * 1024,
  maxTotalExpandedBytes: 512 * 1024 * 1024,
  maxCompressionRatio: 200,
  maxNestedArchives: 0,
});
const LIMIT_KEYS = Object.keys(DEFAULT_LIMITS) as Array<keyof CodeAssimilationArchivePreflightLimits>;
const BLOCKED_ENTRY_KINDS = new Set<CodeAssimilationArchiveEntryKind>([
  'symlink', 'hardlink', 'fifo', 'block-device', 'character-device',
]);
const NESTED_ARCHIVE_SUFFIXES = [
  '.tar.gz', '.tar.bz2', '.tar.xz', '.tar.zst',
  '.zip', '.tar', '.tgz', '.tbz2', '.txz', '.7z', '.rar',
  '.jar', '.war', '.ear', '.whl', '.egg', '.apk', '.deb',
  '.gz', '.bz2', '.xz', '.zst',
];
const RESERVED_WINDOWS_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function fail(code: string): never {
  throw new Error(`code-assimilation-archive-${code}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (actual.length !== allowed.length || actual.some((key, index) => key !== allowed[index])) {
    fail(`${label}-shape-invalid`);
  }
}

function safeText(value: unknown, label: string, max = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max ||
      value.trim() !== value || value.normalize('NFKC') !== value ||
      Array.from(value).some(character => {
        const point = character.codePointAt(0) ?? 0;
        return point <= 0x1f || (point >= 0x7f && point <= 0x9f);
      })) {
    fail(`${label}-invalid`);
  }
  return value;
}

function safeBytes(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail(`${label}-size-invalid`);
  }
  return value;
}

function safeLimit(value: unknown, key: keyof CodeAssimilationArchivePreflightLimits): number {
  const baseline = DEFAULT_LIMITS[key];
  const minimum = key === 'maxNestedArchives' ? 0 : Number.MIN_VALUE;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) && key !== 'maxCompressionRatio' ||
      !Number.isFinite(value) || value < minimum || value > baseline) {
    fail(`limit-${key}-invalid-or-weakened`);
  }
  return value;
}

function normalizeLimits(raw: unknown): CodeAssimilationArchivePreflightLimits {
  const result = { ...DEFAULT_LIMITS };
  if (raw === undefined) return result;
  if (!isRecord(raw)) fail('limits-invalid');
  const allowed = new Set<string>(LIMIT_KEYS);
  for (const key of Object.keys(raw)) if (!allowed.has(key)) fail('limits-shape-invalid');
  for (const key of LIMIT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      result[key] = safeLimit(raw[key], key);
    }
  }
  return result;
}

function canonicalArchivePath(raw: unknown, kind: 'file' | 'directory', limits: CodeAssimilationArchivePreflightLimits): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > limits.maxPathLength * 2) {
    fail('path-invalid');
  }
  if (raw.includes('\\')) fail('path-backslash-invalid');
  if (raw.startsWith('/') || raw.startsWith('\\\\') || /^[A-Za-z]:/.test(raw)) fail('path-absolute-invalid');
  if (Array.from(raw).some(character => {
    const point = character.codePointAt(0) ?? 0;
    return point <= 0x1f || (point >= 0x7f && point <= 0x9f);
  })) fail('path-control-character-invalid');

  let normalized = raw.normalize('NFKC');
  // NFKC can turn compatibility characters (for example U+FF3C FULLWIDTH REVERSE SOLIDUS)
  // into a Windows path separator. Recheck after normalization, not only on raw input.
  if (normalized.includes('\\')) fail('path-backslash-invalid');
  if (kind === 'directory' && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  if (normalized.length === 0 || normalized.length > limits.maxPathLength ||
      normalized.startsWith('/') || normalized.endsWith('/') || normalized.includes('//')) {
    fail('path-shape-invalid');
  }
  const segments = normalized.split('/');
  if (segments.length > limits.maxPathDepth) fail('path-depth-limit');
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') fail('path-traversal-invalid');
    if (segment.endsWith('.') || segment.endsWith(' ')) fail('path-windows-canonicalization-invalid');
    if (/[:<>"|?*]/.test(segment)) fail('path-platform-special-character-invalid');
    if (RESERVED_WINDOWS_NAME.test(segment)) fail('path-reserved-device-name-invalid');
    if (/^(?:\.git|\.hg|\.svn)$/i.test(segment)) fail('path-vcs-metadata-forbidden');
  }
  return normalized;
}

function isNestedArchive(path: string): boolean {
  const lowered = path.toLowerCase();
  return NESTED_ARCHIVE_SUFFIXES.some(suffix => lowered.endsWith(suffix));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function addSafe(total: number, next: number, label: string): number {
  const sum = total + next;
  if (!Number.isSafeInteger(sum)) fail(`${label}-overflow`);
  return sum;
}

function normalizeEntry(raw: unknown, limits: CodeAssimilationArchivePreflightLimits): CodeAssimilationCanonicalArchiveEntry {
  if (!isRecord(raw)) fail('entry-invalid');
  exactKeys(raw, ['path', 'kind', 'compressedSizeBytes', 'uncompressedSizeBytes'], 'entry');
  if (raw.kind !== 'file' && raw.kind !== 'directory' &&
      !BLOCKED_ENTRY_KINDS.has(raw.kind as CodeAssimilationArchiveEntryKind)) {
    fail('entry-kind-invalid');
  }
  if (BLOCKED_ENTRY_KINDS.has(raw.kind as CodeAssimilationArchiveEntryKind)) {
    fail('non-regular-entry-forbidden');
  }
  const kind = raw.kind as 'file' | 'directory';
  const path = canonicalArchivePath(raw.path, kind, limits);
  const compressedSizeBytes = safeBytes(raw.compressedSizeBytes, 'compressed');
  const uncompressedSizeBytes = safeBytes(raw.uncompressedSizeBytes, 'uncompressed');

  if (kind === 'directory' && (compressedSizeBytes !== 0 || uncompressedSizeBytes !== 0)) {
    fail('directory-size-invalid');
  }
  if (kind === 'file') {
    if (uncompressedSizeBytes > limits.maxFileBytes) fail('file-size-limit');
    if (compressedSizeBytes === 0 && uncompressedSizeBytes > 0) fail('zero-compressed-size');
    if (compressedSizeBytes > 0 &&
        uncompressedSizeBytes / compressedSizeBytes > limits.maxCompressionRatio) {
      fail('compression-ratio-limit');
    }
  }
  return { path, kind, compressedSizeBytes, uncompressedSizeBytes };
}

function validateHierarchy(entries: readonly CodeAssimilationCanonicalArchiveEntry[]): void {
  const byPath = new Map(entries.map(entry => [entry.path, entry.kind] as const));
  for (const entry of entries) {
    const segments = entry.path.split('/');
    for (let depth = 1; depth < segments.length; depth++) {
      const parent = segments.slice(0, depth).join('/');
      if (byPath.get(parent) === 'file') fail('file-parent-conflict');
    }
  }
}

export function preflightCodeAssimilationArchive(
  rawInput: CodeAssimilationArchivePreflightInput,
): CodeAssimilationArchivePreflightReport {
  let detached: unknown;
  try {
    detached = snapshotPlainData(rawInput, {
      maxDepth: 16,
      maxNodes: 100_000,
      maxStringUnits: 2_000_000,
    });
  } catch {
    fail('input-untrusted');
  }
  if (!isRecord(detached)) fail('input-invalid');
  const expectedKeys = [
    'candidate', 'archiveSha256', 'archiveBytes', 'parserId', 'parserVersion', 'entries',
  ];
  if (Object.prototype.hasOwnProperty.call(detached, 'limits')) expectedKeys.push('limits');
  exactKeys(detached, expectedKeys, 'input');

  let candidate: CodeAssimilationCandidate;
  try { candidate = normalizeCodeAssimilationCandidate(detached.candidate); }
  catch { fail('candidate-invalid'); }
  if (!['archive', 'user-upload'].includes(candidate.manifest.source.sourceKind)) {
    fail('source-kind-not-archive');
  }
  const archiveSha256 = detached.archiveSha256;
  if (typeof archiveSha256 !== 'string' || !SHA256.test(archiveSha256)) fail('archive-digest-invalid');
  if (archiveSha256 !== candidate.manifest.source.contentSha256) fail('archive-digest-mismatch');

  const limits = normalizeLimits(detached.limits);
  const archiveBytes = safeBytes(detached.archiveBytes, 'archive');
  if (archiveBytes <= 0) fail('archive-size-invalid');
  if (archiveBytes > limits.maxArchiveBytes) fail('archive-size-limit');
  const parserId = safeText(detached.parserId, 'parser-id', 128);
  const parserVersion = safeText(detached.parserVersion, 'parser-version', 64);
  if (!SAFE_ID.test(parserId) || !/^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/.test(parserVersion)) {
    fail('parser-identity-invalid');
  }
  if (!Array.isArray(detached.entries) || detached.entries.length === 0) fail('entries-invalid');
  if (detached.entries.length > limits.maxEntries) fail('entry-count-limit');

  const normalized = detached.entries.map(entry => normalizeEntry(entry, limits));
  const byPath = new Set<string>();
  const byFoldedPath = new Set<string>();
  let fileCount = 0;
  let directoryCount = 0;
  let nestedArchiveCount = 0;
  let totalCompressedBytes = 0;
  let totalUncompressedBytes = 0;

  for (const entry of normalized) {
    if (byPath.has(entry.path)) fail('duplicate-normalized-path');
    byPath.add(entry.path);
    const folded = entry.path.toLowerCase();
    if (byFoldedPath.has(folded)) fail('duplicate-casefold-path');
    byFoldedPath.add(folded);
    if (entry.kind === 'file') {
      fileCount++;
      if (isNestedArchive(entry.path)) nestedArchiveCount++;
      totalCompressedBytes = addSafe(totalCompressedBytes, entry.compressedSizeBytes, 'compressed-total');
      totalUncompressedBytes = addSafe(totalUncompressedBytes, entry.uncompressedSizeBytes, 'expanded-total');
    } else {
      directoryCount++;
    }
  }
  if (fileCount > limits.maxFiles) fail('file-count-limit');
  if (directoryCount > limits.maxDirectories) fail('directory-count-limit');
  if (nestedArchiveCount > limits.maxNestedArchives) fail('nested-archive-forbidden');
  if (totalUncompressedBytes > limits.maxTotalExpandedBytes) fail('expanded-size-limit');
  if (totalCompressedBytes > archiveBytes) fail('archive-size-mismatch');

  validateHierarchy(normalized);
  normalized.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

  // Freeze all nested report data before calculating its fingerprint. A consumer must not
  // be able to mutate accepted paths or limits while retaining a stale report fingerprint.
  const immutableEntries = Object.freeze(
    normalized.map(entry => Object.freeze({ ...entry })),
  );
  const immutableLimits = Object.freeze({ ...limits });
  const treeMaterial = {
    archiveSha256,
    entries: immutableEntries,
  };
  const treeFingerprint = sha256(canonicalJson(treeMaterial));
  const reportMaterial = Object.freeze({
    schemaVersion: 1 as const,
    accepted: true as const,
    candidateId: candidate.candidateId,
    candidateFingerprint: candidate.candidateFingerprint,
    sourceFingerprint: candidate.sourceFingerprint,
    archiveSha256,
    archiveBytes,
    parserId,
    parserVersion,
    limits: immutableLimits,
    entryCount: immutableEntries.length,
    fileCount,
    directoryCount,
    nestedArchiveCount,
    totalCompressedBytes,
    totalUncompressedBytes,
    entries: immutableEntries,
    treeFingerprint,
  });
  return Object.freeze({
    ...reportMaterial,
    reportFingerprint: sha256(canonicalJson(reportMaterial)),
  });
}
