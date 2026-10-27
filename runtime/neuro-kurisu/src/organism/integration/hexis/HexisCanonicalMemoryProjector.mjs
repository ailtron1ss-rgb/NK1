import { createHash, randomUUID } from 'node:crypto';
import { isSafeJsonTree, isValidHmxStageDigest } from './HexisStageIntegrity.mjs';

const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const asText = (value, max = 2048) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : '';
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const isCanonicalReceiptId = value => typeof value === 'string' && value.length > 0 && value.length <= 512 &&
  value === value.trim() && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
export const isValidHmxApplyReceipt = (stage, receipt) => {
  // This validator is exported and can be called independently of apply(); reject
  // accessor-backed or malformed trees before reading receipt/stage fields.
  if (!isRecord(stage) || !isRecord(receipt) || !isValidHmxStageDigest(stage) ||
      !isSafeJsonTree(receipt) || !isRecord(stage.stagedSections) ||
      stage.status !== 'applied' || stage.intent !== 'port' || stage.strategy !== 'additive' ||
      typeof stage.exportId !== 'string' || !/^exp_[a-f0-9]{16}$/.test(stage.exportId) ||
      typeof stage.sourceLineageId !== 'string' || !stage.sourceLineageId.trim() || stage.sourceLineageId !== stage.sourceLineageId.trim() || stage.sourceLineageId.length > 512 ||
      /[\u0000-\u001f\u007f-\u009f]/u.test(stage.sourceLineageId) ||
      typeof stage.stagingId !== 'string' || !stage.stagingId.trim() || stage.stagingId !== stage.stagingId.trim() || stage.stagingId.length > 512 ||
      /[\u0000-\u001f\u007f-\u009f]/u.test(stage.stagingId)) return false;
  const keys = [
    'version', 'exportId', 'sourceLineageId', 'stageId', 'stageDigest', 'attempt',
    'appliedAt', 'status', 'complete', 'candidateMemoryRecords', 'uniqueMemoryRecords',
    'importedCount', 'deduplicatedCount', 'projectedRelationships', 'deferredRelationships',
    'semanticEdgeIds', 'memoryIds', 'createdMemoryIds', 'deferredSections', 'warnings', 'digest',
  ];
  if (Object.keys(receipt).length !== keys.length || keys.some(key => !Object.hasOwn(receipt, key))) return false;
  if (receipt.version !== 1 ||
      receipt.exportId !== stage.exportId ||
      receipt.sourceLineageId !== stage.sourceLineageId ||
      receipt.stageId !== stage.stagingId ||
      typeof stage.digest !== 'string' || receipt.stageDigest !== stage.digest ||
      !Number.isSafeInteger(receipt.attempt) || receipt.attempt < 1 ||
      (Object.hasOwn(stage, 'applicationAttempts') &&
        (!Number.isSafeInteger(stage.applicationAttempts) || stage.applicationAttempts < 1 || receipt.attempt !== stage.applicationAttempts)) ||
      !Number.isFinite(receipt.appliedAt) || receipt.appliedAt < 0 ||
      !['applied', 'partial', 'noop'].includes(receipt.status) ||
      typeof receipt.complete !== 'boolean') return false;
  for (const field of [
    'candidateMemoryRecords', 'uniqueMemoryRecords', 'importedCount',
    'deduplicatedCount', 'projectedRelationships', 'deferredRelationships',
  ]) {
    if (!Number.isSafeInteger(receipt[field]) || receipt[field] < 0) return false;
  }
  for (const field of ['semanticEdgeIds', 'memoryIds', 'createdMemoryIds', 'warnings']) {
    if (!Array.isArray(receipt[field]) || !receipt[field].every(item => typeof item === 'string')) return false;
  }
  if (receipt.warnings.some(message => message.length > 2048 || /[\u0000-\u001f\u007f-\u009f]/u.test(message))) return false;
  for (const field of ['semanticEdgeIds', 'memoryIds', 'createdMemoryIds']) {
    if (receipt[field].some(id => !isCanonicalReceiptId(id))) return false;
  }
  if (!isRecord(receipt.deferredSections) ||
      Object.entries(receipt.deferredSections).some(([name, count]) =>
        !name || name.length > 128 || /[\u0000-\u001f\u007f-\u009f]/u.test(name) ||
        !Number.isSafeInteger(count) || count < 1)) return false;
  // Enforce semantic invariants even when a tampered receipt has been rehashed.
  const memoryRows = Array.isArray(stage.stagedSections.memories) ? stage.stagedSections.memories : [];
  if (receipt.candidateMemoryRecords !== memoryRows.length ||
      receipt.uniqueMemoryRecords > receipt.candidateMemoryRecords ||
      receipt.importedCount + receipt.deduplicatedCount !== receipt.uniqueMemoryRecords ||
      receipt.memoryIds.length !== receipt.uniqueMemoryRecords ||
      receipt.createdMemoryIds.length !== receipt.importedCount ||
      new Set(receipt.memoryIds).size !== receipt.memoryIds.length ||
      new Set(receipt.createdMemoryIds).size !== receipt.createdMemoryIds.length ||
      receipt.createdMemoryIds.some(id => !receipt.memoryIds.includes(id)) ||
      receipt.semanticEdgeIds.length > receipt.projectedRelationships ||
      new Set(receipt.semanticEdgeIds).size !== receipt.semanticEdgeIds.length) return false;

  const stagedRelationships = stage.stagedSections.relationships;
  if (Array.isArray(stagedRelationships)) {
    if (receipt.projectedRelationships + receipt.deferredRelationships !== stagedRelationships.length) return false;
  } else if (Object.hasOwn(stage.stagedSections, 'relationships') ||
      receipt.projectedRelationships !== 0 || receipt.deferredRelationships !== 0) {
    return false;
  }

  // The deferred summary is an exact projection of the staged sections. This prevents
  // a rehashed receipt from inventing deferred goals, hiding deferred relationships,
  // or using zero-valued keys to force a false "partial" status.
  const expectedDeferredSections = deferredSectionCounts(stage.stagedSections);
  if (Array.isArray(stagedRelationships)) {
    if (receipt.deferredRelationships > 0) expectedDeferredSections.relationships = receipt.deferredRelationships;
    else delete expectedDeferredSections.relationships;
  } else {
    delete expectedDeferredSections.relationships;
  }
  const actualDeferredNames = Object.keys(receipt.deferredSections).sort();
  const expectedDeferredNames = Object.keys(expectedDeferredSections).sort();
  if (actualDeferredNames.length !== expectedDeferredNames.length ||
      actualDeferredNames.some((name, index) =>
        name !== expectedDeferredNames[index] ||
        receipt.deferredSections[name] !== expectedDeferredSections[name])) return false;

  const expectedStatus = receipt.uniqueMemoryRecords === 0
    ? 'noop'
    : expectedDeferredNames.length > 0 ? 'partial' : 'applied';
  if (receipt.status !== expectedStatus || receipt.complete !== (expectedStatus === 'applied')) return false;

  const { digest: receiptDigest, ...base } = receipt;
  return typeof receiptDigest === 'string' &&
    /^[a-f0-9]{64}$/.test(receiptDigest) &&
    hash(JSON.stringify(base)) === receiptDigest;
};
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
const hasControlCharacters = value => {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code <= 31 || (code >= 127 && code <= 159)) return true;
  }
  return false;
};
const normalizeHmxMemoryStatus = value => {
  if (value === undefined || value === null) return 'unknown';
  if (typeof value !== 'string' || value.length > 64 || hasControlCharacters(value)) {
    throw new Error('hmx-apply-memory-status-invalid');
  }
  const status = value.trim().toLowerCase();
  if (status === 'active' || status === 'belief' || status === 'fact') return 'belief';
  if (status === 'hypothesis') return 'hypothesis';
  if (status === 'unknown' || status === '') return 'unknown';
  if (['archived', 'quarantined', 'deleted', 'rejected', 'superseded', 'inactive', 'disabled', 'forgotten'].includes(status)) return 'quarantined';
  return 'unknown';
};
const epistemicStatusRank = status => ({ belief: 0, hypothesis: 1, unknown: 2, quarantined: 3 }[status] ?? 2);
const signalRollbackSnapshot = memory => ({
  confidence: memory.confidence,
  epistemicStatus: memory.epistemicStatus,
  sourceAuthority01: memory.sourceAuthority01,
  evidenceSources: memory.evidenceSources === undefined ? undefined : structuredClone(memory.evidenceSources),
  evidenceLineageKeys: memory.evidenceLineageKeys === undefined ? undefined : [...memory.evidenceLineageKeys],
  lastAccessAt: memory.lastAccessAt,
  temperature01: memory.temperature01,
  revisionHistory: structuredClone(memory.revisionHistory ?? []),
});
const sameSignalRollbackSnapshot = (memory, snapshot) =>
  Boolean(memory) && JSON.stringify(signalRollbackSnapshot(memory)) === JSON.stringify(snapshot);

