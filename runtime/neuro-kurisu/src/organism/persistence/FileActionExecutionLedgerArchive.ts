import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { sha256Stable, stableJson } from '../core/StableSerialization.ts';
import type { ActionExecutionLedgerArchiveMetadata, ActionExecutionLedgerEntry } from '../system/ActionGateway.ts';

type ArchiveLine = { version: 1; entry: ActionExecutionLedgerEntry; digest: string };
type ArchiveIndexEntry = ActionExecutionLedgerArchiveMetadata & {
  offset: number;
  length: number;
  digest: string;
};

const REVISION_ELIGIBLE_OUTCOMES = new Set([
  'execution-failed', 'executed-unverified', 'executed-contradicted', 'executed-partial', 'idempotency-recovery-required',
]);
const EXECUTOR_ENTERED_OUTCOMES = new Set([
  ...REVISION_ELIGIBLE_OUTCOMES, 'failed-no-effect', 'executed-verified',
]);

function metadataFromEntry(entry: ActionExecutionLedgerEntry): Omit<ArchiveIndexEntry, 'offset' | 'length' | 'digest'> {
  return {
    keyHash: entry.keyHash,
    requestHash: entry.requestHash,
    status: 'completed',
    executionId: entry.executionId,
    toolId: entry.toolId,
    decisionId: entry.decisionId,
    recordedAt: entry.recordedAt,
    outcomeClass: entry.response?.outcomeClass,
    verified: entry.response?.verified,
    reconciled: entry.response?.reconciled,
  };
}

function needsReconciliation(entry: Pick<ArchiveIndexEntry, 'status' | 'outcomeClass' | 'verified'>): boolean {
  return entry.status === 'completed'
    && entry.outcomeClass !== 'failed-no-effect'
    && typeof entry.outcomeClass === 'string'
    && EXECUTOR_ENTERED_OUTCOMES.has(entry.outcomeClass)
    && entry.verified !== true;
}

/**
 * Append-only spill archive for completed action receipts. Only keys and byte offsets
 * stay resident; full receipts are read from disk on replay. Authoritative reconciliation
 * may append a narrowly validated revision for the same execution. A torn final line is
 * truncated, while corruption of a newline-terminated record fails closed.
 */
export class FileActionExecutionLedgerArchive {
  private readonly index = new Map<string, ArchiveIndexEntry>();
  private loaded = false;
  private fileBytes = 0;
  private readonly filePath: string;
  constructor(filePath: string) { this.filePath = filePath; }

  async load(): Promise<void> {
    if (this.loaded) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    const createHandle = await open(this.filePath, 'a');
    try { await createHandle.sync(); } finally { await createHandle.close(); }
    const handle = await open(this.filePath, 'r+');
    let fileSize = 0;
    try { fileSize = (await handle.stat()).size; } catch { fileSize = 0; }
    let fileOffset = 0;
    let lineStartOffset = 0;
    let lineBytes: number[] = [];
    const maxLineBytes = 128 * 1024;
    const chunkSize = 64 * 1024;
    const decoder = new TextDecoder();
    try {
      while (fileOffset < fileSize) {
        const chunk = new Uint8Array(Math.min(chunkSize, fileSize - fileOffset));
        const { bytesRead } = await handle.read(chunk, 0, chunk.length, fileOffset);
        if (!bytesRead) break;
        for (let i = 0; i < bytesRead; i += 1) {
          const byte = chunk[i];
          if (byte !== 0x0a) {
            lineBytes.push(byte);
            if (lineBytes.length > maxLineBytes) throw new Error('action-ledger-archive-record-too-large');
            continue;
          }
          const length = lineBytes.length;
          const line = decoder.decode(new Uint8Array(lineBytes));
          if (line.trim()) {
            const parsed = this.parseLine(line);
            const existing = this.index.get(parsed.entry.keyHash);
            if (existing) {
              if (existing.requestHash !== parsed.entry.requestHash) throw new Error('action-ledger-archive-key-conflict');
              if (existing.digest !== parsed.digest) {
                if (!this.canSupersede(existing, parsed.entry)) throw new Error('action-ledger-archive-key-conflict');
                this.index.set(parsed.entry.keyHash, this.indexRecord(parsed.entry, lineStartOffset, length, parsed.digest));
              }
            } else {
              this.index.set(parsed.entry.keyHash, this.indexRecord(parsed.entry, lineStartOffset, length, parsed.digest));
            }
          }
          lineBytes = [];
          lineStartOffset = fileOffset + i + 1;
        }
        fileOffset += bytesRead;
      }
      // Only an unterminated trailing fragment is recoverable. Complete invalid lines throw above.
      if (lineBytes.length > 0) {
        await handle.truncate(lineStartOffset);
        await handle.sync();
        fileSize = lineStartOffset;
      }
    } finally { await handle.close(); }
    this.fileBytes = fileSize;
    this.loaded = true;
  }

