#!/usr/bin/env node
/**
 * Computes NK1 progress from machine-checkable evidence probes.
 *
 * The repository has a long history of progress numbers that were not tied to
 * evidence: "80.1% weighted roadmap", "scorecard 46/100", plus many handover files
 * asserting readiness. Those numbers moved when documents were written. This tool
 * removes that failure mode by deriving every percentage from a probe that either
 * passes or does not, and by printing the failing probe next to each score so a
 * regression is visible.
 *
 * What this deliberately does NOT do:
 *   - it never runs a test (probes are cheap existence/content checks), so a green
 *     probe means "the artifact exists", not "the behaviour is proven";
 *   - it does not read self-reported status from handover documents;
 *   - it refuses to treat a prose file as proof of a capability.
 *
 * Usage: node tools/progress-report.mjs [--json] [--out <file>]
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CONTRACT = resolve(ROOT, 'contracts/progress-workstreams.json');

function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function globMatch(pattern, currentSha) {
  const dir = resolve(ROOT, dirname(pattern));
  const base = pattern.split('/').pop() ?? '';
  if (!existsSync(dir) || !currentSha) return false;
  const prefix = base.split('*')[0];
  const suffix = base.split('*').pop() ?? '';
  return readdirSync(dir).some((name) => {
    if (!name.startsWith(prefix) || !name.endsWith(suffix)) return false;
    try {
      const artifact = JSON.parse(readFileSync(resolve(dir, name), 'utf8'));
      return artifact.verified === true && artifact.sha === currentSha;
    } catch {
      return false;
    }
  });
}

function readEvidencePath(value, path) {
  let current = value;
  for (const key of String(path).split('.')) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, key)) return undefined;
    current = current[key];
  }
  return current;
}

function runEvidenceProbe(probe, currentSha) {
  try {
    const full = resolve(ROOT, probe.path);
    if (!existsSync(full)) return { ok: false, detail: `${probe.path} missing` };
    const artifact = JSON.parse(readFileSync(full, 'utf8'));
    if (artifact.verified !== true) return { ok: false, detail: `${probe.path} is not verified` };
    if (!currentSha || artifact.sha !== currentSha) return { ok: false, detail: `${probe.path} SHA is not the current HEAD` };
    for (const requirement of probe.requirements ?? []) {
      const actual = readEvidencePath(artifact, requirement.path);
      const expected = requirement.value;
      const passed = requirement.op === 'gt' ? typeof actual === 'number' && actual > expected
        : requirement.op === 'gte' ? typeof actual === 'number' && actual >= expected
        : requirement.op === 'lt' ? typeof actual === 'number' && actual < expected
        : requirement.op === 'lte' ? typeof actual === 'number' && actual <= expected
        : requirement.op === 'eq' ? actual === expected
        : false;
      if (!passed) return { ok: false, detail: `${probe.path} requirement failed: ${requirement.path} ${requirement.op} ${expected}` };
    }
    return { ok: true, detail: `${probe.path} verified for ${currentSha.slice(0, 12)}` };
  } catch (error) {
    return { ok: false, detail: `${probe.path} evidence error: ${error.message}` };
  }
}

function runProbe(probe, currentSha) {
  try {
    if (probe.kind === 'file-exists') {
      return { ok: existsSync(resolve(ROOT, probe.path)), detail: probe.path };
    }
    if (probe.kind === 'glob') {
      return { ok: globMatch(probe.path, currentSha), detail: `${probe.path} requires verified evidence for current HEAD` };
    }
    if (probe.kind === 'evidence-json') return runEvidenceProbe(probe, currentSha);
    if (probe.kind === 'file-contains') {
      const full = resolve(ROOT, probe.path);
      if (!existsSync(full)) return { ok: false, detail: `${probe.path} missing` };
      const text = readFileSync(full, 'utf8');
      return { ok: text.includes(probe.needle), detail: `${probe.path} contains ${probe.needle}` };
    }
    if (probe.kind === 'npm-script') {
      const pkg = resolve(ROOT, probe.prefix, 'package.json');
      if (!existsSync(pkg)) return { ok: false, detail: `${probe.prefix}/package.json missing` };
      const scripts = JSON.parse(readFileSync(pkg, 'utf8')).scripts ?? {};
      return { ok: Boolean(scripts[probe.script]), detail: `${probe.prefix}#${probe.script}` };
    }
    return { ok: false, detail: `unknown probe kind ${probe.kind}` };
  } catch (error) {
    return { ok: false, detail: `probe error: ${error.message}` };
  }
}

function main() {
  const asJson = process.argv.includes('--json');
  const outIndex = process.argv.indexOf('--out');
  const outPath = outIndex !== -1 ? process.argv[outIndex + 1] : null;
  const currentSha = gitHead();

  const contract = JSON.parse(readFileSync(CONTRACT, 'utf8'));
  const workstreams = [];
  let weightedArtifacts = 0;
  let weightedHarness = 0;
  let harnessWeight = 0;
  let weightedEvidence = 0;
  let totalWeight = 0;

  for (const ws of contract.workstreams) {
    const results = ws.probes.map((probe) => ({ probe, ...runProbe(probe, currentSha) }));
    const artifactResults = results.filter((result) => result.probe.kind !== 'npm-script');
    const harnessResults = results.filter((result) => result.probe.kind === 'npm-script');
    const artifactPassed = artifactResults.filter((r) => r.ok).length;
    const artifactPercent = artifactResults.length ? Math.round((artifactPassed / artifactResults.length) * 100) : 0;
    const harnessPassed = harnessResults.filter((r) => r.ok).length;
    const testHarnessPercent = harnessResults.length ? Math.round((harnessPassed / harnessResults.length) * 100) : 0;
    const evidenceResults = (ws.evidenceProbes ?? []).map((probe) => ({ probe, ...runEvidenceProbe(probe, currentSha) }));
    const evidencePassed = evidenceResults.filter((r) => r.ok).length;
    const evidencePercent = evidenceResults.length ? Math.round((evidencePassed / evidenceResults.length) * 100) : 0;
    weightedArtifacts += (ws.weight * artifactPercent) / 100;
    if (harnessResults.length) {
      weightedHarness += (ws.weight * testHarnessPercent) / 100;
      harnessWeight += ws.weight;
    }
    weightedEvidence += (ws.weight * evidencePercent) / 100;
    totalWeight += ws.weight;
    workstreams.push({
      id: ws.id,
      title: ws.title,
      weight: ws.weight,
      endGoal: ws.endGoal,
      artifactPercent,
      artifactPassed,
      artifactTotal: artifactResults.length,
      artifactMissing: artifactResults.filter((r) => !r.ok).map((r) => r.detail),
      testHarnessPercent,
      testHarnessPassed: harnessPassed,
      testHarnessTotal: harnessResults.length,
      testHarnessMissing: harnessResults.filter((r) => !r.ok).map((r) => r.detail),
      evidencePercent,
      evidencePassed,
      evidenceTotal: evidenceResults.length,
      evidenceMissing: evidenceResults.filter((r) => !r.ok).map((r) => r.detail),
    });
  }

  const artifactCoveragePercent = totalWeight ? Math.round((weightedArtifacts / totalWeight) * 100) : 0;
  const testHarnessCoveragePercent = harnessWeight ? Math.round((weightedHarness / harnessWeight) * 100) : 0;
  const verifiedEfficacyPercent = totalWeight ? Math.round((weightedEvidence / totalWeight) * 100) : 0;
  const report = {
    schema: 'nk1.progress-report.v2',
    generatedAt: new Date().toISOString(),
    currentSha,
    artifactCoveragePercent,
    testHarnessCoveragePercent,
    verifiedEfficacyPercent,
    disclaimer: 'Artifact coverage measures implementation artifact presence; test harness coverage measures whether test scripts exist, not whether they pass. Verified efficacy counts only JSON evidence with verified=true, exact current HEAD SHA, and every workstream-specific metric threshold. Neither percentage alone means product readiness.',
    workstreams: workstreams.sort((a, b) => b.weight - a.weight),
  };

  if (outPath) {
    const full = resolve(ROOT, outPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`NK1 PROGRESS — artifacts ${artifactCoveragePercent}% | test harness ${testHarnessCoveragePercent}% | verified efficacy ${verifiedEfficacyPercent}% | SHA ${currentSha.slice(0, 12)}\n`);
  for (const ws of report.workstreams) {
    const bar = '█'.repeat(Math.round(ws.artifactPercent / 10)).padEnd(10, '░');
    console.log(`${bar} artifact ${String(ws.artifactPercent).padStart(3)}% | harness ${String(ws.testHarnessPercent).padStart(3)}% | evidence ${String(ws.evidencePercent).padStart(3)}% | w=${String(ws.weight).padStart(2)} | ${ws.title}`);
    if (ws.artifactMissing.length) console.log(`        missing artifacts: ${ws.artifactMissing.join('; ')}`);
    if (ws.testHarnessMissing.length) console.log(`        missing test harnesses: ${ws.testHarnessMissing.join('; ')}`);
    if (ws.evidenceMissing.length) console.log(`        missing verified evidence: ${ws.evidenceMissing.join('; ')}`);
  }
  console.log(`\nArtifacts: ${artifactCoveragePercent}% | Test harnesses available: ${testHarnessCoveragePercent}% (not test pass rate) | Verified efficacy: ${verifiedEfficacyPercent}% (exact-SHA holdout/device/soak evidence only).`);
}
main();
