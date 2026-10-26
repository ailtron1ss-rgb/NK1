import { createHash, randomUUID } from 'node:crypto';

export type CanonicalHmxIntent = 'port' | 'duplicate' | 'telepathy' | 'analysis';

export interface HmxValidationIssue {
  path: string;
  kind: string;
  detail: string;
}

const KNOWN_SECTIONS = new Set([
  'memories', 'episodes', 'relationships', 'narrative', 'identity', 'worldview',
  'goals', 'drives', 'emotional_triggers', 'clusters', 'in_flight_work',
  'audit_records', 'raw_units', 'config',
]);
const MEMORY_IMPORT_SECTIONS = new Set(['memories']);
const PROTECTED_SECTIONS = new Set([
  'identity', 'worldview', 'drives', 'emotional_triggers', 'narrative', 'goals',
]);
const ARRAY_SECTIONS = new Set([
  'memories', 'episodes', 'relationships', 'identity', 'worldview', 'goals',
  'drives', 'emotional_triggers', 'clusters', 'raw_units',
]);
const OBJECT_SECTIONS = new Set(['narrative', 'in_flight_work', 'audit_records', 'config']);
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_STAGED_MEMORIES = 256;
const EXPORT_ID_PATTERN = /^exp_[0-9a-f]{16}$/;
const REF_PATTERN = /^exp_[0-9a-f]{16}:.+$/;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDateTime(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
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
    value.slice(0, MAX_STAGED_MEMORIES).forEach((raw, index) => {
      const row = record(raw);
      if (!row) {
        issues.push({ path: path + '[' + index + ']', kind: 'schema', detail: 'Section entries must be objects.' });
        return;
      }
      if (section === 'memories') {
        if (!nonEmptyString(row.ref) || !REF_PATTERN.test(row.ref) || !row.ref.startsWith(exportId + ':')) {
          issues.push({ path: path + '[' + index + '].ref', kind: 'schema', detail: 'Memory refs must be unique export-scoped HMX references for this document.' });
        }
        if (!nonEmptyString(row.type)) {
          issues.push({ path: path + '[' + index + '].type', kind: 'schema', detail: 'Memory records require a type string.' });
        }
        if (typeof row.content !== 'string' || !row.content.trim()) {
          issues.push({ path: path + '[' + index + '].content', kind: 'schema', detail: 'Memory records require non-empty content to be imported.' });
        }
        for (const dateField of ['created_at', 'updated_at', 'valid_from', 'last_accessed']) {
          if (row[dateField] != null && !isDateTime(row[dateField])) {
            issues.push({ path: path + '[' + index + '].' + dateField, kind: 'schema', detail: 'Optional memory timestamps must be valid ISO date-times.' });
          }
        }
        if (row.valid_until != null && !isDateTime(row.valid_until)) {
          issues.push({ path: path + '[' + index + '].valid_until', kind: 'schema', detail: 'valid_until must be null or a valid ISO date-time.' });
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
      }
      if (!MEMORY_IMPORT_SECTIONS.has(section)) {
        issues.push({
          path: path + '[' + index + ']',
          kind: 'unsupported-import-section',
          detail: 'This section is recognized by HMX 1.7 but is not yet mapped to canonical NK1 memory; import is blocked rather than silently dropping it.',
        });
      }
    });
  } else {
    const objectValue = record(value);
    if (objectValue && Object.keys(objectValue).length > 0 && !MEMORY_IMPORT_SECTIONS.has(section)) {
      issues.push({
        path,
        kind: 'unsupported-import-section',
        detail: 'This section is recognized by HMX 1.7 but is not yet mapped to canonical NK1 memory; import is blocked rather than silently dropping it.',
      });
    }
  }
}

