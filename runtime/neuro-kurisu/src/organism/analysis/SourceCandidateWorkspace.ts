import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { types as nodeUtilTypes } from 'node:util';

const SHA1 = /^[a-f0-9]{40}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const RECEIPT_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;
const MAX_SOURCE_FILES = 20_000;
const MAX_SOURCE_FILE_BYTES = 8 * 1024 * 1024;
const MAX_SOURCE_BYTES = 256 * 1024 * 1024;
const MAX_EDITS = 256;
const MAX_REPLACEMENT_BYTES = 8 * 1024 * 1024;
const MAX_EDIT_BYTES = 32 * 1024 * 1024;
const RESERVED_SEGMENTS = new Set(['.git', 'node_modules', '__pycache__', '.pytest_cache', '.next', '.cache']);
const RECEIPT_NAME = 'candidate-receipt.json';
const RESERVED_ROOT_PREFIXES = ['.candidate-receipt-'];

export interface SourceCandidateFileV1 {
  path: string;
  content: string;
  sha256?: string;
}

export interface SourceCandidateEditV1 {
  path: string;
  expectedBeforeSha256: string | null;
  replacement: string;
  createIfMissing?: boolean;
}

export interface SourceCandidateAuthorizationRequestV1 {
  candidateId: string;
  baseSha: string;
  beforeTreeSha256: string;
  editSetSha256: string;
  changedFiles: Array<{
    path: string;
    expectedBeforeSha256: string | null;
    afterSha256: string;
    createIfMissing: boolean;
  }>;
}

export type SourceCandidateAuthorizationDecisionV1 =
  | {
      accepted: true;
      receiptId: string;
      baseSha: string;
      editSetSha256: string;
    }
  | {
      accepted: false;
      reason: string;
    };

export type SourceCandidateAuthorizationV1 = (
  request: SourceCandidateAuthorizationRequestV1,
) => Promise<SourceCandidateAuthorizationDecisionV1> | SourceCandidateAuthorizationDecisionV1;

export interface SourceCandidateWorkspaceOptionsV1 {
  /** Host-owned workspace root, separate from the canonical checkout. */
  workspaceRoot: string;
  /** Mandatory host-owned admission callback. Missing callback is a construction error. */
  authorize: SourceCandidateAuthorizationV1;
}

export interface SourceCandidateWorkspaceManifestV1 {
  schemaVersion: 1;
  status: 'materialized';
  executionStatus: 'not-executed';
  candidateId: string;
  baseSha: string;
  beforeTreeSha256: string;
  editSetSha256: string;
  candidateTreeSha256: string;
  admissionReceiptId: string;
  changedFiles: string[];
  createdAt: number;
}

export type SourceCandidateWorkspaceResultV1 =
  | {
      created: true;
      status: 'materialized';
      executionStatus: 'not-executed';
      candidateId: string;
      candidateRoot: string;
      manifestPath: string;
      beforeTreeSha256: string;
      editSetSha256: string;
      candidateTreeSha256: string;
      admissionReceiptId: string;
    }
  | {
      created: false;
      status: 'rejected' | 'error';
      reason: string;
      candidateId?: string;
    };

interface NormalizedFile {
  path: string;
  content: string;
  sha256: string;
}

interface NormalizedEdit {
  path: string;
  expectedBeforeSha256: string | null;
  replacement: string;
  replacementSha256: string;
  createIfMissing: boolean;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashSourceCandidateTextV1(value: string): string {
  if (typeof value !== 'string') throw new Error('source-candidate-text-must-be-string');
  return sha256(value);
}

function safePath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1024 ||
      value.includes('\\0') || value.includes('\\') || value.startsWith('/') ||
      /^[a-z]:/i.test(value) || value.endsWith('/')) return null;
  const parts = value.split('/');
  if (parts.some(part => {
    if (part.length === 0 || part === '.' || part === '..' || RESERVED_SEGMENTS.has(part.toLowerCase())) return true;
    // Reject names whose interpretation changes on Windows or through alternate
    // data streams. This keeps a candidate tree portable and prevents aliases.
    if (/[<>:"|?*\u0000-\u001f]/.test(part) || /[. ]$/.test(part)) return true;
    const deviceStem = part.split('.')[0].toUpperCase();
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(deviceStem)) return true;
    return false;
  })) return null;
  if (parts.length === 1) {
    const rootName = parts[0].toLowerCase();
    if (rootName === RECEIPT_NAME || RESERVED_ROOT_PREFIXES.some(prefix => rootName.startsWith(prefix))) return null;
  }
  return parts.join('/');
}

