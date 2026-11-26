import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { GlobalWorkspaceSubstrateV2 } from '../src/organism/cognition/GlobalWorkspaceSubstrateV2.ts';

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
// Verify the real OrganismCore cycle preserves the decision lane while admitting domain summaries.
const workspaceSourceById = new Map(workspaceInputs.map(candidate => [candidate.id, candidate.source]));
const selectedSources = new Set(competed.selectedIds.map(id => workspaceSourceById.get(id)).filter(Boolean));
assert.ok(selectedSources.has('decision'),
  'the integrated workspace coalition must preserve a decision candidate for the canonical selector');
assert.ok([...selectedSources].some(source => source !== 'decision'),
  'the integrated workspace coalition must broadcast at least one non-decision cognitive domain');
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


// Admission is deterministic, bounded, duplicate-safe and independent of input ordering.
const admissionCandidates = Array.from({ length: 80 }, (_, i) => ({
  id: `candidate-${String(i).padStart(2, '0')}`,
  source: i % 2 ? 'perception' : 'memory',
  salience: i === 79 ? 1 : 0.2 + (i % 7) * 0.01,
  features: [i === 79 ? 1 : 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
}));
const admissionA = new GlobalWorkspaceSubstrateV2();
const admissionB = new GlobalWorkspaceSubstrateV2();
const admittedA = admissionA.compete(admissionCandidates);
const admittedB = admissionB.compete([...admissionCandidates].reverse());
assert.deepEqual(admittedA.selectedIds, admittedB.selectedIds,
  'candidate admission must not depend on producer array order');
assert.ok(admittedA.selectedIds.includes('candidate-79'),
  'a high-salience late candidate must not be silently dropped by first-64 truncation');
assert.equal(admissionA.diagnostics().admission.admittedCount, 64,
  'workspace admission must enforce its 64-candidate compute bound');

const duplicateWorkspace = new GlobalWorkspaceSubstrateV2();
const duplicateResult = duplicateWorkspace.compete([
  { id: 'same-id', source: 'memory', salience: 0.1, features: new Array(12).fill(0) },
  { id: 'same-id', source: 'perception', salience: 0.95, features: [1, ...new Array(11).fill(0)] },
  { id: 'other-id', source: 'goal', salience: 0.5, features: new Array(12).fill(0) },
]);
assert.equal(duplicateResult.selectedIds.filter(id => id === 'same-id').length, 1,
  'duplicate candidate identities must never occupy multiple coalition slots');
assert.equal(duplicateWorkspace.diagnostics().admission.duplicateCount, 1,
  'duplicate identity rejection must be observable in diagnostics');
assert.equal(duplicateWorkspace.diagnostics().admission.uniqueCount, 2,
  'the strongest version of a repeated candidate identity must be retained');


const sourceBalancedWorkspace = new GlobalWorkspaceSubstrateV2();
const sourceBalancedCandidates = [
  ...Array.from({ length: 80 }, (_, i) => ({
    id: `dominant-${i}`, source: 'memory', salience: 0.95,
    features: [0.8, ...new Array(11).fill(0)],
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `minority-${i}`, source: 'perception', salience: 0.45,
    features: [0.3, ...new Array(11).fill(0)],
  })),
];
sourceBalancedWorkspace.compete(sourceBalancedCandidates);
const sourceAdmission = sourceBalancedWorkspace.diagnostics().admission.admittedBySource;
const sourceById = new Map(sourceBalancedCandidates.map(candidate => [candidate.id, candidate.source]));
assert.ok(sourceBalancedWorkspace.snapshot().selectedIds.some(id => sourceById.get(id) === 'perception'),
  'the final attention coalition must preserve at least one lower-volume source, not only admit it');
assert.equal(sourceAdmission.memory, 52,
  'after reserving admission for other sources, remaining capacity may be filled by the strongest candidates');
assert.equal(sourceAdmission.perception, 12,
  'lower-volume sources must retain admission even when a dominant source emits many higher-salience candidates');
assert.equal(sourceBalancedWorkspace.diagnostics().admission.admittedCount, 64,
  'the second admission pass must fill remaining capacity with real candidates');

console.log('NK1_GLOBAL_WORKSPACE_ADMISSION=PASS', JSON.stringify({
  orderInvariant: true,
  admitted: admissionA.diagnostics().admission.admittedCount,
  overflow: admissionA.diagnostics().admission.overflowCount,
  duplicates: duplicateWorkspace.diagnostics().admission.duplicateCount,
}));
