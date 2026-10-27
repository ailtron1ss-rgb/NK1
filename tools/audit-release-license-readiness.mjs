#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const isSha256 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0 && value.trim().toLowerCase() !== "pending";

function normalizedLicenseEvidence(component) {
  const licenses = Array.isArray(component.licenses) ? component.licenses.map((entry) => {
    if (entry && typeof entry.expression === "string") return { expression: entry.expression };
    if (entry && entry.license && typeof entry.license.id === "string") return { id: entry.license.id };
    if (entry && entry.license && typeof entry.license.name === "string") return { name: entry.license.name };
    return { unknown: true };
  }) : [];
  licenses.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return { bomRef: component.bomRef, name: component.name, version: component.version, purl: component.purl, licenses };
}

export function fingerprintLockedNpmComponents(sbom) {
  const components = (sbom?.components || [])
    .filter(c => typeof c?.bomRef === "string" && c.bomRef.startsWith("npm:"))
    .map(normalizedLicenseEvidence)
    .sort((a,b) => String(a.bomRef).localeCompare(String(b.bomRef)));
  return { sha256: sha256(JSON.stringify(components)), count: components.length };
}

function validReviewTimestamp(value, now) {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= now.getTime();
}

function validateDecision(errors, label, item, now, options = {}) {
  const needsLicense = options.needsLicense !== false;
  const needsRedistribution = options.needsRedistribution !== false;
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    errors.push(label + ": review record missing");
    return;
  }
  if (item.status !== "approved") errors.push(label + ": status must be approved");
  if (needsLicense && !nonEmpty(item.licenseExpression)) errors.push(label + ": explicit licenseExpression required");
  if (needsRedistribution && item.redistributionApproved !== true) errors.push(label + ": redistributionApproved must be true");
  if (item.reviewerType !== "human") errors.push(label + ": reviewerType must be human");
  if (!nonEmpty(item.reviewer)) errors.push(label + ": named human reviewer required");
  if (!validReviewTimestamp(item.reviewedAt, now)) errors.push(label + ": valid non-future ISO timestamp required");
  if (!nonEmpty(item.evidenceRef)) errors.push(label + ": evidenceRef required");
}

async function readJson(root, rel, errors) {
  try {
    return JSON.parse(await readFile(path.join(root, rel), "utf8"));
  } catch (error) {
    errors.push("input:" + rel + ": " + String(error?.message || error).slice(0, 220));
    return null;
  }
}

function checkCoverage(errors, label, currentRows, reviewedRows, now) {
  const current = Array.isArray(currentRows) ? currentRows : [];
  const reviewed = Array.isArray(reviewedRows) ? reviewedRows : [];
  const currentMap = new Map();
  for (const row of current) {
    if (!row || typeof row.path !== "string" || !row.path) {
      errors.push(label + ": current inventory contains an invalid path");
      continue;
    }
    if (currentMap.has(row.path)) errors.push(label + ": duplicate current inventory path " + row.path);
    currentMap.set(row.path, row);
    if (!isSha256(row.sha256)) errors.push(label + ": current inventory hash invalid for " + row.path);
  }
  const reviewedMap = new Map();
  for (const row of reviewed) {
    if (!row || typeof row.path !== "string" || !row.path) {
      errors.push(label + ": manifest contains an invalid path");
      continue;
    }
    if (reviewedMap.has(row.path)) errors.push(label + ": duplicate manifest review path " + row.path);
    reviewedMap.set(row.path, row);
  }
  for (const [filePath, source] of currentMap) {
    const review = reviewedMap.get(filePath);
    if (!review) {
      errors.push(label + ": no human review record for " + filePath);
      continue;
    }
    if (review.sha256 !== source.sha256) errors.push(label + ": stale hash for " + filePath + "; human review must be renewed");
    validateDecision(errors, label + ":" + filePath, review, now);
  }
  for (const filePath of reviewedMap.keys()) {
    if (!currentMap.has(filePath)) errors.push(label + ": stale review entry no longer exists in current inventory: " + filePath);
  }
}

