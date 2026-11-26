import assert from 'node:assert/strict';
import {
  authorizeNekoPluginTransport,
  parseNekoPluginCredentials,
} from '../src/server/neko-plugin-transport-auth.mjs';

const notesToken = 'NK1-notes-plugin-secret-'.padEnd(48, 'N');
const calendarToken = 'NK1-calendar-plugin-secret-'.padEnd(48, 'C');
const credentials = parseNekoPluginCredentials(JSON.stringify({
  notes: notesToken,
  calendar: calendarToken,
}));

assert.equal(parseNekoPluginCredentials('').size, 0,
  'an unset credential map disables N.E.K.O. transport without weakening another ingress path');
assert.equal(credentials.size, 2);

const identity = { pluginId: 'notes', messageId: 'message-0001' };
const payload = {
  type: 'MESSAGE_PUSH',
  schema: 'push_message.v2',
  plugin_id: 'notes',
  message_id: 'message-0001',
  ai_behavior: 'read',
  visibility: [],
  parts: [{ type: 'text', text: 'A bounded evidence-only plugin observation.' }],
};
const valid = authorizeNekoPluginTransport({
  credentials,
  pluginIdHeader: 'notes',
  tokenHeader: notesToken,
  identity,
  payload,
});
assert.deepEqual(valid, { allowed: true, pluginId: 'notes' });

assert.deepEqual(authorizeNekoPluginTransport({
  credentials,
  pluginIdHeader: 'notes',
  tokenHeader: 'wrong-token'.padEnd(notesToken.length, 'x'),
  identity,
  payload,
}), { allowed: false }, 'wrong token must fail');

assert.deepEqual(authorizeNekoPluginTransport({
  credentials,
  pluginIdHeader: 'calendar',
  tokenHeader: calendarToken,
  identity,
  payload,
}), { allowed: false }, 'the header ID must match both envelope identity layers');

assert.deepEqual(authorizeNekoPluginTransport({
  credentials,
  pluginIdHeader: 'notes',
  tokenHeader: notesToken,
  identity: { ...identity, pluginId: 'calendar' },
  payload,
}), { allowed: false }, 'transport identity cannot be reassigned by the request body');

assert.deepEqual(authorizeNekoPluginTransport({
  credentials,
  pluginIdHeader: 'unknown',
  tokenHeader: notesToken,
  identity: { ...identity, pluginId: 'unknown' },
  payload: { ...payload, plugin_id: 'unknown' },
}), { allowed: false }, 'unknown plugin IDs are denied');

assert.deepEqual(authorizeNekoPluginTransport({
  credentials,
  pluginIdHeader: 'notes',
  tokenHeader: notesToken,
  identity,
  payload: { ...payload, plugin_id: 'calendar' },
}), { allowed: false }, 'payload plugin identity must equal the authenticated header');

assert.throws(() => parseNekoPluginCredentials('{bad-json'),
  /neko-plugin-credentials-json-invalid/);
assert.throws(() => parseNekoPluginCredentials(JSON.stringify({ notes: 'short' })),
  /neko-plugin-credential-entry-invalid/);
assert.throws(() => parseNekoPluginCredentials(JSON.stringify(['not-a-map'])),
  /neko-plugin-credentials-map-invalid/);

console.log('NEKO_PLUGIN_TRANSPORT_AUTH=PASS cases=10');
