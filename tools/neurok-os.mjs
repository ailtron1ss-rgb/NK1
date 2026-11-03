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
const MAX_INTEGRATIONS = 256;
const MAX_PLANES = 32;
const MAX_CREDENTIAL_REFS = 16;

function ownRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string') return null;
      const descriptor = descriptors[key];
      if (!descriptor || !Object.hasOwn(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function ownArray(value, maxLength) {
  try {
    if (!Array.isArray(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > maxLength) return null;
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== 'string' ||
      (key !== 'length' && !/^(0|[1-9]\\d*)$/.test(key)))) return null;
    const result = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.hasOwn(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function isBoundedText(value, max = 256) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

export function validateManifest(input) {
  const errors = [];
  const manifest = ownRecord(input);
  if (!manifest) return { ok: false, errors: ['manifest must be a plain data record'], integrationCount: 0 };

  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must equal 1');

  const integrations = ownArray(manifest.integrations, MAX_INTEGRATIONS);
  if (!integrations) errors.push(`integrations must be a dense array of at most ${MAX_INTEGRATIONS} entries`);

  const planes = ownArray(manifest.planes, MAX_PLANES);
  if (!planes || planes.length < 5) errors.push(`at least five dense control planes (maximum ${MAX_PLANES}) are required`);

  const policy = ownRecord(manifest.policy);
  if (!policy) errors.push('policy must be a plain data record');
  for (const key of REQUIRED_POLICY) {
    if (policy?.[key] !== true) errors.push(`policy.${key} must be true`);
  }

  const ids = new Set();
  for (const [index, raw] of (integrations ?? []).entries()) {
    const label = `integrations[${index}]`;
    const item = ownRecord(raw);
    if (!item) { errors.push(`${label} must be a plain data record`); continue; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(typeof item.id === 'string' ? item.id : '')) {
      errors.push(`${label}.id is invalid`);
    }
    if (ids.has(item.id)) errors.push(`duplicate integration id: ${item.id}`);
    ids.add(item.id);
    if (!isBoundedText(item.name, 128) || !isBoundedText(item.domain, 64) ||
        !isBoundedText(item.role, 512)) errors.push(`${label} is missing or has invalid name/domain/role`);
    if (!VALID_MODES.has(item.adapterMode)) errors.push(`${label}.adapterMode is invalid`);
    if (item.enabled !== false || item.runtimeIntegrated !== false || item.connectionStatus !== 'unverified') {
      errors.push(`${label} must remain fail-closed until a connection and runtime adapter are verified`);
    }
    const credentialRefs = ownArray(item.credentialRefs, MAX_CREDENTIAL_REFS);
    if (!credentialRefs || credentialRefs.length !== 0) {
      errors.push(`${label}.credentialRefs must be an empty dense array; secrets belong in a secret manager`);
    }
    if (item.promotionGate !== undefined && !isBoundedText(item.promotionGate, 256)) {
      errors.push(`${label}.promotionGate must be bounded text when present`);
    }
  }

  for (const [index, raw] of (planes ?? []).entries()) {
    const plane = ownRecord(raw);
    if (!plane || !isBoundedText(plane.id, 64) ||
        !isBoundedText(plane.owner, 128) || !isBoundedText(plane.purpose, 512)) {
      errors.push(`planes[${index}] must contain bounded id/owner/purpose data`);
    }
  }

  return { ok: errors.length === 0, errors, integrationCount: ids.size };
}

async function load() {
  return JSON.parse(await readFile(MANIFEST, 'utf8'));
}

async function main() {
  const command = process.argv[2] ?? 'status';
  if (!['status', 'validate', 'plan'].includes(command)) {
    console.error('Usage: node tools/neurok-os.mjs [status|validate|plan]');
    process.exitCode = 2;
    return;
  }
  const manifest = await load();
  const validation = validateManifest(manifest);
  if (!validation.ok) {
    console.error(JSON.stringify(validation, null, 2));
    process.exitCode = 1;
    return;
  }
  if (command === 'validate') {
    console.log(JSON.stringify(validation, null, 2));
    return;
  }
  if (command === 'status') {
    const byDomain = {};
    for (const item of manifest.integrations) byDomain[item.domain] = (byDomain[item.domain] ?? 0) + 1;
    console.log(JSON.stringify({
      name: manifest.name,
      validation: 'PASS',
      integrationCatalogued: validation.integrationCount,
      connected: manifest.integrations.filter(x => x.connectionStatus === 'verified').length,
      runtimeIntegrated: manifest.integrations.filter(x => x.runtimeIntegrated === true).length,
      enabled: manifest.integrations.filter(x => x.enabled === true).length,
      policy: manifest.policy,
      domains: byDomain,
      note: 'Catalog entries are not claims of connected accounts or runtime integration.'
    }, null, 2));
    return;
  }
  for (const plane of manifest.planes) {
    console.log(`## ${plane.id}\\nOwner: ${plane.owner}\\n${plane.purpose}\\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
