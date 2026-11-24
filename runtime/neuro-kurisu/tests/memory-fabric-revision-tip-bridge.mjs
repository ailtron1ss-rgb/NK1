import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

const memoryOS = new MemoryOS2({ embeddingProvider: null });
const fabric = new MemoryFabric(
  memoryOS, new EventLog(), new MultiTimescaleMemory(),
  new MemorySubstrateCoordinator(), new UnifiedMemorySystem(),
  new P62MemoryFabric(), new SemanticMemoryGraph(),
);
const root = memoryOS.encode({
  content: 'The reactor output reading was nominal.',
  kind: 'semantic',
  source: 'revision-tip-bridge-test',
});
const middle = memoryOS.reviseContent(root.id, 'The reactor output reading was elevated.');
const tip = memoryOS.reviseContent(middle.id, 'The reactor output reading was critical.');
assert.ok(tip);
assert.notEqual(tip.id, root.id);

// A canonical read through MemoryFabric must resolve the active tip, not expose
// the historical row selected by the caller's retained ID.
assert.equal(
  fabric.getCanonicalMemory(root.id)?.id,
  tip.id,
  'MemoryFabric canonical lookup must resolve historical IDs to the current revision tip',
);

// Lifecycle writes addressed by a retained historical ID must return and project
// the active tip. The old wrapper inspected the historical row before writing,
// so it reported the wrong ID and synchronized a stale compatibility projection.
const updated = fabric.applyLifecycleCommand({
  action: 'update-signals',
  id: root.id,
  patch: { salience: 0.91 },
  reason: 'revision-tip-bridge-test',
}) ;
assert.equal(updated?.id, tip.id, 'lifecycle mutation must resolve and return the active revision tip');
assert.equal(memoryOS.snapshotItem(tip.id)?.salience, 0.91);
assert.equal(fabric.getCanonicalMemory(root.id)?.id, tip.id);

const context = fabric.applyLifecycleCommand({
  action: 'update-context',
  id: root.id,
  patch: { topic: 'revision-tip-bridge' },
});
assert.equal(context?.topic, 'revision-tip-bridge');
assert.equal(memoryOS.snapshotItem(tip.id)?.context?.topic, 'revision-tip-bridge');
assert.equal(fabric.getCanonicalMemory(root.id)?.id, tip.id);

console.log('MEMORY_FABRIC_REVISION_TIP_BRIDGE=PASS', JSON.stringify({
  rootId: root.id,
  tipId: tip.id,
  updatedId: updated?.id,
  contextTopic: context?.topic,
}));
