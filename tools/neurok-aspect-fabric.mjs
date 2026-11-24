#!/usr/bin/env node
// NK1 aspect integration fabric builder/validator.
// Connects the 75-aspect registry to the seven physical organism systems and
// to branch/PR provenance. Read-only unless --write is passed.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateRegistry } from './neurok-aspects.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = path.join(ROOT, 'engineering-os', 'aspects.v1.json');
const PROVENANCE = path.join(ROOT, 'engineering-os', 'aspect-branch-provenance.v1.json');
const MANIFEST = path.join(ROOT, 'engineering-os', 'aspect-fabric.v1.json');

export const SYSTEMS = ['self', 'governance', 'memory', 'world', 'embodiment', 'agency', 'research'];
const GROUP_SYSTEM = { I:'self', II:'world', III:'memory', IV:'self', V:'embodiment', VI:'research', VII:'governance', VIII:'embodiment', IX:'research', X:'governance' };
const SYSTEM_OVERRIDES = {
  6:'governance', 11:'self', 12:'self', 18:'research', 19:'self', 20:'self', 21:'self', 22:'self', 23:'agency', 24:'agency',
  33:'research', 34:'research', 35:'research', 36:'research', 37:'research', 38:'research', 39:'research', 40:'research',
  41:'research', 42:'research', 43:'governance', 44:'research', 45:'governance', 46:'governance', 47:'governance',
  48:'governance', 49:'governance', 50:'governance', 51:'governance', 52:'governance', 53:'embodiment', 54:'embodiment',
  55:'embodiment', 56:'embodiment', 57:'embodiment', 58:'governance', 59:'governance', 60:'research', 61:'research',
  62:'research', 63:'research', 64:'research', 65:'research', 66:'research', 67:'research', 68:'research',
  69:'governance', 70:'governance', 71:'governance', 72:'governance', 73:'governance', 74:'governance', 75:'governance',
};

function systemFor(aspect) {
  return SYSTEM_OVERRIDES[aspect.n] ?? GROUP_SYSTEM[aspect.group];
}

function ownerExists(owner) {
  if (!owner || owner === 'UNKNOWN') return false;
  return existsSync(path.join(ROOT, owner));
}

export function buildManifest(doc, provenance = null) {
  const errors = [];
  const warnings = [];
  const base = validateRegistry(doc);
  errors.push(...base.errors);
  warnings.push(...base.warnings);
  if (doc.aspects.length !== 75) errors.push(`expected 75 aspects, found ${doc.aspects.length}`);
  if (doc.groups.length !== 10) errors.push(`expected 10 domains, found ${doc.groups.length}`);

  const systems = SYSTEMS.map(id => ({ id, titleRu: systemTitle(id), aspects: [], domains: [] }));
  const domains = doc.groups.map(g => ({ id: g.id, titleRu: g.titleRu, system: GROUP_SYSTEM[g.id] ?? null, aspects: [] }));
  const byId = new Map(doc.aspects.map(a => [a.id, a.n]));
  const aspects = [...doc.aspects].sort((a, b) => a.n - b.n).map(a => {
    const system = systemFor(a);
    if (!SYSTEMS.includes(system)) errors.push(`aspect ${a.n} has unknown system ${system}`);
    const exists = ownerExists(a.owner);
    if (!exists) warnings.push(`owner missing for aspect ${a.n}: ${a.owner}`);
    const prov = provenance?.aspects?.[String(a.n)] ?? null;
    const dependsOnIds = [...(a.dependsOn ?? [])];
    const dependsOn = dependsOnIds.map(id => byId.get(id)).filter(n => Number.isInteger(n));
    for (const id of dependsOnIds) if (!byId.has(id)) errors.push(`aspect ${a.n} depends on unknown id ${id}`);
    return {
      n: a.n, id: a.id, titleRu: a.titleRu, titleEn: a.titleEn, group: a.group, wave: a.wave,
      system, owner: a.owner, ownerStatus: a.ownerStatus, ownerExists: exists,
      dependsOn, dependsOnIds, verificationGate: a.verificationGate, status: a.status,
      branches: prov ?? { total:0, open:0, merged:0, closed:0, noPr:0, topBranches:[], openPrs:[] },
    };
  });
  for (const a of aspects) {
    const s = systems.find(x => x.id === a.system);
    if (s) s.aspects.push(a.n);
    const d = domains.find(x => x.id === a.group);
    if (d) { d.aspects.push(a.n); if (!d.system) d.system = a.system; }
  }
  for (const s of systems) if (!s.aspects.length) errors.push(`system ${s.id} has no aspects`);
  for (const d of domains) if (!d.aspects.length) errors.push(`domain ${d.id} has no aspects`);

  const edges = [];
  for (const a of aspects) for (const dep of a.dependsOn) edges.push({ from: a.n, to: dep, kind: 'depends-on' });
  for (const a of aspects) edges.push({ from: `system:${a.system}`, to: a.n, kind: 'owns' });
  for (const s of systems) edges.push({ from: 'organism', to: `system:${s.id}`, kind: 'composes' });

  const missingOwners = aspects.filter(a => !a.ownerExists).map(a => ({ n:a.n, id:a.id, owner:a.owner }));
  const manifest = {
    schemaVersion: 1,
    name: 'NK1 Aspect Integration Fabric',
    generatedFrom: 'engineering-os/aspects.v1.json',
    trunk: process.env.NK1_TRUNK ?? trunkHead(),
    organism: { id:'organism', titleRu:'NK1 / NeuroCore — единый организм', systems: SYSTEMS },
    systems, domains, aspects, edges,
    coverage: {
      aspects: aspects.length, domains: domains.length, systems: systems.length,
      mapped: aspects.filter(a => SYSTEMS.includes(a.system)).length,
      ownerExists: aspects.filter(a => a.ownerExists).length,
      missingOwners,
      systemsCovered: systems.filter(s => s.aspects.length).length,
      domainsCovered: domains.filter(d => d.aspects.length).length,
    },
    branchProvenance: provenance ? {
      totalBranches: provenance.totalBranches, prStates: provenance.prStates,
      groupOnly: provenance.groupOnly, legacy: provenance.legacy,
    } : null,
    validation: { ok: errors.length === 0, errors, warnings },
  };
  return manifest;
}

