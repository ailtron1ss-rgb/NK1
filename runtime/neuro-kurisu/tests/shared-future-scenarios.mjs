import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { FutureSimulator } from '../src/organism/developmental/FutureSimulator.ts';
import { SharedFutureEngine, registerSharedFutureTools } from '../src/organism/developmental/SharedFutureEngine.ts';

const future = new FutureSimulator();
const gateway = new ActionGateway({ live: false });
gateway.setExecutionLedgerPersister(async () => {});
registerSharedFutureTools(gateway, future);

const listed = await gateway.executeTool('organism.future.scenarios.list', {});
assert.equal(listed.ok, true, 'the canonical ActionGateway must expose the shared-future scenario list');
assert.equal(listed.result.verificationScope, 'local-future-ledger-only');

const rootResult = await gateway.executeTool('organism.future.scenarios.create', {
  id: 'project-root',
  title: 'NK1 stable organism trajectory',
  description: 'A multi-month path for the core project.',
  horizonDays: 180,
  confidence01: 0.72,
  uncertainty01: 0.28,
  assumptions: [{
    id: 'device-budget',
    statement: 'Target Android device has enough remaining storage and memory for the planned test cycle.',
    source: 'user-provided baseline',
    confidence01: 0.6,
    status: 'assumed',
    checkedAt: 100,
    expiresAt: 200,
  }],
  goalLinks: [{ id: 'goal-nk1-release', owner: 'user', relationship: 'supports' }],
  consequences: [{
    id: 'release-readiness',
    description: 'A verified source-to-release path is preserved.',
    probability01: 0.7,
    impact01: 0.9,
    horizonDays: 120,
    reversible: true,
  }],
  pointsOfNoReturn: [{
    id: 'external-migration',
    description: 'Irreversible external data migration.',
    mitigationPlan: 'Take verified backup and run dry-run reconciliation.',
    requiresExplicitConfirmation: true,
  }],
  revisionSignals: [
    { id: 'budget-low', kind: 'metric-below', metricKey: 'monthly-budget', threshold: 50, description: 'Budget fell below the agreed floor.' },
    { id: 'release-date', kind: 'date', dueAt: 1000, description: 'Review the target release date.' },
    { id: 'human-review', kind: 'manual', description: 'The user requests a scenario review.' },
  ],
}, 'shared-future-test', {
  idempotencyKey: 'shared-future-root-create-1',
});
assert.equal(rootResult.ok, true, JSON.stringify(rootResult.result));
assert.equal(rootResult.result.scenario.owner, 'system');

const root = future.sharedFuture.getScenario('project-root');
assert.ok(root);
assert.deepEqual(root.goalLinks, [{ id: 'goal-nk1-release', owner: 'user', relationship: 'supports' }]);
assert.equal(Object.hasOwn(root.goalLinks[0], 'goal'), false, 'goal links must reference canonical goals rather than clone goal records');

const alternativeA = future.sharedFuture.createScenario({
  id: 'timeline-fast',
  title: 'Accelerated delivery',
  parentId: 'project-root',
  alternativeGroupId: 'delivery-timing',
  probability01: 0.6,
  owner: 'system',
});
const alternativeB = future.sharedFuture.createScenario({
  id: 'timeline-safe',
  title: 'Conservative delivery',
  parentId: 'project-root',
  alternativeGroupId: 'delivery-timing',
  probability01: 0.4,
  owner: 'system',
});
assert.equal(alternativeA.parentId, 'project-root');
assert.equal(alternativeB.parentId, 'project-root');
assert.equal(future.sharedFuture.listScenarios().filter((row) => row.alternativeGroupId === 'delivery-timing').length, 2);
assert.throws(() => future.sharedFuture.createScenario({
  id: 'timeline-impossible',
  title: 'Over-probable alternative',
  parentId: 'project-root',
  alternativeGroupId: 'delivery-timing',
  probability01: 0.2,
  owner: 'system',
}), /alternative-probability-total-exceeded/);

