import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const config = {
  spineOnly: true,
  cycleResultMode: 'operational',
  enableLanguage: false,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
};

const store = new MemoryStateStore();
const core = new OrganismCore(store, config);
await core.init();

const first = await core.observe({ novelty: .91, surprise: .22 });
assert.ok(first.decision.selected?.action, 'spine-only cycle must select an action');
const planned = core.selfAuthorshipSnapshot();
assert.equal(planned.autonomousActionCount, 0, 'spine-only selection must not be credited before an outcome');
assert.equal(planned.pendingDecisions.length, 1, 'spine-only decisions must be registered with canonical SelfAuthorship');
assert.equal(planned.pendingDecisions[0].decisionId, first.decision.id,
  'pending authorship must use the exact decision trace ID');

await core.flush();
const persisted = await store.load();
assert.equal(persisted.facets.learning.selfAuthorship.pendingDecisions[0].decisionId, first.decision.id,
  'pending spine-only authorship must be part of the canonical persisted snapshot');

const resumedStore = new MemoryStateStore({ initial: persisted });
const resumed = new OrganismCore(resumedStore, config);
await resumed.init();
assert.equal(resumed.selfAuthorshipSnapshot().pendingDecisions[0].decisionId, first.decision.id,
  'unresolved spine-only decision must survive Core restore');

await resumed.feedback({
  success: .94,
  reward: .92,
  surprise: .18,
  evidenceSource: 'device',
  notes: 'independent device receipt for the pending spine-only decision',
});
const credited = resumed.selfAuthorshipSnapshot();
assert.equal(credited.autonomousActionCount, 1, 'verified matching spine-only outcome must earn exactly one action credit');
assert.equal(credited.pendingDecisions.length, 0, 'matching verified outcome must close the pending entry');

await resumed.feedback({
  success: 1,
  reward: 1,
  surprise: 1,
  evidenceSource: 'device',
  notes: 'duplicate outcome replay',
});
assert.equal(resumed.selfAuthorshipSnapshot().autonomousActionCount, 1,
  'duplicate spine-only outcome must not be credited twice');

const external = await resumed.observe({
  externalGoal: { title: 'A goal explicitly supplied from outside', importance: .9, urgency: .8 },
  novelty: .8,
});
assert.ok(external.decision.selected?.action);
assert.equal(resumed.selfAuthorshipSnapshot().autonomousActionCount, 1,
  'externalGoal observations must never become intrinsic autonomous action credit');
assert.equal(resumed.selfAuthorshipSnapshot().selfAuthoredGoalCount, 0,
  'externalGoal must not become an intrinsic self-authored commitment');

await resumed.flush();
console.log('SELF_AUTHORSHIP_SPINEONLY_RUNTIME_WORKPASS71=PASS');
