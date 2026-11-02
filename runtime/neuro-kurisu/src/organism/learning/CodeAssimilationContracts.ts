import { createHash } from 'node:crypto';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';

/**
 * Code-assimilation intake contracts.
 *
 * This module validates metadata and lifecycle transitions only. It does not fetch,
 * build, execute, approve, activate or grant permissions to external code.
 */
export type CodeAssimilationStage =
  | 'discovered'
  | 'researched'
  | 'quarantined'
  | 'provenance-checked'
  | 'analyzed'
  | 'adapted'
  | 'built'
  | 'tested'
  | 'shadow'
  | 'staged'
  | 'approved'
  | 'active'
  | 'research-only'
  | 'rejected'
  | 'blocked-license'
  | 'blocked-security'
  | 'blocked-contract'
  | 'blocked-regression'
  | 'rolled-back'
  | 'superseded';

export type CodeAssimilationActor = 'agent' | 'system' | 'independent-verifier' | 'human';
export type CodeSourceKind = 'git' | 'archive' | 'package' | 'user-upload';

export interface CodeSourceArtifact {
  sourceKind: CodeSourceKind;
  canonicalUri: string;
  publisher: string;
  /** Immutable commit, release/archive revision, exact package version or upload digest. */
  immutableRevision: string;
  contentSha256: string;
  treeSha256: string;
  retrievedAt: number;
}

export interface CodeComponentManifest {
  componentId: string;
  componentVersion: string;
  capabilityId: string;
  interfaceVersion: string;
  language: string;
  runtime: string;
  source: CodeSourceArtifact;
  /** null means inventory has not yet been generated; it does not mean no dependencies. */
  dependencyLockFingerprint: string | null;
  /** null means an SBOM has not yet been generated; it does not mean an empty SBOM. */
  sbomFingerprint: string | null;
  /** Publisher declaration only; never treated as a legal approval. */
  declaredLicenseExpression: string | null;
}

export interface CodeAssimilationEvent {
  sequence: number;
  from: CodeAssimilationStage | null;
  to: CodeAssimilationStage;
  occurredAt: number;
  actor: CodeAssimilationActor;
  reason: string;
  evidenceFingerprint: string | null;
}

export interface CodeAssimilationCandidate {
  schemaVersion: 1;
  candidateId: string;
  baseRuntimeSha: string;
  sourceFingerprint: string;
  manifestFingerprint: string;
  candidateFingerprint: string;
  manifest: CodeComponentManifest;
  stage: CodeAssimilationStage;
  revision: number;
  createdAt: number;
  updatedAt: number;
  events: CodeAssimilationEvent[];
}

export interface CreateCodeAssimilationCandidateInput {
  baseRuntimeSha: string;
  manifest: CodeComponentManifest;
  createdAt: number;
}

export interface CodeAssimilationTransitionInput {
  to: CodeAssimilationStage;
  occurredAt: number;
  actor: CodeAssimilationActor;
  reason: string;
  evidenceFingerprint: string;
}

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const RUNTIME_SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const COMPONENT_ID = /^[a-z0-9][a-z0-9._/-]{1,127}$/;
const CAPABILITY_ID = /^[a-z][a-z0-9.-]{1,95}$/;
const ACTORS = new Set<CodeAssimilationActor>(['agent', 'system', 'independent-verifier', 'human']);
const SOURCE_KINDS = new Set<CodeSourceKind>(['git', 'archive', 'package', 'user-upload']);
const STAGES = new Set<CodeAssimilationStage>([
  'discovered', 'researched', 'quarantined', 'provenance-checked', 'analyzed',
  'adapted', 'built', 'tested', 'shadow', 'staged', 'approved', 'active',
  'research-only', 'rejected', 'blocked-license', 'blocked-security',
  'blocked-contract', 'blocked-regression', 'rolled-back', 'superseded',
]);

