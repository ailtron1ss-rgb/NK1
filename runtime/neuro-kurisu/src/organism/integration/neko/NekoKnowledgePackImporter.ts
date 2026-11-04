import { createHash } from 'node:crypto';
import type { MemoryFabric } from '../../memory/MemoryFabric.ts';

const MAX_PACK_BYTES = 10 * 1024 * 1024;
const MAX_PACK_ENTRIES = 5_000;
const MAX_SELECTED_ENTRIES = 32;
const MAX_ENTRY_STORAGE_CHARS = 20_000;
const MAX_SELECTED_CONTENT_CHARS = 96_000;

type PlainRecord = Record<string, unknown>;
type MaterialType = 'knowledge' | 'corpus';
type TermRole = 'alias' | 'recognition';

export interface NekoKnowledgePackSource {
  name: string;
  homepage?: string;
  license?: string;
}
export interface NekoKnowledgePackPreview {
  schemaVersion: 1;
  packId: string;
  materialType: MaterialType;
  source: NekoKnowledgePackSource;
  entryCount: number;
  byteLength: number;
  packDigest: string;
  licenseProvided: boolean;
  sampleTitles: string[];
  maxSelectableEntries: number;
  requiresExplicitApproval: true;
  requiresLicenseAcceptance: true;
}
export interface NekoKnowledgePackImportApproval {
  approved: boolean;
  licenseAccepted: boolean;
  /** Zero-based entry positions. Omission means all entries only when the pack fits one bounded batch. */
  entryIndices?: number[];
}
export interface NekoKnowledgePackImportResult {
  packId: string;
  materialType: MaterialType;
  source: NekoKnowledgePackSource;
  selectedCount: number;
  imported: number;
  skipped: number;
  memoryIds: string[];
  epistemicStatus: 'unknown';
  sourceAuthority01: 0.2;
}
interface NormalizedEntry {
  title: string;
  terms: Record<TermRole, string[]>;
  tags: string[];
  summary: string;
  content: string;
}
interface NormalizedPack {
  packId: string;
  materialType: MaterialType;
  source: NekoKnowledgePackSource;
  entries: NormalizedEntry[];
  byteLength: number;
  packDigest: string;
}