function portablePathKey(value: string): string {
  return value.split('/').map(part => part.normalize('NFC').toLowerCase()).join('/');
}
function ownRecord(value: unknown, maxKeys: number): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > maxKeys) return null;
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor') return null;
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function ownDenseArray(value: unknown, maxLength: number): unknown[] | null {
  try {
    if (!Array.isArray(value) || nodeUtilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > maxLength) return null;
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== length + 1) return null;
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function hasAncestorPathCollision(paths: Iterable<string>): boolean {
  const ordered = [...paths].sort(comparePath);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].startsWith(ordered[index - 1] + '/')) return true;
  }
  return false;
}

function comparePath(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function treeHash(files: readonly NormalizedFile[]): string {
  const rows = [...files].sort((a, b) => comparePath(a.path, b.path))
    .map(file => [file.path, file.sha256]);
  return sha256(JSON.stringify(rows));
}

function editSetHash(edits: readonly NormalizedEdit[]): string {
  const rows = [...edits].sort((a, b) => comparePath(a.path, b.path))
    .map(edit => ({
      path: edit.path,
      expectedBeforeSha256: edit.expectedBeforeSha256,
      replacementSha256: edit.replacementSha256,
      createIfMissing: edit.createIfMissing,
    }));
  return sha256(JSON.stringify(rows));
}

function reject(reason: string, candidateId?: string): SourceCandidateWorkspaceResultV1 {
  return {
    created: false,
    status: 'rejected',
    reason,
    ...(candidateId ? { candidateId } : {}),
  };
}

async function ensureDirectoryWithoutSymlink(path: string): Promise<void> {
  try {
    await mkdir(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error;
  }
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('candidate-workspace-path-not-directory');
  // Candidate content is private staging data; do not inherit broad umask-derived access.
  await chmod(path, 0o700);
}

async function writeCandidateFile(root: string, relativePath: string, content: string): Promise<void> {
  const parts = relativePath.split('/');
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = resolve(current, part);
    const rel = relative(root, current);
    if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
      throw new Error('candidate-path-escaped-workspace');
    }
    await ensureDirectoryWithoutSymlink(current);
  }
  const target = resolve(root, ...parts);
  const rel = relative(root, target);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error('candidate-path-escaped-workspace');
  }
  await writeFile(target, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
}

export class SourceCandidateWorkspaceV1 {
  private readonly configuredWorkspaceRoot: string;
  private readonly authorize: SourceCandidateAuthorizationV1;

  constructor(options: SourceCandidateWorkspaceOptionsV1) {
    if (!options || typeof options.workspaceRoot !== 'string' || !options.workspaceRoot.trim()) {
      throw new Error('source-candidate-workspace-root-required');
    }
    if (typeof options.authorize !== 'function') {
      throw new Error('source-candidate-host-admission-required');
    }
    this.configuredWorkspaceRoot = resolve(options.workspaceRoot);
    this.authorize = options.authorize;
  }

