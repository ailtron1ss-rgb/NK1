import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { NeuroPlasticAdapterManifest } from './NeuroPlasticAdapterRegistry.ts';

function digest(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function assertRegularPath(root: string, absolutePath: string, directory: boolean): void {
  const relative = path.relative(root, absolutePath);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('neuro-plastic-artifact-path-escapes-root');
  }
  let current = root;
  const segments = relative.split(path.sep).filter(Boolean);
  for (let index = 0; index < segments.length; index++) {
    current = path.join(current, segments[index]);
    const info = lstatSync(current);
    if (info.isSymbolicLink()) throw new Error('neuro-plastic-artifact-symlink-rejected');
    const shouldBeDirectory = index < segments.length - 1 || directory;
    if (shouldBeDirectory ? !info.isDirectory() : !info.isFile()) {
      throw new Error('neuro-plastic-artifact-path-type-invalid');
    }
  }
}

export function verifyNeuroPlasticAdapterArtifact(
  runtimeRoot: string,
  manifest: NeuroPlasticAdapterManifest,
): boolean {
  try {
    const root = path.resolve(runtimeRoot);
    const rootInfo = lstatSync(root);
    if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) return false;

    const directory = manifest.artifact.directory;
    if (!directory.startsWith('adapter-store/') || directory.includes('\\') ||
        directory.split('/').some(part => !part || part === '.' || part === '..')) return false;
    const adapterId = directory.slice('adapter-store/'.length);
    if (adapterId !== manifest.adapterId || adapterId.includes('/')) return false;

    const store = path.join(root, 'adapter-store');
    const adapter = path.join(store, adapterId);
    assertRegularPath(root, store, true);
    assertRegularPath(root, adapter, true);

    const configPath = path.join(adapter, 'adapter_config.json');
    const weightsPath = path.join(adapter, 'adapter_model.safetensors');
    const metadataPath = path.join(adapter, 'neuro-plastic-artifact.json');
    assertRegularPath(root, configPath, false);
    assertRegularPath(root, weightsPath, false);
    assertRegularPath(root, metadataPath, false);

    const config = readFileSync(configPath);
    const weights = readFileSync(weightsPath);
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    const configSha = digest(config);
    const weightsSha = digest(weights);
    const totalBytes = config.byteLength + weights.byteLength;

    if (configSha !== manifest.artifact.configSha256 ||
        weightsSha !== manifest.artifact.weightsSha256 ||
        totalBytes !== manifest.artifact.totalBytes) return false;
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
        artifacts['adapter_model.safetensors']?.bytes !== weights.byteLength) return false;
    return true;
  } catch {
    return false;
  }
}
