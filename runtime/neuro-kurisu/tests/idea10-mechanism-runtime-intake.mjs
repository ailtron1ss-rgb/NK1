import assert from 'node:assert/strict';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';

// Regression: the physical seven-subsystem graph must be the input to the
// mechanism-discovery runtime, not a manually supplied demo graph.
const fabric = new OrganismSystemFabric();
const graph = fabric.systemGraph();
const first = fabric.discoverMechanisms();

assert.equal(first.version, 1);
assert.equal(first.problem.source, 'organism-system-fabric');
assert.equal(first.problem.domain, 'cognitive-runtime');
assert.equal(first.problem.actors.length, graph.nodes.length);
assert.equal(first.problem.flows.length, graph.edges.length);
assert.equal(first.diagnostics.health.total, 7);
assert.ok(first.result.evaluatedN >= 1);
assert.ok(['matched', 'no-match', 'insufficient-structure'].includes(first.result.status));
assert.ok(first.experiments.every(x =>
  x.action === 'verify' &&
  x.status === 'candidate' &&
  x.epistemicStatus === 'hypothesis' &&
  x.verificationRequired === true
), 'the runtime bridge must produce verify-only, unverified experiments');

const second = fabric.discoverMechanisms();
assert.equal(second.problem.id, first.problem.id, 'unchanged subsystem topology and diagnostics must yield a stable problem ID');
assert.equal(second.diagnostics.suppressedDuplicates, first.experiments.length,
  'repeated scans must not re-queue the same mechanism experiment');
assert.ok(second.experiments.length <= first.experiments.length);
console.log('IDEA10_MECHANISM_RUNTIME_INTAKE=PASS', JSON.stringify({
  actors: first.problem.actors.length,
  flows: first.problem.flows.length,
  mechanismsEvaluated: first.result.evaluatedN,
  hypothesesQueued: first.experiments.length,
  duplicatesSuppressed: second.diagnostics.suppressedDuplicates,
}));
