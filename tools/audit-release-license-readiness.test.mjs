import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fingerprintLockedNpmComponents, auditReleaseLicenseReadiness } from "./audit-release-license-readiness.mjs";

const now = new Date("2026-10-27T14:00:00.000Z");
const reviewed = (licenseExpression = "MIT") => ({
  status: "approved",
  licenseExpression,
  redistributionApproved: true,
  reviewerType: "human",
  reviewer: "Human License Reviewer",
  reviewedAt: "2026-10-27T13:00:00.000Z",
  evidenceRef: "docs/RELEASE_LICENSE_REVIEW_RU.md"
});
const decidedGroup = () => ({
  status: "approved",
  reviewerType: "human",
  reviewer: "Human License Reviewer",
  reviewedAt: "2026-10-27T13:00:00.000Z",
  evidenceRef: "docs/RELEASE_LICENSE_REVIEW_RU.md"
});
function makeFixture() {
  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    metadata: { timestamp: now.toISOString(), component: { version: "35.0.0-super-workpass70" } },
    components: [
      { type: "library", bomRef: "npm:node_modules/example-a@1.0.0", name: "example-a", version: "1.0.0", purl: "pkg:npm/example-a@1.0.0", licenses: [{ license: { id: "MIT" } }] },
      { type: "library", bomRef: "npm:node_modules/example-b@2.0.0", name: "example-b", version: "2.0.0", purl: "pkg:npm/example-b@2.0.0", licenses: [{ license: { id: "Apache-2.0" } }] },
      { type: "file", bomRef: "file:archive.zip", name: "archive.zip", version: "archived-source-snapshot" }
    ]
  };
  const provenance = {
    generatedAt: now.toISOString(),
    dependencySummary: { lockedNpmComponents: 2 },
    sourceArchives: [
      { path: "legacy/archive-a.zip", sha256: "a".repeat(64), licenseReview: "license-not-detected-in-top-level-members", embeddedLicenses: [] },
      { path: "legacy/archive-b.zip", sha256: "b".repeat(64), licenseReview: "license-evidence-found-not-a-legal-conclusion", embeddedLicenses: [{ member: "archive-b/LICENSE" }] }
    ],
    repositoryLicenseFiles: [
      { path: "runtime/neuro-kurisu/LICENSE", sha256: "c".repeat(64), status: "license-text-present-id-needs-review" }
    ]
  };
  const fingerprint = fingerprintLockedNpmComponents(sbom);
  const manifest = {
    schemaVersion: 1,
    policy: "NK1 source redistribution and dependency license readiness",
    status: "approved",
    review: decidedGroup(),
    rootProject: { ...reviewed("MIT"), scope: "repository-root" },
    runtimeProject: { ...reviewed("MIT"), scope: "runtime/neuro-kurisu" },
    lockedNpmDependencies: { ...decidedGroup(), componentCount: fingerprint.count, componentFingerprintSha256: fingerprint.sha256 },
    sourceArchives: provenance.sourceArchives.map(x => ({ ...reviewed("MIT"), path: x.path, sha256: x.sha256 })),
    repositoryLicenseFiles: provenance.repositoryLicenseFiles.map(x => ({ ...reviewed("MIT"), path: x.path, sha256: x.sha256 }))
  };
  return { sbom, provenance, manifest };
}
async function writeJson(root, rel, value) {
  const full = path.join(root, rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, JSON.stringify(value, null, 2) + "\n", "utf8");
}
async function withFixture(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "nk1-license-readiness-"));
  try {
    await writeJson(root, "SUPER_VERSION.json", { build: "v35.0-UNIFIED-WORKPASS70" });
    const f = makeFixture();
    await writeJson(root, "contracts/SBOM.final.json", f.sbom);
    await writeJson(root, "contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS70.json", f.provenance);
    await writeJson(root, "contracts/RELEASE_LICENSE_REVIEW.json", f.manifest);
    await run({ root, ...f });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("pending human licensing decisions block release redistribution", async () => {
  await withFixture(async ({ root }) => {
    const manifest = JSON.parse(await readFile(path.join(root, "contracts/RELEASE_LICENSE_REVIEW.json"), "utf8"));
    manifest.status = "pending";
    manifest.review.status = "pending";
    manifest.rootProject.status = "pending";
    manifest.rootProject.redistributionApproved = false;
    manifest.sourceArchives[0].status = "pending";
    await writeJson(root, "contracts/RELEASE_LICENSE_REVIEW.json", manifest);
    const report = await auditReleaseLicenseReadiness({ root, now });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some(e => e.includes("global release license review must be approved")));
    assert.ok(report.errors.some(e => e.includes("root project: status must be approved")));
    assert.ok(report.errors.some(e => e.includes("source archives:legacy/archive-a.zip: status must be approved")));
  });
});

