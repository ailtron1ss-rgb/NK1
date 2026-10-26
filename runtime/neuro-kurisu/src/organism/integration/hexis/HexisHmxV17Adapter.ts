import { createHash, randomUUID } from 'node:crypto';

export type CanonicalHmxIntent = 'port' | 'duplicate' | 'telepathy' | 'analysis';

export interface HmxValidationIssue {
  path: string;
  kind: string;
  detail: string;
}

export type HmxDocumentSnapshotResult =
  | { ok: true; value: unknown }
  | { ok: false; issue: HmxValidationIssue };

export interface Nk1HmxMemoryProjection {
  ref: string;
  content: string;
  kind: 'sensory' | 'working' | 'episodic' | 'semantic' | 'procedural' | 'social' | 'dream';
  confidence: number;
  salience: number;
  sourceAuthority01: number;
  epistemicStatus: 'fact' | 'belief' | 'hypothesis' | 'unknown' | 'quarantined';
  createdAt?: number;
  observedAt?: number;
  validFromAt?: number;
  validUntilAt?: number | null;
  tags: string[];
  context: Record<string, string>;
  entities: string[];
  independenceKey: string;
  evidenceFreshnessAt: number;
}

const KNOWN_SECTIONS = new Set([
  'memories', 'episodes', 'relationships', 'narrative', 'identity', 'worldview',
  'goals', 'drives', 'emotional_triggers', 'clusters', 'in_flight_work',
  'audit_records', 'raw_units', 'config',
]);
const ARRAY_SECTIONS = new Set([
  'memories', 'episodes', 'relationships', 'identity', 'worldview', 'goals',
  'drives', 'emotional_triggers', 'clusters', 'raw_units',
]);
const OBJECT_SECTIONS = new Set(['narrative', 'in_flight_work', 'audit_records', 'config']);
const PROTECTED_SECTIONS = new Set([
  'identity', 'worldview', 'drives', 'emotional_triggers', 'narrative', 'goals',
]);
const PROTECTED_MEMORY_KINDS = new Set([
  'identity', 'autobiographical', 'self-model', 'self_model', 'personality',
  'worldview', 'goal', 'drive', 'emotional_trigger', 'emotional-trigger',
  'narrative', 'core-value', 'protected',
]);
const EXPORT_ID_PATTERN = /^exp_[0-9a-f]{16}$/;
const REF_PATTERN = /^exp_[0-9a-f]{16}:.+$/;
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_SNAPSHOT_NODES = 50_000;
const MAX_SNAPSHOT_DEPTH = 32;
const MAX_STAGED_MEMORIES = 256;
const MAX_MEMORY_CHARS = 12_000;
const MAX_EXPORT_MEMORY_CHARS = 5_000;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDateTime(value: unknown): boolean {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function clamp01(value: unknown, fallback: number): number {
  // JSON objects (including null-prototype snapshots) must never be coerced
  // through user-defined/toString primitive conversion during memory import.
  try {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  } catch {
    return fallback;
  }
}

function isUnitIntervalNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function dateMs(value: unknown): number | undefined {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return undefined;
  return Date.parse(value);
}

function safeContext(value: unknown): Record<string, string> {
  const input = record(value);
  const output: Record<string, string> = {};
  if (!input) return output;
  for (const [key, item] of Object.entries(input).slice(0, 12)) {
    if (!(typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')) continue;
    const safeKey = key.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
    if (!safeKey || safeKey === '__proto__' || safeKey === 'constructor' || safeKey === 'prototype') continue;
    output[safeKey] = String(item).normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 300);
  }
  return output;
}

function safeIso(value: unknown, fallback: number): string {
  const ms = typeof value === 'number' && Number.isFinite(value) ? value : dateMs(value);
  return new Date(ms ?? fallback).toISOString();
}

/**
 * Copies untrusted caller data into a bounded plain-JSON tree before validation.
 * Property accessors, custom prototypes, cycles, non-finite numbers and oversized
 * trees are rejected rather than executed, coerced, or partially staged.
 */
export function snapshotHmxV17Document(raw: unknown): HmxDocumentSnapshotResult {
  const active = new WeakSet<object>();
  const encoder = new TextEncoder();
  const state = { nodes: 0, textBytes: 0 };

  const capture = (value: unknown, path: string, depth: number): unknown => {
    state.nodes += 1;
    if (state.nodes > MAX_SNAPSHOT_NODES || depth > MAX_SNAPSHOT_DEPTH) {
      throw new Error('HMX snapshot resource bound exceeded');
    }
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      state.textBytes += encoder.encode(value).byteLength;
      if (state.textBytes > MAX_DOCUMENT_BYTES) throw new Error('HMX text bound exceeded');
      return value;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('HMX numeric value is not finite');
      return value;
    }
    if (typeof value !== 'object') throw new Error('HMX value is not JSON data');

    const objectValue = value as object;
    if (active.has(objectValue)) throw new Error('HMX input contains a cycle');
    active.add(objectValue);
    try {
      if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) throw new Error('HMX array prototype is unsupported');
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
        const length = lengthDescriptor && 'value' in lengthDescriptor ? lengthDescriptor.value : undefined;
        if (!Number.isSafeInteger(length) || Number(length) < 0 || Number(length) > MAX_SNAPSHOT_NODES) {
          throw new Error('HMX array length is invalid');
        }
        const keys = Reflect.ownKeys(value);
        if (keys.length !== Number(length) + 1 || keys.some((key) => typeof key !== 'string')) {
          throw new Error('HMX array has holes or extra properties');
        }
        const out: unknown[] = [];
        for (let index = 0; index < Number(length); index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
            throw new Error('HMX array contains a hole or accessor');
          }
          out.push(capture(descriptor.value, path + '[' + index + ']', depth + 1));
        }
        return out;
      }

      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) throw new Error('HMX object prototype is unsupported');
      const keys = Reflect.ownKeys(value);
      if (keys.length > MAX_SNAPSHOT_NODES || keys.some((key) => typeof key !== 'string')) {
        throw new Error('HMX object keys are invalid or exceed bounds');
      }
      const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const key of keys as string[]) {
        state.textBytes += encoder.encode(key).byteLength;
        if (state.textBytes > MAX_DOCUMENT_BYTES) throw new Error('HMX text bound exceeded');
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error('HMX object contains a non-data or non-enumerable property');
        }
        Object.defineProperty(out, key, {
          value: capture(descriptor.value, path + '.' + key, depth + 1),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      return out;
    } finally {
      active.delete(objectValue);
    }
  };

  try {
    return { ok: true, value: capture(raw, '$', 0) };
  } catch (error) {
    return {
      ok: false,
      issue: {
        path: '$',
        kind: 'unsafe-input',
        detail: error instanceof Error ? error.message.slice(0, 200) : 'HMX input could not be captured safely.',
      },
    };
  }
}

