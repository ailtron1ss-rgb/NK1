import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

export type OperationalLevel = 'info' | 'warn' | 'error';
export interface OperationalRecord { at:number; level:OperationalLevel; event:string; data?:Record<string, unknown>; }

export class OperationalJournal {
  private readonly maxBytes = 2 * 1024 * 1024;
  private readonly filePath: string;
  constructor(filePath: string) { this.filePath = filePath; }

  async write(level: OperationalLevel, event: string, data?: Record<string, unknown>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await this.rotateIfNeeded();
    const record: OperationalRecord = { at: Date.now(), level, event, ...(data ? { data } : {}) };
    await appendFile(this.filePath, JSON.stringify(record) + '\n', 'utf8');
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const s = await stat(this.filePath);
      if (s.size < this.maxBytes) return;
      const rotated = `${this.filePath}.1`;
      try { await rename(this.filePath, rotated); } catch { /* best effort; current log remains usable */ }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}