  async get(keyHash: string): Promise<ActionExecutionLedgerEntry | undefined> {
    this.assertLoaded();
    const indexed = this.index.get(keyHash);
    if (!indexed) return undefined;
    const handle = await open(this.filePath, 'r');
    try {
      const buffer = new Uint8Array(indexed.length);
      const { bytesRead } = await handle.read(buffer, 0, indexed.length, indexed.offset);
      if (bytesRead !== indexed.length) throw new Error('action-ledger-archive-short-read');
      const line = new TextDecoder().decode(buffer);
      const parsed = this.parseLine(line);
      if (parsed.entry.keyHash !== keyHash || parsed.digest !== indexed.digest) throw new Error('action-ledger-archive-index-mismatch');
      return structuredClone(parsed.entry);
    } finally { await handle.close(); }
  }

  async append(entry: ActionExecutionLedgerEntry): Promise<void> {
    this.assertLoaded();
    this.assertCompleted(entry);
    const jsonEntry = JSON.parse(JSON.stringify(entry)) as ActionExecutionLedgerEntry;
    const existing = this.index.get(jsonEntry.keyHash);
    const normalizedDigest = sha256Stable(jsonEntry);
    if (existing) {
      if (existing.requestHash !== jsonEntry.requestHash || existing.digest !== normalizedDigest) throw new Error('action-ledger-archive-key-conflict');
      return;
    }
    await this.appendLine(jsonEntry, normalizedDigest);
  }

  /**
   * Appends a new immutable receipt revision only when the archived version is still
   * unresolved and the new version is an authoritative reconciliation of the same
   * execution. This cannot rewrite a verified/terminal receipt or bind a new request.
   */
  async appendRevision(entry: ActionExecutionLedgerEntry): Promise<void> {
    this.assertLoaded();
    this.assertCompleted(entry);
    const jsonEntry = JSON.parse(JSON.stringify(entry)) as ActionExecutionLedgerEntry;
    const existing = await this.get(jsonEntry.keyHash);
    if (!existing) return this.append(jsonEntry);
    const normalizedDigest = sha256Stable(jsonEntry);
    const indexed = this.index.get(jsonEntry.keyHash)!;
    if (indexed.digest === normalizedDigest) return;
    if (!this.canSupersede(indexed, jsonEntry)) throw new Error('action-ledger-archive-revision-not-authorized');
    await this.appendLine(jsonEntry, normalizedDigest);
  }

  metadataFor(keyHash: string): ActionExecutionLedgerArchiveMetadata | undefined {
    this.assertLoaded();
    const row = this.index.get(keyHash);
    if (!row) return undefined;
    const { offset: _offset, length: _length, digest: _digest, ...metadata } = row;
    return { ...metadata };
  }

  unresolvedEntries(): ActionExecutionLedgerArchiveMetadata[] {
    this.assertLoaded();
    const rows: ActionExecutionLedgerArchiveMetadata[] = [];
    for (const row of this.index.values()) {
      if (!needsReconciliation(row)) continue;
      const { offset: _offset, length: _length, digest: _digest, ...metadata } = row;
      rows.push({ ...metadata });
    }
    return rows;
  }

