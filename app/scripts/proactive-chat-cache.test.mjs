import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { persistChatBeforeAcknowledge, restoreChatCache } from '../src/organism/chatCache.ts';

const chat = [
  { id: 'u-1', role: 'user', text: 'hello', at: 1_000, tick: 1 },
  { id: 'ui-initiative-soc-1', role: 'kurisu', text: 'a proactive thought', at: 1_001, tick: 1, option: 'reflect' },
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
  const gate = source.lastIndexOf('persistChatBeforeAcknowledge(');
  const acknowledgement = source.indexOf('ackProactiveMessage(initiative.id, initiative.deliveryToken)', gate);
  assert.ok(gate >= 0 && acknowledgement > gate,
    'the proactive ACK call must use the current attempt token inside the storage-before-ACK gate');
  assert.ok(source.includes('!initiative.deliveryToken'),
    'the client must not surface a claimed initiative without its lease token');
});


test('a negative server ACK is not mistaken for a completed delivery', async () => {
  const target = storage();
  const result = await persistChatBeforeAcknowledge(target, chat, async () => ({
    ok: true,
    acknowledged: false,
  }));
  assert.equal(result, false,
    'a lease-expired or policy-rejected ACK must remain retryable');
});

test('an incomplete ACK response is not treated as a delivery receipt', async () => {
  const target = storage();
  const result = await persistChatBeforeAcknowledge(target, chat, async () => ({ ok: true }));
  assert.equal(result, false,
    'only an explicit positive server receipt may complete the delivery transaction');
});


test('chat restoration drops malformed or unsafe local-cache records', () => {
  const restored = restoreChatCache(JSON.stringify([
    { id: 'valid-1', role: 'user', text: 'hello', at: 10, tick: 2 },
    { id: 'bad-role', role: 'system', text: 'not a chat turn', at: 11, tick: 2 },
    { id: 'bad-text', role: 'kurisu', text: { html: '<script>' }, at: 12, tick: 2 },
    { id: 'bad-clock', role: 'kurisu', text: 'invalid time', at: 'now', tick: 2 },
    null,
  ]));
  assert.deepEqual(restored, [
    { id: 'valid-1', role: 'user', text: 'hello', at: 10, tick: 2 },
  ]);
});

test('corrupt or non-array chat cache data restores as an empty transcript', () => {
  assert.deepEqual(restoreChatCache('{broken'), []);
  assert.deepEqual(restoreChatCache(JSON.stringify({ turns: [] })), []);
});


test('chat restoration deduplicates stable proactive turn IDs', () => {
  const restored = restoreChatCache(JSON.stringify([
    { id: 'same-id', role: 'kurisu', text: 'first delivery copy', at: 10, tick: 1 },
    { id: 'same-id', role: 'kurisu', text: 'duplicate retry copy', at: 10, tick: 1 },
    { id: 'next-id', role: 'user', text: 'follow-up', at: 11, tick: 2 },
  ]));
  assert.deepEqual(restored.map((turn) => turn.id), ['same-id', 'next-id']);
  assert.equal(restored[0].text, 'first delivery copy',
    'the first committed turn remains canonical across duplicate retries');
});


test('chat restoration strips actual control characters from untrusted text', () => {
  const restored = restoreChatCache(JSON.stringify([
    { id: 'control-1', role: 'kurisu', text: 'left\\u0000middle\\u001Fright\\u007F', at: 20, tick: 3 },
  ]));
  assert.equal(restored[0].text, 'leftmiddleright');
});

test('chat restoration rejects an oversized serialized cache before parsing', () => {
  assert.deepEqual(restoreChatCache(' '.repeat(1_750_001)), []);
});

console.log('PROACTIVE_CHAT_DURABLE_ACK=PASS');
