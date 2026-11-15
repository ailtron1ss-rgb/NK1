import assert from 'node:assert/strict';
import { assessActionConsequence } from '../src/organism/core/ActionConsequenceCostPolicy.ts';
import { AutonomousResourceToolLifeController } from '../src/organism/system/AutonomousResourceToolLifeController.ts';

const read = assessActionConsequence({ id: 'organism.inspect', capability: 'core.read', destructive: false });
const social = assessActionConsequence({ id: 'chat.send-message', capability: 'message.send', destructive: false });
const mutation = assessActionConsequence({ id: 'workspace.update-file', capability: 'filesystem.write', destructive: false });
const unknown = assessActionConsequence({ id: 'plugin.mystery', capability: 'custom.opaque', destructive: false });
const destructive = assessActionConsequence({ id: 'system.delete-record', capability: 'database.delete', destructive: true });
const mixed = assessActionConsequence({ id: 'read-and-send', capability: 'core.read', destructive: false });
const approvalRequiredRead = assessActionConsequence({ id: 'organism.inspect', capability: 'core.read', destructive: false, requiresApproval: true });
const reconcile = assessActionConsequence({ id: 'execution.reconcile-receipt', capability: 'core.reconcile', destructive: false });

assert.equal(read.classification, 'read-only');
assert.equal(read.autonomousAllowed, true);
assert.equal(social.classification, 'social');
assert.equal(social.autonomousAllowed, false, 'socially consequential actions must not be silently backgrounded');
assert.ok(social.cost01 > read.cost01, 'social actions must carry higher consequence cost than read-only actions');
assert.equal(mutation.classification, 'mutation');
assert.equal(mutation.autonomousAllowed, false, 'mutating actions need a separately governed path');
assert.equal(unknown.classification, 'unknown');
assert.equal(unknown.autonomousAllowed, false, 'unknown tools must fail closed');
assert.equal(destructive.classification, 'destructive');
assert.equal(destructive.autonomousAllowed, false);
assert.equal(mixed.classification, 'social', 'social consequence must win over a read-like identifier');
assert.equal(approvalRequiredRead.autonomousAllowed, false, 'the existing approval flag remains authoritative');
assert.equal(reconcile.classification, 'mutation', 'reconciliation can alter durable state and must not masquerade as a pure read');
assert.equal(reconcile.autonomousAllowed, false);

const controller = new AutonomousResourceToolLifeController();
const plan = controller.plan({
  tick: 1, at: 1000, energy01: .85, thermal01: .15, ramPressure01: .18,
  externalInteractionBudget01: .85, initiative01: .7, uncertainty01: .55,
  goalPressure01: .7, homeostaticPressure01: .15,
  tools: [
    { id: 'chat.send-message', capability: 'message.send', destructive: false, projectAllowed: true },
    { id: 'workspace.update-file', capability: 'filesystem.write', destructive: false, projectAllowed: true },
    { id: 'plugin.mystery', capability: 'custom.opaque', destructive: false, projectAllowed: true },
    { id: 'organism.inspect', capability: 'core.read', destructive: false, projectAllowed: true },
  ],
});
assert.equal(plan.allowed, true);
assert.equal(plan.tool?.id, 'organism.inspect', 'only a low-consequence read action should enter the autonomous lane');
assert.equal(plan.consequenceClass, 'read-only');
assert.ok(plan.consequenceCost01 < .1);
assert.ok(plan.cost01 >= .1 && plan.cost01 < .3, 'resource cost must remain separate from consequence cost');

const projectDenied = controller.plan({
  tick: 3, at: 20000, energy01: .85, thermal01: .15, ramPressure01: .18,
  externalInteractionBudget01: .85, initiative01: .7, uncertainty01: .2,
  goalPressure01: .4, homeostaticPressure01: .1,
  tools: [{ id: 'organism.inspect', capability: 'core.read', destructive: false, projectAllowed: false }],
});
assert.equal(projectDenied.allowed, false, 'a read-only tool outside the current project authorization must not enter the ambient lane');
assert.equal(projectDenied.tool, null);

const onlySocial = controller.plan({
  tick: 2, at: 10000, energy01: .85, thermal01: .15, ramPressure01: .18,
  externalInteractionBudget01: .85, initiative01: .7, uncertainty01: .2,
  goalPressure01: .4, homeostaticPressure01: .1,
  tools: [{ id: 'chat.send-message', capability: 'message.send', destructive: false, projectAllowed: true }],
});
assert.equal(onlySocial.allowed, false, 'social action cannot be selected by ambient autonomy');
assert.match(onlySocial.reason, /consequence|autonomous/i);
assert.ok(controller.summary().consequenceBlocked >= 1, 'blocked consequence-bearing candidates must be observable');
controller.record({ tick: 1, at: 1000, tool: plan.tool, ok: true, verified: true, cost01: plan.cost01, reason: plan.reason });
const snapshot = controller.snapshot();
assert.equal(snapshot.lastConsequenceClass, 'read-only');
assert.ok(snapshot.recent[0].consequenceCost01 < .1, 'consequence score must be retained with the execution receipt');
const restored = new AutonomousResourceToolLifeController();
restored.restore(snapshot);
assert.equal(restored.snapshot().lastConsequenceClass, 'read-only', 'consequence telemetry must survive restore');

console.log(JSON.stringify({
  pass: 'HEXIS_ACTION_CONSEQUENCE_COST_POLICY',
  classifications: { read: read.classification, social: social.classification, mutation: mutation.classification, unknown: unknown.classification, destructive: destructive.classification },
  costs: { read: read.cost01, social: social.cost01, mutation: mutation.cost01, unknown: unknown.cost01, destructive: destructive.cost01 },
  autonomousReadOnlyLane: plan.tool.id,
  socialOnlyBlocked: !onlySocial.allowed,
  resourceAndConsequenceCostsSeparate: true,
}, null, 2));
