import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(process.cwd());
const stateDir = await mkdtemp(path.join(tmpdir(), 'nk-hexis-'));
const port = 35600 + Math.floor(Math.random() * 800);
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), STATE_DIR: stateDir };
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
  const sync = await (await post('/api/organism/integration/hexis/sync-memory', { limit: 16 })).json();
  if (!sync.ok || typeof sync.scanned !== 'number') throw new Error('hexis-sync');
  const memoryIndex = await (await fetch(`${base}/api/organism/integration/hexis/memories?limit=8`)).json();
  if (!memoryIndex.ok || !Array.isArray(memoryIndex.memoryIndex)) throw new Error('hexis-memory-index');
  if (memoryIndex.memoryIndex[0]?.id) {
    const legacyEvidence = {
      memoryId: memoryIndex.memoryIndex[0].id,
      stance: 'supports',
      context: 'server-smoke',
      evidence: { ref: 'server-smoke-evidence', trust01: .8 },
    };
    const beliefResponse = await post('/api/organism/integration/hexis/belief/revise', legacyEvidence);
    const belief = await beliefResponse.json();
    if (beliefResponse.status !== 202 || !belief.ok || belief.result?.status !== 'review-pending')
      throw new Error('hexis-legacy-revise-must-stage-review');
    const duplicateResponse = await post('/api/organism/integration/hexis/belief/revise', legacyEvidence);
    const duplicate = await duplicateResponse.json();
    if (duplicateResponse.status !== 200 || !duplicate.ok || duplicate.result?.status !== 'duplicate')
      throw new Error('hexis-legacy-evidence-dedupe');
    if (duplicate.result?.reviewId) throw new Error('hexis-duplicate-must-not-create-review');

    // The existing generic review endpoint must dispatch evidence proposals
    // through the canonical compare-before-write gate, not direct Hexis mutation.
    const reviewed = await (await post('/api/organism/integration/hexis/reviews/decide', {
      reviewId: belief.result.reviewId,
      itemId: belief.result.reviewItemId,
      decision: 'approve',
    })).json();
    if (!reviewed.ok || reviewed.result?.status !== 'decided' || reviewed.result?.confidenceChanged !== true)
      throw new Error('hexis-generic-review-must-use-canonical-gate');

    // Exercise the canonical envelope endpoint too, including the separate decide route.
    const canonicalEnvelope = {
      memoryId: memoryIndex.memoryIndex[0].id,
      evidenceId: 'hexis:server-smoke:canonical-evidence',
      stance: 'contextualizes',
      source: { kind: 'document', ref: 'server-smoke-canonical-source', label: 'Smoke source' },
      observedAt: new Date().toISOString(),
      confidence: .73,
      note: 'server smoke canonical envelope',
    };
    const stagedResponse = await post('/api/organism/integration/hexis/evidence/review', canonicalEnvelope);
    const staged = await stagedResponse.json();
    if (stagedResponse.status !== 202 || !staged.ok || staged.result?.status !== 'review-pending')
      throw new Error('hexis-canonical-evidence-review');
    const invalidDecisionResponse = await post('/api/organism/integration/hexis/evidence/decide', {
      reviewId: staged.result.reviewId,
      itemId: staged.result.reviewItemId,
      decision: 'auto-approve',
    });
    if (invalidDecisionResponse.status !== 400) throw new Error('hexis-evidence-invalid-decision-must-fail-closed');
    const decidedResponse = await post('/api/organism/integration/hexis/evidence/decide', {
      reviewId: staged.result.reviewId,
      itemId: staged.result.reviewItemId,
      decision: 'approve',
    });
    const decided = await decidedResponse.json();
    if (decidedResponse.status !== 200 || !decided.ok || decided.result?.status !== 'decided' || decided.result?.confidenceChanged !== false)
      throw new Error('hexis-canonical-evidence-decision');
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
