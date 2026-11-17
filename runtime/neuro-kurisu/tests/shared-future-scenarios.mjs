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

const rootResult = await gateway.executeTool('organism.future.scenarios.create-system', {
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
}, 'system');
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
});
assert.equal(forgedCollaborative.ok, false, 'ActionGateway must block unapproved collaborative writes');

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

console.log(JSON.stringify({
  pass: true,
  scenarios: future.sharedFuture.diagnostics(),
  decisions: future.sharedFuture.getDecision('decision-irreversible-with-plan'),
  reviewHistory: future.sharedFuture.snapshot().reviewHistory.length,
  gatewayApprovalBoundaries: gateway.listTools().filter((row) => row.permissionClass === 'self-modification').map((row) => row.id),
  runtimeForecastVerified: runtimeForecast?.forecast?.independentlyVerified,
  restore: 'round-trip-and-legacy-pass',
}, null, 2));
