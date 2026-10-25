import assert from 'node:assert/strict';
import { appendFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OperationalJournal } from '../src/organism/persistence/OperationalJournal.ts';

const directory = await mkdtemp(join(tmpdir(), 'nk1-dialogue-receipt-journal-'));
const filePath = join(directory, 'runtime.operational.jsonl');
try {
  const journal = new OperationalJournal(filePath);
  await journal.write('info', 'runtime.internal-dialogue.review', {
    schemaVersion: 1, tick: 17, status: 'provisional', advisoryOnly: true,
    unresolvedQuestions: ['A gap remains after independent review'],
  });
  await journal.write('info', 'runtime.step', { tick: 18, action: 'verify' });
  await journal.write('info', 'runtime.internal-dialogue.review', {
    schemaVersion: 1, tick: 19, status: 'reviewed', advisoryOnly: true,
    unresolvedQuestions: [],
  });

  // A torn or malformed final line must not hide valid earlier receipts.
  await appendFile(filePath, '{"at":broken,"event":"runtime.internal-dialogue.review"}\n', 'utf8');

  const rows = await journal.readRecent('runtime.internal-dialogue.review', 10);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].data?.tick, 19, 'most recent receipt should be returned first');
  assert.equal(rows[1].data?.tick, 17);
  assert.ok(rows.every(row => row.event === 'runtime.internal-dialogue.review'));

  const limited = await journal.readRecent('runtime.internal-dialogue.review', 1);
  assert.equal(limited.length, 1);
  assert.equal(limited[0].data?.tick, 19, 'limit must preserve newest valid receipt');
  assert.deepEqual(await journal.readRecent('not-an-event', 16), []);
  assert.deepEqual(await journal.readRecent('', 16), []);

  // Returned data is a copy, not a mutable alias to the reader's internal result.
  const mutable = await journal.readRecent('runtime.internal-dialogue.review', 1);
  (mutable[0].data as any).tick = -1;
  assert.equal((await journal.readRecent('runtime.internal-dialogue.review', 1))[0].data?.tick, 19);
  console.log('NK1_INTERNAL_DIALOGUE_RECEIPT_JOURNAL=PASS malformed-tail=true event-filter=true bounded-latest=true');
} finally {
  await rm(directory, { recursive: true, force: true });
}
