import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

// The current cycle's workspace coalition must be formed before P61/P64 arbitration,
// and its ignition signal must be the signal consumed by that same arbitration.
const core = new OrganismCore(new MemoryStateStore(), {
  enableLanguage: false,
  enableWorkspace: true,
  cycleResultMode: 'operational',
});
await core.init();

const order = [];
let competed = null;
let arbitrationWorkspace01 = null;
let workspaceInputs = [];
let arbitrationCandidateScores = [];
const workspace = core.cognitiveRuntime.globalWorkspace;
const coordinator = core.cognitiveRuntime.cognitiveKernelCoordinator;
const compete = workspace.compete.bind(workspace);
const arbitrate = coordinator.integrateAndArbitrate.bind(coordinator);

workspace.compete = (...args) => {
  order.push('workspace');
  workspaceInputs = structuredClone(args[0]);
  competed = compete(...args);
  return competed;
};
coordinator.integrateAndArbitrate = (input, ...args) => {
  order.push('arbitration');
  arbitrationWorkspace01 = input.workspace01;
  arbitrationCandidateScores = input.candidates.map(candidate => ({ action: candidate.action, score: candidate.score }));
  return arbitrate(input, ...args);
};

await core.observe({
  text: 'Inspect the current lab situation and choose the safest useful next action.',
  novelty: 0.7,
  uncertainty: 0.35,
});

assert.ok(competed, 'the real runtime must compete the current cycle candidates');
assert.ok(competed.ignition01 > 0, 'the current cycle must produce a non-empty workspace ignition');
assert.ok(order.indexOf('workspace') >= 0 && order.indexOf('arbitration') >= 0,
  'both workspace competition and P61/P64 arbitration must execute');
assert.ok(order.indexOf('workspace') < order.indexOf('arbitration'),
  'current-cycle workspace competition must precede P61/P64 arbitration');
assert.equal(order.filter(event => event === 'workspace').length, 1,
  'the current cycle must compete the global workspace exactly once; no late duplicate competition is allowed');
assert.equal(order.at(-1), 'arbitration',
  'no global workspace competition may run after P61/P64 arbitration');
assert.equal(arbitrationWorkspace01, competed.ignition01,
  'P61/P64 must consume the ignition produced by this cycle, not a stale previous-cycle signal');

const actionByCandidateId = new Map(workspaceInputs.map(candidate => [candidate.id, candidate.content?.action]));
const sourceScoreByAction = new Map(workspaceInputs.map(candidate => [candidate.content?.action, candidate.features?.[0]]));
const selectedActions = new Set(competed.selectedIds.map(id => actionByCandidateId.get(id)).filter(Boolean));
assert.ok(selectedActions.size > 0, 'the workspace must return a non-empty same-cycle coalition');
const supportRows = arbitrationCandidateScores.map(candidate => ({
  action: candidate.action,
  selected: selectedActions.has(candidate.action),
  delta: candidate.score - (sourceScoreByAction.get(candidate.action) ?? candidate.score),
}));
assert.ok(supportRows.some(row => row.selected && row.delta > 0.000001),
  'selected workspace candidates must influence same-cycle arbitration, not only produce a diagnostic ignition scalar');
assert.ok(supportRows.filter(row => row.selected).every(row => row.delta > 0 && row.delta <= 0.030001),
  'workspace coalition support must be positive but strictly bounded to 0.03');
assert.ok(supportRows.filter(row => !row.selected).every(row => Math.abs(row.delta) < 0.000001),
  'non-selected candidates must not receive global workspace coalition support');

console.log('NK1_COGNITIVE_WORKSPACE_PREARBITRATION=PASS', JSON.stringify({
  order,
  ignition01: competed.ignition01,
  arbitrationWorkspace01,
}));
