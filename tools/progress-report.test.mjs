import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

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

console.log('NK1_PROGRESS_REPORT=PASS artifactCoverage=' + report.artifactCoveragePercent + '% verifiedEfficacy=' + report.verifiedEfficacyPercent + '% sha=' + report.currentSha.slice(0, 12));