const forgedCollaborative = await gateway.executeTool('organism.future.scenarios.create-collaborative', {
  id: 'forged-shared',
  title: 'Forged shared plan',
  owner: 'shared',
  confirmShared: true,
}, 'shared-future-test', { idempotencyKey: 'shared-future-forged-1' });
assert.equal(forgedCollaborative.ok, false, 'ActionGateway must block unapproved collaborative writes');
assert.equal(forgedCollaborative.outcomeClass, 'approval-required', 'the request must reach and be denied by the human-approval gate');
assert.equal(future.sharedFuture.getScenario('forged-shared'), null, 'a denied collaborative write must not enter the scenario ledger');

async function executeWithOwnerApproval(toolId, input, idempotencyKey) {
  const request = await gateway.requestToolApproval(toolId, input, 'shared-future-test', { autonomous: false }, 'execute');
  assert.equal(request.created, true, JSON.stringify(request));
  const approval = await gateway.resolveToolApproval(request.request.id, true, 'test-owner');
  assert.equal(approval.ok, true, JSON.stringify(approval));
  return gateway.executeTool(toolId, input, 'shared-future-test', {
    autonomous: false,
    approvalId: request.request.id,
    idempotencyKey,
  });
}

const sharedInput = {
  id: 'shared-trajectory',
  title: 'Shared NK1 future',
  owner: 'shared',
  confirmShared: true,
  description: 'A future explicitly agreed by the human and NK1.',
  goalLinks: [{ id: 'goal-user-priority', owner: 'user', relationship: 'supports' }],
};
const sharedCreated = await executeWithOwnerApproval(
  'organism.future.scenarios.create-collaborative',
  sharedInput,
  'shared-future-create-1',
);
assert.equal(sharedCreated.ok, true, JSON.stringify(sharedCreated.result));
assert.equal(future.sharedFuture.getScenario('shared-trajectory')?.owner, 'shared');

const userOwned = future.sharedFuture.createScenario({
  id: 'user-owned-trajectory',
  title: 'User-owned objective',
  owner: 'user',
  confirmUserOwned: true,
}, 'user');
assert.equal(userOwned.owner, 'user');
assert.throws(() => future.sharedFuture.createScenario({
  id: 'autonomous-user-claim',
  title: 'Should not claim user ownership',
  owner: 'user',
  confirmUserOwned: true,
}, 'system'), /user-owned-scenario-requires-human-confirmation/);
assert.throws(() => future.sharedFuture.createScenario({
  id: 'autonomous-shared-claim',
  title: 'Should not claim shared ownership',
  owner: 'shared',
  confirmShared: true,
}, 'system'), /shared-ownership-requires-human-confirmation/);

const primaryDecision = future.sharedFuture.proposeDecision({
  id: 'decision-verify-backup',
  scenarioId: 'project-root',
  title: 'Verify the rollback backup',
  owner: 'system',
});
const dependentDecision = future.sharedFuture.proposeDecision({
  id: 'decision-migrate-data',
  scenarioId: 'project-root',
  title: 'Migrate after verification',
  owner: 'system',
  dependsOn: ['decision-verify-backup'],
  irreversible: true,
  pointOfNoReturnId: 'external-migration',
});
assert.equal(primaryDecision.status, 'proposed');
assert.equal(dependentDecision.executionStatus, 'not-executed');
assert.throws(() => future.sharedFuture.confirmDecision({
  decisionId: 'decision-migrate-data',
  confirmIrreversible: true,
  at: 1100,
}, 'user'), /decision-dependencies-not-accepted/);

const primaryApproved = await executeWithOwnerApproval(
  'organism.future.decisions.confirm',
  { decisionId: 'decision-verify-backup' },
  'shared-future-confirm-1',
);
assert.equal(primaryApproved.ok, true, JSON.stringify(primaryApproved.result));
assert.equal(future.sharedFuture.getDecision('decision-verify-backup')?.status, 'accepted');
assert.equal(future.sharedFuture.getDecision('decision-verify-backup')?.executionStatus, 'not-executed');

