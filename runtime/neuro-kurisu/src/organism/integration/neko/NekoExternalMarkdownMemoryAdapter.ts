import { createHash } from 'node:crypto';
import { types as nodeUtilTypes } from 'node:util';
import type { MemoryFabric, MemoryLifecycleEncodeInput } from '../../memory/MemoryFabric.ts';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 2_048;
const MAX_PATH_CHARS = 1_024;
const MAX_PATH_SEGMENTS = 32;
const MAX_ENTRIES = 1_000;
const MAX_ENTRY_CHARS = 8_000;
const MAX_SECTION_CHARS = 500;
const MAX_PREVIEWS = 8;
const PREVIEW_TTL_MS = 30 * 60 * 1_000;

export type NekoMarkdownSourceKind = 'user' | 'soul' | 'memory' | 'daily';
export type NekoMarkdownMemoryKind = 'social' | 'identity' | 'semantic' | 'episodic';
export type NekoMarkdownReviewStatus = 'ready' | 'quarantined';

export interface NekoMarkdownImportFile {
  path?: string;
  name?: string;
  content: string;
}

export interface NekoMarkdownImportCandidate {
  id: string;
  sourceFile: string;
  sourceSection: string;
  sourceKind: NekoMarkdownSourceKind;
  memoryKind: NekoMarkdownMemoryKind;
  target: 'user' | 'persona' | 'facts';
  eventDate?: string;
  text: string;
  warningPatterns: string[];
  reviewStatus: NekoMarkdownReviewStatus;
  epistemicStatus: 'unknown';
}

export interface NekoMarkdownImportPreview {
  importId: string;
  sourceFormat: 'openclaw' | 'hermes';
  files: string[];
  createdAt: number;
  candidates: NekoMarkdownImportCandidate[];
  warningCount: number;
}

export interface NekoMarkdownImportRejection {
  candidateId: string;
  code: string;
}

export interface NekoMarkdownImportCommitResult {
  importId: string;
  committed: Array<{ candidateId: string; memoryId: string }>;
  rejected: NekoMarkdownImportRejection[];
}

export interface NekoExternalMarkdownMemoryAdapterOptions {
  /** Inject the existing canonical lifecycle boundary; no parallel memory store is created. */
  memory: Pick<MemoryFabric, 'encode'>;
  now?: () => number;
}

export interface NekoMarkdownCommitOptions {
  /** Tick is audit metadata only; no tick is inferred from imported text. */
  tick?: number;
  /** Per-candidate manual override after inspecting a quarantined preview entry. */
  allowSuspiciousIds?: readonly string[];
}

interface ParsedFile {
  path: string;
  content: string;
  bytes: number;
  kind: NekoMarkdownSourceKind;
  eventDate?: string;
}

interface StoredPreview {
  preview: NekoMarkdownImportPreview;
  candidates: Map<string, NekoMarkdownImportCandidate>;
}

const INVALID = Symbol('invalid-json');
const ROOT_FILES = new Set(['USER.MD', 'SOUL.MD', 'MEMORY.MD']);
const DAILY_PATH = /^memor(?:y|ies)\/(\d{4}-\d{2}-\d{2})(?:-[^/]+)?\.md$/i;
const DAILY_BASENAME = /^(\d{4}-\d{2}-\d{2})(?:-[^/]+)?\.md$/i;
const HEADING = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const LIST_ITEM = /^\s{0,3}(?:[-+*]|\d+[.)])\s+(.+?)\s*$/;
const FIELD = /^\*{0,2}([^:*]{1,80})\*{0,2}\s*:\s*(.+)$/;
const HERMES_DELIMITER = /^\s*§\s*$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
const INJECTION_PATTERNS: Array<[string, RegExp]> = [
  ['role_marker', /^\s*(?:system|developer|assistant|user)\s*[:：]/imu],
  ['chatml_token', /<\|(?:im_start|im_end|endoftext)\|>/iu],
  ['ignore_previous', /\b(?:ignore|disregard)\b.{0,40}\b(?:previous|prior|above)\b.{0,30}\b(?:instructions?|prompts?|rules?)\b/iu],
  ['ignore_previous_zh', /(?:忽略|无视|無視|不要理会|不要理會)(?:以上|上述|之前).{0,12}(?:指令|提示|规则|規則|设定|設定)/u],
];

