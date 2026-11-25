import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHAT_CACHE_KEY,
  PROACTIVE_ACKED_CACHE_KEY,
  persistChatBeforeAcknowledge,
  retryPersistedProactiveAcks,
} from '../src/organism/chatCache.ts';

const initiativeId = 'soc:100:1:share-thought';
const chat = [
  { id: 'ui-user-1', role: 'user', text: 'hello' },
  { id: `ui-initiative-${initiativeId}`, role: 'kurisu', text: 'a proactive thought', backend: 'autonomous-initiative:share-thought' },
];

function storage(onWrite = undefined) {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { onWrite?.(key, value); values.set(key, String(value)); },
  };
}

test('the proactive turn is stored before a positive server ACK is recorded', async () => {
  const target = storage();
  let ackCount = 0;
  const result = await persistChatBeforeAcknowledge(target, chat, initiativeId, async id => {
    ackCount += 1;
    assert.equal(id, initiativeId);
    assert.deepEqual(JSON.parse(target.values.get(CHAT_CACHE_KEY)), chat);
    return { ok: true, acknowledged: true };
  });
  assert.equal(result, true);
  assert.equal(ackCount, 1);
  assert.deepEqual(JSON.parse(target.values.get(PROACTIVE_ACKED_CACHE_KEY)), [initiativeId]);
});

test('a local storage failure prevents the server ACK', async () => {
  const target = storage(key => { if (key === CHAT_CACHE_KEY) throw new Error('storage quota exceeded'); });
  let ackCount = 0;
  const result = await persistChatBeforeAcknowledge(target, chat, initiativeId, async () => {
    ackCount += 1;
    return { ok: true, acknowledged: true };
  });
  assert.equal(result, false);
  assert.equal(ackCount, 0);
});

test('a lost ACK response is retried from the already persisted stable chat turn', async () => {
  const target = storage();
  let ackCount = 0;
  const first = await persistChatBeforeAcknowledge(target, chat, initiativeId, async () => {
    ackCount += 1;
    throw new Error('response lost after transcript persistence');
  });
  assert.equal(first, false);
  const durableChat = JSON.parse(target.values.get(CHAT_CACHE_KEY));
  const repaired = await retryPersistedProactiveAcks(target, durableChat, async id => {
    ackCount += 1;
    assert.equal(id, initiativeId);
    return { ok: true, acknowledged: true };
  });
  assert.equal(repaired, 1);
  assert.equal(ackCount, 2);
  assert.deepEqual(JSON.parse(target.values.get(PROACTIVE_ACKED_CACHE_KEY)), [initiativeId]);
});

test('a negative ACK response remains pending and succeeds on retry', async () => {
  const target = storage();
  const first = await persistChatBeforeAcknowledge(target, chat, initiativeId, async () => ({ ok: true, acknowledged: false }));
  assert.equal(first, false);
  let calls = 0;
  const repaired = await retryPersistedProactiveAcks(target, JSON.parse(target.values.get(CHAT_CACHE_KEY)), async () => {
    calls += 1;
    return { ok: true, acknowledged: true };
  });
  assert.equal(repaired, 1);
  assert.equal(calls, 1);
});

test('an acknowledged initiative is not retried on every idle poll', async () => {
  const target = storage();
  await persistChatBeforeAcknowledge(target, chat, initiativeId, async () => ({ ok: true, acknowledged: true }));
  let calls = 0;
  assert.equal(await retryPersistedProactiveAcks(target, chat, async () => {
    calls += 1;
    return { ok: true, acknowledged: true };
  }), 0);
  assert.equal(calls, 0);
});