export function validateHmxV17Document(
  raw: unknown,
  requestedIntent?: CanonicalHmxIntent,
): HmxValidationIssue[] {
  const issues: HmxValidationIssue[] = [];
  let serialized: string;
  try {
    serialized = JSON.stringify(raw);
  } catch {
    return [{ path: '$', kind: 'schema', detail: 'HMX document must be serializable JSON.' }];
  }
  if (typeof serialized !== 'string') {
    return [{ path: '$', kind: 'schema', detail: 'HMX document must be serializable JSON.' }];
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_DOCUMENT_BYTES) {
    return [{ path: '$', kind: 'document-too-large', detail: 'HMX document exceeds NK1’s 2 MiB staging limit.' }];
  }

  const document = record(raw);
  if (!document) return [{ path: '$', kind: 'schema', detail: 'HMX document must be a JSON object.' }];

  if (document.hmx_version !== '1.7') {
    issues.push({ path: 'hmx_version', kind: 'unsupported-version', detail: 'NK1 validates the upstream HMX 1.7 contract only.' });
  }
  const exportId = typeof document.export_id === 'string' ? document.export_id : '';
  if (!EXPORT_ID_PATTERN.test(exportId)) {
    issues.push({ path: 'export_id', kind: 'schema', detail: 'HMX export_id must match exp_ followed by 16 lowercase hex characters.' });
  }
  const documentIntent = document.export_intent;
  if (!['port', 'duplicate', 'telepathy', 'analysis'].includes(String(documentIntent))) {
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
      if (!nonEmptyString(source[key])) {
        issues.push({ path: 'source.' + key, kind: 'schema', detail: 'Required source metadata must be a non-empty string.' });
      }
    }
    if (!Number.isSafeInteger(source.embedding_dimension) || Number(source.embedding_dimension) < 1) {
      issues.push({ path: 'source.embedding_dimension', kind: 'schema', detail: 'HMX source embedding_dimension must be a positive integer.' });
    }
  }

  const sections = record(document.sections);
  if (!sections || Object.keys(sections).length === 0) {
    issues.push({ path: 'sections', kind: 'schema', detail: 'HMX sections must be a non-empty object.' });
    return issues;
  }

  for (const [name, value] of Object.entries(sections)) describeSection(name, value, exportId, issues);

  const intent = String(documentIntent);
  const presentProtected = Object.keys(sections).filter(name => PROTECTED_SECTIONS.has(name) &&
    (Array.isArray(sections[name]) ? (sections[name] as unknown[]).length > 0 :
      Boolean(record(sections[name]) && Object.keys(record(sections[name])!).length)));
  if (presentProtected.length && ['telepathy', 'analysis', 'port'].includes(intent)) {
    issues.push({
      path: 'sections',
      kind: 'protected-by-intent',
      detail: 'Protected identity/worldview/drive/narrative sections cannot enter NK1 through the memory-only import path: ' + presentProtected.join(', '),
    });
  }

  const memories = sections.memories;
  if (!Array.isArray(memories)) {
    issues.push({ path: 'sections.memories', kind: 'schema', detail: 'This NK1 import path requires a memories array.' });
  }

  const refs = new Set<string>();
  if (Array.isArray(memories)) {
    memories.forEach((rawMemory, index) => {
      const row = record(rawMemory);
      if (!row || typeof row.ref !== 'string') return;
      if (refs.has(row.ref)) issues.push({ path: 'sections.memories[' + index + '].ref', kind: 'duplicate-ref', detail: 'Memory refs must be unique within an HMX document.' });
      refs.add(row.ref);
      if (typeof row.content === 'string' && row.content.length > 12000) {
        issues.push({ path: 'sections.memories[' + index + '].content', kind: 'record-too-large', detail: 'NK1 imports at most 12000 characters per memory record.' });
      }
    });
    if (memories.length > MAX_STAGED_MEMORIES && !issues.some(issue => issue.path === 'sections.memories' && issue.kind === 'staging-capacity')) {
      issues.push({ path: 'sections.memories', kind: 'staging-capacity', detail: 'More than 256 memory records require a narrower export.' });
    }
  }

  return issues;
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

function clamp01(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
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
    const safeKey = key.normalize('NFKC').replace(/[\\u0000-\\u001f\\u007f]/g, '').trim().slice(0, 80);
    if (!safeKey) continue;
    output[safeKey] = String(item).normalize('NFKC').replace(/[\\u0000-\\u001f\\u007f]/g, ' ').slice(0, 300);
  }
  return output;
}