assert.throws(() => future.sharedFuture.confirmDecision({
  decisionId: 'decision-migrate-data',
  confirmIrreversible: true,
  at: 1200,
}, 'user'), /compensation-plan-required/);
const irreversibleDecision = future.sharedFuture.proposeDecision({
  id: 'decision-irreversible-with-plan',
  scenarioId: 'project-root',
  title: 'Approve the irreversible migration step',
  owner: 'system',
  irreversible: true,
  compensationPlan: 'Restore the verified backup and reconcile the migration ledger.',
});
assert.equal(irreversibleDecision.status, 'proposed');
assert.throws(() => future.sharedFuture.confirmDecision({
  decisionId: 'decision-irreversible-with-plan',
  confirmIrreversible: false,
  at: 1250,
}, 'user'), /irreversible-confirmation-required/);
const irreversibleConfirmed = await executeWithOwnerApproval(
  'organism.future.decisions.confirm',
  { decisionId: 'decision-irreversible-with-plan', confirmIrreversible: true, at: 1300 },
  'shared-future-confirm-2',
);
assert.equal(irreversibleConfirmed.ok, true, JSON.stringify(irreversibleConfirmed.result));
assert.equal(future.sharedFuture.getDecision('decision-irreversible-with-plan')?.executionStatus, 'not-executed');

const metricSignal = future.sharedFuture.observeSignal({
  scenarioId: 'project-root',
  metricKey: 'monthly-budget',
  metricValue: 40,
  at: 300,
});
assert.deepEqual(metricSignal.triggered, ['budget-low']);
assert.equal(metricSignal.reviewRequired, true);
const manualSignal = future.sharedFuture.observeSignal({
  scenarioId: 'project-root',
  signalId: 'human-review',
  at: 400,
});
assert.deepEqual(manualSignal.triggered, ['human-review']);
future.sharedFuture.refresh(1000);
assert.equal(future.sharedFuture.getScenario('project-root')?.reviewRequired, true);
assert.equal(future.sharedFuture.getScenario('project-root')?.assumptions[0].status, 'expired');

const revisedRoot = future.sharedFuture.createScenario({
  id: 'project-root-revised',
  title: 'Updated NK1 trajectory',
  owner: 'system',
  parentId: 'project-root',
  status: 'draft',
});
const oldRootStatus = future.sharedFuture.getScenario('project-root')?.status;
assert.equal(oldRootStatus, 'draft');
const reviewTool = gateway.listTools().find((row) => row.id === 'organism.future.reviews.resolve');
assert.equal(reviewTool?.permissionClass, 'self-modification');
assert.equal(reviewTool?.requiresApproval, true);
const reviewResolved = await executeWithOwnerApproval(
  'organism.future.reviews.resolve',
  { scenarioId: 'project-root', action: 'revise', successorScenarioId: 'project-root-revised', note: 'Budget and date assumptions expired.' },
  'shared-future-review-1',
);
assert.equal(reviewResolved.ok, true, JSON.stringify(reviewResolved.result));
assert.equal(future.sharedFuture.getScenario('project-root')?.status, 'superseded');
assert.equal(future.sharedFuture.getScenario('project-root-revised')?.status, 'active');

const rolloutCalls = [];
const model = {
  rollout(actions, baseReward) {
    rolloutCalls.push([...actions]);
    assert.equal(baseReward, 0.5);
    return {
      reward: 0.63,
      uncertainty: 0.2,
      path: [{ action: 'verify', reward: 0.63, uncertainty: 0.2, confidence: 0.8 }],
    };
  },
};
const simulated = future.simulate(model, ['verify', 'reflect', 'ignored'], 0.5);
assert.equal(simulated.expectedReward, 0.63);
assert.deepEqual(rolloutCalls[0], ['verify', 'reflect', 'ignored']);
const runtimeForecast = future.sharedFuture.getScenario('runtime-world-preview');
assert.ok(runtimeForecast);
assert.equal(runtimeForecast.owner, 'system');
assert.equal(runtimeForecast.status, 'draft');
assert.equal(runtimeForecast.forecast?.independentlyVerified, false);
assert.equal(runtimeForecast.assumptions[0].source, 'WorldModel2.rollout');
future.simulate(model, ['verify'], 0.5);
assert.deepEqual(rolloutCalls[1], ['verify']);
assert.equal(future.sharedFuture.listScenarios().filter((row) => row.id === 'runtime-world-preview').length, 1);

