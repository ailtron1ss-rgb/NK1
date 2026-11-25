import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { persistChatBeforeAcknowledge } from '../src/organism/chatCache.ts';

const chat = [
  { id: 'u-1', role: 'user', text: 'hello' },
  { id: 'ui-initiative-soc-1', role: 'kurisu', text: 'a proactive thought' },
];

function storage(write) {
  const values = new Map();
  return {
    values,
    setItem(key, value) {
      write?.();
      values.set(key, String(value));
    },
  };
}

test('a proactive message is ACKed only after its chat transcript is durably stored', async () => {
  const target = storage();
  let ackCount = 0;
  const result = await persistChatBeforeAcknowledge(target, chat, async () => {
    ackCount += 1;
    return { ok: true, acknowledged: true };
  });
  assert.equal(result, true);
  assert.equal(ackCount, 1);
  const persisted = JSON.parse(target.values.get('neuro-kurisu-chat-v2'));
  assert.deepEqual(persisted, chat);
});

test('a local-storage write failure prevents the server ACK and allows lease-based retry', async () => {
  const target = storage(() => { throw new Error('storage quota exceeded'); });
  let ackCount = 0;
  const result = await persistChatBeforeAcknowledge(target, chat, async () => {
    ackCount += 1;
    return { ok: true, acknowledged: true };
  });
  assert.equal(result, false);
  assert.equal(ackCount, 0);
});

test('an ACK transport failure leaves the already stored message safe for idempotent retry', async () => {
  const target = storage();
  let ackCount = 0;
  const result = await persistChatBeforeAcknowledge(target, chat, async () => {
    ackCount += 1;
    throw new Error('connection lost after local persistence');
  });
  assert.equal(result, false);
  assert.equal(ackCount, 1);
  assert.deepEqual(JSON.parse(target.values.get('neuro-kurisu-chat-v2')), chat);
});

test('the production store routes proactive ACK through the durable persistence gate', async () => {
  const source = await readFile(new URL('../src/organism/store.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('persistChatBeforeAcknowledge'));
  const gate = source.indexOf('persistChatBeforeAcknowledge');
  const acknowledgement = source.indexOf('ackProactiveMessage(initiative.id)');
  assert.ok(gate >= 0 && acknowledgement > gate,
    'the proactive ACK call must happen inside the storage-before-ACK gate');
});

console.log('PROACTIVE_CHAT_DURABLE_ACK=PASS');
