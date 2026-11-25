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
    body: JSON.stringify({ detail, importance: 0.24, interaction: { protocolVersion: 1, kind: 'avatar-contact', zone: 'head' } }),
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

  const socialResponse = await fetch(`${baseUrl}/api/organism/social-mind`);
  const socialBody = await socialResponse.json();
  const contactEvidence = socialBody.socialMind?.evidence?.find((item) => item.claim === 'user-action:avatar-contact-head');
  assert.equal(socialResponse.status, 200);
  assert.equal(contactEvidence?.source, 'interaction', 'the user action must enter the canonical SocialMind evidence ledger');
  assert.equal(contactEvidence?.evidenceKind, 'observed');
  assert.equal(contactEvidence?.confidence01, 0.72);
  assert.equal(socialBody.socialMind?.persons?.find((person) => person.id === 'user')?.visible01, 0,
    'a UI tap must not fabricate visual presence');

  const uiSnapshotResponse = await fetch(`${baseUrl}/api/organism/ui-snapshot`);
  const uiSnapshot = await uiSnapshotResponse.json();
  assert.equal(uiSnapshotResponse.status, 200);
  assert.deepEqual(uiSnapshot.avatarInteraction, {
    schemaVersion: 1,
    kind: 'avatar-contact',
    zone: 'head',
    at: contactEvidence.observedAt,
    confidence01: 0.72,
    evidenceId: contactEvidence.id,
  }, 'the latest verified social evidence must be projected into the renderer-neutral UI snapshot');

  const bodyContactResponse = await fetch(`${baseUrl}/api/organism/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ detail: 'Пользователь коснулся области корпуса аватара Курису через экранный интерфейс.', importance: 0.24, interaction: { protocolVersion: 1, kind: 'avatar-contact', zone: 'body' } }),
  });
  const bodyContact = await bodyContactResponse.json();
  assert.equal(bodyContactResponse.status, 200);
  assert.equal(bodyContact.perception?.socialEvidence?.claim, 'user-action:avatar-contact-body');
  const bodyUiSnapshot = await (await fetch(`${baseUrl}/api/organism/ui-snapshot`)).json();
  assert.equal(bodyUiSnapshot.avatarInteraction?.zone, 'body', 'latest body contact must supersede the previous head pulse');
  assert.equal(bodyUiSnapshot.avatarInteraction?.evidenceId, bodyContact.perception.socialEvidence.id);

  const malformedInteraction = await fetch(`${baseUrl}/api/organism/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ detail: 'bad tap metadata', importance: 0.24, interaction: { protocolVersion: 2, kind: 'avatar-contact', zone: 'head' } }),
  });
  assert.equal(malformedInteraction.status, 400, 'unknown interaction protocol versions must be rejected at the server boundary');

  console.log(JSON.stringify({ ok: true, server: 'real-organism-runtime', route: '/api/organism/event', perception: body.perception.lastEvent, socialEvidence: contactEvidence }, null, 2));
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), pause(5_000)]);
  }
  await rm(stateDir, { recursive: true, force: true });
}
