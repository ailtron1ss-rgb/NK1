import assert from 'node:assert/strict';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';
import { EvidenceResearchSubsystemRuntime } from '../src/organism/core/EvidenceResearchSubsystemRuntime.ts';

// Regression: the physical seven-subsystem graph must be the input to the
// mechanism-discovery runtime, not a manually supplied demo graph.
const fabric = new OrganismSystemFabric();
const graph = fabric.systemGraph();
const first = fabric.discoverMechanisms();

assert.equal(first.version, 1);
assert.equal(first.source, 'organism-system-fabric');
assert.equal(first.problem.domain, 'cognitive-runtime');

assert.equal(first.problem.flowEvidenceClass, 'declared-dependency',
  'the physical subsystem graph contains declared dependencies, not observed causal effects');
assert.ok(first.diagnostics.evidenceConfidence01 <= 0.65,
  'topology-only intake must cap its evidence confidence');
assert.ok(first.experiments.every(x => x.mechanismFlowEvidenceClass === 'declared-dependency'),
  'verify-only experiments must preserve the provenance class of their source graph');

assert.equal(first.problem.actors.length, graph.nodes.length);
assert.equal(first.problem.flows.length, graph.edges.length);
assert.equal(first.diagnostics.totalSystems, 7);
assert.ok(first.sourceEvidence.every(x => x.evidenceKeys.includes('owner-binding')), 'live intake must use lightweight owner-binding probes, not full snapshot health probes');
assert.ok(first.result.evaluatedN >= 1);
assert.ok(first.experiments.length >= 1, 'a matching live NK1 structure must produce at least one verify-only hypothesis');
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

const durableResearchSnapshot = fabric.research.snapshot();
const restoredResearch = new EvidenceResearchSubsystemRuntime();
restoredResearch.restore(durableResearchSnapshot);
const restartedFabric = new OrganismSystemFabric({ research: restoredResearch });
const afterRestart = restartedFabric.discoverMechanisms();
assert.equal(afterRestart.experiments.length, 0,
  'restored discovery ledger must suppress an already queued hypothesis after restart');
assert.equal(afterRestart.diagnostics.suppressedDuplicates, first.experiments.length,
  'restored duplicate suppression must survive research-subsystem restore');

console.log('IDEA10_MECHANISM_RUNTIME_INTAKE=PASS', JSON.stringify({
  actors: first.problem.actors.length,
  flows: first.problem.flows.length,
  mechanismsEvaluated: first.result.evaluatedN,
  hypothesesQueued: first.experiments.length,
  duplicatesSuppressed: second.diagnostics.suppressedDuplicates,
}));
