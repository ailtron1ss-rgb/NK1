import assert from 'node:assert/strict';
import { appendFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { OperationalJournal } from '../src/organism/persistence/OperationalJournal.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-journal-cursor-'));
test.after(async () => rm(root, { recursive: true, force: true }));

const sha256 = value => createHash('sha256').update(value).digest('hex');

test('exposes a durable cursor after all earlier appends', async () => {
  const file = path.join(root, 'cursor.jsonl');
  const journal = new OperationalJournal(file, { maxBytes: 4096, maxRotations: 2 });
  await journal.write('info', 'cursor.first', { ordinal: 1 });
  await journal.write('warn', 'cursor.second', { ordinal: 2 });

  assert.equal(typeof journal.cursor, 'function', 'OperationalJournal must expose cursor()');
  const cursor = await journal.cursor();
  const raw = await readFile(file, 'utf8');
  const lines = raw.trimEnd().split('\n');

  assert.equal(cursor.version, 1);
  assert.equal(cursor.retainedSegments, 1);
  assert.equal(cursor.retainedBytes, Buffer.byteLength(raw));
  assert.equal(cursor.activeSegmentBytes, Buffer.byteLength(raw));
  assert.equal(cursor.activeSegmentRecords, 2);
  assert.equal(cursor.activeSegmentId, sha256(lines[0]));
  assert.equal(cursor.activeSegmentTailSha256, sha256(lines[1]));
  assert.equal(cursor.fileSynced, true);
  assert.equal(typeof cursor.directorySynced, 'boolean');
  assert.ok(journal.metrics().fsyncs >= 2);
});

test('places the cursor between writes queued before and after it', async () => {
  const file = path.join(root, 'ordered.jsonl');
  const journal = new OperationalJournal(file, { maxBytes: 4096, maxRotations: 2, syncLevels: [] });
  const before = journal.write('info', 'cursor.before');
  const cursorPromise = journal.cursor();
  const after = journal.write('info', 'cursor.after');
  const cursor = await cursorPromise;
  await Promise.all([before, after]);

  const lines = (await readFile(file, 'utf8')).trimEnd().split('\n');
  assert.equal(cursor.activeSegmentRecords, 1);
  assert.equal(cursor.activeSegmentTailSha256, sha256(lines[0]));
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).event, 'cursor.before');
  assert.equal(JSON.parse(lines[1]).event, 'cursor.after');
});

test('refuses to checkpoint a torn final JSONL fragment', async () => {
  const file = path.join(root, 'torn.jsonl');
  const journal = new OperationalJournal(file, { maxBytes: 4096, maxRotations: 1 });
  await journal.write('info', 'cursor.complete');
  await appendFile(file, '{"partial":', 'utf8');
  await assert.rejects(() => journal.cursor(), /operational-journal-cursor-incomplete-tail/);
});

test('reports retained rotated segments without losing the active segment cursor', async () => {
  const file = path.join(root, 'rotated.jsonl');
  const journal = new OperationalJournal(file, { maxBytes: 180, maxRotations: 2, syncLevels: [] });
  for (let index = 0; index < 8; index += 1) {
    await journal.write('info', 'cursor.rotate.' + index, { padding: 'x'.repeat(80) });
  }

  const cursor = await journal.cursor();
  assert.ok(journal.metrics().rotations >= 1);
  assert.ok(cursor.retainedSegments >= 2);
  assert.ok(cursor.retainedSegments <= 3);
  assert.ok(cursor.retainedBytes >= cursor.activeSegmentBytes);
  assert.ok(cursor.activeSegmentRecords >= 1);
  assert.match(cursor.activeSegmentId, /^[a-f0-9]{64}$/);
  assert.match(cursor.activeSegmentTailSha256, /^[a-f0-9]{64}$/);
});

console.log('OPERATIONAL_JOURNAL_CURSOR=PASS');