function describeSection(section: string, value: unknown, exportId: string, issues: HmxValidationIssue[]): void {
  const path = 'sections.' + section;
  if (!KNOWN_SECTIONS.has(section)) {
    issues.push({ path, kind: 'unsupported-section', detail: 'NK1 does not recognize this HMX section; refusing a lossy import.' });
    return;
  }
  if (ARRAY_SECTIONS.has(section) && !Array.isArray(value)) {
    issues.push({ path, kind: 'schema', detail: 'This HMX 1.7 section must be an array.' });
    return;
  }
  if (OBJECT_SECTIONS.has(section) && !record(value)) {
    issues.push({ path, kind: 'schema', detail: 'This HMX 1.7 section must be an object.' });
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_STAGED_MEMORIES) {
      issues.push({ path, kind: 'staging-capacity', detail: 'Section exceeds the 256-record bounded staging capacity.' });
    }
    value.slice(0, MAX_STAGED_MEMORIES).forEach((rawRow, index) => {
      const row = record(rawRow);
      if (!row) {
        issues.push({ path: path + '[' + index + ']', kind: 'schema', detail: 'Section entries must be objects.' });
        return;
      }
      if (section === 'memories') {
        if (!nonEmptyString(row.ref) || row.ref.length > 512 ||
            !REF_PATTERN.test(row.ref) || !row.ref.startsWith(exportId + ':')) {
          issues.push({ path: path + '[' + index + '].ref', kind: 'schema', detail: 'Memory refs must be bounded, unique export-scoped HMX references for this document.' });
        }
        if (!nonEmptyString(row.type)) {
          issues.push({ path: path + '[' + index + '].type', kind: 'schema', detail: 'Memory records require a type string.' });
        }
        if (typeof row.content !== 'string' || !row.content.trim()) {
          issues.push({ path: path + '[' + index + '].content', kind: 'schema', detail: 'Memory records require non-empty content.' });
        }
        if (typeof row.content === 'string' && row.content.length > MAX_MEMORY_CHARS) {
          issues.push({ path: path + '[' + index + '].content', kind: 'record-too-large', detail: 'NK1 imports at most 12000 characters per memory record.' });
        }

        if (row.metadata != null && !record(row.metadata)) {
          issues.push({ path: path + '[' + index + '].metadata', kind: 'schema', detail: 'Memory metadata must be an object when supplied.' });
        }
        const metadata = record(row.metadata) ?? {};
        if (row.source_attribution != null && !record(row.source_attribution)) {
          issues.push({ path: path + '[' + index + '].source_attribution', kind: 'schema', detail: 'source_attribution must be an object when supplied.' });
        }
        const sourceAttribution = record(row.source_attribution) ?? {};
        if (sourceAttribution.source_authority_01 != null &&
            !isUnitIntervalNumber(sourceAttribution.source_authority_01)) {
          issues.push({ path: path + '[' + index + '].source_attribution.source_authority_01', kind: 'schema', detail: 'source_authority_01 must be a finite number between 0 and 1 when supplied.' });
        }
        if (metadata.nk1_kind != null && typeof metadata.nk1_kind !== 'string') {
          issues.push({ path: path + '[' + index + '].metadata.nk1_kind', kind: 'schema', detail: 'nk1_kind must be a string when supplied.' });
        }
        if (metadata.nk1_epistemic_status != null && typeof metadata.nk1_epistemic_status !== 'string') {
          issues.push({ path: path + '[' + index + '].metadata.nk1_epistemic_status', kind: 'schema', detail: 'nk1_epistemic_status must be a string when supplied.' });
        }
        for (const field of ['trust_level', 'importance'] as const) {
          if (row[field] != null && !isUnitIntervalNumber(row[field])) {
            issues.push({ path: path + '[' + index + '].' + field, kind: 'schema', detail: field + ' must be a finite number between 0 and 1 when supplied.' });
          }
        }
        for (const field of ['nk1_confidence', 'nk1_salience'] as const) {
          if (metadata[field] != null && !isUnitIntervalNumber(metadata[field])) {
            issues.push({ path: path + '[' + index + '].metadata.' + field, kind: 'schema', detail: field + ' must be a finite number between 0 and 1 when supplied.' });
          }
        }
        if (metadata.tags != null &&
            (!Array.isArray(metadata.tags) || metadata.tags.some((tag) => typeof tag !== 'string'))) {
          issues.push({ path: path + '[' + index + '].metadata.tags', kind: 'schema', detail: 'metadata.tags must be an array of strings when supplied.' });
        }
        if (metadata.entities != null &&
            (!Array.isArray(metadata.entities) || metadata.entities.some((entity) => typeof entity !== 'string'))) {
          issues.push({ path: path + '[' + index + '].metadata.entities', kind: 'schema', detail: 'metadata.entities must be an array of strings when supplied.' });
        }
        if (metadata.context != null && !record(metadata.context)) {
          issues.push({ path: path + '[' + index + '].metadata.context', kind: 'schema', detail: 'metadata.context must be an object when supplied.' });
        }
        const declaredKind = typeof metadata.nk1_kind === 'string'
          ? metadata.nk1_kind.trim().toLowerCase()
          : typeof row.type === 'string' ? row.type.trim().toLowerCase() : '';
        if (PROTECTED_MEMORY_KINDS.has(declaredKind) ||
            row.protected === true || row.protectedBelief === true ||
            metadata.protected === true || metadata.nk1_protected === true ||
            metadata.protected_belief === true) {
          issues.push({ path: path + '[' + index + ']', kind: 'protected-memory-record', detail: 'Protected identity/personality/worldview/drive records cannot be imported through the memory-only exchange.' });
        }

        for (const dateField of ['created_at', 'updated_at']) {
          if (row[dateField] != null && !isDateTime(row[dateField])) {
            issues.push({ path: path + '[' + index + '].' + dateField, kind: 'schema', detail: 'Optional memory timestamps must be valid ISO date-times.' });
          }
        }
        for (const dateField of ['valid_from', 'valid_until', 'last_accessed']) {
          if (row[dateField] != null && !isDateTime(row[dateField])) {
            issues.push({ path: path + '[' + index + '].' + dateField, kind: 'schema', detail: 'Memory date fields must be null or valid ISO date-times.' });
          }
        }
        if (row.content_hash_v1 != null) {
          if (typeof row.content_hash_v1 !== 'string' || !/^[0-9a-f]{64}$/.test(row.content_hash_v1)) {
            issues.push({ path: path + '[' + index + '].content_hash_v1', kind: 'schema', detail: 'content_hash_v1 must be a lowercase SHA-256 hash when supplied.' });
          } else if (typeof row.content === 'string' && sha256(row.content) !== row.content_hash_v1) {
            issues.push({ path: path + '[' + index + '].content_hash_v1', kind: 'integrity', detail: 'Memory content does not match its supplied SHA-256 hash.' });
          }
        }
        if (row.access_count != null && (!Number.isSafeInteger(row.access_count) || Number(row.access_count) < 0)) {
          issues.push({ path: path + '[' + index + '].access_count', kind: 'schema', detail: 'access_count must be a non-negative integer.' });
        }
      } else {
        issues.push({
          path: path + '[' + index + ']',
          kind: PROTECTED_SECTIONS.has(section) ? 'protected-section' : 'unsupported-import-section',
          detail: 'This section is not mapped to canonical NK1 memory; import is blocked rather than silently dropping it.',
        });
      }
    });
  } else {
    const objectValue = record(value);
    if (objectValue && Object.keys(objectValue).length > 0) {
      issues.push({
        path,
        kind: PROTECTED_SECTIONS.has(section) ? 'protected-section' : 'unsupported-import-section',
        detail: 'This section is not mapped to canonical NK1 memory; import is blocked rather than silently dropping it.',
      });
    }
  }
}

