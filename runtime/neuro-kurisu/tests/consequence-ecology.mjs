import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { FutureSimulator } from '../src/organism/developmental/FutureSimulator.ts';
import { registerConsequenceEcologyTools } from '../src/organism/developmental/ConsequenceEcologyTools.ts';

const node = (id, effect, probability01, impact01, confidence01, extra = {}) => ({
  id,
  description: id + ' consequence',
  effect,
  actor: extra.actor ?? 'operator',
  system: extra.system ?? 'runtime',
  probability01,
  impact01,
  confidence01,
  delayDays: extra.delayDays ?? 0,
  reversible: extra.reversible ?? true,
  basis: extra.basis ?? 'internal-model',
  ...(extra.evidenceRefs ? { evidenceRefs: extra.evidenceRefs } : {}),
  ...(extra.assumptionRefs ? { assumptionRefs: extra.assumptionRefs } : {}),
});
const edge = (id, from, to, extra = {}) => ({
  id,
  from,
  to,
  relation: extra.relation ?? 'causes',
  polarity: extra.polarity ?? 'increase',
  strength01: extra.strength01 ?? 0.9,
  confidence01: extra.confidence01 ?? 0.9,
  delayDays: extra.delayDays ?? 0,
});
const option = (id, action, nodes, edges) => ({ id, title: id, action, nodes, edges });

const simulator = new FutureSimulator();
assert.equal(typeof simulator.analyzeConsequences, 'function', 'FutureSimulator must expose the Consequence Ecology analysis seam');
assert.ok(simulator.snapshot().consequenceEcology, 'Consequence Ecology state must live in the canonical FutureSimulator snapshot');

const dangerous = option('accelerate', 'accelerate the migration', [
  node('direct-risk', 'harm', 0.95, 0.9, 0.82, { actor: 'operators', reversible: false }),
  node('secondary-risk', 'harm', 0.85, 0.78, 0.62, { actor: 'dependent-services', delayDays: 2 }),
  node('tertiary-risk', 'harm', 0.72, 0.92, 0.48, { actor: 'customers', system: 'downstream', delayDays: 14 }),
], [
  edge('action-direct', '__action__', 'direct-risk'),
  edge('direct-secondary', 'direct-risk', 'secondary-risk', { relation: 'amplifies', delayDays: 1 }),
  edge('secondary-tertiary', 'secondary-risk', 'tertiary-risk', { relation: 'depends-on', delayDays: 5 }),
  edge('feedback-tertiary-direct', 'tertiary-risk', 'direct-risk', { relation: 'feedback', delayDays: 1 }),
]);
const safe = option('staged', 'stage the migration with a verified rollback', [
  node('rollback-benefit', 'benefit', 0.92, 0.82, 0.94, { actor: 'operators', evidenceRefs: ['evidence:rollback-drill'] }),
  node('small-delay-cost', 'harm', 0.35, 0.18, 0.92, { actor: 'project-team', delayDays: 3 }),
], [
  edge('action-rollback', '__action__', 'rollback-benefit'),
  edge('action-delay', '__action__', 'small-delay-cost', { strength01: 0.7 }),
]);

const request = {
  id: 'consequence-analysis-main',
  horizonDays: 90,
  options: [dangerous, safe],
};
const context = {
  goalEcology: {
    activeCount: 3,
    goalPressure01: 0.42,
    meanConflict01: 0.18,
    meanStaleness01: 0.22,
    lastTopGoalId: 'goal-stability',
  },
  negativeSpace: {
    records: 12,
    alternatives: 21,
    reviewEligible: 2,
    verifiedOutcomes: 8,
    independentOutcomes: 4,
  },
};
const first = simulator.analyzeConsequences(request, context);
assert.equal(first.replayed, false);
assert.equal(first.analysis.decisionAuthority, 'none');
assert.equal(first.analysis.independentlyVerified, false);
assert.equal(first.analysis.context.goalEcology.activeCount, 3);
assert.equal(first.analysis.context.negativeSpace.reviewEligible, 2);
assert.equal(first.analysis.options[0].id, 'staged', 'the lower-risk alternative should lead the model ranking');
assert.equal(first.analysis.options[0].ranking, 1);
assert.equal(first.analysis.modelTopRankedOptionId, 'staged', 'model ranking remains advisory and non-executable');

