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
const workspace = core.cognitiveRuntime.globalWorkspace;
const coordinator = core.cognitiveRuntime.cognitiveKernelCoordinator;
const compete = workspace.compete.bind(workspace);
const arbitrate = coordinator.integrateAndArbitrate.bind(coordinator);

workspace.compete = (...args) => {
  order.push('workspace');
  competed = compete(...args);
  return competed;
};
coordinator.integrateAndArbitrate = (input, ...args) => {
  order.push('arbitration');
  arbitrationWorkspace01 = input.workspace01;
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

console.log('NK1_COGNITIVE_WORKSPACE_PREARBITRATION=PASS', JSON.stringify({
  order,
  ignition01: competed.ignition01,
  arbitrationWorkspace01,
}));