function fail(message: string): never {
  throw new Error(message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownDataRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | null {
  if (!isPlainObject(value)) return null;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > allowedKeys.length) return null;
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== 'string' || !allowedKeys.includes(key) ||
          key === '__proto__' || key === 'prototype' || key === 'constructor') return null;
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function safeFileArray(input: unknown): unknown[] {
  if (!Array.isArray(input) || nodeUtilTypes.isProxy(input)) return fail('Unsafe file records: expected a plain array');
  let prototype: object | null;
  let descriptors: Record<string, PropertyDescriptor>;
  let length: number;
  try {
    prototype = Object.getPrototypeOf(input);
    descriptors = Object.getOwnPropertyDescriptors(input) as Record<string, PropertyDescriptor>;
    length = descriptors.length?.value;
  } catch {
    return fail('Unsafe file records: invalid array');
  }
  if (prototype !== Array.prototype) return fail('Unsafe file records: expected a plain array');
  if (!Number.isSafeInteger(length) || length < 0) return fail('Unsafe file records: invalid array length');
  if (length > MAX_FILES) return fail('Too many files in Markdown import');
  if (Reflect.ownKeys(descriptors).length !== length + 1) return fail('Unsafe file records: sparse or malformed array');

  const output: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
        descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) {
      return fail('Unsafe file record: accessor or sparse entry');
    }
    output.push(descriptor.value);
  }
  return output;
}
function normalizePath(raw: string): string {
  const path = raw.replace(/\\/g, '/').trim();
  if (!path || path.startsWith('/') || /^[a-z]:\//i.test(path) || CONTROL.test(path)) {
    return fail('Unsafe path in Markdown import');
  }
  const parts = path.split('/').filter(part => part !== '' && part !== '.');
  if (!parts.length || parts.length > MAX_PATH_SEGMENTS || parts.some(part => part === '..')) return fail('Unsafe path in Markdown import');
  return parts.join('/');
}

function classifyPath(path: string): { kind: NekoMarkdownSourceKind; eventDate?: string } | null {
  const parts = path.split('/');
  const basename = parts[parts.length - 1] ?? '';
  if (ROOT_FILES.has(basename.toUpperCase())) {
    const kind = basename.toUpperCase().slice(0, -3).toLowerCase() as NekoMarkdownSourceKind;
    return { kind };
  }
  const lower = path.toLowerCase();
  const marker = Math.max(lower.lastIndexOf('/memory/'), lower.lastIndexOf('/memories/'));
  const relative = marker >= 0 ? path.slice(marker + 1) : path;
  const daily = DAILY_PATH.exec(relative) ?? (parts.length === 1 ? DAILY_BASENAME.exec(basename) : null);
  if (!daily) return null;
  return { kind: 'daily', eventDate: daily[1] };
}

function decodeFiles(input: unknown): ParsedFile[] {
  const rows = safeFileArray(input);
  const parsed: ParsedFile[] = [];
  let totalBytes = 0;
  for (const raw of rows) {
    const row = ownDataRecord(raw, ['path', 'name', 'content']);
    if (!row) return fail('Unsafe file record: expected own data properties only');
    const rawPath = typeof row.path === 'string' ? row.path : row.name;
    if (typeof rawPath !== 'string') return fail('Invalid Markdown file path');
    const path = normalizePath(rawPath);
    const classification = classifyPath(path);
    if (!classification) continue;
    if (typeof row.content !== 'string') return fail(`Markdown content must be text: ${path}`);
    const bytes = Buffer.byteLength(row.content, 'utf8');
    if (bytes > MAX_FILE_BYTES) return fail(`Markdown file is too large: ${path}`);
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES) return fail('Markdown payload is too large');
    if (classification.eventDate) {
      const parsedDate = new Date(`${classification.eventDate}T00:00:00.000Z`);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== classification.eventDate) {
        return fail(`Invalid daily-memory date in path: ${path}`);
      }
    }
    parsed.push({
      path,
      content: row.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
      bytes,
      ...classification,
    });
  }
  if (!parsed.length) return fail('No supported USER.md, SOUL.md, MEMORY.md or memory(ies)/YYYY-MM-DD*.md files found');
  return parsed;
}

