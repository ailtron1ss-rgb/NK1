#!/usr/bin/env node
/**
 * NK1 / NeuroCore 75-aspect progress tracker.
 *
 * Single source of truth is docs/nk1-aspect-progress.json. This tool validates
 * that tracker (structure, dependencies, owner hints) and reports progress per
 * wave and overall. It never invents a status: an aspect only reaches PASS when
 * the tracker carries a linked evidence artifact, so a passing unit test or a
 * file that merely exists cannot raise the number.
 *
 * Usage:
 *   node tools/nk1-aspect-progress.mjs            human report
 *   node tools/nk1-aspect-progress.mjs --json     machine report
 *   node tools/nk1-aspect-progress.mjs --check    exit 1 on integrity error (CI)
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRACKER = path.join(ROOT, 'docs', 'nk1-aspect-progress.json');
const STATUSES = ['PLANNED', 'IN_PROGRESS', 'BLOCKED', 'PASS', 'FAIL', 'DEFERRED', 'REJECTED'];
const COUNTED_AS_DONE = new Set(['PASS']);

export function loadTracker(trackerPath = TRACKER) {
  return JSON.parse(readFileSync(trackerPath, 'utf8'));
}

/** Structural validation: no invented aspect, no dangling/self/cyclic dependency. */
export function validateTracker(doc) {
  const errors = [];
  const warnings = [];
  if (!doc || typeof doc !== 'object') return { errors: ['tracker is not an object'], warnings };

  const aspects = doc.aspects;
  if (!Array.isArray(aspects)) return { errors: ['aspects is not an array'], warnings };

  const expected = 75;
  if (aspects.length !== expected) errors.push(`expected ${expected} aspects, found ${aspects.length}`);

  const ids = new Set();
  const nums = new Set();
  for (const a of aspects) {
    if (!a || typeof a !== 'object') { errors.push('aspect entry is not an object'); continue; }
    if (typeof a.id !== 'string') { errors.push('aspect without string id'); continue; }
    if (ids.has(a.id)) errors.push(`duplicate aspect id ${a.id}`);
    ids.add(a.id);
    if (typeof a.num !== 'number' || a.num < 1 || a.num > expected) errors.push(`${a.id}: num out of range`);
    else if (nums.has(a.num)) errors.push(`${a.id}: duplicate num ${a.num}`);
    else nums.add(a.num);
    if (!STATUSES.includes(a.status)) errors.push(`${a.id}: invalid status ${a.status}`);
    if (!Array.isArray(a.waves) || a.waves.length === 0) errors.push(`${a.id}: no wave assigned`);
    for (const w of a.waves ?? []) if (!/^W[1-6]$/.test(w)) errors.push(`${a.id}: invalid wave ${w}`);
    if (!Array.isArray(a.dependsOn)) errors.push(`${a.id}: dependsOn is not an array`);
    if (!Array.isArray(a.evidence)) errors.push(`${a.id}: evidence is not an array`);
    if (a.status === 'PASS' && (!Array.isArray(a.evidence) || a.evidence.length === 0)) {
      errors.push(`${a.id}: PASS requires at least one evidence artifact`);
    }
  }
  for (let n = 1; n <= expected; n++) if (!nums.has(n)) errors.push(`missing aspect num ${n}`);

  for (const a of aspects) {
    for (const dep of a.dependsOn ?? []) {
      if (dep === a.id) errors.push(`${a.id}: depends on itself`);
      else if (!ids.has(dep)) errors.push(`${a.id}: depends on unknown ${dep}`);
    }
  }

  // Cycle detection (DFS, three-colour).
  const byId = new Map(aspects.map((a) => [a.id, a]));
  const colour = new Map();
  const stack = [];
  const visit = (id) => {
    if (colour.get(id) === 'black') return;
    if (colour.get(id) === 'grey') { errors.push(`dependency cycle: ${[...stack, id].join(' -> ')}`); return; }
    colour.set(id, 'grey');
    stack.push(id);
    for (const dep of byId.get(id)?.dependsOn ?? []) if (byId.has(dep)) visit(dep);
    stack.pop();
    colour.set(id, 'black');
  };
  for (const a of aspects) visit(a.id);

  // Owner hints: a missing path is a warning, not an integrity failure, because
  // the hint may be a directory that has not been created yet.
  for (const a of aspects) {
    for (const p of a.ownerPaths ?? []) {
      if (!existsSync(path.join(ROOT, p))) warnings.push(`${a.id}: owner path not found yet: ${p}`);
    }
  }

  return { errors, warnings };
}

