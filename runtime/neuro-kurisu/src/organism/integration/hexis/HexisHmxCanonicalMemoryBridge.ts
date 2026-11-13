import { createHash } from 'node:crypto';
import type { MemoryLifecycleEncodeInput, MemoryFabric } from '../../memory/MemoryFabric.ts';
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
  episodeCount: number;
  relationshipCount: number;
  clusterCount: number;
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
  relationshipsApplied: number;
  clustersApplied: number;
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
  'in_flight_work',
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

type HmxRelationshipMapping = {
  channel: 'semanticLinks'|'temporalLinks'|'causalLinks'|'contradictionLinks';
  direction: 'forward'|'reverse'|'both';
};

function relationshipChannel(edgeType: string): HmxRelationshipMapping {
  const edge = edgeType.toUpperCase();
  if (['CAUSES','CAUSE','LEADS_TO','RESULTS_IN','PREVENTS'].includes(edge)) return { channel: 'causalLinks', direction: 'forward' };
  if (edge === 'CAUSED_BY') return { channel: 'causalLinks', direction: 'reverse' };
  if (['BEFORE','PRECEDES','DURING','CONTAINS','TEMPORAL','NEXT'].includes(edge)) return { channel: 'temporalLinks', direction: 'forward' };
  if (['AFTER','FOLLOWS'].includes(edge)) return { channel: 'temporalLinks', direction: 'reverse' };
  if (['CONTRADICTS','CONTRADICTED_BY','CONFLICTS_WITH'].includes(edge)) return { channel: 'contradictionLinks', direction: 'both' };
  return { channel: 'semanticLinks', direction: 'forward' };
}

