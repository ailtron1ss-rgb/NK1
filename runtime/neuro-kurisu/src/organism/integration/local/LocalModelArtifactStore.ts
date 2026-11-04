import {
  chmodSync, closeSync, copyFileSync, existsSync, fsyncSync, linkSync, lstatSync,
  mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync, createReadStream,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

export type ModelArtifactFormat = 'gguf' | 'safetensors';
export type ModelAdaptationMethod = 'base' | 'lora' | 'qlora' | 'full-finetune';

export interface LocalModelArtifactManifest {
  schemaVersion: 1;
  artifactSha256: string;
  artifactBytes: number;
  modelRepoId: string;
  modelRevision: string;
  baseModelRepoId: string;
  baseModelRevision: string;
  modelLicenseId: string;
  modelLicenseUrl: string;
  format: ModelArtifactFormat;
  quantization: string;
  architecture: string;
  tokenizerSha256: string;
  chatTemplateSha256: string;
  adaptation: {
    method: ModelAdaptationMethod;
    parentArtifactSha256: string | null;
    trainingDatasetSha256: string | null;
    trainingRunId: string | null;
  };
  createdAt: number;
}

export interface StoredLocalModelArtifact {
  manifest: LocalModelArtifactManifest;
  artifactPath: string;
  manifestPath: string;
  reused: boolean;
}

const SHA256 = /^[a-f0-9]{64}$/;
const REVISION = /^[a-f0-9]{7,64}$/i;
const REPO_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const FORMAT_EXT: Record<ModelArtifactFormat, string> = { gguf: 'gguf', safetensors: 'safetensors' };

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

export function validateLocalModelArtifactManifest(value: LocalModelArtifactManifest): void {
  if (!value || value.schemaVersion !== 1 || !SHA256.test(value.artifactSha256) ||
      !Number.isSafeInteger(value.artifactBytes) || value.artifactBytes <= 0 ||
      !REPO_ID.test(value.modelRepoId) || !REVISION.test(value.modelRevision) ||
      !REPO_ID.test(value.baseModelRepoId) || !REVISION.test(value.baseModelRevision) ||
      !value.modelLicenseId?.trim() || value.modelLicenseId.length > 120 ||
      !value.modelLicenseUrl?.startsWith('https://') ||
      !(['gguf', 'safetensors'] as string[]).includes(value.format) ||
      !value.quantization?.trim() || value.quantization.length > 80 ||
      !value.architecture?.trim() || value.architecture.length > 120 ||
      !SHA256.test(value.tokenizerSha256) || !SHA256.test(value.chatTemplateSha256) ||
      !Number.isFinite(value.createdAt) || value.createdAt <= 0) {
    throw new Error('local-model-artifact-manifest-invalid');
  }
  const adaptation = value.adaptation;
  if (!adaptation || !(['base', 'lora', 'qlora', 'full-finetune'] as string[]).includes(adaptation.method)) {
    throw new Error('local-model-artifact-adaptation-invalid');
  }
  if (adaptation.method === 'base') {
    if (adaptation.parentArtifactSha256 !== null || adaptation.trainingDatasetSha256 !== null ||
        adaptation.trainingRunId !== null) throw new Error('base-model-must-not-claim-training-provenance');
  } else if (!adaptation.parentArtifactSha256 || !SHA256.test(adaptation.parentArtifactSha256) ||
      !adaptation.trainingDatasetSha256 || !SHA256.test(adaptation.trainingDatasetSha256) ||
      !adaptation.trainingRunId?.trim() || adaptation.trainingRunId.length > 160) {
    throw new Error('adaptation-provenance-required');
  }
}

async function hashFile(filePath: string): Promise<{ sha256: string; bytes: number }> {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    const data = chunk as Uint8Array;
    bytes += data.byteLength;
    hash.update(data);
  }
  return { sha256: hash.digest('hex'), bytes };
}

function syncDirectory(directory: string): void {
  try {
    const fd = openSync(directory, 'r');
    try { fsyncSync(fd); } finally { closeSync(fd); }
  } catch {
    // The file is already fsynced; some filesystems do not expose directory fsync.
  }
}

