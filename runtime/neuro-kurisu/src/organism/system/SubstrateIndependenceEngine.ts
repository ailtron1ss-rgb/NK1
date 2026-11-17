import { createHash } from 'node:crypto';
import { types as nodeUtilTypes } from 'node:util';

export type SubstratePrivacyClass = 'local-only' | 'private-remote' | 'external';

export interface SubstrateBackendProfile {
  backendId: string;
  routeId: string;
  providerId: string;
  modelId: string;
  modelRevision: string;
  runtime: string;
  privacyClass: SubstratePrivacyClass;
  capabilities: string[];
  embeddingSpaceId?: string;
  contextWindowTokens: number;
}

export type PortableJson =
  | null
  | boolean
  | number
  | string
  | PortableJson[]
  | { [key: string]: PortableJson };

export interface PortableCognitivePayloadV1 {
  organism: PortableJson;
  world: PortableJson;
  proceduralSkills: PortableJson | null;
}

export interface PortableCognitiveTransferV1 {
  schema: 'nk1.portable-cognitive-state';
  schemaVersion: 1;
  stateContract: 'nk1.persisted-organism-world-procedural-skills/v1';
  createdAt: number;
  source: {
    backendId: string | null;
    profileDigest: string | null;
  };
  payload: PortableCognitivePayloadV1;
  integrity: {
    algorithm: 'sha256';
    digest: string;
    bytes: number;
  };
}

export interface SubstrateCalibrationTrial {
  trialId: string;
  transferDigest: string;
  sourceBackendId: string;
  targetBackendId: string;
  taskId: string;
  taskFamily: string;
  independenceKey: string;
  evaluatorReceiptId: string;
  evaluatorKeyId?: string;
  evaluatorSignatureBase64?: string;
  holdout: true;
  taskSuccess01: number;
  memoryRecall01: number;
  goalFidelity01: number;
  constraintFidelity01: number;
  identityContinuity01: number;
  toolContract01: number;
  sourceLatencyMs: number;
  targetLatencyMs: number;
}

export interface SubstrateMigrationEvaluation {
  evaluationId: string;
  accepted: boolean;
  sourceBackendId: string;
  targetBackendId: string;
  transferDigest: string;
  evaluatedAt: number;
  trialCount: number;
  taskFamilyCount: number;
  receipts: SubstrateCalibrationTrial[];
  metrics: {
    minTaskSuccess01: number;
    minMemoryRecall01: number;
    minGoalFidelity01: number;
    minConstraintFidelity01: number;
    minIdentityContinuity01: number;
    minToolContract01: number;
    p95LatencyRatio: number;
  };
  reasons: string[];
}

export interface SubstrateIndependenceState {
  version: 1;
  activeBackendId: string | null;
  activeProvenance: 'bootstrap' | 'calibrated' | 'unknown';
  observedBackendId: string | null;
  pendingTransfer: {
    transferDigest: string;
    sourceBackendId: string | null;
    targetBackendId: string;
    importedAt: number;
  } | null;
  lastEvaluation: SubstrateMigrationEvaluation | null;
  history: Array<{
    at: number;
    fromBackendId: string | null;
    toBackendId: string;
    transferDigest: string;
    evaluationId: string;
    reason: 'calibrated-promotion' | 'rollback';
  }>;
}

export interface SubstrateIndependenceOptions {
  profiles?: readonly SubstrateBackendProfile[];
  minIndependentTrials?: number;
  minDistinctTaskFamilies?: number;
  maxTransferBytes?: number;
  maxLatencyRatio?: number;
}

type PlainRecord = Record<string, unknown>;
const REQUIRED_CAPABILITIES = ['text-generation', 'json-proposal', 'tool-routing'] as const;
const MAX_STRING_LENGTH = 1_000_000;
const MAX_ARRAY_LENGTH = 500_000;
const MAX_OBJECT_KEYS = 100_000;
const MAX_JSON_DEPTH = 48;
const DEFAULT_MAX_TRANSFER_BYTES = 64 * 1024 * 1024;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function fail(message: string): never { throw new Error(message); }

function isSafeId(value: unknown, max = 180): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= max
    && value.trim() === value
    && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

function ownDataRecord(value: unknown, allowedKeys?: readonly string[]): PlainRecord {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) {
      return fail('portable-record-invalid');
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return fail('portable-record-prototype-invalid');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > MAX_OBJECT_KEYS) return fail('portable-record-too-large');
    const result: PlainRecord = Object.create(null);
    for (const key of keys) {
      if (typeof key !== 'string') return fail('portable-symbol-key-rejected');
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') return fail('portable-dangerous-key-rejected');
      if (allowedKeys && !allowedKeys.includes(key)) return fail('portable-unknown-field-rejected');
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.enumerable !== true) {
        return fail('portable-accessor-or-hidden-field-rejected');
      }
      result[key] = descriptor.value;
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('portable-')) throw error;
    return fail('portable-record-unreadable');
  }
}

