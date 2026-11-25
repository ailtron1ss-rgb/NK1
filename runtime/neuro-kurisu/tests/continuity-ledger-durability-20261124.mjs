import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ContinuityLedger } from '../src/organism/system/ContinuityLedger.ts';

const directory = await mkdtemp(path.join(os.tmpdir(), 'nk1-continuity-ledger-'));
test.after(async () => rm(directory, { recursive: true, force: true }));

const makeFrame = (tick, action = 'action-' + tick) => ({
  at: 1_800_000_000_000 + tick,
  tick,
  stage: 'reflect',
  action,
  energy01: 0.8,
  uncertainty01: 0.2,
  predictionError01: 0.1,
  selfPredictionError01: 0.05,
  identityContinuity01: 0.99,
  memoryCount: 100 + tick,
  goalCount: 3,
  stateBytes: 4096,
  replaySignature: 'replay-' + tick,
});

test('preserves records appended during an active flush', async () => {
  const file = path.join(directory, 'concurrent.jsonl');
  const ledger = new ContinuityLedger(file, 1024 * 1024, 4);
  try {
    await ledger.record(makeFrame(1));
    await ledger.record(makeFrame(2));
    await ledger.record(makeFrame(3));
    const thresholdFlush = ledger.record(makeFrame(4));
    const lateRecord = ledger.record(makeFrame(5));
    await thresholdFlush;
    await lateRecord;
    await ledger.flush();
    const lines = (await readFile(file, 'utf8')).trimEnd().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(lines.map(row => row.tick), [1, 2, 3, 4, 5]);
  } finally { await ledger.close(); }
});

test('recovers a torn final JSONL fragment before appending', async () => {
  const file = path.join(directory, 'torn-tail.jsonl');
  const valid = [makeFrame(10), makeFrame(11)].map(row => JSON.stringify(row)).join('\n') + '\n';
  const tornTail = '{"at":1800000000000,"tick":12,"action":"torn';
  await writeFile(file, valid + tornTail);
  const ledger = new ContinuityLedger(file, 1024 * 1024, 1);
  try {
    await ledger.record(makeFrame(13));
    const raw = await readFile(file, 'utf8');
    const lines = raw.trimEnd().split('\n');
    assert.equal(lines.length, 3, 'startup recovery must remove only the incomplete trailing fragment');
    assert.deepEqual(lines.map(line => JSON.parse(line).tick), [10, 11, 13]);
    assert.equal(ledger.diagnostics().recoveredTailBytes, Buffer.byteLength(tornTail),
      'the recovery diagnostic must report exactly the discarded torn tail bytes');
  } finally { await ledger.close(); }
});

test('retains recent complete frames when the bounded ledger reaches capacity', async () => {
  const file = path.join(directory, 'bounded.jsonl');
  const ledger = new ContinuityLedger(file, 64 * 1024, 1);
  const largeAction = 'continuity-frame-'.repeat(560);
  try {
    for (let tick = 1; tick <= 9; tick += 1) {
      await ledger.record(makeFrame(tick, tick + ':' + largeAction));
    }
    await ledger.flush();
    const raw = await readFile(file, 'utf8');
    const info = await stat(file);
    const lines = raw.trimEnd().split('\n');
    const frames = lines.map(line => JSON.parse(line));
    assert.ok(info.size <= 64 * 1024, 'retained ledger must stay bounded, got ' + info.size + ' bytes');
    assert.ok(frames.length >= 1, 'bounded retention must preserve at least one complete recent frame');
    assert.equal(frames.at(-1).tick, 9, 'the latest committed frame must survive retention compaction');
    assert.ok(frames.every(frame => Number.isSafeInteger(frame.tick)), 'every retained line must be valid JSON');
    assert.ok(ledger.diagnostics().retentionDroppedFrames > 0, 'retention compaction must report discarded old frames');
  } finally { await ledger.close(); }
});

test('rejects a single frame that cannot fit in the bounded journal', async () => {
  const file = path.join(directory, 'oversized.jsonl');
  const ledger = new ContinuityLedger(file, 64 * 1024, 1);
  try {
    await assert.rejects(() => ledger.record(makeFrame(100, 'x'.repeat(70 * 1024))),
      /continuity-ledger-frame-exceeds-max-bytes/);
    assert.equal(ledger.diagnostics().pendingLines, 0);
    assert.equal(ledger.metrics().frames, 0);
  } finally { await ledger.close(); }
});

console.log('CONTINUITY_LEDGER_DURABILITY=PASS');
