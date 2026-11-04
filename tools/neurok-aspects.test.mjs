import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateRegistry, computeProgress, nextActionable } from './neurok-aspects.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const doc = JSON.parse(await readFile(path.join(root, 'engineering-os/aspects.v1.json'), 'utf8'));

const clone = () => structuredClone(doc);

test('registry validates: 75 unique aspects, 10 groups, 6 waves', () => {
  const result = validateRegistry(doc);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(doc.aspects.length, 75);
  assert.equal(doc.groups.length, 10);
  assert.equal(doc.waves.length, 6);
  assert.deepEqual([...new Set(doc.aspects.map(a => a.n))].sort((a, b) => a - b), Array.from({ length: 75 }, (_, i) => i + 1));
});

test('waves may overlap but every aspect is covered and tagged with its earliest wave', () => {
  const lists = new Map();
  for (const w of doc.waves) {
    const within = new Set();
    for (const n of w.aspects) {
      assert.ok(!within.has(n), `wave ${w.id} lists aspect ${n} twice`);
      within.add(n);
      if (!lists.has(n)) lists.set(n, []);
      lists.get(n).push(Number(w.id));
    }
  }
  assert.equal(lists.size, 75);
  for (const [n, waveIds] of lists) {
    const aspect = doc.aspects.find(a => a.n === n);
    assert.equal(aspect.wave, String(Math.min(...waveIds)));
  }
});

test('dependency graph is acyclic', () => {
  const graph = new Map(doc.aspects.map(a => [a.id, a.dependsOn]));
  const color = new Map();
  const visit = (id) => {
    color.set(id, 1);
    for (const dep of graph.get(id) ?? []) {
      assert.notEqual(color.get(dep), 1, `cycle through ${dep}`);
      if ((color.get(dep) ?? 0) === 0) visit(dep);
    }
    color.set(id, 2);
  };
  for (const id of graph.keys()) if ((color.get(id) ?? 0) === 0) visit(id);
});

test('a verified status without evidence is rejected (fail-closed)', () => {
  const bad = clone();
  bad.aspects[0].status = 'PROVEN';
  bad.aspects[0].evidence = '';
  const result = validateRegistry(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('requires a non-empty evidence reference')));
});

test('missing or duplicate aspects are rejected', () => {
  const missing = clone();
  missing.aspects.pop();
  assert.equal(validateRegistry(missing).ok, false);

  const dup = clone();
  dup.aspects.push(structuredClone(dup.aspects[0]));
  const result = validateRegistry(dup);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('duplicate aspect id')));
});

test('unknown dependency and dependency cycle are rejected', () => {
  const unknownDep = clone();
  unknownDep.aspects[0].dependsOn = ['does-not-exist'];
  assert.equal(validateRegistry(unknownDep).ok, false);

  const cyclic = clone();
  const a = cyclic.aspects.find(x => x.id === 'core-architecture');
  const b = cyclic.aspects.find(x => x.id === 'organism-bus');
  a.dependsOn = ['organism-bus'];
  b.dependsOn = ['core-architecture'];
  const result = validateRegistry(cyclic);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('dependency cycle')));
});

test('an unmapped aspect may not claim a canonical owner', () => {
  const bad = clone();
  const aspect = bad.aspects.find(a => a.ownerStatus === 'unmapped');
  aspect.owner = 'runtime/neuro-kurisu/src/organism/core/OrganismCore.ts';
  const result = validateRegistry(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('unmapped but owner is not "UNKNOWN"')));
});

test('wave tagging mismatch is rejected', () => {
  const bad = clone();
  bad.aspects[0].wave = '6';
  const result = validateRegistry(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('tagged wave')));
});

test('progress accounting counts only verified statuses as verified', () => {
  const progress = computeProgress(doc);
  assert.equal(progress.total, 75);
  assert.equal(progress.verified, doc.aspects.filter(a => doc.verifiedStatuses.includes(a.status)).length);
  assert.ok(progress.implemented > 0);
  assert.equal(progress.verified + progress.implemented + progress.planned + progress.blocked, 75);
});

test('next actionable aspect has only verified dependencies and is not blocked', () => {
  const next = nextActionable(doc);
  assert.ok(next, 'expected an actionable aspect');
  const verified = new Set(doc.aspects.filter(a => doc.verifiedStatuses.includes(a.status)).map(a => a.id));
  for (const dep of next.aspect.dependsOn) assert.ok(verified.has(dep), `dependency ${dep} is not verified`);
  assert.notEqual(next.aspect.status, 'BLOCKED');
});

test('an aspect whose dependency is unverified is not returned as next', () => {
  const gated = clone();
  const target = gated.aspects.find(a => a.id === 'reliability');
  gated.verifiedStatuses = gated.verifiedStatuses.filter(s => s !== 'TESTED');
  gated.aspects = gated.aspects.map(a => (a.id === 'organism-state' ? { ...a, status: 'PLANNED', evidence: null } : a));
  const next = nextActionable(gated);
  assert.ok(next);
  assert.notEqual(next.aspect.id, target.id);
});
