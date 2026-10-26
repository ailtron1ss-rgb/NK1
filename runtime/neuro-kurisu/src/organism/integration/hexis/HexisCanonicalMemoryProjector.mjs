import { createHash } from 'node:crypto';
import { hasValidHmxApplicationReceipt } from './HexisHmxReceiptGuard.ts';
import { CANONICAL_MEMORY_CAPACITY } from '../../memory/CanonicalMemoryCapacity.ts';

const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const asText = (value, max = 2048) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : '';
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const dateMs = value => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const memoryKind = value => {
  const kind = String(value ?? '').toLowerCase();
  // Imported identity/autobiography memories stay recallable without becoming
  // non-forgettable canonical identity records; structural identity is a separate adapter.
  if (kind === 'identity') return 'semantic';
  if (kind === 'autobiographical') return 'episodic';
  return ['sensory', 'working', 'episodic', 'semantic', 'procedural', 'social', 'dream'].includes(kind)
    ? kind
    : (kind === 'relationship' ? 'social' : 'semantic');
};
const memoryStatus = value => {
  const status = String(value ?? '').toLowerCase();
  return status === 'quarantined' ? 'hypothesis' : 'belief';
};
const contextText = value => {
  if (typeof value === 'string') return value.slice(0, 1200);
  try { return JSON.stringify(value).slice(0, 1200); } catch { return ''; }
};
const arrayOfText = value => Array.isArray(value)
  ? [...new Set(value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim().slice(0, 160)))].slice(0, 32)
  : [];
const stableRecordContent = value => String(value ?? '').normalize('NFKC').trim();

function deferredSectionCounts(sections) {
  const result = {};
  for (const [name, value] of Object.entries(sections ?? {})) {
    if (name === 'memories') continue;
    const count = Array.isArray(value) ? value.length : isRecord(value) ? Object.keys(value).length : 0;
    if (count > 0) result[name] = count;
  }
  return result;
}

/**
 * A narrow Hexis -> NK1 projector.
 * MemoryFabric is the single write path; the adapter never writes persisted JSON directly.
 * Memory references are mapped into SemanticMemoryGraph only when both endpoints are imported
 * memory records. Goals, structural identity, narrative, audit and policy sections remain deferred.
 */
function semanticNodeType(nativeType) {
  const kind = String(nativeType ?? '').toLowerCase();
  if (kind === 'episodic' || kind === 'autobiographical') return 'episode';
  if (kind === 'social' || kind === 'relationship') return 'person';
  return 'concept';
}
function semanticRelationType(nativeType) {
  const kind = String(nativeType ?? '').toLowerCase();
  if (['supports', 'contradicts', 'causes', 'about', 'located', 'associated'].includes(kind)) return kind;
  if (kind === 'supersedes' || kind === 'revises') return 'associated';
  return 'associated';
}
function semanticLabel(value) {
  return String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().slice(0, 96);
}

export class HexisCanonicalMemoryProjector {
  constructor(memoryFabric, semanticGraph, temporalLedger) {
    if (!memoryFabric || typeof memoryFabric.encode !== 'function' || typeof memoryFabric.canonicalSnapshot !== 'function' || typeof memoryFabric.forgetById !== 'function') {
      throw new TypeError('canonical-memory-fabric-required');
    }
    if (semanticGraph !== undefined && (!semanticGraph || typeof semanticGraph.snapshot !== 'function' || typeof semanticGraph.restore !== 'function' || typeof semanticGraph.upsertNode !== 'function' || typeof semanticGraph.connect !== 'function')) {
      throw new TypeError('semantic-memory-graph-required');
    }
    if (temporalLedger !== undefined && (!temporalLedger || typeof temporalLedger.snapshot !== 'function' || typeof temporalLedger.restore !== 'function' || typeof temporalLedger.recordTemporalAssertion !== 'function')) {
      throw new TypeError('hexis-temporal-ledger-required');
    }
    this.memoryFabric = memoryFabric;
    this.semanticGraph = semanticGraph;
    this.temporalLedger = temporalLedger;
  }