const dangerousResult = first.analysis.options.find(row => row.id === 'accelerate');
assert.ok(dangerousResult);
assert.ok(dangerousResult.directRisk01 > 0, 'first-order exposure must be measured');
assert.ok(dangerousResult.secondaryRisk01 > 0, 'second-order exposure must be propagated');
assert.ok(dangerousResult.tertiaryRisk01 > 0, 'third-order exposure must be propagated');
assert.ok(dangerousResult.feedbackLoopCount > 0, 'cycles must be recorded rather than infinitely traversed');
assert.ok(dangerousResult.irreversibleExposure01 > 0, 'irreversible harm must be visible separately');
assert.ok(dangerousResult.nodes.some(row => row.actor === 'customers'));
assert.ok(dangerousResult.stakeholders.some(row => row.actor === 'customers'));
assert.equal(dangerousResult.independentlyVerified, false);
assert.ok(dangerousResult.criticalPaths.length > 0);

const replayed = simulator.analyzeConsequences(request, context);
assert.equal(replayed.replayed, true, 'same analysis ID and exact payload must be idempotent');
assert.deepEqual(replayed.analysis, first.analysis);
assert.throws(
  () => simulator.analyzeConsequences({ ...request, options: [dangerous] }, context),
  /consequence-analysis-id-conflict/,
  'reusing an analysis ID for different content must be rejected',
);

const horizonResult = simulator.analyzeConsequences({
  id: 'consequence-analysis-horizon',
  horizonDays: 30,
  options: [option('late', 'wait for the delayed outcome', [
    node('long-delay', 'harm', 0.9, 0.8, 0.8, { delayDays: 60 }),
  ], [edge('action-late', '__action__', 'long-delay')])],
});
assert.equal(horizonResult.analysis.options[0].excludedBeyondHorizon, 1);
assert.equal(horizonResult.analysis.options[0].unreachableNodeCount, 1);
assert.ok(horizonResult.analysis.options[0].graphCoverage01 < 1);

const scenario = simulator.sharedFuture.createScenario({
  id: 'consequence-project-scenario',
  title: 'Project scenario with linked assumptions',
  owner: 'system',
  confidence01: 0.82,
  horizonDays: 120,
  assumptions: [{
    id: 'budget-assumption',
    statement: 'A bounded operating budget remains available.',
    source: 'user-provided planning assumption',
    confidence01: 0.8,
    status: 'assumed',
    checkedAt: 100,
    expiresAt: 1000,
  }],
  consequences: [{
    id: 'scenario-irreversible-loss',
    description: 'A delayed external migration could be difficult to reverse.',
    probability01: 0.7,
    impact01: 0.88,
    horizonDays: 20,
    reversible: false,
  }],
});
assert.equal(scenario.id, 'consequence-project-scenario');

const scenarioResult = simulator.analyzeConsequences({
  id: 'consequence-analysis-scenario-bound',
  scenarioId: scenario.id,
  horizonDays: 45,
  options: [option('scenario-action', 'run the project plan', [
    node('budget-dependent-risk', 'harm', 0.8, 0.6, 0.9, {
      assumptionRefs: ['budget-assumption', 'missing-assumption'],
    }),
  ], [edge('action-budget-risk', '__action__', 'budget-dependent-risk')])],
});
const scenarioOption = scenarioResult.analysis.options[0];
assert.ok(scenarioOption.nodes.some(row => row.id === 'scenario-irreversible-loss'), 'Shared Future consequences must be included automatically');
const assumptionNode = scenarioOption.nodes.find(row => row.id === 'budget-dependent-risk');
assert.ok(assumptionNode.confidence01 < 0.5, 'unknown assumptions must reduce confidence');
assert.deepEqual(assumptionNode.missingAssumptionRefs, ['missing-assumption']);
assert.ok(scenarioOption.irreversibleExposure01 > 0);

