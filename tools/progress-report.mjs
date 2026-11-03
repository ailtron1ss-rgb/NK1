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
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CONTRACT = resolve(ROOT, 'contracts/progress-workstreams.json');

function globMatch(pattern) {
  const dir = resolve(ROOT, dirname(pattern));
  const base = pattern.split('/').pop() ?? '';
  if (!existsSync(dir)) return false;
  const prefix = base.split('*')[0];
  const suffix = base.split('*').pop() ?? '';
  return readdirSync(dir).some((name) => name.startsWith(prefix) && name.endsWith(suffix));
}

function runProbe(probe) {
  try {
    if (probe.kind === 'file-exists') {
      return { ok: existsSync(resolve(ROOT, probe.path)), detail: probe.path };
    }
    if (probe.kind === 'glob') {
      return { ok: globMatch(probe.path), detail: probe.path };
    }
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

  const contract = JSON.parse(readFileSync(CONTRACT, 'utf8'));
  const workstreams = [];
  let weighted = 0;
  let totalWeight = 0;

  for (const ws of contract.workstreams) {
    const results = ws.probes.map((probe) => ({ probe, ...runProbe(probe) }));
    const passed = results.filter((r) => r.ok).length;
    const percent = results.length ? Math.round((passed / results.length) * 100) : 0;
    weighted += (ws.weight * percent) / 100;
    totalWeight += ws.weight;
    workstreams.push({
      id: ws.id,
      title: ws.title,
      weight: ws.weight,
      endGoal: ws.endGoal,
      percent,
      passed,
      total: results.length,
      failing: results.filter((r) => !r.ok).map((r) => r.detail),
    });
  }

  const overall = totalWeight ? Math.round((weighted / totalWeight) * 100) : 0;
  const report = {
    schema: 'nk1.progress-report.v1',
    generatedAt: new Date().toISOString(),
    overallPercent: overall,
    disclaimer: 'Derived from artifact/script existence probes only. Existence is not proof of behaviour; see docs/evidence for run artifacts.',
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

  console.log(`NK1 PROGRESS (evidence-probe derived) — overall ${overall}%\n`);
  for (const ws of report.workstreams) {
    const bar = '█'.repeat(Math.round(ws.percent / 10)).padEnd(10, '░');
    console.log(`${bar} ${String(ws.percent).padStart(3)}%  w=${String(ws.weight).padStart(2)}  ${ws.title}`);
    if (ws.failing.length) console.log(`        missing: ${ws.failing.join('; ')}`);
  }
  console.log(`\nOverall: ${overall}% (weighted by planning priority, not measured quality)`);
}

main();