function trunkHead() {
  try { return execSync('git rev-parse --short origin/workpass70-source', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; }
}

function systemTitle(id) {
  return ({ self:'Self / личность и ядро', governance:'Governance / безопасность и релиз', memory:'Memory / память и обучение', world:'World / восприятие и познание', embodiment:'Embodiment / тело, голос, аватары', agency:'Agency / автономность и мотивация', research:'Research / интеграции и научная проверка' })[id] ?? id;
}

function weakConnected(manifest) {
  const nodes = new Set(['organism']);
  for (const s of manifest.systems) nodes.add(`system:${s.id}`);
  for (const a of manifest.aspects) nodes.add(String(a.n));
  const adj = new Map([...nodes].map(n => [n, new Set()]));
  for (const e of manifest.edges) {
    const a = String(e.from), b = String(e.to);
    if (!adj.has(a) || !adj.has(b)) continue;
    adj.get(a).add(b); adj.get(b).add(a);
  }
  const start = nodes.values().next().value;
  const seen = new Set([start]); const stack = [start];
  while (stack.length) { const n = stack.pop(); for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.add(m); stack.push(m); } }
  return { connected: seen.size === nodes.size, total: nodes.size, reachable: seen.size, components: seen.size === nodes.size ? 1 : null };
}

export function validateManifest(manifest) {
  const errors = [...(manifest.validation?.errors ?? [])];
  const warnings = [...(manifest.validation?.warnings ?? [])];
  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  if (manifest.aspects.length !== 75) errors.push(`manifest aspects must be 75, found ${manifest.aspects.length}`);
  if (manifest.domains.length !== 10) errors.push(`manifest domains must be 10, found ${manifest.domains.length}`);
  if (manifest.systems.length !== 7) errors.push(`manifest systems must be 7, found ${manifest.systems.length}`);
  const ns = new Set(manifest.aspects.map(a => a.n));
  for (const a of manifest.aspects) {
    if (!SYSTEMS.includes(a.system)) errors.push(`aspect ${a.n} has invalid system ${a.system}`);
    if (!a.owner) errors.push(`aspect ${a.n} has empty owner`);
    for (const dep of a.dependsOn) if (!ns.has(dep)) errors.push(`aspect ${a.n} depends on unknown ${dep}`);
  }
  for (const s of manifest.systems) if (!s.aspects.length) errors.push(`system ${s.id} is empty`);
  for (const d of manifest.domains) if (!d.aspects.length) errors.push(`domain ${d.id} is empty`);
  const weak = weakConnected(manifest);
  if (!weak.connected) errors.push(`fabric graph is disconnected: ${weak.reachable}/${weak.total}`);
  if (manifest.branchProvenance) {
    const total = manifest.branchProvenance.totalBranches;
    const aspectTotal = manifest.aspects.reduce((sum, a) => sum + (a.branches?.total ?? 0), 0);
    const groupOnly = manifest.branchProvenance.groupOnly?.total ?? 0;
    const legacy = manifest.branchProvenance.legacy?.total ?? 0;
    if (total !== aspectTotal + groupOnly + legacy) warnings.push(`branch provenance totals: ${aspectTotal}+${groupOnly}+${legacy} != ${total}`);
  }
  return { ok: errors.length === 0, errors, warnings, weak };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const doc = JSON.parse(await readFile(REGISTRY, 'utf8'));
  let provenance = null;
  if (existsSync(PROVENANCE)) provenance = JSON.parse(await readFile(PROVENANCE, 'utf8'));
  const manifest = buildManifest(doc, provenance);
  const result = validateManifest(manifest);
  manifest.validation = { ok: result.ok, errors: result.errors, warnings: result.warnings };
  manifest.coverage.connected = result.weak.connected;
  manifest.coverage.reachable = result.weak.reachable;
  manifest.coverage.nodes = result.weak.total;
  if (args.has('--write')) {
    await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
    console.log(`wrote ${path.relative(ROOT, MANIFEST)}`);
  }
  if (args.has('--json')) {
    console.log(JSON.stringify({
      ok: result.ok, aspects: manifest.aspects.length, domains: manifest.domains.length, systems: manifest.systems.length,
      ownerExists: manifest.coverage.ownerExists, missingOwners: manifest.coverage.missingOwners.length,
      connected: result.weak.connected, reachable: result.weak.reachable, nodes: result.weak.total,
      branches: manifest.branchProvenance?.totalBranches ?? null,
      errors: result.errors, warnings: result.warnings.slice(0, 12),
    }, null, 2));
  } else {
    console.log(`ASPECT_FABRIC=${result.ok ? 'PASS' : 'FAIL'} aspects=${manifest.aspects.length} domains=${manifest.domains.length} systems=${manifest.systems.length} ownerExists=${manifest.coverage.ownerExists} missing=${manifest.coverage.missingOwners.length} connected=${result.weak.connected} nodes=${result.weak.total} branches=${manifest.branchProvenance?.totalBranches ?? 0} warnings=${result.warnings.length}`);
    for (const e of result.errors.slice(0, 12)) console.error(`ERROR ${e}`);
    for (const w of result.warnings.slice(0, 8)) console.error(`WARN ${w}`);
  }
  if (!result.ok || (args.has('--strict') && result.warnings.length)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
