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
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
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
        if (!nonEmptyString(row.ref) || !REF_PATTERN.test(row.ref)) {
          issues.push({ path: path + '[' + index + '].ref', kind: 'schema', detail: 'Memory records require an HMX export-scoped ref.' });
        }
        if (!nonEmptyString(row.type)) {
          issues.push({ path: path + '[' + index + '].type', kind: 'schema', detail: 'Memory records require a type string.' });
        }
        if (typeof row.content !== 'string' || !row.content.trim()) {
          issues.push({ path: path + '[' + index + '].content', kind: 'schema', detail: 'Memory records require non-empty content to be imported.' });
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
  } else if (record(value) && Object.keys(value).length > 0 && !MEMORY_IMPORT_SECTIONS.has(section)) {
    issues.push({
      path,
      kind: 'unsupported-import-section',
      detail: 'This section is recognized by HMX 1.7 but is not yet mapped to canonical NK1 memory; import is blocked rather than silently dropping it.',
    });
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
  if (!Array.isArray(memories) || memories.length === 0) {
    issues.push({ path: 'sections.memories', kind: 'no-importable-memories', detail: 'This NK1 import path requires at least one memory record.' });
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