export async function auditReleaseLicenseReadiness({ root = defaultRoot, now = new Date() } = {}) {
  const errors = [];
  const superVersion = await readJson(root, "SUPER_VERSION.json", errors);
  const sbom = await readJson(root, "contracts/SBOM.final.json", errors);
  const manifest = await readJson(root, "contracts/RELEASE_LICENSE_REVIEW.json", errors);
  const build = String(superVersion?.build || "");
  const workpassMatch = build.match(/WORKPASS(\d+)/i);
  const workpass = workpassMatch ? Number(workpassMatch[1]) : 0;
  if (!workpass) errors.push("SUPER_VERSION.build must declare a WORKPASS lineage tag");

  const provenancePath = workpass ? "contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS" + workpass + ".json" : "";
  const provenance = provenancePath ? await readJson(root, provenancePath, errors) : null;
  if (!sbom) errors.push("SBOM.final.json is required");
  if (sbom && (sbom.bomFormat !== "CycloneDX" || !Array.isArray(sbom.components))) {
    errors.push("SBOM.final.json must be a CycloneDX inventory with components");
  }
  if (!provenance) errors.push("current WorkPass source-provenance inventory is required");

  const fingerprint = sbom ? fingerprintLockedNpmComponents(sbom) : { sha256: "", count: 0 };
  const generatedAt = Date.parse(provenance?.generatedAt || "");
  const ageMs = now.getTime() - generatedAt;
  const maxAgeMs = 15 * 60 * 1000;
  if (!Number.isFinite(generatedAt) || ageMs < -5000 || ageMs > maxAgeMs) {
    errors.push("current source-provenance inventory is stale or has an invalid generatedAt; run test:provenance-current first");
  }
  const bomTimestamp = Date.parse(sbom?.metadata?.timestamp || "");
  const bomAgeMs = now.getTime() - bomTimestamp;
  if (!Number.isFinite(bomTimestamp) || bomAgeMs < -5000 || bomAgeMs > maxAgeMs) {
    errors.push("SBOM timestamp is stale or invalid; run test:provenance-current first");
  }
  const sbomWorkpass = String(sbom?.metadata?.component?.version || "").match(/workpass(\d+)/i)?.[1];
  if (workpass && sbomWorkpass && Number(sbomWorkpass) !== workpass) {
    errors.push("SBOM metadata version does not match the current SUPER_VERSION WorkPass");
  }
  const declaredDependencyCount = Number(provenance?.dependencySummary?.lockedNpmComponents);
  if (!Number.isSafeInteger(declaredDependencyCount) || declaredDependencyCount !== fingerprint.count) {
    errors.push("SBOM locked npm component count does not match source-provenance inventory");
  }

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    errors.push("RELEASE_LICENSE_REVIEW.json must be an object");
  } else {
    if (manifest.schemaVersion !== 1) errors.push("RELEASE_LICENSE_REVIEW.json schemaVersion must be 1");
    if (manifest.status !== "approved") errors.push("global release license review must be approved by a human");
    validateDecision(errors, "global review", manifest.review, now, { needsLicense: false, needsRedistribution: false });
    validateDecision(errors, "root project", manifest.rootProject, now);
    validateDecision(errors, "runtime project", manifest.runtimeProject, now);

    const dependencyReview = manifest.lockedNpmDependencies;
    validateDecision(errors, "locked npm dependency inventory", dependencyReview, now, { needsLicense: false, needsRedistribution: false });
    if (dependencyReview?.componentFingerprintSha256 !== fingerprint.sha256) {
      errors.push("locked npm dependency fingerprint changed or was not reviewed; current=" + fingerprint.sha256);
    }
    if (Number(dependencyReview?.componentCount) !== fingerprint.count) {
      errors.push("locked npm dependency componentCount does not match current SBOM");
    }
    checkCoverage(errors, "source archives", provenance?.sourceArchives, manifest.sourceArchives, now);
    checkCoverage(errors, "repository license files", provenance?.repositoryLicenseFiles, manifest.repositoryLicenseFiles, now);
  }

  return {
    ok: errors.length === 0,
    releaseRedistributionReady: errors.length === 0,
    workpass,
    generatedAt: provenance?.generatedAt || null,
    dependencyFingerprintSha256: fingerprint.sha256 || null,
    dependencyComponentCount: fingerprint.count,
    archiveCount: Array.isArray(provenance?.sourceArchives) ? provenance.sourceArchives.length : 0,
    repositoryLicenseFileCount: Array.isArray(provenance?.repositoryLicenseFiles) ? provenance.repositoryLicenseFiles.length : 0,
    errorCount: errors.length,
    errors,
    policy: "Fail closed: no license or redistribution permission is inferred from a detected license file."
  };
}

async function main() {
  const args = process.argv.slice(2);
  let root = defaultRoot;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--root" && args[i + 1]) root = path.resolve(args[++i]);
    else if (args[i].startsWith("--root=")) root = path.resolve(args[i].slice("--root=".length));
    else {
      console.error("Unknown argument: " + args[i]);
      process.exit(2);
    }
  }
  const report = await auditReleaseLicenseReadiness({ root });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
    process.exitCode = 1;
  });
}
