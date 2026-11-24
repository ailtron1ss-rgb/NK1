import assert from 'node:assert/strict';
import { CognitiveDependencyGraph } from '../src/organism/core/CognitiveDependencyGraph.ts';

const graph = new CognitiveDependencyGraph();
const clean = graph.snapshot();
assert.equal(clean.version, 1);
assert.equal(clean.dirtyCount, 0);

graph.restore({
  version: 1,
  lastTick: -9,
  wakeMask: 129,
  dirtyCount: 99,
  transitionCount: Infinity,
  lastReason: 'kept\u0000\u0007reason',
  interrupt: {
    active: true,
    priority01: Infinity,
    type: '\u0000'.repeat(100),
    domains: ['memory', 'memory', 'not-a-domain', null, 'governance'],
  },
  interrupts: -4,
  domainTransitions: {
    self: 7,
    world: -1,
    memory: Infinity,
    agency: '4',
    embodiment: Number.MAX_SAFE_INTEGER + 1,
    research: 2,
    governance: 4,
    unexpected: 500,
  },
});
const restored = graph.snapshot();
assert.equal(restored.lastTick, 0);
assert.equal(restored.wakeMask, 1, 'unknown wake-mask bits must be discarded');
assert.equal(restored.dirtyCount, 1, 'dirty count must be derived from the normalized wake mask');
assert.equal(restored.transitionCount, 0);
assert.equal(restored.lastReason, 'kept reason');
assert.deepEqual(restored.interrupt, { active: true, priority01: 0, type: 'none', domains: ['memory', 'governance'] });
assert.equal(restored.interrupts, 0);
assert.deepEqual(restored.domainTransitions, { self: 7, world: 0, memory: 0, agency: 0, embodiment: 0, research: 2, governance: 4 });
assert.equal('unexpected' in restored.domainTransitions, false);

const afterRestore = graph.resolve({
  tick: 1,
  reason: 'still-self-dirty',
  dirtyDomains: { self: true, world: false, memory: false, agency: false, embodiment: false, research: false, governance: false },
  interrupt: { active: false, priority01: 0, type: 'none', domains: [] },
});
assert.equal(afterRestore.transitions, 0, 'restore must seed previous-domain state from the persisted wake mask');
assert.equal(afterRestore.wakeMask, 1);
assert.equal(afterRestore.dirtyCount, 1);
assert.equal(graph.snapshot().domainTransitions.self, 7);

const invalidSnapshot = graph.snapshot();
assert.throws(() => graph.restore({ version: 2 }), /unsupported cognitive-dependency state version/);
assert.deepEqual(graph.snapshot(), invalidSnapshot, 'unsupported versions must not partially mutate live state');

const normalizedFrame = graph.resolve({
  tick: 2,
  reason: 'bounded interrupt',
  dirtyDomains: { self: false, world: true, memory: false, agency: false, embodiment: false, research: false, governance: false },
  interrupt: { active: true, priority01: 1.5, type: 'urgent\u0000input', domains: ['world', 'world', 'bad-domain'] },
});
assert.equal(normalizedFrame.transitions, 2);
assert.deepEqual(graph.interruption(), { active: true, priority01: 1, type: 'urgent input', domains: ['world'] });
assert.equal(graph.shouldWake('world'), true);

const copy = graph.snapshot();
copy.interrupt.domains.push('self');
copy.domainTransitions.world = 999;
assert.deepEqual(graph.snapshot().interrupt.domains, ['world'], 'diagnostics must not leak mutable interrupt arrays');
assert.notEqual(graph.snapshot().domainTransitions.world, 999, 'diagnostics must not leak mutable counters');

console.log('WorkPass320 cognitive dependency restore hardening: PASS');
