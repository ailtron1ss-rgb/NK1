import assert from 'node:assert/strict';
import { CognitiveDependencyGraph } from '../src/organism/core/CognitiveDependencyGraph.ts';

const graph = new CognitiveDependencyGraph();
const frame = (tick, interrupt) => graph.resolve({
  tick,
  reason: 'interrupt episode test',
  dirtyDomains: { self: false, world: false, memory: false, agency: false, embodiment: false, research: false, governance: false },
  interrupt,
});
const active = { active: true, priority01: 0.7, type: 'external-deadline', domains: ['agency', 'memory'] };

frame(1, active);
assert.equal(graph.snapshot().interrupts, 1, 'a new active interrupt starts one episode');
frame(2, active);
frame(3, { ...active, priority01: 0.8 });
frame(4, { ...active, domains: ['memory', 'agency'] });
assert.equal(graph.snapshot().interrupts, 1, 'sustained activity, priority drift, and domain order must not inflate episodes');

frame(5, { active: true, priority01: 0.7, type: 'thermal-pressure', domains: ['embodiment'] });
assert.equal(graph.snapshot().interrupts, 2, 'a distinct interrupt type/domain set begins a new episode');
frame(6, { active: false, priority01: 0, type: 'none', domains: [] });
frame(7, active);
assert.equal(graph.snapshot().interrupts, 3, 'a reactivated interrupt after a clear starts a new episode');

const restored = new CognitiveDependencyGraph();
restored.restore(graph.snapshot());
restored.resolve({ tick: 8, reason: 'same persisted interrupt', dirtyDomains: { self: false, world: false, memory: false, agency: false, embodiment: false, research: false, governance: false }, interrupt: active });
assert.equal(restored.snapshot().interrupts, 3, 'a persisted active episode must not be counted again on restart');

console.log('WorkPass324 cognitive interrupt episode counting: PASS');