const MAX_IMPORTED_EXTERNAL_CONFIDENCE = 0.65;
const contextText = value => {
  if (typeof value === 'string') return value.slice(0, 1200);
  try { return JSON.stringify(value).slice(0, 1200); } catch { return ''; }
};
const arrayOfText = value => Array.isArray(value)
  ? [...new Set(value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim().slice(0, 160)))].slice(0, 32)
  : [];
const stableRecordContent = value => String(value ?? '').normalize('NFKC').trim();
const stableHmxMemoryRef = value => {
  const ref = asText(value, 512);
  const match = /^exp_[a-f0-9]{16}:(.+)$/.exec(ref);
  return match ? match[1] : ref;
};

function deferredSectionCounts(sections) {
  // Section labels are external input. A null-prototype map makes "__proto__"
  // and "constructor" ordinary data keys rather than inherited setters/properties.
  const result = Object.create(null);
  for (const [name, value] of Object.entries(sections ?? {})) {
    if (name === 'memories') continue;
    const count = Array.isArray(value) ? value.length : isRecord(value) ? Object.keys(value).length :
      typeof value === 'string' ? (value.trim() ? 1 : 0) :
      typeof value === 'number' ? (Number.isFinite(value) && value !== 0 ? 1 : 0) :
      value === true ? 1 : 0;
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

  ensureSemanticNode(ref, content, nativeType, salience, nodeIdsByRef, sourceKey = '', mutationToken) {
    if (!this.semanticGraph || nodeIdsByRef.has(ref)) return nodeIdsByRef.get(ref) ?? null;
    const label = semanticLabel(content);
    if (!label) return null;
    const type = semanticNodeType(nativeType);
    // Reuse graph nodes instead of reinforcing them on every re-import.
    const existing = this.semanticGraph.snapshot().nodes.find(node => node.label === label && node.type === type && String(node.sourceKey ?? '') === String(sourceKey ?? ''));
    const node = existing ?? this.semanticGraph.upsertNode(content, type, salience, sourceKey, mutationToken);
    nodeIdsByRef.set(ref, node.id);
    return node.id;
  }

  removeSemanticProjection(sourceKey, mutationToken) {
    if (!this.semanticGraph) return;
    const snapshot = this.semanticGraph.snapshot();
    const removed = new Set(snapshot.nodes
      .filter(node => String(node.sourceKey ?? '') === String(sourceKey ?? ''))
      .map(node => node.id));
    if (!removed.size) return;
    this.semanticGraph.restore({
      ...snapshot,
      nodes: snapshot.nodes.filter(node => !removed.has(node.id)),
      edges: snapshot.edges.filter(edge => !removed.has(edge.from) && !removed.has(edge.to)),
    }, mutationToken);
  }

  apply(stage) {
    if (!isValidHmxStageDigest(stage)) throw new Error('hmx-stage-digest-invalid');
    // Idempotent replay must be checked before the accepted-stage guard: persisted
    // stages transition out of `accepted` after application, but their receipt remains
    // the authoritative answer for retries. This branch performs no writes.
    if (isRecord(stage) && stage.status === 'applied') {
      if (!isValidHmxApplyReceipt(stage, stage.application)) {
        throw new Error('hmx-applied-receipt-invalid');
      }
      return structuredClone(stage.application);
    }
    if (!isRecord(stage) || stage.status !== 'accepted') throw new Error('hmx-stage-must-be-accepted-before-apply');
    if (stage.intent !== 'port' || stage.strategy !== 'additive') throw new Error('hmx-canonical-apply-requires-port-additive-strategy');
    const sections = isRecord(stage.stagedSections) ? stage.stagedSections : {};
    // Known HMX contracts are arrays. Reject malformed present sections before even reading
    // canonical storage, instead of silently treating bad memories as an empty import.
    for (const field of ['memories', 'relationships']) {
      if (Object.hasOwn(sections, field) && !Array.isArray(sections[field])) {
        throw new Error('hmx-apply-known-section-must-be-array:' + field);
      }
    }
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
      const epistemicStatus = normalizeHmxMemoryStatus(row.status);
      if (!ref || !new RegExp('^' + exportId + ':.+$').test(ref)) throw new Error('hmx-apply-memory-ref-invalid:' + index);
      if (!type) throw new Error('hmx-apply-memory-type-required:' + index);
      if (!content) throw new Error('hmx-apply-memory-content-required:' + index);
      const prior = seenRefs.get(ref);
      const contentHash = hash(content);
      if (prior && prior !== contentHash) throw new Error('hmx-apply-duplicate-ref-conflict:' + ref);
      if (prior) continue;
      seenRefs.set(ref, contentHash);
      normalized.push({ row, ref, type, content, contentHash, epistemicStatus });
    }

    const existingItems = this.memoryFabric.canonicalSnapshot().items ?? [];
    const projectionMutationToken = 'hexis-hmx-apply:' + randomUUID();
    const semanticGraphBefore = this.semanticGraph?.snapshot();
    const semanticGraphMutationCheckpoint = typeof this.semanticGraph?.mutationCheckpoint === 'function'
      ? this.semanticGraph.mutationCheckpoint()
      : null;
    const temporalLedgerBefore = this.temporalLedger?.snapshot();
    const temporalLedgerMutationCheckpoint = typeof this.temporalLedger?.mutationCheckpoint === 'function'
      ? this.temporalLedger.mutationCheckpoint()
      : null;
    const semanticNodeIdsByRef = new Map();
    const beforeIds = new Set(existingItems.map(item => item.id));
    const existingImportKeys = new Set(existingItems
      .filter(item => String(item.source ?? '').startsWith('hexis:'))
      .map(item => String(item.source) + '\0' + stableRecordContent(item.content)));
    const createdIds = [];
    const revisedSignals = [];
    const signalRevisionById = new Map();
    const reserveSignalRevision = memory => {
      const existing = signalRevisionById.get(memory.id);
      if (existing) return existing;
      const compensationToken = this.memoryFabric.beginSignalCompensation(memory.id);
      if (!compensationToken) throw new Error('hmx-signal-compensation-target-missing:' + memory.id);
      const revision = {
        id: memory.id,
        previous: signalRollbackSnapshot(memory),
        compensationToken,
      };
      revisedSignals.push(revision);
      signalRevisionById.set(memory.id, revision);
      return revision;
    };
    const supersededIds = [];
    const warnings = [];
    const importedIds = [];
    const semanticEdgeIds = [];
    let importedCount = 0;
    let deduplicatedCount = 0;
    let projectedRelationships = 0;
    let deferredRelationships = 0;
    const appliedAt = Date.now();
    const attempt = Math.max(1, Math.floor(Number(stage.applicationAttempts ?? 1)));

    try {
      for (const item of normalized) {
        const { row, ref, type, content: memoryText, contentHash, epistemicStatus } = item;
        const nativeType = type.toLowerCase();
        // HMX refs are export-scoped. Canonical identity follows the stable source
        // ref, normalized content and type. Reuse a matching persisted version's old
        // key on replay so this schema evolution does not duplicate existing imports.
        const stableRefKey = stableHmxMemoryRef(ref);
        const exactVersions = existingItems.filter(candidate =>
          candidate?.id &&
          String(candidate.source ?? '').startsWith('hexis:') &&
          String(candidate.context?.hexisSourceLineageId ?? '') === lineageId &&
          stableHmxMemoryRef(candidate.context?.hexisMemoryRef) === stableRefKey &&
          stableRecordContent(candidate.content) === stableRecordContent(memoryText) &&
          String(candidate.context?.hexisOriginalType ?? '').toLowerCase() === nativeType,
        );
        const exactVersion = exactVersions.find(candidate =>
          candidate.epistemicStatus === 'belief' || candidate.epistemicStatus === 'hypothesis',
        ) ?? exactVersions[0];
        const nextGraphSourceKey = 'hexis:' + hash(lineageId).slice(0, 12) + ':' +
          hash(stableRefKey + '\0' + nativeType + '\0' + contentHash).slice(0, 24);
        const persistedGraphSourceKey = asText(exactVersion?.context?.hexisGraphSourceKey, 512) ||
          (String(exactVersion?.source ?? '').startsWith('hexis:') ? String(exactVersion.source) : '');
        const graphSourceKey = persistedGraphSourceKey || nextGraphSourceKey;
        const source = String(exactVersion?.source ?? '').startsWith('hexis:')
          ? String(exactVersion.source)
          : nextGraphSourceKey;
        const existingKey = source + '\0' + stableRecordContent(memoryText);
        const salience = clamp01(Number.isFinite(Number(row.importance)) ? Number(row.importance) : 0.55);

        // A stable HMX ref identifies one external record across exports. If its
        // content changes, retain the previous canonical rows as history but withdraw
        // their active belief/semantic projections before duplicate short-circuiting.
        // This also handles a source reverting to an older, already quarantined value:
        // no stale newer version may remain active, and an old value is never revived.
        const priorVersions = existingItems.filter(candidate =>
          candidate?.id &&
          String(candidate.source ?? '').startsWith('hexis:') &&
          String(candidate.context?.hexisSourceLineageId ?? '') === lineageId &&
          stableHmxMemoryRef(candidate.context?.hexisMemoryRef) === stableRefKey &&
          (stableRecordContent(candidate.content) !== stableRecordContent(memoryText) ||
            String(candidate.context?.hexisOriginalType ?? '').toLowerCase() !== nativeType),
        );
        for (const prior of priorVersions) {
          if (!supersededIds.includes(prior.id)) supersededIds.push(prior.id);
          if (prior.epistemicStatus !== 'quarantined') {
            // Status-only supersession uses the same compare-and-restore capability as
            // trust reconciliation; there is no separate unguarded status rollback.
            const signalRevision = reserveSignalRevision(prior);
            this.memoryFabric.revise(
              prior.id,
              'quarantined',
              'hexis-source-content-superseded:' + hash(stableRefKey + '\0' + contentHash).slice(0, 16),
              {
                commandId: 'hexis-supersede:' + hash(String(stage.stagingId) + ':' + prior.id + ':' + contentHash + ':' + attempt).slice(0, 48),
                compensationToken: signalRevision.compensationToken,
              },
            );
          }
          const priorGraphSource = asText(prior.context?.hexisGraphSourceKey, 512) || asText(prior.source, 512);
          if (priorGraphSource) this.removeSemanticProjection(priorGraphSource, projectionMutationToken);
          if (this.temporalLedger && typeof this.temporalLedger.removeBeliefProjection === 'function') {
            this.temporalLedger.removeBeliefProjection(prior.id, projectionMutationToken);
          }
        }

        if (existingImportKeys.has(existingKey)) {
          const duplicate = existingItems.find(candidate => candidate.source === source && stableRecordContent(candidate.content) === stableRecordContent(memoryText));
          if (duplicate?.id) {
            importedIds.push(duplicate.id);
            const currentStatus = normalizeHmxMemoryStatus(duplicate.epistemicStatus);
            const targetStatus = epistemicStatusRank(currentStatus) >= epistemicStatusRank(epistemicStatus) ? currentStatus : epistemicStatus;
            const changesStatus = String(duplicate.epistemicStatus) !== targetStatus;

            // Compute all trust predicates before the first mutation. A shared token
            // will restore the complete transaction-start status + signals snapshot.
            const trustValue = row.trust_level ?? row.trustLevel ?? row.provenance?.confidence;
            const sourceTrustClaim = Number.isFinite(Number(trustValue)) ? clamp01(Number(trustValue)) : 0.45;
            const incomingAuthorityCap = Math.min(sourceTrustClaim, MAX_IMPORTED_EXTERNAL_CONFIDENCE);
            const priorConfidence = clamp01(duplicate.confidence ?? 0.45);
            const priorAuthority = clamp01(duplicate.sourceAuthority01 ?? duplicate.confidence ?? 0.45);
            const hasOverCapHmxEvidence = Array.isArray(duplicate.evidenceSources) && duplicate.evidenceSources.some(
              evidence => evidence.provenanceClass === 'external' &&
                String(evidence.source ?? '').startsWith('hexis:') &&
                clamp01(evidence.sourceAuthority01) > incomingAuthorityCap,
            );
            const changesTrustSignals = priorConfidence > incomingAuthorityCap ||
              priorAuthority > incomingAuthorityCap || hasOverCapHmxEvidence;
            // Reserve one transaction-start snapshot per canonical memory. Each owned
            // status/trust mutation seals its post-state inside MemoryFabric; an external
            // mutation between this row and rollback therefore remains a conflict.
            const signalRevision = changesStatus || changesTrustSignals
              ? reserveSignalRevision(duplicate)
              : null;
            const compensationToken = signalRevision?.compensationToken;

            if (changesStatus) {
              this.memoryFabric.revise(
                duplicate.id,
                targetStatus,
                'hexis-source-status-reconciliation:' + (typeof row.status === 'string' ? row.status.slice(0, 64) : 'unknown'),
                {
                  commandId: 'hexis-status:' + hash(String(stage.stagingId) + ':' + duplicate.id + ':' + targetStatus + ':' + attempt).slice(0, 48),
                  compensationToken,
                },
              );
            }
            if (targetStatus === 'quarantined' || targetStatus === 'unknown') this.removeSemanticProjection(graphSourceKey, projectionMutationToken);
            else this.ensureSemanticNode(ref, memoryText, nativeType, salience, semanticNodeIdsByRef, graphSourceKey, projectionMutationToken);

            if (changesTrustSignals) {
              const cappedMemory = this.memoryFabric.updateSignals(
                duplicate.id,
                {
                  confidence: Math.min(priorConfidence, incomingAuthorityCap),
                  sourceAuthority01: Math.min(priorAuthority, incomingAuthorityCap),
                  evidenceSources: Array.isArray(duplicate.evidenceSources)
                    ? duplicate.evidenceSources.map(evidence => ({ ...evidence }))
                    : [],
                },
                'hexis-import-authority-cap',
                {
                  commandId: 'hexis-authority:' + hash(String(stage.stagingId) + ':' + duplicate.id + ':' + incomingAuthorityCap + ':' + attempt).slice(0, 48),
                  compensationToken,
                },
              );
              if (!cappedMemory) throw new Error('hmx-import-authority-cap-memory-missing:' + duplicate.id);
            }

          }
          deduplicatedCount++;
          continue;
        }

        const observedAt = dateMs(row.created_at ?? row.createdAt) ?? appliedAt;
        const validFromAt = dateMs(row.valid_from ?? row.validFrom) ?? observedAt;
        const validUntilAt = dateMs(row.valid_until ?? row.validUntil);
        const trustValue = row.trust_level ?? row.trustLevel ?? row.provenance?.confidence;
        const sourceTrustClaim = Number.isFinite(Number(trustValue)) ? clamp01(Number(trustValue)) : 0.45;
        const confidence = Math.min(sourceTrustClaim, MAX_IMPORTED_EXTERNAL_CONFIDENCE);
        const tags = [...new Set([
          'hexis-import',
          'hexis:' + nativeType.slice(0, 64),
          'hexis-status:' + (typeof row.status === 'string' && row.status.trim() ? row.status.trim().toLowerCase().slice(0, 64) : 'unknown'),
          ...arrayOfText(row.metadata?.tags),
          asText(row.metadata?.category, 96),
        ].filter(Boolean))].slice(0, 32);
        const provenancePayload = row.provenance ?? row.source_attribution ?? null;
        const context = {
          hexisExportId: exportId,
          hexisImportStageId: String(stage.stagingId),
          hexisImportAttempt: String(attempt),
          hexisMemoryRef: ref,
          hexisGraphSourceKey: graphSourceKey,
          hexisSourceLineageId: lineageId.slice(0, 512),
          hexisOriginalType: nativeType,
          hexisOriginalStatus: typeof row.status === 'string' && row.status.trim() ? row.status.trim().toLowerCase().slice(0, 64) : 'unknown',
          hexisSourceTrustClaim: Number.isFinite(Number(trustValue)) ? String(clamp01(Number(trustValue))) : 'unspecified',
          hexisAppliedAuthorityCap: String(MAX_IMPORTED_EXTERNAL_CONFIDENCE),
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
          id: 'hexis-memory:' + hash(lineageId + '\0' + stableRefKey + '\0' + nativeType + '\0' + contentHash).slice(0, 48),
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
          epistemicStatus,
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
        if (epistemicStatus === 'belief' || epistemicStatus === 'hypothesis') {
          this.ensureSemanticNode(ref, memoryText, nativeType, salience, semanticNodeIdsByRef, graphSourceKey, projectionMutationToken);
        }
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
        const edge = prior ?? this.semanticGraph.connect(from, to, relation, clamp01(relationship?.properties?.weight ?? relationship?.properties?.confidence ?? 0.55), projectionMutationToken);
        semanticEdgeIds.push(edge.id);
        projectedRelationships++;
      }
      if (this.temporalLedger && createdIds.length) {
        const canonicalItems = this.memoryFabric.canonicalSnapshot().items ?? [];
        const canonicalById = new Map(canonicalItems.filter(item => createdIds.includes(item.id)).map(item => [item.id, item]));
        const sourceRowsByRef = new Map(normalized.map(item => [item.ref, item.row]));
        for (const id of createdIds) {
          const memory = canonicalById.get(id);
          if (!memory) throw new Error('hmx-temporal-canonical-memory-missing:' + id);
          const ref = asText(memory.context?.hexisMemoryRef, 512);
          const sourceRef = ref.startsWith(exportId + ':') ? ref.slice(exportId.length + 1) : ref;
          const inputRow = sourceRowsByRef.get(ref);
          const validFrom = dateMs(memory.validFromAt) ?? dateMs(memory.observedAt) ?? appliedAt;
          this.temporalLedger.recordTemporalAssertion({
            memoryId: id,
            summary: String(memory.content ?? '').slice(0, 2000),
            confidence01: clamp01(memory.confidence),
            validFrom,
            source: 'hexis:' + lineageId + ':' + sourceRef,
            value: {
              sourceLineageId: lineageId,
              sourceRef,
              contentHash: hash(memory.content),
              provenance: inputRow?.provenance ?? inputRow?.source_attribution ?? null,
            },
          }, projectionMutationToken);
        }
      }
      // Hexis keeps belief state separately from the canonical memory record. Seed
      // that state from the imported memory's existing confidence without treating
      // import as independent supporting evidence or increasing confidence.
      if (this.temporalLedger &&
          typeof this.temporalLedger.registerOrUpdateBelief === 'function' &&
          importedIds.length) {
        const canonicalItems = this.memoryFabric.canonicalSnapshot().items ?? [];
        const canonicalById = new Map(
          canonicalItems.filter(item => importedIds.includes(item.id)).map(item => [item.id, item]),
        );
        for (const id of [...new Set(importedIds)]) {
          const memory = canonicalById.get(id);
          if (!memory) throw new Error('hmx-belief-canonical-memory-missing:' + id);
          if (memory.epistemicStatus !== 'belief') {
            if (typeof this.temporalLedger.removeBeliefProjection === 'function') this.temporalLedger.removeBeliefProjection(id, projectionMutationToken);
            continue;
          }
          this.temporalLedger.registerOrUpdateBelief({
            memoryId: id,
            confidence01: clamp01(memory.confidence),
            trust01: clamp01(memory.sourceAuthority01 ?? memory.confidence),
            at: dateMs(memory.observedAt) ?? appliedAt,
          }, projectionMutationToken);
        }
      }

    } catch (error) {
      const rollbackErrors = [];
      // The canonical MemoryFabric can commit an encode before a downstream
      // adapter throws. In that case the returned ID never reaches createdIds.
      // Reconcile against the baseline snapshot and compensate only newly-added
      // records from this export; never forget pre-existing/native memories.
      const rollbackIds = new Set(createdIds);
      try {
        const afterFailure = this.memoryFabric.canonicalSnapshot().items ?? [];
        for (const item of afterFailure) {
          if (
            item?.id &&
            !beforeIds.has(item.id) &&
            String(item.source ?? '').startsWith('hexis:') &&
            String(item.context?.hexisExportId ?? '') === exportId &&
            String(item.context?.hexisImportStageId ?? '') === String(stage.stagingId) &&
            String(item.context?.hexisImportAttempt ?? '') === String(attempt)
          ) rollbackIds.add(item.id);
        }
      } catch (snapshotError) {
        rollbackErrors.push('canonical-reconcile:' + String(snapshotError?.message ?? snapshotError).slice(0, 220));
      }
      for (const id of [...rollbackIds].reverse()) {
        let removed = false;
        if (typeof this.memoryFabric.rollbackHmxCreatedMemory === 'function') {
          // Prefer the transaction-scoped compensator even for ordinary facts. This
          // keeps rollback out of user-forget accounting and binds deletion to the exact
          // export, stage and attempt. Never broaden a failed scoped compensation.
          try {
            removed = this.memoryFabric.rollbackHmxCreatedMemory(
              id,
              exportId,
              String(stage.stagingId),
              attempt,
              'hexis-hmx-apply-rollback',
              {
                commandId: 'hexis-hmx-rollback-protected:' +
                  hash(exportId + '\0' + String(stage.stagingId) + '\0' + id + '\0' + attempt).slice(0, 48),
              },
            ) === true;
          } catch (rollbackError) {
            rollbackErrors.push('canonical-compensation:' + String(rollbackError?.message ?? rollbackError).slice(0, 220));
          }
        } else {
          // Backward-compatible fallback for alternate test/adaptor implementations
          // without the scoped API. The production MemoryFabric always exposes it.
          try {
            removed = this.memoryFabric.forgetById(id, 'hexis-hmx-apply-rollback', {
              commandId: 'hexis-hmx-rollback:' + hash(exportId + '\0' + String(stage.stagingId) + '\0' + id + '\0' + attempt).slice(0, 48),
            }) === true;
          } catch (rollbackError) {
            rollbackErrors.push('canonical-remove:' + String(rollbackError?.message ?? rollbackError).slice(0, 220));
          }
        }
        if (!removed) rollbackErrors.push('canonical-remove-unconfirmed:' + id);
      }
      // A non-throwing compensator can still fail to remove a committed item.
      // Verify the postcondition rather than assuming that a return means rollback.
      try {
        const remainingItems = this.memoryFabric.canonicalSnapshot().items ?? [];
        const uncompensated = remainingItems
          .filter(item => rollbackIds.has(item.id))
          .map(item => String(item.id))
          .slice(0, 8);
        if (uncompensated.length) rollbackErrors.push('canonical-uncompensated:' + uncompensated.join(','));
      } catch (verifyError) {
        rollbackErrors.push('canonical-verify:' + String(verifyError?.message ?? verifyError).slice(0, 220));
      }
      // Status reconciliation may touch an existing canonical memory before a later
      // projection/ledger operation fails. Restore those prior statuses as well as
      // deleting newly-created rows; never leave a failed import half-applied.
      for (const revision of [...revisedSignals].reverse()) {
        try {
          // Never replace expectedCurrent with a catch-time snapshot: that would bless
          // unrelated intervening writes. Lifecycle writes seal their own post-state.
          this.memoryFabric.restoreSignalsForCompensation(
            revision.compensationToken,
            'hexis-hmx-apply-signal-rollback',
            {
              commandId: 'hexis-signal-rollback:' + hash(
                String(stage.stagingId) + ':' + revision.id + ':' + attempt,
              ).slice(0, 48),
            },
          );
          const restored = (this.memoryFabric.canonicalSnapshot().items ?? []).find(item => item.id === revision.id);
          if (!sameSignalRollbackSnapshot(restored, revision.previous)) {
            rollbackErrors.push('signal-restore-unconfirmed:' + revision.id);
          }
        } catch (signalRollbackError) {
          rollbackErrors.push('signal-restore:' + String(signalRollbackError?.message ?? signalRollbackError).slice(0, 220));
        }
      }
      // Restore trust/certainty metadata changed on pre-existing duplicate rows.
      // The expected-current guard fails closed rather than overwriting later changes.
      if (this.semanticGraph && semanticGraphBefore) {
        try {
          if (semanticGraphMutationCheckpoint === null ||
              typeof this.semanticGraph.restoreIfUnchanged !== 'function' ||
              this.semanticGraph.restoreIfUnchanged(semanticGraphBefore, semanticGraphMutationCheckpoint, projectionMutationToken) !== true) {
            rollbackErrors.push('semantic-graph-conflict');
          }
        } catch (graphRollbackError) {
          rollbackErrors.push('semantic-graph:' + String(graphRollbackError?.message ?? graphRollbackError).slice(0, 220));
        }
      }
      if (this.temporalLedger && temporalLedgerBefore) {
        try {
          if (temporalLedgerMutationCheckpoint === null ||
              typeof this.temporalLedger.restoreIfUnchanged !== 'function' ||
              this.temporalLedger.restoreIfUnchanged(temporalLedgerBefore, temporalLedgerMutationCheckpoint, projectionMutationToken) !== true) {
            rollbackErrors.push('temporal-ledger-conflict');
          }
        } catch (temporalRollbackError) {
          rollbackErrors.push('temporal-ledger:' + String(temporalRollbackError?.message ?? temporalRollbackError).slice(0, 220));
        }
      }
      const reason = String(error?.message ?? error).slice(0, 500);
      throw new Error('hmx-canonical-apply-failed:' + reason + (rollbackErrors.length ? ';rollback-failures=' + rollbackErrors.join('|') : ''));
    }

    if (supersededIds.length) {
      warnings.push('Changed HMX source version superseded ' + supersededIds.length + ' prior canonical version(s); historical records remain stored while their active belief and semantic projections are withdrawn.');
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
    const receipt = { ...base, digest: hash(JSON.stringify(base)) };
    // Once the receipt is fully constructed, the transaction has completed and its
    // rollback capabilities must no longer remain usable or occupy the bounded map.
    for (const revision of revisedSignals) {
      this.memoryFabric.commitSignalCompensation(revision.compensationToken);
    }
    return receipt;
  }
}
