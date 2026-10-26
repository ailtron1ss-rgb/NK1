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

function isSafeJsonTree(value, ancestors = new Set(), depth = 0, budget = { nodes: 0 }) {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || depth > 64 || ++budget.nodes > 100000) return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Array.isArray(value)) {
      const lengthDescriptor = descriptors.length;
      const length = lengthDescriptor && lengthDescriptor.value;
      if (!lengthDescriptor || !('value' in lengthDescriptor) || !Number.isSafeInteger(length) || length < 0 || length > 4096) return false;
      for (let index = 0; index < length; index++) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor) || !isSafeJsonTree(descriptor.value, ancestors, depth + 1, budget)) return false;
      }
      return Reflect.ownKeys(descriptors).every(key => key === 'length' || (typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < length));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    if (Reflect.ownKeys(value).some(key => typeof key !== 'string')) return false;
    for (const descriptor of Object.values(descriptors)) {
      if (!descriptor.enumerable || !('value' in descriptor) || !isSafeJsonTree(descriptor.value, ancestors, depth + 1, budget)) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    ancestors.delete(value);
  }
}

export const isValidHmxStageDigest = stage => {
  try {
    if (!isRecord(stage) || !isSafeJsonTree(stage) || typeof stage.digest !== 'string' || !/^[a-f0-9]{64}$/.test(stage.digest)) return false;
    if (typeof stage.exportId !== 'string' || !['port', 'duplicate', 'telepathy', 'analysis'].includes(stage.intent) ||
        !['additive', 'authoritative', 'deliberative', 'analysis_only'].includes(stage.strategy) ||
        !['staged', 'accepted', 'rejected', 'applied'].includes(stage.status)) return false;
    // The content digest intentionally excludes lifecycle fields so an accepted
    // stage can transition to applied without changing the reviewed payload hash.
    // But a persisted success receipt may never coexist with a non-applied status:
    // otherwise changing only status could re-enter the write path on replay.
    if (stage.status !== 'applied' && Object.hasOwn(stage, 'application') && stage.application !== undefined) return false;
    if (!isRecord(stage.sectionCounts) || !Array.isArray(stage.protectedSections) ||
        !Array.isArray(stage.conflicts) || !isRecord(stage.stagedSections)) return false;
    return computeHmxStageDigest(stage) === stage.digest;
  } catch {
    return false;
  }
};
