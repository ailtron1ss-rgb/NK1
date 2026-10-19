import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

process.env.ACTIONS_LIVE = 'false';
const core = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
await core.init();
let executorCalls = 0;
core.registerActionTool({
  id: 'test.skill-unavailable-workpass59', capability: 'test.read', destructive: false, projectAllowed: true,
  availability: () => ({ available: false, reason: 'fixture-provider-offline' }),
  execute: async () => { executorCalls++; return { ok: true, value: 'should-not-run' }; },
});

// Promote an actual reusable skill, then watch its learning mutation APIs.
const compiled = core.compileCompoundSkill({
  projectId: 'wp59-skill-gate', name: 'Availability-gated skill', origin: 'intrinsic',
  steps: [
    { id: 'read-offline-a', action: 'explore', toolId: 'test.skill-unavailable-workpass59', input: {} },
    { id: 'read-offline-b', action: 'explore', toolId: 'test.skill-unavailable-workpass59', input: {} },
  ],
});
assert.ok(compiled);
for (let i = 0; i < 6; i++) core.recordCompoundSkillExecution(compiled.id, { success01: 1, verified: true, independent: true, context: `wp59-promote-${i}` });
const reusable = core.compoundSkillsSnapshot(16).find(row => row.id === compiled.id && row.status === 'reusable');
assert.ok(reusable, 'test fixture is a reusable compound skill');
let repairWrites = 0;
let aggregateWrites = 0;
const library = core.cognitiveRuntime.skillLibrary;
const recordRepair = library.recordCompoundRepair.bind(library);
const recordExecution = library.recordCompoundExecution.bind(library);
library.recordCompoundRepair = (...args) => { repairWrites++; return recordRepair(...args); };
library.recordCompoundExecution = (...args) => { aggregateWrites++; return recordExecution(...args); };
const paused = await core.executeReusableSkill(reusable.id, {}, 'wp59-skill-provider-gate', {});
assert.equal(paused.results[0].outcomeClass, 'unavailable');
assert.equal(paused.pausedBeforeExecution, true);
assert.equal(executorCalls, 0);
assert.equal(repairWrites, 0, 'availability failures cannot generate repair candidates');
assert.equal(aggregateWrites, 0, 'an unavailable provider cannot reduce aggregate skill competence');
assert.ok(core.snapshot().facets.memory.eventLog.some(e => e.type === 'compound-skill-paused-before-execution'), 'the paused attempt remains observable without a competence reward');

// The project executor must similarly avoid counting a gate rejection as a failed tool attempt.
const proposed = core.agencySubsystem.selfProjects.propose({
  intrinsicOverall: .9, dominant: 'competence', uncertainty: .8, predictionError: .3,
  identityDrift: .1, unresolvedExperiments: 0, activeGoals: [],
});
assert.ok(proposed);
const active = core.agencySubsystem.selfProjects.selectProject(proposed.id);
assert.ok(active);
core.agencySubsystem.projectExecutor.ensure({ id: active.id, origin: active.origin });
const projectState = core.agencySubsystem.projectExecutor.snapshot();
projectState.steps[0].preferredTool = 'test.skill-unavailable-workpass59';
projectState.steps[0].toolInput = {};
core.agencySubsystem.projectExecutor.restore(projectState);
let projectFailureUpdates = 0;
const projectExecutor = core.agencySubsystem.projectExecutor;
const observeToolResult = projectExecutor.observeToolResult.bind(projectExecutor);
projectExecutor.observeToolResult = (...args) => { projectFailureUpdates++; return observeToolResult(...args); };
let benchmarkUpdates = 0;
const benchmark = core.evidenceResearchSubsystem.skillAcquisitionBenchmark;
const observeBenchmark = benchmark.observe.bind(benchmark);
benchmark.observe = (...args) => { benchmarkUpdates++; return observeBenchmark(...args); };
const projectResult = await core.executeProjectTool('test.skill-unavailable-workpass59', {}, 'wp59-project-provider-gate', {});
assert.equal(projectResult.outcomeClass, 'unavailable');
assert.equal(projectFailureUpdates, 0, 'a provider availability gate must not consume a project failure attempt');
assert.equal(benchmarkUpdates, 0, 'a provider availability gate must not add a negative action-learning sample');
assert.ok(core.snapshot().facets.memory.eventLog.some(e => e.type === 'project-tool-preflight-blocked'), 'the blocked project attempt remains visible');
assert.equal(executorCalls, 0, 'neither skill nor project invokes an unavailable executor');

console.log('WORKPASS59_NONEXECUTION_LEARNING_FIREWALL=PASS skill-repair aggregate-skill project-attempt benchmark-gates');
