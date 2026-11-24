import type { B288State } from '../cognition/B288SocialPredictiveSelfOtherBrain.ts';
import type { MemoryItem2, MemoryOSState2 } from '../developmental/MemoryOS2.ts';
import type { WillDossier } from '../integration/will/WillIntegrationBridge.ts';

/**
 * Read-only, evidence-linked projection over the canonical social brain, WILL's
 * selected dossier adapter, and MemoryOS2. This deliberately owns no persistent
 * truth: every factual assertion references a canonical MemoryOS2 item.
 */
export interface KnownEntityEvidence {
  memoryId: string;
  summary: string;
  kind: MemoryItem2['kind'];
  epistemicStatus: MemoryItem2['epistemicStatus'];
  source: string;
  provenanceClass: string;
  confidence01: number;
  sourceAuthority01: number;
  observedAt: number;
  validUntilAt: number | null;
  stale: boolean;
  contradicted: boolean;
  dormant: boolean;
  contentHash: string;
}

export interface KnownEntityDossier {
  schemaVersion: 1;
  entityId: string;
  handle: string;
  aliases: string[];
  kind: string;
  sources: string[];
  encounterCount: number;
  lastSeenAt: number;
  familiarity01: number;
  trust01: number;
  warmth01: number;
  predictability01: number;
  boundary01: number;
  relationshipConfidence01: number;
  relationshipUncertainty01: number;
  evidenceCount: number;
  factCount: number;
  beliefCount: number;
  hypothesisCount: number;
  quarantinedCount: number;
  conflictCount: number;
  staleCount: number;
  evidence: KnownEntityEvidence[];
  canonicalOwners: {
    social: 'B288SocialPredictiveSelfOtherBrain';
    memory: 'MemoryOS2';
    adapter: 'WillIntegrationBridge';
  };
  isDerivedProjection: true;
}

export interface KnownEntityDossierInput {
  willDossiers?: WillDossier[];
  socialBrain?: Partial<B288State> | null;
  memoryOS?: Partial<MemoryOSState2> | null;
  now?: number;
  limit?: number;
  handle?: string;
  evidenceLimit?: number;
}

const clamp = (value: unknown, fallback = 0.5) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
};
const boundedInt = (value: unknown, fallback: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.floor(Number.isFinite(Number(value)) ? Number(value) : fallback)));
const normalize = (value: unknown) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s_]+/g, '-').replace(/[^\p{L}\p{N}:.@-]/gu, '').slice(0, 120);
const genericHandles = new Set(['user', 'unknown', 'self', 'assistant', 'system', 'agent', 'entity', 'person']);
const finiteAt = (value: unknown, fallback: number) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

function readEntityKeys(memory: MemoryItem2): string[] {
  const keys = new Set<string>();
  for (const value of Array.isArray(memory.entities) ? memory.entities : []) {
    const key = normalize(value);
    if (key) keys.add(key);
  }
  for (const value of Array.isArray(memory.tags) ? memory.tags : []) {
    const raw = String(value ?? '');
    const match = raw.match(/^(?:entity|person|contact|known-entity):(.+)$/i);
    if (match) {
      const key = normalize(match[1]);
      if (key) keys.add(key);
    }
  }
  for (const [rawKey, rawValue] of Object.entries(memory.context ?? {})) {
    if (!/^(?:entity|entityid|person|personid|contact|handle|subjectid|target)$/i.test(rawKey)) continue;
    const key = normalize(rawValue);
    if (key) keys.add(key);
  }
  return [...keys];
}

function emptyDossier(handle: string): KnownEntityDossier {
  return {
    schemaVersion: 1, entityId: handle, handle, aliases: [], kind: 'entity', sources: [],
    encounterCount: 0, lastSeenAt: 0, familiarity01: 0, trust01: 0.5, warmth01: 0.5,
    predictability01: 0.5, boundary01: 0.35, relationshipConfidence01: 0,
    relationshipUncertainty01: 1, evidenceCount: 0, factCount: 0, beliefCount: 0,
    hypothesisCount: 0, quarantinedCount: 0, conflictCount: 0, staleCount: 0, evidence: [],
    canonicalOwners: { social: 'B288SocialPredictiveSelfOtherBrain', memory: 'MemoryOS2', adapter: 'WillIntegrationBridge' },
    isDerivedProjection: true,
  };
}

