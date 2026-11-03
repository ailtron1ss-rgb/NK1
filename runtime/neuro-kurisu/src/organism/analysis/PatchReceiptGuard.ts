import { createHash, verify as verifySignature } from 'node:crypto';

export interface ChangedLineRange { startLine: number; endLine: number; }
export interface ChangedFileRange { path: string; ranges: ChangedLineRange[]; }
export interface PatchReceipt {
  schemaVersion: 1;
  keyId: string;
  baseSha: string;
  patchSha256: string;
  changedFiles: ChangedFileRange[];
  signature: string;
}
export interface PatchReceiptVerificationOptions {
  patchText: string;
  expectedBaseSha: string;
  expectedTargetFiles: readonly string[];
  evolveBlocks: readonly { file: string; startLine: number; endLine: number }[];
  trustedPublicKeys: Readonly<Record<string, string>>;
}
export interface VerifiedPatchEvidence {
  ok: true;
  reason: 'patch-receipt-verified';
  keyId: string;
  baseSha: string;
  patchSha256: string;
  changedFiles: ChangedFileRange[];
}
export interface RefusedPatchEvidence { ok: false; reason: string; }

const MAX_PATCH_BYTES = 2_000_000;
const MAX_CHANGED_FILES = 256;
const MAX_HUNKS = 10_000;
const MAX_LINES_PER_HUNK = 100_000;
const SHA1 = /^[a-f0-9]{40}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;

function plain(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try { const proto = Object.getPrototypeOf(value); return proto === Object.prototype || proto === null; }
  catch { return false; }
}
function own(value: Record<string, unknown>, key: string): unknown {
  try {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return d && Object.prototype.hasOwnProperty.call(d, 'value') && d.get === undefined && d.set === undefined
      ? d.value : undefined;
  } catch { return undefined; }
}
function dense(value: unknown, maximum: number): unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const d = Object.getOwnPropertyDescriptor(value, 'length');
    const length = d && 'value' in d ? d.value : Number.NaN;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > maximum) return null;
    const result: unknown[] = [];
    for (let i = 0; i < length; i += 1) {
      const item = Object.getOwnPropertyDescriptor(value, String(i));
      if (!item || !Object.prototype.hasOwnProperty.call(item, 'value') || item.get !== undefined || item.set !== undefined) return null;
      result.push(item.value);
    }
    return result;
  } catch { return null; }
}
function validPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 512 || value !== value.trim() ||
      value.startsWith('/') || value.startsWith('"') || value.includes('\\') || value.includes('\0')) return false;
  return value.split('/').every(part => part.length > 0 && part !== '.' && part !== '..');
}
function addLine(ranges: ChangedLineRange[], line: number): void {
  const last = ranges[ranges.length - 1];
  if (last && line === last.endLine + 1) last.endLine = line;
  else ranges.push({ startLine: line, endLine: line });
}
function normalizeFiles(files: ChangedFileRange[]): ChangedFileRange[] {
  return files.map(file => ({
    path: file.path,
    ranges: file.ranges.map(r => ({ startLine: r.startLine, endLine: r.endLine }))
      .sort((a,b) => a.startLine-b.startLine || a.endLine-b.endLine),
  })).sort((a,b) => a.path.localeCompare(b.path));
}

/**
 * Accept only in-place text edits. New/deleted files, renames, mode changes,
 * binary patches, quoted paths and ambiguous headers fail closed. A deletion-only
 * hunk is mapped to its insertion seam in the new file (max(1, newStart)).
 */
