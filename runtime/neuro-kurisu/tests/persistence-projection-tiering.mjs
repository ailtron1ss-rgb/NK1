import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

class SpyStore {
  values = [];
  async load(){ return null; }
  async save(value){ this.values.push(structuredClone(value)); }
  metrics(){ return null; }
}

const store = new SpyStore();
const core = new OrganismCore(store, { checkpointMaxDirtyCycles: 3, checkpointMinIntervalMs: 0 });
await core.init();
assert.equal(core.persistenceProjectionSnapshot().fullCheckpoints, 1, 'init must establish a full projection');

await core.observe({ text: 'projection tier one' });
let p = core.persistenceProjectionSnapshot();
assert.equal(p.lastProjectionWasFull, false, 'first regular checkpoint should be hot');
assert.equal(p.dirtyCyclesSinceFull, 1);

await core.observe({ text: 'projection tier two' });
p = core.persistenceProjectionSnapshot();
assert.equal(p.lastProjectionWasFull, false);
assert.equal(p.dirtyCyclesSinceFull, 2);

await core.observe({ text: 'projection tier three' });
p = core.persistenceProjectionSnapshot();
assert.equal(p.lastProjectionWasFull, true, 'third checkpoint must refresh the advanced projection');
assert.equal(p.dirtyCyclesSinceFull, 0);
assert.equal(p.fullCheckpoints, 2);
assert.ok(p.hotCheckpoints >= 2);
assert.equal(typeof p.advancedProjection?.freshness01, 'number');
assert.equal(p.advancedProjection?.lastFullTick, 3);

// A forced flush is always a full projection and must reset the tier window.
await core.flush();
p = core.persistenceProjectionSnapshot();
assert.equal(p.lastProjectionWasFull, true);
assert.equal(p.dirtyCyclesSinceFull, 0);
assert.equal(p.fullCheckpoints, 3);

assert.equal(store.values.length, 3, 'only init + scheduled full + forced flush should be durable');
console.log(`PERSISTENCE_PROJECTION_TIERING=PASS saves=${store.values.length} hot=${p.hotCheckpoints} full=${p.fullCheckpoints}`);
