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

let first = null;
for (let attempt = 0; attempt < 12; attempt += 1) {
  const cycle = await core.observe({ novelty: 1, uncertainty: 1, surprise: .35 });
  if (cycle.decision.selected?.action && !['wait', 'defer'].includes(cycle.decision.selected.action)) {
    first = cycle;
    break;
  }
}
assert.ok(first, 'spine-only fixture must select a substantive autonomous action within 12 ticks');
assert.notEqual(first.decision.selected.action, 'wait');
assert.notEqual(first.decision.selected.action, 'defer');
const planned = core.selfAuthorshipSnapshot();
assert.equal(planned.autonomousActionCount, 0, 'spine-only selection must not be credited before an outcome');
assert.equal(planned.pendingDecisions.length, 1, `spine-only ${first.decision.selected.action} decision must be registered with canonical SelfAuthorship`);
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
const internallyAuthoredGoalCount = resumed.selfAuthorshipSnapshot().selfAuthoredGoalCount;
assert.equal(resumed.selfAuthorshipSnapshot().pendingDecisions.length, 0,
  'an externalGoal must not create an intrinsic pending decision');
assert.equal(internallyAuthoredGoalCount, credited.selfAuthoredGoalCount,
  'externalGoal must not add to intrinsic self-authored commitments');

const followup = await resumed.observe({
  success: .73,
  reward: .61,
  surprise: .34,
  novelty: .7,
});
assert.equal(followup.decision.outcome, undefined,
  'spine-only feedback observed at the start of a cycle must not be attached to the newly selected trace');
const priorExternalTrace = resumed.snapshot().traces.find(row => row.id === external.decision.id);
assert.equal(priorExternalTrace?.outcome?.success, .73,
  'feedback supplied with the next observation must remain attached to the prior decision trace');

await resumed.flush();
console.log('SELF_AUTHORSHIP_SPINEONLY_RUNTIME_WORKPASS71=PASS');
