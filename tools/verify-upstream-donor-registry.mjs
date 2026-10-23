import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = resolve(HERE, '../research/upstream-donors/registry.json');
const DECISIONS = new Set(['benchmark', 'adapt', 'isolated-research', 'alternative', 'defer', 'adopt']);
const INTEGRATION_MODES = new Set(['none', 'native-adaptation', 'evaluation-only', 'isolated-experiment', 'runtime-dependency']);
const EVIDENCE_STATUSES = new Set(['pending', 'partial', 'complete']);
const EVIDENCE_KEYS = ['sourceCodeAudit', 'licenseAudit', 'tests', 'benchmark'];

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate the donor intake file's shape and, critically, prevent a donor from
 * being recorded as a runtime dependency before required evidence is linked.
 * This checks intake metadata only; it does not audit upstream code or run tests.
 */
export function validateDonorRegistry(registry) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    return ['registry must be a JSON object'];
  }
  if (registry.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  if (!Array.isArray(registry.donors) || registry.donors.length === 0) {
    errors.push('donors must be a non-empty array');
    return errors;
  }

  const ids = new Set();
  const urls = new Set();
  registry.donors.forEach((donor, index) => {
    const prefix = 'donors[' + index + ']';
    if (!donor || typeof donor !== 'object' || Array.isArray(donor)) {
      errors.push(prefix + ' must be an object');
      return;
    }

    for (const field of ['id', 'name', 'class', 'mechanism']) {
      if (!nonEmptyString(donor[field])) errors.push(prefix + '.' + field + ' must be a non-empty string');
    }
    if (nonEmptyString(donor.id)) {
      if (ids.has(donor.id)) errors.push(prefix + ' duplicates donor id: ' + donor.id);
      ids.add(donor.id);
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(donor.primaryUrl);
    } catch {
      errors.push(prefix + '.primaryUrl must be an absolute HTTPS URL');
    }
    if (parsedUrl && parsedUrl.protocol !== 'https:') errors.push(prefix + '.primaryUrl must use HTTPS');
    if (nonEmptyString(donor.primaryUrl)) {
      if (urls.has(donor.primaryUrl)) errors.push(prefix + ' duplicates primaryUrl: ' + donor.primaryUrl);
      urls.add(donor.primaryUrl);
    }

    if (!DECISIONS.has(donor.decision)) errors.push(prefix + '.decision is unsupported: ' + String(donor.decision));
    if (!donor.integration || typeof donor.integration !== 'object' ||
        !INTEGRATION_MODES.has(donor.integration.mode)) {
      errors.push(prefix + '.integration.mode is missing or unsupported');
    }
    if (!Array.isArray(donor.nk1Target) || donor.nk1Target.some((item) => !nonEmptyString(item))) {
      errors.push(prefix + '.nk1Target must be an array of non-empty repository paths');
    }

    for (const key of EVIDENCE_KEYS) {
      const evidence = donor[key];
      if (!evidence || typeof evidence !== 'object' || !EVIDENCE_STATUSES.has(evidence.status)) {
        errors.push(prefix + '.' + key + '.status must be pending, partial, or complete');
        continue;
      }
      if (evidence.status === 'complete' && !nonEmptyString(evidence.reportPath)) {
        errors.push(prefix + '.' + key + ' is complete but has no reportPath');
      }
      if (evidence.status === 'partial' && !nonEmptyString(evidence.reportPath)) {
        errors.push(prefix + '.' + key + ' is partial but has no reportPath describing the partial work');
      }
      if (key === 'tests' && evidence.status === 'complete' && !nonEmptyString(evidence.command)) {
        errors.push(prefix + '.tests is complete but has no reproducible command');
      }
      if (key === 'licenseAudit' && evidence.status === 'complete' &&
          !nonEmptyString(evidence.spdxLicense) && !nonEmptyString(evidence.compatibilityEvidence)) {
        errors.push(prefix + '.licenseAudit is complete but has no SPDX license or compatibility evidence');
      }
    }

    const requiresRuntimeGate = donor.decision === 'adopt' ||
      (donor.integration && donor.integration.mode === 'runtime-dependency');
    if (requiresRuntimeGate) {
      for (const key of EVIDENCE_KEYS) {
        const evidence = donor[key];
        if (!evidence || evidence.status !== 'complete' || !nonEmptyString(evidence.reportPath)) {
          errors.push(prefix + ' cannot be adopted as a runtime dependency until ' + key + ' is complete with reportPath');
        }
      }
      if (donor.tests && donor.tests.status === 'complete' && !nonEmptyString(donor.tests.command)) {
        errors.push(prefix + ' cannot be adopted without a reproducible tests.command');
      }
      if (donor.licenseAudit && donor.licenseAudit.status === 'complete' &&
          !nonEmptyString(donor.licenseAudit.spdxLicense) &&
          !nonEmptyString(donor.licenseAudit.compatibilityEvidence)) {
        errors.push(prefix + ' cannot be adopted without SPDX or license compatibility evidence');
      }
    }
  });

  return errors;
}

async function main() {
  let registry;
  try {
    registry = JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    console.error('[FAIL] Could not read donor registry: ' + String(error));
    process.exitCode = 1;
    return;
  }

  const errors = validateDonorRegistry(registry);
  if (errors.length) {
    console.error('[FAIL] Upstream donor registry has ' + errors.length + ' issue(s):');
    for (const error of errors) console.error(' - ' + error);
    process.exitCode = 1;
    return;
  }

  console.log('[PASS] ' + registry.donors.length +
    ' donor records pass structural/evidence-gate checks. This is not an upstream code, license, test, or performance audit.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
