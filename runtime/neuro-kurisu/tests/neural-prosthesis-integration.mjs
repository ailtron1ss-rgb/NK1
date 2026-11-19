import assert from 'node:assert/strict';
import { NeuralProsthesisChatProvider } from '../src/organism/integration/local/NeuralProsthesisChatProvider.ts';
import { P40ModelEcologyEngine } from '../src/organism/learning/P40ModelEcology.ts';
import { createServer } from 'node:http';
import { once } from 'node:events';

const calls = [];
const provider = new NeuralProsthesisChatProvider({
  baseUrl: 'http://127.0.0.1:8091/v1/',
  model: 'kurisu-transformer-local',
  adapterId: 'kurisu-reasoning-v1',
  apiToken: 'n'.repeat(48),
  timeoutMs: 8000,
  fetchImpl: async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(String(init.body)) });
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({
        model: 'kurisu-transformer-local',
        choices: [{
          message: { content: 'Я проверю гипотезу, не изменяя базовую модель.' },
          finish_reason: 'length',
        }],
        usage: { prompt_tokens: 73, completion_tokens: 160, total_tokens: 233 },
      }),
    };
  },
});

assert.equal(provider.configured(), true);
assert.equal(provider.endpoint(), 'http://127.0.0.1:8091/v1/chat/completions');
const answer = await provider.generate({
  system: 'You are Neuro Kurisu.',
  user: 'Explain the safety boundary.',
  maxTokens: 160,
  temperature: 0.2,
});
assert.match(answer.backend, /^neural-prosthesis:/);
assert.equal(answer.text, 'Я проверю гипотезу, не изменяя базовую модель.');
assert.deepEqual(answer.usage, { promptTokens: 73, completionTokens: 160, totalTokens: 233 });
assert.equal(answer.finishReason, 'length');
assert.equal(calls.length, 1);
assert.equal(calls[0].body.model, 'kurisu-transformer-local');
assert.equal(calls[0].body.adapter_id, 'kurisu-reasoning-v1');
assert.equal(calls[0].body.stream, false);
assert.equal(calls[0].body.max_tokens, 160);
assert.equal(calls[0].init.headers.authorization, 'Bearer ' + 'n'.repeat(48));
assert.equal(calls[0].init.redirect, 'error');
assert.throws(() => new NeuralProsthesisChatProvider({
  baseUrl: 'http://127.0.0.1:8091/v1',
  apiToken: 'too-short',
}), /api-token-invalid/);

const malformedUsageProvider = new NeuralProsthesisChatProvider({
  baseUrl: 'http://127.0.0.1:8091/v1',
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify({
      model: 'kurisu-transformer-local',
      choices: [{ message: { content: 'Malformed metrics are ignored.' }, finish_reason: 17 }],
      usage: { prompt_tokens: 73, completion_tokens: 160, total_tokens: 999 },
    }),
  }),
});
const malformedUsageAnswer = await malformedUsageProvider.generate({ system: '', user: 'hello' });
assert.equal(malformedUsageAnswer.text, 'Malformed metrics are ignored.');
assert.equal(malformedUsageAnswer.usage, undefined, 'inconsistent usage counters must not cross the provider boundary');
assert.equal(malformedUsageAnswer.finishReason, undefined, 'non-string finish reasons must be ignored');

const legacyProvider = new NeuralProsthesisChatProvider({
  baseUrl: 'http://127.0.0.1:8091/v1',
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify({
      model: 'legacy-local-transformer',
      choices: [{ message: { content: 'Legacy response without metrics.' } }],
    }),
  }),
});
const legacyAnswer = await legacyProvider.generate({ system: '', user: 'hello' });
assert.equal(legacyAnswer.text, 'Legacy response without metrics.');
assert.equal(legacyAnswer.usage, undefined);
assert.equal(legacyAnswer.finishReason, undefined);

assert.throws(() => new NeuralProsthesisChatProvider({ baseUrl: 'https://127.0.0.1:8091/v1' }), /loopback-http/);
assert.throws(() => new NeuralProsthesisChatProvider({ baseUrl: 'http://example.com:8091/v1' }), /loopback-http/);
assert.equal(new NeuralProsthesisChatProvider().configured(), false);
await assert.rejects(
  new NeuralProsthesisChatProvider().generate({ system: '', user: 'hello' }),
  /not-configured/,
);
await assert.rejects(
  new NeuralProsthesisChatProvider({
    baseUrl: 'http://127.0.0.1:8091/v1',
    fetchImpl: async () => ({ ok: false, status: 503, headers: { get: () => null }, text: async () => '{}' }),
  }).generate({ system: '', user: 'hello' }),
  /http-503/,
);

