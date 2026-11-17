import test from 'node:test';
import assert from 'node:assert/strict';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';

const genomeApi = await import('../src/organism/system/DevelopmentalGenome.ts').catch(() => ({}));
const invariantApi = await import('../src/organism/system/InvariantEngine.ts');

const expectedModules = ['agency', 'embodiment', 'governance', 'memory', 'research', 'self', 'world'];

test('InvariantEngine exposes the rule manifest without transferring validation ownership', () => {
  assert.equal(typeof invariantApi.invariantRuleManifest, 'function');
  const manifest = invariantApi.invariantRuleManifest();
  assert.equal(manifest.owner, 'InvariantEngine');
  assert.ok(manifest.rules.length >= 10);
  assert.ok(manifest.rules.every(rule => rule.code && rule.path && ['error', 'warning'].includes(rule.severity)));
});

test('live fabric emits a deterministic genome for exactly its seven canonical systems', () => {
  assert.equal(typeof genomeApi.buildDevelopmentalGenome, 'function');
  const fabric = new OrganismSystemFabric();
  assert.equal(typeof fabric.developmentalGenome, 'function');
  const direct = fabric.developmentalGenome();
  const rebuilt = genomeApi.buildDevelopmentalGenome();
  assert.equal(direct.schemaVersion, 1);
  assert.equal(direct.activation, 'NOT_APPLIED');
  assert.deepEqual(direct.modules.map(module => module.name).sort(), expectedModules);
  assert.equal(direct.digest, rebuilt.digest);
  assert.equal(fabric.snapshot().developmentalGenome.digest, direct.digest);
  assert.match(direct.digest, /^sha256:[0-9a-f]{64}$/);
});

test('dependency order places each prerequisite before its dependent', () => {
  const genome = genomeApi.buildDevelopmentalGenome();
  const position = new Map(genome.dependencyOrder.map((name, index) => [name, index]));
  for (const module of genome.modules) {
    for (const dependency of module.dependencies) {
      assert.ok(position.has(dependency), `missing dependency ${dependency}`);
      assert.ok(position.get(dependency) < position.get(module.name), `${dependency} must precede ${module.name}`);
    }
  }
});

test('baseline survives JSON round-trip and verifies against the current runtime contract', () => {
  const baseline = genomeApi.buildDevelopmentalGenome();
  const restored = JSON.parse(JSON.stringify(baseline));
  const report = genomeApi.evaluateDevelopmentalGenome(restored);
  assert.equal(report.status, 'APPROVED');
  assert.deepEqual(report.violations, []);
  assert.equal(report.activation, 'NOT_APPLIED');
});

test('inheritance changes only bounded resource traits and binds the exact parent digest', () => {
  const parent = genomeApi.buildDevelopmentalGenome();
  const child = genomeApi.inheritDevelopmentalGenome(parent, [
    { module: 'world', estimatedCost01: 0.24, cadenceCycles: 2 },
  ]);
  const report = genomeApi.evaluateDevelopmentalGenome(child, parent);
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
  const parent = genomeApi.buildDevelopmentalGenome();
  const child = genomeApi.inheritDevelopmentalGenome(parent, [{ module: 'world', cadenceCycles: 2 }]);
  assert.equal(genomeApi.evaluateDevelopmentalGenome(child).status, 'NEEDS_REVIEW');
});

test('inheritance rejects unknown or repeated modules and invalid trait values without coercion', () => {
  const parent = genomeApi.buildDevelopmentalGenome();
  assert.throws(() => genomeApi.inheritDevelopmentalGenome(parent, [{ module: 'unknown', cadenceCycles: 2 }]));
  assert.throws(() => genomeApi.inheritDevelopmentalGenome(parent, [
    { module: 'world', cadenceCycles: 2 },
    { module: 'world', estimatedCost01: 0.3 },
  ]));
  for (const value of [NaN, Infinity, -0.1, 1.1]) {
    assert.throws(() => genomeApi.inheritDevelopmentalGenome(parent, [{ module: 'world', estimatedCost01: value }]));
  }
  for (const value of [0, 1.5, 65, NaN, Infinity]) {
    assert.throws(() => genomeApi.inheritDevelopmentalGenome(parent, [{ module: 'world', cadenceCycles: value }]));
  }
});

test('gate rejects a re-hashed candidate that changes immutable module ownership or dependency contracts', () => {
  const parent = genomeApi.buildDevelopmentalGenome();
  const candidate = genomeApi.inheritDevelopmentalGenome(parent, [{ module: 'world', cadenceCycles: 2 }]);
  candidate.modules.find(module => module.name === 'world').purpose = 'forged owner';
  candidate.modules.find(module => module.name === 'world').dependencies.push('agency');
  candidate.digest = genomeApi.computeDevelopmentalGenomeDigest(candidate);
  const report = genomeApi.evaluateDevelopmentalGenome(candidate, parent);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.violations.some(item => item.code === 'immutable-module-change'));
});

test('gate rejects altered invariant, release-schema, and migration-owner contracts', () => {
  const parent = genomeApi.buildDevelopmentalGenome();
  const candidate = genomeApi.inheritDevelopmentalGenome(parent, [{ module: 'world', cadenceCycles: 2 }]);
  candidate.invariants.rules.pop();
  candidate.runtimeContract.stateSchema += 1;
  candidate.runtimeContract.migrationOwner = 'untrusted-migration';
  candidate.digest = genomeApi.computeDevelopmentalGenomeDigest(candidate);
  const report = genomeApi.evaluateDevelopmentalGenome(candidate, parent);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.violations.some(item => item.code === 'invariant-contract-mismatch'));
  assert.ok(report.violations.some(item => item.code === 'runtime-contract-mismatch'));
});

test('gate rejects forged digests, broken lineage, duplicate modules, and cyclic dependencies', () => {
  const parent = genomeApi.buildDevelopmentalGenome();
  const child = genomeApi.inheritDevelopmentalGenome(parent, [{ module: 'world', cadenceCycles: 2 }]);
  const forgedDigest = structuredClone(child);
  forgedDigest.digest = 'sha256:' + '0'.repeat(64);
  assert.ok(genomeApi.evaluateDevelopmentalGenome(forgedDigest, parent).violations.some(item => item.code === 'digest-mismatch'));

  const forgedParent = structuredClone(child);
  forgedParent.lineage.parentDigest = 'sha256:' + 'f'.repeat(64);
  forgedParent.digest = genomeApi.computeDevelopmentalGenomeDigest(forgedParent);
  assert.ok(genomeApi.evaluateDevelopmentalGenome(forgedParent, parent).violations.some(item => item.code === 'lineage-parent-mismatch'));

  const cyclic = structuredClone(parent);
  cyclic.modules.find(module => module.name === 'world').dependencies.push('self');
  cyclic.digest = genomeApi.computeDevelopmentalGenomeDigest(cyclic);
  assert.ok(genomeApi.evaluateDevelopmentalGenome(cyclic).violations.some(item => item.code === 'dependency-cycle'));

  const duplicate = structuredClone(parent);
  duplicate.modules.push(structuredClone(duplicate.modules[0]));
  duplicate.digest = genomeApi.computeDevelopmentalGenomeDigest(duplicate);
  assert.ok(genomeApi.evaluateDevelopmentalGenome(duplicate).violations.some(item => item.code === 'duplicate-module'));
});

console.log('DEVELOPMENTAL_GENOME_TESTS=DEFINED');
