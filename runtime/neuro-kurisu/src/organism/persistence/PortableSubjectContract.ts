import { createHash, randomUUID } from 'node:crypto';
import type { PersistedOrganism } from '../core/OrganismCore.ts';
import { RELEASE_CONTRACT } from '../system/ReleaseContract.ts';

export const PORTABLE_SUBJECT_PROTOCOL = 'neuro-kurisu.subject-transfer.v1';

import type { SubjectIdentityRecord } from '../core/types.ts';


export interface PortableSubjectProjection {
  state: PersistedOrganism['state'];
  goals: PersistedOrganism['goals'];
  traces: PersistedOrganism['traces'];
  memories: PersistedOrganism['memories'];
  worldModel: PersistedOrganism['worldModel'];
  facets: Pick<PersistedOrganism['facets'], 'memory'|'learning'|'consciousness'|'evolution'|'cognition'|'advanced'>;
}

export interface PortableSubjectBundle {
  protocol: typeof PORTABLE_SUBJECT_PROTOCOL;
  subjectId: string;
  exportedAt: number;
  sourceRelease: string;
  sourceSchema: number;
  projection: PortableSubjectProjection;
  subjectFingerprint: string;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k, sortValue(v)]));
  }
  return value;
}

export function subjectProjectionFromPersisted(persisted: PersistedOrganism): PortableSubjectProjection {
  return {
    state: structuredClone(persisted.state),
    goals: structuredClone(persisted.goals),
    traces: structuredClone(persisted.traces),
    memories: structuredClone(persisted.memories),
    worldModel: structuredClone(persisted.worldModel),
    facets: structuredClone({
      memory: persisted.facets.memory,
      learning: persisted.facets.learning,
      consciousness: persisted.facets.consciousness,
      evolution: persisted.facets.evolution,
      cognition: persisted.facets.cognition,
      advanced: persisted.facets.advanced,
    }),
  };
}

export function subjectFingerprint(projection: PortableSubjectProjection): string {
  const canonical = JSON.stringify(sortValue(projection));
  return createHash('sha256').update(canonical).digest('hex');
}

export function ensureSubjectIdentity(system: PersistedOrganism['system']): SubjectIdentityRecord {
  const existing = system.subjectIdentity;
  if (existing?.subjectId && existing?.fingerprint) return structuredClone(existing);
  return {
    subjectId: existing?.subjectId || randomUUID(),
    createdAt: Number(existing?.createdAt || Date.now()),
    lastTransferAt: Number(existing?.lastTransferAt || 0),
    transferCount: Number(existing?.transferCount || 0),
    fingerprint: String(existing?.fingerprint || ''),
  };
}

export function buildPortableSubjectBundle(persisted: PersistedOrganism): PortableSubjectBundle {
  const projection = subjectProjectionFromPersisted(persisted);
  const identity = ensureSubjectIdentity(persisted.system);
  const fingerprint = subjectFingerprint(projection);
  return {
    protocol: PORTABLE_SUBJECT_PROTOCOL,
    subjectId: identity.subjectId,
    exportedAt: Date.now(),
    sourceRelease: RELEASE_CONTRACT.application,
    sourceSchema: RELEASE_CONTRACT.stateSchema,
    projection,
    subjectFingerprint: fingerprint,
  };
}

export function validatePortableSubjectBundle(bundle: unknown): asserts bundle is PortableSubjectBundle {
  if (!bundle || typeof bundle !== 'object') throw new Error('Invalid portable subject bundle: expected object');
  const b = bundle as Partial<PortableSubjectBundle>;
  if (b.protocol !== PORTABLE_SUBJECT_PROTOCOL) throw new Error(`Unsupported portable subject protocol: ${String(b.protocol)}`);
  if (!b.subjectId || typeof b.subjectId !== 'string') throw new Error('Portable subject bundle is missing subjectId');
  if (!b.projection || typeof b.projection !== 'object') throw new Error('Portable subject bundle is missing projection');
  if (!b.subjectFingerprint || typeof b.subjectFingerprint !== 'string') throw new Error('Portable subject bundle is missing subjectFingerprint');
  const expected = subjectFingerprint(b.projection as PortableSubjectProjection);
  if (expected !== b.subjectFingerprint) throw new Error('Portable subject fingerprint mismatch: bundle is corrupted or mutated');
  if (Object.prototype.hasOwnProperty.call(b.projection, 'facets') && Object.prototype.hasOwnProperty.call((b.projection as any).facets, 'embodiment')) {
    throw new Error('Portable subject boundary violation: embodiment must remain host-owned');
  }
}

export function applyPortableSubjectBundle(current: PersistedOrganism, bundle: PortableSubjectBundle, options: { adoptSubjectIdentity?: boolean } = {}): PersistedOrganism {
  validatePortableSubjectBundle(bundle);
  const identity = ensureSubjectIdentity(current.system);
  const mayAdopt = options.adoptSubjectIdentity === true;
  if (!mayAdopt && identity.subjectId !== bundle.subjectId) throw new Error(`Subject identity mismatch: local=${identity.subjectId} incoming=${bundle.subjectId}`);
  const next = structuredClone(current);
  next.state = structuredClone(bundle.projection.state);
  next.goals = structuredClone(bundle.projection.goals);
  next.traces = structuredClone(bundle.projection.traces);
  next.memories = structuredClone(bundle.projection.memories);
  next.worldModel = structuredClone(bundle.projection.worldModel);
  next.facets.memory = structuredClone(bundle.projection.facets.memory);
  next.facets.learning = structuredClone(bundle.projection.facets.learning);
  next.facets.consciousness = structuredClone(bundle.projection.facets.consciousness);
  next.facets.evolution = structuredClone(bundle.projection.facets.evolution);
  next.facets.cognition = structuredClone(bundle.projection.facets.cognition);
  next.facets.advanced = structuredClone(bundle.projection.facets.advanced);
  next.schemaVersion = RELEASE_CONTRACT.stateSchema;
  next.system.schemaVersion = RELEASE_CONTRACT.stateSchema;
  next.system.release = RELEASE_CONTRACT.application;
  next.system.organismCore = RELEASE_CONTRACT.organismCore;
  const updated: SubjectIdentityRecord = {
    subjectId: mayAdopt ? bundle.subjectId : identity.subjectId,
    createdAt: identity.createdAt || bundle.exportedAt,
    lastTransferAt: Date.now(),
    transferCount: identity.transferCount + 1,
    fingerprint: bundle.subjectFingerprint,
  };
  next.system.subjectIdentity = updated;
  return next;
}
