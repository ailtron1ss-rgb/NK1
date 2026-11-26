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

const MAX_PORTABLE_SUBJECT_DEPTH = 64;
const MAX_PORTABLE_SUBJECT_NODES = 1_000_000;
const MAX_PORTABLE_SUBJECT_BYTES = 64 * 1024 * 1024;
const PROJECTION_KEYS = new Set(['state', 'goals', 'traces', 'memories', 'worldModel', 'facets']);
const FACET_KEYS = ['memory', 'learning', 'consciousness', 'evolution', 'cognition', 'advanced'] as const;
const FACET_KEY_SET = new Set<string>(FACET_KEYS);
const BUNDLE_KEYS = new Set(['protocol', 'subjectId', 'exportedAt', 'sourceRelease', 'sourceSchema', 'projection', 'subjectFingerprint']);
const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/** Reject accessors, cycles, exotic prototypes and unbounded/non-JSON data before fingerprinting. */
function assertPortableSubjectData(value: unknown, label = 'bundle'): void {
  const active = new WeakSet<object>();
  let nodes = 0;
  const visit = (current: unknown, path: string, depth: number): void => {
    nodes += 1;
    if (nodes > MAX_PORTABLE_SUBJECT_NODES) throw new Error(`Portable subject ${label} exceeds node budget`);
    if (depth > MAX_PORTABLE_SUBJECT_DEPTH) throw new Error(`Portable subject ${label} exceeds nesting depth`);
    if (current === null || current === undefined || typeof current === 'string' || typeof current === 'boolean') return;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new Error(`Portable subject ${path} contains a non-finite number`);
      return;
    }
    if (typeof current !== 'object') throw new Error(`Portable subject ${path} contains non-JSON data`);
    if (active.has(current)) throw new Error(`Portable subject ${path} contains a cyclic reference`);
    active.add(current);
    try {
      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) throw new Error(`Portable subject ${path} has an exotic array prototype`);
        const lengthDescriptor = Object.getOwnPropertyDescriptor(current, 'length');
        const length = lengthDescriptor && 'value' in lengthDescriptor ? lengthDescriptor.value : undefined;
        if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > 250_000) {
          throw new Error(`Portable subject ${path} has an invalid array length`);
        }
        for (const key of Reflect.ownKeys(current)) {
          if (key === 'length') continue;
          if (typeof key !== 'string' || !/^(?:0|[1-9]\d*)$/.test(key) || Number(key) >= length) {
            throw new Error(`Portable subject ${path} contains a non-index array property`);
          }
        }
        for (let index = 0; index < length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
          if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== true) {
            throw new Error(`Portable subject ${path} contains a sparse or accessor array entry`);
          }
          visit(descriptor.value, `${path}[${index}]`, depth + 1);
        }
        return;
      }
      if (!isPlainRecord(current)) throw new Error(`Portable subject ${path} must use a plain data object`);
      const keys = Reflect.ownKeys(current);
      if (keys.length > 100_000) throw new Error(`Portable subject ${path} exceeds property budget`);
      for (const rawKey of keys) {
        if (typeof rawKey !== 'string') throw new Error(`Portable subject ${path} contains a symbol key`);
        if (rawKey === '__proto__' || rawKey === 'prototype' || rawKey === 'constructor') {
          throw new Error(`Portable subject ${path} contains a forbidden property name`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(current, rawKey);
        if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== true) {
          throw new Error(`Portable subject ${path}.${rawKey} contains an accessor or hidden property`);
        }
        visit(descriptor.value, `${path}.${rawKey}`, depth + 1);
      }
    } finally {
      active.delete(current);
    }
  };
  visit(value, label, 0);
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
  try {
    assertPortableSubjectData(bundle);
    if (!isPlainRecord(bundle)) throw new Error('Invalid portable subject bundle: expected a plain data object');
    const bundleKeys = Object.keys(bundle);
    if (bundleKeys.some(key => !BUNDLE_KEYS.has(key))) throw new Error('Portable subject bundle contains unknown top-level fields');
    const b = bundle as Partial<PortableSubjectBundle>;
    if (b.protocol !== PORTABLE_SUBJECT_PROTOCOL) throw new Error(`Unsupported portable subject protocol: ${String(b.protocol)}`);
    if (typeof b.subjectId !== 'string' || !b.subjectId.trim() || b.subjectId.length > 160 || /[\u0000-\u001f\u007f]/.test(b.subjectId)) {
      throw new Error('Portable subject bundle has an invalid subjectId');
    }
    if (typeof b.exportedAt !== 'number' || !Number.isFinite(b.exportedAt) || b.exportedAt <= 0) {
      throw new Error('Portable subject bundle has an invalid exportedAt timestamp');
    }
    if (typeof b.sourceRelease !== 'string' || !b.sourceRelease.trim() || b.sourceRelease.length > 120) {
      throw new Error('Portable subject bundle has an invalid sourceRelease');
    }
    if (typeof b.sourceSchema !== 'number' || !Number.isSafeInteger(b.sourceSchema) || b.sourceSchema < 1) {
      throw new Error('Portable subject bundle has an invalid sourceSchema');
    }
    if (!/^[a-f0-9]{64}$/.test(String(b.subjectFingerprint ?? ''))) {
      throw new Error('Portable subject bundle has an invalid subjectFingerprint');
    }
    const projection = b.projection;
    if (!isPlainRecord(projection)) throw new Error('Portable subject bundle is missing a plain projection object');
    if (Object.keys(projection).some(key => !PROJECTION_KEYS.has(key))) {
      throw new Error('Portable subject projection contains an unsupported section');
    }
    for (const key of ['state', 'worldModel'] as const) {
      if (!isPlainRecord(projection[key])) throw new Error(`Portable subject projection.${key} must be an object`);
    }
    for (const key of ['goals', 'traces', 'memories'] as const) {
      if (!Array.isArray(projection[key])) throw new Error(`Portable subject projection.${key} must be an array`);
    }
    if (!isPlainRecord(projection.facets)) throw new Error('Portable subject projection.facets must be an object');
    if (Object.keys(projection.facets).some(key => !FACET_KEY_SET.has(key))) {
      throw new Error('Portable subject projection.facets contains an unsupported or host-owned facet');
    }
    for (const key of FACET_KEYS) {
      if (!isPlainRecord(projection.facets[key])) {
        throw new Error(`Portable subject projection.facets.${key} is missing or invalid`);
      }
    }
    const serialized = JSON.stringify(bundle);
    const payloadBytes = new TextEncoder().encode(serialized).byteLength;
    if (payloadBytes > MAX_PORTABLE_SUBJECT_BYTES) {
      throw new Error('Portable subject bundle exceeds the 64 MiB import budget');
    }
    const expected = subjectFingerprint(projection as unknown as PortableSubjectProjection);
    if (expected !== b.subjectFingerprint) throw new Error('Portable subject fingerprint mismatch: bundle is corrupted or mutated');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('Portable subject') || message.startsWith('Unsupported portable subject')) throw error;
    throw new Error(`Portable subject bundle validation failed: ${message.slice(0, 200)}`);
  }
}

export function applyPortableSubjectBundle(current: PersistedOrganism, bundle: PortableSubjectBundle, options: { adoptSubjectIdentity?: boolean } = {}): PersistedOrganism {
  validatePortableSubjectBundle(bundle);
  if (bundle.sourceSchema !== RELEASE_CONTRACT.stateSchema) {
    throw new Error(`portable-subject-schema-mismatch:source=${bundle.sourceSchema}:target=${RELEASE_CONTRACT.stateSchema}`);
  }
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