/**
 * The adapter intentionally implements the memory-only subset used by NK1.
 * The envelope/source and memory fields are checked against the upstream HMX 1.7
 * schema. Recognized but unmapped sections are rejected rather than discarded.
 */
function validateCapturedHmxV17Document(
  capturedValue: unknown,
  requestedIntent?: CanonicalHmxIntent,
): HmxValidationIssue[] {
  const issues: HmxValidationIssue[] = [];

  let serialized: string;
  try {
    serialized = JSON.stringify(capturedValue);
  } catch {
    return [{ path: '$', kind: 'schema', detail: 'HMX document must be serializable JSON.' }];
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_DOCUMENT_BYTES) {
    return [{ path: '$', kind: 'document-too-large', detail: 'HMX document exceeds NK1’s 2 MiB staging limit.' }];
  }

  const document = record(capturedValue);
  if (!document) return [{ path: '$', kind: 'schema', detail: 'HMX document must be a JSON object.' }];

  if (document.hmx_version !== '1.7') {
    issues.push({ path: 'hmx_version', kind: 'unsupported-version', detail: 'NK1 validates the upstream HMX 1.7 contract only.' });
  }
  const exportId = typeof document.export_id === 'string' ? document.export_id : '';
  if (!EXPORT_ID_PATTERN.test(exportId)) {
    issues.push({ path: 'export_id', kind: 'schema', detail: 'HMX export_id must match exp_ followed by 16 lowercase hex characters.' });
  }
  const documentIntent = document.export_intent;
  if (typeof documentIntent !== 'string' ||
      !['port', 'duplicate', 'telepathy', 'analysis'].includes(documentIntent)) {
    issues.push({ path: 'export_intent', kind: 'schema', detail: 'HMX 1.7 requires an explicit valid export_intent.' });
  } else if (requestedIntent && documentIntent !== requestedIntent) {
    issues.push({ path: 'export_intent', kind: 'intent-mismatch', detail: 'The chosen NK1 import intent must match the source document intent; reclassification is not allowed.' });
  }
  if (!isDateTime(document.exported_at)) {
    issues.push({ path: 'exported_at', kind: 'schema', detail: 'HMX exported_at must be a valid ISO date-time.' });
  }

  const source = record(document.source);
  if (!source) {
    issues.push({ path: 'source', kind: 'schema', detail: 'HMX 1.7 requires a source metadata object.' });
  } else {
    for (const key of ['instance_id', 'schema_version', 'embedding_model', 'hexis_lineage_id']) {
      if (!nonEmptyString(source[key])) issues.push({ path: 'source.' + key, kind: 'schema', detail: 'Required source metadata must be a non-empty string.' });
    }
    if (!Number.isSafeInteger(source.embedding_dimension) || Number(source.embedding_dimension) < 1) {
      issues.push({ path: 'source.embedding_dimension', kind: 'schema', detail: 'HMX source embedding_dimension must be a positive integer.' });
    }
  }

  const capabilities = record(document.capabilities);
  if (document.capabilities != null) {
    if (!capabilities) {
      issues.push({ path: 'capabilities', kind: 'schema', detail: 'capabilities must be an object when present.' });
    } else {
      for (const key of ['formats', 'sections', 'hash_algorithms', 'relationship_edge_types', 'optional_features']) {
        if (!Array.isArray(capabilities[key])) issues.push({ path: 'capabilities.' + key, kind: 'schema', detail: 'Capability fields must be arrays.' });
      }
    }
  }
  const privacy = record(document.privacy);
  if (document.privacy != null) {
    if (!privacy) {
      issues.push({ path: 'privacy', kind: 'schema', detail: 'privacy must be an object when present.' });
    } else {
      if (typeof privacy.redaction_policy !== 'string' ||
          !['none', 'basic', 'strict', 'custom'].includes(privacy.redaction_policy)) {
        issues.push({ path: 'privacy.redaction_policy', kind: 'schema', detail: 'Unknown HMX redaction policy.' });
      }
      if (typeof privacy.contains_sensitive_content !== 'boolean') {
        issues.push({ path: 'privacy.contains_sensitive_content', kind: 'schema', detail: 'contains_sensitive_content must be boolean.' });
      }
      if (typeof privacy.consent_scope !== 'string' ||
          !['backup', 'migration', 'third_party_transfer', 'unspecified'].includes(privacy.consent_scope)) {
        issues.push({ path: 'privacy.consent_scope', kind: 'schema', detail: 'Unknown HMX consent scope.' });
      }
    }
  }

  const sections = record(document.sections);
  if (!sections || Object.keys(sections).length === 0) {
    issues.push({ path: 'sections', kind: 'schema', detail: 'HMX sections must be a non-empty object.' });
    return issues;
  }
  for (const [name, value] of Object.entries(sections)) describeSection(name, value, exportId, issues);

  if (!Array.isArray(sections.memories)) {
    issues.push({ path: 'sections.memories', kind: 'schema', detail: 'NK1 memory-only import requires a memories array.' });
    return issues;
  }
  const refs = new Set<string>();
  for (const [index, rawMemory] of sections.memories.entries()) {
    const row = record(rawMemory);
    if (!row || typeof row.ref !== 'string') continue;
    if (refs.has(row.ref)) {
      issues.push({ path: 'sections.memories[' + index + '].ref', kind: 'duplicate-ref', detail: 'Memory refs must be unique within an HMX document.' });
    }
    refs.add(row.ref);
  }
  return issues;
}

