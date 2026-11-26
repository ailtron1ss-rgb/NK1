import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const backing = new MemoryStateStore();
let failNextSave = false;
const store = {
  async load() { return backing.load(); },
  async save(value) {
    if (failNextSave) {
      failNextSave = false;
      throw new Error('injected-revision-checkpoint-failure');
    }
    await backing.save(value);
  },
  metrics() { return backing.metrics(); },
};

const core = new OrganismCore(store, {
  enableLanguage: false,
  performanceProfile: 'mobile',
  cycleResultMode: 'operational',
  checkpointMinIntervalMs: 60_000,
  checkpointMaxDirtyCycles: 8,
});
await core.init();
await core.observe({ text: 'touch critical memory identity and development revisions before failing checkpoint' });

const beforeGraph = core.revisionGraphSnapshot();
const beforeTokens = core.persistenceProjectionSnapshot().revisionTokens;
const dirtyDomains = Object.entries(beforeGraph.current)
  .filter(([domain, revision]) => revision !== beforeGraph.materialized[domain])
  .map(([domain]) => domain);
assert.ok(dirtyDomains.length > 0, 'fixture must have unmaterialized revisions before the forced checkpoint');
const beforePersisted = await backing.load();
const beforeDurableGraph = beforePersisted?.system?.revisionGraph;
assert.ok(beforeDurableGraph, 'fixture must have a previous durable checkpoint');

failNextSave = true;
await assert.rejects(core.flush(), /injected-revision-checkpoint-failure/);

const afterFailedGraph = core.revisionGraphSnapshot();
const afterFailedTokens = core.persistenceProjectionSnapshot().revisionTokens;
for (const domain of dirtyDomains) {
  assert.equal(
    afterFailedGraph.materialized[domain],
    beforeGraph.materialized[domain],
    `failed checkpoint must not mark ${domain} revision as durable`,
  );
  assert.equal(
    afterFailedGraph.current[domain],
    beforeGraph.current[domain],
    `failed checkpoint must preserve ${domain} current revision`,
  );
}
for (const [subsystem, token] of Object.entries(beforeTokens.tokens)) {
  const after = afterFailedTokens.tokens[subsystem];
  assert.equal(
    after.materializedRevision,
    token.materializedRevision,
    `failed checkpoint must not materialize subsystem token ${subsystem}`,
  );
}
const stillDurable = await backing.load();
assert.deepEqual(
  stillDurable.system.revisionGraph,
  beforeDurableGraph,
  'backing store must remain at its previous committed revision graph',
);

// A subsequent committed full checkpoint must materialize every dirty domain,
// and its persisted graph and subsystem tokens must agree with the in-memory owners.
await core.flush();
const committed = await backing.load();
const committedGraph = core.revisionGraphSnapshot();
const committedTokens = core.persistenceProjectionSnapshot().revisionTokens;
for (const domain of dirtyDomains) {
  assert.equal(committedGraph.materialized[domain], committedGraph.current[domain]);
  assert.equal(committed.system.revisionGraph.materialized[domain], committed.system.revisionGraph.current[domain]);
}
for (const [subsystem, token] of Object.entries(committedTokens.tokens)) {
  assert.equal(token.materializedRevision, token.revision, `committed subsystem token ${subsystem} must be clean`);
  assert.equal(
    committed.system.revisionTokens.tokens[subsystem].materializedRevision,
    committed.system.revisionTokens.tokens[subsystem].revision,
  );
}

console.log('REVISION_MATERIALIZATION_AFTER_COMMIT=PASS');
