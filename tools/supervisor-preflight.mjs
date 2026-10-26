import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspectToolchainVersions } from './toolchain-contract.mjs';

const MANIFESTS = [
  { name: 'root', path: 'package.json' },
  { name: 'runtime', path: 'runtime/neuro-kurisu/package.json' },
  { name: 'app', path: 'app/package.json' },
];

function readCommandVersion(command) {
  try { return execFileSync(command, ['--version'], { encoding: 'utf8' }).trim(); }
  catch { return null; }
}

function readManifest(root, relativePath) {
  try { return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8')); }
  catch { return null; }
}

/** Shared startup guard for both development and production supervisors. */
export function inspectSupervisorToolchain(root, overrides = {}) {
  if (typeof root !== 'string' || !root.trim()) {
    return {
      ready: false, nodeReady: false, npmReady: false,
      nodeVersion: overrides.nodeVersion ?? process.version,
      nodePin: null, npmVersion: overrides.npmVersion ?? null, engines: 'invalid-root',
    };
  }

  const projectRoot = resolve(root);
  let nodePin = null;
  try { nodePin = readFileSync(resolve(projectRoot, '.nvmrc'), 'utf8').trim(); }
  catch { /* Missing version pin is rejected below. */ }
  const nodeVersion = overrides.nodeVersion ?? process.version;
  const npmVersion = overrides.npmVersion ?? readCommandVersion('npm');
  const manifests = MANIFESTS.map(entry => ({ ...entry, value: readManifest(projectRoot, entry.path) }));
  const contracts = manifests.map(({ value }) => inspectToolchainVersions({
    nodeVersion, npmVersion, nodePin,
    nodeRequirement: value?.engines?.node,
    npmRequirement: value?.engines?.npm,
  }));
  const nodeReady = !!nodePin && manifests.every((manifest, index) =>
    !!manifest.value && contracts[index].nodePinMatches && contracts[index].nodeMeetsRequirement);
  const npmReady = !!npmVersion && manifests.every((manifest, index) =>
    !!manifest.value && contracts[index].npmMeetsRequirement);
  const engines = manifests.map(({ name, value }) =>
    `${name}:node=${value?.engines?.node ?? 'missing'},npm=${value?.engines?.npm ?? 'missing'}`).join('; ');
  return { ready: nodeReady && npmReady, nodeReady, npmReady, nodeVersion, nodePin, npmVersion, engines };
}

export function formatSupervisorToolchainFailure(report, label = 'SUPERVISOR') {
  const prefix = typeof label === 'string' && label.trim() ? label.trim() : 'SUPERVISOR';
  return `${prefix}=FAIL reason=toolchain-contract node=${report?.nodeVersion ?? 'unknown'} pin=${report?.nodePin ?? 'missing'} npm=${report?.npmVersion ?? 'missing'} engines=[${report?.engines ?? 'unknown'}]`;
}