function readExistingManifest(manifestPath: string): LocalModelArtifactManifest | null {
  if (!existsSync(manifestPath)) return null;
  const stat = lstatSync(manifestPath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('model-artifact-manifest-path-invalid');
  let value: unknown;
  try { value = JSON.parse(readFileSync(manifestPath, 'utf8')); }
  catch { throw new Error('model-artifact-manifest-corrupt'); }
  validateLocalModelArtifactManifest(value as LocalModelArtifactManifest);
  return value as LocalModelArtifactManifest;
}

/**
 * Immutable content-addressed local weight registry. Registration verifies the full file
 * digest and byte size, pins base/adapter provenance, and never overwrites an existing blob
 * or manifest. It does not train weights or change the model currently served by llama.cpp.
 */
export class LocalModelArtifactStore {
  private readonly objectsDirectory: string;
  private readonly manifestsDirectory: string;

  constructor(rootDirectory: string) {
    if (!rootDirectory?.trim()) throw new Error('local-model-artifact-store-root-required');
    const root = path.resolve(rootDirectory);
    this.objectsDirectory = path.join(root, 'objects');
    this.manifestsDirectory = path.join(root, 'manifests');
    mkdirSync(this.objectsDirectory, { recursive: true, mode: 0o700 });
    mkdirSync(this.manifestsDirectory, { recursive: true, mode: 0o700 });
  }

  async register(sourcePath: string, manifest: LocalModelArtifactManifest): Promise<StoredLocalModelArtifact> {
    validateLocalModelArtifactManifest(manifest);
    let sourceStat: any;
    try { sourceStat = lstatSync(sourcePath); }
    catch { throw new Error('model-artifact-source-not-found'); }
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) throw new Error('model-artifact-source-must-be-regular-file');

    const actual = await hashFile(sourcePath);
    if (actual.sha256 !== manifest.artifactSha256 || actual.bytes !== manifest.artifactBytes) {
      throw new Error('model-artifact-hash-mismatch');
    }

    const artifactPath = path.join(this.objectsDirectory, `${manifest.artifactSha256}.${FORMAT_EXT[manifest.format]}`);
    const manifestPath = path.join(this.manifestsDirectory, `${manifest.artifactSha256}.json`);
    let reused = existsSync(artifactPath);

    if (reused) {
      const storedStat = lstatSync(artifactPath);
      if (!storedStat.isFile() || storedStat.isSymbolicLink()) throw new Error('stored-artifact-path-invalid');
      const stored = await hashFile(artifactPath);
      if (stored.sha256 !== manifest.artifactSha256 || stored.bytes !== manifest.artifactBytes) {
        throw new Error('stored-artifact-integrity-failed');
      }
    } else {
      const temporary = `${artifactPath}.${process.pid}.${randomUUID()}.tmp`;
      try {
        copyFileSync(sourcePath, temporary, 1);
        const fd = openSync(temporary, 'r');
        try { fsyncSync(fd); } finally { closeSync(fd); }
        chmodSync(temporary, 0o444);
        try { linkSync(temporary, artifactPath); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          const existing = await hashFile(artifactPath);
          if (existing.sha256 !== manifest.artifactSha256 || existing.bytes !== manifest.artifactBytes) {
            throw new Error('stored-artifact-integrity-failed');
          }
          reused = true;
        }
        syncDirectory(this.objectsDirectory);
      } finally {
        try { unlinkSync(temporary); } catch { /* The committed content-addressed link remains. */ }
      }
    }

    const existingManifest = readExistingManifest(manifestPath);
    if (existingManifest) {
      if (canonical(existingManifest) !== canonical(manifest)) throw new Error('model-artifact-manifest-conflict');
      return { manifest: existingManifest, artifactPath, manifestPath, reused: true };
    }

    const serialized = canonical(manifest);
    const temporaryManifest = `${manifestPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryManifest, serialized, { encoding: 'utf8', flag: 'wx', mode: 0o400 });
      const fd = openSync(temporaryManifest, 'r');
      try { fsyncSync(fd); } finally { closeSync(fd); }
      try { linkSync(temporaryManifest, manifestPath); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const raced = readExistingManifest(manifestPath);
        if (!raced || canonical(raced) !== serialized) throw new Error('model-artifact-manifest-conflict');
      }
      syncDirectory(this.manifestsDirectory);
    } finally {
      try { unlinkSync(temporaryManifest); } catch { /* The committed manifest link remains. */ }
    }
    return { manifest: { ...manifest }, artifactPath, manifestPath, reused };
  }

  async resolve(artifactSha256: string): Promise<StoredLocalModelArtifact> {
    if (!SHA256.test(artifactSha256)) throw new Error('model-artifact-digest-invalid');
    const manifestPath = path.join(this.manifestsDirectory, `${artifactSha256}.json`);
    const manifest = readExistingManifest(manifestPath);
    if (!manifest) throw new Error('model-artifact-manifest-not-found');
    if (manifest.artifactSha256 !== artifactSha256) throw new Error('model-artifact-manifest-digest-mismatch');
    const artifactPath = path.join(this.objectsDirectory, `${artifactSha256}.${FORMAT_EXT[manifest.format]}`);
    let stat: any;
    try { stat = lstatSync(artifactPath); }
    catch { throw new Error('stored-artifact-integrity-failed'); }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('stored-artifact-integrity-failed');
    const actual = await hashFile(artifactPath);
    if (actual.sha256 !== manifest.artifactSha256 || actual.bytes !== manifest.artifactBytes) {
      throw new Error('stored-artifact-integrity-failed');
    }
    return { manifest, artifactPath, manifestPath, reused: true };
  }
}
