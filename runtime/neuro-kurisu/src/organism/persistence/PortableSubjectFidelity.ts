import type { PersistedOrganism } from '../core/OrganismCore.ts';
import {
  applyPortableSubjectBundle,
  buildPortableSubjectBundle,
  subjectFingerprint,
  subjectProjectionFromPersisted,
  validatePortableSubjectBundle,
  type PortableSubjectBundle,
  type PortableSubjectProjection,
} from './PortableSubjectContract.ts';
import { RELEASE_CONTRACT } from '../system/ReleaseContract.ts';

export type PortableSubjectFidelityStatus = 'verified' | 'partial' | 'insufficient';

export interface PortableSubjectFidelitySection {
  present: boolean;
  itemCount: number;
  uniqueIds: number;
  duplicateIds: number;
}

export interface PortableSubjectFidelityReport {
  protocol: string;
  status: PortableSubjectFidelityStatus;
  subjectId: string | null;
  sourceRelease: string | null;
  sourceSchema: number | null;
  targetRelease: string;
  targetSchema: number;
  fingerprintValid: boolean;
  roundTrip: { attempted: boolean; matched: boolean; sourceFingerprint: string | null; restoredFingerprint: string | null };
  hostBoundaryPreserved: boolean;
  subjectIdentityPreserved: boolean;
  portabilityCoverage01: number;
  contentDensity01: number;
  payloadBytes: number;
  sections: Record<'state'|'goals'|'traces'|'memories'|'worldModel'|'facets', PortableSubjectFidelitySection>;
  warnings: string[];
  note: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function itemStats(value: unknown): PortableSubjectFidelitySection {
  if (!Array.isArray(value)) return { present: false, itemCount: 0, uniqueIds: 0, duplicateIds: 0 };
  const ids = value.map((row) => isRecord(row) && typeof row.id === 'string' ? row.id : null).filter((id): id is string => id !== null);
  const unique = new Set(ids);
  return { present: true, itemCount: value.length, uniqueIds: unique.size, duplicateIds: ids.length - unique.size };
}
function objectStats(value: unknown): PortableSubjectFidelitySection {
  if (!isRecord(value)) return { present: false, itemCount: 0, uniqueIds: 0, duplicateIds: 0 };
  return { present: true, itemCount: Object.keys(value).length, uniqueIds: Object.keys(value).length, duplicateIds: 0 };
}
function projectionSections(projection: PortableSubjectProjection) {
  const facets = projection.facets as unknown as Record<string, unknown>;
  const requiredFacets = ['memory', 'learning', 'consciousness', 'evolution', 'cognition', 'advanced'];
  const allFacetsPresent = requiredFacets.every((key) => isRecord(facets[key]));
  return {
    state: objectStats(projection.state),
    goals: itemStats(projection.goals),
    traces: itemStats(projection.traces),
    memories: itemStats(projection.memories),
    worldModel: objectStats(projection.worldModel),
    facets: { present: allFacetsPresent, itemCount: requiredFacets.filter((key) => isRecord(facets[key])).length, uniqueIds: requiredFacets.filter((key) => isRecord(facets[key])).length, duplicateIds: 0 },
  } satisfies PortableSubjectFidelityReport['sections'];
}

/**
 * Evaluates portability using the existing canonical projection and transfer contract.
 * The routine is diagnostic-only: it never writes into the caller's source object.
 * `verified` means a structurally valid bundle survives an exact projection round-trip
 * while preserving host-owned fields; it is not a claim of behavioral equivalence on
 * every possible future interaction.
 */
export function evaluatePortableSubjectFidelity(source: PersistedOrganism, candidate?: unknown): PortableSubjectFidelityReport {
  const warnings: string[] = [];
  let bundle: PortableSubjectBundle;
  let fingerprintValid = false;
  let sections: PortableSubjectFidelityReport['sections'] = {
    state: { present: false, itemCount: 0, uniqueIds: 0, duplicateIds: 0 },
    goals: { present: false, itemCount: 0, uniqueIds: 0, duplicateIds: 0 },
    traces: { present: false, itemCount: 0, uniqueIds: 0, duplicateIds: 0 },
    memories: { present: false, itemCount: 0, uniqueIds: 0, duplicateIds: 0 },
    worldModel: { present: false, itemCount: 0, uniqueIds: 0, duplicateIds: 0 },
    facets: { present: false, itemCount: 0, uniqueIds: 0, duplicateIds: 0 },
  };
  let serialized = '';
  try {
    bundle = (candidate ?? buildPortableSubjectBundle(source)) as PortableSubjectBundle;
    validatePortableSubjectBundle(bundle);
    fingerprintValid = subjectFingerprint(bundle.projection) === bundle.subjectFingerprint;
    sections = projectionSections(bundle.projection);
    serialized = JSON.stringify(bundle);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`bundle-validation-failed:${message.slice(0, 240)}`);
    return {
      protocol: 'neuro-kurisu.subject-transfer.v1', status: 'insufficient', subjectId: isRecord(candidate) && typeof candidate.subjectId === 'string' ? candidate.subjectId : null,
      sourceRelease: isRecord(candidate) && typeof candidate.sourceRelease === 'string' ? candidate.sourceRelease : null,
      sourceSchema: isRecord(candidate) && Number.isFinite(Number(candidate.sourceSchema)) ? Number(candidate.sourceSchema) : null,
      targetRelease: RELEASE_CONTRACT.application, targetSchema: RELEASE_CONTRACT.stateSchema, fingerprintValid: false,
      roundTrip: { attempted: false, matched: false, sourceFingerprint: null, restoredFingerprint: null }, hostBoundaryPreserved: false, subjectIdentityPreserved: false,
      portabilityCoverage01: 0, contentDensity01: 0, payloadBytes: 0, sections, warnings,
      note: 'Bundle failed validation; no reconstruction was attempted.',
    };
  }