const ecology = new P40ModelEcologyEngine();
const profile = ecology.profile('neural-prosthesis');
assert.ok(profile, 'P40 must know the optional neural-prosthesis backend');
assert.equal(profile.configured, false, 'the optional backend must be disabled by default');
ecology.configure('neural-prosthesis', true);
const neutralChoice = ecology.select({
  task: 'language',
  urgency01: 0.8,
  resourceRisk01: 0.2,
  desiredQuality01: 0.9,
  allowCloud: false,
});
assert.notEqual(neutralChoice, 'neural-prosthesis', 'an unmeasured residual backend must not receive an optimistic quality prior');
const selected = ecology.select({
  task: 'language',
  urgency01: 0.8,
  resourceRisk01: 0.2,
  desiredQuality01: 0.9,
  allowCloud: false,
  preferredBackend: 'neural-prosthesis',
});
assert.equal(selected, 'neural-prosthesis', 'explicit host preference may select the configured local residual backend');

const aborted = new AbortController();
aborted.abort();
await assert.rejects(
  provider.generate({ system: '', user: 'hello', signal: aborted.signal }),
  /aborted/,
);

console.log(JSON.stringify({
  status: 'PASS',
  pass: 'neural-prosthesis-transformer-residual',
  backend: answer.backend,
  ecologySelection: selected,
  adapter: calls[0].body.adapter_id,
  safety: 'loopback-only; opt-in',
}));

// Managed local sidecar lifecycle: it starts on explicit opt-in, reuses a healthy
// manually-started process, bounds startup time, and never owns/stops an external one.
let sidecarSupervisorModule = {};
try {
  sidecarSupervisorModule = await import('../src/organism/integration/local/NeuralProsthesisSidecarSupervisor.mjs');
} catch {
  // The assertion below reports the missing production contract as a behavioral failure.
}
const { NeuralProsthesisSidecarSupervisor } = sidecarSupervisorModule;
assert.equal(
  typeof NeuralProsthesisSidecarSupervisor,
  'function',
  'managed Neural Prosthesis sidecar supervisor must be exported',
);

async function reserveLoopbackPort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

const supervisorPort = await reserveLoopbackPort();
const supervisorBaseUrl = `http://127.0.0.1:${supervisorPort}/v1`;
const childHealthProgram = [
  "const http = require('node:http');",
  "const server = http.createServer((req, res) => {",
  "  if (req.url !== '/health') { res.writeHead(404); res.end(); return; }",
  "  res.writeHead(200, { 'content-type': 'application/json' });",
  "  res.end(JSON.stringify({ ready: true, backend: 'neural-prosthesis' }));",
  "});",
  "server.listen(Number(process.env.NP_TEST_PORT), '127.0.0.1');",
  "process.on('SIGTERM', () => server.close(() => process.exit(0)));",
].join('\n');

const managedSupervisor = new NeuralProsthesisSidecarSupervisor({
  enabled: true,
  command: process.execPath,
  args: ['-e', childHealthProgram],
  cwd: process.cwd(),
  env: { ...process.env, NP_TEST_PORT: String(supervisorPort) },
  baseUrl: supervisorBaseUrl,
  startupTimeoutMs: 5000,
  stopTimeoutMs: 1500,
});
const managedStart = await managedSupervisor.start();
assert.equal(managedStart.started, true);
assert.equal(managedStart.ready, true);
assert.equal(managedSupervisor.snapshot().managed, true);
assert.ok(managedSupervisor.snapshot().pid > 0);
assert.equal(await managedSupervisor.stop(), true);
assert.equal(managedSupervisor.snapshot().managed, false);
assert.equal(managedSupervisor.snapshot().ready, false);
await assert.rejects(
  fetch(new URL('/health', supervisorBaseUrl), { signal: AbortSignal.timeout(500) }),
);

