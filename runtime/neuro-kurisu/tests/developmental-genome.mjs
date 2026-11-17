import test from 'node:test';
import assert from 'node:assert/strict';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';
import {
  buildDevelopmentalGenome,
  computeDevelopmentalGenomeDigest,
  evaluateDevelopmentalGenome,
  inheritDevelopmentalGenome,
} from '../src/organism/system/DevelopmentalGenome.ts';
import { invariantRuleManifest } from '../src/organism/system/InvariantEngine.ts';
import { organismSystemContracts } from '../src/organism/core/OrganismSystemContract.ts';

const expectedModules = ['agency', 'embodiment', 'governance', 'memory', 'research', 'self', 'world'];

test('InvariantEngine exposes the rule manifest without transferring validation ownership', () => {
  assert.equal(typeof invariantRuleManifest, 'function');
  const manifest = invariantRuleManifest();
  assert.equal(manifest.owner, 'InvariantEngine');
  assert.ok(manifest.rules.length >= 10);
  assert.ok(manifest.rules.every(rule => rule.code && rule.path && ['error', 'warning'].includes(rule.severity)));
});

test('live fabric emits a deterministic genome for exactly its seven canonical systems', () => {
  assert.equal(typeof buildDevelopmentalGenome, 'function');
  const fabric = new OrganismSystemFabric();
  assert.equal(typeof fabric.developmentalGenome, 'function');
  const direct = fabric.developmentalGenome();
  const rebuilt = buildDevelopmentalGenome();
  assert.equal(direct.schemaVersion, 1);
  assert.equal(direct.activation, 'NOT_APPLIED');
  assert.deepEqual(direct.modules.map(module => module.name).sort(), expectedModules);
  assert.equal(direct.digest, rebuilt.digest);
  assert.equal(fabric.snapshot().developmentalGenome.digest, direct.digest);
  assert.match(direct.digest, /^sha256:[0-9a-f]{64}$/);
});

test('baseline builder rejects invalid inherited resource traits in live contracts', () => {
  const invalidCost = organismSystemContracts();
  invalidCost.find(module => module.name === 'world').estimatedCost01 = 1.5;
  assert.throws(() => buildDevelopmentalGenome(invalidCost));

  const invalidCadence = organismSystemContracts();
  invalidCadence.find(module => module.name === 'world').cadenceCycles = 65;
  assert.throws(() => buildDevelopmentalGenome(invalidCadence));
});

test('dependency order places each prerequisite before its dependent', () => {
  const genome = buildDevelopmentalGenome();
  const position = new Map(genome.dependencyOrder.map((name, index) => [name, index]));
  for (const module of genome.modules) {
    for (const dependency of module.dependencies) {
      assert.ok(position.has(dependency), `missing dependency ${dependency}`);
      assert.ok(position.get(dependency) < position.get(module.name), `${dependency} must precede ${module.name}`);
    }
  }
});

test('baseline survives JSON round-trip and verifies against the current runtime contract', () => {
  const baseline = buildDevelopmentalGenome();
  const restored = JSON.parse(JSON.stringify(baseline));
  const report = evaluateDevelopmentalGenome(restored);
  assert.equal(report.status, 'APPROVED');
  assert.deepEqual(report.violations, []);
  assert.equal(report.activation, 'NOT_APPLIED');
});

test('inheritance changes only bounded resource traits and binds the exact parent digest', () => {
  const parent = buildDevelopmentalGenome();
  const child = inheritDevelopmentalGenome(parent, [
    { module: 'world', estimatedCost01: 0.24, cadenceCycles: 2 },
  ]);
  const report = evaluateDevelopmentalGenome(child, parent);
  assert.equal(child.lineage.generation, parent.lineage.generation + 1);
  assert.equal(child.lineage.parentDigest, parent.digest);
  assert.equal(child.activation, 'NOT_APPLIED');
  assert.equal(report.status, 'APPROVED');
  assert.equal(report.activation, 'NOT_APPLIED');
  assert.deepEqual(child.lineage.changes.map(change => change.trait).sort(), ['cadenceCycles', 'estimatedCost01']);
  assert.equal(child.modules.find(module => module.name === 'world').estimatedCost01, 0.24);
  assert.equal(child.modules.find(module => module.name === 'world').cadenceCycles, 2);
  assert.equal(parent.modules.find(module => module.name === 'world').estimatedCost01, 0.31);
});

test('candidate without its parent is NEEDS_REVIEW, never silently APPROVED', () => {
  const parent = buildDevelopmentalGenome();
  const child = inheritDevelopmentalGenome(parent, [{ module: 'world', cadenceCycles: 2 }]);
  assert.equal(evaluateDevelopmentalGenome(child).status, 'NEEDS_REVIEW');
});

test('multi-generation candidates require and verify the complete parent chain', () => {
  const baseline = buildDevelopmentalGenome();
  const first = inheritDevelopmentalGenome(baseline, [{ module: 'world', cadenceCycles: 2 }]);
  const second = inheritDevelopmentalGenome(first, [{ module: 'world', estimatedCost01: 0.24 }]);
  assert.equal(evaluateDevelopmentalGenome(second, first).status, 'NEEDS_REVIEW');
  assert.equal(evaluateDevelopmentalGenome(second, first, [baseline]).status, 'APPROVED');
});

