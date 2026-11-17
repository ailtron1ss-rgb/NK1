import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';

export type SynapticSkillKind = 'procedure' | 'adapter' | 'abstraction';
export type SynapticCommonsStatus = 'quarantined' | 'compatible' | 'attested' | 'rejected' | 'revoked';

export interface SynapticCommonsArtifact {
  schemaVersion: 1;
  skill: {
    skillId: string;
    name: string;
    version: string;
    summary: string;
    kind: SynapticSkillKind;
  };
  contract: {
    capability: string;
    requiredCapabilities: string[];
    requiredTools: string[];
    permissionClass: 'read-only' | 'assisted' | 'destructive';
    allowedModes: ['assisted'];
    minimumRuntimeVersion: string;
    environmentFingerprint?: string;
  };
  definition: {
    format: 'declarative-json-v1';
    payload: Record<string, unknown>;
  };
  provenance: {
    sourceInstanceId: string;
    sourceRuntimeVersion: string;
    sourceCommit?: string;
    sourceArtifactFingerprint: string;
    createdAt: number;
  };
  license: {
    identifier: string;
    redistributionAllowed: true;
    reviewFingerprint: string;
  };
  signature: {
    keyId: string;
    algorithm: 'Ed25519';
    value: string;
  };
}

export interface SynapticCommonsAttestation {
  schemaVersion: 1;
  artifactFingerprint: string;
  attestorId: string;
  runtimeVersion: string;
  environmentFingerprint: string;
  testSuiteFingerprint: string;
  holdoutFingerprint: string;
  independentSeedCount: number;
  holdoutSamples: number;
  baselinePasses: number;
  candidatePasses: number;
  issuedAt: number;
  expiresAt: number;
  signature: {
    algorithm: 'Ed25519';
    value: string;
  };
}

export interface SynapticCompatibilityTarget {
  runtimeVersion: string;
  environmentFingerprint: string;
  supportedCapabilities: string[];
  permittedTools: string[];
  now?: number;
}

export interface SynapticCompatibilityResult {
  compatible: boolean;
  checkedAt: number;
  runtimeVersion: string;
  environmentFingerprint: string;
  reasons: string[];
}

export interface SynapticCommonsRecord {
  artifactFingerprint: string;
  artifact: SynapticCommonsArtifact;
  status: SynapticCommonsStatus;
  importedAt: number;
  updatedAt: number;
  compatibility: SynapticCompatibilityResult | null;
  attestation: SynapticCommonsAttestation | null;
  rejectionReason: string | null;
  /** Terminal revocation metadata; signed artifact and receipt remain available for audit. */
  revocationReason: string | null;
  revokedAt: number | null;
}

export interface SynapticCommonsState {
  schemaVersion: 1;
  revision: number;
  records: SynapticCommonsRecord[];
}

export interface SynapticCommonsConfig {
  trustedPublisherKeys?: ReadonlyMap<string, string>;
  trustedAttestorKeys?: ReadonlyMap<string, string>;
  /** Exact licence-review fingerprints approved by the receiving host, not publisher self-assertions. */
  trustedLicenseReviewFingerprints?: ReadonlySet<string>;
  now?: () => number;
}

export interface SynapticP23AdmissionBundle {
  schemaVersion: 1;
  artifactFingerprint: string;
  artifact: SynapticCommonsArtifact;
  attestation: SynapticCommonsAttestation;
  compatibility: SynapticCompatibilityResult;
}

const authenticP23AdmissionBundles = new WeakMap<object, string>();

function admissionBundleDigest(value: SynapticP23AdmissionBundle): string {
  return createHash('sha256').update(synapticCanonicalJson(value)).digest('hex');
}

/** True only for an exact, unmodified bundle minted by a live SynapticCommons instance. */
export function isAuthenticSynapticP23AdmissionBundle(value: unknown): value is SynapticP23AdmissionBundle {
  if (!value || typeof value !== 'object') return false;
  const expected = authenticP23AdmissionBundles.get(value as object);
  if (!expected) return false;
  try { return admissionBundleDigest(value as SynapticP23AdmissionBundle) === expected; }
  catch { return false; }
}

const MAX_RECORDS = 256;
const MAX_ARTIFACT_BYTES = 48 * 1024;
const MAX_DEFINITION_DEPTH = 8;
const MAX_DEFINITION_NODES = 2048;
const HEX_64 = /^[a-f0-9]{64}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{1,95}$/;
const FORBIDDEN_KEY = /(user|dialogue|conversation|transcript|autobiograph|identity|email|phone|address|credential|secret|token|password|apikey|privatekey|sessioncookie|rawmemory|episodicmemory)/i;
const EXECUTABLE_KEY = /^(code|sourcecode|script|javascript|typescript|wasm|bytecode|shell|command|eval|exec|executable)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function own(value: unknown, key: string): unknown {
  if (!isRecord(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ? descriptor.value : undefined;
}

function assertExactKeys(value: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) throw new Error(label + '-unknown-field');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value'))
      throw new Error(label + '-accessor-field-rejected');
  }
}

