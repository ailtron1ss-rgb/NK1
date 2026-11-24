import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serialize } from 'node:v8';
import { spawnSync } from 'node:child_process';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const root = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(root, '../scripts/memory-doctor.mjs');
const dir = await mkdtemp(path.join(tmpdir(), 'nk-memory-doctor-cli-'));
const statePath = path.join(dir, 'state.json');
const v8StatePath = path.join(dir, 'state.v8');
const memory = new MemoryOS2({ signalFusionProfile: 'balanced', embeddingProvider: null });
const now = Date.now();
memory.encode({
  id: 'cli-doctor-record',
  content: 'Memory doctor CLI fixture with a unique canonical record.',
  kind: 'semantic',
  source: 'workpass318-cli',
  tags: [],
  context: {},
  salience: .7,
  emotionalWeight: .1,
  identityRelevance: .2,
  goalRelevance: .3,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .9,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 1000,
  observedAt: now - 500,
});
const cleanState = { facets: { advanced: { memoryOS: memory.snapshot() } } };

const run = (file, format='json', maxIssues=8) => spawnSync(
  process.execPath,
  ['--experimental-strip-types', cliPath, file, '--max-issues=' + maxIssues],
  { encoding: 'utf8', env: { ...process.env, NEURO_STATE_FORMAT: format } },
);

try {
  await writeFile(statePath, JSON.stringify(cleanState), 'utf8');
  const clean = run(statePath);
  assert.equal(clean.status, 0, 'clean JSON state should return status 0');
  const cleanReport = JSON.parse(clean.stdout);
  assert.equal(cleanReport.tool, 'NK1-MemoryDoctor');
  assert.equal(cleanReport.readOnly, true);
  assert.equal(cleanReport.pass, true);
  assert.equal(cleanReport.source.format, 'json');

  await writeFile(v8StatePath, serialize(cleanState));
  const v8 = run(v8StatePath, 'v8');
  assert.equal(v8.status, 0, 'clean V8 state should return status 0');
  const v8Report = JSON.parse(v8.stdout);
  assert.equal(v8Report.source.format, 'v8');
  assert.equal(v8Report.pass, true);

  const damaged = structuredClone(cleanState);
  damaged.facets.advanced.memoryOS.items[0].contentHash = 'deliberately-corrupted-content-hash';
  damaged.facets.advanced.memoryOS.items[0].supersedesId = 'missing-revision-target';
  damaged.facets.advanced.memoryOS.items[0].semanticLinks = ['missing-semantic-target'];
  damaged.facets.advanced.memoryOS.items[0].observedAt = now + 3_600_000;
  await writeFile(statePath, JSON.stringify(damaged), 'utf8');
  const failed = run(statePath, 'json', 1);
  assert.equal(failed.status, 2, 'memory integrity errors should produce status 2');
  const failedReport = JSON.parse(failed.stdout);
  assert.equal(failedReport.readOnly, true);
  assert.equal(failedReport.pass, false);
  assert.equal(failedReport.issues.length, 1, 'CLI must preserve the configured report cap');
  assert.equal(failedReport.truncated, true);
  assert.ok(failedReport.counts.hashMismatch > 0);
  assert.ok(failedReport.counts.danglingRevision > 0);
  assert.ok(failedReport.counts.danglingLinks > 0);
  assert.ok(failedReport.counts.futureEvidence > 0);

  const fileAfter = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(fileAfter.facets.advanced.memoryOS.items[0].contentHash, 'deliberately-corrupted-content-hash',
    'doctor CLI must never silently repair or mutate the selected state file');

  const missing = run(path.join(dir, 'does-not-exist.json'));
  assert.equal(missing.status, 1, 'missing files should return a controlled non-zero status');
  assert.equal(JSON.parse(missing.stdout).error.code, 'memory-doctor-failed');

  console.log('WORKPASS318_MEMORY_DOCTOR_CLI=PASS', JSON.stringify({
    cleanJson: cleanReport.pass,
    cleanV8: v8Report.pass,
    damagedStatus: failed.status,
    cappedReport: failedReport.truncated,
    fileUnmodified: true,
  }));
} finally {
  await rm(dir, { recursive: true, force: true });
}