const persisted = future.snapshot();
const restored = new FutureSimulator();
restored.restore(persisted);
assert.deepEqual(restored.snapshot().sharedFuture, persisted.sharedFuture);
const legacy = new FutureSimulator();
legacy.restore({ version: 1, runs: 4, last: [{ action: 'verify', reward: 0.5 }] });
assert.equal(legacy.snapshot().runs, 4);
assert.equal(legacy.sharedFuture.diagnostics().scenarios, 0, 'legacy snapshots without Shared Future must remain loadable');

const capProbe = new SharedFutureEngine();
capProbe.restore({
  version: 1,
  scenarios: Array.from({ length: 100 }, (_, index) => ({
    id: 'scenario-' + index,
    title: 'Scenario ' + index,
    owner: 'system',
    status: 'draft',
    assumptions: [],
    goalLinks: [],
    consequences: [],
    pointsOfNoReturn: [],
    revisionSignals: [],
  })),
});
assert.equal(capProbe.diagnostics().scenarios, 48, 'restore must clamp the scenario ledger to its capacity');


const hardening = new SharedFutureEngine();
assert.equal(typeof hardening.setCanonicalGoalResolver, 'function', 'Shared Future must accept the organism canonical-goal resolver');
hardening.setCanonicalGoalResolver((goalId) => goalId === 'goal-canonical');
const canonicalLink = hardening.createScenario({
  id: 'canonical-goal-scenario',
  title: 'Scenario bound to an existing organism goal',
  goalLinks: [{ id: 'goal-canonical', owner: 'user', relationship: 'supports' }],
});
assert.equal(canonicalLink.goalLinks[0].id, 'goal-canonical');
assert.throws(() => hardening.createScenario({
  id: 'orphan-goal-scenario',
  title: 'Scenario with a deleted or fabricated goal',
  goalLinks: [{ id: 'goal-does-not-exist', owner: 'user', relationship: 'supports' }],
}), /canonical-goal-not-found/);

const hysteresis = new SharedFutureEngine();
hysteresis.createScenario({
  id: 'budget-hysteresis',
  title: 'Budget review with hysteresis',
  revisionSignals: [{
    id: 'budget-floor',
    kind: 'metric-below',
    metricKey: 'budget',
    threshold: 50,
    description: 'Budget is below the agreed floor.',
  }],
});
assert.deepEqual(hysteresis.observeSignal({
  scenarioId: 'budget-hysteresis', metricKey: 'budget', metricValue: 40, at: 10,
}).triggered, ['budget-floor']);
hysteresis.resolveReview({
  scenarioId: 'budget-hysteresis', action: 'confirm', note: 'Reviewed with the owner.', at: 20,
}, 'system');
assert.deepEqual(hysteresis.observeSignal({
  scenarioId: 'budget-hysteresis', metricKey: 'budget', metricValue: 40, at: 30,
}).triggered, [], 'a continuously violated metric must not spam repeated review alerts');
assert.deepEqual(hysteresis.observeSignal({
  scenarioId: 'budget-hysteresis', metricKey: 'budget', metricValue: 60, at: 40,
}).triggered, [], 'returning above the threshold rearms the signal without triggering it');
assert.deepEqual(hysteresis.observeSignal({
  scenarioId: 'budget-hysteresis', metricKey: 'budget', metricValue: 40, at: 50,
}).triggered, ['budget-floor'], 'a new threshold crossing must create a fresh review request');

