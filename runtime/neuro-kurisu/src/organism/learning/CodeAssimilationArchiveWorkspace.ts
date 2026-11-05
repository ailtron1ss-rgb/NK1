import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, open, rm, lstat, realpath, readFile as readDiskFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { types as nodeUtilTypes } from 'node:util';
import type { CodeAssimilationArchiveExtractionResult } from './CodeAssimilationArchiveExtraction.ts';

export interface CodeAssimilationArchiveWorkspaceInput {
  extraction: CodeAssimilationArchiveExtractionResult;
}

export interface CodeAssimilationArchiveWorkspaceFile {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface CodeAssimilationArchiveWorkspace {
  readonly schemaVersion: 1;
  readonly rootPath: string;
  readonly filePaths: readonly string[];
  readonly files: readonly CodeAssimilationArchiveWorkspaceFile[];
  readonly workspaceFingerprint: string;
  /** Resolves only a file recorded in the verified extraction manifest. */
  resolveFile(relativePath: string): string;
  /** Returns a detached copy after checking the current on-disk bytes against the manifest. */
  readFile(relativePath: string): Promise<Uint8Array>;
  /** Removes the entire disposable workspace. Repeated calls are safe. */
  cleanup(): Promise<void>;
}

interface VerifiedInput {
  extractionFingerprint: string;
  files: readonly CodeAssimilationArchiveWorkspaceFile[];
  payloads: ReadonlyMap<string, Buffer>;
}

const SHA256 = /^[a-f0-9]{64}$/;
const MAX_FILES = 4_000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_PATH_LENGTH = 512;
const MAX_PATH_DEPTH = 32;

function fail(code: string): never {
  throw new Error(`code-assimilation-workspace-${code}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) {
    fail(`${label}-invalid`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(`${label}-prototype-invalid`);
  return value as Record<string, unknown>;
}

function dataProperty(value: Record<string, unknown>, key: string, label: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    fail(`${label}-field-invalid`);
  }
  return descriptor.value;
}

function arrayValues(value: unknown, maximum: number, label: string): unknown[] {
  if (!Array.isArray(value) || nodeUtilTypes.isProxy(value) || !Object.isFrozen(value) ||
      value.length > maximum) fail(`${label}-invalid`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const output: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      fail(`${label}-sparse-or-accessor`);
    }
    output.push(descriptor.value);
  }
  return output;
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

function canonicalRelativePath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PATH_LENGTH ||
      value.normalize('NFKC') !== value || value.includes(String.fromCharCode(92)) ||
      value.startsWith('/') || value.endsWith('/') || value.includes('//')) {
    fail('path-invalid');
  }
  const segments = value.split('/');
  if (segments.length > MAX_PATH_DEPTH) fail('path-depth-limit');
  for (const segment of segments) {
    const lowered = segment.toLowerCase();
    const deviceBase = lowered.split('.')[0] ?? '';
    if (segment.length === 0 || segment === '.' || segment === '..' ||
        segment.endsWith('.') || segment.endsWith(' ') ||
        segment.includes(':') || /[<>"|?*]/.test(segment) ||
        ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
          'com¹', 'com²', 'com³', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
          'lpt¹', 'lpt²', 'lpt³'].includes(deviceBase) ||
        ['.git', '.hg', '.svn'].includes(lowered)) {
      fail('path-not-canonical');
    }
    if (Array.from(segment).some(character => {
      const point = character.codePointAt(0) ?? 0;
      return point <= 0x1f || (point >= 0x7f && point <= 0x9f);
    })) fail('path-control-character');
  }
  return value;
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function containedPath(root: string, relativePath: string): string {
  const segments = canonicalRelativePath(relativePath).split('/');
  const target = path.resolve(root, ...segments);
  if (!isWithin(root, target)) fail('path-escape');
  return target;
}

function verifyExtraction(raw: unknown): VerifiedInput {
  const input = record(raw, 'input');
  const inputKeys = Reflect.ownKeys(input);
  if (inputKeys.length !== 1 || inputKeys[0] !== 'extraction') fail('input-shape-invalid');
  const extraction = record(dataProperty(input, 'extraction', 'input'), 'extraction');
  const schemaVersion = dataProperty(extraction, 'schemaVersion', 'extraction');
  const accepted = dataProperty(extraction, 'accepted', 'extraction');
  const preflight = record(dataProperty(extraction, 'preflight', 'extraction'), 'preflight');
  const readFile = dataProperty(extraction, 'readFile', 'extraction');
  const extractionFingerprint = dataProperty(extraction, 'extractionFingerprint', 'extraction');
  if (schemaVersion !== 1 || accepted !== true || typeof readFile !== 'function' ||
      typeof extractionFingerprint !== 'string' || !SHA256.test(extractionFingerprint) ||
      !Object.isFrozen(extraction) || !Object.isFrozen(preflight)) {
    fail('extraction-contract-invalid');
  }

  const preflightAccepted = dataProperty(preflight, 'accepted', 'preflight');
  const reportFingerprint = dataProperty(preflight, 'reportFingerprint', 'preflight');
  const preflightEntries = arrayValues(dataProperty(preflight, 'entries', 'preflight'), 25_000, 'preflight-entries');
  if (preflightAccepted !== true || typeof reportFingerprint !== 'string' || !SHA256.test(reportFingerprint)) {
    fail('preflight-contract-invalid');
  }
  const declaredByPath = new Map<string, Record<string, unknown>>();
  for (const rawEntry of preflightEntries) {
    const entry = record(rawEntry, 'preflight-entry');
    const entryPath = canonicalRelativePath(dataProperty(entry, 'path', 'preflight-entry'));
    if (declaredByPath.has(entryPath)) fail('preflight-duplicate-path');
    declaredByPath.set(entryPath, entry);
  }

  const rawFiles = arrayValues(dataProperty(extraction, 'files', 'extraction'), MAX_FILES, 'files');
  const rawPaths = arrayValues(dataProperty(extraction, 'filePaths', 'extraction'), MAX_FILES, 'file-paths');
  if (rawFiles.length === 0 || rawFiles.length !== rawPaths.length) fail('file-manifest-invalid');

  const files: CodeAssimilationArchiveWorkspaceFile[] = [];
  const payloads = new Map<string, Buffer>();
  const seen = new Set<string>();
  const folded = new Set<string>();
  let totalBytes = 0;

  for (let index = 0; index < rawFiles.length; index += 1) {
    const item = record(rawFiles[index], 'file-metadata');
    const filePath = canonicalRelativePath(dataProperty(item, 'path', 'file-metadata'));
    const sizeBytes = dataProperty(item, 'sizeBytes', 'file-metadata');
    const digest = dataProperty(item, 'sha256', 'file-metadata');
    if (rawPaths[index] !== filePath || seen.has(filePath) || folded.has(filePath.toLowerCase()) ||
        typeof sizeBytes !== 'number' || !Number.isSafeInteger(sizeBytes) ||
        sizeBytes < 0 || sizeBytes > MAX_FILE_BYTES ||
        typeof digest !== 'string' || !SHA256.test(digest) || !Object.isFrozen(item)) {
      fail('file-metadata-invalid');
    }
    const declared = declaredByPath.get(filePath);
    if (!declared || dataProperty(declared, 'kind', 'preflight-entry') !== 'file' ||
        dataProperty(declared, 'uncompressedSizeBytes', 'preflight-entry') !== sizeBytes) {
      fail('file-preflight-binding-mismatch');
    }
    totalBytes += sizeBytes;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_TOTAL_BYTES) fail('expanded-size-limit');

    let rawBytes: unknown;
    try { rawBytes = (readFile as (path: string) => Uint8Array | null).call(extraction, filePath); }
    catch (error) { throw error; }
    if (!(rawBytes instanceof Uint8Array) || nodeUtilTypes.isProxy(rawBytes)) fail('payload-invalid');
    const bytes = Buffer.from(rawBytes);
    if (bytes.length !== sizeBytes || sha256(bytes) !== digest) fail('payload-digest-mismatch');

    const file = Object.freeze({ path: filePath, sizeBytes, sha256: digest });
    files.push(file);
    payloads.set(filePath, bytes);
    seen.add(filePath);
    folded.add(filePath.toLowerCase());
  }

  const expectedExtractionFingerprint = sha256(
    `${reportFingerprint}\n${canonicalJson(files)}`,
  );
  if (expectedExtractionFingerprint !== extractionFingerprint) fail('extraction-fingerprint-mismatch');
  return { extractionFingerprint, files: Object.freeze(files), payloads };
}

async function ensurePrivateDirectory(root: string, segments: readonly string[]): Promise<string> {
  let current = root;
  for (const segment of segments) {
    current = path.resolve(current, segment);
    if (!isWithin(root, current)) fail('directory-escape');
    try {
      await mkdir(current, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) fail('directory-not-private');
    const actual = await realpath(current);
    if (!isWithin(root, actual)) fail('directory-realpath-escape');
    current = actual;
  }
  return current;
}

/**
 * Materializes only hash-verified regular-file payloads into a fresh private temp directory.
 * It writes with exclusive-create semantics, verifies each on-disk file and never executes code.
 */
export async function materializeCodeAssimilationArchiveWorkspace(
  rawInput: CodeAssimilationArchiveWorkspaceInput,
): Promise<CodeAssimilationArchiveWorkspace> {
  const verified = verifyExtraction(rawInput);
  let createdRoot: string | null = null;
  try {
    createdRoot = await mkdtemp(path.join(tmpdir(), 'nk1-code-assimilation-'));
    const rootInfo = await lstat(createdRoot);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) fail('root-not-private-directory');
    const rootPath = await realpath(createdRoot);

    for (const file of verified.files) {
      const segments = file.path.split('/');
      const name = segments.pop();
      if (!name) fail('path-invalid');
      const parent = segments.length > 0
        ? await ensurePrivateDirectory(rootPath, segments)
        : rootPath;
      const target = containedPath(rootPath, file.path);
      if (path.dirname(target) !== parent) fail('parent-path-mismatch');

      const handle = await open(target, 'wx', 0o600);
      try {
        await handle.writeFile(verified.payloads.get(file.path)!);
        await handle.sync();
      } finally {
        await handle.close();
      }

      const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink() || info.size !== file.sizeBytes) {
        fail('written-file-metadata-mismatch');
      }
      const actualPath = await realpath(target);
      if (!isWithin(rootPath, actualPath)) fail('written-file-realpath-escape');
      const written = Buffer.from(await readDiskFile(target));
      if (written.length !== file.sizeBytes || sha256(written) !== file.sha256) {
        fail('written-file-integrity-mismatch');
      }
    }

    const filePaths = Object.freeze(verified.files.map(file => file.path));
    const fileByPath = new Map(verified.files.map(file => [file.path, file] as const));
    let cleaned = false;

    const resolveFile = (relativePath: string): string => {
      if (cleaned) fail('workspace-closed');
      if (typeof relativePath !== 'string' || !fileByPath.has(relativePath)) fail('file-not-listed');
      return containedPath(rootPath, relativePath);
    };

    const readWorkspaceFile = async (relativePath: string): Promise<Uint8Array> => {
      const target = resolveFile(relativePath);
      const metadata = fileByPath.get(relativePath)!;
      const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink()) fail('workspace-file-type-mismatch');
      if (info.size !== metadata.sizeBytes) fail('workspace-file-integrity-mismatch');
      const actualPath = await realpath(target);
      if (!isWithin(rootPath, actualPath)) fail('workspace-file-realpath-escape');
      const bytes = Buffer.from(await readDiskFile(target));
      if (bytes.length !== metadata.sizeBytes || sha256(bytes) !== metadata.sha256) {
        fail('workspace-file-integrity-mismatch');
      }
      return Uint8Array.from(bytes);
    };

    const cleanup = async (): Promise<void> => {
      if (cleaned) return;
      await rm(rootPath, { recursive: true, force: true });
      cleaned = true;
    };

    const workspaceFingerprint = sha256(
      `${verified.extractionFingerprint}\n${canonicalJson(verified.files)}\nworkspace-v1`,
    );
    return Object.freeze({
      schemaVersion: 1 as const,
      rootPath,
      filePaths,
      files: verified.files,
      workspaceFingerprint,
      resolveFile,
      readFile: readWorkspaceFile,
      cleanup,
    });
  } catch (error) {
    if (createdRoot !== null) {
      try { await rm(createdRoot, { recursive: true, force: true }); } catch { /* preserve the primary failure */ }
    }
    throw error;
  }
}
