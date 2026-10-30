#!/usr/bin/env node
import { readFile, readdir, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, "..");

export async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function add(checks, id, pass, detail, severity = "blocking") {
  checks.push({ id, pass: Boolean(pass), severity, detail: String(detail ?? "") });
}

async function walk(root, relative = "", output = []) {
  const ignored = new Set([".git", "node_modules", ".super-state", "state", "backups", "dist", "coverage", ".cache", "legacy/input-archives"]);
  const absolute = path.join(root, relative);
  let entries;
  try { entries = await readdir(absolute, { withFileTypes: true }); }
  catch { return output; }
  for (const entry of entries) {
    const rel = relative ? path.posix.join(relative.split(path.sep).join("/"), entry.name) : entry.name;
    if (ignored.has(entry.name) || rel.startsWith("legacy/input-archives/")) continue;
    const file = path.join(root, rel);
    if (entry.isDirectory()) await walk(root, rel, output);
    else output.push({ absolute: file, relative: rel.split(path.sep).join("/") });
  }
  return output;
}

function collectPendingReviews(value, pathLabel = "$", output = []) {
  if (!value || typeof value !== "object") return output;
  if (!Array.isArray(value) && typeof value.status === "string" && value.status.toLowerCase() !== "approved") {
    output.push({ path: pathLabel, status: value.status });
  }
  if (!Array.isArray(value) && value.redistributionApproved === false) {
    output.push({ path: pathLabel, status: "redistribution-not-approved" });
  }
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object") collectPendingReviews(child, Array.isArray(value) ? `${pathLabel}[${key}]` : `${pathLabel}.${key}`, output);
  }
  return output;
}