function normalizePortableValue(value: unknown, seen: WeakSet<object>, depth: number, counter: { nodes: number }): PortableJson {
  if (depth > MAX_JSON_DEPTH) return fail('portable-state-depth-limit');
  counter.nodes += 1;
  if (counter.nodes > MAX_ARRAY_LENGTH + MAX_OBJECT_KEYS) return fail('portable-state-node-limit');

  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) return fail('portable-state-string-limit');
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fail('portable-non-finite-number-rejected');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === 'undefined') return null;
  if (typeof value !== 'object' || value === null) return fail('portable-non-data-value-rejected');
  if (nodeUtilTypes.isProxy(value)) return fail('portable-proxy-rejected');
  if (seen.has(value)) return fail('portable-state-cycle-rejected');

  if (nodeUtilTypes.isDate(value)) {
    const time = value.getTime();
    if (!Number.isFinite(time)) return fail('portable-invalid-date-rejected');
    return { $nk1Type: 'Date', value: value.toISOString() };
  }
  if (Buffer.isBuffer(value)) {
    return { $nk1Type: 'Buffer', base64: value.toString('base64') };
  }
  if (nodeUtilTypes.isMap(value)) {
    seen.add(value);
    try {
      const entries = [...value.entries()].map(([key, entry]) => [
        normalizePortableValue(key, seen, depth + 1, counter),
        normalizePortableValue(entry, seen, depth + 1, counter),
      ]);
      return { $nk1Type: 'Map', entries };
    } finally { seen.delete(value); }
  }
  if (nodeUtilTypes.isSet(value)) {
    seen.add(value);
    try {
      return { $nk1Type: 'Set', values: [...value.values()].map((entry) =>
        normalizePortableValue(entry, seen, depth + 1, counter)) };
    } finally { seen.delete(value); }
  }
  if (nodeUtilTypes.isArrayBuffer(value)) {
    return { $nk1Type: 'ArrayBuffer', base64: Buffer.from(value).toString('base64') };
  }
  if (ArrayBuffer.isView(value)) {
    if (nodeUtilTypes.isDataView(value)) {
      return { $nk1Type: 'DataView', base64: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') };
    }
    const type = Object.getPrototypeOf(value)?.constructor?.name;
    const supported = new Set([
      'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
      'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array',
    ]);
    if (!supported.has(type)) return fail('portable-typed-array-rejected');
    return { $nk1Type: type, base64: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') };
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || value.length > MAX_ARRAY_LENGTH) {
        return fail('portable-array-shape-invalid');
      }
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const keys = Reflect.ownKeys(descriptors);
      if (keys.some((key) => typeof key !== 'string' || (key !== 'length' && !/^(0|[1-9]\d*)$/u.test(key)))) {
        return fail('portable-array-extra-property-rejected');
      }
      const result: PortableJson[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor) return fail('portable-sparse-array-rejected');
        if (!Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.enumerable !== true) {
          return fail('portable-array-accessor-rejected');
        }
        result.push(normalizePortableValue(descriptor.value, seen, depth + 1, counter));
      }
      return result;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return fail('portable-class-instance-rejected');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > MAX_OBJECT_KEYS) return fail('portable-object-key-limit');
    const result: Record<string, PortableJson> = {};
    for (const key of keys) {
      if (typeof key !== 'string') return fail('portable-symbol-key-rejected');
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') return fail('portable-dangerous-key-rejected');
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        return fail('portable-accessor-rejected');
      }
      if (descriptor.enumerable !== true || descriptor.value === undefined) continue;
      Object.defineProperty(result, key, {
        value: normalizePortableValue(descriptor.value, seen, depth + 1, counter),
        enumerable: true, writable: true, configurable: true,
      });
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

function normalizePortable(value: unknown, maxBytes: number): PortableJson {
  const normalized = normalizePortableValue(value, new WeakSet<object>(), 0, { nodes: 0 });
  const encoded = canonicalJson(normalized);
  if (Buffer.byteLength(encoded, 'utf8') > maxBytes) return fail('portable-transfer-size-limit');
  return normalized;
}

function canonicalJson(value: PortableJson | PlainRecord): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map((entry) => canonicalJson(entry)).join(',') + ']';
  const record = value as Record<string, PortableJson>;
  return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(record[key])).join(',') + '}';
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}


const TYPED_ARRAY_CONSTRUCTORS: Record<string, any> = {
  Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
  Int32Array, Uint32Array, Float32Array, Float64Array,
  ...(typeof BigInt64Array === 'undefined' ? {} : { BigInt64Array }),
  ...(typeof BigUint64Array === 'undefined' ? {} : { BigUint64Array }),
};

function decodeBase64(value: unknown): Buffer {
  if (typeof value !== 'string' || value.length > DEFAULT_MAX_TRANSFER_BYTES * 2
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    return fail('portable-binary-encoding-invalid');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) return fail('portable-binary-noncanonical-base64');
  return decoded;
}

/** Rehydrate the explicitly tagged binary/container values after the portable JSON envelope is verified. */
export function hydratePortableState(value: PortableJson): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => hydratePortableState(entry));
  const row = value as Record<string, PortableJson>;
  const type = row.$nk1Type;
  if (typeof type === 'string') {
    if (type === 'Date') {
      if (Object.keys(row).sort().join(',') !== '$nk1Type,value' || typeof row.value !== 'string') return fail('portable-date-tag-invalid');
      const date = new Date(row.value);
      if (!Number.isFinite(date.getTime()) || date.toISOString() !== row.value) return fail('portable-date-tag-invalid');
      return date;
    }
    if (type === 'Map') {
      if (Object.keys(row).sort().join(',') !== '$nk1Type,entries' || !Array.isArray(row.entries)) return fail('portable-map-tag-invalid');
      const entries = row.entries.map((entry) => {
        if (!Array.isArray(entry) || entry.length !== 2) return fail('portable-map-entry-invalid');
        return [hydratePortableState(entry[0]), hydratePortableState(entry[1])];
      });
      return new Map(entries);
    }
    if (type === 'Set') {
      if (Object.keys(row).sort().join(',') !== '$nk1Type,values' || !Array.isArray(row.values)) return fail('portable-set-tag-invalid');
      return new Set(row.values.map((entry) => hydratePortableState(entry)));
    }
    if (type === 'Buffer') {
      if (Object.keys(row).sort().join(',') !== '$nk1Type,base64') return fail('portable-buffer-tag-invalid');
      return decodeBase64(row.base64);
    }
    if (type === 'ArrayBuffer' || type === 'DataView') {
      if (Object.keys(row).sort().join(',') !== '$nk1Type,base64') return fail('portable-arraybuffer-tag-invalid');
      const bytes = decodeBase64(row.base64);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return type === 'ArrayBuffer' ? buffer : new DataView(buffer);
    }
    const Constructor = TYPED_ARRAY_CONSTRUCTORS[type];
    if (Constructor) {
      if (Object.keys(row).sort().join(',') !== '$nk1Type,base64') return fail('portable-typed-array-tag-invalid');
      const bytes = decodeBase64(row.base64);
      if (bytes.byteLength % Constructor.BYTES_PER_ELEMENT !== 0) return fail('portable-typed-array-byte-length-invalid');
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return new Constructor(buffer);
    }
    return fail('portable-unknown-type-tag');
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(row)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor' || key === '$nk1Type') {
      return fail('portable-reserved-key-rejected');
    }
    Object.defineProperty(result, key, {
      value: hydratePortableState(entry), enumerable: true, writable: true, configurable: true,
    });
  }
  return result;
}

