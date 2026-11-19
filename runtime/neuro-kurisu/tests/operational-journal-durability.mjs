import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OperationalJournal } from '../src/organism/persistence/OperationalJournal.ts';

async function withTempDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), 'nk1-operational-journal-'));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test('concurrent writes preserve invocation order and flush waits for completion', async () => {
  await withTempDirectory(async directory => {
    const path = join(directory, 'nested', 'runtime.jsonl');
    const journal = new OperationalJournal(path);
    const pendingWrites = Array.from({ length: 40 }, (_, index) => journal.write('info', `tick.${index}`, { index }));
    await journal.flush();
    await Promise.all(pendingWrites);
    const rows = (await readFile(path, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(rows.map(row => row.data.index), Array.from({ length: 40 }, (_, index) => index));
  });
});

test('warning, error and critical lifecycle events are fsynced while ordinary ticks are not', async () => {
  await withTempDirectory(async directory => {
    const journal = new OperationalJournal(join(directory, 'runtime.jsonl'));
    await journal.write('info', 'runtime.step', { tick: 1 });
    await journal.write('info', 'runtime.stop.durable', { tick: 1 });
    await journal.write('warn', 'runtime.degraded', { tick: 2 });
    await journal.write('error', 'runtime.failed', { tick: 3 });
    await journal.flush();
    assert.equal(journal.metrics().fsyncs, 3);
    assert.equal(journal.metrics().writes, 4);
    const metrics = journal.metrics();
    metrics.writes = 999;
    assert.equal(journal.metrics().writes, 4, 'metrics must be returned as a defensive copy');
  });
});

test('rotation accounts for the incoming record and retains a bounded prior segment', async () => {
  await withTempDirectory(async directory => {
    const path = join(directory, 'runtime.jsonl');
    const journal = new OperationalJournal(path, { maxBytes: 180, maxRotations: 1 });
    await journal.write('info', 'event.one', { text: 'x'.repeat(45) });
    await journal.write('info', 'event.two', { text: 'y'.repeat(45) });
    await journal.write('info', 'event.three', { text: 'z'.repeat(45) });
    await journal.flush();
    const current = await readFile(path, 'utf8');
    const rotated = await readFile(`${path}.1`, 'utf8');
    assert.match(current, /event\.three/);
    assert.match(rotated, /event\.two/);
    assert.ok((await stat(path)).size <= 180);
    assert.equal(journal.metrics().rotations, 2);
  });
});

test('a failed serialization does not poison later queued writes', async () => {
  await withTempDirectory(async directory => {
    const path = join(directory, 'runtime.jsonl');
    const journal = new OperationalJournal(path);
    await assert.rejects(journal.write('info', 'event.bad', { unsupported: 1n }));
    await journal.write('info', 'event.good', { ok: true });
    await journal.flush();
    const rows = (await readFile(path, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(rows.map(row => row.event), ['event.good']);
  });
});

test('strict directory fsync is performed for a durable record', async () => {
  await withTempDirectory(async directory => {
    const journal = new OperationalJournal(join(directory, 'runtime.jsonl'), {
      syncLevels: ['info'], strictDirectoryFsync: true,
    });
    await journal.write('info', 'runtime.stop.durable', { tick: 4 });
    await journal.flush();
    assert.equal(journal.metrics().fsyncs, 1);
    assert.equal(journal.metrics().directoryFsyncs, 1);
  });
});

test('multi-segment rotation keeps the newest bounded history in order', async () => {
  await withTempDirectory(async directory => {
    const path = join(directory, 'runtime.jsonl');
    const journal = new OperationalJournal(path, { maxBytes: 180, maxRotations: 2 });
    for (let index = 1; index <= 4; index += 1) {
      await journal.write('info', `event.${index}`, { text: String(index).repeat(45) });
    }
    await journal.flush();
    const current = await readFile(path, 'utf8');
    const rotated1 = await readFile(`${path}.1`, 'utf8');
    const rotated2 = await readFile(`${path}.2`, 'utf8');
    assert.match(current, /event\.4/);
    assert.match(rotated1, /event\.3/);
    assert.match(rotated2, /event\.2/);
    assert.equal(journal.metrics().rotations, 3);
  });
});
