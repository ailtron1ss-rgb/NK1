/**
 * Shared runtime-version policy for install, diagnostics and regression tests.
 * Accepts either an .nvmrc major pin (for example "24") or an exact x.y.z pin.
 */
export const MIN_NPM_VERSION = '10.8.0';

export function parseNodePin(value) {
  const pin = String(value ?? '').trim();
  if (/^\d+$/.test(pin)) {
    const major = Number(pin);
    return Number.isSafeInteger(major) && major > 0 ? { kind: 'major', major } : null;
  }
  const exact = /^(\d+)\.(\d+)\.(\d+)$/.exec(pin);
  if (!exact) return null;
  const parts = exact.slice(1).map(Number);
  if (!parts.every(Number.isSafeInteger) || parts[0] < 1) return null;
  return { kind: 'exact', major: parts[0], minor: parts[1], patch: parts[2] };
}

function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const parts = match.slice(1, 4).map(Number);
  if (!parts.every(Number.isSafeInteger)) return null;
  return { major: parts[0], minor: parts[1], patch: parts[2], prerelease: Boolean(match[4]) };
}

export function matchesNodePin(pinValue, actualVersion) {
  const pin = parseNodePin(pinValue);
  const actual = parseVersion(actualVersion);
  if (!pin || !actual || actual.prerelease) return false;
  if (pin.kind === 'major') return actual.major === pin.major;
  return actual.major === pin.major && actual.minor === pin.minor && actual.patch === pin.patch;
}

export function versionAtLeast(actualVersion, minimumVersion) {
  const actual = parseVersion(actualVersion);
  const minimum = parseVersion(minimumVersion);
  if (!actual || !minimum) return false;
  for (const key of ['major', 'minor', 'patch']) {
    if (actual[key] > minimum[key]) return true;
    if (actual[key] < minimum[key]) return false;
  }
  // A prerelease is lower than the corresponding stable release.
  if (actual.prerelease !== minimum.prerelease) return !actual.prerelease;
  return true;
}