function profileSnapshot(input: unknown): SubstrateBackendProfile {
  const row = ownDataRecord(input, [
    'backendId', 'routeId', 'providerId', 'modelId', 'modelRevision', 'runtime',
    'privacyClass', 'capabilities', 'embeddingSpaceId', 'contextWindowTokens',
  ]);
  for (const key of ['backendId', 'routeId', 'providerId', 'modelId', 'modelRevision', 'runtime'] as const) {
    if (!isSafeId(row[key], 180)) return fail('substrate-profile-invalid:' + key);
  }
  if (!['local-only', 'private-remote', 'external'].includes(String(row.privacyClass))) return fail('substrate-profile-privacy-invalid');
  if (!Number.isSafeInteger(row.contextWindowTokens) || Number(row.contextWindowTokens) < 256 || Number(row.contextWindowTokens) > 2_000_000) {
    return fail('substrate-profile-context-window-invalid');
  }
  if (!Array.isArray(row.capabilities) || row.capabilities.length > 64 || row.capabilities.some((x) => !isSafeId(x, 80))) {
    return fail('substrate-profile-capabilities-invalid');
  }
  const capabilities = [...new Set(row.capabilities as string[])].sort();
  if (capabilities.length !== row.capabilities.length) return fail('substrate-profile-capability-duplicate');
  if (row.embeddingSpaceId !== undefined && !isSafeId(row.embeddingSpaceId, 180)) return fail('substrate-profile-embedding-space-invalid');
  return {
    backendId: row.backendId as string,
    routeId: row.routeId as string,
    providerId: row.providerId as string,
    modelId: row.modelId as string,
    modelRevision: row.modelRevision as string,
    runtime: row.runtime as string,
    privacyClass: row.privacyClass as SubstratePrivacyClass,
    capabilities,
    ...(row.embeddingSpaceId === undefined ? {} : { embeddingSpaceId: row.embeddingSpaceId as string }),
    contextWindowTokens: Number(row.contextWindowTokens),
  };
}

function profileDigest(profile: SubstrateBackendProfile | null): string | null {
  return profile ? sha256(canonicalJson(normalizePortable(profile, 64 * 1024) as PortableJson)) : null;
}

function defaultState(): SubstrateIndependenceState {
  return {
    version: 1,
    activeBackendId: null,
    activeProvenance: 'unknown',
    observedBackendId: null,
    pendingTransfer: null,
    lastEvaluation: null,
    history: [],
  };
}

function normalizeEvaluation(value: unknown): SubstrateMigrationEvaluation | null {
  try {
    const row = ownDataRecord(value, [
      'evaluationId', 'accepted', 'sourceBackendId', 'targetBackendId', 'transferDigest',
      'evaluatedAt', 'trialCount', 'taskFamilyCount', 'receipts', 'metrics', 'reasons',
    ]);
    if (!isSafeId(row.evaluationId) || typeof row.accepted !== 'boolean'
        || !isSafeId(row.sourceBackendId) || !isSafeId(row.targetBackendId)
        || typeof row.transferDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(row.transferDigest)
        || !Number.isFinite(row.evaluatedAt) || !Number.isSafeInteger(row.trialCount) || !Number.isSafeInteger(row.taskFamilyCount)
        || !Array.isArray(row.receipts) || row.receipts.length > 100 || row.receipts.length !== row.trialCount
        || !Array.isArray(row.reasons) || row.reasons.length > 32
        || !row.reasons.every((x) => isSafeId(x, 120))) return null;
    const metrics = ownDataRecord(row.metrics, [
      'minTaskSuccess01', 'minMemoryRecall01', 'minGoalFidelity01', 'minConstraintFidelity01',
      'minIdentityContinuity01', 'minToolContract01', 'p95LatencyRatio',
    ]);
    for (const key of [
      'minTaskSuccess01', 'minMemoryRecall01', 'minGoalFidelity01', 'minConstraintFidelity01',
      'minIdentityContinuity01', 'minToolContract01', 'p95LatencyRatio',
    ] as const) if (typeof metrics[key] !== 'number' || !Number.isFinite(metrics[key]) || Number(metrics[key]) < 0) return null;
    return {
      evaluationId: row.evaluationId,
      accepted: row.accepted,
      sourceBackendId: row.sourceBackendId,
      targetBackendId: row.targetBackendId,
      transferDigest: row.transferDigest,
      evaluatedAt: Number(row.evaluatedAt),
      trialCount: Number(row.trialCount),
      taskFamilyCount: Number(row.taskFamilyCount),
      metrics: {
        minTaskSuccess01: Number(metrics.minTaskSuccess01),
        minMemoryRecall01: Number(metrics.minMemoryRecall01),
        minGoalFidelity01: Number(metrics.minGoalFidelity01),
        minConstraintFidelity01: Number(metrics.minConstraintFidelity01),
        minIdentityContinuity01: Number(metrics.minIdentityContinuity01),
        minToolContract01: Number(metrics.minToolContract01),
        p95LatencyRatio: Number(metrics.p95LatencyRatio),
      },
      receipts: (row.receipts as unknown[]).map(normalizeTrial),
      reasons: [...row.reasons as string[]],
    };
  } catch {
    return null;
  }
}

