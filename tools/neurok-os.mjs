#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'engineering-os', 'manifest.v1.json');
const VALID_MODES = new Set(['connector', 'agent-skill', 'cli', 'service', 'human-gate']);
const REQUIRED_POLICY = [
  'neverPersistSecretValues',
  'noAutomaticProductionWrites',
  'noSelfApproval',
  'immutableHoldouts',
  'exactShaEvidence',
  'branchIsolation',
  'promotionRequiresIndependentVerification',
];

export function validateManifest(manifest) {
  const errors = [];
  if (manifest?.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  if (!Array.isArray(manifest?.integrations)) errors.push('integrations must be an array');
  if (!Array.isArray(manifest?.planes) || manifest.planes.length < 5) errors.push('at least five control planes are required');
  for (const key of REQUIRED_POLICY) {
    if (manifest?.policy?.[key] !== true) errors.push(`policy.${key} must be true`);
  }
  const ids = new Set();
  for (const [index, item] of (manifest?.integrations ?? []).entries()) {
    const label = `integrations[${index}]`;
    if (!item || typeof item !== 'object') { errors.push(`${label} must be an object`); continue; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id ?? '')) errors.push(`${label}.id is invalid`);
    if (ids.has(item.id)) errors.push(`duplicate integration id: ${item.id}`);
    ids.add(item.id);
    if (!item.name || !item.domain || !item.role) errors.push(`${label} is missing name/domain/role`);
    if (!VALID_MODES.has(item.adapterMode)) errors.push(`${label}.adapterMode is invalid`);
    if (item.enabled !== false || item.runtimeIntegrated !== false || item.connectionStatus !== 'unverified') {
      errors.push(`${label} must remain fail-closed until a connection and runtime adapter are verified`);
    }
    if (!Array.isArray(item.credentialRefs) || item.credentialRefs.length !== 0) {
      errors.push(`${label}.credentialRefs must be empty; secrets belong in a secret manager`);
    }
  }
  return { ok: errors.length === 0, errors, integrationCount: ids.size };
}

async function load() {
  return JSON.parse(await readFile(MANIFEST, 'utf8'));
}

async function main() {
  const command = process.argv[2] ?? 'status';
  const manifest = await load();
  const validation = validateManifest(manifest);
  if (command === 'validate') {
    console.log(JSON.stringify(validation, null, 2));
    if (!validation.ok) process.exitCode = 1;
    return;
  }
  if (command === 'status') {
    const byDomain = {};
    for (const item of manifest.integrations) byDomain[item.domain] = (byDomain[item.domain] ?? 0) + 1;
    console.log(JSON.stringify({
      name: manifest.name,
      validation: validation.ok ? 'PASS' : 'FAIL',
      integrationCatalogued: validation.integrationCount,
      connected: manifest.integrations.filter(x => x.connectionStatus === 'verified').length,
      runtimeIntegrated: manifest.integrations.filter(x => x.runtimeIntegrated === true).length,
      enabled: manifest.integrations.filter(x => x.enabled === true).length,
      policy: manifest.policy,
      domains: byDomain,
      note: 'Catalog entries are not claims of connected accounts or runtime integration.'
    }, null, 2));
    if (!validation.ok) process.exitCode = 1;
    return;
  }
  if (command === 'plan') {
    for (const plane of manifest.planes) {
      console.log(`## ${plane.id}\nOwner: ${plane.owner}\n${plane.purpose}\n`);
    }
    return;
  }
  console.error('Usage: node tools/neurok-os.mjs [status|validate|plan]');
  process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