export function parseUnifiedDiff(patchText: string): ChangedFileRange[] {
  if (typeof patchText !== 'string' || !patchText || Buffer.byteLength(patchText, 'utf8') > MAX_PATCH_BYTES) {
    throw new Error('patch-size-or-type-invalid');
  }
  if (patchText.includes('\0')) throw new Error('patch-contains-nul');
  const lines = patchText.split(/\r?\n/);
  const files: ChangedFileRange[] = [];
  let current: { header: string; oldPath: string|null; newPath: string|null; ranges: ChangedLineRange[]; hunks: number; changes: number } | null = null;
  const finish = () => {
    if (!current) return;
    if (!current.oldPath || !current.newPath || current.oldPath !== current.newPath) throw new Error('patch-file-add-delete-or-rename-refused');
    if (current.header !== `diff --git a/${current.oldPath} b/${current.newPath}`) throw new Error('patch-file-header-path-mismatch');
    if (!current.hunks || !current.ranges.length || !current.changes) throw new Error('patch-file-without-textual-change');
    files.push({ path: current.oldPath, ranges: current.ranges });
    if (files.length > MAX_CHANGED_FILES) throw new Error('patch-too-many-files');
    current = null;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('diff --git ')) {
      finish();
      current = { header: line, oldPath: null, newPath: null, ranges: [], hunks: 0, changes: 0 };
      continue;
    }
    if (!current) { if (line === '') continue; throw new Error('patch-missing-diff-header'); }
    if (/^(new file mode|deleted file mode|old mode|new mode|rename from|rename to|copy from|copy to|similarity index|dissimilarity index)\b/.test(line)) {
      throw new Error('patch-file-metadata-change-refused');
    }
    if (line.startsWith('GIT binary patch') || line.startsWith('Binary files ')) throw new Error('patch-binary-change-refused');
    if (line.startsWith('--- ')) {
      if (current.oldPath !== null || current.hunks) throw new Error('patch-duplicate-old-path-header');
      const raw = line.slice(4).split('\t',1)[0];
      if (!raw.startsWith('a/')) throw new Error('patch-old-path-refused');
      const p = raw.slice(2); if (!validPath(p)) throw new Error('patch-old-path-invalid');
      current.oldPath = p; continue;
    }
    if (line.startsWith('+++ ')) {
      if (current.newPath !== null || current.hunks) throw new Error('patch-duplicate-new-path-header');
      const raw = line.slice(4).split('\t',1)[0];
      if (!raw.startsWith('b/')) throw new Error('patch-new-path-refused');
      const p = raw.slice(2); if (!validPath(p)) throw new Error('patch-new-path-invalid');
      current.newPath = p; continue;
    }
    if (line.startsWith('@@ ')) {
      if (!current.oldPath || !current.newPath) throw new Error('patch-hunk-without-file-path');
      const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/.exec(line);
      if (!m) throw new Error('patch-hunk-header-invalid');
      current.hunks += 1; if (current.hunks > MAX_HUNKS) throw new Error('patch-too-many-hunks');
      const oldStart=Number(m[1]), oldCount=m[2]===undefined?1:Number(m[2]);
      const newStart=Number(m[3]), newCount=m[4]===undefined?1:Number(m[4]);
      if (![oldStart,oldCount,newStart,newCount].every(Number.isSafeInteger) || oldStart<0 || newStart<0 ||
          oldCount<0 || newCount<0 || oldCount>MAX_LINES_PER_HUNK || newCount>MAX_LINES_PER_HUNK || oldCount+newCount===0) {
        throw new Error('patch-hunk-range-invalid');
      }
      let oldSeen=0, newSeen=0, newLine=newStart;
      const ranges: ChangedLineRange[]=[];
      while (oldSeen<oldCount || newSeen<newCount) {
        i += 1; const body=lines[i]; if (body===undefined) throw new Error('patch-hunk-truncated');
        if (body==='\\ No newline at end of file') continue;
        const prefix=body[0];
        if (prefix===' ') { oldSeen+=1; newSeen+=1; newLine+=1; }
        else if (prefix==='+') { newSeen+=1; addLine(ranges,newLine); newLine+=1; current.changes+=1; }
        else if (prefix==='-') { oldSeen+=1; current.changes+=1; }
        else throw new Error('patch-hunk-body-invalid');
        if (oldSeen>oldCount || newSeen>newCount) throw new Error('patch-hunk-count-mismatch');
      }
      if (!ranges.length && oldCount>0) ranges.push({startLine:Math.max(1,newStart),endLine:Math.max(1,newStart)});
      current.ranges.push(...ranges); continue;
    }
    if (line==='' || line==='\\ No newline at end of file' || line.startsWith('index ')) continue;
    if (line.startsWith('+++') || line.startsWith('---')) throw new Error('patch-malformed-file-header');
    if (line) throw new Error('patch-unsupported-diff-metadata');
  }
  finish();
  if (!files.length) throw new Error('patch-has-no-files');
  const normalized=normalizeFiles(files);
  if (new Set(normalized.map(f=>f.path)).size!==normalized.length) throw new Error('patch-duplicate-file-path');
  return normalized;
}

export function canonicalPatchReceiptPayload(receipt: Omit<PatchReceipt,'signature'>): string {
  return JSON.stringify({
    schemaVersion: receipt.schemaVersion,
    keyId: receipt.keyId,
    baseSha: receipt.baseSha.toLowerCase(),
    patchSha256: receipt.patchSha256.toLowerCase(),
    changedFiles: normalizeFiles(receipt.changedFiles),
  });
}
function readReceipt(value: unknown): PatchReceipt|null {
  if (!plain(value)) return null;
  const schema=own(value,'schemaVersion'), keyId=own(value,'keyId'), base=own(value,'baseSha');
  const digest=own(value,'patchSha256'), signature=own(value,'signature');
  const rows=dense(own(value,'changedFiles'),MAX_CHANGED_FILES);
  if (schema!==1 || typeof keyId!=='string' || !KEY_ID.test(keyId) ||
      typeof base!=='string' || !SHA1.test(base) || typeof digest!=='string' || !SHA256.test(digest) ||
      typeof signature!=='string' || signature.length<80 || signature.length>256 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(signature) || !rows || !rows.length) return null;
  const changed: ChangedFileRange[]=[]; const seen=new Set<string>();
  for (const row of rows) {
    if (!plain(row)) return null;
    const p=own(row,'path'), rangeRows=dense(own(row,'ranges'),10_000);
    if (!validPath(p) || seen.has(p) || !rangeRows || !rangeRows.length) return null;
    seen.add(p); const ranges: ChangedLineRange[]=[]; let previous=0;
    for (const item of rangeRows) {
      if (!plain(item)) return null;
      const start=own(item,'startLine'), end=own(item,'endLine');
      if (typeof start!=='number' || !Number.isSafeInteger(start) || start<1 ||
          typeof end!=='number' || !Number.isSafeInteger(end) || end<start || start<=previous) return null;
      previous=end; ranges.push({startLine:start,endLine:end});
    }
    changed.push({path:p,ranges});
  }
  return {schemaVersion:1,keyId,baseSha:base,patchSha256:digest,changedFiles:normalizeFiles(changed),signature};
}
function stablePaths(value: unknown): string[]|null {
  const rows=dense(value,MAX_CHANGED_FILES);
  if (!rows || !rows.length || !rows.every(validPath) || new Set(rows).size!==rows.length) return null;
  return [...rows].sort((a,b)=>a.localeCompare(b));
}

