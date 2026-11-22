import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const stateDir = await mkdtemp(path.join(tmpdir(), 'nk-hexis-hmx-export-route-'));
const port = 37200 + Math.floor(Math.random() * 700);
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), STATE_DIR: stateDir };
const child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], {
  cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
const base = `http://127.0.0.1:${port}`;
const exportRoute = '/api/organism/integration/hexis/hmx/export';
const stageRoute = '/api/organism/integration/hexis/hmx/stage';
const decideRoute = '/api/organism/integration/hexis/hmx/decide';
const applyRoute = '/api/organism/integration/hexis/hmx/apply';
const post = (route, payload) => fetch(base + route, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
const readJson = async response => {
  const payload = await response.json();
  assert.ok(payload && typeof payload === 'object', 'route must return a JSON object');
  return payload;
};
const getExport = async (intent = '') => {
  const response = await fetch(base + exportRoute + (intent ? `?intent=${encodeURIComponent(intent)}` : ''));
  const payload = await readJson(response);
  assert.equal(response.status, 200, `HMX export failed: ${JSON.stringify(payload)}`);
  assert.equal(payload.ok, true);
  assert.equal(payload.document?.hmx_version, '1.7');
  return payload.document;
};
const stage = async document => {
  const intent = String(document.export_intent ?? document.intent ?? 'analysis');
  const response = await post(stageRoute, { document, intent, strategy: 'additive' });
  const payload = await readJson(response);
  assert.equal(response.status, 200, `HMX stage failed: ${JSON.stringify(payload)}`);
  assert.equal(payload.ok, true);
  assert.equal(payload.stage?.status, 'staged');
  assert.equal(typeof payload.stage?.stagingId, 'string');
  return payload.stage.stagingId;
};
const decide = async (stagingId, decision) => {
  const response = await post(decideRoute, { stagingId, decision });
  const payload = await readJson(response);
  return { response, payload };
};
const apply = async (stagingId, confirmed) => {
  const response = await post(applyRoute, { stagingId, confirmed });
  const payload = await readJson(response);
  return { response, payload };
};
const stopChild = async processChild => {
  if (!processChild || processChild.exitCode !== null || processChild.signalCode !== null) return;
  let timeout;
  const exited = new Promise(resolve => processChild.once('exit', resolve));
  processChild.kill('SIGTERM');
  const graceful = await Promise.race([
    exited.then(() => true),
    new Promise(resolve => { timeout = setTimeout(() => resolve(false), 3000); }),
  ]);
  if (timeout) clearTimeout(timeout);
  if (!graceful && processChild.exitCode === null && processChild.signalCode === null) {
    processChild.kill('SIGKILL');
    await exited;
  }
};

try {
  let ready = false;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const response = await fetch(base + '/api/health');
      const health = await response.json();
      if (response.ok && health.ready === true) { ready = true; break; }
    } catch {}
  }
  assert.equal(ready, true, `server did not become ready: ${output.slice(-1200)}`);

  const defaultDocument = await getExport();
  assert.equal(defaultDocument.export_intent, 'port', 'legacy export calls must retain the port default');
  assert.equal(defaultDocument.intent, 'port');

  for (const intent of ['port', 'duplicate', 'telepathy', 'analysis']) {
    const document = await getExport(intent);
    assert.equal(document.export_intent, intent, `export_intent must match requested ${intent}`);
    assert.equal(document.intent, intent, `legacy intent field must match requested ${intent}`);
  }
  const invalidIntent = await fetch(base + exportRoute + '?intent=untrusted');
  const invalidIntentPayload = await readJson(invalidIntent);
  assert.equal(invalidIntent.status, 400);
  assert.equal(invalidIntentPayload.error, 'hmx-export-intent-invalid');

  const acceptedStageId = await stage(defaultDocument);
  const accepted = await decide(acceptedStageId, 'accept');
  assert.equal(accepted.response.status, 200, JSON.stringify(accepted.payload));
  assert.equal(accepted.payload.stage?.status, 'accepted');

  const unconfirmed = await apply(acceptedStageId, false);
  assert.equal(unconfirmed.response.status, 403, JSON.stringify(unconfirmed.payload));
  assert.equal(unconfirmed.payload.error, 'explicit-confirmation-required',
    'canonical apply must require a separate explicit confirmation');

  const applied = await apply(acceptedStageId, true);
  assert.equal(applied.response.status, 200, JSON.stringify(applied.payload));
  assert.equal(applied.payload.ok, true);
  assert.ok(applied.payload.application, 'confirmed accepted stage must return an application receipt');

  const unacceptedStageId = await stage(await getExport());
  const unacceptedApply = await apply(unacceptedStageId, true);
  assert.equal(unacceptedApply.response.status, 409, JSON.stringify(unacceptedApply.payload));
  assert.equal(unacceptedApply.payload.error, 'stage-not-accepted',
    'confirmation alone must not bypass the review-acceptance transition');

  const rejectedStageId = await stage(await getExport());
  const rejected = await decide(rejectedStageId, 'reject');
  assert.equal(rejected.response.status, 200, JSON.stringify(rejected.payload));
  assert.equal(rejected.payload.stage?.status, 'rejected');
  const rejectedApply = await apply(rejectedStageId, true);
  assert.equal(rejectedApply.response.status, 409, JSON.stringify(rejectedApply.payload));
  assert.equal(rejectedApply.payload.error, 'stage-rejected',
    'rejected donor data must remain outside canonical memory');

  const invalidDecision = await decide(acceptedStageId, 'apply');
  assert.equal(invalidDecision.response.status, 400);
  assert.equal(invalidDecision.payload.error, 'invalid-hmx-review-decision');
  const missingStage = await decide('missing-hmx-stage', 'accept');
  assert.equal(missingStage.response.status, 404);
  assert.equal(missingStage.payload.error, 'hmx-stage-not-found');

  // The UI permits a 4 MiB file; this route must not inherit the smaller 256 KiB default API body cap.
  const largeDocument = {
    ...defaultDocument,
    sections: { memories: [{ content: 'x'.repeat(300_000) }] },
  };
  const largeStageId = await stage(largeDocument);
  const largeAccepted = await decide(largeStageId, 'accept');
  assert.equal(largeAccepted.response.status, 200, JSON.stringify(largeAccepted.payload));
  assert.equal(largeAccepted.payload.stage?.status, 'accepted',
    'bounded HMX imports larger than the general API body limit must still reach the authoritative stage validator');

  console.log('HEXIS_HMX_EXPORT_ROUTE=PASS');
} finally {
  await stopChild(child);
  await rm(stateDir, { recursive: true, force: true });
}