function safeIso(value: unknown, fallback: number): string {
  const ms = typeof value === 'number' && Number.isFinite(value) ? value : dateMs(value);
  return new Date(ms ?? fallback).toISOString();
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Builds a schema-compatible, memory-only HMX 1.7 exchange. Protected sections and vectors are intentionally omitted. */
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
    .filter(row => typeof row.content === 'string' && Boolean(String(row.content).trim()) && !row.dormant && row.epistemicStatus !== 'quarantined')
    .sort((a, b) => Number(b.observedAt ?? b.lastAccessAt ?? b.createdAt ?? 0) - Number(a.observedAt ?? a.lastAccessAt ?? a.createdAt ?? 0));
  const selected = candidates.slice(0, MAX_STAGED_MEMORIES);
  let truncatedCount = 0;
  const memories = selected.map((row, index) => {
    const id = String(row.id ?? 'row-' + index).slice(0, 240);
    const kind = nonEmptyString(row.kind) ? row.kind : 'semantic';
    const rawBody = String(row.content);
    const body = rawBody.slice(0, 5000);
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
        acquisition_mode: String(row.source ?? '').startsWith('hexis-hmx-import') ? 'imported_and_accepted' : 'experienced',
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
      ...(candidates.length > memories.length ? ['Export is bounded to the newest ' + String(MAX_STAGED_MEMORIES) + ' eligible memories; ' + String(candidates.length - memories.length) + ' records were not included.'] : []),
      ...(truncatedCount > 0 ? [String(truncatedCount) + ' memory records were truncated to 5000 characters to keep the exchange bounded.'] : []),
    ],
  };
}

/** Normalizes one validated HMX memory without trusting upstream metadata to set NK1 identity or confidence above bounds. */
export function normalizeHmxV17Memory(
  raw: unknown,
  input: { exportId: string; sourceSubjectId?: string; exportedAt?: string },
): Nk1HmxMemoryProjection | null {
  const row = record(raw);
  if (!row || typeof row.content !== 'string' || !row.content.trim() || typeof row.ref !== 'string') return null;
  const metadata = record(row.metadata) ?? {};
  const source = record(row.source_attribution) ?? {};
  const validKinds = new Set(['sensory', 'working', 'episodic', 'semantic', 'procedural', 'social', 'dream']);
  const rawKind = String(metadata.nk1_kind ?? row.type ?? 'semantic').trim().toLowerCase();
  const kind = (validKinds.has(rawKind) ? rawKind : 'semantic') as Nk1HmxMemoryProjection['kind'];
  const validStatus = new Set(['fact', 'belief', 'hypothesis', 'unknown', 'quarantined']);
  const rawStatus = String(metadata.nk1_epistemic_status ?? 'belief').trim().toLowerCase();
  const proposedStatus = validStatus.has(rawStatus) ? rawStatus : 'belief';
  // An external export cannot promote its own rows to verified fact by setting NK1-specific metadata.
  const epistemicStatus = (proposedStatus === 'quarantined' ? 'quarantined'
    : proposedStatus === 'unknown' ? 'unknown'
      : proposedStatus === 'hypothesis' ? 'hypothesis' : 'belief') as Nk1HmxMemoryProjection['epistemicStatus'];
  // Self-reported HMX trust is metadata, not independent evidence. Imported records stay low-authority.
  const trust = Math.min(0.55, clamp01(row.trust_level ?? source.source_authority_01, 0.55));
  const confidence = Math.min(0.55, clamp01(metadata.nk1_confidence ?? row.trust_level, 0.55));
  const salience = clamp01(metadata.nk1_salience ?? row.importance, 0.55);
  const createdAt = dateMs(row.created_at);
  const observedAt = dateMs(row.updated_at) ?? createdAt ?? dateMs(input.exportedAt) ?? Date.now();
  const validFromAt = dateMs(row.valid_from) ?? createdAt ?? observedAt;
  const validUntilAt = row.valid_until == null ? null : dateMs(row.valid_until) ?? null;
  const tags = Array.isArray(metadata.tags) ? metadata.tags.map(String).map(x => x.slice(0, 80)).slice(0, 24) : ['hexis', 'hmx'];
  const contextRecord = record(metadata.context);
  const context: Record<string, string> = {};
  if (contextRecord) {
    for (const [key, value] of Object.entries(contextRecord).slice(0, 12)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        context[String(key).slice(0, 80)] = String(value).slice(0, 300);
      }
    }
  }
  const entities = Array.isArray(metadata.entities) ? metadata.entities.map(String).map(x => x.slice(0, 120)).slice(0, 12) : [];
  return {
    ref: row.ref,
    content: row.content.slice(0, 12000),
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
    independenceKey: 'hexis:' + String(input.sourceSubjectId ?? input.exportId).slice(0, 180),
    evidenceFreshnessAt: observedAt,
  };
}
