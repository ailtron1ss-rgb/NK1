import test from 'node:test';
import assert from 'node:assert/strict';
import { neuroApi } from '../../../app/src/neuro-kurisu/api.ts';
import { decideActionApproval, getActionApprovalSnapshot } from '../../../app/src/neuro-kurisu/action-approval-broker.ts';

function makeChallenge(id = 'approval-api-workpass54') {
  return new Response(JSON.stringify({
    ok: false,
    approvalRequired: true,
    error: 'user-approval-required',
    approvalRequest: {
      id, toolId: 'http.voice.speak', permissionClass: 'device', operation: 'direct',
      reasonCode: 'voice-output', createdAt: Date.now(), expiresAt: Date.now() + 60_000,
      inputKeys: ['text'], inputPreview: { text: 'sensitive speech text is deliberately masked by runtime' },
    },
  }), { status: 403, headers: { 'content-type': 'application/json' } });
}

const originalFetch = globalThis.fetch;
test('API request awaits owner approval and replays the original JSON body exactly once', async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
    if (calls.length === 1) return makeChallenge();
    if (String(url).includes('/tools/permissions/resolve')) {
      assert.deepEqual(calls.at(-1).body, { requestId: 'approval-api-workpass54', approved: true });
      return new Response(JSON.stringify({ ok: true, request: { status: 'approved' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true, spoken: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const pending = neuroApi.voiceSpeak('hello from the exact captured request');
    await new Promise((resolve) => setImmediate(resolve));
    const card = getActionApprovalSnapshot().find((row) => row.id === 'approval-api-workpass54');
    assert.ok(card, 'structured 403 must become a visible approval card');
    assert.equal(card.stage, 'pending');
    await decideActionApproval(card.id, true);
    assert.deepEqual(await pending, { ok: true, spoken: true });
    assert.equal(calls.length, 3, 'one challenge, one permission resolve and one action retry');
    assert.deepEqual(calls[0].body, { text: 'hello from the exact captured request' });
    assert.deepEqual(calls[2].body, { text: 'hello from the exact captured request', approvalId: 'approval-api-workpass54' });
    assert.equal(calls[2].url, calls[0].url);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('decline resolves the ticket but never retries the original side effect', async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
    if (calls.length === 1) return makeChallenge('approval-api-decline-workpass54');
    return new Response(JSON.stringify({ ok: true, request: { status: 'declined' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const pending = neuroApi.voiceSpeak('do not speak this without consent');
    await new Promise((resolve) => setImmediate(resolve));
    await decideActionApproval('approval-api-decline-workpass54', false);
    await assert.rejects(pending, /declined by the owner/);
    assert.equal(calls.length, 2, 'decline must not send a second request to the protected endpoint');
    assert.ok(calls[1].url.includes('/tools/permissions/resolve'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('malformed or out-of-contract expiry never becomes an approval card', async () => {
  const id = 'approval-api-invalid-expiry-workpass54';
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false,
    approvalRequired: true,
    error: 'user-approval-required',
    approvalRequest: {
      id, toolId: 'http.voice.speak', permissionClass: 'device', operation: 'direct',
      reasonCode: 'voice-output', createdAt: Date.now(), expiresAt: Date.now() + 6 * 60_000,
      inputKeys: ['text'], inputPreview: { text: '[redacted]' },
    },
  }), { status: 403, headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(neuroApi.voiceSpeak('do not enqueue a malformed ticket'), /user-approval-required/);
    assert.equal(getActionApprovalSnapshot().some((row) => row.id === id), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