const deferred = new SharedFutureEngine();
deferred.createScenario({
  id: 'deferred-review',
  title: 'A review with a due date',
  revisionSignals: [{ id: 'manual-review', kind: 'manual', description: 'Owner requested a review.' }],
});
deferred.observeSignal({ scenarioId: 'deferred-review', signalId: 'manual-review', at: 1000 });
deferred.resolveReview({
  scenarioId: 'deferred-review', action: 'defer', deferDays: 1, note: 'Review tomorrow.', at: 2000,
}, 'system');
assert.equal(typeof deferred.listReviews, 'function', 'review queue must be inspectable without mutating the scenario');
assert.equal(deferred.listReviews()[0]?.nextReviewAt, 86_402_000);
assert.deepEqual(deferred.refresh(86_401_999), []);
const dueReview = deferred.refresh(86_402_000);
assert.equal(dueReview.length, 1, 'a deferred review must re-enter the review queue when due');
assert.match(dueReview[0].reason, /deferred-review-due/);
assert.equal(deferred.listReviews()[0]?.nextReviewAt, null, 'a due notification must be consumed exactly once');
assert.deepEqual(deferred.refresh(86_402_001), [], 'the same due review must not emit repeatedly');

const damagedGraph = new SharedFutureEngine();
damagedGraph.restore({
  version: 1,
  scenarios: [
    { id: 'cycle-a', title: 'A', owner: 'system', status: 'draft', parentId: 'cycle-b' },
    { id: 'cycle-b', title: 'B', owner: 'system', status: 'draft', parentId: 'cycle-a' },
    { id: 'cycle-a', title: 'Duplicate A', owner: 'system', status: 'draft', parentId: null },
  ],
});
assert.equal(damagedGraph.diagnostics().scenarios, 2, 'restore must reject duplicate scenario IDs deterministically');
assert.equal(damagedGraph.getScenario('cycle-a')?.parentId, null, 'restore must break a parent cycle instead of preserving a cyclic scenario graph');
assert.equal(damagedGraph.getScenario('cycle-b')?.parentId, 'cycle-a');

const legacyReviewTime = new SharedFutureEngine();
legacyReviewTime.restore({
  version: 1,
  scenarios: [{ id: 'legacy-review-time', title: 'Older snapshot omitted nextReviewAt', owner: 'system', status: 'draft' }],
});
assert.equal(legacyReviewTime.getScenario('legacy-review-time')?.nextReviewAt, null, 'older snapshots without nextReviewAt must not turn into an immediately-due review');

assert.throws(() => hardening.createScenario({
  id: 'duplicate-assumption-ids',
  title: 'Duplicate nested assumptions are rejected',
  assumptions: [
    { id: 'same-assumption', statement: 'First assumption' },
    { id: 'same-assumption', statement: 'Second assumption' },
  ],
}), /assumption-id-duplicate/);

for (const toolId of [
  'organism.future.scenarios.create',
  'organism.future.decisions.propose',
  'organism.future.signals.observe',
]) {
  assert.equal(
    gateway.listTools().find((row) => row.id === toolId)?.requiresIdempotencyKey,
    true,
    toolId + ' mutates the ledger and must require durable idempotency',
  );
}
assert.ok(gateway.listTools().some((row) => row.id === 'organism.future.reviews.list'), 'review queue must be exposed as a read-only organism tool');