/** Public keys come from the host-owned trust store; private keys never enter NK1. */
export function verifyPatchReceipt(receiptValue: unknown, options: PatchReceiptVerificationOptions): VerifiedPatchEvidence|RefusedPatchEvidence {
  const receipt=readReceipt(receiptValue);
  if (!receipt) return {ok:false,reason:'patch-receipt-malformed'};
  if (!options || typeof options.patchText!=='string' || typeof options.expectedBaseSha!=='string' || !SHA1.test(options.expectedBaseSha)) {
    return {ok:false,reason:'patch-verification-input-invalid'};
  }
  const base=options.expectedBaseSha.toLowerCase();
  if (receipt.baseSha.toLowerCase()!==base) return {ok:false,reason:'patch-base-sha-mismatch'};
  const digest=createHash('sha256').update(options.patchText).digest('hex');
  if (receipt.patchSha256.toLowerCase()!==digest) return {ok:false,reason:'patch-digest-mismatch'};
  let actual: ChangedFileRange[];
  try { actual=parseUnifiedDiff(options.patchText); }
  catch (error) { return {ok:false,reason:`patch-parse-refused:${error instanceof Error?error.message:'unknown'}`}; }
  if (JSON.stringify(receipt.changedFiles)!==JSON.stringify(actual)) return {ok:false,reason:'patch-changed-lines-mismatch'};
  const expected=stablePaths(options.expectedTargetFiles);
  const actualPaths=actual.map(f=>f.path).sort((a,b)=>a.localeCompare(b));
  if (!expected || JSON.stringify(expected)!==JSON.stringify(actualPaths)) return {ok:false,reason:'patch-target-files-mismatch'};
  const blocks=dense(options.evolveBlocks,MAX_CHANGED_FILES*4);
  if (!blocks) return {ok:false,reason:'evolve-blocks-malformed'};
  const validBlocks: {file:string;startLine:number;endLine:number}[]=[];
  for (const row of blocks) {
    if (!plain(row)) return {ok:false,reason:'evolve-blocks-malformed'};
    const file=own(row,'file'), start=own(row,'startLine'), end=own(row,'endLine');
    if (!validPath(file) || !expected.includes(file) || typeof start!=='number' || !Number.isSafeInteger(start) || start<1 ||
        typeof end!=='number' || !Number.isSafeInteger(end) || end<start) return {ok:false,reason:'evolve-blocks-malformed'};
    validBlocks.push({file,startLine:start,endLine:end});
  }
  for (const file of actual) for (const range of file.ranges) {
    if (!validBlocks.some(b=>b.file===file.path && b.startLine<=range.startLine && b.endLine>=range.endLine)) {
      return {ok:false,reason:`changed-lines-outside-evolve-block:${file.path}:${range.startLine}-${range.endLine}`};
    }
  }
  const keyMap=plain(options.trustedPublicKeys)?options.trustedPublicKeys:null;
  const publicKey=keyMap?own(keyMap,receipt.keyId):undefined;
  if (typeof publicKey!=='string' || !publicKey.includes('BEGIN PUBLIC KEY')) return {ok:false,reason:'patch-signing-key-untrusted'};
  try {
    const sig=Buffer.from(receipt.signature,'base64');
    if (sig.toString('base64')!==receipt.signature) return {ok:false,reason:'patch-signature-encoding-invalid'};
    const unsigned={schemaVersion:receipt.schemaVersion,keyId:receipt.keyId,baseSha:receipt.baseSha,patchSha256:receipt.patchSha256,changedFiles:receipt.changedFiles};
    if (!verifySignature(null,Buffer.from(canonicalPatchReceiptPayload(unsigned),'utf8'),publicKey,sig)) {
      return {ok:false,reason:'patch-signature-invalid'};
    }
  } catch { return {ok:false,reason:'patch-signature-verification-failed'}; }
  return {ok:true,reason:'patch-receipt-verified',keyId:receipt.keyId,baseSha:base,patchSha256:digest,changedFiles:actual};
}
