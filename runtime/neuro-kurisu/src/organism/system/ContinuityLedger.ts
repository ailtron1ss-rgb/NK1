import { mkdir, open } from 'node:fs/promises';
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

/**
 * Compact longitudinal journal. It intentionally stores diagnostics, not the
 * organism state, so it can remain cheap on a phone while making drift and
 * checkpoint behaviour observable over weeks.
 */
export class ContinuityLedger {
  private readonly filePath: string;
  private readonly maxBytes: number;
  private readonly flushEveryFrames: number;
  private pendingLines: string[] = [];
  private pendingBytes = 0;
  private stats: ContinuityLedgerMetrics = { writes: 0, bytesWritten: 0, frames: 0, lastWriteMs: 0, lastAt: 0 };
  private handle: ContinuityFileHandle | null = null;
  private flushInFlight: Promise<void> | null = null;

  constructor(filePath: string, maxBytes = 4 * 1024 * 1024, flushEveryFrames = 4) {
    this.filePath = filePath;
    this.maxBytes = Math.max(64 * 1024, Math.floor(maxBytes));
    this.flushEveryFrames = Math.max(1, Math.min(16, Math.floor(flushEveryFrames)));
  }

  metrics(): ContinuityLedgerMetrics { return { ...this.stats }; }

  private async ensureHandle(): Promise<ContinuityFileHandle> {
    if (this.handle) return this.handle;
    await mkdir(dirname(this.filePath), { recursive: true });
    this.handle = await open(this.filePath, 'a+');
    return this.handle;
  }

  async record(frame: ContinuityFrame): Promise<void> {
    const line = JSON.stringify(frame) + '\n';
    const bytes = new TextEncoder().encode(line).byteLength;
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
    if (this.flushInFlight) return this.flushInFlight;
    if (!this.pendingLines.length) return;
    const run = this.flushInternal();
    this.flushInFlight = run;
    try { await run; } finally { if (this.flushInFlight === run) this.flushInFlight = null; }
  }

  private async flushInternal(): Promise<void> {
    if (!this.pendingLines.length) return;
    const started = Date.now();
    const payload = this.pendingLines.join('');
    const bytes = this.pendingBytes;
    const handle = await this.ensureHandle();
    const size = (await handle.stat()).size;
    if (size >= this.maxBytes) { this.pendingLines = []; this.pendingBytes = 0; return; }
    const remaining = Math.max(0, this.maxBytes - size);
    const output = bytes <= remaining ? payload : payload.slice(0, remaining);
    await handle.write(output, null, 'utf8');
    this.pendingLines = [];
    this.pendingBytes = 0;
    const written = new TextEncoder().encode(output).byteLength;
    this.stats = { ...this.stats, bytesWritten: this.stats.bytesWritten + written, lastWriteMs: Date.now() - started };
  }

  async close(): Promise<void> {
    try { await this.flush(); } catch { /* best-effort diagnostic journal */ }
    if (this.flushInFlight) { try { await this.flushInFlight; } catch { /* best effort */ } }
    const handle = this.handle;
    this.handle = null;
    if (!handle) return;
    try { await handle.close(); } catch { /* idempotent shutdown */ }
  }

  diagnostics(): { open: boolean; pendingLines: number; pendingBytes: number } {
    return { open: Boolean(this.handle), pendingLines: this.pendingLines.length, pendingBytes: this.pendingBytes };
  }
}
