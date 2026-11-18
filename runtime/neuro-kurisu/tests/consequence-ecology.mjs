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
  ...(extra.baselineProbability01 !== undefined ? { baselineProbability01: extra.baselineProbability01 } : {}),
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
  ...(extra.independenceGroup ? { independenceGroup: extra.independenceGroup } : {}),
});
const option = (id, action, nodes, edges) => ({ id, title: id, action, nodes, edges });
const approx = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: expected ${expected}, got ${actual}`);

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
assert.equal(dangerousResult.nodes.find(row => row.id === 'direct-risk').description, 'direct-risk consequence',
  'persisted analysis rows must retain the consequence description used by restore validation');

const epistemicResult = simulator.analyzeConsequences({
  id: 'consequence-analysis-epistemic-confidence',
  horizonDays: 30,
  options: [
    option('low-link-confidence', 'act with weak causal evidence', [
      node('same-effect-low-confidence', 'harm', 0.9, 0.8, 0.9),
    ], [edge('low-confidence-link', '__action__', 'same-effect-low-confidence', { strength01: 0.9, confidence01: 0.2 })]),
    option('high-link-confidence', 'act with strong causal evidence', [
      node('same-effect-high-confidence', 'harm', 0.9, 0.8, 0.9),
    ], [edge('high-confidence-link', '__action__', 'same-effect-high-confidence', { strength01: 0.9, confidence01: 0.9 })]),
  ],
});
const lowConfidenceEffect = epistemicResult.analysis.options.find(row => row.id === 'low-link-confidence').nodes[0];
const highConfidenceEffect = epistemicResult.analysis.options.find(row => row.id === 'high-link-confidence').nodes[0];
assert.equal(
  lowConfidenceEffect.propagatedProbability01,
  highConfidenceEffect.propagatedProbability01,
  'uncertain causal evidence must not make the same possible harm disappear from the risk estimate',
);
assert.ok(
  lowConfidenceEffect.uncertaintyContribution01 > highConfidenceEffect.uncertaintyContribution01,
  'uncertain causal evidence must be represented as greater forecast uncertainty',
);

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

const mitigatedResult = simulator.analyzeConsequences({
  id: 'consequence-analysis-mitigation',
  horizonDays: 50,
  options: [option('shielded', 'apply a tested mitigation', [
    node('mitigation-control', 'benefit', 0.95, 0.9, 0.95),
    node('residual-loss', 'harm', 0.9, 0.9, 0.88),
  ], [
    edge('action-control', '__action__', 'mitigation-control'),
    edge('control-mitigates-loss', 'mitigation-control', 'residual-loss', {
      relation: 'mitigates',
      polarity: 'decrease',
      strength01: 0.92,
      confidence01: 0.9,
    }),
  ])],
});
assert.ok(mitigatedResult.analysis.options[0].mitigationCredit01 > 0, 'mitigating edges must create explicit mitigation credit');
assert.ok(mitigatedResult.analysis.options[0].totalHarm01 < 0.2, 'a strong mitigation edge must attenuate risk along that path');

const meshNodes = Array.from({ length: 9 }, (_, i) => node('mesh-' + i, 'harm', 0.95, 0.2, 0.9));
const meshEdges = Array.from({ length: 9 }, (_, i) => edge('mesh-root-' + i, '__action__', 'mesh-' + i));
for (let from = 0; from < 9; from++) {
  for (let to = 0; to < 9; to++) {
    if (from !== to) meshEdges.push(edge('mesh-' + from + '-' + to, 'mesh-' + from, 'mesh-' + to, { relation: 'feedback' }));
  }
}
const boundedResult = simulator.analyzeConsequences({
  id: 'consequence-analysis-path-budget',
  horizonDays: 365,
  options: [option('dense-feedback-mesh', 'evaluate a dense feedback network', meshNodes, meshEdges)],
});
assert.equal(boundedResult.analysis.status, 'bounded-partial');
assert.equal(boundedResult.analysis.options[0].truncated, true, 'path explosion must stop at the fixed traversal budget');

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
assert.ok(
  scenarioResult.analysis.limitations.some(text => text.includes('no explicit harm/benefit polarity')),
  'legacy Shared Future consequence polarity assumption must be disclosed',
);

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

const legacyConsequenceSnapshot = structuredClone(persisted);
for (const retained of legacyConsequenceSnapshot.consequenceEcology.analyses) {
  for (const oldOption of retained.analysis.options) {
    delete oldOption.counterfactualCoverage01;
    delete oldOption.attributableHarm01;
    delete oldOption.avoidedHarm01;
    delete oldOption.attributableBenefit01;
    delete oldOption.lostBenefit01;
    delete oldOption.netAttributableValue01;
    delete oldOption.correlatedPathMerges;
    delete oldOption.worstStakeholderHarm01;
    delete oldOption.topStakeholderHarmShare01;
    delete oldOption.benefitBurdenSeparation01;
    delete oldOption.mostExposedStakeholder;
    delete oldOption.mainBeneficiary;
    for (const oldNode of oldOption.nodes) {
      delete oldNode.description;
      delete oldNode.baselineProbability01;
      delete oldNode.attributableEffect01;
    }
  }
}
const migratedLegacy = new FutureSimulator();
migratedLegacy.restore(legacyConsequenceSnapshot);
assert.equal(
  migratedLegacy.consequenceEcology.diagnostics().retainedAnalyses,
  persisted.consequenceEcology.analyses.length,
  'pre-counterfactual Consequence Ecology snapshots must migrate instead of dropping their history',
);
const migratedRow = migratedLegacy.consequenceEcology.get(first.analysis.id).options[0];
assert.equal(migratedRow.counterfactualCoverage01, 0);
assert.equal(migratedRow.nodes[0].baselineProbability01, null);
assert.equal(migratedRow.nodes[0].description, '');
assert.equal(migratedRow.worstStakeholderHarm01, 0);
assert.equal(migratedRow.topStakeholderHarmShare01, 0);
assert.equal(migratedRow.benefitBurdenSeparation01, 0);
assert.equal(migratedRow.mostExposedStakeholder, null);
assert.equal(migratedRow.mainBeneficiary, null,
  'legacy analyses must migrate with neutral distributional fields');

const legacy = new FutureSimulator();
legacy.restore({ version: 1, runs: 4, last: [{ action: 'verify', reward: 0.5 }] });
assert.equal(legacy.snapshot().runs, 4, 'legacy FutureSimulator state remains loadable');
assert.equal(legacy.consequenceEcology.diagnostics().retainedAnalyses, 0, 'legacy snapshot without Consequence Ecology restores empty state');

const firstStored = persisted.consequenceEcology.analyses[0].analysis;
const corruptAnalysis = structuredClone(firstStored);
corruptAnalysis.id = 'restored-over-capacity-graph';
corruptAnalysis.options = [{
  ...structuredClone(corruptAnalysis.options[0]),
  nodes: Array.from({ length: 65 }, (_, index) => ({
    ...structuredClone(corruptAnalysis.options[0].nodes[0]),
    id: 'restored-node-' + index,
  })),
}];
const boundedRestore = new FutureSimulator();
boundedRestore.restore({
  ...persisted,
  consequenceEcology: {
    version: 1,
    analyses: [{ digest: 'a'.repeat(64), analysis: corruptAnalysis }],
    totalAnalyses: 1,
    rejectedAnalyses: 0,
    feedbackLoopsObserved: 0,
    truncatedAnalyses: 0,
    lastAt: 1,
  },
});
assert.equal(
  boundedRestore.consequenceEcology.diagnostics().retainedAnalyses,
  0,
  'restore must reject an analysis whose persisted graph exceeds the live node bound',
);

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
    node('gateway-effect', 'benefit', 0.8, 0.7, 0.9, { baselineProbability01: 0.2 }),
  ], [edge('gateway-action', '__action__', 'gateway-effect', { independenceGroup: 'gateway-primary-cause' })])],
}, 'consequence-ecology-test', { idempotencyKey: 'consequence-gateway-analysis-1' });
assert.equal(toolResult.ok, true, JSON.stringify(toolResult));
assert.equal(toolResult.result.analysis.context.goalEcology.activeCount, 2);
assert.equal(toolResult.result.analysis.context.negativeSpace.independentOutcomes, 3);
assert.equal(toolResult.result.analysis.decisionAuthority, 'none');
assert.equal(toolResult.result.analysis.options[0].counterfactualCoverage01, 1,
  'ActionGateway must accept and preserve new counterfactual input fields');
const listed = await gateway.executeTool('organism.consequences.list', { limit: 4 });
assert.equal(listed.ok, true);
assert.ok(listed.result.analyses.some(row => row.id === 'gateway-analysis'));
const diagnostics = await gateway.executeTool('organism.consequences.diagnostics', {});
assert.equal(diagnostics.ok, true);
assert.equal(diagnostics.result.diagnostics.retainedAnalyses, 1);

const standaloneTool = await gateway.executeTool('organism.consequences.analyze', {
  id: 'gateway-standalone-analysis',
  horizonDays: 30,
  options: [option('standalone-option', 'evaluate a standalone operation', [
    node('standalone-benefit', 'benefit', 0.7, 0.6, 0.8),
  ], [edge('standalone-action', '__action__', 'standalone-benefit')])],
}, 'consequence-ecology-test', { idempotencyKey: 'consequence-gateway-standalone-1' });
assert.equal(standaloneTool.ok, true, JSON.stringify(standaloneTool));
assert.equal(standaloneTool.result.analysis.scenarioId, null, 'a standalone option must not require a Shared Future scenario');


const correlatedPaths = simulator.analyzeConsequences({
  id: 'consequence-analysis-correlated-paths',
  horizonDays: 30,
  options: [option('shared-cause', 'evaluate two paths from one common cause', [
    node('common-trigger', 'neutral', 0.8, 1, 0.9),
    node('route-a', 'neutral', 1, 1, 0.9),
    node('route-b', 'neutral', 1, 1, 0.9),
    node('shared-harm', 'harm', 0.8, 0.9, 0.9),
  ], [
    edge('action-common', '__action__', 'common-trigger', { strength01: 1 }),
    edge('common-route-a', 'common-trigger', 'route-a', { strength01: 1 }),
    edge('common-route-b', 'common-trigger', 'route-b', { strength01: 1 }),
    edge('route-a-shared', 'route-a', 'shared-harm', { strength01: 1 }),
    edge('route-b-shared', 'route-b', 'shared-harm', { strength01: 1 }),
  ])],
}).analysis.options[0].nodes.find(row => row.id === 'shared-harm');
assert.ok(
  Math.abs(correlatedPaths.propagatedProbability01 - 0.64) < 1e-9,
  'two paths descended from one root cause must not be double-counted as independent events',
);

const independentRoots = simulator.analyzeConsequences({
  id: 'consequence-analysis-independent-roots',
  horizonDays: 30,
  options: [option('independent-roots', 'evaluate two declared independent causes', [
    node('root-a', 'neutral', 0.6, 1, 0.9),
    node('root-b', 'neutral', 0.6, 1, 0.9),
    node('shared-outcome', 'harm', 0.8, 0.9, 0.9),
  ], [
    edge('action-root-a', '__action__', 'root-a', { strength01: 1, independenceGroup: 'cause-a' }),
    edge('action-root-b', '__action__', 'root-b', { strength01: 1, independenceGroup: 'cause-b' }),
    edge('root-a-outcome', 'root-a', 'shared-outcome', { strength01: 1 }),
    edge('root-b-outcome', 'root-b', 'shared-outcome', { strength01: 1 }),
  ])],
}).analysis.options[0].nodes.find(row => row.id === 'shared-outcome');
assert.ok(
  Math.abs(independentRoots.propagatedProbability01 - 0.7296) < 1e-9,
  'only explicitly separate independent root causes may combine with noisy-OR',
);

const counterfactual = simulator.analyzeConsequences({
  id: 'consequence-analysis-counterfactual',
  horizonDays: 30,
  options: [option('counterfactual-option', 'compare outcomes with a no-action baseline', [
    node('added-harm', 'harm', 0.8, 0.5, 0.9, { baselineProbability01: 0.2 }),
    node('avoided-harm', 'harm', 0.3, 0.5, 0.9, { baselineProbability01: 0.5 }),
    node('gained-benefit', 'benefit', 0.9, 0.6, 0.9, { baselineProbability01: 0.4 }),
    node('lost-benefit', 'benefit', 0.2, 0.5, 0.9, { baselineProbability01: 0.5 }),
    node('unknown-baseline', 'harm', 0.4, 0.8, 0.7),
  ], [
    edge('action-added-harm', '__action__', 'added-harm', { strength01: 1 }),
    edge('action-avoided-harm', '__action__', 'avoided-harm', { strength01: 1 }),
    edge('action-gained-benefit', '__action__', 'gained-benefit', { strength01: 1 }),
    edge('action-lost-benefit', '__action__', 'lost-benefit', { strength01: 1 }),
    edge('action-unknown-baseline', '__action__', 'unknown-baseline', { strength01: 1 }),
  ])],
}).analysis.options[0];
assert.equal(counterfactual.counterfactualCoverage01, 0.8);
approx(counterfactual.attributableHarm01, 0.3, 'attributable harm');
approx(counterfactual.avoidedHarm01, 0.1, 'avoided harm');
approx(counterfactual.attributableBenefit01, 0.3, 'attributable benefit');
approx(counterfactual.lostBenefit01, 0.15, 'lost benefit');
assert.ok(Math.abs(counterfactual.netAttributableValue01 + 0.05) < 1e-9);
approx(counterfactual.nodes.find(row => row.id === 'added-harm').attributableEffect01, 0.3, 'node attributable effect');
assert.equal(counterfactual.nodes.find(row => row.id === 'unknown-baseline').attributableEffect01, null,
  'missing counterfactual data must remain unknown rather than silently becoming zero');


const distributionalResult = simulator.analyzeConsequences({
  id: 'consequence-analysis-distributional-burden',
  horizonDays: 30,
  options: [option('externalized-costs', 'shift risk onto a dependent community', [
    node('community-harm', 'harm', 0.62, 1, 0.95, { actor: 'local-community', system: 'public-infrastructure' }),
    node('operator-benefit', 'benefit', 0.9, 1, 0.95, { actor: 'operator', system: 'business' }),
  ], [
    edge('action-community-harm', '__action__', 'community-harm', { strength01: 1 }),
    edge('action-operator-benefit', '__action__', 'operator-benefit', { strength01: 1 }),
  ])],
}).analysis.options[0];
approx(distributionalResult.worstStakeholderHarm01, 0.62, 'worst stakeholder harm');
approx(distributionalResult.topStakeholderHarmShare01, 1, 'top stakeholder harm share');
approx(distributionalResult.benefitBurdenSeparation01, 0.62, 'benefit-burden separation');
assert.equal(distributionalResult.mostExposedStakeholder.actor, 'local-community');
assert.equal(distributionalResult.mainBeneficiary.actor, 'operator');
assert.equal(distributionalResult.attention, 'mandatory-review',
  'high concentrated harm to one stakeholder must trigger mandatory review even below the aggregate harm threshold');

const distributedBurden = simulator.analyzeConsequences({
  id: 'consequence-analysis-distributed-burden',
  horizonDays: 30,
  options: [option('two-communities', 'distribute a comparable burden across two groups', [
    node('community-a-harm', 'harm', 0.4, 1, 0.95, { actor: 'community-a', system: 'service' }),
    node('community-b-harm', 'harm', 0.4, 1, 0.95, { actor: 'community-b', system: 'service' }),
  ], [
    edge('action-community-a', '__action__', 'community-a-harm', { strength01: 1 }),
    edge('action-community-b', '__action__', 'community-b-harm', { strength01: 1 }),
  ])],
}).analysis.options[0];
approx(distributedBurden.worstStakeholderHarm01, 0.4, 'distributed worst stakeholder harm');
approx(distributedBurden.topStakeholderHarmShare01, 0.5, 'distributed harm concentration proxy');
assert.equal(distributedBurden.benefitBurdenSeparation01, 0);
assert.equal(distributedBurden.mainBeneficiary, null);
const distributionDiagnostics = simulator.consequenceEcology.diagnostics();
assert.ok(distributionDiagnostics.meanWorstStakeholderHarm01 > 0);
assert.ok(distributionDiagnostics.meanBenefitBurdenSeparation01 > 0);
assert.ok(distributionDiagnostics.highConcentrationOptions >= 1);



assert.throws(() => simulator.analyzeConsequences({
  id: 'consequence-invalid-node-probability',
  horizonDays: 30,
  options: [option('invalid-probability', 'reject an out-of-range event probability', [
    node('bad-probability', 'harm', 1.2, 0.8, 0.9),
  ], [edge('bad-probability-edge', '__action__', 'bad-probability')])],
}), /consequence-node-probability-invalid/,
'out-of-range probability must be rejected instead of clamped to a misleading certainty');

assert.throws(() => simulator.analyzeConsequences({
  id: 'consequence-invalid-node-impact',
  horizonDays: 30,
  options: [option('invalid-impact', 'reject a non-finite impact', [
    node('bad-impact', 'harm', 0.5, Number.NaN, 0.9),
  ], [edge('bad-impact-edge', '__action__', 'bad-impact')])],
}), /consequence-node-impact-invalid/);

assert.throws(() => simulator.analyzeConsequences({
  id: 'consequence-invalid-baseline',
  horizonDays: 30,
  options: [option('invalid-baseline', 'reject an out-of-range counterfactual probability', [
    node('bad-baseline', 'harm', 0.5, 0.8, 0.9, { baselineProbability01: -0.1 }),
  ], [edge('bad-baseline-edge', '__action__', 'bad-baseline')])],
}), /consequence-node-baseline-probability-invalid/);

assert.throws(() => simulator.analyzeConsequences({
  id: 'consequence-invalid-edge-strength',
  horizonDays: 30,
  options: [option('invalid-edge', 'reject an invalid causal transfer', [
    node('edge-target', 'harm', 0.5, 0.8, 0.9),
  ], [edge('invalid-strength', '__action__', 'edge-target', { strength01: 1.01 })])],
}), /consequence-edge-strength-invalid/);

assert.throws(() => simulator.analyzeConsequences({
  id: 'consequence-invalid-horizon',
  horizonDays: 2.5,
  options: [safe],
}), /consequence-horizon-invalid/,
'fractional horizons must not be silently rounded to another analysis window');


const calibrationSimulator = new FutureSimulator();
const calibrationDecisionId = 'organism-decision-consequence-calibration';
calibrationSimulator.sharedFuture.setCanonicalDecisionResolver(id => id === calibrationDecisionId);
const calibrationScenario = calibrationSimulator.sharedFuture.createScenario({
  id: 'verified-calibration-scenario',
  title: 'Scenario used for independent consequence calibration',
  owner: 'system',
  confidence01: 0.95,
  consequences: [{
    id: 'verified-calibration-consequence',
    description: 'The selected action reaches its measured postcondition.',
    probability01: 0.72,
    impact01: 0.9,
    horizonDays: 3,
    reversible: true,
  }],
});
const calibrationAt = Date.now();
const calibrationDecision = calibrationSimulator.sharedFuture.proposeDecision({
  id: 'shared-future-calibration-decision',
  scenarioId: calibrationScenario.id,
  title: 'Execute the consequence-calibration action',
  owner: 'system',
  at: calibrationAt,
  actionBinding: {
    decisionId: calibrationDecisionId,
    toolId: 'runtime.execute',
    consequenceId: 'verified-calibration-consequence',
    expectedPostcondition: 'deployment is healthy',
  },
});
calibrationSimulator.sharedFuture.confirmDecision({
  decisionId: calibrationDecision.id,
  at: calibrationAt + 1,
}, 'system');
const calibrationAnalysis = calibrationSimulator.analyzeConsequences({
  id: 'analysis-before-independent-outcome',
  scenarioId: calibrationScenario.id,
  horizonDays: 30,
  at: calibrationAt + 2,
  options: [{
    ...option('verified-selected-option', 'execute the approved deployment action', [
      node('additional-context', 'neutral', 0.2, 0.1, 0.9),
    ], [edge('action-context', '__action__', 'additional-context')]),
    decisionId: calibrationDecisionId,
  }],
});
assert.equal(calibrationAnalysis.analysis.options[0].decisionId, calibrationDecisionId,
  'the analysis must retain the exact accepted action-decision binding');
assert.throws(() => calibrationSimulator.analyzeConsequences({
  id: 'duplicate-decision-option-binding',
  scenarioId: calibrationScenario.id,
  horizonDays: 30,
  options: [
    { ...option('duplicate-option-a', 'first representation of one accepted action', [
      node('context-a', 'neutral', 0.2, 0.1, 0.9),
    ], [edge('context-edge-a', '__action__', 'context-a')]), decisionId: calibrationDecisionId },
    { ...option('duplicate-option-b', 'second representation of the same accepted action', [
      node('context-b', 'neutral', 0.3, 0.1, 0.9),
    ], [edge('context-edge-b', '__action__', 'context-b')]), decisionId: calibrationDecisionId },
  ],
}), /consequence-action-decision-bound-to-multiple-options/,
'one accepted action decision cannot ambiguously calibrate multiple alternatives');
assert.throws(() => calibrationSimulator.analyzeConsequences({
  id: 'scenario-node-substitution',
  scenarioId: calibrationScenario.id,
  horizonDays: 30,
  options: [{
    ...option('substituted-scenario-option', 'change the event after it was bound', [
      node('verified-calibration-consequence', 'harm', 0.73, 0.9, 0.95, { delayDays: 3 }),
    ], [edge('scenario-substitution-edge', '__action__', 'verified-calibration-consequence')]),
  }],
}), /consequence-scenario-node-conflict/,
'a canonical scenario consequence cannot be silently redefined by an option payload');
assert.equal(typeof calibrationSimulator.recordVerifiedConsequenceOutcome, 'function',
  'FutureSimulator must reconcile canonical verified outcomes with stored model forecasts');
const independentlyRecorded = calibrationSimulator.sharedFuture.recordVerifiedExternalOutcome({
  id: 'verified-calibration-outcome',
  actionDecisionId: calibrationDecisionId,
  toolId: 'runtime.execute',
  executionId: 'exec-consequence-calibration-1',
  observationId: 'observation-consequence-calibration-1',
  expectedPostcondition: 'deployment is healthy',
  observedPostcondition: 'deployment is healthy',
  direction: 'confirmed',
  confidence01: 0.93,
  independent01: 0.82,
  evidence: [{
    observationId: 'observation-consequence-calibration-1',
    sourceId: 'deployment-monitor-1',
    sourceClass: 'external-api',
    independenceKey: 'deployment-monitor-independent',
    confidence01: 0.95,
    assessment: 'match',
    verified: true,
  }],
  at: calibrationAt + 100,
});
assert.equal(independentlyRecorded.recorded, true);
const matchedCalibration = calibrationSimulator.recordVerifiedConsequenceOutcome({
  outcomeId: independentlyRecorded.outcome.id,
  analysisId: calibrationAnalysis.analysis.id,
  optionId: 'verified-selected-option',
});
assert.equal(matchedCalibration.recorded, true);
assert.equal(matchedCalibration.independentlyVerified, true);
approx(matchedCalibration.calibration.forecastProbability01, 0.72, 'calibrated model forecast');
approx(matchedCalibration.calibration.brierScore01, (0.72 - 1) ** 2, 'recomputed consequence ecology brier score');
approx(matchedCalibration.calibration.sharedFutureBrierScore01, (0.72 - 1) ** 2, 'shared future baseline brier score');
assert.equal(matchedCalibration.calibration.brierSkillScore, 0,
  'the calibration ledger must compare like-for-like predictions without inventing model skill');
const replayedCalibration = calibrationSimulator.recordVerifiedConsequenceOutcome({
  outcomeId: independentlyRecorded.outcome.id,
  analysisId: calibrationAnalysis.analysis.id,
  optionId: 'verified-selected-option',
});
assert.equal(replayedCalibration.replayed, true, 'calibration must be idempotent');
const calibrationSnapshot = calibrationSimulator.snapshot();
const unvalidatedCalibrationRestore = new FutureSimulator();
unvalidatedCalibrationRestore.restore(calibrationSnapshot);
assert.equal(unvalidatedCalibrationRestore.consequenceEcology.listCalibrations().length, 0,
  'independent outcome claims must not survive restore without external revalidation');
const calibrationRoundTrip = new FutureSimulator();
let independentOutcomeValidatorCalls = 0;
calibrationRoundTrip.restore(calibrationSnapshot, {
  validateIndependentlyVerifiedOutcome: outcome => {
    independentOutcomeValidatorCalls++;
    return outcome.id === independentlyRecorded.outcome.id &&
      outcome.authority === 'independent-external' &&
      outcome.independentSourceCount === 1 &&
      outcome.evidenceObservationIds?.includes('observation-consequence-calibration-1') === true;
  },
});
assert.equal(independentOutcomeValidatorCalls, 1,
  'the external verifier must run exactly once; Consequence Ecology must reuse the canonical Shared Future admission result');
assert.deepEqual(calibrationRoundTrip.consequenceEcology.listCalibrations(), calibrationSimulator.consequenceEcology.listCalibrations(),
  'verified calibration records must survive only after canonical Shared Future outcome revalidation');
const tamperedCalibrationSnapshot = structuredClone(calibrationSnapshot);
tamperedCalibrationSnapshot.consequenceEcology.outcomeCalibrations[0].brierScore01 = 0;
const tamperedCalibrationRestore = new FutureSimulator();
tamperedCalibrationRestore.restore(tamperedCalibrationSnapshot, {
  validateIndependentlyVerifiedOutcome: outcome => outcome.id === independentlyRecorded.outcome.id,
});
assert.equal(tamperedCalibrationRestore.consequenceEcology.listCalibrations().length, 0,
  'persisted calibration scores must be recomputed and tampered values rejected');

const misboundCalibrationSnapshot = structuredClone(calibrationSnapshot);
misboundCalibrationSnapshot.consequenceEcology.outcomeCalibrations[0].actionDecisionId = 'foreign-action-decision';
const misboundCalibrationRestore = new FutureSimulator();
misboundCalibrationRestore.restore(misboundCalibrationSnapshot, {
  validateIndependentlyVerifiedOutcome: outcome => outcome.id === independentlyRecorded.outcome.id,
});
assert.equal(misboundCalibrationRestore.consequenceEcology.listCalibrations().length, 0,
  'a calibration row must match the canonical action-decision ID, not only a valid outcome ID');

const alteredEvidenceCalibrationSnapshot = structuredClone(calibrationSnapshot);
alteredEvidenceCalibrationSnapshot.consequenceEcology.outcomeCalibrations[0].evidenceRef = 'external-observation:substituted';
const alteredEvidenceCalibrationRestore = new FutureSimulator();
alteredEvidenceCalibrationRestore.restore(alteredEvidenceCalibrationSnapshot, {
  validateIndependentlyVerifiedOutcome: outcome => outcome.id === independentlyRecorded.outcome.id,
});
assert.equal(alteredEvidenceCalibrationRestore.consequenceEcology.listCalibrations().length, 0,
  'a calibration row must retain the exact canonical evidence reference');

const calibrationGateway = new ActionGateway({ live: false });
calibrationGateway.setExecutionLedgerPersister(async () => {});
registerConsequenceEcologyTools(calibrationGateway, calibrationSimulator);
assert.equal(calibrationGateway.listTools().find(row => row.id === 'organism.consequences.outcomes.calibrate')?.requiresIdempotencyKey, true,
  'calibration writes must be idempotent at the ActionGateway boundary');
const gatewayCalibration = await calibrationGateway.executeTool('organism.consequences.outcomes.calibrate', {
  outcomeId: independentlyRecorded.outcome.id,
  analysisId: calibrationAnalysis.analysis.id,
  optionId: 'verified-selected-option',
}, 'consequence-ecology-calibration-test', { idempotencyKey: 'verified-consequence-calibration-1' });
assert.equal(gatewayCalibration.ok, true, JSON.stringify(gatewayCalibration));
assert.equal(gatewayCalibration.result.replayed, true);
const listedCalibrations = await calibrationGateway.executeTool('organism.consequences.outcomes.list', { limit: 8 });
assert.equal(listedCalibrations.ok, true);
assert.equal(listedCalibrations.result.calibrations.length, 1);
assert.equal(
  calibrationSimulator.consequenceEcology.diagnostics().verifiedCalibrationSamples,
  1,
);
assert.equal(calibrationSimulator.consequenceEcology.diagnostics().calibrationSampleSufficient, false,
  'a single verified outcome is not enough to declare model calibration reliable');
assert.equal(calibrationSimulator.consequenceEcology.diagnostics().modelWeightsUpdated, false,
  'observed outcomes must not silently update model weights or confidence');

const unverifiedSimulator = new FutureSimulator();
const unverifiedScenario = unverifiedSimulator.sharedFuture.createScenario({
  id: 'unverified-calibration-scenario',
  title: 'User/system report is not independent validation',
  consequences: [{ id: 'unverified-result', description: 'An unverified result', probability01: 0.6 }],
});
const unverifiedAnalysis = unverifiedSimulator.analyzeConsequences({
  id: 'unverified-calibration-analysis',
  scenarioId: unverifiedScenario.id,
  horizonDays: 30,
  options: [option('unverified-option', 'perform the action', [
    node('context', 'neutral', 0.5, 0.1, 0.9),
  ], [edge('context-edge', '__action__', 'context')])],
});
const unverifiedOutcome = unverifiedSimulator.sharedFuture.recordOutcome({
  id: 'unverified-outcome-record',
  scenarioId: unverifiedScenario.id,
  consequenceId: 'unverified-result',
  occurred: true,
  evidenceRef: 'user-report:unverified',
});
assert.equal(unverifiedOutcome.independentlyVerified, false);
assert.throws(() => unverifiedSimulator.recordVerifiedConsequenceOutcome({
  outcomeId: unverifiedOutcome.id,
  analysisId: unverifiedAnalysis.analysis.id,
  optionId: 'unverified-option',
}), /consequence-outcome-not-independently-verified/);

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
