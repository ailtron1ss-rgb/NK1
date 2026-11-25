import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../runtime/neuro-kurisu');
const stateDir = await mkdtemp(path.join(tmpdir(), 'nk-avatar-contact-'));
const portProbe = createServer();
portProbe.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => {
  portProbe.once('listening', resolve);
  portProbe.once('error', reject);
});
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], {
  cwd: runtimeRoot,
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    STATE_DIR: stateDir,
    LLAMA_CPP_URL: '',
    GEMINI_API_KEY: '',
    KOBOLD_URL: '',
    NEURO_AUTONOMY_ENABLED: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
child.stderr.on('data', (chunk) => { output += chunk; });
let childExit = null;
child.once('exit', (code, signal) => { childExit = { code, signal }; });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  let ready = false;
  const deadline = Date.now() + 30_000;
  while (!ready && Date.now() < deadline && childExit === null) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1_500) });
      const health = await response.json();
      ready = response.ok && health.ready === true;
    } catch {
      await pause(100);
    }
  }
  assert.equal(ready, true, `organism API did not become ready: ${output.slice(-1500)}`);

  const invalid = await fetch(`${baseUrl}/api/organism/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ detail: '   ', importance: 0.24 }),
  });
  const invalidBody = await invalid.json();
  assert.equal(invalid.status, 400);
  assert.equal(invalidBody.error, 'empty-detail');

  const detail = 'Пользователь коснулся области головы аватара Курису через экранный интерфейс.';
  const response = await fetch(`${baseUrl}/api/organism/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ detail, importance: 0.24 }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.ok, true);
  const sensoryEvent = body.perception?.multimodal?.recent?.[0];
  assert.equal(sensoryEvent?.summary, detail, 'the actual sensor stream must retain the original contact detail');
  assert.equal(sensoryEvent?.modality, 'sensor');
  assert.equal(sensoryEvent?.salience, 0.24);
  assert.deepEqual(sensoryEvent?.evidence, ['human-interface-event', 'source-unverified']);
  assert.ok(body.perception?.externalEvents >= 1, 'runtime must count external perception events');
  assert.ok(body.perception?.eventCount >= 1);

  console.log(JSON.stringify({ ok: true, server: 'real-organism-runtime', route: '/api/organism/event', perception: body.perception.lastEvent }, null, 2));
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), pause(5_000)]);
  }
  await rm(stateDir, { recursive: true, force: true });
}
