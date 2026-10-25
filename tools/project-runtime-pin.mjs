import { readFileSync } from 'node:fs';
import path from 'node:path';

function numericVersion(value, { allowPartial = false } = {}) {
  const raw = String(value ?? '').trim().replace(/^v/i, '');
  const parts = raw.split('.');
  if ((!allowPartial && parts.length !== 3) || parts.length < 1 || parts.length > 3
      || parts.some(part => !/^(0|[1-9]\d*)$/.test(part))) {
    throw new TypeError(`Invalid numeric runtime version: ${String(value)}`);
  }
  return { raw, parts: parts.map(Number), precision: parts.length };
}

/**
 * Parse the repository's .nvmrc. Numeric pins are intentional: aliases such as
 * "node" and "lts/*" make CI/doctor results depend on when they are evaluated.
 */
export function parseNodeVersionPin(value) {
  const parsed = numericVersion(value, { allowPartial: true });
  return Object.freeze({
    raw: parsed.raw,
    parts: Object.freeze(parsed.parts),
    precision: parsed.precision,
  });
}

export function readNodeVersionPin(root) {
  return parseNodeVersionPin(readFileSync(path.join(root, '.nvmrc'), 'utf8'));
}

export function matchesNodeVersionPin(actualVersion, pin) {
  let actual;
  try {
    actual = numericVersion(actualVersion).parts;
  } catch {
    return false;
  }

  let expected;
  try {
    expected = typeof pin === 'string' ? parseNodeVersionPin(pin) : pin;
    if (!expected || !Array.isArray(expected.parts) || !Number.isInteger(expected.precision)) return false;
  } catch {
    return false;
  }

  return actual.slice(0, expected.precision).every((part, index) => part === expected.parts[index]);
}

/** Compare full semantic versions using numeric components, not string order. */
export function versionMeetsMinimum(actualVersion, minimumVersion) {
  let actual;
  let minimum;
  try {
    actual = numericVersion(actualVersion).parts;
    minimum = numericVersion(minimumVersion, { allowPartial: true }).parts;
  } catch {
    return false;
  }
  for (let index = 0; index < 3; index += 1) {
    const left = actual[index] ?? 0;
    const right = minimum[index] ?? 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return true;
}
