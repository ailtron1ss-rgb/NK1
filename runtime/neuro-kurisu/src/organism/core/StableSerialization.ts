import { createHash } from 'node:crypto';

/**
 * Deterministic serialization shared by integration adapters.
 *
 * `stableJson` retains JSON.stringify semantics (including omission of undefined
 * object properties and normal Date/toJSON behavior) while sorting object keys.
 * `stableLegacyJson` intentionally preserves the historical adapter fingerprint
 * format for old records: nested undefined values serialize as the literal token
 * "undefined". Keep it only where fingerprints already persisted in state rely
 * on that exact byte representation.
 */
function rejectCircularReferences(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value !== 'object') return;
  const object = value as object;
  if (ancestors.has(object)) throw new TypeError('Converting circular structure to JSON');
  ancestors.add(object);
  try {
    if (Array.isArray(value)) {
      for (const item of value) rejectCircularReferences(item, ancestors);
    } else {
      for (const key of Object.keys(value as Record<string, unknown>)) rejectCircularReferences((value as Record<string, unknown>)[key], ancestors);
    }
  } finally {
    ancestors.delete(object);
  }
}

export function stableJson(value: unknown): string {
  rejectCircularReferences(value);
  const serialized = JSON.stringify(value, (_key, candidate: unknown) => {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const object = candidate as Record<string, unknown>;
      return Object.fromEntries(Object.keys(object).sort().map((key) => [key, object[key]]));
    }
    return candidate;
  });
  if (serialized === undefined) throw new TypeError('Value is not JSON-serializable at the top level');
  return serialized;
}

/** Compatibility serializer for legacy digest formats; do not use for new APIs. */
export function stableLegacyJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? 'undefined' : serialized;
  }
  if (Array.isArray(value)) return `[${value.map(stableLegacyJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableLegacyJson(object[key])}`).join(',')}}`;
}

export function sha256Stable(value: unknown, format: 'json' | 'legacy' = 'json'): string {
  return createHash('sha256').update(format === 'legacy' ? stableLegacyJson(value) : stableJson(value)).digest('hex');
}
