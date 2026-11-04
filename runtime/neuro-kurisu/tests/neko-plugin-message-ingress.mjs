import assert from 'node:assert/strict';
import { PluginMessageIngress } from '../src/organism/integration/neko/PluginMessageIngress.ts';
import { externalGoalForRuntimeInput, shouldInvokeLanguageForRuntimeStep } from '../src/organism/core/RuntimeInputPolicy.ts';

const base = (overrides = {}) => ({
  type: 'MESSAGE_PUSH',
  schema: 'push_message.v2',
  plugin_id: 'notes',
  message_id: 'message-1',
  time: 1_799_000_000,
  visibility: [],
  ai_behavior: 'respond',
  parts: [{ type: 'text', text: 'Summarize the latest memory evidence.' }],
  source: 'plugin-controlled-source',
  priority: 3,
  coalesce_key: 'memory-summary',
  metadata: { task_id: 'task-1', target_lanlan: null },
  target_lanlan: null,
  ...overrides,
});

function harness(options = {}) {
  const calls = { authorized: [], steps: [], presentations: [] };
  const ingress = new PluginMessageIngress({
    allowedPlugins: ['notes'],
    authorize: async context => { calls.authorized.push(context); return true; },
    runtime: {
      step: async (text, runtimeOptions) => {
        calls.steps.push({ text, options: runtimeOptions });
        return { accepted: true };
      },
    },
    present: async presentation => { calls.presentations.push(presentation); },
    ...options,
  });
  return { ingress, calls };
}

// The canonical N.E.K.O. envelope must enter NK1's runtime as a bounded plugin observation,
// never as an externally authored goal; provenance is bound to authenticated transport identity.
{
  const { ingress, calls } = harness();
  const result = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'message-1' },
    payload: base({ visibility: ['chat', 'hud'] }),
  });
  assert.equal(result.accepted, true);
  assert.equal(result.aiBehavior, 'respond');
  assert.equal(calls.steps.length, 1);
  assert.equal(calls.steps[0].text, 'Summarize the latest memory evidence.');
  assert.equal(calls.steps[0].options.deliberate, true);
  assert.equal(calls.steps[0].options.suppressResponse, false);
  assert.equal(calls.steps[0].options.externalGoalPolicy, 'evidence-only');
  assert.deepEqual(calls.steps[0].options.externalSource, {
    kind: 'neko-plugin', pluginId: 'notes', messageId: 'message-1',
  });
  assert.equal(calls.presentations.length, 1);
  assert.deepEqual(calls.presentations[0].visibility, ['chat', 'hud']);
  assert.equal(calls.presentations[0].text, 'Summarize the latest memory evidence.');
  assert.equal(calls.presentations[0].pluginId, 'notes');
}

// "read" enters cognitive context but cannot trigger an immediate generated response.
{
  const { ingress, calls } = harness();
  const result = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'read-1' },
    payload: base({ message_id: 'read-1', ai_behavior: 'read' }),
  });
  assert.equal(result.accepted, true);
  assert.equal(calls.steps.length, 1);
  assert.equal(calls.steps[0].options.deliberate, false);
  assert.equal(calls.steps[0].options.suppressResponse, true);
}

// "blind" is display-only; the LLM/runtime must never receive its text.
{
  const { ingress, calls } = harness();
  const result = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'blind-1' },
    payload: base({ message_id: 'blind-1', ai_behavior: 'blind', visibility: ['hud'] }),
  });
  assert.equal(result.accepted, true);
  assert.equal(result.cognitiveProcessed, false);
  assert.equal(calls.steps.length, 0);
  assert.equal(calls.presentations.length, 1);
  assert.deepEqual(calls.presentations[0].visibility, ['hud']);
}

// Blind + empty visibility has no cognitive or presentation side effect.
{
  const { ingress, calls } = harness();
  const result = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'blind-hidden' },
    payload: base({ message_id: 'blind-hidden', ai_behavior: 'blind' }),
  });
  assert.equal(result.accepted, true);
  assert.equal(calls.steps.length, 0);
  assert.equal(calls.presentations.length, 0);
}

// The transport identity is authoritative; a plugin cannot spoof its plugin or message id.
{
  const { ingress, calls } = harness();
  const mismatch = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'trusted-id' },
    payload: base({ message_id: 'spoofed-id' }),
  });
  assert.equal(mismatch.errorCode, 'identity-mismatch');
  assert.equal(calls.steps.length, 0);
  assert.equal(calls.authorized.length, 0);
  const deniedPlugin = await ingress.handle({
    identity: { pluginId: 'unknown', messageId: 'm-2' },
    payload: base({ plugin_id: 'unknown', message_id: 'm-2' }),
  });
  assert.equal(deniedPlugin.errorCode, 'plugin-not-allowed');
  assert.equal(calls.steps.length, 0);
}

