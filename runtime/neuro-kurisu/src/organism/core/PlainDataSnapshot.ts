/** Shared bounded plain-data snapshotter for core and learning evidence. */
const SNAPSHOT_MAX_DEPTH = 64;
export const SNAPSHOT_MAX_NODES = 100_000;
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


