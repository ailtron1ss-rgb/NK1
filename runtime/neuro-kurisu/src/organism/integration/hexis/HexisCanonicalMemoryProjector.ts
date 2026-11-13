import { createHash } from 'node:crypto';
import { sha256Stable } from '../../core/StableSerialization.ts';
import type { MemorySubsystemRuntime } from '../../core/MemorySubsystemRuntime.ts';
import type { MemoryLifecycleEncodeInput } from '../../memory/MemoryFabric.ts';
import type { SemanticEdge } from '../../memory/SemanticMemoryGraph.ts';
import type { HexisAdaptationFabric, HexisHmxApplyReceipt, HexisHmxStage } from './HexisAdaptationFabric.ts';

const clamp = (value: unknown, fallback: number, min = 0, max = 1): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asText = (value: unknown, max: number): string => {
  if (typeof value !== 'string') return '';
  const normalized = value.normalize('NFKC').trim();
  return normalized.length > 0 && normalized.length <= max && !/[\u0000-\u001f\u007f-\u009f]/u.test(normalized)
    ? normalized : '';
};
const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const stableMemoryId = (lineage: string, portableRef: string): string =>
  'hexis-' + sha256(lineage + '\u0000' + portableRef).slice(0, 40);
const timestamp = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
};
const safeStringList = (value: unknown, limit: number, maxChars: number): string[] =>
  Array.isArray(value)
    ? [...new Set(value.map(row => asText(row, maxChars)).filter(Boolean))].slice(0, limit)
    : [];

const kindFromHmx = (value: unknown): MemoryLifecycleEncodeInput['kind'] => {
  const kind = String(value ?? '').toLowerCase();
  if (kind === 'identity') return 'semantic';
  if (kind === 'autobiographical') return 'episodic';
  if (kind === 'relationship') return 'social';
  if (['sensory', 'working', 'episodic', 'semantic', 'procedural', 'social', 'dream'].includes(kind)) {
    return kind as MemoryLifecycleEncodeInput['kind'];
  }
  return 'semantic';
};

const EDGE_TYPES: Record<string, SemanticEdge['relation']> = {
  supports: 'supports',
  contradicts: 'contradicts',
  causes: 'causes',
  associated: 'associated',
  about: 'about',
  located: 'located',
};

/**
 * Projects a reviewed HMX 1.7 memory slice into NK1's one canonical MemoryOS2
 * owner. Foreign identity, goals, worldview, drives, embeddings and raw dialog
 * never become canonical state through this adapter.
 */
export class HexisCanonicalMemoryProjector {
  constructor(
    private readonly memory: MemorySubsystemRuntime,
    private readonly hexis: HexisAdaptationFabric,
  ) {}

