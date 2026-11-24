#!/usr/bin/env node
// NK1 real aspect inventory: owner file, exports, tests, branch/PR provenance,
// readiness and gaps for all 75 aspects. Read-only unless --write is passed.
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = path.join(ROOT, 'engineering-os', 'aspects.v1.json');
const FABRIC = path.join(ROOT, 'engineering-os', 'aspect-fabric.v1.json');
const PROVENANCE = path.join(ROOT, 'engineering-os', 'aspect-branch-provenance.v1.json');
const OUTPUT = path.join(ROOT, 'engineering-os', 'aspect-inventory.v1.json');
const TESTS_DIR = 'runtime/neuro-kurisu/tests';
const GENERIC = new Set(['index','types','app','core','tests','runtime','package','readme','main','src','lib','model','models','data']);
const GENERIC_TOKENS = new Set(['core','app','ui','api','test','tests','src','lib','main','index','types','data','model']);

function git(args) {
  try { return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); }
  catch { return ''; }
}
function trunkHead() { return git('rev-parse --short origin/workpass70-source') || null; }
function safeRead(p) { try { return readFileSync(p, 'utf8'); } catch { return ''; } }

function ownerInfo(owner) {
  if (!owner || owner === 'UNKNOWN') return { kind:'missing', exists:false, lines:null, bytes:null, exports:[], entries:[] };
  const abs = path.join(ROOT, owner);
  if (!existsSync(abs)) return { kind:'missing', exists:false, lines:null, bytes:null, exports:[], entries:[] };
  const st = statSync(abs);
  if (st.isDirectory()) {
    const entries = readdirSync(abs).slice(0, 20);
    return { kind:'directory', exists:true, lines:null, bytes:null, exports:[], entries };
  }
  const text = safeRead(abs);
  const exports = [...text.matchAll(/^export\s+(?:default\s+)?(?:class|function|const|interface|type|enum)\s+([A-Za-z0-9_]+)/gm)].map(m => m[1]).slice(0, 20);
  return { kind:'file', exists:true, lines:text ? text.split('\n').length : 0, bytes:st.size, exports, entries:[] };
}

function searchTokens(aspect, owner) {
  const out = [];
  if (owner && owner !== 'UNKNOWN') {
    const base = path.basename(owner).replace(/\.[^.]+$/, '');
    if (base.length >= 4 && !GENERIC.has(base.toLowerCase())) out.push(base);
  }
  if (aspect.id && aspect.id.length >= 4 && !GENERIC_TOKENS.has(aspect.id)) out.push(aspect.id);
  return [...new Set(out)].slice(0, 3);
}

function findTests(aspect, owner) {
  if (owner === TESTS_DIR) {
    const count = git(`ls-files -- ${TESTS_DIR}`).split('\n').filter(Boolean).length;
    return { count, examples: [TESTS_DIR] };
  }
  if (owner.startsWith(`${TESTS_DIR}/`)) return { count: 1, examples: [owner] };
  const found = new Set();
  for (const token of searchTokens(aspect, owner)) {
    const out = git(`grep -l -F -- ${JSON.stringify(token)} -- ${TESTS_DIR} tools`);
    for (const line of out.split('\n')) if (line.trim()) found.add(line.trim());
  }
  const examples = [...found].sort().slice(0, 5);
  return { count: found.size, examples };
}