export type HmxSnapshotValidationResult =
  | { ok: true; value: unknown; issues: HmxValidationIssue[] }
  | { ok: false; issue: HmxValidationIssue };

/** One bounded snapshot followed by validation of that detached data, without a second deep copy. */
export function snapshotAndValidateHmxV17Document(
  raw: unknown,
  requestedIntent?: CanonicalHmxIntent,
): HmxSnapshotValidationResult {
  const captured = snapshotHmxV17Document(raw);
  if (!captured.ok) return captured;
  return {
    ok: true,
    value: captured.value,
    issues: validateCapturedHmxV17Document(captured.value, requestedIntent),
  };
}

/** Public validation retains the safe bounded-snapshot boundary for arbitrary inputs. */
export function validateHmxV17Document(
  raw: unknown,
  requestedIntent?: CanonicalHmxIntent,
): HmxValidationIssue[] {
  const result = snapshotAndValidateHmxV17Document(raw, requestedIntent);
  return result.ok ? result.issues : [result.issue];
}
export function isHmxV17Intent(value: unknown): value is CanonicalHmxIntent {
  return value === 'port' || value === 'duplicate' || value === 'telepathy' || value === 'analysis';
}

export function isSafeHmxV17ExportId(value: string): boolean {
  return EXPORT_ID_PATTERN.test(value);
}

