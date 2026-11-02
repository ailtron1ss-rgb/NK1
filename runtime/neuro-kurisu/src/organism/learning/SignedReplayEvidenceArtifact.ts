import { createHash, sign as signSignature, verify as verifySignature } from 'node:crypto';

export type ReplayEvidenceKind =
  | 'protocol'
  | 'longitudinal-trial'
  | 'experiment-trial'
  | 'validation'
  | 'memory-skill';

type JsonPrimitive = string | number | boolean | null;
export type ReplayEvidenceInput = JsonPrimitive | ReplayEvidenceInput[] | { [key: string]: ReplayEvidenceInput };

export interface SignedReplayEvidencePayload {
  schemaVersion: 1;
  artifactId: string;
  runId: string;
  kind: ReplayEvidenceKind;
  verifierId: string;
  observedAt: number;
  protocolFingerprint?: string;
  input: Record<string, ReplayEvidenceInput>;
  inputFingerprint: string;
}

export interface SignedReplayEvidenceArtifact {
  payload: SignedReplayEvidencePayload;
  signature: string;
}

export interface ReplayEvidenceSnapshot {
  schemaVersion: 1;
  artifacts: SignedReplayEvidenceArtifact[];
}

export interface ReplayEvidenceExpected {
  kind: ReplayEvidenceKind;
  input: Record<string, unknown>;
  protocolFingerprint?: string;
}

export interface ReplayEvidenceReceipt {
  readonly artifactId: string;
  readonly artifactFingerprint: string;
  readonly kind: ReplayEvidenceKind;
  readonly inputFingerprint: string;
  readonly protocolFingerprint?: string;
}

export interface ReplayEvidenceAuthorityOptions {
  revokedVerifierIds?: ReadonlySet<string>;
  maxArtifacts?: number;
}

export interface ReplayEvidenceIngestResult {
  accepted: boolean;
  duplicate?: boolean;
  receipt?: ReplayEvidenceReceipt;
  artifactFingerprint: string;
  rejection?: string;
}

const KIND_SET = new Set<ReplayEvidenceKind>([
  'protocol', 'longitudinal-trial', 'experiment-trial', 'validation', 'memory-skill',
]);
const HEX_256 = /^[a-f0-9]{64}$/i;
const IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,255}$/;
const MAX_DEPTH = 8;
const MAX_NODES = 512;
const MAX_ARRAY = 128;
const MAX_KEYS = 128;
const MAX_STRING = 4096;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stable(object[key])}`).join(',')}}`;
}

/** Copies JSON-like evidence without invoking getters or accepting hostile prototypes. */
function detachJson(value: unknown): ReplayEvidenceInput {
  let visited = 0;
  const visit = (raw: unknown, depth: number): ReplayEvidenceInput => {
    if (++visited > MAX_NODES) throw new Error('replay evidence exceeds node budget');
    if (depth > MAX_DEPTH) throw new Error('replay evidence exceeds nesting depth');
    if (raw === null || typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
      if (raw.length > MAX_STRING) throw new Error('replay evidence string exceeds limit');
      return raw;
    }
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw)) throw new Error('replay evidence contains non-finite number');
      return raw;
    }
    if (typeof raw !== 'object') throw new Error('replay evidence contains unsupported value');
    const prototype = Object.getPrototypeOf(raw);
    if (Array.isArray(raw)) {
      if (prototype !== Array.prototype || raw.length > MAX_ARRAY) throw new Error('replay evidence array rejected');
      const keys = Reflect.ownKeys(raw);
      if (keys.some(key => typeof key === 'symbol' || (key !== 'length' && !/^(0|[1-9][0-9]*)$/.test(key)))) {
        throw new Error('replay evidence array contains unexpected keys');
      }
      const result: ReplayEvidenceInput[] = [];
      for (let i = 0; i < raw.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(raw, String(i));
        if (!descriptor || !('value' in descriptor)) throw new Error('replay evidence array is sparse or accessor-backed');
        result.push(visit(descriptor.value, depth + 1));
      }
      return result;
    }
    if (prototype !== Object.prototype && prototype !== null) throw new Error('replay evidence object prototype rejected');
    const keys = Reflect.ownKeys(raw);
    if (keys.some(key => typeof key === 'symbol') || keys.length > MAX_KEYS) throw new Error('replay evidence object keys rejected');
    const result: Record<string, ReplayEvidenceInput> = {};
    for (const key of keys as string[]) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('replay evidence prototype key rejected');
      const descriptor = Object.getOwnPropertyDescriptor(raw, key);
      if (!descriptor || !('value' in descriptor)) throw new Error('replay evidence accessor rejected');
      Object.defineProperty(result, key, {
        value: visit(descriptor.value, depth + 1),
        enumerable: true,
        writable: false,
        configurable: false,
      });
    }
    return result;
  };
  return visit(value, 0);
}