test('inheritance rejects unknown or repeated modules and invalid trait values without coercion', () => {
  const parent = buildDevelopmentalGenome();
  assert.throws(() => inheritDevelopmentalGenome(parent, [{ module: 'unknown', cadenceCycles: 2 }]));
  assert.throws(() => inheritDevelopmentalGenome(parent, [{ module: 'world' }]));
  assert.throws(() => inheritDevelopmentalGenome(parent, [{ module: 'world', estimatedCost01: undefined }]));
  assert.throws(() => inheritDevelopmentalGenome(parent, [
    { module: 'world', cadenceCycles: 2 },
    { module: 'world', estimatedCost01: 0.3 },
  ]));
  for (const value of [NaN, Infinity, -0.1, 1.1]) {
    assert.throws(() => inheritDevelopmentalGenome(parent, [{ module: 'world', estimatedCost01: value }]));
  }
  for (const value of [0, 1.5, 65, NaN, Infinity]) {
    assert.throws(() => inheritDevelopmentalGenome(parent, [{ module: 'world', cadenceCycles: value }]));
  }
});

test('gate rejects a re-hashed candidate that changes immutable module ownership or dependency contracts', () => {
  const parent = buildDevelopmentalGenome();
  const candidate = inheritDevelopmentalGenome(parent, [{ module: 'world', cadenceCycles: 2 }]);
  candidate.modules.find(module => module.name === 'world').contractVersion = 99;
  candidate.modules.find(module => module.name === 'world').purpose = 'forged owner';
  candidate.modules.find(module => module.name === 'world').dependencies.push('agency');
  candidate.digest = computeDevelopmentalGenomeDigest(candidate);
  const report = evaluateDevelopmentalGenome(candidate, parent);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.violations.some(item => item.code === 'immutable-module-change'));
});

test('gate protects snapshot weights and execution ranks as immutable module contracts', () => {
  const parent = buildDevelopmentalGenome();
  const candidate = inheritDevelopmentalGenome(parent, [{ module: 'world', cadenceCycles: 2 }]);
  const world = candidate.modules.find(module => module.name === 'world');
  world.snapshotWeight01 = 0.99;
  world.executionRank = 99;
  candidate.digest = computeDevelopmentalGenomeDigest(candidate);
  const report = evaluateDevelopmentalGenome(candidate, parent);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.violations.some(item => item.code === 'immutable-module-change'));
});

test('gate rejects altered invariant, release-schema, and migration-owner contracts', () => {
  const parent = buildDevelopmentalGenome();
  const candidate = inheritDevelopmentalGenome(parent, [{ module: 'world', cadenceCycles: 2 }]);
  candidate.invariants.rules.pop();
  candidate.runtimeContract.stateSchema += 1;
  candidate.runtimeContract.migrationOwner = 'untrusted-migration';
  candidate.digest = computeDevelopmentalGenomeDigest(candidate);
  const report = evaluateDevelopmentalGenome(candidate, parent);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.violations.some(item => item.code === 'invariant-contract-mismatch'));
  assert.ok(report.violations.some(item => item.code === 'runtime-contract-mismatch'));
});

test('gate rejects forged digests, broken lineage, duplicate modules, and cyclic dependencies', () => {
  const parent = buildDevelopmentalGenome();
  const child = inheritDevelopmentalGenome(parent, [{ module: 'world', cadenceCycles: 2 }]);
  const forgedDigest = structuredClone(child);
  forgedDigest.digest = 'sha256:' + '0'.repeat(64);
  assert.ok(evaluateDevelopmentalGenome(forgedDigest, parent).violations.some(item => item.code === 'digest-mismatch'));

  const forgedParent = structuredClone(child);
  forgedParent.lineage.parentDigest = 'sha256:' + 'f'.repeat(64);
  forgedParent.digest = computeDevelopmentalGenomeDigest(forgedParent);
  assert.ok(evaluateDevelopmentalGenome(forgedParent, parent).violations.some(item => item.code === 'lineage-parent-mismatch'));

  const cyclic = structuredClone(parent);
  cyclic.modules.find(module => module.name === 'world').dependencies.push('self');
  cyclic.digest = computeDevelopmentalGenomeDigest(cyclic);
  assert.ok(evaluateDevelopmentalGenome(cyclic).violations.some(item => item.code === 'dependency-cycle'));

  const duplicate = structuredClone(parent);
  duplicate.modules.push(structuredClone(duplicate.modules[0]));
  duplicate.digest = computeDevelopmentalGenomeDigest(duplicate);
  assert.ok(evaluateDevelopmentalGenome(duplicate).violations.some(item => item.code === 'duplicate-module'));

  const malformed = structuredClone(parent);
  malformed.modules[0] = null;
  malformed.digest = computeDevelopmentalGenomeDigest(malformed);
  const malformedReport = evaluateDevelopmentalGenome(malformed);
  assert.equal(malformedReport.status, 'BLOCKED');
  assert.ok(malformedReport.violations.some(item => item.code === 'malformed-module'));
});

console.log('DEVELOPMENTAL_GENOME_TESTS=DEFINED');
