const VERSION_PATTERN = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/;

function parseVersion(value) {
  const match = String(value ?? '').trim().match(VERSION_PATTERN);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  };
}

/**
 * Check the version form supported by .nvmrc: a major pin ("24"), a
 * major/minor pin ("24.2"), or a complete major/minor/patch pin.
 */
export function matchesVersionPin(actual, pin) {
  const actualVersion = parseVersion(actual);
  const pinText = String(pin ?? '').trim().replace(/^v/, '');
  const pinVersion = parseVersion(pinText);
  if (!actualVersion || !pinVersion) return false;

  const components = pinText.split('.').length;
  if (components < 1 || components > 3) return false;
  return actualVersion.major === pinVersion.major
    && (components < 2 || actualVersion.minor === pinVersion.minor)
    && (components < 3 || actualVersion.patch === pinVersion.patch);
}

/** Supports the explicit >=x.y.z ranges used by the runtime package contract. */
export function meetsMinimumVersion(actual, requirement) {
  const range = String(requirement ?? '').trim().match(/^>=\s*(v?\d+(?:\.\d+){0,2}(?:[-+].*)?)$/);
  const actualVersion = parseVersion(actual);
  const minimum = range ? parseVersion(range[1]) : null;
  if (!actualVersion || !minimum) return false;

  if (actualVersion.major !== minimum.major) return actualVersion.major > minimum.major;
  if (actualVersion.minor !== minimum.minor) return actualVersion.minor > minimum.minor;
  return actualVersion.patch >= minimum.patch;
}

export function inspectToolchainVersions({ nodeVersion, npmVersion, nodePin, nodeRequirement, npmRequirement }) {
  return {
    nodePinMatches: matchesVersionPin(nodeVersion, nodePin),
    nodeMeetsRequirement: meetsMinimumVersion(nodeVersion, nodeRequirement),
    npmMeetsRequirement: meetsMinimumVersion(npmVersion, npmRequirement),
  };
}