function cloneSafeJson(value: unknown, depth = 0, budget = { nodes: 0 }): unknown {
  budget.nodes += 1;
  if (budget.nodes > MAX_DEFINITION_NODES) throw new Error('synaptic-artifact-node-limit-exceeded');
  if (depth > MAX_DEFINITION_DEPTH) throw new Error('synaptic-artifact-depth-limit-exceeded');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('synaptic-artifact-non-finite-number');
    return value;
  }
  if (typeof value === 'string') {
    if (value.length > 4096) throw new Error('synaptic-artifact-string-limit-exceeded');
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value) ||
        /\b(?:sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/.test(value) ||
        /\bBearer\s+[A-Za-z0-9._~-]{20,}\b/i.test(value))
      throw new Error('synaptic-artifact-sensitive-value-rejected');
    return value;
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) throw new Error('synaptic-artifact-array-prototype-rejected');
    if (value.length > 256) throw new Error('synaptic-artifact-array-limit-exceeded');
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1) throw new Error('synaptic-artifact-array-shape-invalid');
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || !descriptor.enumerable)
        throw new Error('synaptic-artifact-array-accessor-rejected');
      result.push(cloneSafeJson(descriptor.value, depth + 1, budget));
    }
    return result;
  }
  if (!isRecord(value)) throw new Error('synaptic-artifact-value-not-json');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error('synaptic-artifact-prototype-rejected');
  const keys = Reflect.ownKeys(value);
  if (keys.length > 256) throw new Error('synaptic-artifact-object-limit-exceeded');
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    if (typeof key !== 'string') throw new Error('synaptic-artifact-symbol-key-rejected');
    if (FORBIDDEN_KEY.test(key)) throw new Error('synaptic-artifact-private-field-rejected');
    if (EXECUTABLE_KEY.test(key)) throw new Error('synaptic-artifact-executable-field-rejected');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || !descriptor.enumerable)
      throw new Error('synaptic-artifact-accessor-field-rejected');
    result[key] = cloneSafeJson(descriptor.value, depth + 1, budget);
  }
  return result;
}

export function synapticCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(synapticCanonicalJson).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort().map(key =>
    JSON.stringify(key) + ':' + synapticCanonicalJson(object[key])).join(',') + '}';
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function artifactContent(artifact: SynapticCommonsArtifact): Record<string, unknown> {
  const { signature: _signature, ...unsigned } = artifact;
  return unsigned as unknown as Record<string, unknown>;
}

export function synapticArtifactFingerprint(artifact: SynapticCommonsArtifact): string {
  return sha256(synapticCanonicalJson(artifactContent(artifact)));
}

export function synapticArtifactSigningPayload(artifact: SynapticCommonsArtifact): string {
  return synapticArtifactFingerprint(artifact);
}

function attestationContent(attestation: SynapticCommonsAttestation): Record<string, unknown> {
  const { signature: _signature, ...unsigned } = attestation;
  return unsigned as unknown as Record<string, unknown>;
}

export function synapticAttestationSigningPayload(attestation: SynapticCommonsAttestation): string {
  return sha256(synapticCanonicalJson(attestationContent(attestation)));
}

function verifyEd25519(payload: string, signature: string, publicKey: string): boolean {
  try {
    if (typeof signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return false;
    const bytes = Buffer.from(signature, 'base64');
    if (bytes.length !== 64 || bytes.toString('base64') !== signature) return false;
    return verifySignature(null, Buffer.from(payload, 'utf8'), publicKey, bytes);
  } catch {
    return false;
  }
}

type ParsedSemVer = [number, number, number, string[] | null];

function parseVersion(value: string): ParsedSemVer | null {
  const match = SEMVER.exec(value);
  if (!match) return null;
  const core = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (core.some(part => !Number.isSafeInteger(part))) return null;
  const prerelease = match[4] ? match[4].split('.') : null;
  if (prerelease?.some(part => !part || (/^\d+$/.test(part) && part.length > 1 && part.startsWith('0')))) return null;
  return [core[0], core[1], core[2], prerelease];
}

function versionAtLeast(actual: string, minimum: string): boolean {
  const actualVersion = parseVersion(actual);
  const minimumVersion = parseVersion(minimum);
  if (actualVersion === null || minimumVersion === null) return false;
  const [actualMajor, actualMinor, actualPatch, actualPrerelease] = actualVersion;
  const [minimumMajor, minimumMinor, minimumPatch, minimumPrerelease] = minimumVersion;
  if (actualMajor !== minimumMajor) return actualMajor > minimumMajor;
  if (actualMinor !== minimumMinor) return actualMinor > minimumMinor;
  if (actualPatch !== minimumPatch) return actualPatch > minimumPatch;
  if (actualPrerelease === null && minimumPrerelease !== null) return true;
  if (actualPrerelease !== null && minimumPrerelease === null) return false;
  if (actualPrerelease === null && minimumPrerelease === null) return true;
  const actualIds = actualPrerelease ?? [];
  const minimumIds = minimumPrerelease ?? [];
  for (let i = 0; i < Math.max(actualIds.length, minimumIds.length); i += 1) {
    if (i >= actualIds.length) return false;
    if (i >= minimumIds.length) return true;
    const av = actualIds[i], bv = minimumIds[i];
    if (av === bv) continue;
    const an = /^\d+$/.test(av), bn = /^\d+$/.test(bv);
    if (an && bn) return av.length === bv.length ? av > bv : av.length > bv.length;
    if (an !== bn) return !an;
    return av > bv;
  }
  return true;
}

/**
 * Builds a canonical publisher package while keeping private-key custody outside the runtime.
 * The callback receives only the content fingerprint and returns an Ed25519 base64 signature.
 */
export function createSignedSynapticArtifact(
  unsignedArtifact: Omit<SynapticCommonsArtifact, 'signature'>,
  keyId: string,
  signFingerprint: (fingerprint: string) => string,
): SynapticCommonsArtifact {
  if (!isRecord(unsignedArtifact) || Object.prototype.hasOwnProperty.call(unsignedArtifact, 'signature'))
    throw new TypeError('synaptic-publisher-input-must-be-unsigned-artifact');
  if (typeof signFingerprint !== 'function') throw new TypeError('synaptic-publisher-signer-required');
  if (typeof keyId !== 'string' || !SAFE_ID.test(keyId))
    throw new TypeError('synaptic-publisher-key-id-invalid');
  const placeholder = 'A'.repeat(86) + '==';
  const safeUnsignedArtifact = cloneSafeJson(unsignedArtifact) as Record<string, unknown>;
  const draft = normalizeArtifact({
    ...safeUnsignedArtifact,
    signature: { keyId, algorithm: 'Ed25519', value: placeholder },
  });
  const fingerprint = synapticArtifactFingerprint(draft);
  const signature = signFingerprint(fingerprint);
  if (typeof signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature))
    throw new Error('synaptic-publisher-signature-format-invalid');
  const signatureBytes = Buffer.from(signature, 'base64');
  if (signatureBytes.length !== 64 || signatureBytes.toString('base64') !== signature)
    throw new Error('synaptic-publisher-signature-format-invalid');
  const signed = normalizeArtifact({
    ...draft,
    signature: { keyId, algorithm: 'Ed25519', value: signature },
  });
  if (synapticArtifactFingerprint(signed) !== fingerprint)
    throw new Error('synaptic-publisher-fingerprint-changed-after-signing');
  return signed;
}