export function buildInventory() {
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  const fabric = JSON.parse(readFileSync(FABRIC, 'utf8'));
  const provenance = JSON.parse(readFileSync(PROVENANCE, 'utf8'));
  const fabricByN = new Map(fabric.aspects.map(a => [a.n, a]));
  const aspects = [...registry.aspects].sort((a, b) => a.n - b.n).map(a => {
    const info = ownerInfo(a.owner);
    const tests = findTests(a, a.owner);
    const prov = provenance.aspects[String(a.n)] ?? { total:0, open:0, merged:0, closed:0, noPr:0, topBranches:[], openPrs:[] };
    const f = fabricByN.get(a.n);
    let readiness = 'owner-only';
    if (!info.exists) readiness = 'owner-missing';
    else if (tests.count > 0 && prov.total > 0) readiness = 'owner+tests+branches';
    else if (tests.count > 0) readiness = 'owner+tests';
    else if (prov.total > 0) readiness = 'owner+branches';
    const gaps = [];
    if (!info.exists) gaps.push('owner-missing');
    if (a.ownerStatus === 'candidate') gaps.push('candidate-owner');
    if (tests.count === 0 && a.owner !== TESTS_DIR) gaps.push('no-tests');
    if (prov.total === 0) gaps.push('no-branches');
    if (a.status === 'PLANNED') gaps.push('status-planned');
    return {
      n:a.n, id:a.id, titleRu:a.titleRu, group:a.group, wave:a.wave, status:a.status, system:f?.system ?? null,
      owner:a.owner, ownerStatus:a.ownerStatus, ownerKind:info.kind, ownerExists:info.exists,
      ownerLines:info.lines, ownerBytes:info.bytes, ownerExports:info.exports, ownerEntries:info.entries,
      testsFound:tests.count, testExamples:tests.examples,
      branches:{ total:prov.total, open:prov.open, merged:prov.merged, closed:prov.closed, noPr:prov.noPr },
      readiness, gaps,
    };
  });
  const byReadiness = {};
  for (const a of aspects) byReadiness[a.readiness] = (byReadiness[a.readiness] ?? 0) + 1;
  const totals = {
    aspects: aspects.length,
    ownerExists: aspects.filter(a => a.ownerExists).length,
    ownerFiles: aspects.filter(a => a.ownerKind === 'file').length,
    ownerDirectories: aspects.filter(a => a.ownerKind === 'directory').length,
    testsFound: aspects.filter(a => a.testsFound > 0).length,
    branchesAssigned: aspects.reduce((s, a) => s + a.branches.total, 0),
    openPrs: aspects.reduce((s, a) => s + a.branches.open, 0),
    candidateOwners: aspects.filter(a => a.ownerStatus === 'candidate').length,
    planned: aspects.filter(a => a.status === 'PLANNED').length,
    noTests: aspects.filter(a => a.testsFound === 0).length,
    noBranches: aspects.filter(a => a.branches.total === 0).length,
  };
  return {
    schemaVersion:1, generatedAt:new Date().toISOString(), trunk:trunkHead(),
    generatedFrom:['engineering-os/aspects.v1.json','engineering-os/aspect-fabric.v1.json','engineering-os/aspect-branch-provenance.v1.json'],
    totals, byReadiness, aspects,
  };
}

export function validateInventory(inv) {
  const errors=[]; const warnings=[];
  if (inv.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  if (inv.totals.aspects !== 75) errors.push(`expected 75 aspects, found ${inv.totals.aspects}`);
  if (inv.totals.ownerExists !== 75) errors.push(`expected 75 owners, found ${inv.totals.ownerExists}`);
  if (inv.totals.branchesAssigned !== 711) warnings.push(`expected 711 aspect-assigned branches, found ${inv.totals.branchesAssigned}`);
  const ns=new Set(); const ids=new Set();
  for (const a of inv.aspects) {
    if (ns.has(a.n)) errors.push(`duplicate aspect n ${a.n}`); ns.add(a.n);
    if (ids.has(a.id)) errors.push(`duplicate aspect id ${a.id}`); ids.add(a.id);
    if (!a.owner || a.owner === 'UNKNOWN') errors.push(`aspect ${a.n} has no owner`);
    if (!a.system) errors.push(`aspect ${a.n} has no system`);
    if (a.branches.open > a.branches.total) errors.push(`aspect ${a.n} open > total`);
  }
  return { ok:errors.length===0, errors, warnings };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const inv = buildInventory();
  const result = validateInventory(inv);
  if (args.has('--write')) { writeFileSync(OUTPUT, JSON.stringify(inv, null, 1) + '\n'); console.log(`wrote ${path.relative(ROOT, OUTPUT)}`); }
  if (args.has('--json')) console.log(JSON.stringify({ ok:result.ok, ...inv.totals, byReadiness:inv.byReadiness, errors:result.errors, warnings:result.warnings }, null, 2));
  else console.log(`ASPECT_INVENTORY=${result.ok?'PASS':'FAIL'} aspects=${inv.totals.aspects} owners=${inv.totals.ownerExists} tests=${inv.totals.testsFound} branches=${inv.totals.branchesAssigned} openPrs=${inv.totals.openPrs} readiness=${JSON.stringify(inv.byReadiness)} warnings=${result.warnings.length}`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