function stripFencedCode(text: string): string {
  const output: string[] = [];
  let fenced = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      fenced = !fenced;
      continue;
    }
    if (!fenced) output.push(line);
  }
  return output.join('\n');
}

function cleanFragment(value: string): string {
  let text = value.trim();
  const field = FIELD.exec(text);
  if (field) text = `${field[1].trim()}: ${field[2].trim()}`;
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  return text.split('\n').map(line => line.trimEnd()).join('\n').trim();
}

function splitLongFragment(value: string): string[] {
  if (value.length <= MAX_ENTRY_CHARS) return [value];
  const result: string[] = [];
  let remaining = value;
  while (remaining.length) {
    let cut = Math.min(MAX_ENTRY_CHARS, remaining.length);
    if (cut < remaining.length) {
      const boundary = Math.max(remaining.lastIndexOf('\n', cut), remaining.lastIndexOf('. ', cut));
      if (boundary >= MAX_ENTRY_CHARS / 2) cut = boundary + 1;
    }
    result.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  return result.filter(Boolean);
}

function splitMarkdownEntries(text: string, hermesDelimiter: boolean): Array<{ section: string; text: string }> {
  if (hermesDelimiter) {
    const stripped = stripFencedCode(text);
    if (stripped.split('\n').some(line => HERMES_DELIMITER.test(line))) {
      return stripped.split('\n').reduce<string[][]>((blocks, line) => {
        if (HERMES_DELIMITER.test(line)) blocks.push([]);
        else blocks[blocks.length - 1]!.push(line);
        return blocks;
      }, [[]]).flatMap(block => splitLongFragment(cleanFragment(block.join('\n'))).map(piece => ({ section: '', text: piece })));
    }
  }

  const entries: Array<{ section: string; text: string }> = [];
  const headings: string[] = [];
  let paragraph: string[] = [];
  let fenced = false;
  const flush = () => {
    if (!paragraph.length) return;
    const raw = cleanFragment(paragraph.join('\n'));
    paragraph = [];
    for (const piece of splitLongFragment(raw)) if (piece) entries.push({ section: headings.join(' / '), text: piece });
  };
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      headings.splice(level - 1);
      headings.push(cleanFragment(heading[2]).replace(/\s+/gu, ' '));
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flush();
      for (const piece of splitLongFragment(cleanFragment(item[1]))) {
        if (piece) entries.push({ section: headings.join(' / '), text: piece });
      }
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return entries;
}

function candidateText(section: string, value: string): string {
  const text = cleanFragment(value);
  const boundedSection = section.slice(0, MAX_SECTION_CHARS);
  if (!boundedSection || boundedSection.toLocaleLowerCase().includes(text.toLocaleLowerCase())) return text;
  const prefix = `${boundedSection}: `.slice(0, Math.max(0, MAX_ENTRY_CHARS - text.length));
  return `${prefix}${text}`;
}

function normalizedText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
}