const ALLOWED_TRANSITIONS: Readonly<Record<CodeAssimilationStage, readonly CodeAssimilationStage[]>> = {
  discovered: ['researched', 'rejected'],
  researched: ['quarantined', 'research-only', 'rejected'],
  quarantined: ['provenance-checked', 'blocked-security', 'rejected'],
  'provenance-checked': ['analyzed', 'blocked-license', 'blocked-security', 'rejected'],
  analyzed: ['adapted', 'research-only', 'blocked-contract', 'rejected'],
  adapted: ['built', 'blocked-contract', 'rejected'],
  built: ['tested', 'blocked-security', 'blocked-contract', 'rejected'],
  tested: ['shadow', 'blocked-regression', 'blocked-security', 'rejected'],
  shadow: ['staged', 'blocked-regression', 'blocked-security', 'rejected'],
  staged: ['approved', 'blocked-regression', 'blocked-security', 'rejected'],
  approved: ['active', 'rejected'],
  active: ['rolled-back', 'superseded'],
  'research-only': [],
  rejected: [],
  'blocked-license': [],
  'blocked-security': [],
  'blocked-contract': [],
  'blocked-regression': [],
  'rolled-back': [],
  superseded: [],
};

const EVIDENCE_REQUIRED = new Set<CodeAssimilationStage>([
  'researched', 'quarantined', 'provenance-checked', 'analyzed', 'adapted',
  'built', 'tested', 'shadow', 'staged', 'approved', 'active',
  'research-only', 'rejected', 'blocked-license', 'blocked-security',
  'blocked-contract', 'blocked-regression', 'rolled-back', 'superseded',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (actual.length !== allowed.length || actual.some((key, index) => key !== allowed[index])) {
    throw new Error(`code-assimilation-${label}-shape-invalid`);
  }
}

function text(value: unknown, label: string, max = 512): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max ||
      value.trim() !== value || value.normalize('NFKC') !== value ||
      Array.from(value).some(character => {
        const code = character.codePointAt(0) ?? 0;
        return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
      })) {
    throw new Error(`code-assimilation-${label}-invalid`);
  }
  return value;
}

function nullableText(value: unknown, label: string, max = 256): string | null {
  return value === null ? null : text(value, label, max);
}

function finiteTime(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`code-assimilation-${label}-invalid`);
  }
  return value;
}

