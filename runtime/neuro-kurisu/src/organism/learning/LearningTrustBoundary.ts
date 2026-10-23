/**
 * Shared data/identity boundary for the learning subsystem.
 *
 * Callers must snapshot externally-owned values before reading fields or retaining
 * evidence. In-process snapshots complement, but do not replace, process isolation.
 */
/**
 * Detach JSON-like evidence without invoking caller-owned getters. structuredClone
 * is not a safe first read for arbitrary objects because it can execute getters.
 * Accessor properties, symbols, sparse arrays, proxies that break reflection,
 * non-plain instances, cycles, and non-finite numbers fail closed.
 */
const SNAPSHOT_MAX_DEPTH = 64;
const SNAPSHOT_MAX_NODES = 100_000;
const SNAPSHOT_MAX_TEXT_UNITS = 4 * 1024 * 1024;
type SnapshotBudget = { nodes: number; textUnits: number };
function snapshotPlainDataInner(
  value: unknown,
  ancestors = new Set<object>(),
  depth = 0,
  budget: SnapshotBudget,
): unknown {
  if (typeof value === 'string') {
    budget.textUnits += value.length;
    if (budget.textUnits > SNAPSHOT_MAX_TEXT_UNITS) {
      throw new Error('independent-evaluator-snapshot-size-limit');
    }
    return value;
  }
  if (value === null || typeof value === 'boolean') return value;
  if (value === undefined) return undefined;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('independent-evaluator-snapshot-non-finite-number');
    return value;
  }
  if (typeof value !== 'object') throw new Error('independent-evaluator-snapshot-unsupported-value');
  if (depth > SNAPSHOT_MAX_DEPTH || budget.nodes >= SNAPSHOT_MAX_NODES) {
    throw new Error('independent-evaluator-snapshot-size-limit');
  }
  budget.nodes++;
  if (ancestors.has(value)) throw new Error('independent-evaluator-snapshot-cycle');

  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array) {
    if (prototype !== Array.prototype) throw new Error('independent-evaluator-snapshot-array-prototype-invalid');
    const keys = Reflect.ownKeys(value);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = lengthDescriptor?.value;
    if (!lengthDescriptor || !Number.isSafeInteger(length) || length < 0 ||
        length > SNAPSHOT_MAX_NODES || keys.length !== length + 1) {
      throw new Error('independent-evaluator-snapshot-array-shape-invalid');
    }
    ancestors.add(value);
    try {
      const result: unknown[] = [];
      for (let i = 0; i < length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor || !('value' in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) {
          throw new Error('independent-evaluator-snapshot-array-entry-invalid');
        }
        result.push(snapshotPlainDataInner(descriptor.value, ancestors, depth + 1, budget));
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }

  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('independent-evaluator-snapshot-object-prototype-invalid');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length > SNAPSHOT_MAX_NODES) throw new Error('independent-evaluator-snapshot-size-limit');
  const result = Object.create(prototype === null ? null : Object.prototype) as Record<string, unknown>;
  ancestors.add(value);
  try {
    for (const key of keys) {
      if (typeof key !== 'string') throw new Error('independent-evaluator-snapshot-symbol-key-invalid');
      budget.textUnits += key.length;
      if (budget.textUnits > SNAPSHOT_MAX_TEXT_UNITS) {
        throw new Error('independent-evaluator-snapshot-size-limit');
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || descriptor.get || descriptor.set) {
        throw new Error('independent-evaluator-snapshot-accessor-invalid');
      }
      if (!descriptor.enumerable) continue;
      const copied = snapshotPlainDataInner(descriptor.value, ancestors, depth + 1, budget);
      // Keep the evaluator's canonical representation: undefined object values
      // are omitted, while undefined array entries canonicalize as null.
      if (copied === undefined) continue;
      Object.defineProperty(result, key, {
        value: copied, enumerable: true, configurable: true, writable: true,
      });
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

export function snapshotPlainData(value: unknown): unknown {
  return snapshotPlainDataInner(value, new Set<object>(), 0, { nodes: 0, textUnits: 0 });
}


export function isSafeLearningIdentity(value: unknown, maxLength = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength &&
    value.trim() === value && value.normalize('NFKC') === value &&
    !Array.from(value).some(character => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
    });
}

/**
 * Snapshot a provider envelope whose data is untrusted but which exposes a small,
 * explicit set of callable capabilities. Data fields are copied by descriptor only;
 * capability functions are retained by identity, never invoked here.
 */
export function snapshotPlainDataEnvelope(
  value: unknown,
  capabilityKeys: readonly string[] = [],
): { data: Record<string, unknown>; capabilities: Record<string, unknown> } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('learning-trust-envelope-not-object');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('learning-trust-envelope-prototype-invalid');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length > SNAPSHOT_MAX_NODES) throw new Error('learning-trust-envelope-size-limit');
  const data = Object.create(null) as Record<string, unknown>;
  const capabilities = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    if (typeof key !== 'string') throw new Error('learning-trust-envelope-symbol-key-invalid');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) {
      throw new Error('learning-trust-envelope-accessor-invalid');
    }
    if (capabilityKeys.includes(key)) {
      if (typeof descriptor.value !== 'function') throw new Error('learning-trust-envelope-capability-invalid');
      Object.defineProperty(capabilities, key, {
        value: descriptor.value, enumerable: true, configurable: true, writable: true,
      });
    } else {
      Object.defineProperty(data, key, {
        value: descriptor.value, enumerable: true, configurable: true, writable: true,
      });
    }
  }
  const detached = snapshotPlainData(data);
  if (!detached || typeof detached !== 'object' || Array.isArray(detached)) {
    throw new Error('learning-trust-envelope-data-invalid');
  }
  return { data: detached as Record<string, unknown>, capabilities };
}
