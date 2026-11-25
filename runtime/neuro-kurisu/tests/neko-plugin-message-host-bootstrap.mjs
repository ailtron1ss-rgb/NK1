import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { createFileBackedPluginMessageIngress } from '../src/organism/integration/neko/PluginMessageIngressHost.ts';

const directory = await mkdtemp(path.join(os.tmpdir(), 'nk-neko-host-bootstrap-'));
const receiptFilePath = path.join(directory, 'neko-plugin-receipts.json');
const request = messageId => ({
  identity: { pluginId: 'notes', messageId },
  payload: {
    type: 'MESSAGE_PUSH',
    schema: 'push_message.v2',
    plugin_id: 'notes',
    message_id: messageId,
    time: 1_799_000_000,
    visibility: [],
    ai_behavior: 'respond',
    parts: [{ type: 'text', text: 'Host bootstrap must restore the durable replay boundary.' }],
    target_lanlan: null,
  },
});
const options = (calls, overrides = {}) => ({
  receiptFilePath,
  allowedPlugins: ['notes'],
  authorize: async () => true,
  runtime: {
    step: async text => {
      calls.push(text);
      return { accepted: true };
    },
  },
  ...overrides,
});

try {
  const firstCalls = [];
  const ingress = await createFileBackedPluginMessageIngress(options(firstCalls));
  assert.equal(ingress.receiptDiagnostics().initialized, true,
    'the host bootstrap must resolve only after the receipt store restore barrier');
  const accepted = await ingress.handle(request('host-bootstrap-1'));
  assert.equal(accepted.accepted, true);
  assert.equal(firstCalls.length, 1);

  const secondCalls = [];
  const restarted = await createFileBackedPluginMessageIngress(options(secondCalls));
  const replay = await restarted.handle(request('host-bootstrap-1'));
  assert.equal(replay.accepted, true);
  assert.equal(replay.replayed, true);
  assert.equal(secondCalls.length, 0,
    'a host restart must not repeat cognition for a completed durable receipt');

  await assert.rejects(
    () => createFileBackedPluginMessageIngress(options([], { receiptFilePath: 'relative-receipts.json' })),
    /neko-message-ingress-receipt-path-must-be-absolute/,
  );

  const corruptPath = path.join(directory, 'corrupt-receipts.json');
  await new FileStateStore(corruptPath).save({ version: 99, receipts: [] });
  await assert.rejects(
    () => createFileBackedPluginMessageIngress(options([], { receiptFilePath: corruptPath })),
    /neko-message-receipt-snapshot-invalid/,
    'a corrupt checkpoint must prevent the host bootstrap from returning an ingress',
  );

  console.log('NEKO_PLUGIN_MESSAGE_HOST_BOOTSTRAP=PASS cases=4');
} finally {
  await rm(directory, { recursive: true, force: true });
}