assert.throws(() => simulator.analyzeConsequences({
  id: 'consequence-analysis-missing-scenario',
  scenarioId: 'not-a-real-scenario',
  horizonDays: 20,
  options: [safe],
}), /consequence-scenario-not-found/);

const persisted = simulator.snapshot();
const restored = new FutureSimulator();
restored.restore(persisted);
assert.deepEqual(restored.consequenceEcology.snapshot(), persisted.consequenceEcology, 'analysis history must survive FutureSimulator restore');
assert.deepEqual(restored.snapshot().consequenceEcology, persisted.consequenceEcology);
const legacy = new FutureSimulator();
legacy.restore({ version: 1, runs: 4, last: [{ action: 'verify', reward: 0.5 }] });
assert.equal(legacy.snapshot().runs, 4, 'legacy FutureSimulator state remains loadable');
assert.equal(legacy.consequenceEcology.diagnostics().retainedAnalyses, 0, 'legacy snapshot without Consequence Ecology restores empty state');

const gatewaySimulator = new FutureSimulator();
gatewaySimulator.sharedFuture.createScenario({
  id: 'tool-scenario',
  title: 'Tool integration scenario',
  owner: 'system',
  confidence01: 0.9,
});
const gateway = new ActionGateway({ live: false });
gateway.setExecutionLedgerPersister(async () => {});
registerConsequenceEcologyTools(gateway, gatewaySimulator, {
  goalEcology: () => ({
    activeCount: 2,
    goalPressure01: 0.33,
    meanConflict01: 0.1,
    meanStaleness01: 0.15,
    lastTopGoalId: 'goal-tool',
  }),
  negativeSpace: () => ({
    records: 7,
    alternatives: 9,
    reviewEligible: 1,
    verifiedOutcomes: 5,
    independentOutcomes: 3,
  }),
});
const analyzeTool = gateway.listTools().find(row => row.id === 'organism.consequences.analyze');
assert.equal(analyzeTool?.requiresIdempotencyKey, true, 'analysis ledger writes must require a stable idempotency key');
const toolResult = await gateway.executeTool('organism.consequences.analyze', {
  id: 'gateway-analysis',
  scenarioId: 'tool-scenario',
  horizonDays: 60,
  options: [option('gateway-option', 'run a bounded operation', [
    node('gateway-effect', 'benefit', 0.8, 0.7, 0.9),
  ], [edge('gateway-action', '__action__', 'gateway-effect')])],
}, 'consequence-ecology-test', { idempotencyKey: 'consequence-gateway-analysis-1' });
assert.equal(toolResult.ok, true, JSON.stringify(toolResult));
assert.equal(toolResult.result.analysis.context.goalEcology.activeCount, 2);
assert.equal(toolResult.result.analysis.context.negativeSpace.independentOutcomes, 3);
assert.equal(toolResult.result.analysis.decisionAuthority, 'none');
const listed = await gateway.executeTool('organism.consequences.list', { limit: 4 });
assert.equal(listed.ok, true);
assert.ok(listed.result.analyses.some(row => row.id === 'gateway-analysis'));
const diagnostics = await gateway.executeTool('organism.consequences.diagnostics', {});
assert.equal(diagnostics.ok, true);
assert.equal(diagnostics.result.diagnostics.retainedAnalyses, 1);

console.log('CONSEQUENCE_ECOLOGY=PASS', JSON.stringify({
  analysisCount: simulator.consequenceEcology.diagnostics().retainedAnalyses,
  modelTopRankedOptionId: first.analysis.modelTopRankedOptionId,
  cascade: {
    directRisk01: dangerousResult.directRisk01,
    secondaryRisk01: dangerousResult.secondaryRisk01,
    tertiaryRisk01: dangerousResult.tertiaryRisk01,
    feedbackLoopCount: dangerousResult.feedbackLoopCount,
    irreversibleExposure01: dangerousResult.irreversibleExposure01,
  },
  scenarioConsequences: scenarioOption.nodes.length,
  horizonExcluded: horizonResult.analysis.options[0].excludedBeyondHorizon,
  restart: 'PASS',
  actionGateway: 'PASS',
}));