const outcomeCalibration = new SharedFutureEngine();
outcomeCalibration.createScenario({
  id: 'calibration-scenario',
  title: 'A scenario whose predicted consequences will be measured',
  consequences: [
    { id: 'likely-success', description: 'The launch reaches its target.', probability01: 0.8, impact01: 0.9 },
    { id: 'unlikely-success', description: 'The secondary path reaches its target.', probability01: 0.2, impact01: 0.4 },
  ],
});
const firstOutcome = outcomeCalibration.recordOutcome({
  id: 'outcome-likely-success',
  scenarioId: 'calibration-scenario',
  consequenceId: 'likely-success',
  occurred: true,
  evidenceRef: 'telemetry:release-2026-11-17',
  at: 6000,
}, 'system');
assert.equal(firstOutcome.forecastProbability01, 0.8);
assert.equal(firstOutcome.occurred, true);
assert.equal(firstOutcome.brierScore01, 0.04);
assert.equal(firstOutcome.evidenceRef, 'telemetry:release-2026-11-17');
assert.equal(firstOutcome.reportedBy, 'system');
assert.equal(firstOutcome.independentlyVerified, false, 'a recorded observation must never promote itself to independent verification');
const secondOutcome = outcomeCalibration.recordOutcome({
  id: 'outcome-unlikely-success',
  scenarioId: 'calibration-scenario',
  consequenceId: 'unlikely-success',
  occurred: true,
  evidenceRef: 'report:post-launch-review',
  at: 6001,
}, 'user');
assert.equal(secondOutcome.brierScore01, 0.64);
assert.equal(outcomeCalibration.listOutcomes('calibration-scenario').length, 2);
assert.equal(outcomeCalibration.diagnostics().observedOutcomes, 2);
assert.equal(outcomeCalibration.diagnostics().meanBrierScore01, 0.34);
assert.throws(() => outcomeCalibration.recordOutcome({
  id: 'duplicate-consequence-observation',
  scenarioId: 'calibration-scenario',
  consequenceId: 'likely-success',
  occurred: false,
  evidenceRef: 'telemetry:duplicate',
  at: 6002,
}, 'system'), /outcome-already-recorded/);
assert.throws(() => outcomeCalibration.recordOutcome({
  id: 'missing-evidence-outcome',
  scenarioId: 'calibration-scenario',
  consequenceId: 'unlikely-success',
  occurred: false,
  evidenceRef: '   ',
  at: 6002,
}, 'system'), /outcome-evidence-ref-required/);
const outcomeRoundTrip = new SharedFutureEngine();
outcomeRoundTrip.restore(outcomeCalibration.snapshot());
assert.deepEqual(outcomeRoundTrip.listOutcomes('calibration-scenario'), outcomeCalibration.listOutcomes('calibration-scenario'));

const userOwnedOutcomeScenario = outcomeCalibration.createScenario({
  id: 'user-owned-outcome-scenario',
  title: 'A human-owned consequence',
  owner: 'user',
  confirmUserOwned: true,
  consequences: [{ id: 'user-result', description: 'User-owned result.', probability01: 0.5 }],
}, 'user');
assert.equal(userOwnedOutcomeScenario.owner, 'user');
assert.throws(() => outcomeCalibration.recordOutcome({
  id: 'system-overwrites-user-result',
  scenarioId: 'user-owned-outcome-scenario',
  consequenceId: 'user-result',
  occurred: true,
  evidenceRef: 'telemetry:unapproved',
  at: 6003,
}, 'system'), /human-outcome-report-required/);

assert.equal(
  gateway.listTools().find((row) => row.id === 'organism.future.outcomes.record')?.requiresIdempotencyKey,
  true,
  'outcome writes must use ActionGateway idempotency',
);
assert.ok(gateway.listTools().some((row) => row.id === 'organism.future.outcomes.list'), 'calibration observations must be readable through the organism tool surface');
const toolOutcomeScenario = future.sharedFuture.createScenario({
  id: 'gateway-outcome-scenario',
  title: 'Outcome recorded through the organism gateway',
  consequences: [{ id: 'gateway-result', description: 'Gateway-recorded result.', probability01: 0.75 }],
});
const toolOutcome = await gateway.executeTool('organism.future.outcomes.record', {
  id: 'gateway-outcome-record',
  scenarioId: toolOutcomeScenario.id,
  consequenceId: 'gateway-result',
  occurred: false,
  evidenceRef: 'metric:release-health',
  at: 7000,
}, 'shared-future-test', { autonomous: false, idempotencyKey: 'shared-future-outcome-gateway-1' });
assert.equal(toolOutcome.ok, true, JSON.stringify(toolOutcome));
assert.equal(future.sharedFuture.listOutcomes('gateway-outcome-scenario')[0]?.reportedBy, 'user');


