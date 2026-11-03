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

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CONTRACT = resolve(ROOT, 'contracts/progress-workstreams.json');
const ROOT_REAL = realpathSync(ROOT);

/**
 * Contract paths are untrusted configuration. Resolve only repo-relative paths,
 * reject traversal/absolute forms, and check real paths so an in-repo symlink
 * cannot redirect a probe outside the checkout.
 */
function resolveRepoPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1024 ||
      value.includes(String.fromCharCode(0)) || value.startsWith('/') || /^[A-Za-z]:/.test(value) ||
      value.includes(String.fromCharCode(92))) return null;
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '..')) return null;
  const full = resolve(ROOT, value);
  const relativePath = relative(ROOT_REAL, full);
  if (relativePath === '..' || relativePath.startsWith('..' + sep) || isAbsolute(relativePath)) return null;
  if (existsSync(full)) {
    try {
      const real = realpathSync(full);
      const realRelative = relative(ROOT_REAL, real);
      if (realRelative === '..' || realRelative.startsWith('..' + sep) || isAbsolute(realRelative)) return null;
    } catch {
      return null;
    }
  }
  return full;
}

function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

function gitRun(args) {
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

/**
 * Evidence recorded at commit X stays valid at a later HEAD only when X is an ancestor
 * of HEAD and none of the paths the evidence covers changed in between. Without this,
 * every artifact would be invalid the moment it is committed (the commit itself moves
 * HEAD), so verified efficacy could never rise above zero. When an artifact declares no
 * covered paths we fall back to strict equality, so nothing is silently weakened.
 */
function evidenceCoversCurrentTree(artifact, currentSha) {
  const recorded = typeof artifact?.sha === 'string' ? artifact.sha.trim() : '';
  if (!currentSha || !SHA_PATTERN.test(recorded)) return false;
  if (recorded === currentSha) return true;
  const covered = Array.isArray(artifact?.coversPaths) ? artifact.coversPaths.filter((p) => typeof p === 'string' && p.length > 0) : [];
  if (covered.length === 0) return false;
  const ancestor = gitRun(['merge-base', '--is-ancestor', recorded, currentSha]);
  if (ancestor.status !== 0) return false;
  const changed = gitRun(['diff', '--name-only', recorded, currentSha, '--', ...covered]);
  if (changed.status !== 0) return false;
  return changed.stdout.trim().length === 0;
}

function globMatch(pattern, currentSha) {
  const dir = resolveRepoPath(dirname(pattern));
  const base = pattern.split('/').pop() ?? '';
  if (!dir || !existsSync(dir) || !currentSha) return false;
  const prefix = base.split('*')[0];
  const suffix = base.split('*').pop() ?? '';
  return readdirSync(dir).some((name) => {
    if (!name.startsWith(prefix) || !name.endsWith(suffix)) return false;
    try {
      const candidatePath = resolveRepoPath(`${dirname(pattern)}/${name}`);
      if (!candidatePath) return false;
      const artifact = JSON.parse(readFileSync(candidatePath, 'utf8'));
      // The local-gate glob is intentionally head-exact: a gate run is a statement about
      // the commit it ran on, so it must not be satisfied by an artifact from another SHA.
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
    const full = resolveRepoPath(probe.path);
    if (!full) return { ok: false, detail: `${probe.path} is not a safe repository-relative path` };
    if (!existsSync(full)) return { ok: false, detail: `${probe.path} missing` };
    const artifact = JSON.parse(readFileSync(full, 'utf8'));
    if (artifact.verified !== true) return { ok: false, detail: `${probe.path} is not verified` };
    if (!evidenceCoversCurrentTree(artifact, currentSha)) return { ok: false, detail: `${probe.path} SHA is not the current HEAD` };
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
      const full = resolveRepoPath(probe.path);
      return { ok: Boolean(full) && existsSync(full), detail: full ? probe.path : `${probe.path} is not a safe repository-relative path` };
    }
    if (probe.kind === 'glob') {
      return { ok: globMatch(probe.path, currentSha), detail: `${probe.path} requires verified evidence for current HEAD` };
    }
    if (probe.kind === 'evidence-json') return runEvidenceProbe(probe, currentSha);
    if (probe.kind === 'file-contains') {
      const full = resolveRepoPath(probe.path);
      if (!full) return { ok: false, detail: `${probe.path} is not a safe repository-relative path` };
      if (!existsSync(full)) return { ok: false, detail: `${probe.path} missing` };
      const text = readFileSync(full, 'utf8');
      return { ok: text.includes(probe.needle), detail: `${probe.path} contains ${probe.needle}` };
    }
    if (probe.kind === 'npm-script') {
      const pkg = resolveRepoPath(String(probe.prefix) + '/package.json');
      if (!pkg) return { ok: false, detail: `${probe.prefix}/package.json is not a safe repository-relative path` };
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

  const contractIndex = process.argv.indexOf('--contract');
  const contractArg = contractIndex === -1 ? null : process.argv[contractIndex + 1];
  const contractPath = contractArg === null ? CONTRACT : resolveRepoPath(contractArg);
  if (!contractPath) throw new Error('progress contract must be a safe repository-relative path');
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
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
    // A workstream with no declared test entrypoint is 0% covered, not excluded
    // from the aggregate. Otherwise missing test harnesses inflate the score.
    weightedHarness += (ws.weight * testHarnessPercent) / 100;
    harnessWeight += ws.weight;
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