export function createNk1HmxExportId(randomHex: string): string {
  const suffix = String(randomHex).toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 16);
  if (suffix.length !== 16) throw new Error('hmx-export-id-requires-16-hex-digits');
  return 'exp_' + suffix;
}

function isProtectedMemory(row: Record<string, unknown>): boolean {
  const metadata = record(row.metadata) ?? {};
  const kind = String(row.kind ?? row.type ?? metadata.nk1_kind ?? '').trim().toLowerCase();
  return PROTECTED_MEMORY_KINDS.has(kind)
    || row.protected === true || row.protectedBelief === true
    || metadata.protected === true || metadata.nk1_protected === true || metadata.protected_belief === true;
}

/** Builds a valid, bounded HMX 1.7 memory-only exchange; embeddings and protected data are not exported. */
export function buildNk1HmxV17Document(input: {
  subjectId: string;
  memories: unknown[];
  exportedAt?: number;
}): Record<string, unknown> {
  const exportedAt = Number.isFinite(input.exportedAt) ? Number(input.exportedAt) : Date.now();
  const exportId = createNk1HmxExportId(randomUUID());
  const sourceSubject = String(input.subjectId || 'nk1-local').slice(0, 180);
  const candidates = input.memories
    .map(record)
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .filter((row) => typeof row.content === 'string' && Boolean(String(row.content).trim())
      && !row.dormant && row.epistemicStatus !== 'quarantined' && !isProtectedMemory(row))
    .sort((a, b) => Number(b.observedAt ?? b.lastAccessAt ?? b.createdAt ?? 0)
      - Number(a.observedAt ?? a.lastAccessAt ?? a.createdAt ?? 0));
  const selected = candidates.slice(0, MAX_STAGED_MEMORIES);
  let truncatedCount = 0;
  const memories = selected.map((row, index) => {
    const id = String(row.id ?? 'row-' + index).slice(0, 240);
    const kind = nonEmptyString(row.kind) ? row.kind : 'semantic';
    const rawBody = String(row.content);
    const body = rawBody.slice(0, MAX_EXPORT_MEMORY_CHARS);
    if (body.length !== rawBody.length) truncatedCount += 1;
    const meta: Record<string, unknown> = {
      nk1_kind: kind,
      nk1_confidence: clamp01(row.confidence, 0.55),
      nk1_salience: clamp01(row.salience, 0.55),
      nk1_epistemic_status: ['fact', 'belief', 'hypothesis', 'unknown', 'quarantined'].includes(String(row.epistemicStatus))
        ? String(row.epistemicStatus) : 'belief',
      entities: Array.isArray(row.entities) ? row.entities.map(String).slice(0, 16) : [],
      tags: Array.isArray(row.tags) ? row.tags.map(String).slice(0, 32) : [],
      context: safeContext(row.context),
      semantic_links: Array.isArray(row.semanticLinks) ? row.semanticLinks.map(String).slice(0, 32) : [],
      temporal_links: Array.isArray(row.temporalLinks) ? row.temporalLinks.map(String).slice(0, 32) : [],
      causal_links: Array.isArray(row.causalLinks) ? row.causalLinks.map(String).slice(0, 32) : [],
      provenance_class: String(row.provenanceClass ?? 'native'),
    };
    const acquisition = String(row.source ?? '').startsWith('hexis-hmx-import') ? 'imported_and_accepted' : 'experienced';
    return {
      ref: exportId + ':memory:' + encodeURIComponent(id),
      type: kind,
      status: String(row.epistemicStatus ?? 'belief'),
      content: body,
      content_hash_v1: sha256(body),
      importance: clamp01(row.salience, 0.55),
      trust_level: clamp01(row.sourceAuthority01 ?? row.confidence, 0.55),
      decay_rate: 0,
      created_at: safeIso(row.createdAt, exportedAt),
      updated_at: safeIso(row.observedAt ?? row.lastAccessAt ?? row.createdAt, exportedAt),
      valid_from: row.validFromAt == null ? safeIso(row.createdAt, exportedAt) : safeIso(row.validFromAt, exportedAt),
      valid_until: row.validUntilAt == null ? null : safeIso(row.validUntilAt, exportedAt),
      access_count: Math.max(0, Math.floor(Number(row.retrievalCount ?? 0) || 0)),
      last_accessed: row.lastAccessAt == null ? null : safeIso(row.lastAccessAt, exportedAt),
      source_attribution: {
        source: String(row.source ?? 'nk1-memoryos2').slice(0, 240),
        nk1_memory_id: id,
        source_authority_01: clamp01(row.sourceAuthority01, 0.55),
        epistemic_status: String(row.epistemicStatus ?? 'belief'),
      },
      metadata: meta,
      provenance: {
        acquisition_mode: acquisition,
        origin_instance: sourceSubject,
        origin_id: id,
        import_chain: [],
        modification_chain: [],
      },
    };
  });
  return {
    hmx_version: '1.7',
    export_id: exportId,
    export_intent: 'telepathy',
    exported_at: new Date(exportedAt).toISOString(),
    source: {
      instance_id: 'nk1:' + sourceSubject,
      schema_version: 'NK1-MemoryOS2-v1',
      embedding_model: 'NK1-metadata-only-vectors-not-exported',
      embedding_dimension: 1,
      hexis_lineage_id: sourceSubject,
    },
    capabilities: {
      formats: ['json'],
      sections: ['memories'],
      hash_algorithms: ['sha256'],
      relationship_edge_types: [],
      optional_features: [],
    },
    privacy: {
      redaction_policy: 'none',
      contains_sensitive_content: true,
      consent_scope: 'unspecified',
    },
    export_scope: {
      types: ['memory'],
      include_protected: [],
      include_raw_units: false,
      include_config: false,
      include_in_flight_work: false,
      include_audit_records: false,
      filter: 'NK1 metadata-only memory exchange; embeddings, protected sections, raw units and active configuration are not exported.',
    },
    sections: { memories },
    statistics: { total_memories: memories.length },
    export_warnings: [
      ...(candidates.length > memories.length
        ? ['Export is bounded to the newest ' + String(MAX_STAGED_MEMORIES) + ' eligible memories; ' + String(candidates.length - memories.length) + ' records were not included.'] : []),
      ...(truncatedCount > 0 ? [String(truncatedCount) + ' memory records were truncated to ' + String(MAX_EXPORT_MEMORY_CHARS) + ' characters to keep the exchange bounded.'] : []),
    ],
  };
}

