import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RuntimePerformanceGovernor } from '../src/organism/system/RuntimePerformanceGovernor.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

// Regression for the cycle-nondeterminism defect (W1 D1). Two identical runs used to
// diverge because the performance governor fed host wall/CPU/heap back into the decision
// signal. In deterministic mode that feedback must be neutral, while the default path
// must keep reacting to load exactly as before.

const samples = (gov) => {
  for (let i = 0; i < 200; i += 1) {
    gov.record({ wallMs: i % 17 === 0 ? 2100 : 480 + (i % 13) * 17, cpuMs: 180 + (i % 7) * 25, heapUsedBytes: 200 * 1024 * 1024 + (i % 11) * 1024 * 1024, rssBytes: 400 * 1024 * 1024, thermal01: i % 31 === 0 ? 0.74 : 0.22, ramPressure01: i % 47 === 0 ? 0.81 : 0.28 });
  }
};

const deterministic = new RuntimePerformanceGovernor(1200, { deterministic: true });
samples(deterministic);
const d = deterministic.decision();
assert.equal(d.performancePressure01, 0, 'deterministic mode must not derive pressure from host load');
assert.equal(d.memoryPressure01, 0);
assert.equal(d.cpuPressure01, 0);
assert.equal(d.effectiveLastStepMs, 0, 'deterministic mode must not leak measured step time into policy');
// Observability is preserved: the raw sample is still recorded.
assert.ok(deterministic.snapshot().samples === 200 && deterministic.snapshot().maxWallMs >= 2100);

const normal = new RuntimePerformanceGovernor(1200);
samples(normal);
const n = normal.decision();
assert.ok(n.performancePressure01 > 0, 'default governor must still react to host load');
assert.ok(n.effectiveLastStepMs > 0, 'default governor must still report measured step time');

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nk1-governor-determinism-'));
try {
  const runtime = new OrganismRuntime({ stateFile: path.join(dir, 'state.json'), worldStateFile: path.join(dir, 'world.json'), autoRun: false, enableLanguage: false, performanceProfile: 'mobile', deterministic: true, intervalMs: 5000 });
  await runtime.init();
  for (let i = 0; i < 3; i += 1) await runtime.step();
  const snap = runtime.runtimePerformanceSnapshot();
  assert.ok((snap?.samples ?? 0) >= 3, 'runtime must still record real cycle performance');
  assert.equal(snap.performancePressure01, 0, 'runtime config must wire determinism into the governor');
  await runtime.stop();
} finally {
  await fs.rm(dir, { recursive: true, force: true });
}

console.log('NK1_PERFORMANCE_GOVERNOR_DETERMINISM=PASS deterministicPressure=0 defaultPressure>0 wiring=ok');
