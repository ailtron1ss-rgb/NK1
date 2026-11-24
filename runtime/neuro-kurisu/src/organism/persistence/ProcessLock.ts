import { open, readFile, unlink } from 'node:fs/promises';
import { hostname } from 'node:os';

export class ProcessLockError extends Error {
  constructor(message: string) { super(message); this.name = 'ProcessLockError'; }
}

export interface ProcessLockRecord { pid: number; startedAt: number; host: string; }

export class ProcessLock {
  private readonly path: string;
  private held = false;
  constructor(path: string) { this.path = path; }

  async acquire(): Promise<void> {
    const record: ProcessLockRecord = { pid: process.pid, startedAt: Date.now(), host: hostname() };
    try {
      const handle = await open(this.path, 'wx');
      try { await handle.writeFile(JSON.stringify(record, null, 2), 'utf8'); await handle.sync(); }
      finally { await handle.close(); }
      this.held = true;
      return;
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
    }

    let existing: Partial<ProcessLockRecord> = {};
    try { existing = JSON.parse(await readFile(this.path, 'utf8')); } catch { /* treat unreadable lock as stale candidate */ }
    const pid = Number(existing?.pid);
    let alive = false;
    if (Number.isInteger(pid) && pid > 0) {
      try { process.kill(pid, 0); alive = true; } catch { alive = false; }
    }
    if (alive) throw new ProcessLockError(`Organism state is already locked by pid=${pid}`);
    try { await unlink(this.path); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
    const handle = await open(this.path, 'wx');
    try { await handle.writeFile(JSON.stringify(record, null, 2), 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    this.held = true;
  }

  async release(): Promise<void> {
    if (!this.held) return;
    try { await unlink(this.path); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
    this.held = false;
  }
}