function normalizeTrial(value: unknown): SubstrateCalibrationTrial {
  const row = ownDataRecord(value, [
    'trialId', 'transferDigest', 'sourceBackendId', 'targetBackendId', 'taskId', 'taskFamily', 'independenceKey',
    'evaluatorReceiptId', 'evaluatorKeyId', 'evaluatorSignatureBase64', 'holdout', 'taskSuccess01', 'memoryRecall01', 'goalFidelity01',
    'constraintFidelity01', 'identityContinuity01', 'toolContract01', 'sourceLatencyMs', 'targetLatencyMs',
  ]);
  for (const key of [
    'trialId', 'sourceBackendId', 'targetBackendId', 'taskId', 'taskFamily',
    'independenceKey', 'evaluatorReceiptId',
  ] as const) if (!isSafeId(row[key], 180)) return fail('calibration-trial-invalid:' + key);
  if (typeof row.transferDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(row.transferDigest)) return fail('calibration-trial-transfer-digest-invalid');
  if (row.evaluatorKeyId !== undefined && !isSafeId(row.evaluatorKeyId, 120)) return fail('calibration-evaluator-key-id-invalid');
  if (row.evaluatorSignatureBase64 !== undefined) {
    if (typeof row.evaluatorSignatureBase64 !== 'string') return fail('calibration-evaluator-signature-invalid');
    const decoded = Buffer.from(row.evaluatorSignatureBase64, 'base64');
    if (decoded.length !== 64 || decoded.toString('base64') !== row.evaluatorSignatureBase64) return fail('calibration-evaluator-signature-invalid');
  }
  if (row.holdout !== true) return fail('calibration-trial-not-holdout');
  for (const key of [
    'taskSuccess01', 'memoryRecall01', 'goalFidelity01', 'constraintFidelity01',
    'identityContinuity01', 'toolContract01',
  ] as const) {
    if (typeof row[key] !== 'number' || !Number.isFinite(row[key]) || Number(row[key]) < 0 || Number(row[key]) > 1) {
      return fail('calibration-trial-metric-invalid:' + key);
    }
  }
  for (const key of ['sourceLatencyMs', 'targetLatencyMs'] as const) {
    if (typeof row[key] !== 'number' || !Number.isFinite(row[key]) || Number(row[key]) <= 0 || Number(row[key]) > 3_600_000) {
      return fail('calibration-trial-latency-invalid:' + key);
    }
  }
  return {
    trialId: row.trialId as string,
    transferDigest: row.transferDigest as string,
    sourceBackendId: row.sourceBackendId as string,
    targetBackendId: row.targetBackendId as string,
    taskId: row.taskId as string,
    taskFamily: row.taskFamily as string,
    independenceKey: row.independenceKey as string,
    evaluatorReceiptId: row.evaluatorReceiptId as string,
    ...(row.evaluatorKeyId === undefined ? {} : { evaluatorKeyId: row.evaluatorKeyId as string }),
    ...(row.evaluatorSignatureBase64 === undefined ? {} : { evaluatorSignatureBase64: row.evaluatorSignatureBase64 as string }),
    holdout: true,
    taskSuccess01: Number(row.taskSuccess01),
    memoryRecall01: Number(row.memoryRecall01),
    goalFidelity01: Number(row.goalFidelity01),
    constraintFidelity01: Number(row.constraintFidelity01),
    identityContinuity01: Number(row.identityContinuity01),
    toolContract01: Number(row.toolContract01),
    sourceLatencyMs: Number(row.sourceLatencyMs),
    targetLatencyMs: Number(row.targetLatencyMs),
  };
}

/** Canonical Ed25519 signing payload for host-owned calibration receipts. The signature itself is excluded. */
export function substrateCalibrationSigningPayload(input: SubstrateCalibrationTrial): string {
  const trial = normalizeTrial(input);
  const signed: Record<string, PortableJson> = {};
  for (const [key, value] of Object.entries(trial)) {
    if (key === 'evaluatorSignatureBase64') continue;
    Object.defineProperty(signed, key, { value: normalizePortable(value, 64 * 1024), enumerable: true, writable: true, configurable: true });
  }
  return canonicalJson(signed);
}

export class SubstrateIndependenceEngine {
  private readonly profiles = new Map<string, SubstrateBackendProfile>();
  private readonly minIndependentTrials: number;
  private readonly minDistinctTaskFamilies: number;
  private readonly maxTransferBytes: number;
  private readonly maxLatencyRatio: number;
  private readonly verifiedEvaluationIds = new Set<string>();
  private state = defaultState();

  constructor(options: SubstrateIndependenceOptions = {}) {
    this.minIndependentTrials = Math.max(5, Math.min(100, Math.floor(options.minIndependentTrials ?? 5)));
    this.minDistinctTaskFamilies = Math.max(3, Math.min(20, Math.floor(options.minDistinctTaskFamilies ?? 3)));
    this.maxTransferBytes = Math.max(1024, Math.min(256 * 1024 * 1024, Math.floor(options.maxTransferBytes ?? DEFAULT_MAX_TRANSFER_BYTES)));
    this.maxLatencyRatio = Math.max(1, Math.min(10, Number(options.maxLatencyRatio ?? 2)));
    for (const raw of options.profiles ?? []) {
      const profile = profileSnapshot(raw);
      if (this.profiles.has(profile.backendId)) fail('substrate-profile-duplicate-backend-id');
      this.profiles.set(profile.backendId, profile);
    }
  }

  snapshot(): SubstrateIndependenceState {
    return structuredClone(this.state);
  }

  restore(raw?: Partial<SubstrateIndependenceState> | null): { restored: boolean; reason: string } {
    this.verifiedEvaluationIds.clear();
    if (!raw || typeof raw !== 'object') {
      this.state = defaultState();
      return { restored: false, reason: 'missing-state' };
    }
    try {
      const row = ownDataRecord(raw, [
        'version', 'activeBackendId', 'activeProvenance', 'observedBackendId',
        'pendingTransfer', 'lastEvaluation', 'history',
      ]);
      if (row.version !== 1) throw new Error('unsupported-schema');
      const activeBackendId = row.activeBackendId === null ? null : (isSafeId(row.activeBackendId) ? row.activeBackendId : fail('invalid-active-backend'));
      const observedBackendId = row.observedBackendId === null ? null : (isSafeId(row.observedBackendId) ? row.observedBackendId : fail('invalid-observed-backend'));
      if (!['bootstrap', 'calibrated', 'unknown'].includes(String(row.activeProvenance))) throw new Error('invalid-active-provenance');
      let pendingTransfer: SubstrateIndependenceState['pendingTransfer'] = null;
      if (row.pendingTransfer !== null) {
        const pending = ownDataRecord(row.pendingTransfer, ['transferDigest', 'sourceBackendId', 'targetBackendId', 'importedAt']);
        if (typeof pending.transferDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(pending.transferDigest)
            || !(pending.sourceBackendId === null || isSafeId(pending.sourceBackendId))
            || !isSafeId(pending.targetBackendId) || !Number.isFinite(pending.importedAt)) throw new Error('invalid-pending-transfer');
        pendingTransfer = {
          transferDigest: pending.transferDigest,
          sourceBackendId: pending.sourceBackendId as string | null,
          targetBackendId: pending.targetBackendId as string,
          importedAt: Number(pending.importedAt),
        };
      }
      const history = Array.isArray(row.history) ? row.history.slice(-64).flatMap((entry: unknown) => {
        const item = ownDataRecord(entry, ['at', 'fromBackendId', 'toBackendId', 'transferDigest', 'evaluationId', 'reason']);
        if (!Number.isFinite(item.at) || !(item.fromBackendId === null || isSafeId(item.fromBackendId))
            || !isSafeId(item.toBackendId) || typeof item.transferDigest !== 'string'
            || !/^[a-f0-9]{64}$/u.test(item.transferDigest) || !isSafeId(item.evaluationId)
            || !['calibrated-promotion', 'rollback'].includes(String(item.reason))) throw new Error('invalid-history');
        return [{
          at: Number(item.at), fromBackendId: item.fromBackendId as string | null,
          toBackendId: item.toBackendId as string, transferDigest: item.transferDigest,
          evaluationId: item.evaluationId as string, reason: item.reason as 'calibrated-promotion' | 'rollback',
        }];
      }) : [];
      this.state = {
        version: 1,
        activeBackendId,
        activeProvenance: row.activeProvenance as SubstrateIndependenceState['activeProvenance'],
        observedBackendId,
        pendingTransfer,
        lastEvaluation: normalizeEvaluation(row.lastEvaluation),
        history,
      };
      return { restored: true, reason: 'ok' };
    } catch {
      this.state = defaultState();
      return { restored: false, reason: 'invalid-state-reset' };
    }
  }

