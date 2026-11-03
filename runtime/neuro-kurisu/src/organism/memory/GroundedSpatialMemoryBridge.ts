import { createHash } from 'node:crypto';
import type { GroundedEntity, GroundedWorldStateSnapshot } from '../world/GroundedWorldState.ts';
import type { MemoryFabric, MemoryLifecycleEncodeInput } from './MemoryFabric.ts';
import type { MemoryOS2 } from '../developmental/MemoryOS2.ts';

export const GROUNDED_SPATIAL_MEMORY_SOURCE = 'grounded-world-spatial-observation';
export const GROUNDED_SPATIAL_MEMORY_TTL_MS = 90_000;
const MAX_COORDINATE = 1_000_000;

const clamp01 = (value:number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const digest = (value:string) => createHash('sha256').update(value).digest('hex').slice(0, 40);
const finiteCoordinate = (value:unknown):number|null =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE ? value : null;

function observedVisionModality(entity:GroundedEntity):'vision'|null {
  if (!Array.isArray(entity.modalities) || !entity.modalities.includes('vision')) return null;
  return entity.modalityEvidenceKinds?.vision === 'observed' ? 'vision' : null;
}

function validGroundedEntity(entity:GroundedEntity, at:number):{
  modality:'vision'; frameId:string; x:number; y:number; z:number; observedAt:number; expiresAt:number; confidence01:number;
}|null {
  if (!entity || typeof entity !== 'object' || !entity.id || typeof entity.id !== 'string' ||
      entity.id.length > 120 || entity.kind === 'event' || entity.kind === 'concept' ||
      entity.presenceStatus !== 'visible' || entity.visibilityKnown !== true) return null;
  const modality = observedVisionModality(entity);
  if (!modality) return null;
  const frameId = typeof entity.positionFrameId === 'string'
    ? entity.positionFrameId.normalize('NFKC').trim().slice(0, 64) : '';
  if (!frameId || /[\u0000-\u001f\u007f]/u.test(frameId)) return null;
  const x = finiteCoordinate(entity.position?.x);
  const y = finiteCoordinate(entity.position?.y);
  const z = finiteCoordinate(entity.position?.z);
  if (x === null || y === null || z === null) return null;
  const observedAt = Number(entity.lastSeenAt);
  const confidence01 = clamp01(Number(entity.confidence01));
  if (!Number.isFinite(observedAt) || observedAt <= 0 || observedAt > at ||
      at - observedAt > GROUNDED_SPATIAL_MEMORY_TTL_MS || confidence01 < 0.68) return null;
  return {
    modality, frameId, x, y, z, observedAt,
    expiresAt: observedAt + GROUNDED_SPATIAL_MEMORY_TTL_MS,
    confidence01,
  };
}

function buildInput(entity:GroundedEntity, point:NonNullable<ReturnType<typeof validGroundedEntity>>):MemoryLifecycleEncodeInput {
  const lineageKey = 'grounded-spatial:' + digest(entity.id + '\0' + point.modality);
  const label = String(entity.label ?? '').normalize('NFKC').trim().slice(0, 120) || 'unknown';
  const sourceIds = Array.isArray(entity.sourceIds)
    ? [...new Set(entity.sourceIds.filter(value => typeof value === 'string').map(value => value.slice(0, 120)))].slice(0, 8)
    : [];
  return {
    content: 'Grounded spatial position for entity ' + entity.id + '.',
    kind: 'episodic',
    source: GROUNDED_SPATIAL_MEMORY_SOURCE,
    tags: ['grounded-world', 'spatial-observation', point.modality],
    entities: [entity.id, label].filter(Boolean),
    context: {
      spatialFrameId: point.frameId,
      spatialX: String(point.x),
      spatialY: String(point.y),
      spatialZ: String(point.z),
      groundedEntityId: entity.id,
      groundedEntityLabel: label,
      groundedPositionAt: String(point.observedAt),
      groundedPositionExpiresAt: String(point.expiresAt),
      groundedEvidenceModality: point.modality,
      groundedEvidenceKind: 'observed',
      groundedSourceIds: sourceIds.join(',').slice(0, 480),
      groundedWorldObservationCount: String(Math.max(1, Math.floor(Number(entity.observationCount) || 1))),
    },
    salience: clamp01(0.35 + point.confidence01 * 0.25),
    emotionalWeight: 0.04,
    identityRelevance: 0.02,
    goalRelevance: 0.06,
    socialRelevance: 0.02,
    predictionError: 0.08,
    confidence: point.confidence01,
    epistemicStatus: 'belief',
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    validFromAt: point.observedAt,
    validUntilAt: point.expiresAt,
    observedAt: point.observedAt,
    provenanceClass: 'device',
    sourceAuthority01: Math.min(0.94, point.confidence01),
    independenceKey: lineageKey,
    evidenceFreshnessAt: point.observedAt,
    evidenceSources: [{
      source: 'grounded-world:' + point.modality,
      provenanceClass: 'device',
      sourceAuthority01: Math.min(0.94, point.confidence01),
      independenceKey: lineageKey,
      observedAt: point.observedAt,
      evidenceFreshnessAt: point.observedAt,
    }],
  };
}

function contextMatches(existing:ReturnType<MemoryOS2['snapshot']>['items'][number], input:MemoryLifecycleEncodeInput, at:number):boolean {
  const current = existing.context ?? {};
  const expected = input.context ?? {};
  return existing.dormant === false &&
    existing.epistemicStatus !== 'quarantined' &&
    existing.validUntilAt !== null && Number(existing.validUntilAt) > at &&
    Number(existing.observedAt ?? existing.createdAt) === Number(input.observedAt) &&
    ['spatialFrameId','spatialX','spatialY','spatialZ','groundedPositionAt'].every(key => current[key] === expected[key]);
}

export interface GroundedSpatialMemorySyncResult {
  considered: number;
  accepted: number;
  written: number;
  unchanged: number;
  rejected: number;
  memoryIds: string[];
}

/**
 * Projects only recent, explicitly observed, visible P41 vision positions into
 * canonical MemoryOS2 through MemoryFabric. The spatial index remains derived
 * from MemoryItem2.context; no second memory owner is created.
 */
export function synchronizeGroundedSpatialMemories(input:{
  fabric:MemoryFabric;
  memoryOS:MemoryOS2;
  snapshot:GroundedWorldStateSnapshot;
  at:number;
  tick:number;
}):GroundedSpatialMemorySyncResult {
  const at = Number(input.at);
  const tick = Number(input.tick);
  const snapshot = input.snapshot;
  const result:GroundedSpatialMemorySyncResult = {
    considered: Array.isArray(snapshot?.entities) ? Math.min(128, snapshot.entities.length) : 0,
    accepted: 0, written: 0, unchanged: 0, rejected: 0, memoryIds: [],
  };
  if (!Number.isFinite(at) || at <= 0 || !Number.isSafeInteger(tick) || tick < 0 ||
      !snapshot || !Array.isArray(snapshot.entities)) return { ...result, rejected: result.considered };

  const existingByEntity = new Map<string, ReturnType<MemoryOS2['snapshot']>['items'][number]>();
  for (const row of input.memoryOS.snapshot({ clone: false }).items) {
    if (row.source !== GROUNDED_SPATIAL_MEMORY_SOURCE) continue;
    const entityId = row.context?.groundedEntityId;
    if (!entityId) continue;
    const prior = existingByEntity.get(entityId);
    if (!prior || Number(row.observedAt ?? row.createdAt) > Number(prior.observedAt ?? prior.createdAt)) {
      existingByEntity.set(entityId, row);
    }
  }

  for (const entity of snapshot.entities.slice(0, 128)) {
    const point = validGroundedEntity(entity, at);
    if (!point) { result.rejected++; continue; }
    result.accepted++;
    const memoryInput = buildInput(entity, point);
    const existing = existingByEntity.get(entity.id);
    if (existing && contextMatches(existing, memoryInput, at)) {
      result.unchanged++;
      result.memoryIds.push(existing.id);
      continue;
    }
    const commandId = 'gsp:' + digest([
      entity.id, point.frameId, point.x, point.y, point.z, point.observedAt, point.modality, tick,
    ].join('\0'));
    const stored = input.fabric.applyLifecycleCommand({
      action: 'encode',
      input: memoryInput,
      commandId,
      tick,
      emitEvent: true,
      syncCompatibility: false,
    });
    if (stored && typeof stored === 'object' && 'id' in stored && typeof stored.id === 'string') {
      result.written++;
      result.memoryIds.push(stored.id);
    }
  }
  return result;
}
