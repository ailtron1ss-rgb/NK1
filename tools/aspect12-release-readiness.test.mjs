import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildReadinessReport } from "./aspect12-release-readiness.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "nk1-aspect12-"));
  for (const dir of ["app", "runtime/neuro-kurisu", "contracts"]) await mkdir(path.join(root, dir), { recursive: true });
  const put = async (file, value) => writeFile(path.join(root, file), typeof value === "string" ? value : JSON.stringify(value, null, 2));
  const rootPkg = { name: "nk1", version: "1.0.0", private: true, dependencies: {}, devDependencies: {} };
  const appPkg = { name: "app", version: "1.0.0", dependencies: { react: "19.0.0" }, devDependencies: {} };
  const runtimePkg = { name: "runtime", version: "2.0.0", dependencies: {}, devDependencies: {} };
  const lock = pkg => ({ name: pkg.name, version: pkg.version, lockfileVersion: 3, packages: { "": {
    name: pkg.name, version: pkg.version, dependencies: pkg.dependencies, devDependencies: pkg.devDependencies,
  } } });
  await put(".nvmrc", "24\n");
  await put("package.json", rootPkg);
  await put("SUPER_VERSION.json", { version: "1.0.0", releaseStatus: "implementation-workpass; release gates remain open" });
  await put("app/package.json", appPkg);
  await put("app/package-lock.json", lock(appPkg));
  await put("runtime/neuro-kurisu/package.json", runtimePkg);
  await put("runtime/neuro-kurisu/package-lock.json", lock(runtimePkg));
  await put("contracts/RELEASE_LICENSE_REVIEW.json", {
    status: "approved",
    review: { status: "approved", reviewerType: "human", reviewer: "Reviewer", reviewedAt: "2026-10-30T00:00:00Z", evidenceRef: "review-record" },
    rootProject: { status: "approved", redistributionApproved: true },
    runtimeProject: { status: "approved", redistributionApproved: true },
    lockedNpmDependencies: { status: "approved" },
    sourceArchives: [{ status: "approved", redistributionApproved: true }],
    repositoryLicenseFiles: [{ status: "approved", redistributionApproved: true }],
  });
  return root;
}

test("reports structural pass only when manifests and lock roots agree", async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const report = await buildReadinessReport(root);
  assert.equal(report.status, "STRUCTURAL_PASS");
  assert.equal(report.releaseClearance, "LICENSE_RECORDS_APPROVED");
  assert.equal(report.summary.blockingFailures, 0);
});

test("fails closed when a lockfile drifts from package manifest", async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "app/package-lock.json"), JSON.stringify({
    name: "app", version: "1.0.0", lockfileVersion: 3, packages: { "": {
      name: "app", version: "1.0.0", dependencies: { react: "18.0.0" }, devDependencies: {},
    } },
  }));
  const report = await buildReadinessReport(root);
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.checks.find(x => x.id === "lock:app:dependencies").pass, false);
});

test("does not infer human license approval from a missing or pending manifest", async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "contracts/RELEASE_LICENSE_REVIEW.json"), JSON.stringify({
    status: "pending", review: { status: "pending" }, sourceArchives: [{ status: "pending", redistributionApproved: false }],
  }));
  const report = await buildReadinessReport(root);
  assert.equal(report.releaseClearance, "HUMAN_REVIEW_REQUIRED");
  assert.ok(report.summary.pendingLicenseReviews >= 2);
  assert.equal(report.checks.find(x => x.id === "release:human-license-clearance").pass, false);
});

test("detects secret-shaped files and generated Python caches", async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "runtime/neuro-kurisu/__pycache__"), { recursive: true });
  await writeFile(path.join(root, "runtime/neuro-kurisu/.env"), "TOKEN=not-real");
  await writeFile(path.join(root, "runtime/neuro-kurisu/__pycache__/x.pyc"), "fixture");
  const report = await buildReadinessReport(root);
  assert.equal(report.checks.find(x => x.id === "source:hygiene").pass, false);
});

test("generated report is explicit that structural checks are not device or release proof", async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const report = await buildReadinessReport(root);
  assert.match(report.limitations.join(" "), /real-device behavior/);
  assert.match(report.limitations.join(" "), /release-asset freshness/);
});


test("reports repository LICENSE/NOTICE files missing from the human review inventory", async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const vendor = path.join(root, "runtime/neuro-kurisu/research/vendor/Example");
  await mkdir(vendor, { recursive: true });
  await writeFile(path.join(vendor, "LICENSE"), "Example license evidence");
  const report = await buildReadinessReport(root);
  const coverage = report.checks.find(x => x.id === "release:license-inventory-coverage");
  assert.equal(coverage.pass, false);
  assert.ok(coverage.detail.includes("research/vendor/Example/LICENSE"));
});

test("accepts complete repository LICENSE/NOTICE path coverage without inferring approval", async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const licensePath = "runtime/neuro-kurisu/LICENSE";
  await writeFile(path.join(root, licensePath), "Example license evidence");
  const manifestPath = path.join(root, "contracts/RELEASE_LICENSE_REVIEW.json");
  const manifest = JSON.parse(await (await import("node:fs/promises")).readFile(manifestPath, "utf8"));
  manifest.repositoryLicenseFiles[0].path = licensePath;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  const report = await buildReadinessReport(root);
  assert.equal(report.checks.find(x => x.id === "release:license-inventory-coverage").pass, true);
  assert.equal(report.releaseClearance, "LICENSE_RECORDS_APPROVED");
});
