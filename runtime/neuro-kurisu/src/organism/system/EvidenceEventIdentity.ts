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
  let detached: unknown;
  try {
    detached = snapshotPlainData(identity, {
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