function detachInput(value: unknown): Record<string, ReplayEvidenceInput> {
  const detached = detachJson(value);
  if (!detached || typeof detached !== 'object' || Array.isArray(detached)) throw new Error('replay evidence input must be a record');
  return detached as Record<string, ReplayEvidenceInput>;
}

function normalizeExpected(value: ReplayEvidenceExpected): ReplayEvidenceExpected {
  if (!value || !KIND_SET.has(value.kind)) throw new Error('invalid expected replay evidence kind');
  const input = detachInput(value.input);
  if (value.protocolFingerprint !== undefined && !HEX_256.test(value.protocolFingerprint)) {
    throw new Error('invalid expected protocol fingerprint');
  }
  return {
    kind: value.kind,
    input,
    ...(value.protocolFingerprint ? { protocolFingerprint: value.protocolFingerprint.toLowerCase() } : {}),
  };
}

export function replayEvidenceInputFingerprint(input: Record<string, unknown>): string {
  return sha256(stable(detachInput(input)));
}

export function canonicalReplayEvidencePayload(payload: SignedReplayEvidencePayload): string {
  return stable(detachJson(payload));
}

function fingerprintPayload(payload: SignedReplayEvidencePayload): string {
  return sha256(canonicalReplayEvidencePayload(payload));
}

const receiptOwners = new WeakMap<object, {
  authority: SignedReplayEvidenceAuthority;
  expectedCanonical: string;
  kind: ReplayEvidenceKind;
  protocolFingerprint?: string;
  artifactFingerprint: string;
}>();

/**
 * Runtime trust is re-established only by ingesting a valid Ed25519 artifact.
 * Public keys/revocations are host-owned; private signing keys must never be
 * embedded in NK1. Snapshot data alone never carries receipt authority.
 */
export class SignedReplayEvidenceAuthority {
  private readonly artifacts = new Map<string, SignedReplayEvidenceArtifact>();
  private readonly fingerprints = new Map<string, string>();
  private readonly receipts = new Map<string, ReplayEvidenceReceipt>();
  private readonly trustedVerifierKeys: ReadonlyMap<string, string>;
  private readonly revokedVerifierIds: ReadonlySet<string>;
  private readonly maxArtifacts: number;

  constructor(
    trustedVerifierKeys: ReadonlyMap<string, string>,
    options: ReplayEvidenceAuthorityOptions = {},
  ) {
    this.trustedVerifierKeys = new Map(trustedVerifierKeys);
    this.revokedVerifierIds = options.revokedVerifierIds ?? new Set<string>();
    this.maxArtifacts = Math.max(1, Math.min(4096, Math.floor(options.maxArtifacts ?? 1024)));
  }