function normalizeArtifact(raw: unknown): SynapticCommonsArtifact {
  if (!isRecord(raw)) throw new TypeError('synaptic-artifact-must-be-object');
  const copied = cloneSafeJson(raw) as Record<string, unknown>;
  assertExactKeys(copied, ['schemaVersion', 'skill', 'contract', 'definition', 'provenance', 'license', 'signature'], 'synaptic-artifact');
  if (copied.schemaVersion !== 1) throw new Error('synaptic-artifact-schema-unsupported');

  const skill = copied.skill as Record<string, unknown>;
  const contract = copied.contract as Record<string, unknown>;
  const definition = copied.definition as Record<string, unknown>;
  const provenance = copied.provenance as Record<string, unknown>;
  const license = copied.license as Record<string, unknown>;
  const signature = copied.signature as Record<string, unknown>;
  for (const [label, value] of [['skill', skill], ['contract', contract], ['definition', definition],
    ['provenance', provenance], ['license', license], ['signature', signature]] as const) {
    if (!isRecord(value)) throw new Error('synaptic-artifact-' + label + '-invalid');
  }
  assertExactKeys(skill, ['skillId', 'name', 'version', 'summary', 'kind'], 'synaptic-skill');
  assertExactKeys(contract, ['capability', 'requiredCapabilities', 'requiredTools', 'permissionClass', 'allowedModes', 'minimumRuntimeVersion', 'environmentFingerprint'], 'synaptic-contract');
  assertExactKeys(definition, ['format', 'payload'], 'synaptic-definition');
  assertExactKeys(provenance, ['sourceInstanceId', 'sourceRuntimeVersion', 'sourceCommit', 'sourceArtifactFingerprint', 'createdAt'], 'synaptic-provenance');
  assertExactKeys(license, ['identifier', 'redistributionAllowed', 'reviewFingerprint'], 'synaptic-license');
  assertExactKeys(signature, ['keyId', 'algorithm', 'value'], 'synaptic-signature');

  const text = (value: unknown, max: number, label: string): string => {
    if (typeof value !== 'string') throw new Error(label + '-field-invalid');
    if (value.length > max) throw new Error(label + '-field-too-long');
    const normalized = value.trim();
    if (!normalized) throw new Error(label + '-field-empty');
    if (normalized !== value) throw new Error(label + '-field-whitespace-invalid');
    return normalized;
  };
  const skillId = text(skill.skillId, 96, 'skill-id');
  const name = text(skill.name, 120, 'skill-name');
  const version = text(skill.version, 32, 'skill-version');
  const summary = text(skill.summary, 1000, 'skill-summary');
  const kind = skill.kind;
  if (!SAFE_ID.test(skillId) || !name || !version || !SEMVER.test(version) || !summary ||
      !['procedure', 'adapter', 'abstraction'].includes(String(kind)))
    throw new Error('synaptic-skill-descriptor-invalid');

  const capability = text(contract.capability, 96, 'contract-capability');
  const requiredCapabilities = contract.requiredCapabilities;
  const requiredTools = contract.requiredTools;
  const allowedModes = contract.allowedModes;
  const minimumRuntimeVersion = text(contract.minimumRuntimeVersion, 32, 'contract-minimum-runtime-version');
  if (!SAFE_ID.test(capability) || !Array.isArray(requiredCapabilities) || requiredCapabilities.length > 24 ||
      !Array.isArray(requiredTools) || requiredTools.length > 24 ||
      !Array.isArray(allowedModes) || allowedModes.length !== 1 || allowedModes[0] !== 'assisted' ||
      !parseVersion(minimumRuntimeVersion) ||
      !['read-only', 'assisted', 'destructive'].includes(String(contract.permissionClass)))
    throw new Error('synaptic-contract-invalid');
  const cleanCapabilities = requiredCapabilities.map(value => text(value, 96, 'contract-requirement'));
  const cleanTools = requiredTools.map(value => text(value, 96, 'contract-requirement'));
  if ([...cleanCapabilities, ...cleanTools].some(value => !SAFE_ID.test(value)) ||
      new Set(cleanCapabilities).size !== cleanCapabilities.length || new Set(cleanTools).size !== cleanTools.length)
    throw new Error('synaptic-contract-requirement-invalid');
  const environmentFingerprint = contract.environmentFingerprint == null ? undefined : text(contract.environmentFingerprint, 64, 'contract-environment-fingerprint');
  if (environmentFingerprint !== undefined && !HEX_64.test(environmentFingerprint))
    throw new Error('synaptic-contract-environment-fingerprint-invalid');

  if (definition.format !== 'declarative-json-v1' || !isRecord(definition.payload))
    throw new Error('synaptic-definition-format-invalid');
  const sourceInstanceId = text(provenance.sourceInstanceId, 128, 'provenance-instance-id');
  const sourceRuntimeVersion = text(provenance.sourceRuntimeVersion, 64, 'provenance-runtime-version');
  const sourceArtifactFingerprint = text(provenance.sourceArtifactFingerprint, 64, 'provenance-artifact-fingerprint');
  const createdAt = provenance.createdAt;
  if (!SAFE_ID.test(sourceInstanceId) || !sourceRuntimeVersion || !HEX_64.test(sourceArtifactFingerprint) ||
      typeof createdAt !== 'number' || !Number.isSafeInteger(createdAt) || createdAt <= 0)
    throw new Error('synaptic-provenance-invalid');
  const sourceCommit = provenance.sourceCommit == null ? undefined : text(provenance.sourceCommit, 64, 'provenance-source-commit');
  if (sourceCommit !== undefined && !/^[a-f0-9]{40,64}$/.test(sourceCommit))
    throw new Error('synaptic-provenance-commit-invalid');

  const identifier = text(license.identifier, 96, 'license-identifier');
  const reviewFingerprint = text(license.reviewFingerprint, 64, 'license-review-fingerprint');
  if (!/^(?:[A-Za-z0-9][A-Za-z0-9.-]{0,80}|LicenseRef-[A-Za-z0-9.-]{1,72})$/.test(identifier) ||
      identifier === 'NOASSERTION' || identifier === 'UNLICENSED' ||
      license.redistributionAllowed !== true || !HEX_64.test(reviewFingerprint))
    throw new Error('synaptic-license-not-cleared');

  const keyId = text(signature.keyId, 128, 'signature-key-id');
  const value = text(signature.value, 512, 'signature-value');
  if (!SAFE_ID.test(keyId) || signature.algorithm !== 'Ed25519' || !value)
    throw new Error('synaptic-signature-invalid');

  const normalized: SynapticCommonsArtifact = {
    schemaVersion: 1,
    skill: { skillId, name, version, summary, kind: kind as SynapticSkillKind },
    contract: {
      capability,
      requiredCapabilities: cleanCapabilities,
      requiredTools: cleanTools,
      permissionClass: contract.permissionClass as 'read-only' | 'assisted' | 'destructive',
      allowedModes: ['assisted'],
      minimumRuntimeVersion,
      ...(environmentFingerprint ? { environmentFingerprint } : {}),
    },
    definition: { format: 'declarative-json-v1', payload: definition.payload as Record<string, unknown> },
    provenance: {
      sourceInstanceId,
      sourceRuntimeVersion,
      sourceArtifactFingerprint,
      createdAt,
      ...(sourceCommit ? { sourceCommit } : {}),
    },
    license: { identifier, redistributionAllowed: true, reviewFingerprint },
    signature: { keyId, algorithm: 'Ed25519', value },
  };
  const encoded = Buffer.byteLength(synapticCanonicalJson(artifactContent(normalized)), 'utf8');
  if (encoded > MAX_ARTIFACT_BYTES) throw new Error('synaptic-artifact-size-limit-exceeded');
  return normalized;
}

