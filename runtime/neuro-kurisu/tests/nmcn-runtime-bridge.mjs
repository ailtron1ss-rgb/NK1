import assert from 'node:assert/strict';
import {
  buildNmcNRuntimeInput,
  evaluateNmcNRuntime,
  NMCN_ACTION_DIMENSION,
  NMCN_MEMORY_KEY_DIMENSION,
  NMCN_STATE_DIMENSION,
} from '../src/organism/integration/nmcn/NmcNRuntimeBridge.ts';

const input = buildNmcNRuntimeInput({
  tick: 17,
  energy01: 0.8,
  cognitiveLoad01: 0.25,
  uncertainty01: 0.7,
  novelty01: 0.6,
  goalPressure01: 0.5,
  predictionError01: 0.72,
  bodyEnergy01: 0.9,
  thermalStrain01: 0.1,
  sensoryFreshness01: 1,
  battery01: 0.75,
  selectedAction: 'inspect',
  lowPower: false,
  nowMs: 1_000,
});

assert.equal(input.schema_version, 1);
assert.equal(input.tick, 17);
assert.equal(input.state.length, NMCN_STATE_DIMENSION);
assert.equal(input.action.length, NMCN_ACTION_DIMENSION);
assert.equal(input.memory_key.length, NMCN_MEMORY_KEY_DIMENSION);
assert.equal(input.action[1], 1);
assert.equal(input.signal.signal_id, 'nk1-cycle-17');
assert.equal(input.signal.payload_ref, 'nk1-cycle:17');
assert.equal('text' in input, false, 'raw user text must not cross the bridge');

let received;
const decision = await evaluateNmcNRuntime({
  async evaluate(payload) {
    received = payload;
    return {
      compute: { mode: 'deliberative', reason: 'high_uncertainty_or_surprise', max_reasoning_cycles: 2 },
      invoke_language_core: true,
      invocation_reason: 'high_uncertainty_or_surprise',
      distribution_shift_detected: true,
      estimated_auxiliary_state_bytes: 4096,
    };
  },
}, input);
assert.deepEqual(received, input);
assert.equal(decision?.invokeLanguageCore, true);
assert.equal(decision?.distributionShiftDetected, true);
assert.equal(decision?.maxReasoningCycles, 2);
assert.equal(decision?.estimatedAuxiliaryStateBytes, 4096);

const malformed = await evaluateNmcNRuntime({
  async evaluate() {
    return { compute: { mode: 'deliberative', reason: 'bad', max_reasoning_cycles: 99 },
      invoke_language_core: 'yes', distribution_shift_detected: false, estimated_auxiliary_state_bytes: 1 };
  },
}, input);
assert.equal(malformed, null, 'malformed sidecar output must fail closed');

const timeoutController = { aborted: false };
const timedOut = await evaluateNmcNRuntime({
  evaluate(_payload, options) {
    options?.signal?.addEventListener('abort', () => { timeoutController.aborted = true; });
    return new Promise(() => {});
  },
}, input, { timeoutMs: 10 });
assert.equal(timedOut, null);
assert.equal(timeoutController.aborted, true, 'timeout must signal cancellation to the host adapter');

const invalid = { ...input, state: [2, ...input.state.slice(1)] };
assert.equal(await evaluateNmcNRuntime({ async evaluate() { throw new Error('must not be called'); } }, invalid), null);

console.log('NMCN runtime bridge: bounded projection, strict decision parsing, fail-closed timeout PASS');
