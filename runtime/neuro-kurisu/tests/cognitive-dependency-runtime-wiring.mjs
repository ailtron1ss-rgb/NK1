import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const directory = await mkdtemp(path.join(tmpdir(), 'nk-cognitive-dependency-runtime-'));
const stateFile = path.join(directory, 'organism.json');
const worldStateFile = path.join(directory, 'world.json');
const dependencyStateFile = `${stateFile}.cognitive-dependencies.json`;
const runtimeConfig = () => ({
  stateFile,
  worldStateFile,
  enableLanguage: false,
  performanceProfile: 'mobile',
  journal: new BoundedOperationalJournal(),
});

let runtime;
try {
  runtime = new OrganismRuntime(runtimeConfig());
  await runtime.init();

  // Deliberately separate capacity from memory pressure: a healthy capacity
  // must not erase a high RAM sensor reading on the allocation path.
  const originalSample = runtime.embodiment.sample.bind(runtime.embodiment);
  runtime.embodiment.sample = async (...args) => {
    const sampled = await originalSample(...args);
    return {
      ...sampled,
      bodyEnergy01: 0.8,
      cognitiveCapacity01: 0.85,
      thermalStrain01: 0.2,
      awake: true,
      telemetry: { ...sampled.telemetry, ramPressure01: 0.88 },
    };
  };
  const predictionDebt01 = Number(runtime.core.predictionDebtSnapshot()?.meanPriority01 ?? 0);
  await runtime.autonomousStep();

  const resourceEvent = runtime.evidenceSnapshot().recent.find(event => event.source === 'cognitive-resource-economy');
  assert.ok(resourceEvent, 'runtime must publish resource allocator evidence');
  assert.equal(resourceEvent.payload.cognitiveCapacity01, 0.85);
  assert.equal(resourceEvent.payload.ramPressure01, 0.88,
    'resource evidence must preserve measured RAM pressure rather than reusing inverse capacity');
  const expectedScarcity = Math.max(0, Math.min(1,
    (1 - 0.8) * 0.30 +
    (1 - 0.85) * 0.22 +
    0.2 * 0.18 +
    0.88 * 0.14 +
    predictionDebt01 * 0.08,
  ));
  assert.ok(
    Math.abs(runtime.resourceEconomy.snapshot().scarcity01 - expectedScarcity) < 1e-9,
    'actual resource scarcity must use the measured RAM pressure input',
  );

  const first = runtime.cognitiveDependencySnapshot();
  assert.ok(first.lastTick > 0, 'the live runtime cycle must resolve a cognitive dependency frame');
  assert.ok(first.transitionCount >= 0);
  const routingEvent = runtime.evidenceSnapshot().recent.find(event => event.source === 'cognitive-routing-policy');
  assert.ok(routingEvent, 'the live runtime must publish its dependency-informed optional-work policy');
  assert.ok(
    Number(routingEvent.payload.admittedBranchBudget) <= Number(routingEvent.payload.resourceBranchBudget),
    'dependency routing must never expand the resource allocator branch budget',
  );
  assert.equal(typeof routingEvent.payload.allowMatchedCounterfactual, 'boolean');
  assert.ok(
    Number(routingEvent.payload.cognitiveCycleDelayMultiplier01) >= 0.75 &&
    Number(routingEvent.payload.cognitiveCycleDelayMultiplier01) <= 1,
    'cycle cadence adaptation must stay within its declared bound',
  );
  await runtime.stop();
  runtime = undefined;
  const persisted = await new FileStateStore(dependencyStateFile).load();
  assert.deepEqual(persisted, first, 'the routed graph snapshot must be durably flushed at shutdown');

  runtime = new OrganismRuntime(runtimeConfig());
  await runtime.init();
  assert.deepEqual(runtime.cognitiveDependencySnapshot(), first, 'restart must restore the last graph snapshot');
  await runtime.autonomousStep();
  const second = runtime.cognitiveDependencySnapshot();
  assert.ok(second.lastTick > first.lastTick, 'runtime routing time must advance after restart');
  await runtime.stop();
  runtime = undefined;

  console.log('Cognitive dependency graph runtime wiring: PASS');
} finally {
  if (runtime) await runtime.stop().catch(() => {});
  await rm(directory, { recursive: true, force: true });
}
