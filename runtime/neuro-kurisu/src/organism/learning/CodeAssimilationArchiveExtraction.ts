import { createHash } from 'node:crypto';
import { types as nodeUtilTypes } from 'node:util';
import { inflateRawSync } from 'node:zlib';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';
import type { CodeAssimilationCandidate } from './CodeAssimilationContracts.ts';
import {
  preflightCodeAssimilationArchive,
  type CodeAssimilationArchivePreflightLimits,
  type CodeAssimilationArchivePreflightReport,
} from './CodeAssimilationArchivePreflight.ts';

export interface CodeAssimilationArchiveExtractionInput {
  candidate: CodeAssimilationCandidate;
  archiveBytes: Uint8Array;
  parserId: string;
  parserVersion: string;
  limits?: Partial<CodeAssimilationArchivePreflightLimits>;
}
export interface CodeAssimilationExtractedFile {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}
export interface CodeAssimilationArchiveExtractionResult {
  readonly schemaVersion: 1;
  readonly accepted: true;
  readonly preflight: CodeAssimilationArchivePreflightReport;
  readonly filePaths: readonly string[];
  readonly files: readonly CodeAssimilationExtractedFile[];
  readonly extractionFingerprint: string;
  /** Returns a defensive copy; null means the path is not an extracted regular file. */
  readFile(path: string): Uint8Array | null;
}
interface ParsedEntry {
  name: string; kind: 'file' | 'directory'; flags: number; method: number;
  crc32: number; compressedSizeBytes: number; uncompressedSizeBytes: number;
  localOffset: number; localName: Buffer; dataOffset: number; recordEnd: number;
}
const LIMITS: Readonly<CodeAssimilationArchivePreflightLimits> = Object.freeze({
  maxArchiveBytes: 64 * 1024 * 1024, maxEntries: 4_096, maxFiles: 4_000,
  maxDirectories: 1_000, maxPathLength: 512, maxPathDepth: 32,
  maxFileBytes: 8 * 1024 * 1024, maxTotalExpandedBytes: 64 * 1024 * 1024,
  maxCompressionRatio: 100, maxNestedArchives: 0,
});
const LIMIT_KEYS = Object.keys(LIMITS) as Array<keyof CodeAssimilationArchivePreflightLimits>;
const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50;
const DESCRIPTOR = 0x08074b50, ZIP64 = 0x0001, UTF8 = 0x0800, DESCRIPTOR_FLAG = 0x0008;
const ALLOWED_FLAGS = 0x080e;
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let crc = n;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    table[n] = crc >>> 0;
  }
  return table;
})();
function fail(code: string): never { throw new Error(`code-assimilation-extraction-${code}`); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
}
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function normalizeLimits(raw: unknown): CodeAssimilationArchivePreflightLimits {
  let detached: unknown;
  try { detached = snapshotPlainData(raw, { maxDepth: 4, maxNodes: 64, maxStringUnits: 4_096 }); }
  catch { return fail('limits-untrusted'); }
  if (!isRecord(detached)) fail('limits-invalid');
  const output: CodeAssimilationArchivePreflightLimits = { ...LIMITS };
  for (const key of Object.keys(detached)) {
    if (!LIMIT_KEYS.includes(key as keyof CodeAssimilationArchivePreflightLimits)) fail('limits-shape-invalid');
    const name = key as keyof CodeAssimilationArchivePreflightLimits;
    const value = detached[key];
    const min = name === 'maxNestedArchives' ? 0 : Number.MIN_VALUE;
    if (typeof value !== 'number' || !Number.isFinite(value) ||
        (name !== 'maxCompressionRatio' && !Number.isSafeInteger(value)) ||
        value < min || value > LIMITS[name]) fail(`limit-${name}-invalid-or-weakened`);
    output[name] = value;
  }
  return output;
}
function readInput(raw: unknown): {
  candidate: unknown; archive: Buffer; parserId: unknown; parserVersion: unknown;
  limits: CodeAssimilationArchivePreflightLimits;
} {
  try {
    if (raw === null || typeof raw !== 'object' || nodeUtilTypes.isProxy(raw) || Array.isArray(raw)) {
      fail('input-invalid');
    }
    const proto = Object.getPrototypeOf(raw);
    if (proto !== Object.prototype && proto !== null) fail('input-prototype-invalid');
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const keys = Reflect.ownKeys(descriptors);
    const allowed = new Set(['candidate', 'archiveBytes', 'parserId', 'parserVersion', 'limits']);
    if (keys.some(key => typeof key !== 'string' || !allowed.has(key))) fail('input-shape-invalid');
    for (const key of ['candidate', 'archiveBytes', 'parserId', 'parserVersion']) {
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || !descriptor.enumerable) {
        fail('input-field-invalid');
      }
    }
    if (descriptors.limits && (!Object.prototype.hasOwnProperty.call(descriptors.limits, 'value') ||
        !descriptors.limits.enumerable)) fail('input-limits-invalid');
    const value = descriptors.archiveBytes!.value;
    if (!(value instanceof Uint8Array) || nodeUtilTypes.isProxy(value) ||
        (!Buffer.isBuffer(value) && Object.getPrototypeOf(value) !== Uint8Array.prototype)) {
      fail('archive-bytes-invalid');
    }
    if (value.byteLength > LIMITS.maxArchiveBytes) fail('archive-size-limit');
    return {
      candidate: descriptors.candidate!.value,
      archive: Buffer.from(value),
      parserId: descriptors.parserId!.value,
      parserVersion: descriptors.parserVersion!.value,
      limits: descriptors.limits?.value === undefined ? { ...LIMITS } : normalizeLimits(descriptors.limits.value),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('code-assimilation-extraction-')) throw error;
    return fail('input-untrusted');
  }
}
function range(buffer: Buffer, offset: number, size: number, label: string): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) ||
      offset < 0 || size < 0 || offset + size > buffer.length) fail(`${label}-truncated`);
}
function u16(buffer: Buffer, offset: number, label: string): number {
  range(buffer, offset, 2, label);
  return new DataView(buffer.buffer, buffer.byteOffset + offset, 2).getUint16(0, true);
}
function u32(buffer: Buffer, offset: number, label: string): number {
  range(buffer, offset, 4, label);
  return new DataView(buffer.buffer, buffer.byteOffset + offset, 4).getUint32(0, true);
}
function findEocd(buffer: Buffer): number {
  if (buffer.length < 22) fail('end-record-missing');
  const first = Math.max(0, buffer.length - 22 - 65_535);
  for (let offset = buffer.length - 22; offset >= first; offset -= 1) {
    if (u32(buffer, offset, 'end-record') === EOCD &&
        offset + 22 + u16(buffer, offset + 20, 'end-record') === buffer.length) return offset;
  }
  return fail('end-record-invalid');
}
function decodeName(bytes: Buffer, flags: number): string {
  if (bytes.length === 0) fail('entry-name-empty');
  if ((flags & UTF8) !== 0) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { return fail('entry-name-utf8-invalid'); }
  }
  if (bytes.some(byte => byte > 0x7f)) fail('entry-name-encoding-unsupported');
  return bytes.toString('ascii');
}
function checkExtra(extra: Buffer, scope: string): void {
  let offset = 0;
  while (offset < extra.length) {
    if (offset + 4 > extra.length) fail(`${scope}-extra-truncated`);
    const id = u16(extra, offset, `${scope}-extra`), length = u16(extra, offset + 2, `${scope}-extra`);
    offset += 4;
    if (offset + length > extra.length) fail(`${scope}-extra-truncated`);
    if (id === ZIP64) fail('zip64-unsupported');
    offset += length;
  }
}
function parseCentral(buffer: Buffer, maxEntries: number): { entries: ParsedEntry[]; offset: number } {
  const end = findEocd(buffer);
  const disk = u16(buffer, end + 4, 'end-record');
  const centralDisk = u16(buffer, end + 6, 'end-record');
  const diskCount = u16(buffer, end + 8, 'end-record');
  const count = u16(buffer, end + 10, 'end-record');
  const size = u32(buffer, end + 12, 'end-record');
  const offset = u32(buffer, end + 16, 'end-record');
  if (disk !== 0 || centralDisk !== 0 || diskCount !== count) fail('multi-disk-unsupported');
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) fail('zip64-unsupported');
  if (count > maxEntries) fail('entry-count-limit');
  if (offset + size !== end) fail('central-directory-bounds-invalid');
  range(buffer, offset, size, 'central-directory');
  const entries: ParsedEntry[] = [];
  let cursor = offset;
  for (let index = 0; index < count; index += 1) {
    if (u32(buffer, cursor, 'central-entry') !== CENTRAL) fail('central-entry-signature-invalid');
    range(buffer, cursor, 46, 'central-entry');
    const madeBy = u16(buffer, cursor + 4, 'central-entry');
    const needed = u16(buffer, cursor + 6, 'central-entry');
    const flags = u16(buffer, cursor + 8, 'central-entry');
    const method = u16(buffer, cursor + 10, 'central-entry');
    const crc = u32(buffer, cursor + 16, 'central-entry');
    const compressed = u32(buffer, cursor + 20, 'central-entry');
    const expanded = u32(buffer, cursor + 24, 'central-entry');
    const nameLength = u16(buffer, cursor + 28, 'central-entry');
    const extraLength = u16(buffer, cursor + 30, 'central-entry');
    const commentLength = u16(buffer, cursor + 32, 'central-entry');
    const startDisk = u16(buffer, cursor + 34, 'central-entry');
    const external = u32(buffer, cursor + 38, 'central-entry');
    const localOffset = u32(buffer, cursor + 42, 'central-entry');
    const recordLength = 46 + nameLength + extraLength + commentLength;
    range(buffer, cursor, recordLength, 'central-entry');
    if (needed > 20) fail('zip-feature-unsupported');
    if ((flags & 0x0041) !== 0) fail('encrypted-entry-forbidden');
    if ((flags & ~ALLOWED_FLAGS) !== 0 || (method === 0 && (flags & 0x0006) !== 0)) fail('entry-flags-unsupported');
    if (method !== 0 && method !== 8) fail('compression-method-unsupported');
    if (startDisk !== 0) fail('multi-disk-unsupported');
    if (compressed === 0xffffffff || expanded === 0xffffffff || localOffset === 0xffffffff) fail('zip64-unsupported');
    const nameOffset = cursor + 46;
    const nameBytes = buffer.subarray(nameOffset, nameOffset + nameLength);
    checkExtra(buffer.subarray(nameOffset + nameLength, nameOffset + nameLength + extraLength), 'central');
    const name = decodeName(nameBytes, flags);
    const directory = name.endsWith('/');
    const unixHost = (madeBy >>> 8) === 3;
    const type = (external >>> 16) & 0xf000;
    if ((external & 0x10) !== 0 && !directory) fail('entry-type-conflict');
    if (unixHost) {
      if (![0, 0x8000, 0x4000].includes(type)) fail('non-regular-entry-forbidden');
      if ((type === 0x8000 && directory) || (type === 0x4000 && !directory)) fail('entry-type-conflict');
    }
    if (directory && (method !== 0 || compressed !== 0 || expanded !== 0 || crc !== 0)) fail('directory-payload-forbidden');
    entries.push({
      name, kind: directory ? 'directory' : 'file', flags, method, crc32: crc,
      compressedSizeBytes: compressed, uncompressedSizeBytes: expanded,
      localOffset, localName: Buffer.from(nameBytes), dataOffset: 0, recordEnd: 0,
    });
    cursor += recordLength;
  }
  if (cursor !== offset + size) fail('central-directory-entry-count-mismatch');
  if (entries.length === 0) fail('archive-empty');
  return { entries, offset };
}
function descriptorEnd(buffer: Buffer, offset: number, entry: ParsedEntry, centralOffset: number): number {
  range(buffer, offset, 12, 'data-descriptor');
  const first = u32(buffer, offset, 'data-descriptor');
  if (first === DESCRIPTOR && offset + 16 <= centralOffset &&
      u32(buffer, offset + 4, 'data-descriptor') === entry.crc32 &&
      u32(buffer, offset + 8, 'data-descriptor') === entry.compressedSizeBytes &&
      u32(buffer, offset + 12, 'data-descriptor') === entry.uncompressedSizeBytes) return offset + 16;
  if (first !== entry.crc32 ||
      u32(buffer, offset + 4, 'data-descriptor') !== entry.compressedSizeBytes ||
      u32(buffer, offset + 8, 'data-descriptor') !== entry.uncompressedSizeBytes ||
      offset + 12 > centralOffset) fail('data-descriptor-mismatch');
  return offset + 12;
}
function validateLocalRecords(buffer: Buffer, entries: ParsedEntry[], centralOffset: number): void {
  for (const entry of entries) {
    const offset = entry.localOffset;
    if (offset >= centralOffset || u32(buffer, offset, 'local-header') !== LOCAL) fail('local-header-invalid');
    range(buffer, offset, 30, 'local-header');
    const flags = u16(buffer, offset + 6, 'local-header');
    const method = u16(buffer, offset + 8, 'local-header');
    const crc = u32(buffer, offset + 14, 'local-header');
    const compressed = u32(buffer, offset + 18, 'local-header');
    const expanded = u32(buffer, offset + 22, 'local-header');
    const nameLength = u16(buffer, offset + 26, 'local-header');
    const extraLength = u16(buffer, offset + 28, 'local-header');
    range(buffer, offset + 30, nameLength + extraLength, 'local-header');
    if (flags !== entry.flags || method !== entry.method || nameLength !== entry.localName.length) fail('local-central-header-mismatch');
    const localName = buffer.subarray(offset + 30, offset + 30 + nameLength);
    if (localName.length !== entry.localName.length ||
        localName.some((byte, index) => byte !== entry.localName[index])) fail('local-central-name-mismatch');
    checkExtra(buffer.subarray(offset + 30 + nameLength, offset + 30 + nameLength + extraLength), 'local');
    if (compressed === 0xffffffff || expanded === 0xffffffff) fail('zip64-unsupported');
    const hasDescriptor = (flags & DESCRIPTOR_FLAG) !== 0;
    const localFieldsMatch = hasDescriptor
      ? (crc === 0 || crc === entry.crc32) &&
        (compressed === 0 || compressed === entry.compressedSizeBytes) &&
        (expanded === 0 || expanded === entry.uncompressedSizeBytes)
      : crc === entry.crc32 && compressed === entry.compressedSizeBytes && expanded === entry.uncompressedSizeBytes;
    if (!localFieldsMatch) fail('local-central-size-mismatch');
    const dataOffset = offset + 30 + nameLength + extraLength;
    const dataEnd = dataOffset + entry.compressedSizeBytes;
    if (!Number.isSafeInteger(dataEnd) || dataEnd > centralOffset) fail('compressed-data-bounds-invalid');
    entry.dataOffset = dataOffset;
    entry.recordEnd = hasDescriptor ? descriptorEnd(buffer, dataEnd, entry, centralOffset) : dataEnd;
  }
  const ranges = [...entries].sort((a, b) => a.localOffset - b.localOffset);
  for (let index = 0; index < ranges.length; index += 1) {
    const current = ranges[index]!;
    if (current.recordEnd <= current.localOffset) fail('local-record-bounds-invalid');
    if (index > 0 && ranges[index - 1]!.recordEnd > current.localOffset) fail('local-record-overlap');
  }
}
function inflate(buffer: Buffer, entry: ParsedEntry): Buffer {
  const compressed = buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSizeBytes);
  let output: Buffer;
  if (entry.method === 0) {
    if (entry.compressedSizeBytes !== entry.uncompressedSizeBytes) fail('stored-size-mismatch');
    output = Buffer.from(compressed);
  } else {
    try {
      output = Buffer.from(inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.uncompressedSizeBytes) }));
    } catch { return fail('inflate-failed'); }
  }
  if (output.length !== entry.uncompressedSizeBytes) fail('expanded-size-mismatch');
  if (crc32(output) !== entry.crc32) fail('crc-mismatch');
  return output;
}

