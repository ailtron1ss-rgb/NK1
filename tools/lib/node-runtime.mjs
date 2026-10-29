import { readFileSync } from 'node:fs';
import path from 'node:path';

// Root .nvmrc is the canonical Node.js pin (asserted by tools/verify-ci-reliability.mjs).
export function readPinnedNodeMajor(root) {
  const raw = readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
  const major = Number(raw.replace(/^v/, '').split('.')[0]);
  if (!Number.isInteger(major) || major <= 0) {
    throw new Error(`Root .nvmrc must pin a Node.js major or exact version; got ${JSON.stringify(raw)}.`);
  }
  return major;
}

export function versionMajor(version) {
  return Number(String(version ?? '').trim().replace(/^v/, '').split('.')[0]);
}
