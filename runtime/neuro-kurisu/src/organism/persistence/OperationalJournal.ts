import { appendFile, mkdir, readFile, rename, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

export type OperationalLevel = 'info' | 'warn' | 'error';
export interface OperationalRecord { at:number; level:OperationalLevel; event:string; data?:Record<string, unknown>; }

const isRecord = (value:unknown):value is Record<string,unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function parseJournalRecords(raw:string):OperationalRecord[] {
  const records:OperationalRecord[]=[];
  for (const line of raw.split(/\r?\n/).slice(-20_000)) {
    if (!line.trim()) continue;
    let value:unknown;
    try { value=JSON.parse(line); } catch { continue; }
    if (!isRecord(value) || typeof value.at!=='number' || !Number.isFinite(value.at) || value.at<0 ||
        !['info','warn','error'].includes(String(value.level)) ||
        typeof value.event!=='string' || value.event.length<1 || value.event.length>180) continue;
    records.push({
      at:value.at,
      level:value.level as OperationalLevel,
      event:value.event,
      ...(isRecord(value.data)?{data:{...value.data}}:{}),
    });
  }
  return records;
}

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

  /**
   * Read only a bounded number of recent records for one named event. The current
   * and single rotated journal are both considered; malformed/truncated lines are
   * skipped so one corrupt tail cannot prevent recovery of older valid receipts.
   * This is a journal reader, not a trust decision: callers must validate event data.
   */
  async readRecent(event:string, limit=32):Promise<OperationalRecord[]> {
    const wanted=String(event??'').trim().slice(0,180);
    if(!wanted) return [];
    const count=Math.max(1,Math.min(128,Math.floor(Number(limit)||32)));
    const rows:OperationalRecord[]=[];
    for(const file of [this.filePath+'.1',this.filePath]) {
      try {
        const info=await stat(file);
        if(!info.isFile() || info.size<=0 || info.size>this.maxBytes) continue;
        const raw=await readFile(file,'utf8');
        rows.push(...parseJournalRecords(raw).filter(row=>row.event===wanted));
      } catch(error:any) {
        if(error?.code!=='ENOENT') continue;
      }
    }
    return rows.slice(-count).reverse().map(row=>({...row,...(row.data?{data:{...row.data}}:{})}));
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const s = await stat(this.filePath);
      if (s.size < this.maxBytes) return;
      const rotated = this.filePath + '.1';
      try { await rename(this.filePath, rotated); } catch { /* best effort; current log remains usable */ }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}