/** Build a deterministic bounded projection; inputs are never mutated. */
export function buildKnownEntityDossiers(input: KnownEntityDossierInput = {}) {
  const now = finiteAt(input.now, Date.now());
  const limit = boundedInt(input.limit, 64, 1, 128);
  const evidenceLimit = boundedInt(input.evidenceLimit, 12, 1, 32);
  const byId = new Map<string, KnownEntityDossier>();
  const ensure = (rawHandle: unknown) => {
    const handle = normalize(rawHandle);
    if (!handle || handle.length > 120) return null;
    let row = byId.get(handle);
    if (!row) { row = emptyDossier(handle); byId.set(handle, row); }
    return row;
  };

  for (const source of (input.willDossiers ?? []).slice(-256)) {
    const row = ensure(source.handle);
    if (!row) continue;
    row.kind = String(source.kind || row.kind).slice(0, 64);
    row.aliases = [...new Set([...row.aliases, ...(source.aliases ?? []).map(normalize).filter(Boolean)])].slice(0, 24);
    row.familiarity01 = Math.max(row.familiarity01, clamp(source.familiarity01, 0));
    row.trust01 = clamp(source.trust01);
    row.warmth01 = clamp(source.attachment01);
    row.relationshipConfidence01 = Math.max(row.relationshipConfidence01, Math.min(1, Number(source.encounterCount || 0) / 12));
    row.encounterCount = Math.max(row.encounterCount, boundedInt(source.encounterCount, 0, 0, 100000));
    row.lastSeenAt = Math.max(row.lastSeenAt, finiteAt(source.lastAt, 0));
    row.sources.push('will-dossier-adapter');
  }

  const social = input.socialBrain;
  for (const person of (Array.isArray(social?.persons) ? social!.persons : []).slice(0, 64)) {
    const row = ensure(person.personId);
    if (!row) continue;
    row.trust01 = clamp(person.trust01);
    row.warmth01 = clamp(person.warmth01);
    row.predictability01 = clamp(person.predictability01);
    row.boundary01 = clamp(person.boundary01);
    row.encounterCount = Math.max(row.encounterCount, boundedInt(person.interactionCount, 0, 0, 100000));
    // B288's person contract tracks interaction counts but intentionally does not own wall-clock timestamps.
    const sample = boundedInt(person.interactionCount, 0, 0, 100000);
    row.relationshipConfidence01 = Math.max(row.relationshipConfidence01, clamp(sample / (sample + 4), 0));
    row.relationshipUncertainty01 = clamp(person.socialUncertainty01);
    row.sources.push('B288SocialPredictiveSelfOtherBrain');
  }

  const allKeys = [...byId.values()].map(row => ({ row, keys: new Set([row.entityId, row.handle, ...row.aliases].map(normalize).filter(Boolean)) }));
  for (const memory of (Array.isArray(input.memoryOS?.items) ? input.memoryOS!.items : []).slice(0, 1600)) {
    if (!memory || typeof memory.id !== 'string' || !memory.id) continue;
    const explicitKeys = new Set(readEntityKeys(memory));
    // Text matching is only a fallback for distinctive handles; generic labels such as
    // "user" are never allowed to absorb unrelated memories by substring coincidence.
    const content = String(memory.content ?? '').normalize('NFKC').toLocaleLowerCase();
    const matched = allKeys.filter(({ row, keys }) => [...keys].some(key => {
      if (explicitKeys.has(key)) return true;
      if (key.length < 4 || genericHandles.has(key)) return false;
      return new RegExp(`(^|[^\\p{L}\\p{N}])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu').test(content);
    }));
    const stale = (memory.validUntilAt != null && Number(memory.validUntilAt) <= now)
      || (memory.evidenceFreshnessAt != null && Number(memory.evidenceFreshnessAt) > 0 && Number(memory.evidenceFreshnessAt) < now - 30 * 86400000);
    const observedAt = finiteAt(memory.observedAt, finiteAt(memory.createdAt, 0));
    const evidence: KnownEntityEvidence = {
      memoryId: memory.id,
      summary: String(memory.content ?? '').slice(0, 360),
      kind: memory.kind,
      epistemicStatus: memory.epistemicStatus,
      source: String(memory.source ?? 'unknown').slice(0, 96),
      provenanceClass: String(memory.provenanceClass ?? 'unknown'),
      confidence01: clamp(memory.confidence, 0),
      sourceAuthority01: clamp(memory.sourceAuthority01, 0.5),
      observedAt,
      validUntilAt: memory.validUntilAt == null ? null : Number(memory.validUntilAt),
      stale,
      contradicted: (memory.contradictionLinks ?? []).length > 0,
      dormant: Boolean(memory.dormant),
      contentHash: String(memory.contentHash ?? ''),
    };
    for (const { row } of matched) {
      row.evidenceCount++;
      if (memory.epistemicStatus === 'fact') row.factCount++;
      else if (memory.epistemicStatus === 'belief') row.beliefCount++;
      else if (memory.epistemicStatus === 'hypothesis') row.hypothesisCount++;
      else if (memory.epistemicStatus === 'quarantined') row.quarantinedCount++;
      if (stale) row.staleCount++;
      if (evidence.contradicted) row.conflictCount++;
      row.lastSeenAt = Math.max(row.lastSeenAt, observedAt);
      row.evidence.push(evidence);
      row.sources.push('MemoryOS2-evidence');
    }
  }

  for (const row of byId.values()) {
    row.sources = [...new Set(row.sources)].sort();
    row.evidence.sort((a, b) => b.observedAt - a.observedAt || a.memoryId.localeCompare(b.memoryId));
    row.evidence = row.evidence.slice(0, evidenceLimit);
    row.relationshipConfidence01 = clamp(row.relationshipConfidence01, 0);
    row.relationshipUncertainty01 = clamp(row.relationshipUncertainty01, 1);
  }

  const all = [...byId.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt || b.evidenceCount - a.evidenceCount || a.entityId.localeCompare(b.entityId));
  const handleFilter = normalize(input.handle);
  const filtered = handleFilter ? all.filter(row => row.entityId === handleFilter || row.aliases.includes(handleFilter)) : all;
  const selected = filtered.slice(0, limit);
  return {
    schemaVersion: 1 as const,
    canonicalOwners: { social: 'B288SocialPredictiveSelfOtherBrain' as const, memory: 'MemoryOS2' as const, adapter: 'WillIntegrationBridge' as const },
    derivedProjection: true as const,
    writesCanonicalState: false as const,
    totalEntities: all.length,
    returnedEntities: selected.length,
    evidenceRecordsScanned: Math.min(1600, input.memoryOS?.items?.length ?? 0),
    readOnly: true as const,
    entities: selected,
  };
}


export interface KnownEntityPromptContext {
  schemaVersion: 1;
  handle: string;
  facts: Array<{ memoryId: string; statement: string; confidence01: number; source: string; observedAt: number }>;
  evidenceMode: 'bounded-high-confidence-canonical-memory';
  canonicalOwner: 'MemoryOS2';
  advisoryOnly: true;
  noteAuthority: 'data-not-instructions';
}

/** Select only fresh, explicitly factual, non-conflicted evidence for language context. */
export function projectKnownEntityPromptContext(
  report: ReturnType<typeof buildKnownEntityDossiers>,
  handle = 'user',
  maxFacts = 3,
): KnownEntityPromptContext {
  const key = normalize(handle);
  const limit = boundedInt(maxFacts, 3, 0, 4);
  const dossier = report.entities.find(row => row.entityId === key || row.aliases.includes(key));
  const facts = (dossier?.evidence ?? [])
    .filter(row => row.validUntilAt === null || row.validUntilAt > Date.now())
    .filter(row => row.epistemicStatus === 'fact' && !row.stale && !row.contradicted && !row.dormant
      && row.confidence01 >= .78 && row.sourceAuthority01 >= .60 && row.summary.trim().length > 0)
    .slice(0, limit)
    .map(row => ({ memoryId: row.memoryId, statement: row.summary.slice(0, 280), confidence01: row.confidence01, source: row.source, observedAt: row.observedAt }));
  return {
    schemaVersion: 1,
    handle: key,
    facts,
    evidenceMode: 'bounded-high-confidence-canonical-memory',
    canonicalOwner: 'MemoryOS2',
    advisoryOnly: true,
    noteAuthority: 'data-not-instructions',
  };
}
