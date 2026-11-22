import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir = await mkdtemp(path.join(os.tmpdir(), 'nk-cognitive-health-runtime-'));
const stateFile = path.join(dir, 'organism.json');
const healthFile = `${stateFile}.cognitive-health.json`;
const provider = tick => ({
  tick,
  at: 10_000 + tick,
  epistemic: {
    claimsData: [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `stale-belief-${i}`, kind: 'belief', status: 'stale', confidence01: .96, supportCount: 1 })),
      ...Array.from({ length: 8 }, (_, i) => ({ id: `unsupported-inference-${i}`, kind: 'inference', status: 'active', confidence01: .98, supportCount: 1 })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `bad-prediction-${i}`, kind: 'prediction', status: 'resolved', resolved: true, error01: .96 })),
    ],
    resolvedPredictions: 4,
    meanPredictionError01: .96,
  },
  contradictions: { claims: Array.from({ length: 4 }, (_, i) => ({ id: `open-conflict-${i}`, status: 'open' })) },
  skills: {
    skills: Array.from({ length: 2 }, (_, i) => ({ id: `failing-skill-${i}`, uses: 8, failures: 8, successRate: 0, status: 'active' })),
    compoundSkills: [],
  },
});

const makeRuntime = (withProvider = false) => new OrganismRuntime({
  stateFile,
  worldStateFile: path.join(dir, 'world.json'),
  enableLanguage: false,
  autoRun: false,
  intervalMs: 60_000,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
  ...(withProvider ? { cognitiveHealthInputProvider: provider } : {}),
});

let runtime;
let restored;
try {
  runtime = makeRuntime(true);
  await runtime.init();
  for (let i = 0; i < 5; i++) await runtime.autonomousStep();
  const health = runtime.cognitiveHealthSnapshot();
  assert.equal(health.inspections, 5, 'one health observation must be recorded for each completed cognitive tick');
  assert.ok(health.signals.length >= 4, 'persistent degradation across real runtime cycles must open evidence-linked review signals');
  assert.ok(health.signals.every(signal => signal.evidenceRefs.length > 0), 'runtime alerts must retain source evidence references');
  assert.ok((await new FileStateStore(healthFile).load())?.health?.inspections === 5, 'health observations must be durably checkpointed in a dedicated sidecar');
  const target = health.signals.find(signal => signal.status === 'open');
  assert.ok(target);
  assert.equal(await runtime.reviewCognitiveHealthSignal(target.id, 'confirmed', 'runtime-integration-reviewer', 'fixture:review'), true);
  await runtime.stop();
  runtime = null;

  restored = makeRuntime(false);
  await restored.init();
  const afterRestart = restored.cognitiveHealthSnapshot();
  assert.equal(afterRestart.inspections, 5, 'health tick history must survive runtime restart');
  assert.equal(afterRestart.signals.find(signal => signal.id === target.id)?.status, 'acknowledged');
  assert.ok(afterRestart.events.some(event => event.type === 'signal-acknowledged' && event.signalId === target.id),
    'manual review and its audit event must survive restart');
  const before = afterRestart.inspections;
  await restored.autonomousStep();
  assert.equal(restored.cognitiveHealthSnapshot().inspections, before,
    'without a configured canonical-ledger provider, runtime must not manufacture healthy observations');
  console.log('COGNITIVE_HEALTH_RUNTIME_INTEGRATION=PASS (live cycles -> evidence-linked alerts -> sidecar checkpoint -> reviewed restore)');
} finally {
  if (runtime) await runtime.stop().catch(() => {});
  if (restored) await restored.stop().catch(() => {});
  await rm(dir, { recursive: true, force: true });
}