function suspiciousPatterns(text: string): string[] {
  return INJECTION_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceFormat(files: ParsedFile[]): 'openclaw' | 'hermes' {
  return files.some(file =>
    file.path.toLowerCase().includes('.hermes') ||
    file.path.toLowerCase().includes('/memories/') ||
    file.content.split('\n').some(line => HERMES_DELIMITER.test(line)),
  ) ? 'hermes' : 'openclaw';
}

function memoryKind(sourceKind: NekoMarkdownSourceKind): NekoMarkdownMemoryKind {
  if (sourceKind === 'user') return 'social';
  if (sourceKind === 'soul') return 'semantic';
  if (sourceKind === 'daily') return 'episodic';
  return 'semantic';
}

function targetKind(sourceKind: NekoMarkdownSourceKind): NekoMarkdownImportCandidate['target'] {
  if (sourceKind === 'user') return 'user';
  if (sourceKind === 'soul') return 'persona';
  return 'facts';
}

export class NekoExternalMarkdownMemoryAdapter {
  private readonly memory: Pick<MemoryFabric, 'encode'>;
  private readonly now: () => number;
  private readonly previews = new Map<string, StoredPreview>();

  constructor(options: NekoExternalMarkdownMemoryAdapterOptions) {
    if (!options?.memory || typeof options.memory.encode !== 'function') {
      throw new Error('neko-markdown-import-canonical-memory-fabric-required');
    }
    this.memory = options.memory;
    this.now = options.now ?? Date.now;
  }

  preview(input: unknown): NekoMarkdownImportPreview {
    const files = decodeFiles(input);
    const format = sourceFormat(files);
    const sortedFingerprints = files
      .map(file => `${file.path}\0${digest(file.content)}`)
      .sort()
      .join('\n');
    const importId = digest(`${format}\n${sortedFingerprints}`);
    const candidates: NekoMarkdownImportCandidate[] = [];
    const seen = new Set<string>();

    for (const file of files) {
      const hermesDelimiter = format === 'hermes' && file.kind !== 'soul';
      for (const fragment of splitMarkdownEntries(file.content, hermesDelimiter)) {
        const text = candidateText(fragment.section, fragment.text);
        if (!text) continue;
        const dedupeKey = `${file.kind}| ${normalizedText(text)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        const warnings = suspiciousPatterns(text);
        const id = digest(`${file.path}\0${file.kind}\0${file.eventDate ?? ''}\0${normalizedText(text)}`);
        candidates.push({
          id,
          sourceFile: file.path,
          sourceSection: fragment.section.slice(0, MAX_SECTION_CHARS),
          sourceKind: file.kind,
          memoryKind: memoryKind(file.kind),
          target: targetKind(file.kind),
          ...(file.eventDate ? { eventDate: file.eventDate } : {}),
          text,
          warningPatterns: warnings,
          reviewStatus: warnings.length ? 'quarantined' : 'ready',
          epistemicStatus: 'unknown',
        });
        if (candidates.length > MAX_ENTRIES) return fail('External memory contains too many entries');
      }
    }
    if (!candidates.length) return fail('Supported Markdown files did not contain importable text');

    const createdAt = this.now();
    const preview: NekoMarkdownImportPreview = {
      importId,
      sourceFormat: format,
      files: files.map(file => file.path),
      createdAt,
      candidates,
      warningCount: candidates.reduce((count, candidate) => count + (candidate.warningPatterns.length ? 1 : 0), 0),
    };
    this.previews.delete(importId);
    this.previews.set(importId, {
      preview,
      candidates: new Map(candidates.map(candidate => [candidate.id, structuredClone(candidate)])),
    });
    while (this.previews.size > MAX_PREVIEWS) {
      const oldest = this.previews.keys().next().value;
      if (oldest === undefined) break;
      this.previews.delete(oldest);
    }
    return structuredClone(preview);
  }

  commit(importId: string, approvedCandidateIds: readonly string[], options: NekoMarkdownCommitOptions = {}): NekoMarkdownImportCommitResult {
    const stored = this.previews.get(importId);
    if (!stored || this.now() - stored.preview.createdAt > PREVIEW_TTL_MS) {
      this.previews.delete(importId);
      return fail('Markdown import preview not found or expired');
    }
    if (!Array.isArray(approvedCandidateIds) || approvedCandidateIds.length > MAX_ENTRIES) {
      return fail('Invalid approved candidate selection');
    }
    const allowSuspicious = new Set(options.allowSuspiciousIds ?? []);
    if (allowSuspicious.size > MAX_ENTRIES || [...allowSuspicious].some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) {
      return fail('Invalid suspicious-candidate override list');
    }
    const tick = options.tick === undefined ? 0 : options.tick;
    if (!Number.isSafeInteger(tick) || tick < 0) return fail('Invalid memory lifecycle tick');

    const committed: NekoMarkdownImportCommitResult['committed'] = [];
    const rejected: NekoMarkdownImportRejection[] = [];
    const seen = new Set<string>();
    for (const id of approvedCandidateIds) {
      if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id) || !stored.candidates.has(id)) {
        rejected.push({ candidateId: String(id).slice(0, 80), code: 'candidate-not-in-preview' });
        continue;
      }
      if (seen.has(id)) {
        rejected.push({ candidateId: id, code: 'duplicate-selection' });
        continue;
      }
      seen.add(id);
      const candidate = stored.candidates.get(id)!;
      if (candidate.warningPatterns.length && !allowSuspicious.has(id)) {
        rejected.push({ candidateId: id, code: 'suspicious-candidate-requires-explicit-override' });
        continue;
      }

      const observedAt = candidate.eventDate
        ? Date.parse(`${candidate.eventDate}T12:00:00.000Z`)
        : stored.preview.createdAt;
      const input: MemoryLifecycleEncodeInput = {
        content: candidate.text,
        kind: candidate.memoryKind,
        tags: ['external-import', 'neko-markdown', `neko:${candidate.sourceKind}`, 'unverified-import'],
        context: {
          externalImport: 'neko-markdown',
          sourceFormat: stored.preview.sourceFormat,
          sourceKind: candidate.sourceKind,
          sourceFile: candidate.sourceFile,
          sourceSection: candidate.sourceSection.slice(0, MAX_SECTION_CHARS),
          target: candidate.target,
          ...(candidate.eventDate ? { eventDate: candidate.eventDate } : {}),
        },
        salience: 0.42,
        emotionalWeight: 0,
        identityRelevance: candidate.memoryKind === 'identity' ? 0.45 : 0.15,
        goalRelevance: 0.12,
        socialRelevance: candidate.memoryKind === 'social' ? 0.42 : 0.12,
        predictionError: 0,
        confidence: 0.35,
        epistemicStatus: 'unknown',
        source: `neko-markdown-import:${candidate.sourceKind}`,
        entities: [],
        semanticLinks: [],
        temporalLinks: [],
        causalLinks: [],
        contradictionLinks: [],
        provenanceClass: 'external',
        sourceAuthority01: 0.42,
        independenceKey: `neko-md:${candidate.id.slice(0, 64)}`,
        observedAt,
        evidenceFreshnessAt: observedAt,
        evidenceSources: [{
          source: `neko-markdown:${candidate.sourceFile}`,
          provenanceClass: 'external',
          sourceAuthority01: 0.42,
          independenceKey: `neko-md:${candidate.id.slice(0, 64)}`,
          observedAt,
          evidenceFreshnessAt: observedAt,
        }],
      };
      try {
        const item = this.memory.encode(input, {
          commandId: `neko-md:${stored.preview.importId.slice(0, 24)}:${candidate.id.slice(0, 48)}`,
          tick,
        });
        committed.push({ candidateId: id, memoryId: item.id });
      } catch {
        rejected.push({ candidateId: id, code: 'canonical-memory-write-failed' });
      }
    }
    return { importId, committed, rejected };
  }

  discard(importId: string): boolean {
    return this.previews.delete(importId);
  }

  diagnostics() {
    return {
      pendingPreviews: this.previews.size,
      maxPreviews: MAX_PREVIEWS,
      previewTtlMs: PREVIEW_TTL_MS,
      candidateLimit: MAX_ENTRIES,
      previewOnlyByDefault: true as const,
      canonicalMemoryOwner: 'MemoryFabric/MemoryOS2' as const,
    };
  }
}