export function summarize(doc) {
  const aspects = doc.aspects ?? [];
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const byWave = {};
  for (const w of Object.keys(doc.waves ?? {})) byWave[w] = { total: 0, pass: 0, inProgress: 0, blocked: 0 };
  let pass = 0;
  for (const a of aspects) {
    if (byStatus[a.status] !== undefined) byStatus[a.status] += 1;
    if (COUNTED_AS_DONE.has(a.status)) pass += 1;
    for (const w of a.waves ?? []) {
      if (!byWave[w]) byWave[w] = { total: 0, pass: 0, inProgress: 0, blocked: 0 };
      byWave[w].total += 1;
      if (COUNTED_AS_DONE.has(a.status)) byWave[w].pass += 1;
      if (a.status === 'IN_PROGRESS') byWave[w].inProgress += 1;
      if (a.status === 'BLOCKED') byWave[w].blocked += 1;
    }
  }
  const overallPercent = aspects.length ? Math.round((pass / aspects.length) * 1000) / 10 : 0;
  return { total: aspects.length, pass, byStatus, byWave, overallPercent };
}

/** Aspects that are PLANNED and whose every dependency is already PASS. */
export function nextActionable(doc) {
  const byId = new Map((doc.aspects ?? []).map((a) => [a.id, a]));
  return (doc.aspects ?? [])
    .filter((a) => a.status === 'PLANNED')
    .filter((a) => (a.dependsOn ?? []).every((d) => byId.get(d)?.status === 'PASS'))
    .map((a) => a.id);
}

export function formatReport(doc) {
  const s = summarize(doc);
  const lines = [];
  lines.push(doc.title ?? 'NK1 aspect progress');
  lines.push(`base: ${doc.base ?? '?'}   generated: ${doc.generatedAt ?? '?'}`);
  lines.push(`overall: ${s.pass}/${s.total} PASS (${s.overallPercent}%)`);
  lines.push(`by status: ${STATUSES.map((k) => `${k}=${s.byStatus[k]}`).join('  ')}`);
  lines.push('');
  lines.push('wave                              pass/total   in-progress  blocked');
  for (const [w, info] of Object.entries(s.byWave)) {
    const name = doc.waves?.[w]?.name ?? '';
    const pct = info.total ? Math.round((info.pass / info.total) * 100) : 0;
    lines.push(
      `${w} ${name}`.padEnd(34) +
        `${String(info.pass).padStart(2)}/${String(info.total).padEnd(4)}(${String(pct).padStart(3)}%)  ` +
        `${String(info.inProgress).padStart(4)}       ${String(info.blocked).padStart(3)}`,
    );
  }
  const nxt = nextActionable(doc);
  lines.push('');
  lines.push(`next actionable (deps satisfied): ${nxt.length ? nxt.slice(0, 20).join(', ') : 'none'}`);
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const doc = loadTracker();
  const { errors, warnings } = validateTracker(doc);
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({ ...summarize(doc), errors, warnings, nextActionable: nextActionable(doc) }, null, 2) + '\n');
  } else {
    process.stdout.write(formatReport(doc) + '\n');
    if (warnings.length) process.stdout.write(`\nwarnings (${warnings.length}):\n` + warnings.map((w) => `  - ${w}`).join('\n') + '\n');
    if (errors.length) process.stdout.write(`\nerrors (${errors.length}):\n` + errors.map((e) => `  - ${e}`).join('\n') + '\n');
  }
  if (args.includes('--check') && errors.length) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
