import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
  await runtime.autonomousStep();

  const first = runtime.cognitiveDependencySnapshot();
  assert.ok(first.lastTick > 0, 'the live runtime cycle must resolve a cognitive dependency frame');
  assert.ok(first.transitionCount >= 0);
  const persisted = await new FileStateStore(dependencyStateFile).load();
  assert.deepEqual(persisted, first, 'the routed graph snapshot must be durably written after a cycle');
  const serialized = await readFile(dependencyStateFile, 'utf8');
  assert.equal(JSON.parse(serialized).lastTick, first.lastTick);

  await runtime.stop();
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
