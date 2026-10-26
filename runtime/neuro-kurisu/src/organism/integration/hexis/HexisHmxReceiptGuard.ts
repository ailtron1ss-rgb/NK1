import { createHash } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Shared integrity gate for persisted HMX application receipts.
 *
 * This checksum detects accidental/torn state changes and binds a receipt to its
 * original stage/export/lineage. It is not a signature and does not authenticate a
 * store whose writer is maliciously able to rewrite both payload and digest.
 */
export function hasValidHmxApplicationReceipt(stageValue: unknown): boolean {
    if (!isRecord(stageValue) || stageValue.status !== 'applied') return false;
    const receipt: unknown = stageValue.application;
    if (!isRecord(receipt)) return false;
    const keys = [
        'version', 'exportId', 'sourceLineageId', 'stageId', 'stageDigest', 'attempt',
        'appliedAt', 'status', 'complete', 'candidateMemoryRecords', 'uniqueMemoryRecords',
        'importedCount', 'deduplicatedCount', 'projectedRelationships', 'deferredRelationships',
        'semanticEdgeIds', 'memoryIds', 'createdMemoryIds', 'deferredSections', 'warnings', 'digest',
    ];
    if (Object.keys(receipt).length !== keys.length || keys.some((key) => !Object.hasOwn(receipt, key))) return false;
    if (receipt.version !== 1 ||
        receipt.exportId !== stageValue.exportId ||
        receipt.sourceLineageId !== stageValue.sourceLineageId ||
        receipt.stageId !== stageValue.stagingId ||
        typeof stageValue.digest !== 'string' || receipt.stageDigest !== stageValue.digest ||
        !Number.isSafeInteger(receipt.attempt) || Number(receipt.attempt) < 1 ||
        !Number.isFinite(receipt.appliedAt) || Number(receipt.appliedAt) < 0 ||
        !['applied', 'partial', 'noop'].includes(String(receipt.status)) ||
        typeof receipt.complete !== 'boolean') return false;
    for (const field of [
        'candidateMemoryRecords', 'uniqueMemoryRecords', 'importedCount',
        'deduplicatedCount', 'projectedRelationships', 'deferredRelationships',
    ]) {
        if (!Number.isSafeInteger(receipt[field]) || Number(receipt[field]) < 0) return false;
    }
    for (const field of ['semanticEdgeIds', 'memoryIds', 'createdMemoryIds', 'warnings']) {
        if (!Array.isArray(receipt[field]) || !receipt[field].every((item: unknown) => typeof item === 'string')) return false;
    }
    if (!isRecord(receipt.deferredSections) ||
        Object.values(receipt.deferredSections).some((count: unknown) => !Number.isSafeInteger(count) || Number(count) < 0)) return false;
    try {
        const { digest: receiptDigest, ...base } = receipt;
        const serialized = JSON.stringify(base);
        return typeof receiptDigest === 'string' &&
            /^[a-f0-9]{64}$/.test(receiptDigest) &&
            typeof serialized === 'string' &&
            createHash('sha256').update(serialized).digest('hex') === receiptDigest;
    } catch {
        return false;
    }
}