const untrustedOutcomeRestore = new SharedFutureEngine();
untrustedOutcomeRestore.restore({
  version: 1,
  scenarios: [{
    id: 'restored-outcome-scenario',
    title: 'Restored evidence scenario',
    owner: 'system',
    status: 'draft',
    consequences: [{
      id: 'restored-outcome-consequence',
      description: 'A previously predicted result.',
      probability01: 0.25,
    }],
  }],
  outcomes: [
    {
      id: 'restored-outcome-record',
      scenarioId: 'restored-outcome-scenario',
      consequenceId: 'restored-outcome-consequence',
      observedAt: 8000,
      forecastProbability01: 0.25,
      occurred: true,
      brierScore01: 0,
      evidenceRef: 'audit:restored',
      reportedBy: 'system',
      independentlyVerified: true,
    },
    {
      id: 'duplicate-outcome-id',
      scenarioId: 'restored-outcome-scenario',
      consequenceId: 'restored-outcome-consequence',
      observedAt: 8001,
      forecastProbability01: 0.25,
      occurred: false,
      evidenceRef: 'audit:duplicate',
      reportedBy: 'user',
    },
  ],
});
assert.equal(untrustedOutcomeRestore.listOutcomes().length, 1, 'restore must discard duplicate consequence observations');
assert.equal(untrustedOutcomeRestore.listOutcomes()[0].brierScore01, 0.5625, 'restore must recompute outcome scores instead of trusting persisted scores');
assert.equal(untrustedOutcomeRestore.listOutcomes()[0].independentlyVerified, false, 'restored input must not be able to self-promote an outcome as verified');

const terminalRevision = new SharedFutureEngine();
terminalRevision.createScenario({
  id: 'terminal-revision-parent',
  title: 'Parent requiring revision',
  status: 'active',
  revisionSignals: [{ id: 'terminal-review-signal', kind: 'manual', description: 'A manual review is required.' }],
});
terminalRevision.observeSignal({
  scenarioId: 'terminal-revision-parent', signalId: 'terminal-review-signal', at: 9000,
});
terminalRevision.createScenario({
  id: 'achieved-revision-child',
  title: 'Already achieved successor',
  parentId: 'terminal-revision-parent',
  status: 'achieved',
});
assert.throws(() => terminalRevision.resolveReview({
  scenarioId: 'terminal-revision-parent',
  action: 'revise',
  successorScenarioId: 'achieved-revision-child',
  at: 9001,
}, 'system'), /revision-successor-not-promotable/);
assert.equal(terminalRevision.getScenario('terminal-revision-parent')?.reviewRequired, true, 'failed promotion must leave the parent review intact');
assert.equal(terminalRevision.getScenario('achieved-revision-child')?.status, 'achieved', 'an achieved child must remain terminal');

terminalRevision.createScenario({
  id: 'active-revision-child',
  title: 'Already active successor',
  parentId: 'terminal-revision-parent',
  status: 'active',
});
assert.throws(() => terminalRevision.resolveReview({
  scenarioId: 'terminal-revision-parent',
  action: 'revise',
  successorScenarioId: 'active-revision-child',
  at: 9002,
}, 'system'), /revision-successor-not-promotable/);
assert.equal(terminalRevision.getScenario('terminal-revision-parent')?.status, 'active', 'invalid successor selection must not supersede the parent');

console.log(JSON.stringify({
  pass: true,
  scenarios: future.sharedFuture.diagnostics(),
  decisions: future.sharedFuture.getDecision('decision-irreversible-with-plan'),
  reviewHistory: future.sharedFuture.snapshot().reviewHistory.length,
  gatewayApprovalBoundaries: gateway.listTools().filter((row) => row.permissionClass === 'self-modification').map((row) => row.id),
  runtimeForecastVerified: runtimeForecast?.forecast?.independentlyVerified,
  restore: 'round-trip-and-legacy-pass',
}, null, 2));
