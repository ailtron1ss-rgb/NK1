import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve, join, relative, sep } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const run = spawnSync(process.execPath, ['tools/progress-report.mjs', '--json'], { cwd: root, encoding: 'utf8' });
assert.equal(run.status, 0, 'progress report must execute: ' + run.stderr);
const report = JSON.parse(run.stdout);
assert.equal(report.schema, 'nk1.progress-report.v2');
assert.match(report.currentSha, /^[0-9a-f]{40}$/);
assert.ok(Number.isInteger(report.artifactCoveragePercent));
assert.ok(Number.isInteger(report.testHarnessCoveragePercent));
assert.ok(Number.isInteger(report.verifiedEfficacyPercent));
assert.ok(report.artifactCoveragePercent >= 0 && report.artifactCoveragePercent <= 100);
assert.ok(report.verifiedEfficacyPercent >= 0 && report.verifiedEfficacyPercent <= 100);
assert.ok(report.workstreams.length >= 9);
if (report.workstreams.some((row) => row.testHarnessTotal === 0)) {
  assert.ok(report.testHarnessCoveragePercent < 100,
    'workstreams with no declared test entrypoint must reduce aggregate harness coverage');
}
assert.ok(report.workstreams.every((row) => row.evidenceTotal > 0), 'every workstream must have an explicit efficacy evidence gate');

// Existing evidence files belong to earlier SHAs. They must not count as proof for
// this commit merely because a JSON file or a verified:true string exists.
const ci = report.workstreams.find((row) => row.id === 'W8-evidence-and-ci');
assert.ok(ci);
assert.equal(ci.evidencePercent, 0, 'stale exact-head CI evidence must not count for this SHA');
assert.ok(ci.artifactMissing.some((detail) => detail.includes('local-gate')), 'a local-gate artifact from another SHA must not satisfy the current-head probe');


// Contract-controlled paths must never read files outside the repository, even
// when the external file looks like valid evidence or a valid package manifest.
const outsideDir = mkdtempSync(join(tmpdir(), 'nk1-progress-report-outside-'));
const fixtureDir = mkdtempSync(join(root, 'runtime/neuro-kurisu/tests/.progress-report-path-'));
try {
  const outsideEvidence = join(outsideDir, 'evidence.json');
  const outsidePackage = join(outsideDir, 'package.json');
  writeFileSync(outsideEvidence, JSON.stringify({ verified: true, sha: report.currentSha }));
  writeFileSync(outsidePackage, JSON.stringify({ scripts: { 'outside-probe': 'echo unsafe' } }));
  symlinkSync(outsideEvidence, join(fixtureDir, 'outside-evidence.json'));
  const outsideRelative = (value) => relative(root, value).split(sep).join('/');
  const contractPath = join(fixtureDir, 'contract.json');
  const maliciousContract = {
    schema: 'nk1.progress-workstreams.v1',
    workstreams: [{
      id: 'path-confinement',
      title: 'Path confinement regression',
      weight: 1,
      probes: [
        { id: 'outside-exists', kind: 'file-exists', path: outsideRelative(outsideEvidence) },
        { id: 'outside-contains', kind: 'file-contains', path: outsideRelative(outsideEvidence), needle: report.currentSha },
        { id: 'outside-evidence', kind: 'evidence-json', path: outsideRelative(outsideEvidence) },
        { id: 'outside-glob', kind: 'glob', path: outsideRelative(join(outsideDir, '*.json')) },
        { id: 'inside-glob-symlink', kind: 'glob', path: outsideRelative(join(fixtureDir, 'outside-*.json')) },
        { id: 'outside-script', kind: 'npm-script', prefix: outsideRelative(outsideDir), script: 'outside-probe' },
      ],
      evidenceProbes: [],
    }],
  };
  writeFileSync(contractPath, JSON.stringify(maliciousContract));
  const securityRun = spawnSync(process.execPath, [
    'tools/progress-report.mjs', '--json', '--contract', outsideRelative(contractPath),
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(securityRun.status, 0, 'malicious contract paths must be rejected as failed probes, not crash the report: ' + securityRun.stderr);
  const securityReport = JSON.parse(securityRun.stdout);
  assert.equal(securityReport.workstreams[0].artifactPassed, 0,
    'all probes attempting to escape the repository must fail closed');
  assert.equal(securityReport.workstreams[0].artifactTotal, 6);
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
  rmSync(outsideDir, { recursive: true, force: true });
}

console.log('NK1_PROGRESS_REPORT=PASS artifactCoverage=' + report.artifactCoveragePercent + '% verifiedEfficacy=' + report.verifiedEfficacyPercent + '% sha=' + report.currentSha.slice(0, 12));