function fail(code: string): never { throw new Error(code); }
function isRecord(value: unknown): value is PlainRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function assertExactKeys(value: PlainRecord, allowed: readonly string[], code: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) if (!allowedSet.has(key)) fail(code);
}
function cleanText(value: unknown, code: string, maxLength: number, options: { multiline?: boolean; optional?: boolean } = {}): string {
  if (value === undefined && options.optional) return '';
  if (typeof value !== 'string') return fail(code);
  const cleaned = value
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu, '')
    .replace(/\r\n?/gu, '\n')
    .replace(options.multiline ? /[\t ]+/gu : /[\s\u00A0]+/gu, ' ')
    .replace(options.multiline ? /\n[ \t]+/gu : /$^/gu, options.multiline ? '\n' : '')
    .replace(options.multiline ? /\n{3,}/gu : /$^/gu, options.multiline ? '\n\n' : '')
    .trim();
  if (cleaned.length > maxLength) fail(code);
  return cleaned;
}
function normalizeTitleKey(value: string): string {
  return value.normalize('NFKC').replace(/[\s\u00A0]+/gu, ' ').trim().toLocaleLowerCase();
}
function parseTerms(value: unknown): Record<TermRole, string[]> {
  if (value === undefined) return { alias: [], recognition: [] };
  if (!isRecord(value)) return fail('invalid-terms');
  assertExactKeys(value, ['alias', 'recognition'], 'unknown-term-role');
  const parseRole = (role: TermRole): string[] => {
    const raw = value[role];
    if (raw === undefined) return [];
    if (!Array.isArray(raw) || raw.length > 64) return fail('invalid-term-list');
    return raw.map(term => cleanText(term, 'invalid-term', 300)).filter(Boolean);
  };
  return { alias: parseRole('alias'), recognition: parseRole('recognition') };
}
function parseTags(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 32) return fail('invalid-tags');
  return [...new Set(value.map(tag => cleanText(tag, 'invalid-tag', 100)).filter(Boolean))];
}
function digest(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
function parsePack(rawBytes: Uint8Array): NormalizedPack {
  if (!(rawBytes instanceof Uint8Array)) return fail('knowledge-pack-bytes-required');
  if (rawBytes.byteLength > MAX_PACK_BYTES) return fail('pack-size-limit-exceeded');
  let json: unknown;
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(rawBytes);
    json = JSON.parse(decoded);
  } catch {
    return fail('invalid-json-or-utf8');
  }
  if (!isRecord(json)) return fail('invalid-pack');
  assertExactKeys(json, ['schema_version', 'pack_id', 'material_type', 'source', 'entries'], 'unknown-pack-field');
  if (json.schema_version !== 1) return fail('unsupported-schema-version');
  const packId = cleanText(json.pack_id, 'invalid-pack-id', 64);
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/u.test(packId)) return fail('invalid-pack-id');
  if (json.material_type !== 'knowledge' && json.material_type !== 'corpus') return fail('invalid-material-type');
  if (!isRecord(json.source)) return fail('source-required');
  assertExactKeys(json.source, ['name', 'homepage', 'license'], 'unknown-source-field');
  const source: NekoKnowledgePackSource = {
    name: cleanText(json.source.name, 'source-name-required', 200),
    ...(json.source.homepage !== undefined ? { homepage: cleanText(json.source.homepage, 'invalid-source-homepage', 500) } : {}),
    ...(json.source.license !== undefined ? { license: cleanText(json.source.license, 'invalid-source-license', 200) } : {}),
  };
  if (!source.name) return fail('source-name-required');
  if (source.homepage) {
    try {
      const url = new URL(source.homepage);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return fail('invalid-source-homepage');
    } catch {
      return fail('invalid-source-homepage');
    }
  }
  if (!Array.isArray(json.entries) || json.entries.length === 0 || json.entries.length > MAX_PACK_ENTRIES) return fail('entries-required');
  const seenTitles = new Set<string>();
  const entries: NormalizedEntry[] = json.entries.map(rawEntry => {
    if (!isRecord(rawEntry)) return fail('invalid-entry');
    assertExactKeys(rawEntry, ['title', 'terms', 'tags', 'summary', 'content'], 'unknown-entry-field');
    const title = cleanText(rawEntry.title, 'entry-title-required', 500);
    const content = cleanText(rawEntry.content, 'entry-content-required', 80_000, { multiline: true });
    const summary = cleanText(rawEntry.summary, 'invalid-entry-summary', 4_000, { multiline: true, optional: true });
    if (!title || !content) return fail('entry-title-and-content-required');
    const titleKey = normalizeTitleKey(title);
    if (seenTitles.has(titleKey)) return fail('duplicate-entry-title');
    seenTitles.add(titleKey);
    return { title, content, summary, terms: parseTerms(rawEntry.terms), tags: parseTags(rawEntry.tags) };
  });
  const byteCopy = rawBytes.slice();
  return {
    packId,
    materialType: json.material_type,
    source,
    entries,
    byteLength: rawBytes.byteLength,
    packDigest: digest(byteCopy),
  };
}
function selectIndices(pack: NormalizedPack, approval: NekoKnowledgePackImportApproval): number[] {
  if (!approval || approval.approved !== true) return fail('explicit-approval-required');
  if (approval.licenseAccepted !== true) return fail('license-acceptance-required');
  if (!pack.source.license?.trim()) return fail('source-license-required');
  const raw = approval.entryIndices;
  if (raw === undefined) {
    if (pack.entries.length > MAX_SELECTED_ENTRIES) return fail('entry-selection-required');
    return pack.entries.map((_, index) => index);
  }
  if (!Array.isArray(raw) || raw.length === 0) return fail('entry-selection-required');
  if (raw.length > MAX_SELECTED_ENTRIES) return fail('selection-limit-exceeded');
  const seen = new Set<number>();
  for (const index of raw) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= pack.entries.length) return fail('entry-index-out-of-range');
    if (seen.has(index)) return fail('duplicate-entry-index');
    seen.add(index);
  }
  return [...seen].sort((a, b) => a - b);
}
function stableSourceIdentity(source: NekoKnowledgePackSource): string {
  return digest(`${source.name.normalize('NFKC').trim().toLocaleLowerCase()}\0${source.homepage ?? ''}`).slice(0, 48);
}
function toMemoryInput(pack: NormalizedPack, entry: NormalizedEntry, entryIndex: number): Parameters<MemoryFabric['encode']>[0] {
  const termText = [
    ...entry.terms.alias.map(term => `Alias: ${term}`),
    ...entry.terms.recognition.map(term => `Recognition: ${term}`),
  ].join('\n');
  const content = [entry.title, entry.summary, entry.content, termText].filter(Boolean).join('\n\n');
  if (content.length > MAX_ENTRY_STORAGE_CHARS) fail('entry-storage-limit-exceeded');
  const sourceId = `neko-knowledge-pack:${pack.packId}`;
  const contentHash = digest(content);
  return {
    id: `neko-kp-${pack.packId}-${entryIndex}-${contentHash.slice(0, 16)}`,
    content,
    kind: 'semantic',
    salience: 0.15,
    emotionalWeight: 0,
    identityRelevance: 0,
    goalRelevance: 0,
    socialRelevance: 0,
    predictionError: 0,
    confidence: 0.15,
    epistemicStatus: 'unknown',
    source: sourceId,
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    provenanceClass: 'external',
    sourceAuthority01: 0.2,
    independenceKey: `neko-source:${stableSourceIdentity(pack.source)}`,
    tags: [...new Set([
      'external-knowledge',
      'neko-knowledge-pack',
      `material-${pack.materialType}`,
      `pack-${pack.packId}`,
      ...entry.tags.map(tag => `source-tag:${tag}`),
      ...entry.terms.alias.map(term => `alias:${term}`),
      ...entry.terms.recognition.map(term => `recognition:${term}`),
    ])].slice(0, 32),
    context: {
      packId: pack.packId,
      materialType: pack.materialType,
      entryIndex: String(entryIndex),
      sourceName: pack.source.name,
      sourceHomepage: pack.source.homepage ?? '',
      sourceLicense: pack.source.license ?? '',
      sourceTitle: entry.title,
      sourceTermsAlias: entry.terms.alias.join('\n').slice(0, 2_000),
      sourceTermsRecognition: entry.terms.recognition.join('\n').slice(0, 2_000),
      trustStatus: 'unverified-external',
      licenseReview: 'accepted-by-host',
      schemaVersion: '1',
    },
  };
}