  ingest(rawArtifact: unknown, expectedRaw: ReplayEvidenceExpected): ReplayEvidenceIngestResult {
    let artifact: SignedReplayEvidenceArtifact;
    let expected: ReplayEvidenceExpected;
    try {
      artifact = detachJson(rawArtifact) as unknown as SignedReplayEvidenceArtifact;
      expected = normalizeExpected(expectedRaw);
    } catch (error) {
      return { accepted: false, artifactFingerprint: '', rejection: error instanceof Error ? error.message : 'invalid replay evidence input' };
    }
    const payload = artifact?.payload;
    if (!payload || typeof payload !== 'object' || payload.schemaVersion !== 1 ||
        !KIND_SET.has(payload.kind) || !IDENTITY.test(payload.artifactId) ||
        !IDENTITY.test(payload.runId) || !IDENTITY.test(payload.verifierId) ||
        !Number.isFinite(payload.observedAt) || payload.observedAt <= 0 ||
        typeof artifact.signature !== 'string' || artifact.signature.length < 80 ||
        artifact.signature.length > 2048) {
      return { accepted: false, artifactFingerprint: '', rejection: 'invalid-artifact-fields' };
    }
    const fingerprint = fingerprintPayload(payload);
    let payloadInput: Record<string, ReplayEvidenceInput>;
    try {
      payloadInput = detachInput(payload.input);
    } catch {
      return { accepted: false, artifactFingerprint: fingerprint, rejection: 'invalid-artifact-input' };
    }
    const inputFingerprint = sha256(stable(payloadInput));
    if (!HEX_256.test(payload.inputFingerprint) || payload.inputFingerprint.toLowerCase() !== inputFingerprint) {
      return { accepted: false, artifactFingerprint: fingerprint, rejection: 'input-fingerprint-mismatch' };
    }
    if (payload.kind !== expected.kind || stable(payloadInput) !== stable(expected.input) ||
        (payload.protocolFingerprint ?? undefined) !== (expected.protocolFingerprint ?? undefined)) {
      return { accepted: false, artifactFingerprint: fingerprint, rejection: 'measurement-tuple-mismatch' };
    }
    if (payload.protocolFingerprint !== undefined && !HEX_256.test(payload.protocolFingerprint)) {
      return { accepted: false, artifactFingerprint: fingerprint, rejection: 'invalid-protocol-fingerprint' };
    }
    if (payload.kind === 'protocol' && payload.protocolFingerprint !== undefined) {
      return { accepted: false, artifactFingerprint: fingerprint, rejection: 'protocol-artifact-cannot-reference-parent-protocol' };
    }
    if (payload.kind !== 'protocol' && !payload.protocolFingerprint) {
      return { accepted: false, artifactFingerprint: fingerprint, rejection: 'measurement-missing-protocol-fingerprint' };
    }
    if (this.revokedVerifierIds.has(payload.verifierId)) {
      return { accepted: false, artifactFingerprint: fingerprint, rejection: 'revoked-verifier' };
    }
    const publicKey = this.trustedVerifierKeys.get(payload.verifierId);
    if (!publicKey) return { accepted: false, artifactFingerprint: fingerprint, rejection: 'untrusted-verifier' };
    let signatureValid = false;
    try {
      signatureValid = verifySignature(
        null,
        Buffer.from(canonicalReplayEvidencePayload(payload), 'utf8'),
        publicKey,
        Buffer.from(artifact.signature, 'base64'),
      );
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) return { accepted: false, artifactFingerprint: fingerprint, rejection: 'invalid-signature' };

    const artifactFingerprint = sha256(`${fingerprint}\u0000${artifact.signature}`);
    const existingFingerprint = this.fingerprints.get(payload.artifactId);
    if (existingFingerprint && existingFingerprint !== artifactFingerprint) {
      return { accepted: false, artifactFingerprint, rejection: 'conflicting-artifact-id' };
    }
    const duplicate = Boolean(existingFingerprint);
    if (!duplicate && this.artifacts.size >= this.maxArtifacts) {
      return { accepted: false, artifactFingerprint, rejection: 'authority-capacity-exceeded' };
    }
    if (!duplicate) {
      this.artifacts.set(payload.artifactId, artifact);
      this.fingerprints.set(payload.artifactId, artifactFingerprint);
    }
    const receipt: ReplayEvidenceReceipt = Object.freeze({
      artifactId: payload.artifactId,
      artifactFingerprint,
      kind: payload.kind,
      inputFingerprint,
      ...(payload.protocolFingerprint ? { protocolFingerprint: payload.protocolFingerprint.toLowerCase() } : {}),
    });
    receiptOwners.set(receipt, {
      authority: this,
      expectedCanonical: stable(expected),
      kind: payload.kind,
      protocolFingerprint: payload.protocolFingerprint?.toLowerCase(),
      artifactFingerprint,
    });
    this.receipts.set(payload.artifactId, receipt);
    return { accepted: true, duplicate, receipt, artifactFingerprint };
  }

