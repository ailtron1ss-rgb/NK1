import { SNAPSHOT_MAX_NODES, snapshotPlainData } from '../core/PlainDataSnapshot.ts';
export { snapshotPlainData } from '../core/PlainDataSnapshot.ts';

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
