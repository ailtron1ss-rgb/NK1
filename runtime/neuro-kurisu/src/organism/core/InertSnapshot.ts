import { types as nodeUtilTypes } from 'node:util';

export interface InertSnapshotLimits {
  maxDepth?: number;
  maxProperties?: number;
  /** Preserve NaN/Infinity as inert primitives only for owners that normalize every numeric field after cloning. */
  allowNonFiniteNumbers?: boolean;
}

/**
 * Clone a JSON-like snapshot without invoking attacker-controlled getters,
 * setters, toJSON methods or Proxy traps.
 *
 * Only plain objects and dense ordinary arrays are accepted. The result is a
 * fresh data-only tree, so consumers may safely read it with normal property
 * access after this boundary. Persisted snapshots are not host attestations.
 */
export function cloneInertSnapshot<T = unknown>(
  input: unknown,
  limits: InertSnapshotLimits = {},
): T {
  const maxDepth = limits.maxDepth ?? 16;
  const maxProperties = limits.maxProperties ?? 65_536;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1 || maxDepth > 64 ||
      !Number.isSafeInteger(maxProperties) || maxProperties < 1 || maxProperties > 1_000_000) {
    throw new Error('inert-snapshot-limits-invalid');
  }

  const active = new Set<object>();
  let propertyCount = 0;
  const invalid = (): never => { throw new Error('inert-snapshot-invalid'); };

  const visit = (value: unknown, depth: number): unknown => {
    if (depth > maxDepth) return invalid();
    if (value === null || value === undefined ||
        typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      return Number.isFinite(value) || limits.allowNonFiniteNumbers === true ? value : invalid();
    }
    if (typeof value !== 'object' || nodeUtilTypes.isProxy(value)) return invalid();
    if (active.has(value)) return invalid();

    active.add(value);
    try {
      if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) return invalid();
        const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
        const lengthDescriptor = descriptors.length;
        if (!lengthDescriptor ||
            !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') ||
            lengthDescriptor.get !== undefined || lengthDescriptor.set !== undefined ||
            lengthDescriptor.enumerable !== false) return invalid();
        const length = lengthDescriptor.value;
        if (!Number.isSafeInteger(length) || length < 0 || length > maxProperties) return invalid();

        const keys = Reflect.ownKeys(descriptors);
        // Dense arrays have exactly one own descriptor per index plus length.
        // This also rejects symbol properties and sparse arrays.
        if (keys.length !== length + 1) return invalid();

        const output: unknown[] = [];
        for (let index = 0; index < length; index += 1) {
          const key = String(index);
          const descriptor = descriptors[key];
          if (!descriptor ||
              !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
              descriptor.get !== undefined || descriptor.set !== undefined ||
              descriptor.enumerable !== true) return invalid();
          propertyCount += 1;
          if (propertyCount > maxProperties) return invalid();
          output.push(visit(descriptor.value, depth + 1));
        }
        return output;
      }

      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) return invalid();
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const keys = Reflect.ownKeys(descriptors);
      if (keys.length > maxProperties) return invalid();

      const output: Record<string, unknown> = {};
      for (const key of keys) {
        if (typeof key !== 'string' ||
            key === '__proto__' || key === 'prototype' || key === 'constructor') return invalid();
        const descriptor = descriptors[key];
        if (!descriptor ||
            !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
            descriptor.get !== undefined || descriptor.set !== undefined ||
            descriptor.enumerable !== true) return invalid();
        propertyCount += 1;
        if (propertyCount > maxProperties) return invalid();
        output[key] = visit(descriptor.value, depth + 1);
      }
      return output;
    } catch (error) {
      if (error instanceof Error && error.message === 'inert-snapshot-invalid') throw error;
      return invalid();
    } finally {
      active.delete(value);
    }
  };

  return visit(input, 0) as T;
}