  async prepare(input: unknown): Promise<SourceCandidateWorkspaceResultV1> {
    let candidateId: string | undefined;
    let candidateRoot: string | undefined;
    let ownsCandidateDirectory = false;
    try {
      const row = ownRecord(input, 8);
      if (!row || Object.keys(row).some(key => !['baseSha', 'files', 'edits'].includes(key)) ||
          typeof row.baseSha !== 'string' || !SHA1.test(row.baseSha)) {
        return reject('invalid-source-candidate-request');
      }
      const fileRows = ownDenseArray(row.files, MAX_SOURCE_FILES);
      const editRows = ownDenseArray(row.edits, MAX_EDITS);
      if (!fileRows || fileRows.length === 0 || !editRows || editRows.length === 0) {
        return reject('invalid-source-snapshot-or-edits');
      }

      const files: NormalizedFile[] = [];
      const byPath = new Map<string, NormalizedFile>();
      const sourcePathsByPortableKey = new Map<string, string>();
      let sourceBytes = 0;
      for (const rawFile of fileRows) {
        const file = ownRecord(rawFile, 4);
        if (!file || Object.keys(file).some(key => !['path', 'content', 'sha256'].includes(key))) {
          return reject('invalid-source-file-record');
        }
        const filePath = safePath(file.path);
        if (!filePath) return reject('invalid-source-path');
        if (byPath.has(filePath)) return reject('duplicate-source-path');
        const portableKey = portablePathKey(filePath);
        const portableAlias = sourcePathsByPortableKey.get(portableKey);
        if (portableAlias && portableAlias !== filePath) return reject('source-path-alias-collision');
        sourcePathsByPortableKey.set(portableKey, filePath);
        if (typeof file.content !== 'string') return reject('source-file-content-must-be-text');
        const size = new TextEncoder().encode(file.content).byteLength;
        if (size > MAX_SOURCE_FILE_BYTES || sourceBytes + size > MAX_SOURCE_BYTES) return reject('source-snapshot-size-limit');
        sourceBytes += size;
        const contentHash = sha256(file.content);
        if (file.sha256 !== undefined && (typeof file.sha256 !== 'string' ||
            !SHA256.test(file.sha256) || file.sha256.toLowerCase() !== contentHash)) {
          return reject('source-snapshot-hash-mismatch');
        }
        const normalized: NormalizedFile = { path: filePath, content: file.content, sha256: contentHash };
        files.push(normalized);
        byPath.set(filePath, normalized);
      }
      if (hasAncestorPathCollision(sourcePathsByPortableKey.keys())) {
        return reject('source-path-ancestor-collision');
      }
      const beforeTreeSha256 = treeHash(files);

      const edits: NormalizedEdit[] = [];
      const changedPaths = new Set<string>();
      const changedPortablePaths = new Set<string>();
      let editBytes = 0;
      for (const rawEdit of editRows) {
        const edit = ownRecord(rawEdit, 6);
        if (!edit || Object.keys(edit).some(key => !['path', 'expectedBeforeSha256', 'replacement', 'createIfMissing'].includes(key))) {
          return reject('invalid-source-edit-record');
        }
        const editPath = safePath(edit.path);
        if (!editPath || editPath === RECEIPT_NAME) return reject('invalid-source-path');
        if (changedPaths.has(editPath)) return reject('duplicate-edit-path');
        const portableKey = portablePathKey(editPath);
        if (changedPortablePaths.has(portableKey)) return reject('duplicate-edit-path-alias');
        const sourceAlias = sourcePathsByPortableKey.get(portableKey);
        if (sourceAlias && sourceAlias !== editPath) return reject('source-edit-path-alias-mismatch');
        changedPortablePaths.add(portableKey);
        if (typeof edit.replacement !== 'string') return reject('source-edit-replacement-must-be-text');
        const replacementBytes = new TextEncoder().encode(edit.replacement).byteLength;
        if (replacementBytes > MAX_REPLACEMENT_BYTES || editBytes + replacementBytes > MAX_EDIT_BYTES) {
          return reject('source-edit-size-limit');
        }
        editBytes += replacementBytes;
        const createIfMissing = edit.createIfMissing === true;
        if (edit.createIfMissing !== undefined && typeof edit.createIfMissing !== 'boolean') {
          return reject('invalid-create-if-missing-flag');
        }
        const expectedBeforeSha256 = edit.expectedBeforeSha256;
        const current = byPath.get(editPath);
        if (expectedBeforeSha256 === null) {
          if (!createIfMissing || current) return reject('source-edit-create-binding-invalid');
        } else {
          if (typeof expectedBeforeSha256 !== 'string' || !SHA256.test(expectedBeforeSha256) ||
              !current || current.sha256 !== expectedBeforeSha256.toLowerCase() || createIfMissing) {
            return reject('source-edit-before-hash-mismatch');
          }
        }
        changedPaths.add(editPath);
        edits.push({
          path: editPath,
          expectedBeforeSha256: expectedBeforeSha256 === null ? null : String(expectedBeforeSha256).toLowerCase(),
          replacement: edit.replacement,
          replacementSha256: sha256(edit.replacement),
          createIfMissing,
        });
      }

      const resultingPortablePaths = new Set(sourcePathsByPortableKey.keys());
      for (const edit of edits) resultingPortablePaths.add(portablePathKey(edit.path));
      if (hasAncestorPathCollision(resultingPortablePaths)) {
        return reject('candidate-path-ancestor-collision');
      }

      const editSetSha256 = editSetHash(edits);
      candidateId = sha256(JSON.stringify({
        version: 1,
        baseSha: row.baseSha.toLowerCase(),
        beforeTreeSha256,
        editSetSha256,
      })).slice(0, 32);

      await mkdir(this.configuredWorkspaceRoot, { recursive: true, mode: 0o700 });
      const rootInfo = await lstat(this.configuredWorkspaceRoot);
      if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) return reject('candidate-workspace-root-not-directory', candidateId);
      const workspaceRoot = await realpath(this.configuredWorkspaceRoot);
      await chmod(workspaceRoot, 0o700);
      candidateRoot = resolve(workspaceRoot, candidateId);
      const rootRelative = relative(workspaceRoot, candidateRoot);
      if (rootRelative === '..' || rootRelative.startsWith('..' + sep) || isAbsolute(rootRelative)) {
        return reject('candidate-path-escaped-workspace', candidateId);
      }
      try {
        await lstat(candidateRoot);
        return reject('candidate-workspace-already-exists', candidateId);
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
      }

      const changedFiles = edits.map(edit => ({
        path: edit.path,
        expectedBeforeSha256: edit.expectedBeforeSha256,
        afterSha256: edit.replacementSha256,
        createIfMissing: edit.createIfMissing,
      })).sort((a, b) => comparePath(a.path, b.path));
      let decision: SourceCandidateAuthorizationDecisionV1;
      try {
        decision = await this.authorize({
          candidateId,
          baseSha: row.baseSha.toLowerCase(),
          beforeTreeSha256,
          editSetSha256,
          changedFiles,
        });
      } catch {
        return reject('host-admission-callback-failed', candidateId);
      }
      if (!decision || typeof decision !== 'object') return reject('host-admission-decision-invalid', candidateId);
      if (decision.accepted === false) {
        const reason = typeof decision.reason === 'string' && /^[a-z0-9._:-]{1,120}$/i.test(decision.reason)
          ? decision.reason : 'host-admission-denied';
        return reject(reason, candidateId);
      }
      if (decision.accepted !== true || typeof decision.receiptId !== 'string' ||
          !RECEIPT_ID.test(decision.receiptId) || decision.baseSha !== row.baseSha.toLowerCase() ||
          decision.editSetSha256 !== editSetSha256) {
        return reject('host-admission-binding-mismatch', candidateId);
      }

      try {
        // mkdir is the exclusive claim. A concurrent request cannot replace an
        // existing candidate directory; the final manifest is written last and
        // is the only signal that a candidate is fully materialized.
        await mkdir(candidateRoot, { mode: 0o700 });
        await chmod(candidateRoot, 0o700);
        ownsCandidateDirectory = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
          return reject('candidate-workspace-already-exists', candidateId);
        }
        throw error;
      }

