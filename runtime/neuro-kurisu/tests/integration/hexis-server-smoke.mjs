import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(process.cwd());
const stateDir = await mkdtemp(path.join(tmpdir(), 'nk-hexis-'));
const port = 35600 + Math.floor(Math.random() * 800);
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), STATE_DIR: stateDir };
const child = spawn(process.execPath, ['--experimental-transform-types', 'src/server/server.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
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
  const importDocument = structuredClone(exportRes.document);
  const importExportId = importDocument.export_id;
  importDocument.sections.memories = [
    ...(Array.isArray(importDocument.sections.memories) ? importDocument.sections.memories : []),
    {
      ref: `${importExportId}:server-smoke-canonical-memory`,
      type: 'semantic',
      status: 'active',
      content: 'Hexis integration smoke: approved memory reaches NK1 canonical MemoryOS2.',
      importance: 0.72,
      trust_level: 0.78,
      metadata: { tags: ['server-smoke', 'hexis-import'] },
      provenance: { source_id: 'nk1-server-smoke', confidence: 0.78 },
    },
  ];
  const stageRes = await (await post('/api/organism/integration/hexis/hmx/stage', { document: importDocument, intent: 'port', strategy: 'additive' })).json();
  if (!stageRes.ok || stageRes.stage?.status !== 'staged' || stageRes.stage?.conflicts?.length) throw new Error(`hexis-hmx-stage:${JSON.stringify(stageRes.stage?.conflicts)}`);
  const acceptRes = await (await post('/api/organism/integration/hexis/hmx/decide', { stagingId: stageRes.stage.stagingId, decision: 'accept' })).json();
  if (!acceptRes.ok || acceptRes.stage?.status !== 'accepted') throw new Error(`hexis-hmx-accept:${JSON.stringify({ stage: stageRes.stage, accepted: acceptRes.stage })}`);
  if (acceptRes.appliedToCanonicalMemory !== false || !String(acceptRes.note || '').includes('has not yet been mutated')) throw new Error('hexis-review-is-not-memory-application');
  const applyRes = await post('/api/organism/integration/hexis/hmx/decide', { stagingId: stageRes.stage.stagingId, decision: 'apply' });
  const applyResult = await applyRes.json();
  if (!applyResult.ok || applyResult.stage?.status !== 'applied' || applyResult.appliedToCanonicalMemory !== true) {
    throw new Error(`hexis-canonical-memory-apply:${JSON.stringify({ status: applyRes.status, body: applyResult })}`);
  }
  if (applyResult.application?.importedCount < 1 || !applyResult.application?.memoryIds?.length) {
    throw new Error(`hexis-canonical-memory-receipt:${JSON.stringify(applyResult.application)}`);
  }
  if (!applyResult.application?.deferredSections?.identity) throw new Error('hexis-identity-section-must-remain-explicitly-deferred');
  const replayApply = await (await post('/api/organism/integration/hexis/hmx/decide', { stagingId: stageRes.stage.stagingId, decision: 'apply' })).json();
  if (!replayApply.ok || replayApply.application?.digest !== applyResult.application?.digest) throw new Error('hexis-canonical-apply-replay-not-idempotent');

  const malformedDocument = structuredClone(exportRes.document);
  delete malformedDocument.source.embedding_model;
  const malformedStageResponse = await post('/api/organism/integration/hexis/hmx/stage', { document: malformedDocument, intent: 'port', strategy: 'additive' });
  const malformedStage = await malformedStageResponse.json();
  if (!malformedStage.ok || !malformedStage.stage?.conflicts?.some(conflict => conflict.path === 'source')) throw new Error('hexis-hmx-missing-source-rejected');
  const blockedAcceptResponse = await post('/api/organism/integration/hexis/hmx/decide', { stagingId: malformedStage.stage.stagingId, decision: 'accept' });
  const blockedAccept = await blockedAcceptResponse.json();
  if (blockedAcceptResponse.status !== 409 || blockedAccept.ok !== false || blockedAccept.stage?.status !== 'staged' || blockedAccept.appliedToCanonicalMemory !== false) throw new Error('hexis-hmx-conflict-not-accepted');
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