function normalizeAttestation(raw: unknown): SynapticCommonsAttestation {
  if (!isRecord(raw)) throw new TypeError('synaptic-attestation-must-be-object');
  const copied = cloneSafeJson(raw) as Record<string, unknown>;
  assertExactKeys(copied, ['schemaVersion', 'artifactFingerprint', 'attestorId', 'runtimeVersion',
    'environmentFingerprint', 'testSuiteFingerprint', 'holdoutFingerprint', 'independentSeedCount',
    'holdoutSamples', 'baselinePasses', 'candidatePasses', 'issuedAt', 'expiresAt', 'signature'], 'synaptic-attestation');
  const signature = copied.signature;
  if (!isRecord(signature)) throw new Error('synaptic-attestation-signature-invalid');
  assertExactKeys(signature, ['algorithm', 'value'], 'synaptic-attestation-signature');
  const attestation = copied as unknown as SynapticCommonsAttestation;
  if (attestation.schemaVersion !== 1 || !HEX_64.test(attestation.artifactFingerprint) ||
      !SAFE_ID.test(attestation.attestorId) || !parseVersion(attestation.runtimeVersion) ||
      !HEX_64.test(attestation.environmentFingerprint) || !HEX_64.test(attestation.testSuiteFingerprint) ||
      !HEX_64.test(attestation.holdoutFingerprint) || attestation.independentSeedCount < 5 || attestation.independentSeedCount > 10000 ||
      !Number.isSafeInteger(attestation.independentSeedCount) ||
      !Number.isSafeInteger(attestation.holdoutSamples) || attestation.holdoutSamples < 5 || attestation.holdoutSamples > 10000 ||
      !Number.isSafeInteger(attestation.baselinePasses) || attestation.baselinePasses < 0 ||
      !Number.isSafeInteger(attestation.candidatePasses) || attestation.candidatePasses < 0 ||
      attestation.baselinePasses > attestation.holdoutSamples ||
      attestation.candidatePasses > attestation.holdoutSamples ||
      attestation.candidatePasses <= attestation.baselinePasses ||
      attestation.candidatePasses / attestation.holdoutSamples < 0.8 ||
      !Number.isSafeInteger(attestation.issuedAt) || !Number.isSafeInteger(attestation.expiresAt) ||
      attestation.issuedAt <= 0 || attestation.expiresAt <= attestation.issuedAt ||
      attestation.expiresAt - attestation.issuedAt > 30 * 24 * 60 * 60_000 ||
      signature.algorithm !== 'Ed25519' || typeof signature.value !== 'string' || !signature.value)
    throw new Error('synaptic-attestation-evidence-invalid');
  return attestation;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function defaultSynapticCommonsState(): SynapticCommonsState {
  return { schemaVersion: 1, revision: 0, records: [] };
}

/**
 * Synaptic Commons is a distribution and evidence registry, not an executor.
 * Every imported package begins quarantined. Even attested packages require the
 * canonical local P23/ActionGateway admission path before they can affect behavior.
 */
export class SynapticCommons {
  private state: SynapticCommonsState = defaultSynapticCommonsState();
  private readonly publisherKeys: ReadonlyMap<string, string>;
  private readonly attestorKeys: ReadonlyMap<string, string>;
  private readonly licenseReviewAllowlist: ReadonlySet<string>;
  private readonly now: () => number;

  constructor(config: SynapticCommonsConfig = {}) {
    this.publisherKeys = new Map(config.trustedPublisherKeys ?? []);
    this.attestorKeys = new Map(config.trustedAttestorKeys ?? []);
    this.licenseReviewAllowlist = new Set(config.trustedLicenseReviewFingerprints ?? []);
    this.now = config.now ?? Date.now;
  }

  restore(value: unknown): void {
    if (value === undefined || value === null) {
      this.state = defaultSynapticCommonsState();
      return;
    }
    const copiedState = cloneSafeJson(value) as Record<string, unknown>;
    const revision = own(copiedState, 'revision');
    if (!isRecord(copiedState) || own(copiedState, 'schemaVersion') !== 1 ||
        typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 ||
        !Array.isArray(own(copiedState, 'records')))
      throw new Error('synaptic-commons-state-invalid');
    const records = own(copiedState, 'records') as unknown[];
    if (records.length > MAX_RECORDS) throw new Error('synaptic-commons-state-capacity-exceeded');
    const normalized: SynapticCommonsRecord[] = [];
    const fingerprints = new Set<string>();
    const slots = new Set<string>();
    for (const raw of records) {
      if (!isRecord(raw)) throw new Error('synaptic-commons-record-invalid');
      const artifact = normalizeArtifact(own(raw, 'artifact'));
      const fingerprint = synapticArtifactFingerprint(artifact);
      if (own(raw, 'artifactFingerprint') !== fingerprint || fingerprints.has(fingerprint))
        throw new Error('synaptic-commons-record-fingerprint-invalid');
      const status = own(raw, 'status');
      if (!['quarantined', 'compatible', 'attested', 'rejected', 'revoked'].includes(String(status)))
        throw new Error('synaptic-commons-status-invalid');
      const terminalTombstone = status === 'rejected' || status === 'revoked';
      // Terminal records can only deny further use. Keep them auditable across publisher,
      // attestor and licence-key rotation without making runtime startup depend on retired roots.
      if (!terminalTombstone) {
        this.assertLicenseReviewTrusted(artifact);
        const publisherKey = this.publisherKeys.get(artifact.signature.keyId);
        if (!publisherKey || !verifyEd25519(fingerprint, artifact.signature.value, publisherKey))
          throw new Error('synaptic-commons-publisher-signature-invalid');
      }
      const slot = artifact.skill.skillId + '@' + artifact.skill.version;
      if (slots.has(slot)) throw new Error('synaptic-commons-version-conflict');
      const compatibilityRaw = own(raw, 'compatibility');
      const compatibility = compatibilityRaw == null ? null : this.normalizeCompatibility(compatibilityRaw);
      const attestationRaw = own(raw, 'attestation');
      const attestation = attestationRaw == null ? null : normalizeAttestation(attestationRaw);
      if (status === 'compatible' && (!compatibility?.compatible || !compatibility.checkedAt))
        throw new Error('synaptic-commons-compatibility-proof-missing');
      if (status === 'attested' || status === 'revoked') {
        if (!compatibility?.compatible || !attestation) throw new Error('synaptic-commons-attestation-state-invalid');
        if (status !== 'revoked' || this.attestorKeys.has(attestation.attestorId)) {
          this.verifyAttestation(artifact, fingerprint, attestation, compatibility, { allowExpired: true });
        }
      }
      const importedAt = own(raw, 'importedAt'), updatedAt = own(raw, 'updatedAt');
      if (!Number.isSafeInteger(importedAt) || Number(importedAt) <= 0 ||
          !Number.isSafeInteger(updatedAt) || Number(updatedAt) < Number(importedAt))
        throw new Error('synaptic-commons-record-time-invalid');
      const rejectionReason = own(raw, 'rejectionReason');
      if (status === 'rejected' && (typeof rejectionReason !== 'string' || !rejectionReason.trim() || rejectionReason.length > 240))
        throw new Error('synaptic-commons-rejection-reason-invalid');
      const revocationReason = own(raw, 'revocationReason');
      const revokedAt = own(raw, 'revokedAt');
      if (status === 'revoked' && (typeof revocationReason !== 'string' || !revocationReason.trim() ||
          revocationReason.length > 240 || !Number.isSafeInteger(revokedAt) ||
          Number(revokedAt) < Number(importedAt) || Number(revokedAt) !== Number(updatedAt)))
        throw new Error('synaptic-commons-revocation-proof-invalid');
      normalized.push({
        artifactFingerprint: fingerprint, artifact, status: status as SynapticCommonsStatus,
        importedAt: Number(importedAt), updatedAt: Number(updatedAt), compatibility, attestation,
        rejectionReason: status === 'rejected' ? String(rejectionReason) : null,
        revocationReason: status === 'revoked' ? String(revocationReason) : null,
        revokedAt: status === 'revoked' ? Number(revokedAt) : null,
      });
      fingerprints.add(fingerprint);
      slots.add(slot);
    }
    this.state = { schemaVersion: 1, revision, records: normalized };
  }

  snapshot(): SynapticCommonsState {
    return clone(this.state);
  }

  importArtifact(raw: unknown): { record: SynapticCommonsRecord; duplicate: boolean } {
    const artifact = normalizeArtifact(raw);
    this.assertLicenseReviewTrusted(artifact);
    const fingerprint = synapticArtifactFingerprint(artifact);
    const key = this.publisherKeys.get(artifact.signature.keyId);
    if (!key || !verifyEd25519(fingerprint, artifact.signature.value, key))
      throw new Error('synaptic-publisher-not-trusted-or-signature-invalid');
    const existing = this.state.records.find(record => record.artifactFingerprint === fingerprint);
    if (existing) return { record: clone(existing), duplicate: true };
    const slot = artifact.skill.skillId + '@' + artifact.skill.version;
    if (this.state.records.some(record =>
      record.artifact.skill.skillId + '@' + record.artifact.skill.version === slot))
      throw new Error('synaptic-skill-version-conflict');
    if (this.state.records.length >= MAX_RECORDS) throw new Error('synaptic-commons-capacity-exceeded');
    const now = this.safeNow();
    const record: SynapticCommonsRecord = {
      artifactFingerprint: fingerprint,
      artifact,
      status: 'quarantined',
      importedAt: now,
      updatedAt: now,
      compatibility: null,
      attestation: null,
      rejectionReason: null,
      revocationReason: null,
      revokedAt: null,
    };
    this.state.records.unshift(record);
    this.state.revision += 1;
    return { record: clone(record), duplicate: false };
  }

  evaluateCompatibility(fingerprint: string, target: SynapticCompatibilityTarget): SynapticCommonsRecord {
    const record = this.requireRecord(fingerprint);
    if (record.status === 'rejected') throw new Error('synaptic-skill-rejected');
    if (record.status === 'revoked') throw new Error('synaptic-skill-revoked');
    const reasons = this.compatibilityReasons(record.artifact, target);
    const checkedAt = Number.isSafeInteger(target.now) && Number(target.now) > 0 ? Number(target.now) : this.safeNow();
    const compatible = reasons.length === 0;
    record.compatibility = {
      compatible,
      checkedAt,
      runtimeVersion: target.runtimeVersion,
      environmentFingerprint: target.environmentFingerprint,
      reasons,
    };
    record.status = compatible ? 'compatible' : 'quarantined';
    record.attestation = null;
    record.updatedAt = checkedAt;
    this.state.revision += 1;
    return clone(record);
  }

  attachAttestation(fingerprint: string, raw: unknown): SynapticCommonsRecord {
    const record = this.requireRecord(fingerprint);
    if (record.status !== 'compatible' || !record.compatibility?.compatible)
      throw new Error('synaptic-compatibility-check-required');
    const attestation = normalizeAttestation(raw);
    this.verifyAttestation(record.artifact, fingerprint, attestation, record.compatibility);
    record.attestation = attestation;
    record.status = 'attested';
    record.updatedAt = this.safeNow();
    this.state.revision += 1;
    return clone(record);
  }

  reject(fingerprint: string, reason: string): SynapticCommonsRecord {
    const record = this.requireRecord(fingerprint);
    const safeReason = this.normalizeTransitionReason(reason, 'synaptic-rejection-reason');
    if (record.status === 'attested') throw new Error('synaptic-attested-record-needs-explicit-revocation-review');
    if (record.status === 'revoked') throw new Error('synaptic-skill-revoked');
    if (record.status === 'rejected') throw new Error('synaptic-skill-already-rejected');
    record.status = 'rejected';
    record.rejectionReason = safeReason;
    record.updatedAt = this.safeNow();
    this.state.revision += 1;
    return clone(record);
  }

  revokeAttestedArtifact(fingerprint: string, reason: string): SynapticCommonsRecord {
    const record = this.requireRecord(fingerprint);
    if (record.status === 'revoked') throw new Error('synaptic-skill-already-revoked');
    if (record.status !== 'attested' || !record.attestation)
      throw new Error('synaptic-revocation-requires-attested-artifact');
    const safeReason = this.normalizeTransitionReason(reason, 'synaptic-revocation-reason');
    const revokedAt = this.safeNow();
    record.status = 'revoked';
    record.revocationReason = safeReason;
    record.revokedAt = revokedAt;
    record.rejectionReason = null;
    record.updatedAt = revokedAt;
    this.state.revision += 1;
    return clone(record);
  }

  exportArtifact(fingerprint: string, currentHost: SynapticCompatibilityTarget): { artifact: SynapticCommonsArtifact; attestation: SynapticCommonsAttestation } {
    const record = this.requireRecord(fingerprint);
    if (record.status !== 'attested' || !record.attestation)
      throw new Error('synaptic-export-requires-attested-artifact');
    if (record.attestation.expiresAt <= this.safeNow()) throw new Error('synaptic-attestation-expired');
    if (!record.compatibility?.compatible) throw new Error('synaptic-export-compatibility-proof-missing');
    // Export is bound to the live receiving-host manifest, never a stale snapshot
    // or client-supplied policy. Runtime/environment drift requires fresh checks.
    if (!currentHost || currentHost.runtimeVersion !== record.compatibility.runtimeVersion ||
        currentHost.environmentFingerprint !== record.compatibility.environmentFingerprint)
      throw new Error('synaptic-export-host-context-stale');
    if (this.compatibilityReasons(record.artifact, currentHost).length > 0)
      throw new Error('synaptic-export-current-host-incompatible');
    this.assertLicenseReviewTrusted(record.artifact);
    const publisherKey = this.publisherKeys.get(record.artifact.signature.keyId);
    if (!publisherKey || !verifyEd25519(record.artifactFingerprint, record.artifact.signature.value, publisherKey))
      throw new Error('synaptic-publisher-signature-no-longer-trusted');
    this.verifyAttestation(record.artifact, record.artifactFingerprint, record.attestation, record.compatibility);
    return { artifact: clone(record.artifact), attestation: clone(record.attestation) };
  }

  /**
   * Mint an in-process-only admission envelope after rechecking every export gate.
   * Its WeakMap brand prevents JSON round-tripping or caller-fabricated metadata
   * from impersonating a package that the live Commons instance actually trusts.
   */
  prepareP23Admission(
    fingerprint: string,
    currentHost: SynapticCompatibilityTarget,
  ): SynapticP23AdmissionBundle {
    const exported = this.exportArtifact(fingerprint, currentHost);
    const record = this.requireRecord(fingerprint);
    if (!record.compatibility?.compatible) throw new Error('synaptic-p23-admission-compatibility-proof-missing');
    const bundle: SynapticP23AdmissionBundle = {
      schemaVersion: 1,
      artifactFingerprint: fingerprint,
      artifact: exported.artifact,
      attestation: exported.attestation,
      compatibility: clone(record.compatibility),
    };
    authenticP23AdmissionBundles.set(bundle, admissionBundleDigest(bundle));
    return bundle;
  }

  private compatibilityReasons(artifact: SynapticCommonsArtifact, target: SynapticCompatibilityTarget): string[] {
    if (!target || !parseVersion(target.runtimeVersion) || !HEX_64.test(target.environmentFingerprint ?? '') ||
        !Array.isArray(target.supportedCapabilities) || target.supportedCapabilities.length > 256 ||
        !Array.isArray(target.permittedTools) || target.permittedTools.length > 256 ||
        [...target.supportedCapabilities, ...target.permittedTools].some(value =>
          typeof value !== 'string' || !SAFE_ID.test(value)) ||
        new Set(target.supportedCapabilities).size !== target.supportedCapabilities.length ||
        new Set(target.permittedTools).size !== target.permittedTools.length)
      throw new TypeError('synaptic-compatibility-target-invalid');
    const reasons: string[] = [];
    if (!target.supportedCapabilities.includes(artifact.contract.capability))
      reasons.push('capability-not-supported:' + artifact.contract.capability);
    if (!versionAtLeast(target.runtimeVersion, artifact.contract.minimumRuntimeVersion))
      reasons.push('runtime-version-below-minimum');
    for (const capability of artifact.contract.requiredCapabilities) {
      if (!target.supportedCapabilities.includes(capability)) reasons.push('missing-capability:' + capability);
    }
    for (const tool of artifact.contract.requiredTools) {
      if (!target.permittedTools.includes(tool)) reasons.push('tool-not-permitted:' + tool);
    }
    if (artifact.contract.environmentFingerprint &&
        artifact.contract.environmentFingerprint !== target.environmentFingerprint)
      reasons.push('environment-fingerprint-mismatch');
    if (artifact.contract.permissionClass === 'destructive') reasons.push('destructive-permission-not-shareable');
    if (artifact.contract.allowedModes.some(mode => mode !== 'assisted'))
      reasons.push('unsupported-execution-mode');
    return reasons;
  }

  private normalizeTransitionReason(reason: string, label: string): string {
    if (typeof reason !== 'string') throw new TypeError(label + '-required');
    const normalized = reason.trim();
    if (!normalized) throw new TypeError(label + '-required');
    if (normalized.length > 240) throw new Error(label + '-too-long');
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(normalized) ||
        /\b(?:sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/.test(normalized))
      throw new Error(label + '-sensitive-value-rejected');
    return normalized;
  }

  get(fingerprint: string): SynapticCommonsRecord | null {
    const record = this.state.records.find(item => item.artifactFingerprint === fingerprint);
    return record ? clone(record) : null;
  }

  diagnostics() {
    const records = this.state.records;
    return {
      schemaVersion: this.state.schemaVersion,
      revision: this.state.revision,
      total: records.length,
      quarantined: records.filter(record => record.status === 'quarantined').length,
      compatible: records.filter(record => record.status === 'compatible').length,
      attested: records.filter(record => record.status === 'attested').length,
      rejected: records.filter(record => record.status === 'rejected').length,
      revoked: records.filter(record => record.status === 'revoked').length,
      executableCount: 0 as const,
      trustedPublisherCount: this.publisherKeys.size,
      trustedAttestorCount: this.attestorKeys.size,
    };
  }

  private normalizeCompatibility(raw: unknown): SynapticCompatibilityResult {
    if (!isRecord(raw)) throw new Error('synaptic-commons-compatibility-invalid');
    const copied = cloneSafeJson(raw) as Record<string, unknown>;
    assertExactKeys(copied, ['compatible', 'checkedAt', 'runtimeVersion', 'environmentFingerprint', 'reasons'], 'synaptic-compatibility');
    const reasons = copied.reasons;
    if (typeof copied.compatible !== 'boolean' || !Number.isSafeInteger(copied.checkedAt) || Number(copied.checkedAt) <= 0 ||
        typeof copied.runtimeVersion !== 'string' || !parseVersion(copied.runtimeVersion) ||
        typeof copied.environmentFingerprint !== 'string' || !HEX_64.test(copied.environmentFingerprint) ||
        !Array.isArray(reasons) || reasons.length > 32 || reasons.some(item => typeof item !== 'string' || item.length > 160) ||
        (copied.compatible && reasons.length !== 0) || (!copied.compatible && reasons.length === 0))
      throw new Error('synaptic-commons-compatibility-invalid');
    return {
      compatible: copied.compatible,
      checkedAt: Number(copied.checkedAt),
      runtimeVersion: copied.runtimeVersion,
      environmentFingerprint: copied.environmentFingerprint,
      reasons: [...reasons] as string[],
    };
  }

  private assertLicenseReviewTrusted(artifact: SynapticCommonsArtifact): void {
    const fingerprint = artifact.license.reviewFingerprint;
    if (!this.licenseReviewAllowlist.has(fingerprint))
      throw new Error('synaptic-license-review-not-trusted-by-host');
  }

  private verifyAttestation(
    artifact: SynapticCommonsArtifact,
    fingerprint: string,
    attestation: SynapticCommonsAttestation,
    compatibility: SynapticCompatibilityResult,
    options: { allowExpired?: boolean } = {},
  ): void {
    const key = this.attestorKeys.get(attestation.attestorId);
    const now = this.safeNow();
    if (!key || !verifyEd25519(synapticAttestationSigningPayload(attestation), attestation.signature.value, key))
      throw new Error('synaptic-attestor-signature-invalid');
    if (attestation.artifactFingerprint !== fingerprint ||
        attestation.runtimeVersion !== compatibility.runtimeVersion ||
        attestation.environmentFingerprint !== compatibility.environmentFingerprint ||
        attestation.issuedAt > now || (!options.allowExpired && attestation.expiresAt <= now) ||
        attestation.issuedAt < compatibility.checkedAt - 5 * 60_000)
      throw new Error('synaptic-attestation-context-mismatch');
    if (artifact.contract.permissionClass === 'destructive' ||
        artifact.contract.allowedModes.some(mode => mode !== 'assisted'))
      throw new Error('synaptic-attestation-out-of-scope');
  }

  private requireRecord(fingerprint: string): SynapticCommonsRecord {
    if (typeof fingerprint !== 'string' || !HEX_64.test(fingerprint)) throw new TypeError('synaptic-artifact-fingerprint-invalid');
    const record = this.state.records.find(item => item.artifactFingerprint === fingerprint);
    if (!record) throw new Error('synaptic-artifact-not-found');
    return record;
  }

  private safeNow(): number {
    const value = this.now();
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
  }
}

/** Parse exact host-approved licence review fingerprints. An absent value grants no redistribution trust. */
export function parseSynapticLicenseReviewAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('synaptic-license-review-config-invalid-json'); }
  if (!Array.isArray(value) || value.length > MAX_RECORDS ||
      value.some(item => typeof item !== 'string' || !HEX_64.test(item)) ||
      new Set(value).size !== value.length)
    throw new Error('synaptic-license-review-config-invalid');
  return new Set(value as string[]);
}

/** Parse public trust roots from server-owned environment configuration. Private keys are rejected. */
export function parseSynapticPublicKeyMap(raw: string | undefined): Map<string, string> {
  if (!raw) return new Map();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('synaptic-trust-key-config-invalid-json'); }
  if (!isRecord(value) || Object.keys(value).length > 32) throw new Error('synaptic-trust-key-config-invalid');
  const result = new Map<string, string>();
  for (const [id, pem] of Object.entries(value)) {
    if (!SAFE_ID.test(id) || typeof pem !== 'string' || pem.length > 8192 ||
        !pem.includes('-----BEGIN PUBLIC KEY-----') || pem.includes('PRIVATE KEY'))
      throw new Error('synaptic-trust-key-config-must-contain-public-keys-only');
    let key;
    try { key = createPublicKey(pem); } catch { throw new Error('synaptic-trust-key-config-public-key-invalid'); }
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('synaptic-trust-key-config-requires-ed25519');
    result.set(id, pem);
  }
  return result;
}