  setInitialBackend(backendId: string): SubstrateIndependenceState {
    if (!isSafeId(backendId)) fail('substrate-backend-id-invalid');
    if (backendId !== 'deterministic-policy-fallback'
        && (this.state.activeBackendId === null || this.state.activeBackendId === 'deterministic-policy-fallback')
        && this.state.pendingTransfer === null) {
      this.state.activeBackendId = backendId;
      this.state.activeProvenance = this.profiles.has(backendId) ? 'bootstrap' : 'unknown';
    }
    this.state.observedBackendId = backendId;
    return this.snapshot();
  }

  observeBackend(backendId: string): { changed: boolean; state: SubstrateIndependenceState } {
    if (!isSafeId(backendId)) fail('substrate-backend-id-invalid');
    const previous = String(this.state.observedBackendId ?? '') + '|' + String(this.state.activeBackendId ?? '') + '|' + this.state.activeProvenance;
    this.state.observedBackendId = backendId;
    // The deterministic fallback is not a language-model substrate. Do not lock
    // the organism to it when a real provider later becomes available.
    if (backendId !== 'deterministic-policy-fallback'
        && (this.state.activeBackendId === null || this.state.activeBackendId === 'deterministic-policy-fallback')
        && this.state.pendingTransfer === null) {
      this.state.activeBackendId = backendId;
      this.state.activeProvenance = this.profiles.has(backendId) ? 'bootstrap' : 'unknown';
    } else if (this.state.activeBackendId === backendId && this.state.activeProvenance === 'unknown' && this.profiles.has(backendId)) {
      this.state.activeProvenance = 'bootstrap';
    }
    const current = String(this.state.observedBackendId ?? '') + '|' + String(this.state.activeBackendId ?? '') + '|' + this.state.activeProvenance;
    return { changed: previous !== current, state: this.snapshot() };
  }

  activeBackendId(): string | null { return this.state.activeBackendId; }

  preferredRoute(): string | null {
    if (!this.state.activeBackendId || this.state.activeBackendId === 'deterministic-policy-fallback') return null;
    const profile = this.profiles.get(this.state.activeBackendId);
    return profile?.routeId ?? null;
  }

  profile(backendId: string): SubstrateBackendProfile | null {
    const profile = this.profiles.get(backendId);
    return profile ? structuredClone(profile) : null;
  }

  createTransferPackage(input: {
    sourceBackendId: string | null;
    capturedAt: number;
    organism: unknown;
    world: unknown;
    proceduralSkills: unknown;
  }): PortableCognitiveTransferV1 {
    if (!(input.sourceBackendId === null || isSafeId(input.sourceBackendId))) fail('transfer-source-backend-invalid');
    if (!Number.isFinite(input.capturedAt) || input.capturedAt <= 0) fail('transfer-capture-time-invalid');
    if (input.organism === null || input.world === null) fail('transfer-canonical-state-missing');
    const payload: PortableCognitivePayloadV1 = {
      organism: normalizePortable(input.organism, this.maxTransferBytes),
      world: normalizePortable(input.world, this.maxTransferBytes),
      proceduralSkills: input.proceduralSkills === null || input.proceduralSkills === undefined
        ? null
        : normalizePortable(input.proceduralSkills, this.maxTransferBytes),
    };
    const unsigned = {
      schema: 'nk1.portable-cognitive-state' as const,
      schemaVersion: 1 as const,
      stateContract: 'nk1.persisted-organism-world-procedural-skills/v1' as const,
      createdAt: input.capturedAt,
      source: {
        backendId: input.sourceBackendId,
        profileDigest: input.sourceBackendId ? profileDigest(this.profiles.get(input.sourceBackendId) ?? null) : null,
      },
      payload,
    };
    const encoded = canonicalJson(unsigned as unknown as PortableJson);
    const bytes = Buffer.byteLength(encoded, 'utf8');
    if (bytes > this.maxTransferBytes) fail('portable-transfer-size-limit');
    const transfer: PortableCognitiveTransferV1 = {
      ...unsigned,
      integrity: { algorithm: 'sha256', digest: sha256(encoded), bytes },
    };
    const verified = this.verifyTransferPackage(transfer);
    if (!verified.valid) fail('portable-transfer-self-verification-failed');
    return transfer;
  }