// Routing to a different persona is denied, including the legacy metadata route.
{
  const { ingress, calls } = harness();
  const direct = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'route-1' },
    payload: base({ message_id: 'route-1', target_lanlan: 'another-persona' }),
  });
  assert.equal(direct.errorCode, 'cross-persona-routing-denied');
  const metadata = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'route-2' },
    payload: base({ message_id: 'route-2', metadata: { target_lanlan: 'another-persona' } }),
  });
  assert.equal(metadata.errorCode, 'cross-persona-routing-denied');
  assert.equal(calls.steps.length, 0);
}

// Schema, unsupported multimodal parts, malformed visibility and oversized text fail closed.
{
  const { ingress, calls } = harness();
  const wrongSchema = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'bad-1' },
    payload: base({ message_id: 'bad-1', schema: 'push_message.v1' }),
  });
  assert.equal(wrongSchema.errorCode, 'unsupported-schema');
  const media = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'bad-2' },
    payload: base({ message_id: 'bad-2', parts: [{ type: 'image', url: 'https://example.invalid/a.png' }] }),
  });
  assert.equal(media.errorCode, 'unsupported-part');
  const visibility = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'bad-3' },
    payload: base({ message_id: 'bad-3', visibility: ['system'] }),
  });
  assert.equal(visibility.errorCode, 'invalid-visibility');
  const oversized = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'bad-4' },
    payload: base({ message_id: 'bad-4', parts: [{ type: 'text', text: 'x'.repeat(20_000) }] }),
  });
  assert.equal(oversized.errorCode, 'message-too-large');
  assert.equal(calls.steps.length, 0);
}

// Hostile getters / Proxies are rejected without running attacker-controlled accessors.
{
  const { ingress, calls } = harness();
  let getterCalls = 0;
  const payload = base({ message_id: 'hostile-1' });
  Object.defineProperty(payload, 'ai_behavior', {
    enumerable: true, get() { getterCalls += 1; return 'respond'; },
  });
  const accessor = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'hostile-1' }, payload,
  });
  assert.equal(accessor.errorCode, 'invalid-request');
  assert.equal(getterCalls, 0);
  const proxy = new Proxy(base({ message_id: 'hostile-2' }), {
    getPrototypeOf() { throw new Error('must-not-run'); },
  });
  const proxied = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'hostile-2' }, payload: proxy,
  });
  assert.equal(proxied.errorCode, 'invalid-request');
  assert.equal(calls.steps.length, 0);
}

// Message IDs are idempotency keys: exact replay has no repeated side effects; conflicting replay fails.
{
  const { ingress, calls } = harness();
  const first = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'dedupe-1' },
    payload: base({ message_id: 'dedupe-1' }),
  });
  const replay = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'dedupe-1' },
    payload: base({ message_id: 'dedupe-1' }),
  });
  const conflict = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'dedupe-1' },
    payload: base({ message_id: 'dedupe-1', parts: [{ type: 'text', text: 'different' }] }),
  });
  assert.equal(first.accepted, true);
  assert.equal(replay.replayed, true);
  assert.equal(conflict.errorCode, 'message-id-conflict');
  assert.equal(calls.steps.length, 1);
}

// Presentation is orthogonal to model behavior and requires an explicit host presenter.
{
  const { ingress } = harness({ present: undefined });
  const result = await ingress.handle({
    identity: { pluginId: 'notes', messageId: 'no-presenter' },
    payload: base({ message_id: 'no-presenter', ai_behavior: 'blind', visibility: ['chat'] }),
  });
  assert.equal(result.errorCode, 'presentation-unavailable');
}

// Runtime policy enforcement makes "read" non-speaking and prevents plugin evidence from becoming an outside goal.
{
  assert.equal(externalGoalForRuntimeInput('plugin supplied text', 'evidence-only'), undefined);
  assert.deepEqual(externalGoalForRuntimeInput('user asked for help', 'user-command'), {
    title: 'user asked for help', importance: 0.65, urgency: 0.4,
  });
  const baseline = {
    enabled: true, hasInvoker: true, languageBudgetAllows: true,
    hasExternalText: true, hasAutonomousAgenda: false,
  };
  assert.equal(shouldInvokeLanguageForRuntimeStep({ ...baseline, suppressResponse: false }), true);
  assert.equal(shouldInvokeLanguageForRuntimeStep({ ...baseline, suppressResponse: true }), false);
  assert.equal(shouldInvokeLanguageForRuntimeStep({ ...baseline, languageBudgetAllows: false }), false);
}

console.log('NEKO_PLUGIN_MESSAGE_INGRESS=PASS cases=10');