/**
 * Strict, bounded adapter from N.E.K.O. Knowledge Pack v1 to NK1's sole
 * canonical MemoryFabric write boundary. It never fetches, executes or trusts
 * pack-supplied embeddings/chunks, and never promotes an imported row to fact.
 */
export class NekoKnowledgePackImporter {
  private readonly memory: MemoryFabric;

  constructor(memory: MemoryFabric) {
    if (!memory) throw new Error('canonical-memory-fabric-required');
    this.memory = memory;
  }

  preview(rawBytes: Uint8Array): NekoKnowledgePackPreview {
    const pack = parsePack(rawBytes);
    return {
      schemaVersion: 1,
      packId: pack.packId,
      materialType: pack.materialType,
      source: structuredClone(pack.source),
      entryCount: pack.entries.length,
      byteLength: pack.byteLength,
      packDigest: pack.packDigest,
      licenseProvided: Boolean(pack.source.license?.trim()),
      sampleTitles: pack.entries.slice(0, 12).map(entry => entry.title),
      maxSelectableEntries: MAX_SELECTED_ENTRIES,
      requiresExplicitApproval: true,
      requiresLicenseAcceptance: true,
    };
  }

  import(rawBytes: Uint8Array, approval: NekoKnowledgePackImportApproval, context: { tick?: number } = {}): NekoKnowledgePackImportResult {
    const pack = parsePack(rawBytes);
    const indices = selectIndices(pack, approval);
    const inputs = indices.map(index => toMemoryInput(pack, pack.entries[index]!, index));
    const totalChars = inputs.reduce((total, input) => total + input.content.length, 0);
    if (totalChars > MAX_SELECTED_CONTENT_CHARS) fail('selection-content-limit-exceeded');
    const memoryIds: string[] = [];
    for (let position = 0; position < indices.length; position += 1) {
      const entryIndex = indices[position]!;
      const input = inputs[position]!;
      const memory = this.memory.encode(input, {
        tick: Number.isSafeInteger(context.tick) ? Number(context.tick) : 0,
        commandId: `neko-knowledge-pack:v1:${pack.packId}:${entryIndex}`,
      });
      memoryIds.push(memory.id);
    }
    return {
      packId: pack.packId,
      materialType: pack.materialType,
      source: structuredClone(pack.source),
      selectedCount: indices.length,
      imported: memoryIds.length,
      skipped: pack.entries.length - memoryIds.length,
      memoryIds,
      epistemicStatus: 'unknown',
      sourceAuthority01: 0.2,
    };
  }
}
