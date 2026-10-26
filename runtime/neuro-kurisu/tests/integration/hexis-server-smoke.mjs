import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(process.cwd());
const stateDir = await mkdtemp(path.join(tmpdir(), 'nk-hexis-'));
const port = 35600 + Math.floor(Math.random() * 800);
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), STATE_DIR: stateDir, NK1_HEXIS_REMOTE_BASE_URL: '', NK1_HEXIS_REMOTE_API_KEY: '', NK1_HEXIS_REMOTE_MODEL: '', NK1_HEXIS_REMOTE_CONSULT_ENABLED: 'false' };
const child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', d => output += d);
child.stderr.on('data', d => output += d);
const base = `http://127.0.0.1:${port}`;
const post = async (route, payload) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
try {
  let ready = false;
  for (let i = 0; i < 180; i++) {
    await new Promise(r => setTimeout(r, 100));
    try { const response = await fetch(`${base}/api/health`); const data = await response.json(); if (response.ok && data.ready === true) { ready = true; break; } } catch {}
  }
  if (!ready) throw new Error(`server-not-ready:${output.slice(-800)}`);
  const overview = await (await fetch(`${base}/api/organism/integration/hexis`)).json();
  if (!overview.ok || overview.hexis?.source?.name !== 'Hexis-main') throw new Error('hexis-overview');
  const peerStatusResponse = await fetch(base + '/api/organism/integration/hexis/peer/status');
  const peerStatus = await peerStatusResponse.json();
  if (!peerStatusResponse.ok || peerStatus.peer?.configured !== false || peerStatus.peer?.reason !== 'not-configured') throw new Error('hexis-peer-disabled-status');
  const peerConsultResponse = await post('/api/organism/integration/hexis/peer/consult', { question: 'This must not be sent to any remote peer.', confirmExternalConsult: true });
  const peerConsult = await peerConsultResponse.json();
  if (peerConsultResponse.status !== 503 || peerConsult.error !== 'hexis-remote-disabled' || peerConsult.nk1StateChanged !== false) throw new Error('hexis-peer-disabled-consult');
  const sync = await (await post('/api/organism/integration/hexis/sync-memory', { limit: 16 })).json();
  if (!sync.ok || typeof sync.scanned !== 'number') throw new Error('hexis-sync');
  const memoryIndex = await (await fetch(`${base}/api/organism/integration/hexis/memories?limit=8`)).json();
  if (!memoryIndex.ok || !Array.isArray(memoryIndex.memoryIndex)) throw new Error('hexis-memory-index');
  if (memoryIndex.memoryIndex[0]?.id) {
    const belief = await (await post('/api/organism/integration/hexis/belief/revise', { memoryId: memoryIndex.memoryIndex[0].id, stance: 'supports', context: 'server-smoke', evidence: { ref: 'server-smoke-evidence', trust01: .8 } })).json();
    if (!belief.ok || !belief.result?.audit) throw new Error('hexis-belief-revise');
    const duplicate = await (await post('/api/organism/integration/hexis/belief/revise', { memoryId: memoryIndex.memoryIndex[0].id, stance: 'supports', context: 'server-smoke', evidence: { ref: 'server-smoke-evidence', trust01: .8 } })).json();
    if (!duplicate.ok || duplicate.result?.audit?.applied !== false) throw new Error('hexis-belief-dedupe');
  }
  const exportRes = await (await fetch(`${base}/api/organism/integration/hexis/hmx/export`)).json();
  if (!exportRes.ok || exportRes.document?.hmx_version !== '1.7' || !Array.isArray(exportRes.document?.sections?.memories)) throw new Error('hexis-hmx-export');
  const stageRes = await (await post('/api/organism/integration/hexis/hmx/stage', { document: exportRes.document, intent: 'port', strategy: 'additive' })).json();
  if (!stageRes.ok || stageRes.stage?.status !== 'staged') throw new Error('hexis-hmx-stage');
  const acceptRes = await (await post('/api/organism/integration/hexis/hmx/decide', { stagingId: stageRes.stage.stagingId, decision: 'accept' })).json();
  if (!acceptRes.ok || acceptRes.stage?.status !== 'accepted') throw new Error('hexis-hmx-accept');
  if (memoryIndex.memoryIndex[0]?.id) {
    const proposal = await (await post('/api/organism/integration/hexis/retention/propose', { memoryId: memoryIndex.memoryIndex[0].id, action: 'archive', reason: 'server-smoke' })).json();
    if (!proposal.ok || !proposal.proposal?.id) throw new Error('hexis-retention-propose');
    const blocked = await (await post('/api/organism/integration/hexis/retention/apply', { proposalId: proposal.proposal.id, confirmed: false })).json();
    if (blocked.ok !== false && blocked.error !== 'retention-explicit-confirmation-required') throw new Error('hexis-retention-confirmation');
    const applied = await (await post('/api/organism/integration/hexis/retention/apply', { proposalId: proposal.proposal.id, confirmed: true })).json();
    if (!applied.ok || applied.proposal?.status !== 'accepted') throw new Error('hexis-retention-apply');
  }
  const execution = await (await post('/api/organism/integration/hexis/execution-plan', { actionKind: 'tool.execute', requestedPlacement: 'local', risk01: .9 })).json();
  if (!execution.ok || execution.plan?.resolvedPlacement !== 'sandbox') throw new Error('hexis-execution');
  const policy = await (await post('/api/organism/integration/hexis/policy', { connectorId: 'telegram', actionKind: 'send', contexts: ['chat'], requiresApproval: true, allowAutonomous: false, allowedTargets: ['smoke-user'] })).json();
  if (!policy.ok || !policy.policy?.id) throw new Error('hexis-policy-grant');
  const denied = await fetch(`${base}/api/organism/integration/hexis/policy/evaluate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ connectorId: 'telegram', actionKind: 'send', context: 'chat', target: 'smoke-user', confirmed: false }) });
  if (denied.status !== 403) throw new Error(`hexis-policy-deny:${denied.status}`);
  const allowed = await (await post('/api/organism/integration/hexis/policy/evaluate', { connectorId: 'telegram', actionKind: 'send', context: 'chat', target: 'smoke-user', confirmed: true })).json();
  if (!allowed.ok || allowed.result?.allowed !== true) throw new Error('hexis-policy-allow');
  const out = await (await post('/api/organism/integration/hexis/outbox/enqueue', { idempotencyKey: 'server-smoke-hexis', kind: 'notify', channel: 'telegram', payload: { text: 'smoke' } })).json();
  if (!out.ok || !out.result?.id) throw new Error('hexis-outbox-enqueue');
  const replay = await (await post('/api/organism/integration/hexis/outbox/enqueue', { idempotencyKey: 'server-smoke-hexis', kind: 'notify', channel: 'telegram', payload: { text: 'smoke' } })).json();
  if (!replay.ok || replay.result?.id !== out.result.id) throw new Error('hexis-outbox-idempotency-replay');
  const conflictResponse = await post('/api/organism/integration/hexis/outbox/enqueue', { idempotencyKey: 'server-smoke-hexis', kind: 'notify', channel: 'telegram', payload: { text: 'different logical action' } });
  const conflict = await conflictResponse.json();
  if (conflictResponse.status !== 409 || conflict.error !== 'idempotency-key-conflict') throw new Error('hexis-outbox-idempotency-conflict');
  const missingKeyResponse = await post('/api/organism/integration/hexis/outbox/enqueue', { idempotencyKey: '', kind: 'notify', channel: 'telegram', payload: { text: 'invalid' } });
  if (missingKeyResponse.status !== 400) throw new Error('hexis-outbox-missing-idempotency-key');
  const claim = await (await post('/api/organism/integration/hexis/outbox/claim', { id: out.result.id })).json();
  if (!claim.ok || claim.result?.status !== 'publishing') throw new Error('hexis-outbox-claim');
  const ack = await (await post('/api/organism/integration/hexis/outbox/ack', { id: out.result.id, published: true })).json();
  if (!ack.ok || ack.result?.status !== 'published') throw new Error('hexis-outbox-ack');
  console.log('HEXIS_SERVER_SMOKE=PASS');
} finally {
  child.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 300));
  await rm(stateDir, { recursive: true, force: true });
}


// End-to-end configured-peer path against a local fake implementing the public
// Hexis API contract. This exercises the real NK1 HTTP routes, opt-in gates,
// discovery, body projection and advisory response labels without using a live
// external service or sending user data off-device.
const mockPaths = [];
let forwardedQuestion = null;
let forwardedContext = null;
const mockPeer = createServer((req, res) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(Buffer.from(chunk)));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch {}
    mockPaths.push(req.method + ' ' + req.url);
    res.setHeader('content-type', 'application/json');
    if (req.method === 'GET' && req.url === '/health') {
      res.statusCode = 200;
      res.end(JSON.stringify({ status: 'ok', checks: { db: true } }));
      return;
    }
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.statusCode = 200;
      res.end(JSON.stringify({ data: [{ id: 'hexis-e2e-model' }] }));
      return;
    }
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      const userMessage = Array.isArray(body.messages) ? body.messages.find(item => item.role === 'user') : null;
      try {
        const forwarded = JSON.parse(String(userMessage?.content ?? '{}'));
        forwardedQuestion = forwarded.question;
        forwardedContext = forwarded.nk1_context;
      } catch {}
      res.statusCode = 200;
      res.end(JSON.stringify({
        model: String(body.model || 'hexis-e2e-model'),
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'E2E peer response: candidate A needs independent evidence.' } }],
        usage: { prompt_tokens: 21, completion_tokens: 11, total_tokens: 32 },
      }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not-found' }));
  });
});
await new Promise((resolve, reject) => {
  mockPeer.once('error', reject);
  mockPeer.listen(0, '127.0.0.1', resolve);
});
const mockAddress = mockPeer.address();
if (!mockAddress || typeof mockAddress === 'string') throw new Error('mock-peer-address');
const remoteStateDir = await mkdtemp(path.join(tmpdir(), 'nk-hexis-remote-'));
const remotePort = 36410 + Math.floor(Math.random() * 700);
const remoteEnv = {
  ...process.env,
  HOST: '127.0.0.1',
  PORT: String(remotePort),
  STATE_DIR: remoteStateDir,
  NK1_HEXIS_REMOTE_BASE_URL: 'http://127.0.0.1:' + String(mockAddress.port),
  NK1_HEXIS_REMOTE_API_KEY: '',
  NK1_HEXIS_REMOTE_MODEL: '',
  NK1_HEXIS_REMOTE_TIMEOUT_MS: '2000',
  NK1_HEXIS_REMOTE_CONSULT_ENABLED: 'true',
};
const remoteChild = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], {
  cwd: root,
  env: remoteEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let remoteOutput = '';
remoteChild.stdout.on('data', d => remoteOutput += d);
remoteChild.stderr.on('data', d => remoteOutput += d);
const remoteBase = 'http://127.0.0.1:' + String(remotePort);
const remotePost = async (route, payload) => fetch(remoteBase + route, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
try {
  let remoteReady = false;
  for (let i = 0; i < 180; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const response = await fetch(remoteBase + '/api/health');
      const data = await response.json();
      if (response.ok && data.ready === true) { remoteReady = true; break; }
    } catch {}
  }
  if (!remoteReady) throw new Error('remote-peer-server-not-ready:' + remoteOutput.slice(-1200));

  const configuredStatusResponse = await fetch(remoteBase + '/api/organism/integration/hexis/peer/status');
  const configuredStatus = await configuredStatusResponse.json();
  if (!configuredStatusResponse.ok || configuredStatus.peer?.configured !== true ||
      configuredStatus.peer?.reachable !== true || configuredStatus.peer?.consultEnabled !== true) {
    throw new Error('remote-peer-status-contract');
  }

  const priorChatCalls = mockPaths.filter(item => item === 'POST /v1/chat/completions').length;
  const unconfirmedResponse = await remotePost('/api/organism/integration/hexis/peer/consult', {
    question: 'This should remain local until explicitly confirmed.',
    context: {},
  });
  const unconfirmed = await unconfirmedResponse.json();
  if (unconfirmedResponse.status !== 400 || unconfirmed.error !== 'hexis-remote-confirmation-required') {
    throw new Error('remote-peer-confirmation-gate');
  }
  if (mockPaths.filter(item => item === 'POST /v1/chat/completions').length !== priorChatCalls) {
    throw new Error('unconfirmed-question-reached-peer');
  }

  const consultResponse = await remotePost('/api/organism/integration/hexis/peer/consult', {
    question: 'Evaluate this recall hypothesis.',
    confirmExternalConsult: true,
    context: {
      tick: 51,
      currentGoal: 'Improve retrieval',
      recentObservations: ['Recall delta remains flat'],
      privateNotes: 'must never be forwarded',
      accessToken: 'must never be forwarded',
    },
  });
  const consult = await consultResponse.json();
  if (!consultResponse.ok || consult.result?.response !== 'E2E peer response: candidate A needs independent evidence.') {
    throw new Error('remote-peer-consult-contract');
  }
  if (consult.result?.advisoryOnly !== true || consult.result?.nk1StateChanged !== false ||
      consult.result?.eligibleAsVerifiedEvidence !== false || consult.result?.externalAgentToolsMayRun !== true) {
    throw new Error('remote-peer-trust-contract');
  }
  if (forwardedQuestion !== 'Evaluate this recall hypothesis.') throw new Error('remote-peer-question-projection');
  if (forwardedContext?.currentGoal !== 'Improve retrieval' || forwardedContext?.privateNotes !== undefined ||
      forwardedContext?.accessToken !== undefined) throw new Error('remote-peer-context-allowlist');
  if (!mockPaths.includes('GET /v1/models') || !mockPaths.includes('POST /v1/chat/completions')) {
    throw new Error('remote-peer-api-discovery-path');
  }
  console.log('HEXIS_REMOTE_PEER_SERVER_E2E=PASS');
} finally {
  remoteChild.kill('SIGTERM');
  await new Promise(resolve => {
    if (remoteChild.exitCode !== null) return resolve();
    remoteChild.once('exit', resolve);
  });
  await new Promise(resolve => mockPeer.close(resolve));
  await rm(remoteStateDir, { recursive: true, force: true });
}