      const resultingFiles = new Map(files.map(file => [file.path, file]));
      for (const edit of edits) {
        resultingFiles.set(edit.path, {
          path: edit.path,
          content: edit.replacement,
          sha256: edit.replacementSha256,
        });
      }
      for (const file of [...resultingFiles.values()].sort((a, b) => comparePath(a.path, b.path))) {
        await writeCandidateFile(candidateRoot, file.path, file.content);
      }
      const candidateTreeSha256 = treeHash([...resultingFiles.values()]);
      const manifest: SourceCandidateWorkspaceManifestV1 = {
        schemaVersion: 1,
        status: 'materialized',
        executionStatus: 'not-executed',
        candidateId,
        baseSha: row.baseSha.toLowerCase(),
        beforeTreeSha256,
        editSetSha256,
        candidateTreeSha256,
        admissionReceiptId: decision.receiptId,
        changedFiles: changedFiles.map(file => file.path),
        createdAt: Date.now(),
      };
      const temporaryManifest = resolve(candidateRoot, '.candidate-receipt-' + candidateId + '.tmp');
      await writeFile(temporaryManifest, JSON.stringify(manifest, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await rename(temporaryManifest, resolve(candidateRoot, RECEIPT_NAME));
      ownsCandidateDirectory = false;
      return {
        created: true,
        status: 'materialized',
        executionStatus: 'not-executed',
        candidateId,
        candidateRoot,
        manifestPath: resolve(candidateRoot, RECEIPT_NAME),
        beforeTreeSha256,
        editSetSha256,
        candidateTreeSha256,
        admissionReceiptId: decision.receiptId,
      };
    } catch {
      if (ownsCandidateDirectory && candidateRoot) {
        await rm(candidateRoot, { recursive: true, force: true }).catch(() => undefined);
      }
      return {
        created: false,
        status: 'error',
        reason: 'candidate-workspace-materialization-failed',
        ...(candidateId ? { candidateId } : {}),
      };
    }
  }
}
