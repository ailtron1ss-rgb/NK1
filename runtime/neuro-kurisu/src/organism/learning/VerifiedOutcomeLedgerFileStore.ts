import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { restoreVerifiedOutcomeLedger, serializeVerifiedOutcomeLedger } from './VerifiedOutcomeLedgerStore.ts';
import type { VerifiedOutcomeLedger } from './VerifiedOutcomeLedger.ts';

const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;

/**
 * Local-file persistence adapter. Writes a same-directory temporary file and
 * renames it atomically; the JSON codec checks accidental corruption on load.
 * This does not provide cross-process locking, signed provenance, or encryption.
 */
export class VerifiedOutcomeLedgerFileStore {
  constructor(private readonly filePath: string, private readonly maxBytes = DEFAULT_MAX_BYTES) {
    if (!filePath.trim() || !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
      throw new Error('invalid ledger file-store configuration');
    }
  }

  async save(ledger: VerifiedOutcomeLedger): Promise<void> {
    const data = serializeVerifiedOutcomeLedger(ledger);
    const bytes = Buffer.byteLength(data, 'utf8');
    if (bytes > this.maxBytes) throw new Error('ledger persistence exceeds configured size limit');
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true });
    const temporary = path.join(directory, \`.\${path.basename(this.filePath)}.\${randomUUID()}.tmp\`);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporary, 'wx', 0o600);
      await handle.writeFile(data, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporary, this.filePath);
      try {
        const dirHandle = await open(directory, 'r');
        try { await dirHandle.sync(); } finally { await dirHandle.close(); }
      } catch {
        // Some filesystems do not support directory fsync; the file itself was synced.
      }
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async load(): Promise<VerifiedOutcomeLedger> {
    const info = await stat(this.filePath);
    if (!info.isFile() || info.size > this.maxBytes) throw new Error('ledger file is not regular or exceeds size limit');
    const data = await readFile(this.filePath, 'utf8');
    if (Buffer.byteLength(data, 'utf8') > this.maxBytes) throw new Error('ledger persistence exceeds configured size limit');
    return restoreVerifiedOutcomeLedger(data);
  }
}
