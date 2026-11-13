import { createHash } from 'node:crypto';
import type { MemoryLifecycleEncodeInput } from '../../memory/MemoryFabric.ts';
import type { MemoryFabric } from '../../memory/MemoryFabric.ts';
import { snapshotPlainData } from '../../core/PlainDataSnapshot.ts';
import type { HexisAdaptationFabric, HexisHmxIntent } from './HexisAdaptationFabric.ts';

export type HmxBridgeWarning = {
  code: string;
  section?: string;
  ref?: string;
  detail: string;
};

export interface HmxBridgeStageResult {
  ok: boolean;
  stagingId?: string;
  exportId?: string;
  memoryCount: number;
  deferredSections: string[];
  warnings: HmxBridgeWarning[];
  conflicts: Array<{ path: string; kind: string; detail: string }>;
}

export interface HmxBridgeCommitResult {
  ok: boolean;
  stagingId: string;
  exportId: string;
  inserted: number;
  replayed: number;
  refMap: Record<string, string>;
  warnings: HmxBridgeWarning[];
  error?: string;
}

const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_MEMORY_RECORDS = 64;
const MAX_CONTENT_LENGTH = 16_000;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/_-]{0,511}$/u;
const PROTECTED_SECTIONS = new Set([
  'identity', 'worldview', 'drives', 'emotional_triggers', 'narrative', 'goals',
]);
const SUPPORTED_SECTIONS = new Set([
  'memories', 'episodes', 'relationships', 'clusters',
  ...PROTECTED_SECTIONS,
  'in_flight_work', 'audit_records', 'raw_units', 'config',
]);
const DEFERRED_SECTIONS = new Set([
  'episodes', 'relationships', 'clusters', 'in_flight_work',
  'audit_records', 'raw_units', 'config',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 &&
    value.length <= max && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

function safeTime(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && value.length <= 64) {
    const parsed = Date.parse(value);
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

function stableId(exportId: string, ref: string): string {
  return 'hmx_' + createHash('sha256').update(exportId).update('\0').update(ref).digest('hex').slice(0, 40);
}

/**
 * A deliberately narrow HMX 1.x adapter. It admits only portable memory records
 * into the existing MemoryFabric -> MemoryOS2 mutation path. Every other HMX
 * section is retained in the accepted stage for a later, separately reviewed
 * adapter; protected constitution sections are never applied here.
 *
 * Imported claims remain hypotheses with low source authority. HMX trust,
 * identity, permissions, goals, embeddings and executable work are not imported.
 */
export class HexisHmxCanonicalMemoryBridge {
  private readonly adaptation: HexisAdaptationFabric;
  private readonly memory: MemoryFabric;

  constructor(adaptation: HexisAdaptationFabric, memory: MemoryFabric) {
    this.adaptation = adaptation;
    this.memory = memory;
  }

  stage(input: { document: unknown; intent?: HexisHmxIntent }): HmxBridgeStageResult {
    const warnings: HmxBridgeWarning[] = [];
    const conflicts: HmxBridgeStageResult['conflicts'] = [];
    if (!isRecord(input.document)) {
      return { ok: false, memoryCount: 0, deferredSections: [], warnings,
        conflicts: [{ path: '$', kind: 'schema', detail: 'HMX document must be an object' }] };
    }
    let doc: Record<string, unknown>;
    let serialized: string;
    try {
      const detached = snapshotPlainData(input.document);
      if (!isRecord(detached)) throw new Error('root-not-object');
      doc = detached;
      serialized = JSON.stringify(doc);
    } catch {
      return { ok: false, memoryCount: 0, deferredSections: [], warnings,
        conflicts: [{ path: '
      conflicts.push({ path: '$', kind: 'size-limit', detail: 'HMX document exceeds 2 MiB bridge limit' });
    }
    const doc = input.document;
    if (typeof doc.hmx_version !== 'string' || !/^1\.[0-9]+$/u.test(doc.hmx_version)) {
      conflicts.push({ path: 'hmx_version', kind: 'unsupported-version', detail: 'Only explicit HMX 1.x versions are accepted' });
    }
    if (!safeText(doc.export_id, 128) || !SAFE_REF.test(doc.export_id)) {
      conflicts.push({ path: 'export_id', kind: 'schema', detail: 'export_id must be a bounded stable identifier' });
    }
    if (!isRecord(doc.source) || !safeText(doc.source.instance_id, 256)) {
      conflicts.push({ path: 'source.instance_id', kind: 'schema', detail: 'source instance identity is required' });
    }
    if (!['port', 'duplicate', 'telepathy', 'analysis'].includes(String(doc.export_intent))) {
      conflicts.push({ path: 'export_intent', kind: 'schema', detail: 'Unsupported HMX export intent' });
    }
    if (doc.export_intent === 'analysis') {\n      conflicts.push({ path: 'export_intent', kind: 'analysis-only', detail: 'Analysis-only exports are never admitted to canonical memory' });\n    }\n    if (!isRecord(doc.sections)) {
      conflicts.push({ path: 'sections', kind: 'schema', detail: 'sections must be an object' });
    }
    if (conflicts.length) return { ok: false, memoryCount: 0, deferredSections: [], warnings, conflicts };

    const sections = doc.sections as Record<string, unknown>;
    const names = Object.keys(sections);
    const protectedNames = names.filter(name => PROTECTED_SECTIONS.has(name));
    if (protectedNames.length) {
      conflicts.push({ path: 'sections', kind: 'protected-section-review-required',
        detail: 'Constitutional sections cannot be imported by the canonical memory bridge: ' + protectedNames.join(', ') });
    }
    for (const name of names) {\n      const value = sections[name];\n      if (Array.isArray(value) && value.length > MAX_MEMORY_RECORDS) {\n        conflicts.push({ path: 'sections.' + name, kind: 'record-limit', detail: 'Each staged section is limited to 64 records' });\n      }\n    }\n    const unknown = names.filter(name => !SUPPORTED_SECTIONS.has(name));
    if (unknown.length) {
      conflicts.push({ path: 'sections', kind: 'unknown-section', detail: 'Unknown HMX sections are not silently accepted: ' + unknown.join(', ') });
    }
    const memories = sections.memories ?? [];
    if (!Array.isArray(memories) || memories.length > MAX_MEMORY_RECORDS) {
      conflicts.push({ path: 'sections.memories', kind: 'record-limit', detail: 'memories must be an array of at most 64 records' });
    } else {
      memories.forEach((record, index) => {
        if (!isRecord(record) || !safeText(record.ref, 512) || !SAFE_REF.test(record.ref) ||
            !safeText(record.type, 128) || !safeText(record.content, MAX_CONTENT_LENGTH)) {
          conflicts.push({ path: 'sections.memories[' + index + ']', kind: 'schema',
            detail: 'Each memory requires a safe ref, type and non-empty bounded content' });
        }
      });
    }
    if (conflicts.length) return { ok: false, memoryCount: 0, deferredSections: [], warnings, conflicts };

    for (const section of names) {
      if (DEFERRED_SECTIONS.has(section) && sections[section] !== undefined) {
        warnings.push({ code: 'section-deferred', section,
          detail: 'Section is preserved in the stage but is not applied to canonical memory in this bridge version' });
      }
    }
    const intent = doc.export_intent as HexisHmxIntent;
    const stage = this.adaptation.stageHmx({ document: doc, intent, strategy: 'additive' });
    if (stage.conflicts.length) {
      return { ok: false, memoryCount: 0, deferredSections: [], warnings, conflicts: stage.conflicts };
    }
    return {
      ok: true, stagingId: stage.stagingId, exportId: stage.exportId,
      memoryCount: (memories as unknown[]).length,
      deferredSections: names.filter(name => DEFERRED_SECTIONS.has(name)),
      warnings, conflicts: [],
    };
  }

  commit(stagingId: string): HmxBridgeCommitResult {
    const stage = this.adaptation.getHmxStage(stagingId);
    if (!stage) return { ok: false, stagingId, exportId: '', inserted: 0, replayed: 0,
      refMap: {}, warnings: [], error: 'stage-not-found' };
    if (stage.strategy !== 'additive' || stage.intent === 'analysis') return { ok: false, stagingId, exportId: stage.exportId,
      inserted: 0, replayed: 0, refMap: {}, warnings: [], error: 'unsupported-import-strategy' };
    if (stage.status === 'rejected') return { ok: false, stagingId, exportId: stage.exportId,
      inserted: 0, replayed: 0, refMap: {}, warnings: [], error: 'stage-rejected' };

    const memories = stage.stagedSections.memories;
    if (memories !== undefined && (!Array.isArray(memories) || memories.length > MAX_MEMORY_RECORDS)) {
      return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0,
        refMap: {}, warnings: [], error: 'staged-memory-section-invalid' };
    }
    const records = (memories ?? []) as unknown[];
    const prepared: Array<{ ref: string; input: MemoryLifecycleEncodeInput; commandId: string }> = [];
    for (const raw of records) {
      if (!isRecord(raw) || !safeText(raw.ref, 512) || !SAFE_REF.test(raw.ref) ||
          !safeText(raw.content, MAX_CONTENT_LENGTH) || !safeText(raw.type, 128)) {
        return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0,
          refMap: {}, warnings: [], error: 'staged-memory-record-invalid' };
      }
      const ref = raw.ref;
      const hmxType = raw.type.toLowerCase();
      const kind = hmxType === 'episodic' ? 'episodic' :
        hmxType === 'social' ? 'social' : 'semantic';
      const sourceInstance = stage.sourceSubjectId || 'external-unknown';
      const memoryId = stableId(stage.exportId, ref);
      const observedAt = safeTime(raw.created_at) ?? safeTime(raw.updated_at);
      const input: MemoryLifecycleEncodeInput = {
        id: memoryId,
        content: raw.content,
        kind,
        salience: typeof raw.importance === 'number' && Number.isFinite(raw.importance)
          ? Math.max(0, Math.min(1, raw.importance)) : 0.35,
        emotionalWeight: 0,
        identityRelevance: 0,
        goalRelevance: 0,
        socialRelevance: kind === 'social' ? 0.2 : 0,
        predictionError: 0,
        confidence: 0.25,
        epistemicStatus: 'hypothesis',
        source: 'hmx:' + sourceInstance,
        entities: [],
        semanticLinks: [],
        temporalLinks: [],
        causalLinks: [],
        provenanceClass: 'external',
        sourceAuthority01: 0.2,
        independenceKey: 'hmx:' + sourceInstance,
        evidenceFreshnessAt: observedAt ?? Date.now(),
        ...(observedAt === undefined ? {} : { observedAt, validFromAt: observedAt }),
        tags: ['external-import', 'hmx-1x', 'unverified-source'],
        context: {
          hmxExportId: stage.exportId,
          hmxSourceInstance: sourceInstance,
          hmxSourceRef: ref,
          hmxOriginalType: hmxType.slice(0, 128),
          hmxAcquisition: 'staged-explicit-acceptance',
        },
      };
      prepared.push({ ref, input, commandId: 'hmx-import:' + stage.exportId + ':' + createHash('sha256').update(ref).digest('hex').slice(0, 24) });
    }

    if (stage.status === 'staged') {
      const accepted = this.adaptation.decideHmx(stagingId, 'accept');
      if (!accepted || accepted.status !== 'accepted') {
        return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0,
          refMap: {}, warnings: [], error: 'stage-acceptance-failed' };
      }
    }

    const warnings: HmxBridgeWarning[] = [];
    const refMap: Record<string, string> = {};
    let inserted = 0;
    let replayed = 0;
    try {
      for (const record of prepared) {
        const prior = this.memory.getCanonicalMemory(record.input.id!);
        const item = this.memory.encode(record.input, { commandId: record.commandId, emitEvent: true });
        if (!item) throw new Error('canonical-memory-write-returned-empty');
        refMap[record.ref] = item.id;
        if (prior) replayed++; else inserted++;
      }
    } catch (error) {
      warnings.push({ code: 'partial-commit-retryable', detail: error instanceof Error ? error.message.slice(0, 240) : 'unknown-commit-error' });
      return { ok: false, stagingId, exportId: stage.exportId, inserted, replayed, refMap, warnings,
        error: 'partial-commit-retryable' };
    }
    return { ok: true, stagingId, exportId: stage.exportId, inserted, replayed, refMap, warnings };
  }
}
, kind: 'serialization', detail: 'HMX document must be bounded inert plain data' }] };
    }
    if (Buffer.byteLength(serialized, 'utf8') > MAX_DOCUMENT_BYTES) {
      conflicts.push({ path: '$', kind: 'size-limit', detail: 'HMX document exceeds 2 MiB bridge limit' });
    }
    const doc = input.document;
    if (typeof doc.hmx_version !== 'string' || !/^1\.[0-9]+$/u.test(doc.hmx_version)) {
      conflicts.push({ path: 'hmx_version', kind: 'unsupported-version', detail: 'Only explicit HMX 1.x versions are accepted' });
    }
    if (!safeText(doc.export_id, 128) || !SAFE_REF.test(doc.export_id)) {
      conflicts.push({ path: 'export_id', kind: 'schema', detail: 'export_id must be a bounded stable identifier' });
    }
    if (!isRecord(doc.source) || !safeText(doc.source.instance_id, 256)) {
      conflicts.push({ path: 'source.instance_id', kind: 'schema', detail: 'source instance identity is required' });
    }
    if (!['port', 'duplicate', 'telepathy', 'analysis'].includes(String(doc.export_intent))) {
      conflicts.push({ path: 'export_intent', kind: 'schema', detail: 'Unsupported HMX export intent' });
    }
    if (!isRecord(doc.sections)) {
      conflicts.push({ path: 'sections', kind: 'schema', detail: 'sections must be an object' });
    }
    if (conflicts.length) return { ok: false, memoryCount: 0, deferredSections: [], warnings, conflicts };

    const sections = doc.sections as Record<string, unknown>;
    const names = Object.keys(sections);
    const protectedNames = names.filter(name => PROTECTED_SECTIONS.has(name));
    if (protectedNames.length) {
      conflicts.push({ path: 'sections', kind: 'protected-section-review-required',
        detail: 'Constitutional sections cannot be imported by the canonical memory bridge: ' + protectedNames.join(', ') });
    }
    for (const name of names) {\n      const value = sections[name];\n      if (Array.isArray(value) && value.length > MAX_MEMORY_RECORDS) {\n        conflicts.push({ path: 'sections.' + name, kind: 'record-limit', detail: 'Each staged section is limited to 64 records' });\n      }\n    }\n    const unknown = names.filter(name => !SUPPORTED_SECTIONS.has(name));
    if (unknown.length) {
      conflicts.push({ path: 'sections', kind: 'unknown-section', detail: 'Unknown HMX sections are not silently accepted: ' + unknown.join(', ') });
    }
    const memories = sections.memories ?? [];
    if (!Array.isArray(memories) || memories.length > MAX_MEMORY_RECORDS) {
      conflicts.push({ path: 'sections.memories', kind: 'record-limit', detail: 'memories must be an array of at most 64 records' });
    } else {
      memories.forEach((record, index) => {
        if (!isRecord(record) || !safeText(record.ref, 512) || !SAFE_REF.test(record.ref) ||
            !safeText(record.type, 128) || !safeText(record.content, MAX_CONTENT_LENGTH)) {
          conflicts.push({ path: 'sections.memories[' + index + ']', kind: 'schema',
            detail: 'Each memory requires a safe ref, type and non-empty bounded content' });
        }
      });
    }
    if (conflicts.length) return { ok: false, memoryCount: 0, deferredSections: [], warnings, conflicts };

    for (const section of names) {
      if (DEFERRED_SECTIONS.has(section) && sections[section] !== undefined) {
        warnings.push({ code: 'section-deferred', section,
          detail: 'Section is preserved in the stage but is not applied to canonical memory in this bridge version' });
      }
    }
    const intent = doc.export_intent as HexisHmxIntent;
    const stage = this.adaptation.stageHmx({ document: doc, intent, strategy: 'additive' });
    if (stage.conflicts.length) {
      return { ok: false, memoryCount: 0, deferredSections: [], warnings, conflicts: stage.conflicts };
    }
    return {
      ok: true, stagingId: stage.stagingId, exportId: stage.exportId,
      memoryCount: (memories as unknown[]).length,
      deferredSections: names.filter(name => DEFERRED_SECTIONS.has(name)),
      warnings, conflicts: [],
    };
  }

  commit(stagingId: string): HmxBridgeCommitResult {
    const stage = this.adaptation.getHmxStage(stagingId);
    if (!stage) return { ok: false, stagingId, exportId: '', inserted: 0, replayed: 0,
      refMap: {}, warnings: [], error: 'stage-not-found' };
    if (stage.strategy !== 'additive') return { ok: false, stagingId, exportId: stage.exportId,
      inserted: 0, replayed: 0, refMap: {}, warnings: [], error: 'unsupported-import-strategy' };
    if (stage.status === 'rejected') return { ok: false, stagingId, exportId: stage.exportId,
      inserted: 0, replayed: 0, refMap: {}, warnings: [], error: 'stage-rejected' };

    const memories = stage.stagedSections.memories;
    if (memories !== undefined && (!Array.isArray(memories) || memories.length > MAX_MEMORY_RECORDS)) {
      return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0,
        refMap: {}, warnings: [], error: 'staged-memory-section-invalid' };
    }
    const records = (memories ?? []) as unknown[];
    const prepared: Array<{ ref: string; input: MemoryLifecycleEncodeInput; commandId: string }> = [];
    for (const raw of records) {
      if (!isRecord(raw) || !safeText(raw.ref, 512) || !SAFE_REF.test(raw.ref) ||
          !safeText(raw.content, MAX_CONTENT_LENGTH) || !safeText(raw.type, 128)) {
        return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0,
          refMap: {}, warnings: [], error: 'staged-memory-record-invalid' };
      }
      const ref = raw.ref;
      const hmxType = raw.type.toLowerCase();
      const kind = hmxType === 'episodic' ? 'episodic' :
        hmxType === 'social' ? 'social' : 'semantic';
      const sourceInstance = stage.sourceSubjectId || 'external-unknown';
      const memoryId = stableId(stage.exportId, ref);
      const observedAt = safeTime(raw.created_at) ?? safeTime(raw.updated_at);
      const input: MemoryLifecycleEncodeInput = {
        id: memoryId,
        content: raw.content,
        kind,
        salience: typeof raw.importance === 'number' && Number.isFinite(raw.importance)
          ? Math.max(0, Math.min(1, raw.importance)) : 0.35,
        emotionalWeight: 0,
        identityRelevance: 0,
        goalRelevance: 0,
        socialRelevance: kind === 'social' ? 0.2 : 0,
        predictionError: 0,
        confidence: 0.25,
        epistemicStatus: 'hypothesis',
        source: 'hmx:' + sourceInstance,
        entities: [],
        semanticLinks: [],
        temporalLinks: [],
        causalLinks: [],
        provenanceClass: 'external',
        sourceAuthority01: 0.2,
        independenceKey: 'hmx:' + sourceInstance,
        evidenceFreshnessAt: observedAt ?? Date.now(),
        ...(observedAt === undefined ? {} : { observedAt, validFromAt: observedAt }),
        tags: ['external-import', 'hmx-1x', 'unverified-source'],
        context: {
          hmxExportId: stage.exportId,
          hmxSourceInstance: sourceInstance,
          hmxSourceRef: ref,
          hmxOriginalType: hmxType.slice(0, 128),
          hmxAcquisition: 'staged-explicit-acceptance',
        },
      };
      prepared.push({ ref, input, commandId: 'hmx-import:' + stage.exportId + ':' + createHash('sha256').update(ref).digest('hex').slice(0, 24) });
    }

    if (stage.status === 'staged') {
      const accepted = this.adaptation.decideHmx(stagingId, 'accept');
      if (!accepted || accepted.status !== 'accepted') {
        return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0,
          refMap: {}, warnings: [], error: 'stage-acceptance-failed' };
      }
    }

    const warnings: HmxBridgeWarning[] = [];
    const refMap: Record<string, string> = {};
    let inserted = 0;
    let replayed = 0;
    try {
      for (const record of prepared) {
        const prior = this.memory.getCanonicalMemory(record.input.id!);
        const item = this.memory.encode(record.input, { commandId: record.commandId, emitEvent: true });
        if (!item) throw new Error('canonical-memory-write-returned-empty');
        refMap[record.ref] = item.id;
        if (prior) replayed++; else inserted++;
      }
    } catch (error) {
      warnings.push({ code: 'partial-commit-retryable', detail: error instanceof Error ? error.message.slice(0, 240) : 'unknown-commit-error' });
      return { ok: false, stagingId, exportId: stage.exportId, inserted, replayed, refMap, warnings,
        error: 'partial-commit-retryable' };
    }
    return { ok: true, stagingId, exportId: stage.exportId, inserted, replayed, refMap, warnings };
  }
}
