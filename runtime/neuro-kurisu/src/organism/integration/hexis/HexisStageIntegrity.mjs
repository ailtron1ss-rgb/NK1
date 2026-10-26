import { createHash } from 'node:crypto';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const stableLegacyJson = value => {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? 'undefined' : serialized;
  }
  if (Array.isArray(value)) return '[' + value.map(stableLegacyJson).join(',') + ']';
  const object = value;
  return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + stableLegacyJson(object[key])).join(',') + '}';
};

const stagePayload = stage => ({
  exportId: stage.exportId,
  intent: stage.intent,
  strategy: stage.strategy,
  sourceSubjectId: stage.sourceSubjectId,
  sourceLineageId: stage.sourceLineageId,
  sectionCounts: stage.sectionCounts,
  protectedSections: stage.protectedSections,
  conflicts: stage.conflicts,
  stagedSections: stage.stagedSections,
});

export const computeHmxStageDigest = stage =>
  createHash('sha256').update(stableLegacyJson(stagePayload(stage))).digest('hex');

// Lifecycle transitions are intentionally sealed separately from the reviewed payload
// digest. This detects a persisted status-only rewrite (for example rejected -> accepted)
// without changing the payload identity as the stage moves through its normal states.
const stageLifecyclePayload = stage => ({
  stagingId: stage.stagingId,
  status: stage.status,
  applicationAttempts: stage.applicationAttempts ?? 0,
  applicationDigest: isRecord(stage.application) ? (stage.application.digest ?? null) : null,
});

export const computeHmxStageLifecycleDigest = stage =>
  createHash('sha256').update(stableLegacyJson(stageLifecyclePayload(stage))).digest('hex');

export const refreshHmxStageLifecycleDigest = stage => {
  // Older persisted staged records did not have the attempt counter. Normalize
  // that safe pre-review state before installing the new lifecycle seal.
  if (stage.applicationAttempts === undefined) stage.applicationAttempts = 0;
  stage.lifecycleDigest = computeHmxStageLifecycleDigest(stage);
  return stage.lifecycleDigest;
};

function isSafeJsonTreeNode(value, ancestors, depth, budget) {
  if (value === null || value === undefined || typeof value === 'boolean') return true;
  if (typeof value === 'string') {
    if (value.length > 1_000_000) return false;
    budget.stringChars += value.length;
    return budget.stringChars <= 80_000_000;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || depth > 64 || ++budget.nodes > 100000) return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  try {
    const arrayValue = Array.isArray(value);
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length > (arrayValue ? 4097 : 4096)) return false;
    if (!arrayValue && ownKeys.some(key => typeof key !== 'string')) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (arrayValue) {
      const lengthDescriptor = descriptors.length;
      const length = lengthDescriptor && lengthDescriptor.value;
      if (!lengthDescriptor || !('value' in lengthDescriptor) || !Number.isSafeInteger(length) || length < 0 || length > 4096) return false;
      for (let index = 0; index < length; index++) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor) || !isSafeJsonTreeNode(descriptor.value, ancestors, depth + 1, budget)) return false;
      }
      return Reflect.ownKeys(descriptors).every(key => key === 'length' || (typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < length));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    // Own keys are already bounded and checked before allocating all descriptors.
    for (const descriptor of Object.values(descriptors)) {
      if (!descriptor.enumerable || !('value' in descriptor) || !isSafeJsonTreeNode(descriptor.value, ancestors, depth + 1, budget)) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    ancestors.delete(value);
  }
}


export function isSafeJsonTree(value) {
  // Depth/node budgets are internal policy and cannot be weakened by JS callers.
  return isSafeJsonTreeNode(value, new Set(), 0, { nodes: 0, stringChars: 0 });
}

export const isValidHmxStageDigest = stage => {
  try {
    if (!isRecord(stage) || !isSafeJsonTree(stage) || typeof stage.digest !== 'string' || !/^[a-f0-9]{64}$/.test(stage.digest)) return false;
    if (typeof stage.exportId !== 'string' || !['port', 'duplicate', 'telepathy', 'analysis'].includes(stage.intent) ||
        !['additive', 'authoritative', 'deliberative', 'analysis_only'].includes(stage.strategy) ||
        !['staged', 'accepted', 'rejected', 'applied'].includes(stage.status)) return false;
    // The content digest intentionally excludes lifecycle fields so accepted/applied
    // transitions do not change the reviewed payload hash. Seal lifecycle separately.
    // Only never-reviewed legacy stages may be migrated without a seal; an old
    // accepted/rejected/applied stage cannot prove its prior lifecycle and must fail closed.
    if (stage.status !== 'applied' && Object.hasOwn(stage, 'application') && stage.application !== undefined) return false;
    if (!isRecord(stage.sectionCounts) || !Array.isArray(stage.protectedSections) ||
        !Array.isArray(stage.conflicts) || !isRecord(stage.stagedSections)) return false;
    if (Object.hasOwn(stage, 'lifecycleDigest')) {
      if (typeof stage.lifecycleDigest !== 'string' || !/^[a-f0-9]{64}$/.test(stage.lifecycleDigest) ||
          !Number.isSafeInteger(stage.applicationAttempts) || stage.applicationAttempts < 0 ||
          stage.applicationAttempts > 10000 ||
          computeHmxStageLifecycleDigest(stage) !== stage.lifecycleDigest) return false;
    } else {
      const legacyAttempts = stage.applicationAttempts;
      if (stage.status !== 'staged' ||
          (Object.hasOwn(stage, 'application') && stage.application !== undefined) ||
          (legacyAttempts !== undefined && legacyAttempts !== 0)) return false;
    }
    return computeHmxStageDigest(stage) === stage.digest;
  } catch {
    return false;
  }
};
