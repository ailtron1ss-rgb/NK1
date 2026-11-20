import { types } from 'node:util';

/** Shared coercion helpers for restoring persisted body-subsystem state. */
const MAX_RESTORE_RECORD_KEYS = 256;

/** Read an own data property without invoking getters or Proxy traps. */
export function ownDataValue(record: unknown, key: string): unknown {
  if (!record || typeof record !== 'object' || types.isProxy(record)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
  } catch { return undefined; }
}

/** Plain, bounded object containing only own data properties. */
export function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_RESTORE_RECORD_KEYS || keys.some(key => typeof key !== 'string')) return false;
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.get !== undefined || descriptor.set !== undefined) return false;
    }
    return true;
  } catch { return false; }
}

/** Dense native array of own data slots; sparse, Proxy and accessor arrays fail closed. */
export function isPlainDataArray(value: unknown, maxLength = 4096): value is unknown[] {
  if (types.isProxy(value) || !Array.isArray(value)) return false;
  try {
    const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > maxLength) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1) return false;
    for (const key of keys) {
      if (key === 'length') continue;
      if (typeof key !== 'string') return false;
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index < 0 || String(index) !== key || index >= length) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.get !== undefined || descriptor.set !== undefined) return false;
    }
    return true;
  } catch { return false; }
}

/** Finite number inside [min, max], else fallback. */
export function finiteOr(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value < min ? min : value > max ? max : value;
}
export function unitOr(value: unknown, fallback: number): number { return finiteOr(value, fallback, 0, 1); }
export function countOr(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback; }
export function timestampOr(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback; }
export function stringOr(value: unknown, fallback: string, maxLength = 256): string { return typeof value === 'string' && value.length > 0 ? value.slice(0, maxLength) : fallback; }
export function enumOr<T extends string>(value: unknown, allowed: ReadonlySet<T>, fallback: T): T { return typeof value === 'string' && allowed.has(value as T) ? value as T : fallback; }