export async function buildReadinessReport(root = defaultRoot) {
  const checks = [];
  const required = [
    ".nvmrc", "package.json", "SUPER_VERSION.json",
    "app/package.json", "app/package-lock.json",
    "runtime/neuro-kurisu/package.json", "runtime/neuro-kurisu/package-lock.json",
    "contracts/RELEASE_LICENSE_REVIEW.json",
  ];
  for (const file of required) {
    try { await lstat(path.join(root, file)); add(checks, `required:${file}`, true, "present"); }
    catch { add(checks, `required:${file}`, false, "missing"); }
  }

  let rootPackage, appPackage, appLock, runtimePackage, runtimeLock, version, licenseReview;
  try { rootPackage = await readJson(root, "package.json"); } catch {}
  try { appPackage = await readJson(root, "app/package.json"); } catch {}
  try { appLock = await readJson(root, "app/package-lock.json"); } catch {}
  try { runtimePackage = await readJson(root, "runtime/neuro-kurisu/package.json"); } catch {}
  try { runtimeLock = await readJson(root, "runtime/neuro-kurisu/package-lock.json"); } catch {}
  try { version = await readJson(root, "SUPER_VERSION.json"); } catch {}
  try { licenseReview = await readJson(root, "contracts/RELEASE_LICENSE_REVIEW.json"); } catch {}

  let nodePin = "";
  try { nodePin = (await readFile(path.join(root, ".nvmrc"), "utf8")).trim(); } catch {}
  add(checks, "runtime:node-pin", /^(?:\d+|\d+\.\d+\.\d+)$/.test(nodePin), `.nvmrc=${nodePin || "missing"}`);
  add(checks, "project:private-root", rootPackage?.private === true, `private=${String(rootPackage?.private)}`);
  add(checks, "project:version-alignment", Boolean(rootPackage && version && rootPackage.version === version.version),
    `package.json=${rootPackage?.version ?? "missing"}; SUPER_VERSION=${version?.version ?? "missing"}`);

  for (const [name, pkg, lock] of [["app", appPackage, appLock], ["runtime", runtimePackage, runtimeLock]]) {
    const lockedRoot = lock?.packages?.[""];
    add(checks, `lock:${name}:root`, Boolean(lockedRoot), "lockfile root package record");
    if (pkg && lockedRoot) {
      add(checks, `lock:${name}:name`, pkg.name === lockedRoot.name, `manifest=${pkg.name}; lock=${lockedRoot.name}`);
      add(checks, `lock:${name}:version`, (pkg.version ?? null) === (lockedRoot.version ?? null),
        `manifest=${pkg.version ?? "unset"}; lock=${lockedRoot.version ?? "unset"}`);
      add(checks, `lock:${name}:dependencies`,
        JSON.stringify(pkg.dependencies ?? {}) === JSON.stringify(lockedRoot.dependencies ?? {}) &&
        JSON.stringify(pkg.devDependencies ?? {}) === JSON.stringify(lockedRoot.devDependencies ?? {}),
        "manifest and lock root dependency declarations");
    }
    add(checks, `lock:${name}:lockfile-version`, Number.isInteger(lock?.lockfileVersion) && lock.lockfileVersion >= 2,
      `lockfileVersion=${lock?.lockfileVersion ?? "missing"}`);
  }

  const releaseStatus = String(version?.releaseStatus ?? "");
  add(checks, "release:not-falsely-marked-ready", /implementation-workpass/i.test(releaseStatus) && !/release.ready/i.test(releaseStatus),
    `releaseStatus=${releaseStatus || "missing"}`, "advisory");

  const pendingReviews = licenseReview ? collectPendingReviews(licenseReview) : [{ path: "$", status: "manifest-unavailable" }];
  add(checks, "release:human-license-clearance", pendingReviews.length === 0,
    pendingReviews.length ? `${pendingReviews.length} pending/unapproved review record(s); no approval was inferred` : "all review records explicitly approved", "advisory");

  const files = await walk(root);
  const declaredLicensePaths = new Set((licenseReview?.repositoryLicenseFiles ?? [])
    .map(record => typeof record?.path === "string" ? record.path.replaceAll("\\\\", "/") : null)
    .filter(Boolean));
  const uncoveredLicenseFiles = files
    .filter(file => /(?:^|\\/)(?:LICENSE|NOTICE)(?:\\.[^/]*)?$/i.test(file.relative))
    .map(file => file.relative)
    .filter(file => !declaredLicensePaths.has(file));
  add(checks, "release:license-inventory-coverage", uncoveredLicenseFiles.length === 0,
    uncoveredLicenseFiles.length
      ? `${uncoveredLicenseFiles.length} LICENSE/NOTICE file(s) lack review-manifest records: ${uncoveredLicenseFiles.join("; ")}`
      : "all repository LICENSE/NOTICE files are represented in the review manifest", "advisory");

  const hygieneIssues = [];
  for (const file of files) {
    const rel = file.relative;
    if (/(^|\/)__pycache__(\/|$)|\.pyc$/i.test(rel)) hygieneIssues.push(`python-cache:${rel}`);
    if (/(^|\/)(?:\.DS_Store|Thumbs\.db)$/i.test(rel)) hygieneIssues.push(`os-junk:${rel}`);
    if (/(^|\/)(?:\.env|\.env\.[^.]+)$/i.test(rel) && !/(?:\.env\.example|\.env\.template)$/i.test(rel)) hygieneIssues.push(`environment-secret-file:${rel}`);
    if (/(?:^|\/)(?:id_rsa|id_ed25519|server\.key|private-key\.pem)$/i.test(rel) || /(?:service-account|gmail-credentials)\.json$/i.test(rel)) hygieneIssues.push(`credential-shaped-file:${rel}`);
    if (/\.(?:pem|p12|pfx)$/i.test(rel)) hygieneIssues.push(`private-key-container:${rel}`);
  }
  add(checks, "source:hygiene", hygieneIssues.length === 0,
    hygieneIssues.length ? hygieneIssues.join("; ") : `${files.length} source files scanned (archives and generated folders excluded)`);

  const blockingFailures = checks.filter(check => !check.pass && check.severity === "blocking");
  const advisoryFailures = checks.filter(check => !check.pass && check.severity === "advisory");
  return {
    schemaVersion: 1,
    aspect: 12,
    generatedAt: new Date().toISOString(),
    root: path.resolve(root),
    status: blockingFailures.length ? "BLOCKED" : "STRUCTURAL_PASS",
    summary: { checks: checks.length, passed: checks.filter(x => x.pass).length, blockingFailures: blockingFailures.length,
      advisoryFailures: advisoryFailures.length, pendingLicenseReviews: pendingReviews.length, scannedFiles: files.length },
    releaseClearance: pendingReviews.length ? "HUMAN_REVIEW_REQUIRED" : "LICENSE_RECORDS_APPROVED",
    pendingReviews,
    checks,
    limitations: [
      "This local audit does not prove browser rendering, real-device behavior, performance under load, backup restoration, or release-asset freshness.",
      "A pending license review is a real release blocker; the tool never invents human approval or legal permission.",
      "STRUCTURAL_PASS is not equivalent to release approval.",
    ],
  };
}

function parseArgs(argv) {
  const options = { root: defaultRoot, requireReleaseReady: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      if (!argv[index + 1]) throw new Error("--root requires a directory");
      options.root = path.resolve(argv[++index]);
    } else if (arg.startsWith("--root=")) options.root = path.resolve(arg.slice(7));
    else if (arg === "--require-release-ready") options.requireReleaseReady = true;
    else if (arg === "--help") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: node tools/aspect12-release-readiness.mjs [--root DIR] [--require-release-ready]");
    return;
  }
  const report = await buildReadinessReport(options.root);
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "BLOCKED" || (options.requireReleaseReady && report.releaseClearance !== "LICENSE_RECORDS_APPROVED")) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; });
}