  metrics(): { entries: number; bytes: number; loaded: boolean } { return { entries: this.index.size, bytes: this.fileBytes, loaded: this.loaded }; }

  private async appendLine(entry: ActionExecutionLedgerEntry, digest: string): Promise<void> {
    const line = stableJson({ version: 1, entry, digest } satisfies ArchiveLine);
    const lineBuffer = new TextEncoder().encode(`${line}\n`);
    const handle = await open(this.filePath, 'a');
    let offset: number;
    try {
      offset = (await handle.stat()).size;
      let written = 0;
      while (written < lineBuffer.length) {
        const result = await handle.write(lineBuffer.subarray(written));
        const bytesWritten = typeof result === 'number' ? result : result?.bytesWritten;
        if (!bytesWritten) throw new Error('action-ledger-archive-zero-write');
        written += bytesWritten;
      }
      await handle.sync();
    } finally { await handle.close(); }
    this.index.set(entry.keyHash, this.indexRecord(entry, offset, lineBuffer.length - 1, digest));
    this.fileBytes += lineBuffer.length;
  }

  private indexRecord(entry: ActionExecutionLedgerEntry, offset: number, length: number, digest: string): ArchiveIndexEntry {
    return { ...metadataFromEntry(entry), offset, length, digest };
  }

  private canSupersede(previous: ArchiveIndexEntry, next: ActionExecutionLedgerEntry): boolean {
    const response = next.response;
    const hasAuthoritativeEvidence = response?.reconciled === true
      && ((response.idempotencyStatus === 'reconciled'
          && typeof response.providerReceiptId === 'string'
          && response.providerReceiptId.trim().length > 0
          && response.providerReceiptId.length <= 180
          && !/[\u0000-\u001f\u007f]/.test(response.providerReceiptId))
        || (response.idempotencyStatus === 'confirmed-not-executed'
          && response.outcomeClass === 'reconciled-not-executed'));
    return next.keyHash === previous.keyHash
      && next.requestHash === previous.requestHash
      && Boolean(next.executionId)
      && next.executionId === previous.executionId
      && Boolean(next.toolId)
      && next.toolId === previous.toolId
      && previous.status === 'completed'
      && previous.verified !== true
      && typeof previous.outcomeClass === 'string'
      && REVISION_ELIGIBLE_OUTCOMES.has(previous.outcomeClass)
      && hasAuthoritativeEvidence
      && Number.isFinite(next.recordedAt)
      && next.recordedAt >= previous.recordedAt;
  }

  private assertCompleted(entry: ActionExecutionLedgerEntry): void {
    if (entry.status !== 'completed' || !entry.response) throw new Error('only-completed-receipts-may-be-archived');
  }

  private parseLine(line: string): ArchiveLine {
    let parsed: any;
    try { parsed = JSON.parse(line); } catch { throw new Error('action-ledger-archive-invalid-json'); }
    if (parsed?.version !== 1 || !parsed.entry || typeof parsed.entry !== 'object' || parsed.entry.status !== 'completed') throw new Error('action-ledger-archive-invalid-record');
    const entry = parsed.entry as ActionExecutionLedgerEntry;
    if (!/^[a-f0-9]{64}$/i.test(String(entry.keyHash ?? '')) || !/^[a-f0-9]{64}$/i.test(String(entry.requestHash ?? '')) || !entry.response || typeof entry.response !== 'object') throw new Error('action-ledger-archive-invalid-entry');
    const digest = sha256Stable(entry);
    if (digest !== parsed.digest) throw new Error('action-ledger-archive-checksum-mismatch');
    return { version: 1, entry, digest };
  }

  private assertLoaded(): void { if (!this.loaded) throw new Error('action-ledger-archive-not-loaded'); }
}