  verifyTransferPackage(input: unknown): { valid: boolean; digest: string | null; bytes: number; reasons: string[] } {
    try {
      const row = ownDataRecord(input, ['schema', 'schemaVersion', 'stateContract', 'createdAt', 'source', 'payload', 'integrity']);
      if (row.schema !== 'nk1.portable-cognitive-state' || row.schemaVersion !== 1
          || row.stateContract !== 'nk1.persisted-organism-world-procedural-skills/v1'
          || typeof row.createdAt !== 'number' || !Number.isFinite(row.createdAt) || row.createdAt <= 0) {
        return { valid: false, digest: null, bytes: 0, reasons: ['transfer-schema-invalid'] };
      }
      const source = ownDataRecord(row.source, ['backendId', 'profileDigest']);
      if (!(source.backendId === null || isSafeId(source.backendId))
          || !(source.profileDigest === null || (typeof source.profileDigest === 'string' && /^[a-f0-9]{64}$/u.test(source.profileDigest)))) {
        return { valid: false, digest: null, bytes: 0, reasons: ['transfer-source-invalid'] };
      }
      const payloadRow = ownDataRecord(row.payload, ['organism', 'world', 'proceduralSkills']);
      if (!Object.prototype.hasOwnProperty.call(payloadRow, 'organism')
          || !Object.prototype.hasOwnProperty.call(payloadRow, 'world')
          || !Object.prototype.hasOwnProperty.call(payloadRow, 'proceduralSkills')
          || payloadRow.organism === null || payloadRow.world === null) {
        return { valid: false, digest: null, bytes: 0, reasons: ['transfer-payload-invalid'] };
      }
      const integrity = ownDataRecord(row.integrity, ['algorithm', 'digest', 'bytes']);
      if (integrity.algorithm !== 'sha256' || typeof integrity.digest !== 'string'
          || !/^[a-f0-9]{64}$/u.test(integrity.digest) || !Number.isSafeInteger(integrity.bytes)
          || Number(integrity.bytes) < 0 || Number(integrity.bytes) > this.maxTransferBytes) {
        return { valid: false, digest: null, bytes: 0, reasons: ['transfer-integrity-invalid'] };
      }
      const normalized = normalizePortable({
        organism: payloadRow.organism,
        world: payloadRow.world,
        proceduralSkills: payloadRow.proceduralSkills,
      }, this.maxTransferBytes) as PortableJson;
      const unsigned = {
        schema: 'nk1.portable-cognitive-state',
        schemaVersion: 1,
        stateContract: 'nk1.persisted-organism-world-procedural-skills/v1',
        createdAt: Number(row.createdAt),
        source: { backendId: source.backendId as string | null, profileDigest: source.profileDigest as string | null },
        payload: normalized,
      };
      hydratePortableState((normalized as Record<string, PortableJson>).organism);
      hydratePortableState((normalized as Record<string, PortableJson>).world);
      hydratePortableState((normalized as Record<string, PortableJson>).proceduralSkills);
      const encoded = canonicalJson(unsigned as unknown as PortableJson);
      const bytes = Buffer.byteLength(encoded, 'utf8');
      const digest = sha256(encoded);
      const valid = bytes === Number(integrity.bytes) && digest === integrity.digest;
      return { valid, digest, bytes, reasons: valid ? [] : ['transfer-digest-mismatch'] };
    } catch (error) {
      return { valid: false, digest: null, bytes: 0, reasons: [error instanceof Error ? error.message : 'transfer-invalid'] };
    }
  }

  assessCompatibility(
    transfer: PortableCognitiveTransferV1,
    targetInput: SubstrateBackendProfile,
    options: { allowExternalBackend?: boolean } = {},
  ): { compatible: boolean; reindexRequired: boolean; targetBackendId: string; reasons: string[] } {
    const reasons: string[] = [];
    const integrity = this.verifyTransferPackage(transfer);
    if (!integrity.valid) reasons.push(...integrity.reasons);
    let target: SubstrateBackendProfile;
    try { target = profileSnapshot(targetInput); }
    catch (error) { return { compatible: false, reindexRequired: false, targetBackendId: '', reasons: [error instanceof Error ? error.message : 'target-profile-invalid'] }; }
    if (this.profiles.has(target.backendId) && profileDigest(this.profiles.get(target.backendId) ?? null) !== profileDigest(target)) {
      reasons.push('target-profile-registry-mismatch');
    }
    if (target.privacyClass !== 'local-only' && options.allowExternalBackend !== true) reasons.push('remote-backend-requires-explicit-consent');
    for (const capability of REQUIRED_CAPABILITIES) {
      if (!target.capabilities.includes(capability)) reasons.push('target-capability-missing:' + capability);
    }
    let reindexRequired = false;
    if (transfer?.source?.backendId) {
      const source = this.profiles.get(transfer.source.backendId);
      if (!transfer.source.profileDigest || !source || profileDigest(source) !== transfer.source.profileDigest) {
        reasons.push('source-profile-unavailable-or-changed');
      } else if (source.embeddingSpaceId && target.embeddingSpaceId && source.embeddingSpaceId !== target.embeddingSpaceId) {
        reindexRequired = true;
        reasons.push('embedding-reindex-required');
      }
    }
    return {
      compatible: reasons.length === 0,
      reindexRequired,
      targetBackendId: target.backendId,
      reasons,
    };
  }

