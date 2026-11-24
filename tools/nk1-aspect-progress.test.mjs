import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTracker, validateTracker, summarize, nextActionable, formatReport } from './nk1-aspect-progress.mjs';

// The tracker is the single source of truth for the 75-aspect plan. These tests
// guard its integrity so a later edit cannot silently drop an aspect, invent a
// dangling dependency, mark an aspect PASS without evidence, or reintroduce a
// dependency cycle.

const real = loadTracker();

test('real tracker loads with zero integrity errors', () => {
  const { errors } = validateTracker(real);
  assert.deepEqual(errors, [], errors.join('; '));
});

test('real tracker covers all 75 aspects with unique ids and nums', () => {
  assert.equal(real.aspects.length, 75);
  const ids = new Set(real.aspects.map((a) => a.id));
  const nums = new Set(real.aspects.map((a) => a.num));
  assert.equal(ids.size, 75);
  assert.equal(nums.size, 75);
  for (let n = 1; n <= 75; n++) assert.ok(nums.has(n), `missing aspect num ${n}`);
});

test('75 aspects are grouped into ten shared canonical aspect lines', () => {
  const declared = Object.values(real.aspectLines).map((line) => line.branch).sort();
  const assigned = [...new Set(real.aspects.map((a) => real.aspectLines[a.aspectLine]?.branch))].sort();
  assert.equal(Object.keys(real.aspectLines).length, 10);
  assert.equal(new Set(real.aspects.map((a) => a.aspectLine)).size, 10);
  assert.deepEqual(assigned, declared);
  for (const a of real.aspects) {
    assert.ok(a.waves.length >= 1, `${a.id} has no wave`);
    assert.match(a.aspectLine, /^[a-z0-9-]+$/, `${a.id} aspect line malformed: ${a.aspectLine}`);
    assert.ok(real.aspectLines[a.aspectLine].aspectIds.includes(a.id), `${a.id} missing from line membership`);
  }
});

test('owner hints for the 2.5D and 3D aspects resolve to real files', () => {
  const by = Object.fromEntries(real.aspects.map((a) => [a.id, a]));
  assert.deepEqual(by.A27.ownerPaths, ['app/src/components/avatar/depthRig.ts']);
  assert.deepEqual(by.A28.ownerPaths, ['app/src/components/avatar/vrmHumanoidRigAdapter.ts']);
});

// --- negative controls on synthetic trackers ---------------------------------

function baseDoc() {
  return {
    waves: { W1: { name: 'w1' } },
    aspectLines: { test: { branch: 'aspect/test', aspectIds: ['A01', 'A02'] } },
    aspects: [
      { id: 'A01', num: 1, waves: ['W1'], dependsOn: [], evidence: [], status: 'PLANNED', aspectLine: 'test' },
      { id: 'A02', num: 2, waves: ['W1'], dependsOn: ['A01'], evidence: [], status: 'PLANNED', aspectLine: 'test' },
    ],
  };
}

test('an unknown aspect line is an integrity error', () => {
  const doc = baseDoc();
  doc.aspects[0].aspectLine = 'missing-line';
  const { errors } = validateTracker(doc);
  assert.ok(errors.some((e) => e.includes('A01') && e.includes('unknown aspect line')), errors.join('; '));
});

test('a PASS aspect with no evidence is an integrity error', () => {
  const doc = baseDoc();
  doc.aspects[0].status = 'PASS';
  const { errors } = validateTracker(doc);
  assert.ok(errors.some((e) => e.includes('A01') && e.includes('evidence')), errors.join('; '));
});

test('a dangling dependency is an integrity error', () => {
  const doc = baseDoc();
  doc.aspects[1].dependsOn = ['A99'];
  const { errors } = validateTracker(doc);
  assert.ok(errors.some((e) => e.includes('unknown A99')), errors.join('; '));
});

test('a duplicate aspect id is an integrity error', () => {
  const doc = baseDoc();
  doc.aspects[1].id = 'A01';
  const { errors } = validateTracker(doc);
  assert.ok(errors.some((e) => e.includes('duplicate aspect id A01')), errors.join('; '));
});

test('a dependency cycle is an integrity error', () => {
  const doc = baseDoc();
  doc.aspects[0].dependsOn = ['A02'];
  const { errors } = validateTracker(doc);
  assert.ok(errors.some((e) => e.includes('cycle')), errors.join('; '));
});

test('an invalid status is an integrity error', () => {
  const doc = baseDoc();
  doc.aspects[0].status = 'DONE';
  const { errors } = validateTracker(doc);
  assert.ok(errors.some((e) => e.includes('invalid status DONE')), errors.join('; '));
});

test('summarize counts PASS and per-wave progress', () => {
  const doc = baseDoc();
  doc.aspects[0].status = 'PASS';
  doc.aspects[0].evidence = ['run-1'];
  doc.aspects[1].status = 'IN_PROGRESS';
  const s = summarize(doc);
  assert.equal(s.pass, 1);
  assert.equal(s.byStatus.IN_PROGRESS, 1);
  assert.equal(s.byWave.W1.total, 2);
  assert.equal(s.byWave.W1.pass, 1);
  assert.equal(s.overallPercent, 50);
});

test('nextActionable returns only PLANNED aspects whose deps are PASS', () => {
  const doc = baseDoc();
  // A01 planned, A02 planned but depends on A01 -> only A01 actionable.
  assert.deepEqual(nextActionable(doc), ['A01']);
  doc.aspects[0].status = 'PASS';
  doc.aspects[0].evidence = ['run-1'];
  assert.deepEqual(nextActionable(doc), ['A02']);
});

test('formatReport renders without throwing', () => {
  const text = formatReport(real);
  assert.match(text, /overall: 0\/75 PASS/);
  assert.match(text, /W1 /);
});
