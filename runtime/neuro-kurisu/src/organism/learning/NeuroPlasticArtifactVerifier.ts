import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import type { NeuroPlasticAdapterManifest } from './NeuroPlasticAdapterRegistry.ts';

const verifiedArtifacts = new Map<string, string>();

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function assertRegularPath(root: string, absolutePath: string, directory: boolean): Promise<void> {
  const relative = path.relative(root, absolutePath);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('neuro-plastic-artifact-path-escapes-root');
  }
  let current = root;
  const segments = relative.split(path.sep).filter(Boolean);
  for (let index = 0; index < segments.length; index++) {
    current = path.join(current, segments[index]);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error('neuro-plastic-artifact-symlink-rejected');
    const shouldBeDirectory = index < segments.length - 1 || directory;
    if (shouldBeDirectory ? !info.isDirectory() : !info.isFile()) {
      throw new Error('neuro-plastic-artifact-path-type-invalid');
    }
  }
}

export async function verifyNeuroPlasticAdapterArtifact(
  runtimeRoot: string,
  manifest: NeuroPlasticAdapterManifest,
): Promise<boolean> {
  try {
    const root = path.resolve(runtimeRoot);
    const rootInfo = await lstat(root);
    if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) return false;

    const directory = manifest.artifact.directory;
    if (!directory.startsWith('adapter-store/') || directory.includes('\\') ||
        directory.split('/').some(part => !part || part === '.' || part === '..')) return false;
    const adapterId = directory.slice('adapter-store/'.length);
    if (adapterId !== manifest.adapterId || adapterId.includes('/')) return false;

    const store = path.join(root, 'adapter-store');
    const adapter = path.join(store, adapterId);
    await assertRegularPath(root, store, true);
    await assertRegularPath(root, adapter, true);

    const configPath = path.join(adapter, 'adapter_config.json');
    const weightsPath = path.join(adapter, 'adapter_model.safetensors');
    const metadataPath = path.join(adapter, 'neuro-plastic-artifact.json');
    await Promise.all([
      assertRegularPath(root, configPath, false),
      assertRegularPath(root, weightsPath, false),
      assertRegularPath(root, metadataPath, false),
    ]);

    const [configInfo, weightsInfo, metadataInfo, directoryInfo] = await Promise.all([
      lstat(configPath),
      lstat(weightsPath),
      lstat(metadataPath),
      lstat(adapter),
    ]);
    const cacheKey = [
      directoryInfo.ino,
      configInfo.ino, configInfo.size, configInfo.mtimeMs,
      weightsInfo.ino, weightsInfo.size, weightsInfo.mtimeMs,
      metadataInfo.ino, metadataInfo.size, metadataInfo.mtimeMs,
      manifest.artifact.configSha256,
      manifest.artifact.weightsSha256,
      manifest.artifact.totalBytes,
      manifest.corpusFingerprint,
    ].join('|');
    const cacheId = root + '|' + manifest.adapterId;
    if (verifiedArtifacts.get(cacheId) === cacheKey) return true;

    const totalBytes = configInfo.size + weightsInfo.size;
    if (totalBytes !== manifest.artifact.totalBytes) return false;
    const [config, configSha, weightsSha, rawMetadata] = await Promise.all([
      readFile(configPath),
      hashFile(configPath),
      hashFile(weightsPath),
      readFile(metadataPath, 'utf8'),
    ]);
    if (configSha !== manifest.artifact.configSha256.toLowerCase() ||
        weightsSha !== manifest.artifact.weightsSha256.toLowerCase()) return false;
    const metadata = JSON.parse(rawMetadata);
    if (!metadata || metadata.schemaVersion !== 1 ||
        metadata.automaticActivation !== false ||
        metadata.adapterId !== manifest.adapterId ||
        metadata.method !== manifest.method ||
        metadata.domain !== manifest.domain ||
        metadata.baseModelFingerprint !== manifest.baseModel.fingerprint ||
        metadata.tokenizerFingerprint !== manifest.tokenizerFingerprint ||
        metadata.sourceDatasetFingerprint !== manifest.sourceDatasetFingerprint ||
        metadata.holdoutPlanFingerprint !== manifest.holdoutPlanFingerprint ||
        metadata.corpusFingerprint !== manifest.corpusFingerprint) return false;

    const artifacts = metadata.artifacts;
    if (!artifacts ||
        artifacts['adapter_config.json']?.sha256 !== configSha ||
        artifacts['adapter_config.json']?.bytes !== config.byteLength ||
        artifacts['adapter_model.safetensors']?.sha256 !== weightsSha ||
        artifacts['adapter_model.safetensors']?.bytes !== weightsInfo.size) return false;

    verifiedArtifacts.set(cacheId, cacheKey);
    return true;
  } catch {
    return false;
  }
}