  isTrusted(receipt: unknown, expectedRaw: ReplayEvidenceExpected): receipt is ReplayEvidenceReceipt {
    if (!receipt || typeof receipt !== 'object') return false;
    const owner = receiptOwners.get(receipt as object);
    if (!owner || owner.authority !== this) return false;
    try {
      const expected = normalizeExpected(expectedRaw);
      return owner.expectedCanonical === stable(expected) &&
        owner.kind === expected.kind &&
        owner.protocolFingerprint === expected.protocolFingerprint &&
        this.fingerprints.get((receipt as ReplayEvidenceReceipt).artifactId) === owner.artifactFingerprint;
    } catch {
      return false;
    }
  }

  receiptFor(artifactId: string): ReplayEvidenceReceipt | undefined {
    return this.receipts.get(String(artifactId));
  }

  artifactFor(artifactId: string): SignedReplayEvidenceArtifact | undefined {
    const value = this.artifacts.get(String(artifactId));
    return value ? structuredClone(value) : undefined;
  }

  snapshot(): ReplayEvidenceSnapshot {
    return {
      schemaVersion: 1,
      artifacts: [...this.artifacts.values()]
        .sort((a, b) => a.payload.artifactId.localeCompare(b.payload.artifactId))
        .map(value => structuredClone(value)),
    };
  }

  restore(raw: unknown): { accepted: number; rejected: number } {
    this.artifacts.clear();
    this.fingerprints.clear();
    this.receipts.clear();
    let detached: unknown;
    try {
      detached = detachJson(raw);
    } catch {
      return { accepted: 0, rejected: 1 };
    }
    if (!detached || typeof detached !== 'object' || Array.isArray(detached)) return { accepted: 0, rejected: 1 };
    const snapshot = detached as unknown as ReplayEvidenceSnapshot;
    if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.artifacts) || snapshot.artifacts.length > this.maxArtifacts) {
      return { accepted: 0, rejected: 1 };
    }
    let accepted = 0;
    let rejected = 0;
    for (const artifact of snapshot.artifacts) {
      const payload = artifact?.payload;
      const expected = payload && typeof payload === 'object'
        ? { kind: payload.kind, input: payload.input, ...(payload.protocolFingerprint ? { protocolFingerprint: payload.protocolFingerprint } : {}) }
        : null;
      const result = expected ? this.ingest(artifact, expected as ReplayEvidenceExpected) : null;
      if (result?.accepted && !result.duplicate) accepted++;
      else rejected++;
    }
    return { accepted, rejected };
  }
}

/** Fixture producer only. Production signing keys must remain outside NK1. */
export function signReplayEvidenceArtifactForFixture(
  input: {
    artifactId: string;
    runId: string;
    kind: ReplayEvidenceKind;
    verifierId: string;
    observedAt: number;
    protocolFingerprint?: string;
    input: Record<string, unknown>;
  },
  privateKeyPem: string,
): SignedReplayEvidenceArtifact {
  const detachedInput = detachInput(input.input);
  const payload: SignedReplayEvidencePayload = {
    schemaVersion: 1,
    artifactId: input.artifactId,
    runId: input.runId,
    kind: input.kind,
    verifierId: input.verifierId,
    observedAt: input.observedAt,
    ...(input.protocolFingerprint ? { protocolFingerprint: input.protocolFingerprint.toLowerCase() } : {}),
    input: detachedInput,
    inputFingerprint: sha256(stable(detachedInput)),
  };
  return {
    payload,
    signature: signSignature(null, Buffer.from(canonicalReplayEvidencePayload(payload), 'utf8'), privateKeyPem).toString('base64'),
  };
}
