import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(process.cwd());
const stateDir = await mkdtemp(path.join(tmpdir(), 'nk-hexis-hmx-apply-consent-'));
const port = 38200 + Math.floor(Math.random() * 1200);
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), STATE_DIR: stateDir };
const child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], {
  cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
const base = `http://127.0.0.1:${port}`;
const post = (route, payload) => fetch(base + route, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
});
const memoryIndex = async () => {
  const response = await fetch(base + '/api/organism/integration/hexis/memories?limit=128');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  return result.memoryIndex;
};
const stop = async () => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => {
    const timeout = setTimeout(resolve, 3500);
    child.once('exit', () => { clearTimeout(timeout); resolve(); });
    child.kill('SIGTERM');
  });
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
  assert.equal(ready, true, `server did not become ready: ${output.slice(-1400)}`);

  const exportId = 'exp_apply_consent_' + Date.now().toString(36);
  const marker = 'HMX explicit-apply consent regression ' + exportId;
  const document = {
    hmx_version: '1.7',
    export_id: exportId,
    export_intent: 'port',
    exported_at: new Date().toISOString(),
    source: { instance_id: 'consent-test-donor', schema_version: '1.7' },
    sections: {
      memories: [{
        ref: exportId + ':memory-1',
        type: 'semantic',
        content: marker + ' Bearer nk1-fixture-token-0123456789abcdef',
        importance: 0.7,
        trust_level: 0.99,
      }],
    },
  };

  const before = await memoryIndex();
  const stageResponse = await post('/api/organism/integration/hexis/hmx/stage', {
    document, intent: 'port', strategy: 'additive',
  });
  assert.equal(stageResponse.status, 200);
  const staged = await stageResponse.json();
  assert.equal(staged.ok, true);
  assert.equal(staged.stage.status, 'staged');
  assert.deepEqual(staged.stage.conflicts, []);

  const acceptResponse = await post('/api/organism/integration/hexis/hmx/decide', {
    stagingId: staged.stage.stagingId, decision: 'accept',
  });
  assert.equal(acceptResponse.status, 200);
  const accepted = await acceptResponse.json();
  assert.equal(accepted.stage.status, 'accepted');

  const afterAccept = await memoryIndex();
  assert.equal(afterAccept.length, before.length,
    'accepting HMX is review-only and must never mutate canonical MemoryOS2');
  assert.equal(afterAccept.some(row => row.summary.includes(marker)), false);

  const unconfirmedResponse = await post('/api/organism/integration/hexis/hmx/apply', {
    stagingId: staged.stage.stagingId, confirmed: false,
  });
  assert.equal(unconfirmedResponse.status, 403,
    'canonical writes require a separate explicit apply confirmation');
  assert.equal((await memoryIndex()).length, before.length);

  const invalidDecision = await post('/api/organism/integration/hexis/hmx/decide', {
    stagingId: staged.stage.stagingId, decision: 'apply',
  });
  assert.equal(invalidDecision.status, 400,
    'apply is a separate transition, not an alias for accept/reject');

  const applyResponse = await post('/api/organism/integration/hexis/hmx/apply', {
    stagingId: staged.stage.stagingId, confirmed: true,
  });
  const applied = await applyResponse.json();
  assert.equal(applyResponse.status, 200, JSON.stringify(applied));
  assert.equal(applied.ok, true);
  assert.equal(applied.application.ok, true);
  assert.equal(applied.application.inserted, 1);

  const afterApply = await memoryIndex();
  const imported = afterApply.find(row => row.summary.includes(marker));
  assert.ok(imported, 'the separately approved HMX record must be visible in canonical memory');
  assert.match(imported.source, /^hmx:/);
  assert.equal(imported.epistemicStatus, 'hypothesis',
    'an external import remains an unverified hypothesis, never a trusted belief');
  assert.equal(imported.summary.includes('nk1-fixture-token-0123456789abcdef'), false,
    'sensitive HMX text must be redacted before canonical writes');

  const replayResponse = await post('/api/organism/integration/hexis/hmx/apply', {
    stagingId: staged.stage.stagingId, confirmed: true,
  });
  const replay = await replayResponse.json();
  assert.equal(replayResponse.status, 200);
  assert.equal(replay.application.ok, true);
  assert.equal(replay.application.inserted, 0);
  assert.equal(replay.application.replayed, 1,
    'a repeated explicit apply must be idempotent through MemoryFabric command receipts');
  assert.equal((await memoryIndex()).length, afterApply.length);

  console.log('HEXIS_HMX_EXPLICIT_APPLY_CONSENT=PASS');
} finally {
  await stop();
  await rm(stateDir, { recursive: true, force: true });
}