/**
 * Narrow HMX 1.x adapter. Only portable memory records enter the existing
 * MemoryFabric -> MemoryOS2 mutation path. Other supported sections remain in
 * staging for a later adapter. Protected constitution sections are rejected.
 *
 * Imported claims remain low-authority external hypotheses. Donor trust,
 * embeddings, permissions, goals, skills and executable work are not imported.
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
    let doc: Record<string, unknown>;
    let serialized: string;
    try {
      const detached = snapshotPlainData(input.document);
      if (!isRecord(detached)) throw new Error('root-not-object');
      doc = detached;
      serialized = JSON.stringify(doc);
    } catch {
      return { ok: false, memoryCount: 0, episodeCount: 0, relationshipCount: 0, clusterCount: 0,
        deferredSections: [], warnings, conflicts: [{ path: '$', kind: 'serialization', detail: 'HMX document must be bounded inert plain data' }] };
    }

    if (Buffer.byteLength(serialized, 'utf8') > MAX_DOCUMENT_BYTES) {
      conflicts.push({ path: '$', kind: 'size-limit', detail: 'HMX document exceeds 2 MiB bridge limit' });
    }
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
    if (doc.export_intent === 'analysis') {
      conflicts.push({ path: 'export_intent', kind: 'analysis-only', detail: 'Analysis-only exports are never admitted to canonical memory' });
    }
    if (!isRecord(doc.sections)) {
      conflicts.push({ path: 'sections', kind: 'schema', detail: 'sections must be an object' });
    }
    if (conflicts.length) return { ok: false, memoryCount: 0, episodeCount: 0, relationshipCount: 0,
      deferredSections: [], warnings, conflicts };

    const sections = doc.sections as Record<string, unknown>;
    const names = Object.keys(sections);
    const protectedNames = names.filter(name => PROTECTED_SECTIONS.has(name));
    if (protectedNames.length) {
      conflicts.push({ path: 'sections', kind: 'protected-section-review-required',
        detail: 'Constitutional sections cannot be imported by the canonical memory bridge: ' + protectedNames.join(', ') });
    }
    for (const name of names) {
      const value = sections[name];
      if (Array.isArray(value) && value.length > MAX_MEMORY_RECORDS) {
        conflicts.push({ path: 'sections.' + name, kind: 'record-limit', detail: 'Each staged section is limited to 64 records' });
      }
    }
    const unknown = names.filter(name => !SUPPORTED_SECTIONS.has(name));
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

    const episodes = sections.episodes ?? [];
    if (!Array.isArray(episodes) || episodes.length > MAX_MEMORY_RECORDS) {
      conflicts.push({ path: 'sections.episodes', kind: 'record-limit', detail: 'episodes must be an array of at most 64 records' });
    } else {
      episodes.forEach((record, index) => {
        if (!isRecord(record) || !safeText(record.ref, 512) || !SAFE_REF.test(record.ref) ||
            (record.summary !== null && record.summary !== undefined && !safeText(record.summary, MAX_CONTENT_LENGTH)) ||
            (record.memory_refs !== undefined && (!Array.isArray(record.memory_refs) ||
              record.memory_refs.length > MAX_MEMORY_RECORDS ||
              record.memory_refs.some(ref => !safeText(ref, 512) || !SAFE_REF.test(ref))))) {
          conflicts.push({ path: 'sections.episodes[' + index + ']', kind: 'schema',
            detail: 'Each episode requires a safe ref, optional bounded summary and bounded memory_refs' });
        }
        for (const key of ['started_at','ended_at']) {
          if (record && isRecord(record) && record[key] !== undefined && record[key] !== null && safeTime(record[key]) === undefined) {
            conflicts.push({ path: 'sections.episodes[' + index + '].' + key, kind: 'timestamp',
              detail: 'Episode timestamps must be valid non-negative dates or milliseconds' });
          }
        }
      });
    }

    const clusters = sections.clusters ?? [];
    if (!Array.isArray(clusters) || clusters.length > MAX_MEMORY_RECORDS) {
      conflicts.push({ path: 'sections.clusters', kind: 'record-limit', detail: 'clusters must be an array of at most 64 records' });
    } else {
      clusters.forEach((record, index) => {
        if (!isRecord(record) || !safeText(record.ref, 512) || !SAFE_REF.test(record.ref) ||
            !Array.isArray(record.member_refs) || record.member_refs.length > MAX_MEMORY_RECORDS ||
            record.member_refs.some(ref => !safeText(ref, 512) || !SAFE_REF.test(ref)) ||
            (record.name !== undefined && record.name !== null && !safeText(record.name, 256)) ||
            (record.cluster_type !== undefined && record.cluster_type !== null && !safeText(record.cluster_type, 128))) {
          conflicts.push({ path: 'sections.clusters[' + index + ']', kind: 'schema',
            detail: 'Each cluster requires a safe ref, bounded member_refs and optional bounded name/type' });
        }
      });
    }

    const relationships = sections.relationships ?? [];
    if (!Array.isArray(relationships) || relationships.length > MAX_MEMORY_RECORDS) {
      conflicts.push({ path: 'sections.relationships', kind: 'record-limit', detail: 'relationships must be an array of at most 64 records' });
    } else {
      relationships.forEach((record, index) => {
        if (!isRecord(record) || !safeText(record.source_ref, 512) || !SAFE_REF.test(record.source_ref) ||
            !safeText(record.target_ref, 512) || !SAFE_REF.test(record.target_ref) ||
            !safeText(record.edge_type, 128)) {
          conflicts.push({ path: 'sections.relationships[' + index + ']', kind: 'schema',
            detail: 'Each relationship requires safe source_ref, target_ref and edge_type' });
        }
      });
    }
    if (conflicts.length) return { ok: false, memoryCount: 0, episodeCount: 0, relationshipCount: 0,
      deferredSections: [], warnings, conflicts };

    const memoryRecords = Array.isArray(memories) ? memories : [];
    const episodeRecords = Array.isArray(episodes) ? episodes : [];
    const relationshipRecords = Array.isArray(relationships) ? relationships : [];
    const clusterRecords = Array.isArray(clusters) ? clusters : [];
    for (const episode of episodeRecords) {
      if (!safeText((episode as Record<string, unknown>).summary, MAX_CONTENT_LENGTH)) {
        warnings.push({ code: 'episode-summary-missing', section: 'episodes',
          ref: String((episode as Record<string, unknown>).ref), detail: 'Episode without a summary is staged but will not create a canonical memory item' });
      }
    }
    for (const section of names) {
      if (DEFERRED_SECTIONS.has(section) && sections[section] !== undefined) {
        warnings.push({ code: 'section-deferred', section,
          detail: 'Section is preserved in the stage but is not applied to canonical memory in this bridge version' });
      }
    }

    const intent = doc.export_intent as HexisHmxIntent;
    const stage = this.adaptation.stageHmx({ document: doc, intent, strategy: 'additive' });
    if (stage.conflicts.length) {
      return { ok: false, memoryCount: 0, episodeCount: 0, relationshipCount: 0,
        deferredSections: [], warnings, conflicts: stage.conflicts };
    }
    return {
      ok: true,
      stagingId: stage.stagingId,
      exportId: stage.exportId,
      memoryCount: memoryRecords.length,
      episodeCount: episodeRecords.filter(record => isRecord(record) && safeText(record.summary, MAX_CONTENT_LENGTH)).length,
      relationshipCount: relationshipRecords.length,
      clusterCount: clusterRecords.filter(record => isRecord(record) && safeText(record.name, 256) && Array.isArray(record.member_refs) && record.member_refs.length > 0).length,
      deferredSections: names.filter(name => DEFERRED_SECTIONS.has(name)),
      warnings,
      conflicts: [],
    };
  }

  commit(stagingId: string): HmxBridgeCommitResult {
    const stage = this.adaptation.getHmxStage(stagingId);
    if (!stage) {
      return { ok: false, stagingId, exportId: '', inserted: 0, replayed: 0, relationshipsApplied: 0, clustersApplied: 0, refMap: {}, warnings: [], error: 'stage-not-found' };
    }
    if (stage.strategy !== 'additive' || stage.intent === 'analysis') {
      return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0, relationshipsApplied: 0, clustersApplied: 0, refMap: {}, warnings: [], error: 'unsupported-import-strategy' };
    }
    if (stage.status === 'rejected') {
      return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0, relationshipsApplied: 0, clustersApplied: 0, refMap: {}, warnings: [], error: 'stage-rejected' };
    }

    const rawMemories = stage.stagedSections.memories ?? [];
    const rawEpisodes = stage.stagedSections.episodes ?? [];
    const rawRelationships = stage.stagedSections.relationships ?? [];
    const rawClusters = stage.stagedSections.clusters ?? [];
    if (!Array.isArray(rawMemories) || rawMemories.length > MAX_MEMORY_RECORDS ||
        !Array.isArray(rawEpisodes) || rawEpisodes.length > MAX_MEMORY_RECORDS ||
        !Array.isArray(rawRelationships) || rawRelationships.length > MAX_MEMORY_RECORDS ||
        !Array.isArray(rawClusters) || rawClusters.length > MAX_MEMORY_RECORDS) {
      return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0, relationshipsApplied: 0, clustersApplied: 0, refMap: {}, warnings: [], error: 'staged-section-invalid' };
    }

    const warnings: HmxBridgeWarning[] = [];
    const refToId = new Map<string, string>();
    const prepared: Array<{ ref: string; input: MemoryLifecycleEncodeInput; commandId: string }> = [];
    const links = new Map<string, { semantic: string[]; temporal: string[]; causal: string[]; contradiction: string[]; edges: string[] }>();
    const addRef = (ref: string, id: string): boolean => {
      if (refToId.has(ref)) return false;
      refToId.set(ref, id);
      links.set(ref, { semantic: [], temporal: [], causal: [], contradiction: [], edges: [] });
      return true;
    };

    for (const raw of rawMemories) {
      if (!isRecord(raw) || !safeText(raw.ref, 512) || !SAFE_REF.test(raw.ref) ||
          !safeText(raw.content, MAX_CONTENT_LENGTH) || !safeText(raw.type, 128)) {
        return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0, relationshipsApplied: 0, clustersApplied: 0, refMap: {}, warnings, error: 'staged-memory-record-invalid' };
      }
      if (!addRef(raw.ref, stableId(stage.exportId, raw.ref))) {
        return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0, relationshipsApplied: 0, clustersApplied: 0, refMap: {}, warnings, error: 'duplicate-external-ref' };
      }
    }
    for (const raw of rawEpisodes) {
      if (!isRecord(raw) || !safeText(raw.ref, 512) || !SAFE_REF.test(raw.ref)) {
        return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0, relationshipsApplied: 0, clustersApplied: 0, refMap: {}, warnings, error: 'staged-episode-record-invalid' };
      }
      if (!safeText(raw.summary, MAX_CONTENT_LENGTH)) {
        warnings.push({ code: 'episode-summary-missing', section: 'episodes', ref: raw.ref,
          detail: 'Episode was not imported because its summary is absent' });
        continue;
      }
      if (!addRef(raw.ref, stableId(stage.exportId, 'episode:' + raw.ref))) {
        return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0, relationshipsApplied: 0, clustersApplied: 0, refMap: {}, warnings, error: 'duplicate-external-ref' };
      }
    }

    for (const raw of rawClusters) {
      if (!isRecord(raw) || !safeText(raw.ref, 512) || !SAFE_REF.test(raw.ref) ||
          !safeText(raw.name, 256) || !Array.isArray(raw.member_refs)) {
        warnings.push({ code: 'cluster-not-imported', section: 'clusters',
          detail: 'Cluster without a safe name and member_refs is staged but not projected' });
        continue;
      }
      if (!addRef(raw.ref, stableId(stage.exportId, 'cluster:' + raw.ref))) {
        return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0, relationshipsApplied: 0, clustersApplied: 0, refMap: {}, warnings, error: 'duplicate-external-ref' };
      }
    }

    for (const raw of rawMemories) {
      const record = raw as Record<string, unknown>;
      const ref = record.ref as string;
      const hmxType = (record.type as string).toLowerCase();
      const kind = hmxType === 'episodic' ? 'episodic' : hmxType === 'social' ? 'social' : 'semantic';
      if (!['episodic', 'social', 'semantic'].includes(hmxType)) {
        warnings.push({ code: 'memory-kind-normalized', ref, detail: 'Unmapped HMX memory type was retained as semantic with original type in provenance context' });
      }
      const sourceInstance = stage.sourceSubjectId || 'external-unknown';
      const memoryId = refToId.get(ref)!;
      const sourceTime = safeTime(record.created_at) ?? safeTime(record.updated_at);
      const observedAt = sourceTime !== undefined && sourceTime <= stage.createdAt ? sourceTime : undefined;
      if (sourceTime !== undefined && sourceTime > stage.createdAt) {
        warnings.push({ code: 'future-source-time-ignored', ref, detail: 'Future donor timestamp was ignored to prevent freshness inflation' });
      }
      const relation = links.get(ref)!;
      const memoryInput: MemoryLifecycleEncodeInput = {
        id: memoryId,
        content: record.content as string,
        kind,
        salience: typeof record.importance === 'number' && Number.isFinite(record.importance)
          ? Math.max(0, Math.min(1, record.importance)) : 0.35,
        emotionalWeight: 0,
        identityRelevance: 0,
        goalRelevance: 0,
        socialRelevance: kind === 'social' ? 0.2 : 0,
        predictionError: 0,
        confidence: 0.25,
        epistemicStatus: 'hypothesis',
        source: 'hmx:' + sourceInstance,
        entities: [],
        semanticLinks: relation.semantic,
        temporalLinks: relation.temporal,
        causalLinks: relation.causal,
        contradictionLinks: relation.contradiction,
        provenanceClass: 'external',
        sourceAuthority01: 0.2,
        independenceKey: 'hmx:' + sourceInstance,
        evidenceFreshnessAt: observedAt ?? stage.createdAt,
        ...(observedAt === undefined ? {} : { observedAt, validFromAt: observedAt }),
        tags: ['external-import', 'hmx-1x', 'unverified-source'],
        context: {
          hmxExportId: stage.exportId,
          hmxSourceInstance: sourceInstance,
          hmxSourceRef: ref,
          hmxOriginalType: hmxType.slice(0, 128),
          hmxAcquisition: 'staged-explicit-acceptance',
          ...(relation.edges.length ? { hmxRelationshipEdges: JSON.stringify(relation.edges).slice(0, 4000) } : {}),
        },
      };
      const commandId = 'hmx-import:' + stage.exportId + ':' + createHash('sha256').update(ref).digest('hex').slice(0, 24);
      prepared.push({ ref, input: memoryInput, commandId });
    }

    for (const raw of rawEpisodes) {
      if (!isRecord(raw) || !safeText(raw.ref, 512) || !SAFE_REF.test(raw.ref) ||
          !safeText(raw.summary, MAX_CONTENT_LENGTH)) continue;
      const ref = raw.ref;
      const sourceInstance = stage.sourceSubjectId || 'external-unknown';
      const relation = links.get(ref)!;
      const memberRefs = Array.isArray(raw.memory_refs) ? raw.memory_refs.filter((value): value is string => safeText(value, 512) && SAFE_REF.test(value)) : [];
      for (const memberRef of memberRefs) {
        const targetId = refToId.get(memberRef);
        if (targetId) relation.temporal.push(targetId);
        else warnings.push({ code: 'episode-member-not-imported', section: 'episodes', ref: memberRef,
          detail: 'Episode member ref is outside the imported portable record set' });
      }
      const sourceStart = safeTime(raw.started_at);
      const observedAt = sourceStart !== undefined && sourceStart <= stage.createdAt ? sourceStart : undefined;
      if (sourceStart !== undefined && sourceStart > stage.createdAt) {
        warnings.push({ code: 'future-episode-time-ignored', section: 'episodes', ref,
          detail: 'Future episode start timestamp was ignored' });
      }
      const memoryInput: MemoryLifecycleEncodeInput = {
        id: refToId.get(ref)!,
        content: raw.summary as string,
        kind: 'episodic',
        salience: 0.45,
        emotionalWeight: 0,
        identityRelevance: 0,
        goalRelevance: 0,
        socialRelevance: 0,
        predictionError: 0,
        confidence: 0.25,
        epistemicStatus: 'hypothesis',
        source: 'hmx:' + sourceInstance,
        entities: [],
        semanticLinks: relation.semantic,
        temporalLinks: relation.temporal,
        causalLinks: relation.causal,
        contradictionLinks: relation.contradiction,
        provenanceClass: 'external',
        sourceAuthority01: 0.2,
        independenceKey: 'hmx:' + sourceInstance,
        evidenceFreshnessAt: observedAt ?? stage.createdAt,
        ...(observedAt === undefined ? {} : { observedAt, validFromAt: observedAt }),
        tags: ['external-import', 'hmx-1x', 'unverified-source', 'episode'],
        context: {
          hmxExportId: stage.exportId,
          hmxSourceInstance: sourceInstance,
          hmxSourceRef: ref,
          hmxSection: 'episodes',
          hmxEpisodeStartedAt: typeof raw.started_at === 'string' ? raw.started_at.slice(0, 64) : '',
          hmxEpisodeEndedAt: typeof raw.ended_at === 'string' ? raw.ended_at.slice(0, 64) : '',
          hmxAcquisition: 'staged-explicit-acceptance',
        },
      };
      const commandId = 'hmx-import:' + stage.exportId + ':episode:' +
        createHash('sha256').update(ref).digest('hex').slice(0, 24);
      prepared.push({ ref, input: memoryInput, commandId });
    }

    let clustersApplied = 0;
    for (const raw of rawClusters) {
      if (!isRecord(raw) || !safeText(raw.ref, 512) || !SAFE_REF.test(raw.ref) ||
          !safeText(raw.name, 256) || !Array.isArray(raw.member_refs)) continue;
      const ref = raw.ref;
      const relation = links.get(ref);
      if (!relation) continue;
      const memberRefs = raw.member_refs.filter((value): value is string => safeText(value, 512) && SAFE_REF.test(value));
      let linkedMembers = 0;
      for (const memberRef of memberRefs) {
        const memberId = refToId.get(memberRef);
        const memberLinks = links.get(memberRef);
        if (!memberId || !memberLinks) {
          warnings.push({ code: 'cluster-member-not-imported', section: 'clusters', ref: memberRef,
            detail: 'Cluster member ref is outside the imported portable record set' });
          continue;
        }
        if (!relation.semantic.includes(memberId)) relation.semantic.push(memberId);
        const clusterId = refToId.get(ref)!;
        if (!memberLinks.semantic.includes(clusterId)) memberLinks.semantic.push(clusterId);
        linkedMembers++;
      }
      if (linkedMembers === 0) {
        refToId.delete(ref);
        links.delete(ref);
        warnings.push({ code: 'cluster-without-members', section: 'clusters', ref,
          detail: 'Cluster was not imported because none of its members were available in the portable record set' });
        continue;
      }
      const sourceInstance = stage.sourceSubjectId || 'external-unknown';
      const clusterInput: MemoryLifecycleEncodeInput = {
        id: refToId.get(ref)!,
        content: raw.name as string,
        kind: 'semantic',
        salience: 0.4,
        emotionalWeight: 0,
        identityRelevance: 0,
        goalRelevance: 0,
        socialRelevance: 0,
        predictionError: 0,
        confidence: 0.25,
        epistemicStatus: 'hypothesis',
        source: 'hmx:' + sourceInstance,
        entities: [],
        semanticLinks: relation.semantic,
        temporalLinks: [],
        causalLinks: [],
        contradictionLinks: [],
        provenanceClass: 'external',
        sourceAuthority01: 0.2,
        independenceKey: 'hmx:' + sourceInstance,
        evidenceFreshnessAt: stage.createdAt,
        tags: ['external-import', 'hmx-1x', 'unverified-source', 'cluster'],
        context: {
          hmxExportId: stage.exportId,
          hmxSourceInstance: sourceInstance,
          hmxSourceRef: ref,
          hmxSection: 'clusters',
          hmxClusterType: safeText(raw.cluster_type, 128) ? raw.cluster_type : 'unspecified',
          hmxAcquisition: 'staged-explicit-acceptance',
        },
      };
      const commandId = 'hmx-import:' + stage.exportId + ':cluster:' +
        createHash('sha256').update(ref).digest('hex').slice(0, 24);
      prepared.push({ ref, input: clusterInput, commandId });
      clustersApplied++;
    }

    let relationshipsApplied = 0;
    for (const raw of rawRelationships) {
      if (!isRecord(raw) || !safeText(raw.source_ref, 512) || !safeText(raw.target_ref, 512) || !safeText(raw.edge_type, 128)) continue;
      if (!links.has(raw.source_ref) || !refToId.has(raw.target_ref)) {
        warnings.push({ code: 'relationship-endpoint-not-imported', section: 'relationships', ref: raw.source_ref,
          detail: 'Relationship endpoint is outside the imported portable record set' });
        continue;
      }
      const mapping = relationshipChannel(raw.edge_type);
      const key = mapping.channel === 'semanticLinks' ? 'semantic' : mapping.channel === 'temporalLinks' ? 'temporal' :
        mapping.channel === 'causalLinks' ? 'causal' : 'contradiction';
      const addLink = (fromRef: string, toRef: string, direction: string): void => {
        const source = links.get(fromRef);
        const targetId = refToId.get(toRef);
        if (!source || !targetId) return;
        if (!source[key].includes(targetId)) source[key].push(targetId);
        source.edges.push(JSON.stringify({ target: toRef, edgeType: raw.edge_type, direction }));
      };
      if (mapping.direction === 'forward') addLink(raw.source_ref, raw.target_ref, 'forward');
      else if (mapping.direction === 'reverse') addLink(raw.target_ref, raw.source_ref, 'reverse');
      else {
        addLink(raw.source_ref, raw.target_ref, 'both');
        addLink(raw.target_ref, raw.source_ref, 'both');
      }
      relationshipsApplied++;
      if (isRecord(raw.properties) && Object.keys(raw.properties).length) {
        warnings.push({ code: 'relationship-properties-ignored', section: 'relationships', ref: raw.source_ref,
          detail: 'Untrusted relationship properties are not imported; only the bounded edge type is applied' });
      }
    }

    // Relationships are resolved after all endpoints are known; rebuild prepared inputs
    // so every canonical record receives its final link arrays before the first write.
    for (const record of prepared) {
      const relation = links.get(record.ref);
      if (!relation) continue;
      record.input.semanticLinks = [...new Set(relation.semantic)];
      record.input.temporalLinks = [...new Set(relation.temporal)];
      record.input.causalLinks = [...new Set(relation.causal)];
      record.input.contradictionLinks = [...new Set(relation.contradiction)];
      if (relation.edges.length && record.input.context) {
        record.input.context.hmxRelationshipEdges = JSON.stringify(relation.edges).slice(0, 4000);
      }
    }

    if (stage.status === 'staged') {
      const accepted = this.adaptation.decideHmx(stagingId, 'accept');
      if (!accepted || accepted.status !== 'accepted') {
        return { ok: false, stagingId, exportId: stage.exportId, inserted: 0, replayed: 0, relationshipsApplied: 0, clustersApplied: 0, refMap: {}, warnings, error: 'stage-acceptance-failed' };
      }
    }

    const refMap: Record<string, string> = {};
    let inserted = 0;
    let replayed = 0;
    try {
      for (const record of prepared) {
        const prior = this.memory.getCanonicalMemory(record.input.id!);
        const item = this.memory.encode(record.input, { commandId: record.commandId, emitEvent: true, forceDistinct: true });
        if (!item) throw new Error('canonical-memory-write-returned-empty');
        refMap[record.ref] = item.id;
        if (prior) replayed++; else inserted++;
      }
    } catch (error) {
      warnings.push({
        code: 'partial-commit-retryable',
        detail: error instanceof Error ? error.message.slice(0, 240) : 'unknown-commit-error',
      });
      return { ok: false, stagingId, exportId: stage.exportId, inserted, replayed, relationshipsApplied, clustersApplied, refMap, warnings, error: 'partial-commit-retryable' };
    }
    return { ok: true, stagingId, exportId: stage.exportId, inserted, replayed, relationshipsApplied, clustersApplied, refMap, warnings };
  }

}
