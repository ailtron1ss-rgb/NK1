import { readFileSync } from 'node:fs';
import path from 'node:path';

export function parseNodeMajor(value, label = 'Node version') {
  const raw = String(value ?? '').trim();
  const normalized = raw.startsWith('v') ? raw.slice(1) : raw;
  const match = /^(\d+)(?:\.\d+){0,2}$/.exec(normalized);
  if (!match) {
    throw new TypeError(label + ' must be a numeric major or semver version');
  }
  const major = Number(match[1]);
  if (!Number.isSafeInteger(major) || major < 1) {
    throw new RangeError(label + ' major must be a positive safe integer');
  }
  return major;
}

/**
 * The repository's canonical Node runtime pin is .nvmrc. Consumers compare
 * major versions so a pin such as "24" permits Node 24.x releases.
 */
export function resolveNodeRuntimeContract(root, actualVersion = process.version) {
  const pinPath = path.join(root, '.nvmrc');
  const pinned = readFileSync(pinPath, 'utf8').trim();
  if (!pinned) throw new TypeError('.nvmrc must not be empty');
  const expectedMajor = parseNodeMajor(pinned, '.nvmrc');
  const actualMajor = parseNodeMajor(actualVersion, 'actual Node version');
  return {
    pinPath,
    expectedMajor,
    actualMajor,
    compatible: expectedMajor === actualMajor,
  };
}