// An unexpected post-start child exit must clear stale ownership, PID and readiness.
const restartedManaged = await managedSupervisor.start();
assert.equal(restartedManaged.started, true);
const unexpectedlyExitedChild = managedSupervisor.child;
assert.ok(unexpectedlyExitedChild?.pid > 0);
const unexpectedExit = once(unexpectedlyExitedChild, 'exit');
unexpectedlyExitedChild.kill('SIGTERM');
await unexpectedExit;
assert.equal(managedSupervisor.snapshot().managed, false, 'unexpected child exit must clear managed ownership');
assert.equal(managedSupervisor.snapshot().ready, false, 'unexpected child exit must clear readiness');
assert.equal(managedSupervisor.snapshot().pid, null, 'unexpected child exit must clear the stale PID');
assert.match(managedSupervisor.snapshot().lastError ?? '', /^sidecar-exited-unexpectedly/);
const recoveredAfterCrash = await managedSupervisor.start();
assert.equal(recoveredAfterCrash.started, true, 'supervisor must restart after an unexpected child exit');
assert.equal(managedSupervisor.snapshot().lastError, null, 'successful restart must clear the previous crash error');
assert.equal(await managedSupervisor.stop(), true);

const timeoutPort = await reserveLoopbackPort();
const timeoutBaseUrl = `http://127.0.0.1:${timeoutPort}/v1`;
const timeoutSupervisor = new NeuralProsthesisSidecarSupervisor({
  enabled: true,
  command: process.execPath,
  args: ['-e', 'setInterval(() => {}, 1000)'],
  cwd: process.cwd(),
  baseUrl: timeoutBaseUrl,
  startupTimeoutMs: 1000,
  stopTimeoutMs: 1500,
});
await assert.rejects(timeoutSupervisor.start(), /sidecar-startup-timeout/);
assert.equal(timeoutSupervisor.snapshot().managed, false);
assert.equal(timeoutSupervisor.snapshot().ready, false);
assert.equal(timeoutSupervisor.snapshot().pid, null);

const externalServer = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ready: true, backend: 'neural-prosthesis' }));
});
externalServer.listen(0, '127.0.0.1');
await once(externalServer, 'listening');
const externalPort = externalServer.address().port;
const externalBaseUrl = `http://127.0.0.1:${externalPort}/v1`;
const reuseSupervisor = new NeuralProsthesisSidecarSupervisor({
  enabled: true,
  command: '/this-command-must-not-be-spawned',
  args: [],
  baseUrl: externalBaseUrl,
  startupTimeoutMs: 1000,
});
try {
  const reused = await reuseSupervisor.start();
  assert.equal(reused.ready, true);
  assert.equal(reused.reusedExisting, true);
  assert.equal(reuseSupervisor.snapshot().managed, false);
  assert.equal(await reuseSupervisor.stop(), false);
  const stillHealthy = await fetch(new URL('/health', externalBaseUrl));
  assert.equal(stillHealthy.ok, true, 'stopping NK1 must not terminate a manually-managed sidecar');
} finally {
  const closed = once(externalServer, 'close');
  externalServer.close();
  await closed;
}

const disabledSupervisor = new NeuralProsthesisSidecarSupervisor({ enabled: false });
assert.deepEqual(await disabledSupervisor.start(), {
  started: false,
  ready: false,
  reason: 'disabled',
});
assert.equal(await disabledSupervisor.stop(), false);

let releasePendingProbe;
let cancelledSpawnCount = 0;
const cancellingSupervisor = new NeuralProsthesisSidecarSupervisor({
  enabled: true,
  command: process.execPath,
  args: [],
  baseUrl: 'http://127.0.0.1:65529/v1',
  startupTimeoutMs: 2000,
  fetchImpl: async () => new Promise(resolve => {
    releasePendingProbe = () => resolve({
      ok: false,
      json: async () => ({ ready: false, backend: 'neural-prosthesis' }),
    });
  }),
  spawnImpl: () => {
    cancelledSpawnCount++;
    throw new Error('spawn-must-not-run-after-shutdown');
  },
});
const pendingStart = cancellingSupervisor.start();
while (!releasePendingProbe) await new Promise(resolve => setTimeout(resolve, 1));
await cancellingSupervisor.stop();
releasePendingProbe();
await assert.rejects(pendingStart, /sidecar-start-cancelled/);
assert.equal(cancelledSpawnCount, 0);
assert.equal(cancellingSupervisor.snapshot().managed, false);

console.log(JSON.stringify({
  status: 'PASS',
  pass: 'neural-prosthesis-sidecar-lifecycle',
  managedProcess: 'started-and-stopped',
  externalProcess: 'reused-without-ownership',
}));
