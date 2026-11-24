import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core = new OrganismCore(new MemoryStateStore());
await core.init();
for (let i = 0; i < 80; i++) {
  await core.observe({ text: `footprint observation ${i} semantic continuity exploration verification ${i % 7}` });
}
const snap = core.snapshot();
const byteSize = value => Buffer.byteLength(JSON.stringify(value));
const branch = {
  autobiographicalMemories: byteSize(snap.facets.memory.autobiographicalMemories),
  eventLog: byteSize(snap.facets.memory.eventLog),
  p62: byteSize(snap.facets.advanced.p62MemoryFabric),
  total: byteSize(snap),
};
assert.ok(snap.facets.memory.autobiographicalMemories.length <= 320);
assert.ok(snap.facets.memory.eventLog.length <= 320);
assert.ok(snap.facets.advanced.p62MemoryFabric.history.length <= 24);
assert.ok(branch.autobiographicalMemories < 145000, `autobiographical branch too large: ${branch.autobiographicalMemories}`);
assert.ok(branch.eventLog < 165000, `event log too large: ${branch.eventLog}`);
assert.ok(branch.p62 < 60000, `P62 branch too large: ${branch.p62}`);
assert.ok(branch.total < 2500000, `persisted snapshot too large: ${branch.total}`);
console.log(`PERSISTENCE_FOOTPRINT=PASS total=${branch.total} auto=${branch.autobiographicalMemories} events=${branch.eventLog} p62=${branch.p62}`);
