import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
type ContinuityFileHandle = Awaited<ReturnType<typeof open>>;

export interface ContinuityFrame {
  at: number;
  tick: number;
  stage: string;
  action: string;
  energy01: number;
  uncertainty01: number;
  predictionError01: number;
  selfPredictionError01: number;
  identityContinuity01: number;
  memoryCount: number;
  goalCount: number;
  stateBytes: number;
  replaySignature: string;
}

export interface ContinuityLedgerMetrics {
  writes: number;
  bytesWritten: number;
  frames: number;
  lastWriteMs: number;
  lastAt: number;
}

export interface ContinuityLedgerDiagnostics {
  open: boolean;
  pendingLines: number;
  pendingBytes: number;
  recoveredTailBytes: number;
  retentionDroppedFrames: number;
  lastError: string | null;
  lastDurabilityWarning: string | null;
}

type PersistBatchResult = { durationMs: number; bytesWritten: number };

/**
 * Compact longitudinal journal. It intentionally stores diagnostics, not the
 * organism state, so it can remain cheap on a phone while making drift and
 * checkpoint behaviour observable over weeks.
 *
 * The journal is append-only between bounded-retention compactions. Every flush
 * drains a captured batch; concurrent records are kept for the next batch. A
 * torn final JSONL fragment is discarded on reopen, while complete earlier
 * frames remain intact.
 */
export class ContinuityLedger {
  private readonly filePath: string;
  private readonly maxBytes: number;
  private readonly flushEveryFrames: number;
  private readonly rollbackMarkerPath: string;
  private pendingLines: string[] = [];
  private pendingBytes = 0;
  private stats: ContinuityLedgerMetrics = { writes: 0, bytesWritten: 0, frames: 0, lastWriteMs: 0, lastAt: 0 };
  private handle: ContinuityFileHandle | null = null;
  private flushInFlight: Promise<void> | null = null;
  private recoveredTailBytes = 0;
  private retentionDroppedFrames = 0;
  private lastError: string | null = null;
  private lastDurabilityWarning: string | null = null;

  constructor(filePath: string, maxBytes = 4 * 1024 * 1024, flushEveryFrames = 4) {
    this.filePath = filePath;
    this.rollbackMarkerPath = filePath + '.rollback';
    this.maxBytes = Math.max(64 * 1024, Math.floor(maxBytes));
    this.flushEveryFrames = Math.max(1, Math.min(16, Math.floor(flushEveryFrames)));
  }

  metrics(): ContinuityLedgerMetrics { return { ...this.stats }; }