function digest(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new Error(`code-assimilation-${label}-fingerprint-invalid`);
  }
  return value;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeSource(raw: unknown): CodeSourceArtifact {
  if (!isRecord(raw)) throw new Error('code-assimilation-source-invalid');
  exactKeys(raw, [
    'sourceKind', 'canonicalUri', 'publisher', 'immutableRevision',
    'contentSha256', 'treeSha256', 'retrievedAt',
  ], 'source');
  const sourceKind = raw.sourceKind;
  if (typeof sourceKind !== 'string' || !SOURCE_KINDS.has(sourceKind as CodeSourceKind)) {
    throw new Error('code-assimilation-source-kind-invalid');
  }
  const canonicalUri = text(raw.canonicalUri, 'source-uri', 2048);
  if (sourceKind === 'user-upload') {
    if (!/^user-upload:\/\/sha256\/[a-f0-9]{64}$/.test(canonicalUri)) {
      throw new Error('code-assimilation-user-upload-uri-invalid');
    }
  } else {
    let parsed: URL;
    try { parsed = new URL(canonicalUri); }
    catch { throw new Error('code-assimilation-source-uri-invalid'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) {
      throw new Error('code-assimilation-source-uri-must-be-https-canonical');
    }
  }
  const immutableRevision = text(raw.immutableRevision, 'immutable-revision', 256);
  if (/^(?:main|master|latest|head|stable|develop)$/i.test(immutableRevision)) {
    throw new Error('code-assimilation-source-revision-must-be-immutable');
  }
  if (sourceKind === 'git' && !GIT_SHA.test(immutableRevision)) {
    throw new Error('code-assimilation-git-commit-sha-invalid');
  }
  if (sourceKind === 'package' && !SEMVER.test(immutableRevision)) {
    throw new Error('code-assimilation-package-version-must-be-exact');
  }
  return {
    sourceKind: sourceKind as CodeSourceKind,
    canonicalUri,
    publisher: text(raw.publisher, 'publisher', 256),
    immutableRevision,
    contentSha256: digest(raw.contentSha256, 'source-content'),
    treeSha256: digest(raw.treeSha256, 'source-tree'),
    retrievedAt: finiteTime(raw.retrievedAt, 'source-retrieved-at'),
  };
}

function normalizeManifest(raw: unknown): CodeComponentManifest {
  if (!isRecord(raw)) throw new Error('code-assimilation-manifest-invalid');
  exactKeys(raw, [
    'componentId', 'componentVersion', 'capabilityId', 'interfaceVersion',
    'language', 'runtime', 'source', 'dependencyLockFingerprint',
    'sbomFingerprint', 'declaredLicenseExpression',
  ], 'manifest');
  const componentId = text(raw.componentId, 'component-id', 128);
  if (!COMPONENT_ID.test(componentId)) throw new Error('code-assimilation-component-id-invalid');
  const componentVersion = text(raw.componentVersion, 'component-version', 128);
  if (!SEMVER.test(componentVersion)) throw new Error('code-assimilation-component-version-invalid');
  const capabilityId = text(raw.capabilityId, 'capability-id', 96);
  if (!CAPABILITY_ID.test(capabilityId)) throw new Error('code-assimilation-capability-id-invalid');
  const interfaceVersion = text(raw.interfaceVersion, 'interface-version', 128);
  if (!SEMVER.test(interfaceVersion)) throw new Error('code-assimilation-interface-version-invalid');
  const dependencyLockFingerprint = raw.dependencyLockFingerprint === null
    ? null : digest(raw.dependencyLockFingerprint, 'dependency-lock');
  const sbomFingerprint = raw.sbomFingerprint === null
    ? null : digest(raw.sbomFingerprint, 'sbom');
  return {
    componentId,
    componentVersion,
    capabilityId,
    interfaceVersion,
    language: text(raw.language, 'language', 64),
    runtime: text(raw.runtime, 'runtime', 128),
    source: normalizeSource(raw.source),
    dependencyLockFingerprint,
    sbomFingerprint,
    declaredLicenseExpression: nullableText(raw.declaredLicenseExpression, 'declared-license', 256),
  };
}

function candidateFingerprints(baseRuntimeSha: string, manifest: CodeComponentManifest): {
  sourceFingerprint: string;
  manifestFingerprint: string;
  candidateFingerprint: string;
  candidateId: string;
} {
  const sourceFingerprint = sha256(canonicalJson(manifest.source));
  const manifestFingerprint = sha256(canonicalJson(manifest));
  const candidateFingerprint = sha256(canonicalJson({ baseRuntimeSha, manifestFingerprint }));
  return {
    sourceFingerprint,
    manifestFingerprint,
    candidateFingerprint,
    candidateId: `codeassim:${candidateFingerprint.slice(0, 40)}`,
  };
}

function normalizeActor(value: unknown): CodeAssimilationActor {
  if (typeof value !== 'string' || !ACTORS.has(value as CodeAssimilationActor)) {
    throw new Error('code-assimilation-actor-invalid');
  }
  return value as CodeAssimilationActor;
}

function normalizeStage(value: unknown): CodeAssimilationStage {
  if (typeof value !== 'string' || !STAGES.has(value as CodeAssimilationStage)) {
    throw new Error('code-assimilation-stage-invalid');
  }
  return value as CodeAssimilationStage;
}

function normalizeEvent(raw: unknown, expectedSequence: number): CodeAssimilationEvent {
  if (!isRecord(raw)) throw new Error('code-assimilation-event-invalid');
  exactKeys(raw, ['sequence', 'from', 'to', 'occurredAt', 'actor', 'reason', 'evidenceFingerprint'], 'event');
  if (!Number.isSafeInteger(raw.sequence) || raw.sequence !== expectedSequence) {
    throw new Error('code-assimilation-event-sequence-invalid');
  }
  const from = raw.from === null ? null : normalizeStage(raw.from);
  const to = normalizeStage(raw.to);
  const actor = normalizeActor(raw.actor);
  const reason = text(raw.reason, 'event-reason', 512);
  const occurredAt = finiteTime(raw.occurredAt, 'event-time');
  const evidenceFingerprint = raw.evidenceFingerprint === null
    ? null : digest(raw.evidenceFingerprint, 'event-evidence');
  if (expectedSequence === 0) {
    if (from !== null || to !== 'discovered' || actor !== 'agent' ||
        reason !== 'source-intake' || evidenceFingerprint !== null) {
      throw new Error('code-assimilation-initial-event-invalid');
    }
  } else {
    if (from === null || !canTransitionCodeAssimilationStage(from, to)) {
      throw new Error('code-assimilation-event-transition-invalid');
    }
    if (EVIDENCE_REQUIRED.has(to) && evidenceFingerprint === null) {
      throw new Error('code-assimilation-event-evidence-required');
    }
    assertActorForTransition(to, actor);
  }
  return { sequence: expectedSequence, from, to, occurredAt, actor, reason, evidenceFingerprint };
}

function assertActorForTransition(to: CodeAssimilationStage, actor: CodeAssimilationActor): void {
  if (to === 'quarantined' && actor !== 'system') {
    throw new Error('code-assimilation-quarantine-requires-system-actor');
  }
  if (['provenance-checked', 'built', 'tested', 'shadow'].includes(to) && actor !== 'independent-verifier') {
    throw new Error('code-assimilation-stage-requires-independent-verifier');
  }
  if (['approved', 'active'].includes(to) && actor !== 'human') {
    throw new Error('code-assimilation-stage-requires-human-actor');
  }
  if (to === 'staged' && actor !== 'system') {
    throw new Error('code-assimilation-staging-requires-system-actor');
  }
}

function validateCandidate(raw: unknown): CodeAssimilationCandidate {
  const detached = snapshotPlainData<unknown>(raw, { maxDepth: 16, maxNodes: 20_000, maxStringUnits: 1_000_000 });
  if (!isRecord(detached)) throw new Error('code-assimilation-candidate-invalid');
  exactKeys(detached, [
    'schemaVersion', 'candidateId', 'baseRuntimeSha', 'sourceFingerprint',
    'manifestFingerprint', 'candidateFingerprint', 'manifest', 'stage',
    'revision', 'createdAt', 'updatedAt', 'events',
  ], 'candidate');
  if (detached.schemaVersion !== 1) throw new Error('code-assimilation-schema-version-unsupported');
  const baseRuntimeSha = text(detached.baseRuntimeSha, 'base-runtime-sha', 64);
  if (!RUNTIME_SHA.test(baseRuntimeSha)) throw new Error('code-assimilation-base-runtime-sha-invalid');
  const manifest = normalizeManifest(detached.manifest);
  const fingerprints = candidateFingerprints(baseRuntimeSha, manifest);
  for (const key of ['candidateId', 'sourceFingerprint', 'manifestFingerprint', 'candidateFingerprint'] as const) {
    if (detached[key] !== fingerprints[key]) throw new Error(`code-assimilation-${key}-mismatch`);
  }
  if (!Array.isArray(detached.events) || detached.events.length < 1 || detached.events.length > 128) {
    throw new Error('code-assimilation-event-history-invalid');
  }
  const events = detached.events.map((event, index) => normalizeEvent(event, index));
  for (let i = 1; i < events.length; i++) {
    if (events[i]!.from !== events[i - 1]!.to || events[i]!.occurredAt < events[i - 1]!.occurredAt) {
      throw new Error('code-assimilation-event-history-discontinuous');
    }
  }
  const stage = normalizeStage(detached.stage);
  const revision = detached.revision;
  if (!Number.isSafeInteger(revision) || revision !== events.length - 1 ||
      stage !== events[events.length - 1]!.to) {
    throw new Error('code-assimilation-candidate-revision-invalid');
  }
  const createdAt = finiteTime(detached.createdAt, 'created-at');
  const updatedAt = finiteTime(detached.updatedAt, 'updated-at');
  if (createdAt !== events[0]!.occurredAt || updatedAt !== events[events.length - 1]!.occurredAt ||
      updatedAt < createdAt) {
    throw new Error('code-assimilation-candidate-time-invalid');
  }
  return {
    schemaVersion: 1,
    candidateId: fingerprints.candidateId,
    baseRuntimeSha,
    sourceFingerprint: fingerprints.sourceFingerprint,
    manifestFingerprint: fingerprints.manifestFingerprint,
    candidateFingerprint: fingerprints.candidateFingerprint,
    manifest,
    stage,
    revision,
    createdAt,
    updatedAt,
    events,
  };
}

/** Canonical permission graph for the v1 intake lifecycle; no transition executes code. */
export function canTransitionCodeAssimilationStage(
  from: CodeAssimilationStage,
  to: CodeAssimilationStage,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Create an immutable source-bound candidate in the discovered state.
 * A candidate is metadata only; its creation grants no build, execution or runtime authority.
 */
export function createCodeAssimilationCandidate(raw: CreateCodeAssimilationCandidateInput): CodeAssimilationCandidate {
  const detached = snapshotPlainData<unknown>(raw, { maxDepth: 12, maxNodes: 4_096, maxStringUnits: 256_000 });
  if (!isRecord(detached)) throw new Error('code-assimilation-create-input-invalid');
  exactKeys(detached, ['baseRuntimeSha', 'manifest', 'createdAt'], 'create-input');
  const baseRuntimeSha = text(detached.baseRuntimeSha, 'base-runtime-sha', 64);
  if (!RUNTIME_SHA.test(baseRuntimeSha)) throw new Error('code-assimilation-base-runtime-sha-invalid');
  const manifest = normalizeManifest(detached.manifest);
  const createdAt = finiteTime(detached.createdAt, 'created-at');
  const fingerprints = candidateFingerprints(baseRuntimeSha, manifest);
  return {
    schemaVersion: 1,
    candidateId: fingerprints.candidateId,
    baseRuntimeSha,
    sourceFingerprint: fingerprints.sourceFingerprint,
    manifestFingerprint: fingerprints.manifestFingerprint,
    candidateFingerprint: fingerprints.candidateFingerprint,
    manifest,
    stage: 'discovered',
    revision: 0,
    createdAt,
    updatedAt: createdAt,
    events: [{
      sequence: 0,
      from: null,
      to: 'discovered',
      occurredAt: createdAt,
      actor: 'agent',
      reason: 'source-intake',
      evidenceFingerprint: null,
    }],
  };
}

/**
 * Append one evidence-linked lifecycle event. This validates the event graph but
 * deliberately does not authenticate actor identity or verify evidence signatures.
 * A trusted host authority must do both before it calls this function.
 */
export function transitionCodeAssimilationCandidate(
  rawCandidate: unknown,
  rawTransition: CodeAssimilationTransitionInput,
): CodeAssimilationCandidate {
  const candidate = validateCandidate(rawCandidate);
  const detached = snapshotPlainData<unknown>(rawTransition, { maxDepth: 4, maxNodes: 64, maxStringUnits: 4_096 });
  if (!isRecord(detached)) throw new Error('code-assimilation-transition-input-invalid');
  exactKeys(detached, ['to', 'occurredAt', 'actor', 'reason', 'evidenceFingerprint'], 'transition-input');
  const to = normalizeStage(detached.to);
  const actor = normalizeActor(detached.actor);
  const occurredAt = finiteTime(detached.occurredAt, 'transition-time');
  const reason = text(detached.reason, 'transition-reason', 512);
  const evidenceFingerprint = digest(detached.evidenceFingerprint, 'transition-evidence');
  if (!canTransitionCodeAssimilationStage(candidate.stage, to)) {
    throw new Error('code-assimilation-transition-not-allowed');
  }
  if (occurredAt < candidate.updatedAt) throw new Error('code-assimilation-transition-time-regression');
  assertActorForTransition(to, actor);
  if (candidate.events.length >= 128) throw new Error('code-assimilation-event-history-limit');
  const event: CodeAssimilationEvent = {
    sequence: candidate.events.length,
    from: candidate.stage,
    to,
    occurredAt,
    actor,
    reason,
    evidenceFingerprint,
  };
  return {
    ...candidate,
    stage: to,
    revision: candidate.revision + 1,
    updatedAt: occurredAt,
    events: [...candidate.events, event],
  };
}

/** Validate and detach a persisted candidate before it is admitted to a trusted owner. */
export function normalizeCodeAssimilationCandidate(raw: unknown): CodeAssimilationCandidate {
  return validateCandidate(raw);
}
