import { snapshotPlainData } from './PlainDataSnapshot.ts';

/** Copy an untrusted persisted value into bounded plain data without executing getters. */
export function readRestorablePlainRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const copy = snapshotPlainData<unknown>(value, {
      maxDepth: 32,
      maxNodes: 50_000,
      maxStringUnits: 1_000_000,
    });
    if (copy === null || typeof copy !== 'object' || Array.isArray(copy)) return null;
    const prototype = Object.getPrototypeOf(copy);
    return prototype === Object.prototype || prototype === null
      ? copy as Record<string, unknown>
      : null;
  } catch {
    // Proxy traps, revoked proxies, accessors, cycles and unsupported objects fail closed.
    return null;
  }
}

export function restoredCounter(value: unknown, fallback = 0, maximum = 1_000_000_000_000): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, maximum)
    : fallback;
}

export function restoredMetric(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

export function restoredTimestamp(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

export function restoredText(value: unknown, fallback = '', maximum = 120): string {
  if (typeof value !== 'string') return fallback;
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum);
}
