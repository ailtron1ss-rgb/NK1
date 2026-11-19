export type EvidenceLineageClass =
  | 'direct-observation'
  | 'corroborated'
  | 'inferred'
  | 'unverified'
  | 'model-generated'
  | 'memory-echo';

export interface EvidenceLineageProvenance {
  /** Stable identity of the original upstream source, not a generated row ID. */
  sourceId: string;
  /** Short source/channel label for audit and review. */
  sourceKind: string;
  /** Unix timestamp in milliseconds when the upstream evidence was captured. */
  capturedAt: number;
  /** Declared classification; only direct observations/corroborated evidence may enter canonical lineage. */
  evidenceClass: EvidenceLineageClass;
  /** Declared SHA-256 fingerprint of the source content. It is not, by itself, source authentication. */
  contentFingerprint: string;
}

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
const CLASSES = new Set<EvidenceLineageClass>([
  'direct-observation', 'corroborated', 'inferred', 'unverified', 'model-generated', 'memory-echo',
]);

/**
 * Copy a provenance envelope only when all fields are own data properties and
 * strictly bounded. Invalid/accessor-backed data fails closed instead of being
 * coerced into apparently valid evidence.
 */
export function normalizeEvidenceLineageProvenance(value: unknown): EvidenceLineageProvenance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const own = (key: keyof EvidenceLineageProvenance): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
        ? descriptor.value
        : undefined;
    };
    const sourceId = own('sourceId');
    const sourceKind = own('sourceKind');
    const capturedAt = own('capturedAt');
    const evidenceClass = own('evidenceClass');
    const contentFingerprint = own('contentFingerprint');
    if (typeof sourceId !== 'string' || !sourceId.trim() || sourceId !== sourceId.trim() ||
      sourceId.length > 192 || CONTROL.test(sourceId)) return null;
    if (typeof sourceKind !== 'string' || !sourceKind.trim() || sourceKind !== sourceKind.trim() ||
      sourceKind.length > 64 || CONTROL.test(sourceKind)) return null;
    if (typeof capturedAt !== 'number' || !Number.isSafeInteger(capturedAt) ||
      capturedAt < 0 || capturedAt > 8_640_000_000_000_000) return null;
    if (typeof evidenceClass !== 'string' || !CLASSES.has(evidenceClass as EvidenceLineageClass)) return null;
    if (typeof contentFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(contentFingerprint)) return null;
    return { sourceId, sourceKind, capturedAt, evidenceClass: evidenceClass as EvidenceLineageClass, contentFingerprint };
  } catch {
    return null;
  }
}