  async evaluateMigration(input: {
    transfer: PortableCognitiveTransferV1;
    targetBackendId: string;
    trials: readonly SubstrateCalibrationTrial[];
    verifyTrial: (trial: SubstrateCalibrationTrial) => boolean | Promise<boolean>;
    allowExternalBackend?: boolean;
    evaluatedAt?: number;
  }): Promise<SubstrateMigrationEvaluation> {
    const integrity = this.verifyTransferPackage(input.transfer);
    const sourceBackendId = input.transfer?.source?.backendId;
    if (!integrity.valid || !sourceBackendId || !isSafeId(input.targetBackendId)) {
      fail('substrate-migration-transfer-or-endpoint-invalid');
    }
    if (typeof input.verifyTrial !== 'function') fail('substrate-calibration-verifier-required');
    const target = this.profiles.get(input.targetBackendId);
    if (!target) fail('substrate-target-profile-not-registered');
    const compatibility = this.assessCompatibility(input.transfer, target, { allowExternalBackend: input.allowExternalBackend });
    const reasons = [...compatibility.reasons];
    if (!Array.isArray(input.trials) || input.trials.length < this.minIndependentTrials || input.trials.length > 100) {
      reasons.push('calibration-insufficient-independent-trials');
    }
    const trials = (input.trials ?? []).map(normalizeTrial);
    const trialIds = new Set<string>();
    const independenceKeys = new Set<string>();
    const taskIds = new Set<string>();
    const receiptIds = new Set<string>();
    const taskFamilies = new Set<string>();
    for (const trial of trials) {
      if (trial.transferDigest !== integrity.digest) reasons.push('calibration-transfer-lineage-mismatch');
      if (trial.sourceBackendId !== sourceBackendId || trial.targetBackendId !== input.targetBackendId) {
        reasons.push('calibration-backend-lineage-mismatch');
      }
      if (trialIds.has(trial.trialId) || independenceKeys.has(trial.independenceKey)
          || taskIds.has(trial.taskId) || receiptIds.has(trial.evaluatorReceiptId)) {
        reasons.push('calibration-independence-collision');
      }
      trialIds.add(trial.trialId);
      independenceKeys.add(trial.independenceKey);
      taskIds.add(trial.taskId);
      receiptIds.add(trial.evaluatorReceiptId);
      taskFamilies.add(trial.taskFamily);
    }
    if (taskFamilies.size < this.minDistinctTaskFamilies) reasons.push('calibration-task-family-coverage-insufficient');

    let allReceiptsTrusted = true;
    for (const trial of trials) {
      try {
        if (await input.verifyTrial(trial) !== true) allReceiptsTrusted = false;
      } catch {
        allReceiptsTrusted = false;
      }
    }
    if (!allReceiptsTrusted) reasons.push('calibration-evidence-untrusted');

    const min = (key: keyof Pick<SubstrateCalibrationTrial,
      'taskSuccess01' | 'memoryRecall01' | 'goalFidelity01' | 'constraintFidelity01' | 'identityContinuity01' | 'toolContract01'>) =>
      trials.length ? Math.min(...trials.map((trial) => trial[key])) : 0;
    const ratios = trials.map((trial) => trial.targetLatencyMs / trial.sourceLatencyMs).sort((a, b) => a - b);
    const p95LatencyRatio = ratios.length ? ratios[Math.min(ratios.length - 1, Math.ceil(ratios.length * 0.95) - 1)] : Number.POSITIVE_INFINITY;
    const metrics = {
      minTaskSuccess01: min('taskSuccess01'),
      minMemoryRecall01: min('memoryRecall01'),
      minGoalFidelity01: min('goalFidelity01'),
      minConstraintFidelity01: min('constraintFidelity01'),
      minIdentityContinuity01: min('identityContinuity01'),
      minToolContract01: min('toolContract01'),
      p95LatencyRatio,
    };
    if (metrics.minTaskSuccess01 < 0.80) reasons.push('calibration-task-success-below-threshold');
    if (metrics.minMemoryRecall01 < 0.90) reasons.push('calibration-memory-recall-below-threshold');
    if (metrics.minGoalFidelity01 < 0.90) reasons.push('calibration-goal-fidelity-below-threshold');
    if (metrics.minConstraintFidelity01 < 0.95) reasons.push('calibration-constraint-fidelity-below-threshold');
    if (metrics.minIdentityContinuity01 < 0.85) reasons.push('calibration-identity-continuity-below-threshold');
    if (metrics.minToolContract01 < 0.98) reasons.push('calibration-tool-contract-below-threshold');
    if (metrics.p95LatencyRatio > this.maxLatencyRatio) reasons.push('calibration-latency-regression-above-threshold');

    const uniqueReasons = [...new Set(reasons)];
    const evaluatedAt = Number.isFinite(input.evaluatedAt) && Number(input.evaluatedAt) > 0 ? Number(input.evaluatedAt) : Date.now();
    const evaluationSeed = canonicalJson({
      transferDigest: integrity.digest!,
      targetBackendId: input.targetBackendId,
      trialIds: [...trialIds].sort(),
      taskIds: [...taskIds].sort(),
      receiptIds: [...receiptIds].sort(),
      independenceKeys: [...independenceKeys].sort(),
      reasons: uniqueReasons,
      metrics,
    } as unknown as PortableJson);
    const evaluation: SubstrateMigrationEvaluation = {
      evaluationId: 'substrate-eval-' + sha256(evaluationSeed).slice(0, 24),
      accepted: uniqueReasons.length === 0 && trials.length >= this.minIndependentTrials && taskFamilies.size >= this.minDistinctTaskFamilies,
      sourceBackendId,
      targetBackendId: input.targetBackendId,
      transferDigest: integrity.digest!,
      evaluatedAt,
      trialCount: trials.length,
      taskFamilyCount: taskFamilies.size,
      receipts: trials.map((trial) => structuredClone(trial)),
      metrics,
      reasons: uniqueReasons,
    };
    this.state.lastEvaluation = structuredClone(evaluation);
    if (evaluation.accepted) this.verifiedEvaluationIds.add(evaluation.evaluationId);
    else this.verifiedEvaluationIds.delete(evaluation.evaluationId);
    return evaluation;
  }

  recordImportedTransfer(transfer: PortableCognitiveTransferV1, targetBackendId: string, importedAt = Date.now()): SubstrateIndependenceState {
    const integrity = this.verifyTransferPackage(transfer);
    if (!integrity.valid || !isSafeId(targetBackendId) || !this.profiles.has(targetBackendId) || !Number.isFinite(importedAt) || importedAt <= 0) {
      fail('substrate-transfer-import-invalid');
    }
    this.state.pendingTransfer = {
      transferDigest: integrity.digest!,
      sourceBackendId: transfer.source.backendId,
      targetBackendId,
      importedAt,
    };
    this.state.lastEvaluation = null;
    this.verifiedEvaluationIds.clear();
    return this.snapshot();
  }

