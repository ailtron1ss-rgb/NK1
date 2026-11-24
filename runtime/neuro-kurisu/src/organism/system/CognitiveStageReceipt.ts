import { types as nodeUtilTypes } from 'node:util';

export type CognitiveStageOwnerName = 'attention' | 'memory';
export type CognitiveStageReceiptStatus =
  | 'completed'
  | 'completed_empty'
  | 'skipped'
  | 'deferred'
  | 'degraded'
  | 'failed'
  | 'cancelled';

export interface CognitiveStageReceipt {
  id: string;
  cycleId: string;
  tick: number;
  stage: CognitiveStageOwnerName;
  owner: 'OrganismCore.attend' | 'MemoryFabric.retrieveForCognition';
  status: CognitiveStageReceiptStatus;
  inputRefs: string[];
  outputRefs: string[];
  consumedStageReceipts: string[];
  outputHash?: string;
}

export interface CognitiveCycleStageEvidence {
  tick: number;
  cycleId: string;
  receipts: CognitiveStageReceipt[];
  attention: {
    timing: 'pre-decision';
    target: string;
    reason: string;
    salience: number;
    confidence: number;
    budget: number;
    inhibited: string[];
    switchedAt: number;
  };
  memory: {
    enabled: boolean;
    queryKind: 'observation-text' | 'active-goal-fallback' | 'context-fallback';
    queryDigest: string;
    status: 'completed' | 'completed_empty' | 'skipped';
    retrievedMemoryIds: string[];
    retrievedCount: number;
    requestedLimit: number;
    meanConfidence01: number;
  };
}

type ExpectedReceipt = { tick?: number; stage?: CognitiveStageOwnerName };
type ValidationResult =
  | { ok: true; receipt: CognitiveStageReceipt }
  | { ok: false; issues: string[] };

const OWNERS: Record<CognitiveStageOwnerName, CognitiveStageReceipt['owner']> = {
  attention: 'OrganismCore.attend',
  memory: 'MemoryFabric.retrieveForCognition',
};
const STATUSES = new Set<CognitiveStageReceiptStatus>([
  'completed', 'completed_empty', 'skipped', 'deferred', 'degraded', 'failed', 'cancelled',
]);
const FIELDS = new Set([
  'id', 'cycleId', 'tick', 'stage', 'owner', 'status',
  'inputRefs', 'outputRefs', 'consumedStageReceipts', 'outputHash',
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function readStringArray(value: unknown, label: string, maximum: number, issues: string[]): string[] {
  if (!Array.isArray(value) || nodeUtilTypes.isProxy(value)) {
    issues.push(label + '-not-array');
    return [];
  }
  let descriptors: Record<string, PropertyDescriptor>;
  let length: number;
  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      issues.push(label + '-non-plain-array');
      return [];
    }
    descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    length = descriptors.length?.value;
  } catch {
    issues.push(label + '-array-unreadable');
    return [];
  }
  if (!Number.isSafeInteger(length) || length < 0 || length > maximum ||
      Reflect.ownKeys(descriptors).length !== length + 1) {
    issues.push(label + '-array-shape-invalid');
    return [];
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
        descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable ||
        typeof descriptor.value !== 'string') {
      issues.push(label + '-entry-invalid');
      continue;
    }
    const item = descriptor.value.trim();
    if (!item || item.length > 180 || seen.has(item)) {
      issues.push(label + '-entry-invalid');
      continue;
    }
    seen.add(item);
    result.push(item);
  }
  return result;
}

/** Strictly validate the owner receipt before it is projected into CEF. */
export function validateCognitiveStageReceipt(value: unknown, expected: ExpectedReceipt = {}): ValidationResult {
  const issues: string[] = [];
  if (!isPlainRecord(value)) return { ok: false, issues: ['receipt-not-plain-record'] };

  let descriptors: Record<string, PropertyDescriptor>;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
  } catch {
    return { ok: false, issues: ['receipt-unreadable'] };
  }
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !FIELDS.has(key)) issues.push('receipt-unknown-field');
    const descriptor = typeof key === 'string' ? descriptors[key] : undefined;
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
        descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) {
      issues.push('receipt-accessor-or-non-enumerable-field');
    }
  }

  const read = (key: string): unknown => {
    const descriptor = descriptors[key];
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
  };
  const id = read('id');
  const cycleId = read('cycleId');
  const tick = read('tick');
  const stage = read('stage');
  const owner = read('owner');
  const status = read('status');
  if (typeof id !== 'string' || !id.trim() || id.length > 180) issues.push('receipt-id-invalid');
  if (typeof cycleId !== 'string' || !cycleId.trim() || cycleId.length > 180) issues.push('receipt-cycle-id-invalid');
  if (typeof tick !== 'number' || !Number.isSafeInteger(tick) || tick < 0) issues.push('receipt-tick-invalid');
  if (stage !== 'attention' && stage !== 'memory') issues.push('receipt-stage-invalid');
  if (stage === 'attention' || stage === 'memory') {
    if (owner !== OWNERS[stage]) issues.push('receipt-owner-invalid');
  }
  if (typeof status !== 'string' || !STATUSES.has(status as CognitiveStageReceiptStatus)) issues.push('receipt-status-invalid');
  if (expected.tick !== undefined && tick !== expected.tick) issues.push('receipt-tick-mismatch');
  if (expected.stage !== undefined && stage !== expected.stage) issues.push('receipt-stage-mismatch');

  const inputRefs = readStringArray(read('inputRefs'), 'input-refs', 16, issues);
  const outputRefs = readStringArray(read('outputRefs'), 'output-refs', 32, issues);
  const consumedStageReceipts = readStringArray(read('consumedStageReceipts'), 'consumed-receipts', 16, issues);
  const outputHash = read('outputHash');
  if (outputHash !== undefined && (typeof outputHash !== 'string' || !/^[a-f0-9]{64}$/i.test(outputHash))) {
    issues.push('receipt-output-hash-invalid');
  }
  if (status === 'completed' && outputRefs.length === 0) issues.push('completed-receipt-has-no-output');
  if (status === 'completed_empty' && (stage !== 'memory' || outputRefs.length !== 0)) issues.push('completed-empty-receipt-invalid');
  if (status === 'skipped' && (stage !== 'memory' || outputRefs.length !== 0)) issues.push('skipped-receipt-invalid');

  if (issues.length) return { ok: false, issues: [...new Set(issues)] };
  return {
    ok: true,
    receipt: {
      id: id as string,
      cycleId: cycleId as string,
      tick: tick as number,
      stage: stage as CognitiveStageOwnerName,
      owner: owner as CognitiveStageReceipt['owner'],
      status: status as CognitiveStageReceiptStatus,
      inputRefs,
      outputRefs,
      consumedStageReceipts,
      ...(typeof outputHash === 'string' ? { outputHash } : {}),
    },
  };
}
