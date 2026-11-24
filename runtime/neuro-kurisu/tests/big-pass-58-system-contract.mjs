import assert from 'node:assert/strict';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';

const fabric = new OrganismSystemFabric();
const contracts = fabric.contracts();
assert.equal(contracts.length, 7);
assert.deepEqual(fabric.executionOrder(), ['embodiment','world','memory','self','governance','agency','research']);
assert.equal(fabric.dependencyCycles().length, 0, 'physical system dependency graph must remain acyclic; recurrent cognition belongs in runtime state, not ownership cycles');
for (const contract of contracts) {
  assert.equal(contract.version, 1);
  assert.ok(contract.capabilities?.length);
  assert.ok(typeof contract.snapshot === 'function');
  const health = contract.health();
  assert.equal(health.available, true);
}
const graph = fabric.systemGraph();
assert.equal(graph.nodes.length, 7);
assert.equal(graph.edges.length, 11);
assert.equal(graph.dependencyCycles.length, 0);
assert.equal(new Set(graph.order).size, 7);
console.log('BIG_PASS_58_SYSTEM_CONTRACT=PASS');
console.log(`order=${graph.order.join('>')}`);
console.log(`dependencyCycles=${graph.dependencyCycles.length}`);
console.log(`edges=${graph.edges.length}`);