  async verifyStoredEvaluation(
    evaluationId: string,
    verifyTrial: (trial: SubstrateCalibrationTrial) => boolean | Promise<boolean>,
  ): Promise<boolean> {
    const evaluation = this.state.lastEvaluation;
    this.verifiedEvaluationIds.delete(evaluationId);
    if (!evaluation || !evaluation.accepted || evaluation.evaluationId !== evaluationId ||
        typeof verifyTrial !== 'function' || !Array.isArray(evaluation.receipts) ||
        evaluation.receipts.length !== evaluation.trialCount || evaluation.receipts.length < this.minIndependentTrials) {
      return false;
    }
    const taskIds = new Set<string>();
    const trialIds = new Set<string>();
    const receiptIds = new Set<string>();
    const independenceKeys = new Set<string>();
    const families = new Set<string>();
    let trusted = true;
    for (const trial of evaluation.receipts) {
      if (trial.transferDigest !== evaluation.transferDigest ||
          trial.sourceBackendId !== evaluation.sourceBackendId ||
          trial.targetBackendId !== evaluation.targetBackendId ||
          taskIds.has(trial.taskId) || trialIds.has(trial.trialId) ||
          receiptIds.has(trial.evaluatorReceiptId) || independenceKeys.has(trial.independenceKey)) {
        trusted = false;
      }
      taskIds.add(trial.taskId);
      trialIds.add(trial.trialId);
      receiptIds.add(trial.evaluatorReceiptId);
      independenceKeys.add(trial.independenceKey);
      families.add(trial.taskFamily);
      try { if (await verifyTrial(trial) !== true) trusted = false; }
      catch { trusted = false; }
    }
    const min = (key: keyof Pick<SubstrateCalibrationTrial,
      'taskSuccess01' | 'memoryRecall01' | 'goalFidelity01' | 'constraintFidelity01' | 'identityContinuity01' | 'toolContract01'>) =>
      evaluation.receipts.length ? Math.min(...evaluation.receipts.map((trial) => trial[key])) : 0;
    const ratios = evaluation.receipts.map((trial) => trial.targetLatencyMs / trial.sourceLatencyMs).sort((a, b) => a - b);
    const p95LatencyRatio = ratios.length ? ratios[Math.min(ratios.length - 1, Math.ceil(ratios.length * 0.95) - 1)] : Number.POSITIVE_INFINITY;
    const actualMetrics = {
      minTaskSuccess01: min('taskSuccess01'),
      minMemoryRecall01: min('memoryRecall01'),
      minGoalFidelity01: min('goalFidelity01'),
      minConstraintFidelity01: min('constraintFidelity01'),
      minIdentityContinuity01: min('identityContinuity01'),
      minToolContract01: min('toolContract01'),
      p95LatencyRatio,
    };
    const sameMetrics = Object.entries(actualMetrics).every(([key, value]) =>
      Object.is(value, evaluation.metrics[key as keyof typeof actualMetrics]));
    const acceptedByMetrics = actualMetrics.minTaskSuccess01 >= 0.80 &&
      actualMetrics.minMemoryRecall01 >= 0.90 &&
      actualMetrics.minGoalFidelity01 >= 0.90 &&
      actualMetrics.minConstraintFidelity01 >= 0.95 &&
      actualMetrics.minIdentityContinuity01 >= 0.85 &&
      actualMetrics.minToolContract01 >= 0.98 &&
      actualMetrics.p95LatencyRatio <= this.maxLatencyRatio;
    const valid = trusted && sameMetrics && acceptedByMetrics &&
      families.size >= this.minDistinctTaskFamilies &&
      families.size === evaluation.taskFamilyCount &&
      evaluation.receipts.length === evaluation.trialCount &&
      evaluation.reasons.length === 0;
    if (valid) this.verifiedEvaluationIds.add(evaluationId);
    return valid;
  }

  promoteBackend(targetBackendId: string, evaluationId: string): SubstrateIndependenceState {
    const evaluation = this.state.lastEvaluation;
    if (!this.verifiedEvaluationIds.has(evaluationId) || !evaluation || !evaluation.accepted || evaluation.evaluationId !== evaluationId
        || evaluation.targetBackendId !== targetBackendId) fail('substrate-promotion-evidence-required');
    const pending = this.state.pendingTransfer;
    const matchingPending = pending !== null
      && pending.targetBackendId === targetBackendId
      && pending.transferDigest === evaluation.transferDigest
      && pending.sourceBackendId === evaluation.sourceBackendId;
    if (!matchingPending && this.state.activeBackendId !== evaluation.sourceBackendId) {
      fail('substrate-promotion-source-no-longer-active');
    }
    if (pending && !matchingPending) fail('substrate-promotion-transfer-mismatch');
    this.verifiedEvaluationIds.delete(evaluationId);
    const fromBackendId = this.state.activeBackendId ?? evaluation.sourceBackendId;
    this.state.activeBackendId = targetBackendId;
    this.state.activeProvenance = 'calibrated';
    this.state.pendingTransfer = null;
    this.state.observedBackendId = targetBackendId;
    this.state.history = [...this.state.history, {
      at: Date.now(),
      fromBackendId,
      toBackendId: targetBackendId,
      transferDigest: evaluation.transferDigest,
      evaluationId: evaluation.evaluationId,
      reason: 'calibrated-promotion',
    }].slice(-64);
    return this.snapshot();
  }

  revokeUnverifiedPromotion(): SubstrateIndependenceState {
    if (this.state.activeProvenance !== 'calibrated') return this.snapshot();
    const last = this.state.history.at(-1);
    if (last?.reason === 'calibrated-promotion' &&
        last.toBackendId === this.state.activeBackendId &&
        last.fromBackendId) {
      return this.rollbackBackend();
    }
    this.state.activeBackendId = null;
    this.state.activeProvenance = 'unknown';
    this.state.observedBackendId = null;
    this.state.pendingTransfer = null;
    return this.snapshot();
  }

  rollbackBackend(): SubstrateIndependenceState {
    const last = this.state.history.at(-1);
    if (!last || last.reason !== 'calibrated-promotion' || last.toBackendId !== this.state.activeBackendId || !last.fromBackendId) {
      fail('substrate-rollback-source-unavailable');
    }
    this.verifiedEvaluationIds.delete(last.evaluationId);
    this.state.activeBackendId = last.fromBackendId;
    this.state.activeProvenance = this.profiles.has(last.fromBackendId) ? 'bootstrap' : 'unknown';
    this.state.observedBackendId = last.fromBackendId;
    this.state.history = [...this.state.history, {
      at: Date.now(),
      fromBackendId: last.toBackendId,
      toBackendId: last.fromBackendId,
      transferDigest: last.transferDigest,
      evaluationId: last.evaluationId,
      reason: 'rollback',
    }].slice(-64);
    return this.snapshot();
  }
}
