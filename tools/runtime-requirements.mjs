/**
 * Small semver-minimum helper used by install and doctor entry points.
 * The project pins Node 24 in .nvmrc and declares the supported engine floor
 * in both workspaces; do not reject a newer supported Node major.
 */
function parseVersion(value) {
  if (typeof value !== 'string') return null;
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] !== undefined,
  };
}

/** Compare stable minimum versions without accepting the exact prerelease floor. */
export function meetsMinimumVersion(actual, minimum) {
  const a = parseVersion(actual);
  const m = parseVersion(minimum);
  if (!a || !m) return false;
  for (const field of ['major', 'minor', 'patch']) {
    if (a[field] > m[field]) return true;
    if (a[field] < m[field]) return false;
  }
  return !a.prerelease;
}
