import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir = await mkdtemp(path.join(tmpdir(), 'nk-durability-window-'));
const file = path.join(dir, 'organism.json');
try {
  const store = new FileStateStore(file);
  const core = new OrganismCore(store, { checkpointMaxDirtyCycles: 3, checkpointMinIntervalMs: 0 });
  await core.init();
  const baseline = await readFile(file, 'utf8');
  const initialTick = core.snapshot().state.tick;

  await core.observe({ text: 'durability hot cycle' });
  const afterHot = await readFile(file, 'utf8');
  assert.equal(afterHot, baseline, 'hot checkpoint must not rewrite durable file');
  assert.ok(core.snapshot().state.tick > initialTick);
  assert.equal(core.persistenceProjectionSnapshot().lastProjectionWasFull, false);

  await core.observe({ text: 'durability second hot cycle' });
  assert.equal(await readFile(file, 'utf8'), baseline, 'second hot checkpoint must remain in-memory');

  await core.observe({ text: 'durability scheduled full cycle' });
  const afterFull = await readFile(file, 'utf8');
  assert.notEqual(afterFull, baseline, 'scheduled full checkpoint must rewrite durable file');
  const persistedAtFull = JSON.parse(afterFull);
  assert.equal(persistedAtFull.state.tick, core.snapshot().state.tick);

  await core.observe({ text: 'durability post-full hot cycle' });
  assert.equal(await readFile(file, 'utf8'), afterFull, 'post-full hot cycle must not rewrite durable file');
  // The post-full call is pressure/interval independent and should be hot; verify the
  // durable tick still reflects the previous full checkpoint, then flush explicitly.
  const hotFile = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(hotFile.state.tick, persistedAtFull.state.tick, 'hot cycle must not advance durable tick');
  await core.flush();
  const afterFlush = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(afterFlush.state.tick, core.snapshot().state.tick, 'flush must close the durability window');
  console.log('PERSISTENCE_DURABILITY_WINDOW=PASS init+hot+full+flush semantics verified');
} finally {
  await rm(dir, { recursive: true, force: true });
}
