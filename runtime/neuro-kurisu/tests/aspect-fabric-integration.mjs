import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AspectIntegrationGraph } from '../src/organism/core/AspectIntegrationGraph.ts';
import { OrganismAspectFabric } from '../src/organism/core/OrganismAspectFabric.ts';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';
import { CognitiveSubsystemRegistry } from '../src/organism/core/CognitiveSubsystemRegistry.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const manifest = JSON.parse(readFileSync(path.join(root, 'engineering-os', 'aspect-fabric.v1.json'), 'utf8'));
const graph = new AspectIntegrationGraph(manifest);
const validation = graph.validate();
assert.equal(validation.ok, true, validation.errors.join('; '));
assert.equal(graph.manifest.aspects.length, 75);
assert.equal(graph.manifest.domains.length, 10);
assert.equal(graph.manifest.systems.length, 7);
assert.equal(graph.manifest.coverage.connected, true);
assert.equal(graph.manifest.coverage.nodes, 83);
assert.equal(graph.health().ok, true);
assert.equal(graph.health().orphans.length, 0);
assert.equal(graph.topologicalOrder().length, 75);
for (const aspect of graph.manifest.aspects) {
  for (const dependency of aspect.dependsOn) {
    assert.ok(graph.topologicalOrder().indexOf(dependency) < graph.topologicalOrder().indexOf(aspect.n), `dependency ${dependency} must precede ${aspect.n}`);
  }
}

const systems = new OrganismSystemFabric();
const registry = new CognitiveSubsystemRegistry(systems);
const fabric = new OrganismAspectFabric(graph, systems, registry);
const health = fabric.health();
assert.equal(health.ok, true, JSON.stringify(health.missingSystems));
assert.equal(health.coverage.length, 7);
assert.equal(health.coverage.filter(row => row.present).length, 7);
assert.equal(health.systems.length, 7);
assert.equal(health.subsystems.length, 7);

// The aspect graph and seven physical owners can be present while a real
// subsystem port is unavailable. Aggregate health must not report connected.
const failingRegistry = {
  health: () => health.subsystems.map(row => row.name === 'memory'
    ? { ...row, available:false, failedProbeCount:1, failedPorts:['snapshot'] }
    : row),
};
const degradedFabric = new OrganismAspectFabric(graph, systems, failingRegistry);
const degradedHealth = degradedFabric.health();
assert.equal(degradedHealth.ok, false);
assert.deepEqual(degradedHealth.missingSubsystems, ['memory']);
assert.equal(degradedFabric.snapshot().connected, false);
assert.throws(() => degradedFabric.assertConnected(), /subsystem:memory/);

const snapshot = fabric.snapshot();
assert.equal(snapshot.connected, true);
assert.equal(snapshot.graph.nodes.length, 75);
assert.equal(snapshot.graph.systems.length, 7);
assert.equal(snapshot.graph.domains.length, 10);
assert.ok(snapshot.graph.edges.length >= 75 + 7);
assert.equal(snapshot.branchProvenance.length, 75);
assert.equal(snapshot.branchProvenance.reduce((sum, row) => sum + row.branches.total, 0), 711);
assert.equal(fabric.tick().tick, 1);

const runtime = new OrganismRuntime({ stateFile: '/tmp/nk1-aspect-fabric-runtime.json', stateStore: new MemoryStateStore(), enableLanguage: false, autoRun: false, intervalMs: 30000 });
assert.ok(runtime.organismSystemFabric);
const runtimeRegistry = new CognitiveSubsystemRegistry(runtime.organismSystemFabric);
const runtimeFabric = new OrganismAspectFabric(graph, runtime.organismSystemFabric, runtimeRegistry);
const attached = runtime.attachAspectFabric(runtimeFabric);
assert.equal(attached.connected, true);
assert.equal(runtime.aspectFabricHealth().ok, true);
assert.equal(runtime.aspectFabricSnapshot().graph.nodes.length, 75);

console.log('ASPECT_FABRIC_INTEGRATION=PASS');
console.log(JSON.stringify({ aspects: graph.manifest.aspects.length, domains: graph.manifest.domains.length, systems: graph.manifest.systems.length, nodes: graph.manifest.coverage.nodes, edges: graph.manifest.edges.length, branches: snapshot.branchProvenance.reduce((sum, row) => sum + row.branches.total, 0), runtimeAttached: attached.connected }));