  apply(stage: HexisHmxStage, tick = 0): HexisHmxApplyReceipt {
    if (stage.status !== 'accepted') throw new Error('hmx-stage-not-accepted');
    if (stage.intent !== 'port' || stage.strategy !== 'additive') {
      throw new Error('hmx-canonical-apply-requires-port-additive');
    }
    if (!stage.sourceLineageId) throw new Error('hmx-source-lineage-required');
    const lineage = asText(stage.sourceLineageId, 256);
    if (!lineage) throw new Error('hmx-source-lineage-invalid');

    const rawMemories = stage.stagedSections.memories;
    const rawRelationships = stage.stagedSections.relationships;
    const memories = Array.isArray(rawMemories) ? rawMemories : [];
    const relationships = Array.isArray(rawRelationships) ? rawRelationships : [];
    if (memories.length > 256 || relationships.length > 512) throw new Error('hmx-canonical-apply-capacity-exceeded');

    const memoryOSBefore = this.memory.memoryOS.snapshot();
    const memoryFabricBefore = this.memory.fabric.snapshot();
    const eventsBefore = this.memory.events.list();
    const semanticGraphBefore = this.memory.semanticMemory.snapshot();
    const hexisBefore = this.hexis.snapshot();

    try {
      const refToNode = new Map<string, string>();
      const refToMemory = new Map<string, string>();
      const seenRefs = new Set<string>();
      const memoryIds: string[] = [];
      const createdMemoryIds: string[] = [];
      const semanticEdgeIds: string[] = [];
      let importedCount = 0;
      let deduplicatedCount = 0;
      const now = Date.now();
      const lineageKey = 'hexis:' + sha256(lineage).slice(0, 32);

      for (let index = 0; index < memories.length; index += 1) {
        const row = asRecord(memories[index]);
        const ref = asText(row.ref, 512);
        const content = asText(row.content, 12_000);
        const type = asText(row.type, 64);
        if (!ref || !content || !type || !ref.startsWith(stage.exportId + ':')) {
          throw new Error('hmx-memory-record-invalid:' + index);
        }
        if (seenRefs.has(ref)) throw new Error('hmx-memory-ref-duplicate:' + index);
        seenRefs.add(ref);

        // HMX refs are portable within an export. Stable suffix + lineage makes
        // IDs stable across re-exports, without allowing two origins to collide.
        const portableRef = ref.slice(stage.exportId.length + 1);
        const id = stableMemoryId(lineage, portableRef);
        const metadata = asRecord(row.metadata);
        const provenance = asRecord(row.provenance);
        const prior = this.memory.memoryOS.get(id);
        if (prior) {
          const priorContext = asRecord(prior.context);
          if (prior.content !== content || priorContext.hmxSourceLineageId !== lineage ||
              priorContext.hmxPortableRef !== portableRef) {
            throw new Error('hmx-memory-identity-conflict:' + id);
          }
          deduplicatedCount += 1;
        }

        const createdAt = timestamp(row.created_at, now);
        const validFromAt = timestamp(row.valid_from, createdAt);
        const confidence = Math.min(0.55, clamp(row.trust_level, 0.45, 0.05, 0.55));
        const tags = safeStringList(metadata.tags, 24, 64);
        const entities = safeStringList(metadata.entities, 24, 96);
        const context: Record<string, string> = {
          hmxFormat: '1.7',
          hmxExportId: stage.exportId,
          hmxSourceInstanceId: stage.sourceSubjectId ?? 'unknown',
          hmxSourceLineageId: lineage,
          hmxPortableRef: portableRef,
          hmxSourceId: asText(provenance.source_id, 192) || 'unattributed',
          hmxSourceType: asText(provenance.source_type, 96) || 'external',
          hmxEvidenceClass: asText(provenance.evidence_class, 64) || 'unverified',
        };

        const input: MemoryLifecycleEncodeInput = {
          id,
          content,
          kind: kindFromHmx(type),
          source: lineageKey,
          tags: [...new Set(['hexis', 'hmx-1.7', 'external', ...tags])].slice(0, 32),
          context,
          salience: clamp(row.importance, 0.5, 0.1, 0.8),
          emotionalWeight: 0.05,
          identityRelevance: 0,
          goalRelevance: 0,
          socialRelevance: 0,
          predictionError: 0,
          confidence,
          epistemicStatus: 'belief',
          entities,
          semanticLinks: [],
          temporalLinks: [],
          causalLinks: [],
          contradictionLinks: [],
          provenanceClass: 'external',
          sourceAuthority01: Math.min(0.55, clamp(row.trust_level, 0.35, 0.05, 0.55)),
          independenceKey: lineageKey,
          observedAt: timestamp(row.observed_at, createdAt),
          evidenceFreshnessAt: now,
          validFromAt,
        };
        const item = this.memory.fabric.encode(input, {
          tick: Math.max(0, Math.floor(Number(tick) || 0)),
          commandId: 'hexis-hmx-import:' + sha256(lineage + '\u0000' + portableRef + '\u0000' + stage.exportId),
          forceDistinct: true,
          syncCompatibility: false,
        });
        memoryIds.push(item.id);
        if (!prior) {
          importedCount += 1;
          createdMemoryIds.push(item.id);
        }

        const node = this.memory.semanticMemory.upsertNode(
          content.slice(0, 96),
          item.kind === 'episodic' ? 'episode' : 'concept',
          item.salience,
          lineageKey + ':' + portableRef,
        );
        refToNode.set(ref, node.id);
        refToMemory.set(ref, item.id);

        if (!prior) {
          this.hexis.recordTemporalAssertion({
            memoryId: item.id,
            summary: item.content,
            confidence01: item.confidence,
            validFrom: item.validFromAt ?? item.createdAt,
            source: 'hexis-hmx-1.7:' + lineage,
            value: item.contentHash ?? item.content,
          });
        }
      }

      let projectedRelationships = 0;
      let deferredRelationships = 0;
      for (const raw of relationships) {
        const row = asRecord(raw);
        const from = asText(row.source_ref, 512);
        const to = asText(row.target_ref, 512);
        const relation = EDGE_TYPES[String(row.edge_type ?? '').toLowerCase()];
        const fromNode = refToNode.get(from);
        const toNode = refToNode.get(to);
        if (!fromNode || !toNode || !relation) {
          deferredRelationships += 1;
          continue;
        }
        const properties = asRecord(row.properties);
        const weight = clamp(properties.weight, 0.45, 0.05, 1);
        const edge = this.memory.semanticMemory.connect(fromNode, toNode, relation, weight);
        semanticEdgeIds.push(edge.id);
        projectedRelationships += 1;
      }

      const deferredSections: Record<string, number> = {};
      for (const [name, value] of Object.entries(stage.stagedSections)) {
        if (name === 'memories' || name === 'relationships') continue;
        const count = Array.isArray(value) ? value.length : (value && typeof value === 'object' ? Object.keys(value).length : 0);
        if (count > 0) deferredSections[name] = count;
      }
      const warnings: string[] = [];
      if (Object.keys(deferredSections).length > 0) {
        warnings.push('Protected or unsupported HMX sections remain staged; canonical identity and goal stores were not changed.');
      }
      if (deferredRelationships > 0) {
        warnings.push('Relationships with non-imported endpoints or unsupported edge types were deferred.');
      }
      warnings.push('Foreign embedding vectors and raw dialogue units were not imported.');
      const base = {
        version: 1 as const,
        exportId: stage.exportId,
        sourceLineageId: lineage,
        stageId: stage.stagingId,
        stageDigest: stage.digest,
        appliedAt: now,
        status: (Object.keys(deferredSections).length > 0 || deferredRelationships > 0 ? 'partial' : (importedCount > 0 ? 'applied' : 'noop')) as 'applied' | 'partial' | 'noop',
        complete: Object.keys(deferredSections).length === 0 && deferredRelationships === 0,
        candidateMemoryRecords: memories.length,
        uniqueMemoryRecords: seenRefs.size,
        importedCount,
        deduplicatedCount,
        projectedRelationships,
        deferredRelationships,
        semanticEdgeIds: [...new Set(semanticEdgeIds)],
        memoryIds: [...new Set(memoryIds)],
        createdMemoryIds: [...new Set(createdMemoryIds)],
        deferredSections,
        warnings,
      };
      return { ...base, digest: sha256Stable(base, 'hexis-hmx-apply-v1') };
    } catch (error) {
      this.memory.memoryOS.restore(memoryOSBefore);
      this.memory.fabric.restore(memoryFabricBefore);
      this.memory.events.restore(eventsBefore);
      this.memory.semanticMemory.restore(semanticGraphBefore);
      this.hexis.restore(hexisBefore);
      throw error;
    }
  }
}
