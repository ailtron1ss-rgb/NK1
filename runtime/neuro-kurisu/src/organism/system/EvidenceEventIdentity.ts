import { createHash } from 'node:crypto';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';
import { stableJson } from '../core/StableSerialization.ts';

/**
 * Creates a deterministic, domain-separated event key. The key supports
 * idempotency and cross-subsystem joins; it is never proof that an event is true.
 * Invalid or hostile input fails closed rather than producing a partial identity.
 */
export function createStableEvidenceEventId(namespace: string, identity: unknown): string | undefined {
  if (typeof namespace !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(namespace)) return undefined;
  try {
    const detached = snapshotPlainData(identity, {
      allowNonFiniteNumbers: true,
      maxDepth: 24,
      maxNodes: 16_384,
      maxStringUnits: 1024 * 1024,
    });
    const digest = createHash('sha256').update(stableJson(detached)).digest('hex').slice(0, 40);
    return `${namespace}:${digest}`;
  } catch {
    return undefined;
  }
}

/**
 * Derives a stable ID for an evidence projection from its upstream event,
 * projection role and discriminator. This is an idempotency key, not proof.
 */
export function createRealityEvidenceEventId(originEventId: string, role: string, discriminator: string): string {
  const validPart = (value: unknown, max: number): value is string =>
    typeof value === 'string' && value.length > 0 && value === value.trim() && value.length <= max &&
    !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f);
    });
  if (!validPart(originEventId, 256) || !validPart(discriminator, 256) ||
      typeof role !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(role)) {
    throw new TypeError('reality-evidence-event-identity-invalid');
  }
  const digest = createHash('sha256')
    .update(JSON.stringify(['nk1-reality-event-v1', originEventId, role, discriminator]))
    .digest('hex')
    .slice(0, 48);
  return `nk1-reality:${role}:${digest}`;
}
