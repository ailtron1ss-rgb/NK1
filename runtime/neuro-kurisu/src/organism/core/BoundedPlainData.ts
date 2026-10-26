/**
 * Shared trust boundary for small durable cognitive-state snapshots.
 *
 * Persisted state is expected to be a JSON-like data tree, not executable
 * object behavior. This validator rejects accessors, custom prototypes,
 * symbols, sparse/custom arrays, cycles/aliases, and excessive structure
 * before a caller reads fields or mutates live state.
 *
 * Non-finite numbers are intentionally permitted here because individual
 * schema parsers own the policy for rejecting or normalizing those values.
 */
export interface BoundedPlainDataLimits {
  /** Combined object/key budget. The validator always applies a hard cap. */
  maxNodes?: number;
  maxDepth?: number;
}

export function isBoundedPlainDataTree(value: unknown, limits: BoundedPlainDataLimits = {}): boolean {
  const maxNodes = Number.isSafeInteger(limits.maxNodes) && (limits.maxNodes as number) > 0
    ? Math.min(limits.maxNodes as number, 500_000) : 100_000;
  const maxDepth = Number.isSafeInteger(limits.maxDepth) && (limits.maxDepth as number) >= 0
    ? Math.min(limits.maxDepth as number, 64) : 32;
  const seen = new WeakSet<object>();
  const budget = { remaining: maxNodes };

  const visit = (current: unknown, depth: number): boolean => {
    if (current === null || current === undefined ||
        typeof current === 'string' || typeof current === 'boolean' ||
        typeof current === 'number') return true;
    if (typeof current !== 'object' || depth > maxDepth || budget.remaining <= 0) return false;
    if (seen.has(current)) return false;
    seen.add(current);
    budget.remaining -= 1;

    try {
      const array = Array.isArray(current);
      const prototype = Object.getPrototypeOf(current);
      if (array ? prototype !== Array.prototype
        : (prototype !== Object.prototype && prototype !== null)) return false;

      const keys = Reflect.ownKeys(current);
      budget.remaining -= keys.length;
      if (budget.remaining < 0) return false;

      let arrayLength = -1;
      if (array) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(current, 'length');
        if (!lengthDescriptor ||
            !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') ||
            !Number.isSafeInteger(lengthDescriptor.value) ||
            lengthDescriptor.value < 0) return false;
        arrayLength = lengthDescriptor.value as number;
        // Normal dense arrays have one own key per element plus the non-enumerable length.
        // This also rejects sparse arrays.
        if (keys.length !== arrayLength + 1) return false;
      }

      for (const key of keys) {
        if (typeof key !== 'string') return false;
        if (array && key === 'length') continue;
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor ||
            !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
            descriptor.enumerable !== true) return false;
        if (array &&
            (!/^(0|[1-9][0-9]*)$/.test(key) ||
             !Number.isSafeInteger(Number(key)) ||
             Number(key) >= arrayLength)) return false;
        if (!visit(descriptor.value, depth + 1)) return false;
      }
      return true;
    } catch {
      // Exotic host objects and failing reflection traps are not durable data.
      return false;
    }
  };

  return visit(value, 0);
}