  ensureSemanticNode(ref, content, nativeType, salience, nodeIdsByRef, sourceKey = '') {
    if (!this.semanticGraph || nodeIdsByRef.has(ref)) return nodeIdsByRef.get(ref) ?? null;
    const label = semanticLabel(content);
    if (!label) return null;
    const type = semanticNodeType(nativeType);
    // Reuse graph nodes instead of reinforcing them on every re-import.
    const existing = this.semanticGraph.snapshot().nodes.find(node => node.label === label && node.type === type && String(node.sourceKey ?? '') === String(sourceKey ?? ''));
    const node = existing ?? this.semanticGraph.upsertNode(content, type, salience, sourceKey);
    nodeIdsByRef.set(ref, node.id);
    return node.id;
  }

  apply(stage) {
    // Idempotent replay must be checked before the accepted-stage guard: persisted
    // stages transition out of `accepted` after application, but their receipt remains
    // the authoritative answer for retries. This branch performs no writes.
    if (isRecord(stage) && stage.status === 'applied') {
      if (!hasValidHmxApplicationReceipt(stage)) {
        throw new Error('hmx-applied-receipt-invalid');
      }
      return structuredClone(stage.application);
    }
    if (!isRecord(stage) || stage.status !== 'accepted') throw new Error('hmx-stage-must-be-accepted-before-apply');
    if (!asText(stage.stagingId, 128) || !asText(stage.digest, 128)) throw new Error('hmx-stage-identity-required');
    if (!Array.isArray(stage.conflicts) || stage.conflicts.length > 0) throw new Error('hmx-stage-has-conflicts');
    if (stage.intent !== 'port' || stage.strategy !== 'additive') throw new Error('hmx-canonical-apply-requires-port-additive-strategy');
    const sections = isRecord(stage.stagedSections) ? stage.stagedSections : {};
    const records = Array.isArray(sections.memories) ? sections.memories : [];
    const exportId = asText(stage.exportId, 128);
    const lineageId = asText(stage.sourceLineageId, 512);
    if (!/^exp_[a-f0-9]{16}$/.test(exportId)) throw new Error('hmx-apply-invalid-export-id');
    if (!lineageId) throw new Error('hmx-apply-source-lineage-required');
    if (records.length > 256) throw new Error('hmx-apply-memory-count-limit');

    // Validate every row before making the first canonical write.
    const normalized = [];
    const seenRefs = new Map();
    for (let index = 0; index < records.length; index++) {
      const row = records[index];
      if (!isRecord(row)) throw new Error('hmx-apply-memory-row-not-object:' + index);
      const ref = asText(row.ref, 512);
      const type = asText(row.type, 128);
      const content = asText(row.content, 250000);
      if (!ref || !new RegExp('^' + exportId + ':.+$').test(ref)) throw new Error('hmx-apply-memory-ref-invalid:' + index);
      if (!type) throw new Error('hmx-apply-memory-type-required:' + index);
      if (!content) throw new Error('hmx-apply-memory-content-required:' + index);
      const prior = seenRefs.get(ref);
      const contentHash = hash(content);
      if (prior) throw new Error('hmx-apply-duplicate-ref-conflict:' + ref);
      seenRefs.set(ref, contentHash);
      normalized.push({ row, ref, type, content, contentHash });
    }

    const existingItems = this.memoryFabric.canonicalSnapshot().items ?? [];
    const semanticGraphBefore = this.semanticGraph?.snapshot();
    const temporalLedgerBefore = this.temporalLedger?.snapshot();
    const semanticNodeIdsByRef = new Map();
    const beforeIds = new Set(existingItems.map(item => item.id));
    const existingImportKeys = new Set(existingItems
      .filter(item => String(item.source ?? '').startsWith('hexis:'))
      .map(item => String(item.source) + '\0' + stableRecordContent(item.content)));
    const createdIds = [];
    // Track deterministic IDs before invoking the canonical writer. A writer may
    // commit a row and then throw (for example during receipt/event work), so waiting
    // for encode() to return an ID is not enough to compensate a partial write.
    const rollbackCandidateIds = [];
    const warnings = [];
    const importedIds = [];
    const semanticEdgeIds = [];
    let importedCount = 0;
    let deduplicatedCount = 0;
    let projectedRelationships = 0;
    let deferredRelationships = 0;
    const appliedAt = Date.now();
    const attempt = Math.max(1, Math.floor(Number(stage.applicationAttempts ?? 1)));

    // MemoryOS2 keeps at most 1,600 canonical items and evicts the tail on insert.
    // An HMX batch must not trigger that unrelated eviction as a side effect, because
    // compensation can remove imported rows but cannot restore an evicted old memory.
    const canonicalMemoryCapacity = CANONICAL_MEMORY_CAPACITY;
    const plannedNewItems = normalized.filter(item => {
      const stableRefKey = item.ref.replace(/^exp_[a-f0-9]{16}:/, '');
      const source = 'hexis:' + hash(lineageId).slice(0, 12) + ':' +
        hash(stableRefKey + '\0' + item.contentHash).slice(0, 24);
      return !existingImportKeys.has(source + '\0' + stableRecordContent(item.content));
    });
    if (existingItems.length + plannedNewItems.length > canonicalMemoryCapacity) {
      throw new Error(
        'hmx-apply-canonical-memory-capacity-exceeded:' +
        (existingItems.length + plannedNewItems.length) + '/' + canonicalMemoryCapacity,
      );
    }
    // Detect all deterministic ID collisions before the first canonical write. The
    // in-loop check below remains as defense-in-depth against unexpected mutations.
    for (const item of plannedNewItems) {
      const stableRefKey = item.ref.replace(/^exp_[a-f0-9]{16}:/, '');
      const plannedId = 'hexis-memory:' +
        hash(lineageId + '\0' + stableRefKey + '\0' + item.contentHash).slice(0, 48);
      const source = 'hexis:' + hash(lineageId).slice(0, 12) + ':' +
        hash(stableRefKey + '\0' + item.contentHash).slice(0, 24);
      const collision = existingItems.find(candidate => candidate.id === plannedId);
      if (collision && !(collision.source === source &&
          stableRecordContent(collision.content) === stableRecordContent(item.content))) {
        throw new Error('hmx-apply-canonical-id-conflict:' + plannedId);
      }
    }

    try {
      for (const item of normalized) {
        const { row, ref, type, content: memoryText, contentHash } = item;
        const nativeType = type.toLowerCase();
        // HMX refs are export-scoped. Use the stable record suffix plus lineage/content
        // for memory identity so re-exporting the same source does not create duplicates.
        const stableRefKey = ref.replace(/^exp_[a-f0-9]{16}:/, '');
        const graphSourceKey = 'hexis:' + hash(lineageId).slice(0, 12) + ':' + hash(stableRefKey + '\0' + contentHash).slice(0, 24);
        const source = 'hexis:' + hash(lineageId).slice(0, 12) + ':' + hash(stableRefKey + '\0' + contentHash).slice(0, 24);
        const existingKey = source + '\0' + stableRecordContent(memoryText);
        const salience = clamp01(Number.isFinite(Number(row.importance)) ? Number(row.importance) : 0.55);
        if (existingImportKeys.has(existingKey)) {
          const duplicate = existingItems.find(candidate => candidate.source === source && stableRecordContent(candidate.content) === stableRecordContent(memoryText));
          if (duplicate?.id) importedIds.push(duplicate.id);
          this.ensureSemanticNode(ref, memoryText, nativeType, salience, semanticNodeIdsByRef, graphSourceKey);
          deduplicatedCount++;
          continue;
        }

        const observedAt = dateMs(row.created_at ?? row.createdAt) ?? appliedAt;
        const validFromAt = dateMs(row.valid_from ?? row.validFrom) ?? observedAt;
        const validUntilAt = dateMs(row.valid_until ?? row.validUntil);
        const trustValue = row.trust_level ?? row.trustLevel ?? row.provenance?.confidence;
        const confidence = clamp01(Number.isFinite(Number(trustValue)) ? Number(trustValue) : 0.45);
        const tags = [...new Set([
          'hexis-import',
          'hexis:' + nativeType.slice(0, 64),
          ...arrayOfText(row.metadata?.tags),
          asText(row.metadata?.category, 96),
        ].filter(Boolean))].slice(0, 32);
        const provenancePayload = row.provenance ?? row.source_attribution ?? null;
        const context = {
          hexisExportId: exportId,
          hexisMemoryRef: ref,
          hexisSourceLineageId: lineageId.slice(0, 512),
          hexisOriginalType: nativeType,
          hexisImportedAt: String(appliedAt),
          hexisSourceSchema: 'hmx-1.7',
          ...(provenancePayload ? { hexisProvenance: contextText(provenancePayload) } : {}),
          ...(row.valid_until !== undefined || row.validUntil !== undefined ? { hexisValidUntil: String(row.valid_until ?? row.validUntil ?? '') } : {}),
        };
        const provenanceClass = 'external';
        const authority = confidence;
        const independenceKey = asText(row.provenance?.source_id ?? row.provenance?.sourceId ?? row.source_attribution?.source_id, 96) || ('hexis-ref:' + hash(ref).slice(0, 24));
        const commandId = 'hexis-hmx:' + hash(exportId + '\0' + ref + '\0' + contentHash + '\0' + attempt).slice(0, 48);
        const memoryInput = {
          id: 'hexis-memory:' + hash(lineageId + '\0' + stableRefKey + '\0' + contentHash).slice(0, 48),
          content: memoryText,
          tags,
          context,
          kind: memoryKind(nativeType),
          salience,
          emotionalWeight: clamp01(Number(row.metadata?.emotionalWeight ?? row.metadata?.emotional_weight ?? 0.1)),
          identityRelevance: clamp01(Number(row.metadata?.identityRelevance ?? row.metadata?.identity_relevance ?? (nativeType === 'identity' ? 0.65 : 0.05))),
          goalRelevance: clamp01(Number(row.metadata?.goalRelevance ?? row.metadata?.goal_relevance ?? 0.05)),
          socialRelevance: clamp01(Number(row.metadata?.socialRelevance ?? row.metadata?.social_relevance ?? (nativeType === 'social' || nativeType === 'relationship' ? 0.45 : 0.05))),
          predictionError: 0,
          confidence,
          epistemicStatus: memoryStatus(row.status),
          source,
          entities: arrayOfText(row.metadata?.entities),
          semanticLinks: [],
          temporalLinks: [],
          causalLinks: [],
          provenanceClass,
          sourceAuthority01: authority,
          independenceKey,
          observedAt,
          evidenceFreshnessAt: dateMs(row.updated_at ?? row.updatedAt) ?? observedAt,
          validFromAt,
          validUntilAt,
          evidenceSources: [{
            source,
            provenanceClass,
            sourceAuthority01: authority,
            independenceKey,
            observedAt,
            evidenceFreshnessAt: dateMs(row.updated_at ?? row.updatedAt) ?? observedAt,
          }],
        };
        const plannedMemoryId = memoryInput.id;
        const conflictingExisting = existingItems.find(candidate => candidate.id === plannedMemoryId);
        if (conflictingExisting &&
            !(conflictingExisting.source === source &&
              stableRecordContent(conflictingExisting.content) === stableRecordContent(memoryText))) {
          throw new Error('hmx-apply-canonical-id-conflict:' + plannedMemoryId);
        }
        if (!beforeIds.has(plannedMemoryId)) rollbackCandidateIds.push(plannedMemoryId);
        const inserted = this.memoryFabric.encode(memoryInput, { commandId, syncCompatibility: false, forceDistinct: true });
        if (!inserted?.id) throw new Error('hmx-apply-canonical-write-returned-no-id:' + ref);
        importedIds.push(inserted.id);
        if (beforeIds.has(inserted.id)) {
          deduplicatedCount++;
        } else {
          createdIds.push(inserted.id);
          beforeIds.add(inserted.id);
          importedCount++;
        }
        this.ensureSemanticNode(ref, memoryText, nativeType, salience, semanticNodeIdsByRef, graphSourceKey);
        existingImportKeys.add(existingKey);
      }

      const relationshipRows = Array.isArray(sections.relationships) ? sections.relationships : [];
      for (const relationship of relationshipRows) {
        const fromRef = asText(relationship?.source_ref, 512);
        const toRef = asText(relationship?.target_ref, 512);
        const from = semanticNodeIdsByRef.get(fromRef);
        const to = semanticNodeIdsByRef.get(toRef);
        if (!this.semanticGraph || !from || !to || from === to) {
          deferredRelationships++;
          continue;
        }
        const relation = semanticRelationType(relationship?.edge_type);
        const prior = this.semanticGraph.snapshot().edges.find(edge => edge.from === from && edge.to === to && edge.relation === relation);
        const edge = prior ?? this.semanticGraph.connect(from, to, relation, clamp01(relationship?.properties?.weight ?? relationship?.properties?.confidence ?? 0.55));
        semanticEdgeIds.push(edge.id);
        projectedRelationships++;
      }
      if (this.temporalLedger && importedIds.length) {
        // Reconcile temporal indexing for every memory represented in the application
        // receipt, not only IDs created by this attempt. If a prior writer committed
        // before throwing and compensation failed, its retry is a dedupe and must still
        // repair the missing temporal index.
        const importedIdSet = new Set(importedIds);
        const canonicalItems = this.memoryFabric.canonicalSnapshot().items ?? [];
        const canonicalById = new Map(canonicalItems.filter(item => importedIdSet.has(item.id)).map(item => [item.id, item]));
        const sourceRowsByRef = new Map(normalized.map(item => [item.ref, item.row]));
        const temporalSnapshot = this.temporalLedger.snapshot();
        const temporalRows = Array.isArray(temporalSnapshot?.temporal) ? temporalSnapshot.temporal : [];
        for (const id of importedIdSet) {
          const memory = canonicalById.get(id);
          if (!memory) throw new Error('hmx-temporal-canonical-memory-missing:' + id);
          const ref = asText(memory.context?.hexisMemoryRef, 512);
          const sourceRef = ref.replace(/^exp_[a-f0-9]{16}:/, '');
          const temporalSource = 'hexis:' + lineageId + ':' + sourceRef;
          const inputRow = sourceRowsByRef.get(ref);
          const validFrom = dateMs(memory.validFromAt) ?? dateMs(memory.observedAt) ?? appliedAt;
          const validUntil = dateMs(memory.validUntilAt);
          const summary = String(memory.content ?? '').slice(0, 2000);
          const confidence01 = clamp01(memory.confidence);
          const nextTemporalStart = temporalRows
            .filter(row => row.memoryId === id && row.validFrom > validFrom)
            .reduce((next, row) => next === null || row.validFrom < next ? row.validFrom : next, null);
          const effectiveValidUntil = nextTemporalStart !== null &&
            (validUntil === null || nextTemporalStart < validUntil)
            ? nextTemporalStart
            : validUntil;
          // Idempotency includes the interval itself: an expired assertion is still
          // an already-indexed result, while a changed interval creates a new revision.
          if (temporalRows.some(row =>
            row.memoryId === id &&
            row.source === temporalSource &&
            row.validFrom === validFrom &&
            row.validUntil === effectiveValidUntil &&
            row.summary === summary &&
            row.confidence01 === confidence01
          )) continue;
          const receipt = this.temporalLedger.recordTemporalAssertion({
            memoryId: id,
            summary,
            confidence01,
            validFrom,
            validUntil,
            source: temporalSource,
            value: {
              sourceLineageId: lineageId,
              sourceRef,
              contentHash: hash(memory.content),
              provenance: inputRow?.provenance ?? inputRow?.source_attribution ?? null,
            },
          });
          temporalRows.push(receipt);
        }
      }
    } catch (error) {
      const rollbackErrors = [];
      // Include writes whose call threw before returning, plus the ordinary completed
      // writes. IDs known to predate this import are never included in compensation.
      for (const id of [...new Set([...rollbackCandidateIds, ...createdIds])].reverse()) {
        try {
          this.memoryFabric.forgetById(id, 'hexis-hmx-apply-rollback', {
            commandId: 'hexis-hmx-rollback:' + hash(exportId + '\0' + String(stage.stagingId) + '\0' + id + '\0' + attempt).slice(0, 48),
          });
        } catch (rollbackError) {
          rollbackErrors.push(String(rollbackError?.message ?? rollbackError).slice(0, 240));
        }
      }
      try {
        const afterRollbackItems = this.memoryFabric.canonicalSnapshot().items ?? [];
        const remainingIds = new Set(afterRollbackItems.filter(item => !beforeIds.has(item.id)).map(item => item.id));
        for (const id of new Set([...rollbackCandidateIds, ...createdIds])) {
          if (remainingIds.has(id)) rollbackErrors.push('canonical-memory-remains:' + id);
        }
      } catch (verificationError) {
        rollbackErrors.push('canonical-rollback-verification:' + String(verificationError?.message ?? verificationError).slice(0, 220));
      }
      if (this.semanticGraph && semanticGraphBefore) {
        try {
          this.semanticGraph.restore(semanticGraphBefore);
        } catch (graphRollbackError) {
          rollbackErrors.push('semantic-graph:' + String(graphRollbackError?.message ?? graphRollbackError).slice(0, 220));
        }
      }
      if (this.temporalLedger && temporalLedgerBefore) {
        try {
          this.temporalLedger.restore(temporalLedgerBefore);
        } catch (temporalRollbackError) {
          rollbackErrors.push('temporal-ledger:' + String(temporalRollbackError?.message ?? temporalRollbackError).slice(0, 220));
        }
      }
      const reason = String(error?.message ?? error).slice(0, 500);
      throw new Error('hmx-canonical-apply-failed:' + reason + (rollbackErrors.length ? ';rollback-failures=' + rollbackErrors.join('|') : ''));
    }

    const deferredSections = deferredSectionCounts(sections);
    if (Array.isArray(sections.relationships)) {
      if (deferredRelationships > 0) deferredSections.relationships = deferredRelationships;
      else delete deferredSections.relationships;
    }
    if (projectedRelationships > 0) warnings.push('Relationships whose endpoints were both present in the imported memories section were projected into the canonical semantic graph.');
    if (Object.keys(deferredSections).length) {
      warnings.push('Canonical memories and relationships between imported memory endpoints are projected in this pass; other non-empty sections remain approved-but-deferred.');
    }
    if (normalized.length === 0) warnings.push('The accepted HMX document contained no memory records to apply.');
    const base = {
      version: 1,
      exportId,
      sourceLineageId: lineageId,
      stageId: String(stage.stagingId),
      stageDigest: String(stage.digest),
      attempt,
      appliedAt,
      status: normalized.length === 0 ? 'noop' : Object.keys(deferredSections).length ? 'partial' : 'applied',
      complete: normalized.length > 0 && Object.keys(deferredSections).length === 0,
      candidateMemoryRecords: records.length,
      uniqueMemoryRecords: normalized.length,
      importedCount,
      deduplicatedCount,
      projectedRelationships,
      deferredRelationships,
      semanticEdgeIds: [...new Set(semanticEdgeIds)].slice(0, 512),
      memoryIds: [...new Set(importedIds)].slice(0, 256),
      createdMemoryIds: [...new Set(createdIds)].slice(0, 256),
      deferredSections,
      warnings,
    };
    return { ...base, digest: hash(JSON.stringify(base)) };
  }
}