/** Maps one HMX row to NK1 while treating all source-reported trust/status as unverified metadata. */
export function normalizeHmxV17Memory(
  raw: unknown,
  input: { exportId: string; sourceSubjectId?: string; exportedAt?: string },
): Nk1HmxMemoryProjection | null {
  if (!input || typeof input !== 'object') return null;
  // This helper is exported and may be called outside the trusted staging path.
  // Snapshot the row independently so direct callers cannot execute getters,
  // pass custom prototypes, or mutate values between projection checks.
  const captured = snapshotHmxV17Document(raw);
  if (!captured.ok) return null;
  const row = record(captured.value);
  if (!row || typeof row.content !== 'string' || !row.content.trim() ||
      row.content.length > MAX_MEMORY_CHARS || typeof row.ref !== 'string' ||
      row.ref.length > 512 || !REF_PATTERN.test(row.ref)) return null;
  if (row.metadata != null && !record(row.metadata)) return null;
  if (row.source_attribution != null && !record(row.source_attribution)) return null;
  const metadata = record(row.metadata) ?? {};
  const source = record(row.source_attribution) ?? {};
  if (source.source_authority_01 != null && !isUnitIntervalNumber(source.source_authority_01)) return null;
  if (metadata.nk1_kind != null && typeof metadata.nk1_kind !== 'string') return null;
  if (metadata.nk1_epistemic_status != null && typeof metadata.nk1_epistemic_status !== 'string') return null;
  for (const value of [row.trust_level, row.importance, metadata.nk1_confidence, metadata.nk1_salience]) {
    if (value != null && !isUnitIntervalNumber(value)) return null;
  }
  if (metadata.tags != null &&
      (!Array.isArray(metadata.tags) || metadata.tags.some((tag) => typeof tag !== 'string'))) return null;
  if (metadata.entities != null &&
      (!Array.isArray(metadata.entities) || metadata.entities.some((entity) => typeof entity !== 'string'))) return null;
  if (metadata.context != null && !record(metadata.context)) return null;
  const validKinds = new Set(['sensory', 'working', 'episodic', 'semantic', 'procedural', 'social', 'dream']);
  const rawKind = (typeof metadata.nk1_kind === 'string'
    ? metadata.nk1_kind
    : typeof row.type === 'string' ? row.type : 'semantic').trim().toLowerCase();
  const kind = (validKinds.has(rawKind) ? rawKind : 'semantic') as Nk1HmxMemoryProjection['kind'];
  const validStatus = new Set(['fact', 'belief', 'hypothesis', 'unknown', 'quarantined']);
  const rawStatus = (typeof metadata.nk1_epistemic_status === 'string'
    ? metadata.nk1_epistemic_status : 'belief').trim().toLowerCase();
  const proposedStatus = validStatus.has(rawStatus) ? rawStatus : 'belief';
  const epistemicStatus = (proposedStatus === 'quarantined' ? 'quarantined'
    : proposedStatus === 'unknown' ? 'unknown'
      : proposedStatus === 'hypothesis' ? 'hypothesis' : 'belief') as Nk1HmxMemoryProjection['epistemicStatus'];
  const trust = Math.min(0.55, clamp01(row.trust_level ?? source.source_authority_01, 0.55));
  const confidence = Math.min(0.55, clamp01(metadata.nk1_confidence ?? row.trust_level, 0.55));
  const salience = clamp01(metadata.nk1_salience ?? row.importance, 0.55);
  const createdAt = dateMs(row.created_at);
  const observedAt = dateMs(row.updated_at) ?? createdAt ?? dateMs(input.exportedAt) ?? Date.now();
  const validFromAt = dateMs(row.valid_from) ?? createdAt ?? observedAt;
  const validUntilAt = row.valid_until == null ? null : dateMs(row.valid_until) ?? null;
  const tags = Array.isArray(metadata.tags) ? metadata.tags.map((x) => x.slice(0, 80)).slice(0, 24) : ['hexis', 'hmx'];
  const context = safeContext(metadata.context);
  const entities = Array.isArray(metadata.entities) ? metadata.entities.map((x) => x.slice(0, 120)).slice(0, 12) : [];

  return {
    ref: row.ref,
    content: row.content.slice(0, MAX_MEMORY_CHARS),
    kind,
    confidence,
    salience,
    sourceAuthority01: trust,
    epistemicStatus,
    ...(createdAt !== undefined ? { createdAt } : {}),
    observedAt,
    validFromAt,
    validUntilAt,
    tags,
    context,
    entities,
    independenceKey: 'hexis:' + (typeof input.sourceSubjectId === 'string'
      ? input.sourceSubjectId
      : typeof input.exportId === 'string' ? input.exportId : 'unknown').slice(0, 180),
    evidenceFreshnessAt: observedAt,
  };
}
