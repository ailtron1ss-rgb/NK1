import { createHash } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  isAuthenticatedCodeAssimilationArchiveExtractionResult,
  type CodeAssimilationArchiveExtractionResult,
} from './CodeAssimilationArchiveExtraction.ts';

export interface CodeAssimilationMaterializedFile {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}
export interface CodeAssimilationMaterializedWorkspace {
  readonly rootDirectory: string;
  readonly candidateFingerprint: string;
  readonly sourceFingerprint: string;
  readonly extractionFingerprint: string;
  readonly files: readonly CodeAssimilationMaterializedFile[];
  verifyIntegrity(): { readonly verified: true; readonly filesChecked: number };
  cleanup(): void;
}
interface PreparedFile extends CodeAssimilationMaterializedFile {
  readonly bytes: Uint8Array;
}

function fail(code: string): never {
  throw new Error(`code-assimilation-workspace-${code}`);
}
function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function normalizeRelativePath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 ||
      value.length > 512 || value.normalize('NFKC') !== value ||
      value.startsWith('/') || value.includes('\\') || value.includes('//')) {
    fail('path-invalid');
  }
  const segments = value.split('/');
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' ||
        segment.endsWith('.') || segment.endsWith(' ') ||
        /[:<>"|?*]/.test(segment) ||
        Array.from(segment).some(character => {
          const point = character.codePointAt(0) ?? 0;
          return point <= 0x1f || (point >= 0x7f && point <= 0x9f);
        })) {
      fail('path-invalid');
    }
  }
  return value;
}
function absoluteInside(root: string, relativePath: string): string {
  const target = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, target);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail('path-escape');
  }
  return target;
}
function assertDirectory(directory: string): void {
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('symlink-or-nondirectory');
}
function assertRegularFile(file: string): void {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('symlink-or-nonfile');
}
function parentDirectories(relativePath: string): string[] {
  const segments = relativePath.split('/');
  const result: string[] = [];
  for (let index = 1; index < segments.length; index += 1) {
    result.push(segments.slice(0, index).join('/'));
  }
  return result;
}
function verifyPathParents(root: string, relativePath: string): void {
  assertDirectory(root);
  for (const directory of parentDirectories(relativePath)) {
    assertDirectory(absoluteInside(root, directory));
  }
}

function prepareFiles(extraction: CodeAssimilationArchiveExtractionResult): {
  readonly files: readonly PreparedFile[];
  readonly directories: readonly string[];
} {
  if (!isRecord(extraction) || extraction.accepted !== true ||
      !isRecord(extraction.preflight) || extraction.preflight.accepted !== true ||
      !Array.isArray(extraction.files) || !Array.isArray(extraction.filePaths) ||
      typeof extraction.readFile !== 'function' ||
      extraction.files.length !== extraction.filePaths.length) {
    fail('extraction-invalid');
  }
  const output: PreparedFile[] = [];
  const directories = new Set<string>();
  const observedPaths = new Set<string>();
  for (let index = 0; index < extraction.files.length; index += 1) {
    const item: unknown = extraction.files[index];
    if (!isRecord(item)) fail('file-metadata-invalid');
    const filePath = normalizeRelativePath(item.path);
    if (observedPaths.has(filePath) || extraction.filePaths[index] !== filePath ||
        typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256) ||
        !Number.isSafeInteger(item.sizeBytes) || (item.sizeBytes as number) < 0) {
      fail('file-metadata-invalid');
    }
    observedPaths.add(filePath);
    for (const directory of parentDirectories(filePath)) directories.add(directory);
    let rawBytes: Uint8Array | null;
    try { rawBytes = extraction.readFile(filePath); }
    catch { return fail('file-read-failed'); }
    if (!(rawBytes instanceof Uint8Array)) fail('file-content-missing');
    const bytes = Uint8Array.from(rawBytes);
    if (bytes.length !== item.sizeBytes || sha256(bytes) !== item.sha256) {
      fail('file-content-integrity-mismatch');
    }
    output.push(Object.freeze({
      path: filePath,
      sizeBytes: bytes.length,
      sha256: item.sha256,
      bytes,
    }));
  }
  const explicitDirectories = extraction.preflight.entries
    .filter(entry => entry.kind === 'directory')
    .map(entry => normalizeRelativePath(entry.path));
  for (const directory of explicitDirectories) directories.add(directory);
  output.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const sortedDirectories = [...directories].sort((a, b) => {
    const depth = a.split('/').length - b.split('/').length;
    return depth || (a < b ? -1 : a > b ? 1 : 0);
  });
  return { files: Object.freeze(output), directories: Object.freeze(sortedDirectories) };
}

/**
 * Materializes an authenticated extraction into a private one-shot directory under
 * the operating-system temp root. It never installs dependencies or executes content.
 */
export function materializeCodeAssimilationArchive(
  extraction: CodeAssimilationArchiveExtractionResult,
): CodeAssimilationMaterializedWorkspace {
  let root: string | null = null;
  try {
    if (!isAuthenticatedCodeAssimilationArchiveExtractionResult(extraction)) {
      fail('extraction-not-authenticated');
    }
    const prepared = prepareFiles(extraction);
    root = mkdtempSync(path.join(tmpdir(), 'nk1-code-assimilation-'));
    assertDirectory(root);

    for (const directory of prepared.directories) {
      const absolute = absoluteInside(root, directory);
      const parent = path.dirname(absolute);
      if (parent !== root) assertDirectory(parent);
      mkdirSync(absolute, { mode: 0o700 });
      assertDirectory(absolute);
    }

    for (const file of prepared.files) {
      const target = absoluteInside(root, file.path);
      verifyPathParents(root, file.path);
      const descriptor = openSync(target, 'wx', 0o600);
      try {
        writeFileSync(descriptor, file.bytes);
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      assertRegularFile(target);
      const written = readFileSync(target);
      if (written.length !== file.sizeBytes || sha256(written) !== file.sha256) {
        fail('written-file-integrity-mismatch');
      }
    }

    const immutableFiles = Object.freeze(prepared.files.map(file => Object.freeze({
      path: file.path,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
    })));
    let disposed = false;
    const ensureLiveRoot = () => {
      if (disposed || root === null) fail('workspace-disposed');
      assertDirectory(root);
    };
    const workspace: CodeAssimilationMaterializedWorkspace = Object.freeze({
      rootDirectory: root,
      candidateFingerprint: extraction.preflight.candidateFingerprint,
      sourceFingerprint: extraction.preflight.sourceFingerprint,
      extractionFingerprint: extraction.extractionFingerprint,
      files: immutableFiles,
      verifyIntegrity(): { readonly verified: true; readonly filesChecked: number } {
        ensureLiveRoot();
        for (const file of immutableFiles) {
          verifyPathParents(root!, file.path);
          const target = absoluteInside(root!, file.path);
          assertRegularFile(target);
          const bytes = readFileSync(target);
          if (bytes.length !== file.sizeBytes || sha256(bytes) !== file.sha256) {
            fail('file-digest-mismatch');
          }
        }
        return Object.freeze({ verified: true as const, filesChecked: immutableFiles.length });
      },
      cleanup(): void {
        if (disposed || root === null) return;
        try {
          rmSync(root, { recursive: true, force: true });
        } catch {
          fail('cleanup-failed');
        } finally {
          disposed = true;
        }
      },
    });
    return workspace;
  } catch {
    if (root !== null) {
      try { rmSync(root, { recursive: true, force: true }); } catch { /* preserve fail-closed result */ }
    }
    return fail('materialization-failed');
  }
}
