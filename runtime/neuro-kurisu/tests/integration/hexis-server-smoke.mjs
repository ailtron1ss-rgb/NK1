import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { hexisEvidenceHttpStatus } from '../../src/server/hexis-evidence-http-status.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

assert.equal(hexisEvidenceHttpStatus('canonical-memory-not-found'), 404);
assert.equal(hexisEvidenceHttpStatus('source-trace-id-conflict'), 409);
assert.equal(hexisEvidenceHttpStatus('canonical-evidence-write-failed'), 500,
  'canonical persistence failures must not masquerade as client conflicts');
assert.equal(hexisEvidenceHttpStatus('invalid-evidence-payload'), 400);

const root = path.resolve(process.cwd());
const stateDir = await mkdtemp(path.join(tmpdir(), 'nk-hexis-'));
const port = 35600 + Math.floor(Math.random() * 800);
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), STATE_DIR: stateDir };
const child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
let restartedChild = null;
let restartedOutput = '';
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
    const memoryId = memoryIndex.memoryIndex[0].id;
    const sourceContent = 'Hexis server smoke direct source observation';
    const capturedAt = Date.now();
    const lineagePayload = {
      memoryId, sourceContent,
      trace: {
        id: 'hexis-server-smoke-lineage-001', source: 'world', kind: 'smoke-observation',
        confidence: .85, epistemicStatus: 'observation', at: capturedAt,
        provenance: {
          sourceId: 'smoke:source:001', sourceKind: 'server-smoke', capturedAt,
          evidenceClass: 'direct-observation',
          contentFingerprint: createHash('sha256').update(sourceContent, 'utf8').digest('hex'),
        },
      },
    };
    const initialConflictDiagnostics = await (await fetch(base + '/api/organism/integration/hexis')).json();
    const initialConflictCount = Number(initialConflictDiagnostics.hexis?.sourceTraceConflicts ?? 0);
    const lineageResponse = await post('/api/organism/integration/hexis/evidence/lineage', lineagePayload);
    const lineage = await lineageResponse.json();
    if (lineageResponse.status !== 200 || !lineage.ok || !lineage.result?.accepted || !lineage.result?.added) {
      throw new Error('hexis-live-evidence-lineage:' + JSON.stringify(lineage));
    }
    const replayResponse = await post('/api/organism/integration/hexis/evidence/lineage', lineagePayload);
    const replay = await replayResponse.json();
    if (replayResponse.status !== 200 || !replay.ok || !replay.result?.accepted || replay.result?.added) {
      throw new Error('hexis-live-evidence-lineage-replay:' + JSON.stringify(replay));
    }

    const replayConflictDiagnostics = await (await fetch(base + '/api/organism/integration/hexis')).json();
    if (Number(replayConflictDiagnostics.hexis?.sourceTraceConflicts ?? 0) !== initialConflictCount) {
      throw new Error('hexis-exact-replay-must-not-increment-conflict-counter:' + JSON.stringify({
        before: initialConflictCount,
        after: replayConflictDiagnostics.hexis?.sourceTraceConflicts,
      }));
    }
    const tamperedResponse = await post('/api/organism/integration/hexis/evidence/lineage', {
      ...lineagePayload, sourceContent: sourceContent + ' tampered',
    });
    if (tamperedResponse.status !== 400) throw new Error('hexis-live-evidence-fingerprint-guard:' + tamperedResponse.status);

    // Conflicting provenance for an immutable trace ID must be rejected as a
    // resource conflict, without replacing the first accepted source lineage.
    const conflictDiagnosticsBefore = await (await fetch(base + '/api/organism/integration/hexis')).json();
    const conflictCountBefore = Number(conflictDiagnosticsBefore.hexis?.sourceTraceConflicts ?? 0);
    const conflictingTraceResponse = await post('/api/organism/integration/hexis/evidence/lineage', {
      ...lineagePayload,
      trace: {
        ...lineagePayload.trace,
        provenance: {
          ...lineagePayload.trace.provenance,
          sourceId: 'smoke:spoofed-source:002',
        },
      },
    });
    const conflictingTrace = await conflictingTraceResponse.json();
    if (conflictingTraceResponse.status !== 409 || conflictingTrace.ok ||
        conflictingTrace.result?.accepted !== false || conflictingTrace.result?.added !== false ||
        conflictingTrace.result?.reason !== 'source-trace-id-conflict') {
      throw new Error('hexis-conflicting-trace-id-must-fail-closed:' + JSON.stringify(conflictingTrace));
    }

    const conflictDiagnosticsAfter = await (await fetch(base + '/api/organism/integration/hexis')).json();
    if (Number(conflictDiagnosticsAfter.hexis?.sourceTraceConflicts) !== conflictCountBefore + 1) {
      throw new Error('hexis-source-trace-conflict-must-increment-audit-counter:' + JSON.stringify({
        before: conflictCountBefore,
        after: conflictDiagnosticsAfter.hexis?.sourceTraceConflicts,
      }));
    }

    const originalAfterConflictResponse = await post('/api/organism/integration/hexis/evidence/lineage', lineagePayload);
    const originalAfterConflict = await originalAfterConflictResponse.json();
    if (originalAfterConflictResponse.status !== 200 || !originalAfterConflict.ok ||
        !originalAfterConflict.result?.accepted || originalAfterConflict.result?.added ||
        originalAfterConflict.result?.reason !== 'duplicate-source-lineage') {
      throw new Error('hexis-original-lineage-must-survive-conflict:' + JSON.stringify(originalAfterConflict));
    }
    await new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once('exit', resolve); child.kill('SIGTERM');
    });
    restartedChild = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    restartedChild.stdout.on('data', d => restartedOutput += d);
    restartedChild.stderr.on('data', d => restartedOutput += d);
    let restartedReady = false;
    for (let i = 0; i < 180; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        const response = await fetch(base + '/api/health');
        const data = await response.json();
        if (response.ok && data.ready === true) { restartedReady = true; break; }
      } catch {}
    }
    if (!restartedReady) throw new Error('server-restart-not-ready:' + restartedOutput.slice(-1200));
    const restoredDiagnostics = await (await fetch(base + '/api/organism/integration/hexis')).json();
    if (Number(restoredDiagnostics.hexis?.sourceTraceConflicts) !== conflictCountBefore + 1) {
      throw new Error('hexis-source-trace-conflict-counter-must-survive-restart:' + JSON.stringify({
        expected: conflictCountBefore + 1,
        actual: restoredDiagnostics.hexis?.sourceTraceConflicts,
      }));
    }
    const restoredReplayResponse = await post('/api/organism/integration/hexis/evidence/lineage', lineagePayload);
    const restoredReplay = await restoredReplayResponse.json();
    if (restoredReplayResponse.status !== 200 || !restoredReplay.ok ||
        !restoredReplay.result?.accepted || restoredReplay.result?.added ||
        restoredReplay.result?.reason !== 'duplicate-source-lineage') {
      throw new Error('hexis-evidence-lineage-root-persistence:' + JSON.stringify(restoredReplay));
    }
  }
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
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  if (restartedChild && restartedChild.exitCode === null && restartedChild.signalCode === null) restartedChild.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 400));
  await rm(stateDir, { recursive: true, force: true });
}
