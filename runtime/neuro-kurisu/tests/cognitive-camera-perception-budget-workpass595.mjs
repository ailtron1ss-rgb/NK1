import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nk1-wp595-camera-gate-'));
const runtime = new OrganismRuntime({
  stateFile: path.join(dir, 'state.json'),
  autoRun: false,
  enableLanguage: false,
  realityMode: 'external-first',
  performanceProfile: 'mobile',
});
await runtime.init();
let directCaptureCalls = 0;
const stableBody = {
  telemetry: { motion01: 0, battery01: .8, ramPressure01: .1 },
  thermalStrain01: .1,
  awake: true,
};
runtime.embodiment.snapshot = () => structuredClone(stableBody);
runtime.core.p41NextPerception = () => null;
runtime.captureCameraDirect = async (...args) => {
  directCaptureCalls++;
  return { ok: true, args };
};
const basePlan = {
  tick: 1,
  run: { perception: false, memory: true, research: true, project: true, shadow: true, 'world-rollout': true, 'slow-cognition': true },
  expectedValue01: {
    perception: .1, memory: .2, research: .99, project: .95,
    shadow: .3, 'world-rollout': .4, 'slow-cognition': .3,
  },
};
runtime.core.cognitiveExecutionPlanSnapshot = () => structuredClone(basePlan);

try {
  const unrelatedHighValue = await runtime.captureCameraForCognition(0, false, {
    idempotencyKey: 'wp595-unrelated-research-must-not-trigger-camera',
  });
  assert.equal(unrelatedHighValue.skipped, true,
    'high research/project value must not trigger camera capture when perception value is low');
  assert.equal(unrelatedHighValue.reason, 'low-vision-utility');
  assert.equal(unrelatedHighValue.demand01, .1,
    'camera demand diagnostic must report perception-specific value, not the maximum across all operations');
  assert.equal(directCaptureCalls, 0,
    'unrelated cognitive operations must not cross the physical camera capture boundary');

  const perceptionPlan = structuredClone(basePlan);
  perceptionPlan.expectedValue01.perception = .8;
  perceptionPlan.expectedValue01.research = .05;
  runtime.core.cognitiveExecutionPlanSnapshot = () => structuredClone(perceptionPlan);
  const requested = await runtime.captureCameraForCognition(0, false, {
    idempotencyKey: 'wp595-perception-value-allows-camera',
  });
  assert.equal(requested.ok, true,
    'high perception value must still authorize camera capture when hardware resource gates allow it');
  assert.equal(directCaptureCalls, 1,
    'a genuinely high perception value must preserve the existing camera dispatch path');

  console.log('COGNITIVE_CAMERA_PERCEPTION_GATE=PASS', JSON.stringify({
    unrelatedHighValue: { skipped: unrelatedHighValue.skipped, reason: unrelatedHighValue.reason, demand01: unrelatedHighValue.demand01 },
    perceptionValue: perceptionPlan.expectedValue01.perception,
    directCaptureCalls,
  }));
} finally {
  await runtime.stop?.();
  await fs.rm(dir, { recursive: true, force: true });
}