/**
 * Extracts ordinary ZIP files into a bounded in-memory quarantine snapshot only.
 * It never writes to the host filesystem, follows links, resolves dependencies or executes code.
 */
export function extractCodeAssimilationArchive(
  rawInput: CodeAssimilationArchiveExtractionInput,
): CodeAssimilationArchiveExtractionResult {
  const input = readInput(rawInput);
  if (input.archive.length === 0) fail('archive-empty');
  if (input.archive.length > LIMITS.maxArchiveBytes) fail('archive-size-limit');
  const archiveSha256 = sha256(input.archive);
  const parsed = parseCentral(input.archive, input.limits.maxEntries);
  validateLocalRecords(input.archive, parsed.entries, parsed.offset);
  const preflight = preflightCodeAssimilationArchive({
    candidate: input.candidate as CodeAssimilationCandidate,
    archiveSha256,
    archiveBytes: input.archive.length,
    parserId: input.parserId as string,
    parserVersion: input.parserVersion as string,
    entries: parsed.entries.map(entry => ({
      path: entry.name, kind: entry.kind,
      compressedSizeBytes: entry.compressedSizeBytes,
      uncompressedSizeBytes: entry.uncompressedSizeBytes,
    })),
    limits: input.limits,
  });
  const reportByPath = new Map(preflight.entries.map(entry => [entry.path, entry] as const));
  const payloads = new Map<string, Buffer>();
  const files: CodeAssimilationExtractedFile[] = [];
  for (const entry of parsed.entries) {
    if (entry.kind === 'directory') continue;
    const path = entry.name.normalize('NFKC');
    const declared = reportByPath.get(path);
    if (!declared || declared.kind !== 'file' ||
        declared.compressedSizeBytes !== entry.compressedSizeBytes ||
        declared.uncompressedSizeBytes !== entry.uncompressedSizeBytes) fail('preflight-entry-mismatch');
    if (payloads.has(path)) fail('duplicate-normalized-path');
    const bytes = inflate(input.archive, entry);
    payloads.set(path, bytes);
    files.push(Object.freeze({ path, sizeBytes: bytes.length, sha256: sha256(bytes) }));
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const immutableFiles = Object.freeze(files);
  const filePaths = Object.freeze(immutableFiles.map(file => file.path));
  const extractionFingerprint = sha256(`${preflight.reportFingerprint}\n${canonicalJson(immutableFiles)}`);
  const stored: ReadonlyMap<string, Buffer> = payloads;
  return Object.freeze({
    schemaVersion: 1 as const, accepted: true as const, preflight,
    filePaths, files: immutableFiles, extractionFingerprint,
    readFile(path: string): Uint8Array | null {
      if (typeof path !== 'string') return null;
      const bytes = stored.get(path);
      return bytes ? Uint8Array.from(bytes) : null;
    },
  });
}