  private async readRollbackMarker(): Promise<number | null> {
    let raw: string;
    try {
      raw = await readFile(this.rollbackMarkerPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
      throw error;
    }

    let marker: unknown;
    try {
      marker = JSON.parse(raw);
    } catch {
      throw new Error('continuity-ledger-rollback-marker-invalid');
    }
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)) {
      throw new Error('continuity-ledger-rollback-marker-invalid');
    }
    const record = marker as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.length !== 2 || keys[0] !== 'rollbackSize' || keys[1] !== 'version' ||
        record.version !== 1 || !Number.isSafeInteger(record.rollbackSize) ||
        (record.rollbackSize as number) < 0) {
      throw new Error('continuity-ledger-rollback-marker-invalid');
    }
    return record.rollbackSize as number;
  }

  private async syncJournalDirectory(): Promise<void> {
    const directoryHandle = await open(dirname(this.filePath), 'r');
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  }

  private async writeRollbackMarker(rollbackSize: number): Promise<void> {
    const temporaryPath = this.rollbackMarkerPath + '.' + randomUUID() + '.tmp';
    let temporaryHandle: ContinuityFileHandle | null = null;
    try {
      temporaryHandle = await open(temporaryPath, 'wx', 0o600);
      await temporaryHandle.writeFile(JSON.stringify({ version: 1, rollbackSize }) + '\n', 'utf8');
      await temporaryHandle.sync();
      await temporaryHandle.close();
      temporaryHandle = null;
      await rename(temporaryPath, this.rollbackMarkerPath);
      // The intent record must reach the directory before any journal bytes are appended.
      await this.syncJournalDirectory();
    } catch (error) {
      if (temporaryHandle) await temporaryHandle.close().catch(() => {});
      await unlink(temporaryPath).catch(() => {});
      throw error;
    }
  }

  private async clearRollbackMarker(): Promise<void> {
    try {
      await unlink(this.rollbackMarkerPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
    }
    await this.syncJournalDirectory();
  }

  private async repairPendingAppendRollback(): Promise<void> {
    const rollbackSize = await this.readRollbackMarker();
    if (rollbackSize === null) return;

    let repairHandle: ContinuityFileHandle;
    try {
      repairHandle = await open(this.filePath, 'r+');
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT' && rollbackSize === 0) {
        await this.clearRollbackMarker();
        return;
      }
      throw new Error('continuity-ledger-rollback-boundary-lost');
    }

    try {
      const currentSize = (await repairHandle.stat()).size;
      if (currentSize < rollbackSize) {
        throw new Error('continuity-ledger-rollback-boundary-lost');
      }
      if (currentSize > rollbackSize) {
        await repairHandle.truncate(rollbackSize);
        await repairHandle.sync();
        this.recoveredTailBytes += currentSize - rollbackSize;
      }
    } finally {
      await repairHandle.close();
    }
    await this.clearRollbackMarker();
    this.lastDurabilityWarning = null;
  }

  private async repairTornTail(): Promise<void> {
    let bytes: Buffer;
    try {
      bytes = await readFile(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return;
      throw error;
    }
    if (bytes.length === 0 || bytes[bytes.length - 1] === 0x0a) return;

    const lastNewline = bytes.lastIndexOf(0x0a);
    const committedLength = lastNewline + 1;
    const tailBytes = bytes.length - committedLength;
    const repairHandle = await open(this.filePath, 'r+');
    try {
      await repairHandle.truncate(committedLength);
      await repairHandle.sync();
    } finally {
      await repairHandle.close();
    }
    this.recoveredTailBytes += tailBytes;
  }

  private async ensureHandle(): Promise<ContinuityFileHandle> {
    if (this.handle) return this.handle;
    await mkdir(dirname(this.filePath), { recursive: true });
    await this.repairPendingAppendRollback();
    await this.repairTornTail();
    this.handle = await open(this.filePath, 'a+');
    return this.handle;
  }

  async record(frame: ContinuityFrame): Promise<void> {
    const line = JSON.stringify(frame) + '\n';
    const bytes = Buffer.byteLength(line, 'utf8');
    if (bytes > this.maxBytes) throw new RangeError('continuity-ledger-frame-exceeds-max-bytes');

    this.pendingLines.push(line);
    this.pendingBytes += bytes;
    this.stats = {
      ...this.stats,
      writes: this.stats.writes + 1,
      frames: this.stats.frames + 1,
      lastAt: frame.at,
    };
    if (this.pendingLines.length >= this.flushEveryFrames || this.pendingBytes >= 64 * 1024) await this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushInFlight) {
      await this.flushInFlight;
      if (this.pendingLines.length) return this.flush();
      return;
    }
    if (!this.pendingLines.length) return;

    const run = this.flushLoop();
    this.flushInFlight = run;
    try {
      await run;
      this.lastError = null;
    } catch (error) {
      this.lastError = String((error as any)?.message ?? error).slice(0, 180);
      throw error;
    } finally {
      if (this.flushInFlight === run) this.flushInFlight = null;
    }
  }

  private async flushLoop(): Promise<void> {
    while (this.pendingLines.length) {
      // Detach before the first await so late records cannot be cleared with this batch.
      const batchLines = this.pendingLines;
      const batchBytes = this.pendingBytes;
      this.pendingLines = [];
      this.pendingBytes = 0;
      try {
        const result = await this.persistBatch(batchLines);
        this.stats = {
          ...this.stats,
          bytesWritten: this.stats.bytesWritten + result.bytesWritten,
          lastWriteMs: result.durationMs,
        };
      } catch (error) {
        this.pendingLines = batchLines.concat(this.pendingLines);
        this.pendingBytes += batchBytes;
        throw error;
      }
    }
  }

  private async persistBatch(lines: string[]): Promise<PersistBatchResult> {
    const started = Date.now();
    const payload = Buffer.from(lines.join(''), 'utf8');
    const handle = await this.ensureHandle();
    const size = (await handle.stat()).size;
    let bytesWritten: number;
    if (size + payload.byteLength <= this.maxBytes) {
      await this.appendDurably(handle, size, payload);
      bytesWritten = payload.byteLength;
    } else {
      bytesWritten = await this.compactWithBatch(payload);
    }
    return { durationMs: Date.now() - started, bytesWritten };
  }

  private async appendDurably(handle: ContinuityFileHandle, startSize: number, payload: Buffer): Promise<void> {
    try {
      // Write-ahead intent makes the rollback boundary survive process death.
      await this.writeRollbackMarker(startSize);
      let offset = 0;
      while (offset < payload.byteLength) {
        const result = await handle.write(payload, offset, payload.byteLength - offset, null);
        if (!result.bytesWritten) throw new Error('continuity-ledger-zero-write');
        offset += result.bytesWritten;
      }
      await handle.sync();
      await this.clearRollbackMarker();
      this.lastDurabilityWarning = null;
    } catch (error) {
      try {
        await handle.truncate(startSize);
        await handle.sync();
        await this.clearRollbackMarker();
      } catch (rollbackError) {
        // Keep the durable marker in place. A fresh process will truncate even a
        // complete-looking newline-terminated append to the pre-append boundary.
        this.lastDurabilityWarning = 'append-rollback-failed:' +
          String((rollbackError as any)?.message ?? rollbackError).slice(0, 140);
        if (this.handle === handle) this.handle = null;
        await handle.close().catch(() => {});
      }
      throw error;
    }
  }

  private splitCompleteLines(bytes: Buffer): Buffer[] {
    const lines: Buffer[] = [];
    let start = 0;
    for (let index = 0; index < bytes.byteLength; index += 1) {
      if (bytes[index] !== 0x0a) continue;
      lines.push(bytes.subarray(start, index + 1));
      start = index + 1;
    }
    return lines;
  }

  private async compactWithBatch(payload: Buffer): Promise<number> {
    const existing = await readFile(this.filePath).catch(error => {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return Buffer.alloc(0);
      throw error;
    });
    const allLines = this.splitCompleteLines(Buffer.concat([existing, payload]));
    const retained: Buffer[] = [];
    let retainedBytes = 0;
    for (let index = allLines.length - 1; index >= 0; index -= 1) {
      const line = allLines[index];
      if (retainedBytes + line.byteLength > this.maxBytes) break;
      retained.unshift(line);
      retainedBytes += line.byteLength;
    }
    if (!retained.length && payload.byteLength > this.maxBytes) {
      throw new RangeError('continuity-ledger-frame-exceeds-max-bytes');
    }

    const replacement = Buffer.concat(retained, retainedBytes);
    await this.replaceFileAtomically(replacement);
    this.retentionDroppedFrames += Math.max(0, allLines.length - retained.length);
    return replacement.byteLength;
  }

  private async replaceFileAtomically(replacement: Buffer): Promise<void> {
    const temporaryPath = this.filePath + '.' + randomUUID() + '.tmp';
    const previousHandle = this.handle;
    this.handle = null;
    if (previousHandle) await previousHandle.close();

    let temporaryHandle: ContinuityFileHandle | null = null;
    let committed = false;
    try {
      temporaryHandle = await open(temporaryPath, 'wx', 0o600);
      let offset = 0;
      while (offset < replacement.byteLength) {
        const result = await temporaryHandle.write(replacement, offset, replacement.byteLength - offset, offset);
        if (!result.bytesWritten) throw new Error('continuity-ledger-compact-zero-write');
        offset += result.bytesWritten;
      }
      await temporaryHandle.sync();
      await temporaryHandle.close();
      temporaryHandle = null;
      await rename(temporaryPath, this.filePath);
      committed = true;
      await this.syncDirectoryBestEffort();
    } catch (error) {
      if (temporaryHandle) await temporaryHandle.close().catch(() => {});
      if (!committed) await unlink(temporaryPath).catch(() => {});
      throw error;
    } finally {
      try {
        this.handle = await open(this.filePath, 'a+');
      } catch (error) {
        this.handle = null;
        this.lastDurabilityWarning = String((error as any)?.message ?? error).slice(0, 180);
        if (!committed) throw error;
      }
    }
  }

  private async syncDirectoryBestEffort(): Promise<void> {
    try {
      const directoryHandle = await open(dirname(this.filePath), 'r');
      try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
      this.lastDurabilityWarning = null;
    } catch (error) {
      this.lastDurabilityWarning = String((error as any)?.message ?? error).slice(0, 180);
    }
  }

  async close(): Promise<void> {
    try {
      await this.flush();
    } catch (error) {
      this.lastError = String((error as any)?.message ?? error).slice(0, 180);
    }
    const handle = this.handle;
    this.handle = null;
    if (!handle) return;
    try {
      await handle.close();
    } catch (error) {
      this.lastError = String((error as any)?.message ?? error).slice(0, 180);
    }
  }

  diagnostics(): ContinuityLedgerDiagnostics {
    return {
      open: Boolean(this.handle),
      pendingLines: this.pendingLines.length,
      pendingBytes: this.pendingBytes,
      recoveredTailBytes: this.recoveredTailBytes,
      retentionDroppedFrames: this.retentionDroppedFrames,
      lastError: this.lastError,
      lastDurabilityWarning: this.lastDurabilityWarning,
    };
  }
}