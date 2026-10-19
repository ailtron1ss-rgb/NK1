import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir = await mkdtemp(path.join(tmpdir(), 'nk-p2869-'));
try {
  const file = path.join(dir, 'state.json');
  const store = new FileStateStore(file, { backupEverySaves: 2 });
  const value = { tick: 4, identity: 'kurisu-self-core', latent: [0.1, 0.2, 0.3] };
  await store.save(value);
  const first = store.metrics();
  const firstPayload = await readFile(file, 'utf8');
  await store.save(value);
  const second = store.metrics();
  const secondPayload = await readFile(file, 'utf8');
  assert.equal(second.saves, first.saves, 'unchanged checkpoint performed a redundant durable write');
  assert.equal(second.bytesWritten, first.bytesWritten, 'unchanged checkpoint changed durable byte count');
  assert.equal(second.skippedUnchangedSaves, first.skippedUnchangedSaves + 1);
  assert.equal(secondPayload, firstPayload);
  await store.save({ ...value, tick: 5 });
  const third = store.metrics();
  assert.equal(third.saves, first.saves + 1, 'changed checkpoint was incorrectly suppressed');
  const restarted = new FileStateStore(file);
  const loaded = await restarted.load();
  assert.equal(loaded.tick, 5, 'deduplicated store broke restart loading');
  console.log(`P2869_DURABLE_CHECKPOINT_DEDUP=PASS writes=${third.saves} skipped=${third.skippedUnchangedSaves} payloadBytes=${third.lastPayloadBytes}`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
