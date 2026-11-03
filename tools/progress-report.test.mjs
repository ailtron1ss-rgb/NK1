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
  symlinkSync(outsideDir, join(fixtureDir, 'outside-package-dir'));
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
        { id: 'absolute-path', kind: 'file-exists', path: outsideEvidence },
        { id: 'windows-drive-path', kind: 'file-exists', path: 'C:\\outside\\evidence.json' },
        { id: 'dotdot-alias', kind: 'file-exists', path: 'runtime/neuro-kurisu/tests/../../README.md' },
        { id: 'outside-contains', kind: 'file-contains', path: outsideRelative(outsideEvidence), needle: report.currentSha },
        { id: 'outside-evidence', kind: 'evidence-json', path: outsideRelative(outsideEvidence) },
        { id: 'outside-glob', kind: 'glob', path: outsideRelative(join(outsideDir, '*.json')) },
        { id: 'inside-glob-symlink', kind: 'glob', path: outsideRelative(join(fixtureDir, 'outside-*.json')) },
        { id: 'outside-script', kind: 'npm-script', prefix: outsideRelative(outsideDir), script: 'outside-probe' },
        { id: 'symlinked-package-dir', kind: 'npm-script', prefix: outsideRelative(join(fixtureDir, 'outside-package-dir')), script: 'outside-probe' },
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
  assert.equal(securityReport.workstreams[0].artifactTotal, 8,
    'file/evidence/glob probes must all reject paths outside the repository');
  assert.equal(securityReport.workstreams[0].testHarnessTotal, 2);
  assert.equal(securityReport.workstreams[0].testHarnessPassed, 0,
    'npm-script probes must not read package manifests outside the repository');
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
  rmSync(outsideDir, { recursive: true, force: true });
}

// Evidence recorded at an older commit is kept valid only while it declares the paths
// it covers and none of them changed. This must not become a way to resurrect stale
// proof: an artifact with no declared coverage, or one whose SHA is not an ancestor of
// HEAD, must still fail even when it says verified:true.
const evidenceDir = mkdtempSync(join(root, 'runtime/neuro-kurisu/tests/.progress-report-evidence-'));
try {
  const rel = (value) => relative(root, value).split(sep).join('/');
  const writeArtifact = (name, body) => { const p = join(evidenceDir, name); writeFileSync(p, JSON.stringify(body)); return rel(p); };
  const staleNoCoverage = writeArtifact('stale-no-coverage.json', { verified: true, sha: '0'.repeat(40), metrics: { x: 1 } });
  const staleWithCoverage = writeArtifact('stale-with-coverage.json', { verified: true, sha: '0'.repeat(40), coversPaths: ['runtime/neuro-kurisu'], metrics: { x: 1 } });
  const exactHead = writeArtifact('exact-head.json', { verified: true, sha: report.currentSha, metrics: { x: 1 } });
  // A genuine ancestor SHA whose covered paths did not change must count: this is the
  // positive half of the contract, without which the change would just be stricter.
  const parentSha = spawnSync('git', ['rev-parse', 'HEAD~1'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  const ancestorCovered = writeArtifact('ancestor-covered.json', { verified: true, sha: parentSha, coversPaths: ['runtime/neuro-kurisu/src/organism/analysis/DangerModel.ts'], metrics: { x: 1 } });
  const contractPath = join(evidenceDir, 'evidence-contract.json');
  writeFileSync(contractPath, JSON.stringify({
    schema: 'nk1.progress-workstreams.v1',
    workstreams: [{
      id: 'evidence-validity',
      title: 'Evidence validity regression',
      weight: 1,
      probes: [],
      evidenceProbes: [
        { id: 'stale-no-coverage', kind: 'evidence-json', path: staleNoCoverage, requirements: [{ path: 'metrics.x', op: 'gte', value: 1 }] },
        { id: 'stale-with-coverage', kind: 'evidence-json', path: staleWithCoverage, requirements: [{ path: 'metrics.x', op: 'gte', value: 1 }] },
        { id: 'exact-head', kind: 'evidence-json', path: exactHead, requirements: [{ path: 'metrics.x', op: 'gte', value: 1 }] },
        { id: 'ancestor-covered', kind: 'evidence-json', path: ancestorCovered, requirements: [{ path: 'metrics.x', op: 'gte', value: 1 }] },
      ],
    }],
  }));
  const evidenceRun = spawnSync(process.execPath, ['tools/progress-report.mjs', '--json', '--contract', rel(contractPath)], { cwd: root, encoding: 'utf8' });
  assert.equal(evidenceRun.status, 0, 'evidence-validity contract must not crash the report: ' + evidenceRun.stderr);
  const evidenceReport = JSON.parse(evidenceRun.stdout);
  assert.equal(evidenceReport.workstreams[0].evidencePassed, 2,
    'only evidence matching the current head may count: stale SHA without coverage and non-ancestor SHA must both fail, while exact-head and covered-ancestor evidence pass');
  assert.equal(evidenceReport.workstreams[0].evidenceTotal, 4);
} finally {
  rmSync(evidenceDir, { recursive: true, force: true });
}

console.log('NK1_PROGRESS_REPORT=PASS artifactCoverage=' + report.artifactCoveragePercent + '% verifiedEfficacy=' + report.verifiedEfficacyPercent + '% sha=' + report.currentSha.slice(0, 12));
