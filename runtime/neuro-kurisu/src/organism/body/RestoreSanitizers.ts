/**
 * Shared coercion helpers for restoring persisted body-subsystem state.
 *
 * A snapshot written to disk can be corrupted, truncated, hand-edited or written
 * by an older schema. Each restore() boundary must therefore rebuild live state
 * from validated primitives instead of spreading raw persisted values, which
 * would leak NaN, strings, out-of-range numbers and non-plain objects into the
 * running organism and poison every later metric that reads them.
 *
 * Persisted properties are read through own data descriptors only, so user
 * getters are never invoked. Proxy reflection traps may run when the runtime
 * inspects an object, but thrown traps are contained and cause a safe fallback.
 * They fail closed to a caller-supplied default.
 */

/** Read an own *data* property without triggering accessors; undefined otherwise. */
export function ownDataValue(record: unknown, key: string): unknown {
  if (!record || typeof record !== 'object') return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ? descriptor.value
      : undefined;
  } catch {
    // Hostile Proxy reflection traps must not escape the restore boundary.
    return undefined;
  }
}

/** True only for a plain data record (Object.prototype or null prototype). */
export function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  try {
    if (Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/** Finite number inside [min, max], else fallback. Rejects NaN/Infinity/strings. */
export function finiteOr(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value < min ? min : value > max ? max : value;
}

/** Finite unit value inside [0, 1], else fallback. */
export function unitOr(value: unknown, fallback: number): number {
  return finiteOr(value, fallback, 0, 1);
}

/** Non-negative safe integer, else fallback. */
export function countOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

/** Non-negative finite number, else fallback (timestamps, ms clocks). */
export function timestampOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Non-empty bounded string, else fallback. */
export function stringOr(value: unknown, fallback: string, maxLength = 256): string {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, maxLength) : fallback;
}

/** One of an allow-list, else fallback. */
export function enumOr<T extends string>(value: unknown, allowed: ReadonlySet<T>, fallback: T): T {
  return typeof value === 'string' && allowed.has(value as T) ? value as T : fallback;
}