  let roundTripMatched = false;
  let hostBoundaryPreserved = false;
  let subjectIdentityPreserved = false;
  let restoredFingerprint: string | null = null;
  try {
    const restored = applyPortableSubjectBundle(source, bundle, { adoptSubjectIdentity: true });
    const restoredProjection = subjectProjectionFromPersisted(restored);
    restoredFingerprint = subjectFingerprint(restoredProjection);
    roundTripMatched = restoredFingerprint === bundle.subjectFingerprint;
    hostBoundaryPreserved = sameJson((source.facets as any).embodiment, (restored.facets as any).embodiment)
      && sameJson(source.system.capabilities, restored.system.capabilities);
    subjectIdentityPreserved = restored.system.subjectIdentity?.subjectId === bundle.subjectId;
    if (!roundTripMatched) warnings.push('projection-round-trip-mismatch');
    if (!hostBoundaryPreserved) warnings.push('host-owned-boundary-mismatch');
    if (!subjectIdentityPreserved) warnings.push('subject-identity-mismatch');
  } catch (error) {
    warnings.push(`round-trip-failed:${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`);
  }

  const sectionValues = Object.values(sections);
  const portabilityCoverage01 = sectionValues.length ? sectionValues.filter((section) => section.present).length / sectionValues.length : 0;
  const densityParts = [sections.state.itemCount > 0, sections.goals.itemCount > 0, sections.traces.itemCount > 0, sections.memories.itemCount > 0, sections.worldModel.itemCount > 0, sections.facets.itemCount >= 6];
  const contentDensity01 = densityParts.filter(Boolean).length / densityParts.length;
  if (sections.goals.itemCount === 0) warnings.push('empty-goal-set-is-structurally-portable');
  if (sections.memories.itemCount === 0) warnings.push('empty-memory-set-is-structurally-portable');
  for (const name of ['goals', 'memories'] as const) if (sections[name].duplicateIds > 0) warnings.push(`${name}-contain-duplicate-ids`);
  if (bundle.sourceSchema !== RELEASE_CONTRACT.stateSchema) warnings.push('schema-migration-required-before-production-import');
  if (bundle.sourceRelease !== RELEASE_CONTRACT.application) warnings.push('release-version-differs-from-current-runtime');

  const structural = portabilityCoverage01 === 1 && fingerprintValid;
  const verified = structural && roundTripMatched && hostBoundaryPreserved && subjectIdentityPreserved;
  return {
    protocol: bundle.protocol,
    status: verified ? 'verified' : (structural ? 'partial' : 'insufficient'),
    subjectId: bundle.subjectId,
    sourceRelease: bundle.sourceRelease,
    sourceSchema: bundle.sourceSchema,
    targetRelease: RELEASE_CONTRACT.application,
    targetSchema: RELEASE_CONTRACT.stateSchema,
    fingerprintValid,
    roundTrip: { attempted: true, matched: roundTripMatched, sourceFingerprint: bundle.subjectFingerprint, restoredFingerprint },
    hostBoundaryPreserved,
    subjectIdentityPreserved,
    portabilityCoverage01: Number(portabilityCoverage01.toFixed(4)),
    contentDensity01: Number(contentDensity01.toFixed(4)),
    payloadBytes: new TextEncoder().encode(serialized).byteLength,
    sections,
    warnings,
    note: 'Verified means exact projection round-trip plus host-boundary preservation. It is not a full behavioral benchmark or proof of subjective continuity.',
  };
}
