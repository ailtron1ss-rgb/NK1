#!/usr/bin/env node
// NK1 75-aspect execution registry CLI: validate, report progress and pick the next
// actionable aspect. It reads engineering-os/aspects.v1.json and never mutates it.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = path.join(ROOT, 'engineering-os', 'aspects.v1.json');

const GATES = new Set(['architecture', 'integration', 'unit', 'math', 'cognitive', 'independent', 'device', 'soak', 'release']);
const OWNER_STATUSES = new Set(['canonical', 'candidate', 'candidate-pr', 'unmapped']);

export function validateRegistry(doc) {
  const errors = [];
  const warnings = [];
  if (!doc || typeof doc !== 'object') return { ok: false, errors: ['registry must be an object'], warnings };

  if (doc.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  const aspects = doc.aspects;
  if (!Array.isArray(aspects)) {
    errors.push('aspects must be an array');
    return { ok: false, errors, warnings };
  }
  if (aspects.length !== 75) errors.push(`aspects must contain exactly 75 entries, found ${aspects.length}`);

  const statuses = new Set(doc.statusVocabulary ?? []);
  const verified = new Set(doc.verifiedStatuses ?? []);
  const groupIds = new Set((doc.groups ?? []).map(g => g.id));
  const waves = Array.isArray(doc.waves) ? doc.waves : [];
  const waveIds = new Set(waves.map(w => w.id));

  const seenId = new Set();
  const seenN = new Set();
  const byId = new Map();
  const byN = new Map();

  for (const [index, a] of aspects.entries()) {
    const label = `aspects[${index}]`;
    if (!a || typeof a !== 'object') { errors.push(`${label} must be an object`); continue; }
    if (!Number.isInteger(a.n)) errors.push(`${label}.n must be an integer`);
    if (typeof a.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.id)) errors.push(`${label}.id is invalid`);
    if (seenId.has(a.id)) errors.push(`duplicate aspect id: ${a.id}`);
    if (seenN.has(a.n)) errors.push(`duplicate aspect number: ${a.n}`);
    seenId.add(a.id);
    seenN.add(a.n);
    byId.set(a.id, a);
    byN.set(a.n, a);

    if (!groupIds.has(a.group)) errors.push(`${label}.group "${a.group}" is not a declared group`);
    if (!waveIds.has(a.wave)) errors.push(`${label}.wave "${a.wave}" is not a declared wave`);
    if (!GATES.has(a.verificationGate)) errors.push(`${label}.verificationGate "${a.verificationGate}" is not a known gate`);
    if (!statuses.has(a.status)) errors.push(`${label}.status "${a.status}" is not in statusVocabulary`);
    if (!OWNER_STATUSES.has(a.ownerStatus)) errors.push(`${label}.ownerStatus "${a.ownerStatus}" is invalid`);
    if (typeof a.owner !== 'string' || a.owner.length === 0) errors.push(`${label}.owner must be a non-empty string`);
    if (a.ownerStatus === 'unmapped' && a.owner !== 'UNKNOWN') errors.push(`${label} is unmapped but owner is not "UNKNOWN"`);
    if (a.ownerStatus === 'canonical' && a.owner === 'UNKNOWN') errors.push(`${label} is canonical but has an UNKNOWN owner`);
    if (verified.has(a.status) && !(typeof a.evidence === 'string' && a.evidence.trim().length > 0)) {
      errors.push(`${label} status "${a.status}" requires a non-empty evidence reference`);
    }
    if (a.status === 'REJECTED' && !(typeof a.notes === 'string' && a.notes.trim().length > 0)) {
      errors.push(`${label} is REJECTED and must record a reason in notes`);
    }
  }

  for (const [index, a] of aspects.entries()) {
    if (!Array.isArray(a?.dependsOn)) { errors.push(`aspects[${index}].dependsOn must be an array`); continue; }
    for (const dep of a.dependsOn) {
      if (!byId.has(dep)) errors.push(`aspects[${index}].dependsOn references unknown aspect "${dep}"`);
      if (dep === a.id) errors.push(`aspects[${index}] depends on itself`);
    }
  }

  // Every 1..75 number must be present exactly once.
  for (let n = 1; n <= 75; n += 1) {
    if (!byN.has(n)) errors.push(`missing aspect number ${n}`);
  }

  // Wave membership: waves may overlap by design (a stabilization wave can seed a
  // later wave). Every aspect must be covered by at least one wave, and its `wave`
  // tag must equal the earliest wave that lists it. Duplicates within one wave are
  // rejected.
  const waveLists = new Map(); // aspect number -> array of wave ids
  for (const w of waves) {
    if (!Array.isArray(w.aspects)) { errors.push(`wave ${w.id} must declare an aspects array`); continue; }
    const within = new Set();
    for (const n of w.aspects) {
      if (!byN.has(n)) { errors.push(`wave ${w.id} references unknown aspect number ${n}`); continue; }
      if (within.has(n)) errors.push(`wave ${w.id} lists aspect ${n} more than once`);
      within.add(n);
      if (!waveLists.has(n)) waveLists.set(n, []);
      waveLists.get(n).push(Number(w.id));
    }
  }
  for (let n = 1; n <= 75; n += 1) {
    if (!waveLists.has(n)) { errors.push(`aspect number ${n} is not assigned to any wave`); continue; }
    const earliest = String(Math.min(...waveLists.get(n)));
    if (byN.get(n).wave !== earliest) {
      errors.push(`aspect ${n} is tagged wave ${byN.get(n).wave} but its earliest wave is ${earliest}`);
    }
  }

  // Dependency graph must be acyclic.
  const color = new Map();
  const stack = [];
  const visit = (id) => {
    color.set(id, 1);
    stack.push(id);
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      if (!byId.has(dep)) continue;
      if (color.get(dep) === 1) {
        errors.push(`dependency cycle: ${[...stack, dep].join(' -> ')}`);
        return;
      }
      if ((color.get(dep) ?? 0) === 0) visit(dep);
    }
    stack.pop();
    color.set(id, 2);
  };
  for (const a of aspects) {
    if ((color.get(a.id) ?? 0) === 0) visit(a.id);
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function computeProgress(doc) {
  const verified = new Set(doc.verifiedStatuses ?? []);
  const byGroup = new Map();
  const byWave = new Map();
  for (const a of doc.aspects) {
    for (const [map, key] of [[byGroup, a.group], [byWave, a.wave]]) {
      if (!map.has(key)) map.set(key, { total: 0, verified: 0, byStatus: {} });
      const row = map.get(key);
      row.total += 1;
      if (verified.has(a.status)) row.verified += 1;
      row.byStatus[a.status] = (row.byStatus[a.status] ?? 0) + 1;
    }
  }
  const verifiedCount = doc.aspects.filter(a => verified.has(a.status)).length;
  return {
    total: doc.aspects.length,
    verified: verifiedCount,
    implemented: doc.aspects.filter(a => a.status === 'IMPLEMENTED').length,
    planned: doc.aspects.filter(a => a.status === 'PLANNED').length,
    blocked: doc.aspects.filter(a => a.status === 'BLOCKED').length,
    groups: Object.fromEntries([...byGroup.entries()].map(([k, v]) => [k, { total: v.total, verified: v.verified, byStatus: v.byStatus }])),
    waves: Object.fromEntries([...byWave.entries()].map(([k, v]) => [k, { total: v.total, verified: v.verified, byStatus: v.byStatus }])),
  };
}

// First aspect (by wave then number) that is not verified and whose dependencies are all verified.
export function nextActionable(doc) {
  const verified = new Set(doc.verifiedStatuses ?? []);
  const statusById = new Map(doc.aspects.map(a => [a.id, a.status]));
  const ordered = [...doc.aspects].sort((x, y) => (Number(x.wave) - Number(y.wave)) || (x.n - y.n));
  for (const a of ordered) {
    if (verified.has(a.status)) continue;
    if (a.status === 'BLOCKED' || a.status === 'DEFERRED' || a.status === 'REJECTED') continue;
    const blockedBy = a.dependsOn.filter(d => !verified.has(statusById.get(d)));
    if (blockedBy.length === 0) return { aspect: a, blockedBy: [] };
  }
  return null;
}

export function renderReport(doc) {
  const progress = computeProgress(doc);
  const lines = [];
  lines.push(`# ${doc.name}`);
  lines.push('');
  lines.push(`- Version: ${doc.version} (${doc.date})`);
  lines.push(`- Base branch: \`${doc.baseBranch}\``);
  lines.push(`- Observed source head: \`${doc.observedSourceHead}\` (refresh before relying on it)`);
  lines.push(`- Aspects: ${progress.total} total, ${progress.verified} verified, ${progress.implemented} implemented, ${progress.planned} planned, ${progress.blocked} blocked`);
  lines.push('');
  lines.push('## Waves');
  lines.push('');
  lines.push('| Wave | Title | Aspects | Verified |');
  lines.push('|---|---|---:|---:|');
  for (const w of doc.waves) {
    const row = progress.waves[w.id];
    lines.push(`| ${w.id} | ${w.titleEn}${w.critical ? ' (critical)' : ''} | ${row?.total ?? 0} | ${row?.verified ?? 0} |`);
  }
  lines.push('');
  lines.push('## Aspects');
  lines.push('');
  lines.push('| # | Aspect | Group | Wave | Owner | Gate | Status |');
  lines.push('|---:|---|---|---|---|---|---|');
  for (const a of [...doc.aspects].sort((x, y) => x.n - y.n)) {
    lines.push(`| ${a.n} | ${a.titleEn} | ${a.group} | ${a.wave} | \`${a.owner}\` | ${a.verificationGate} | ${a.status} |`);
  }
  lines.push('');
  return lines.join('\n');
}

async function load() {
  return JSON.parse(await readFile(REGISTRY, 'utf8'));
}

async function main() {
  const command = process.argv[2] ?? 'status';
  const doc = await load();

  if (command === 'validate') {
    const result = validateRegistry(doc);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (command === 'status') {
    const validation = validateRegistry(doc);
    const progress = computeProgress(doc);
    console.log(JSON.stringify({
      name: doc.name,
      version: doc.version,
      validation: validation.ok ? 'PASS' : 'FAIL',
      errors: validation.errors,
      warnings: validation.warnings,
      aspects: progress.total,
      verified: progress.verified,
      byStatus: Object.fromEntries(['PLANNED', 'IMPLEMENTED', 'CONNECTED', 'TESTED', 'PROVEN', 'BLOCKED', 'DEFERRED', 'REJECTED']
        .map(s => [s, doc.aspects.filter(a => a.status === s).length])
        .filter(([, count]) => count > 0)),
      waves: progress.waves,
      note: 'IMPLEMENTED means code exists; only CONNECTED/TESTED/PROVEN count as verified capability.'
    }, null, 2));
    if (!validation.ok) process.exitCode = 1;
    return;
  }

  if (command === 'report') {
    process.stdout.write(renderReport(doc));
    return;
  }

  if (command === 'waves') {
    for (const w of doc.waves) {
      console.log(`Wave ${w.id} — ${w.titleEn}${w.critical ? ' (critical)' : ''}: ${w.aspects.length} aspects`);
    }
    return;
  }

  if (command === 'next') {
    const next = nextActionable(doc);
    if (!next) { console.log(JSON.stringify({ done: true, note: 'No unverified, unblocked aspect remains.' })); return; }
    console.log(JSON.stringify({
      next: { n: next.aspect.n, id: next.aspect.id, title: next.aspect.titleEn, wave: next.aspect.wave, owner: next.aspect.owner, gate: next.aspect.verificationGate },
      note: 'Dependencies verified. IMPLEMENTED still requires connection/test evidence before it is verified.'
    }, null, 2));
    return;
  }

  console.error('Usage: node tools/neurok-aspects.mjs [validate|status|report|waves|next]');
  process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
