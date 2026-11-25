import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { PluginMessageIngress } from '../src/organism/integration/neko/PluginMessageIngress.ts';

const dir = await mkdtemp(path.join(os.tmpdir(), 'nk-neko-receipts-'));
const statePath = path.join(dir, 'plugin-receipts.json');
const request = (messageId, text = 'A durable N.E.K.O. message must not execute twice.') => ({
  identity: { pluginId: 'notes', messageId },
  payload: {
    type: 'MESSAGE_PUSH',
    schema: 'push_message.v2',
    plugin_id: 'notes',
    message_id: messageId,
    time: 1_799_000_000,
    visibility: [],
    ai_behavior: 'respond',
    parts: [{ type: 'text', text }],
    target_lanlan: null,
  },
});

function makeIngress(receiptStore, calls, authorize = async () => true) {
  return new PluginMessageIngress({
    allowedPlugins: ['notes'],
    authorize,
    receiptStore,
    runtime: {
      step: async (text) => {
        calls.steps.push(text);
        return { accepted: true };
      },
    },
  });
}

try {
  const notReadyCalls = { steps: [] };
  const notReady = makeIngress(new FileStateStore(path.join(dir, 'not-ready.json')), notReadyCalls);
  const beforeInitialize = await notReady.handle(request('before-init'));
  assert.equal(beforeInitialize.errorCode, 'receipt-store-not-initialized');
  assert.equal(notReadyCalls.steps.length, 0,
    'a host cannot receive plugin events before its receipt checkpoint is restored');

  const store = new FileStateStore(statePath);
  const firstCalls = { steps: [] };
  const first = makeIngress(store, firstCalls);

  assert.equal(typeof first.initialize, 'function',
    'persistent ingress must expose an explicit restore barrier before accepting plugin messages');
  await first.initialize();

  const originalText = 'A durable N.E.K.O. message must not execute twice.';
  const accepted = await first.handle(request('durable-1', originalText));
  assert.equal(accepted.accepted, true);
  assert.equal(firstCalls.steps.length, 1);

  const saved = await store.load();
  assert.equal(saved?.version, 2, 'receipt snapshots must use the stateful schema');
  assert.equal(saved?.receipts?.length, 1);
  assert.equal(saved.receipts[0].status, 'completed');
  assert.equal(saved.receipts[0].pluginId, 'notes');
  assert.equal(saved.receipts[0].messageId, 'durable-1');
  assert.match(saved.receipts[0].fingerprint, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(saved).includes(originalText),
    'durable receipts must never persist plugin message text');

  const restartedCalls = { steps: [] };
  const restarted = makeIngress(new FileStateStore(statePath), restartedCalls);
  await restarted.initialize();
  const replay = await restarted.handle(request('durable-1', originalText));
  assert.equal(replay.accepted, true);
  assert.equal(replay.replayed, true);
  assert.equal(restartedCalls.steps.length, 0,
    'a completed receipt must survive process restart without repeating cognition');

  const conflict = await restarted.handle(request('durable-1', 'Different content under the same message ID.'));
  assert.equal(conflict.accepted, false);
  assert.equal(conflict.errorCode, 'message-id-conflict');
  assert.equal(restartedCalls.steps.length, 0);

  // Simulate an uncertain write acknowledgement: the pending frame reaches disk,
  // but the host reports a failure before the adapter may start cognition.
  const backing = new FileStateStore(statePath + '.uncertain');
  let failPendingWrite = true;
  const uncertainStore = {
    load: () => backing.load(),
    save: async snapshot => {
      await backing.save(snapshot);
      if (failPendingWrite && snapshot.receipts.some(row => row.status === 'pending')) {
        failPendingWrite = false;
        throw new Error('simulated-uncertain-pending-commit');
      }
    },
  };
  const uncertainCalls = { steps: [] };
  const uncertain = makeIngress(uncertainStore, uncertainCalls);
  await uncertain.initialize();
  const uncertainResult = await uncertain.handle(request('uncertain-1'));
  assert.equal(uncertainResult.accepted, false);
  assert.equal(uncertainResult.errorCode, 'message-recovery-required');
  assert.equal(uncertainCalls.steps.length, 0,
    'an uncertain pending commit must block cognition rather than risk duplicate execution');

  const recoveredCalls = { steps: [] };
  const recovered = makeIngress(backing, recoveredCalls);
  await recovered.initialize();
  const blocked = await recovered.handle(request('uncertain-1'));
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.errorCode, 'message-recovery-required');
  assert.equal(recoveredCalls.steps.length, 0,
    'a restored pending receipt must fail closed until the host reconciles the real outcome');

  const deniedCalls = { steps: [] };
  const denied = makeIngress(new FileStateStore(statePath), deniedCalls, async () => false);
  await denied.initialize();
  const deniedReplay = await denied.handle(request('durable-1', originalText));
  assert.equal(deniedReplay.accepted, false);
  assert.equal(deniedReplay.errorCode, 'policy-denied',
    'current host authorization must still be rechecked before serving a cached receipt');
  assert.equal(deniedCalls.steps.length, 0);

  // v1 snapshots emitted by the early adapter remain readable as completed receipts.
  const legacyText = 'A v1 N.E.K.O. receipt is still a completed receipt.';
  const legacyFingerprint = createHash('sha256').update(JSON.stringify({
    pluginId: 'notes', messageId: 'legacy-1', aiBehavior: 'respond', visibility: [], text: legacyText,
  })).digest('hex');
  const legacyStore = new FileStateStore(path.join(dir, 'legacy-v1.json'));
  await legacyStore.save({ version: 1, receipts: [{
    pluginId: 'notes', messageId: 'legacy-1', fingerprint: legacyFingerprint,
    result: { accepted: true, aiBehavior: 'respond', visibility: [], cognitiveProcessed: true, presented: false, replayed: false },
  }] });
  const legacyCalls = { steps: [] };
  const legacyIngress = makeIngress(legacyStore, legacyCalls);
  await legacyIngress.initialize();
  const legacyReplay = await legacyIngress.handle(request('legacy-1', legacyText));
  assert.equal(legacyReplay.accepted, true);
  assert.equal(legacyReplay.replayed, true);
  assert.equal(legacyCalls.steps.length, 0,
    'migration from the prior v1 checkpoint must not re-run completed cognition');

  const corruptStore = new FileStateStore(path.join(dir, 'corrupt.json'));
  await corruptStore.save({ version: 2, receipts: [{
    pluginId: 'notes', messageId: 'corrupt-1', fingerprint: 'not-a-sha256', status: 'pending',
  }] });
  const corruptIngress = makeIngress(corruptStore, { steps: [] });
  await assert.rejects(() => corruptIngress.initialize(), /neko-message-receipt-row-invalid/);
  assert.equal((await corruptIngress.handle(request('corrupt-1'))).errorCode, 'receipt-store-not-initialized',
    'corrupt receipt state must block ingress instead of silently clearing replay guards');

  console.log('NEKO_PLUGIN_MESSAGE_RECEIPT_PERSISTENCE=PASS cases=9');
} finally {
  await rm(dir, { recursive: true, force: true });
}