test("a fully reviewed hash-bound manifest passes its license readiness gate", async () => {
  await withFixture(async ({ root }) => {
    const report = await auditReleaseLicenseReadiness({ root, now });
    assert.equal(report.ok, true, JSON.stringify(report.errors));
    assert.equal(report.releaseRedistributionReady, true);
    assert.equal(report.dependencyComponentCount, 2);
    assert.equal(report.archiveCount, 2);
    assert.equal(report.repositoryLicenseFileCount, 1);
  });
});

test("changed archive hash invalidates a previous approval", async () => {
  await withFixture(async ({ root }) => {
    const provenance = JSON.parse(await readFile(path.join(root, "contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS70.json"), "utf8"));
    provenance.sourceArchives[0].sha256 = "d".repeat(64);
    await writeJson(root, "contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS70.json", provenance);
    const report = await auditReleaseLicenseReadiness({ root, now });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some(e => e.includes("stale hash for legacy/archive-a.zip")));
  });
});

test("new repository license evidence without a review record blocks release", async () => {
  await withFixture(async ({ root }) => {
    const manifest = JSON.parse(await readFile(path.join(root, "contracts/RELEASE_LICENSE_REVIEW.json"), "utf8"));
    manifest.repositoryLicenseFiles = [];
    await writeJson(root, "contracts/RELEASE_LICENSE_REVIEW.json", manifest);
    const report = await auditReleaseLicenseReadiness({ root, now });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some(e => e.includes("no human review record for runtime/neuro-kurisu/LICENSE")));
  });
});

test("dependency fingerprint changes require a new review", async () => {
  await withFixture(async ({ root }) => {
    const sbom = JSON.parse(await readFile(path.join(root, "contracts/SBOM.final.json"), "utf8"));
    sbom.components[0].version = "1.0.1";
    await writeJson(root, "contracts/SBOM.final.json", sbom);
    const report = await auditReleaseLicenseReadiness({ root, now });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some(e => e.includes("locked npm dependency fingerprint changed or was not reviewed")));
  });
});

test("stale provenance cannot satisfy current release gate", async () => {
  await withFixture(async ({ root }) => {
    const provenance = JSON.parse(await readFile(path.join(root, "contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS70.json"), "utf8"));
    provenance.generatedAt = "2026-10-01T00:00:00.000Z";
    await writeJson(root, "contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS70.json", provenance);
    const report = await auditReleaseLicenseReadiness({ root, now });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some(e => e.includes("source-provenance inventory is stale")));
  });
});

test("a report freshly generated at release start survives a long audit pass", async () => {
  await withFixture(async ({ root }) => {
    const agedAt = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    const sbom = JSON.parse(await readFile(path.join(root, "contracts/SBOM.final.json"), "utf8"));
    const provenance = JSON.parse(await readFile(path.join(root, "contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS70.json"), "utf8"));
    sbom.metadata.timestamp = agedAt;
    provenance.generatedAt = agedAt;
    await writeJson(root, "contracts/SBOM.final.json", sbom);
    await writeJson(root, "contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS70.json", provenance);
    const report = await auditReleaseLicenseReadiness({ root, now });
    assert.equal(report.ok, true, JSON.stringify(report.errors));
  });
});
