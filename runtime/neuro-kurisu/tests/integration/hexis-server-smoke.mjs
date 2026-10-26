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
  const nullBodyCases = [
    ['/api/organism/integration/hexis/peer/consult', 'hexis-peer-consult-null-body'],
    ['/api/organism/integration/hexis/sync-memory', 'hexis-sync-memory-null-body'],
    ['/api/organism/integration/hexis/belief/revise', 'hexis-belief-revise-null-body'],
    ['/api/organism/integration/hexis/reviews/create', 'hexis-review-create-null-body'],
    ['/api/organism/integration/hexis/reviews/decide', 'hexis-review-decide-null-body'],
    ['/api/organism/integration/hexis/retention/propose', 'hexis-retention-propose-null-body'],
    ['/api/organism/integration/hexis/retention/apply', 'hexis-retention-apply-null-body'],
    ['/api/organism/integration/hexis/hmx/stage', 'hexis-hmx-stage-null-body'],
    ['/api/organism/integration/hexis/hmx/decide', 'hexis-hmx-decide-null-body'],
    ['/api/organism/integration/hexis/outbox/enqueue', 'hexis-outbox-enqueue-null-body'],
    ['/api/organism/integration/hexis/outbox/claim', 'hexis-outbox-claim-null-body'],
    ['/api/organism/integration/hexis/outbox/ack', 'hexis-outbox-ack-null-body'],
    ['/api/organism/integration/hexis/outbox/reclaim', 'hexis-outbox-reclaim-null-body'],
    ['/api/organism/integration/hexis/policy', 'hexis-policy-grant-null-body'],
    ['/api/organism/integration/hexis/policy/evaluate', 'hexis-policy-evaluate-null-body'],
    ['/api/organism/integration/hexis/policy/revoke', 'hexis-policy-revoke-null-body'],
    ['/api/organism/integration/hexis/execution-plan', 'hexis-execution-plan-null-body'],
  ];
  const invalidJsonBodies = [null, [], 'invalid-json-record', 1, false];
  for (const [route, label] of nullBodyCases) {
    for (const invalidBody of invalidJsonBodies) {
      const response = await post(route, invalidBody);
      const result = await response.json();
      if (response.status !== 400 || result.error !== 'hexis-invalid-request-body') {
        throw new Error(label + ': expected HTTP 400 for non-record JSON body ' + JSON.stringify(invalidBody));
      }
    }
  }

  const invalidReviewDecisionResponse = await post('/api/organism/integration/hexis/reviews/decide', {
    reviewId: 'must-not-be-read-or-mutated',
    itemId: 'must-not-be-read-or-mutated',
    decision: 'aprove',
  });
  const invalidReviewDecision = await invalidReviewDecisionResponse.json();
  if (invalidReviewDecisionResponse.status !== 400 ||
      invalidReviewDecision.error !== 'hexis-review-invalid-decision') {
    throw new Error('hexis-review-invalid-decision-must-fail-closed');
  }

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
  if (!exportRes.ok || exportRes.document?.hmx_version !== '1.7' ||
      !/^exp_[0-9a-f]{16}$/.test(String(exportRes.document?.export_id)) ||
      exportRes.document?.export_intent !== 'telepathy' || !exportRes.document?.exported_at ||
      !exportRes.document?.source?.hexis_lineage_id || !Array.isArray(exportRes.document?.sections?.memories) ||
      Object.keys(exportRes.document?.sections ?? {}).some(key => key !== 'memories')) throw new Error('hexis-hmx-v17-export-contract');
  const invalidHmxIntentResponse = await post('/api/organism/integration/hexis/hmx/stage', {
    document: exportRes.document, intent: 'telepahy', strategy: 'additive',
  });
  const invalidHmxIntent = await invalidHmxIntentResponse.json();
  if (invalidHmxIntentResponse.status !== 400 || invalidHmxIntent.error !== 'hmx-invalid-intent') {
    throw new Error('hexis-hmx-invalid-intent-must-fail-before-staging');
  }
  const invalidHmxStrategyResponse = await post('/api/organism/integration/hexis/hmx/stage', {
    document: exportRes.document, intent: 'telepathy', strategy: 'unrestricted',
  });
  const invalidHmxStrategy = await invalidHmxStrategyResponse.json();
  if (invalidHmxStrategyResponse.status !== 400 || invalidHmxStrategy.error !== 'hmx-invalid-strategy') {
    throw new Error('hexis-hmx-invalid-strategy-must-fail-before-staging');
  }

  const stageRes = await (await post('/api/organism/integration/hexis/hmx/stage', { document: exportRes.document, intent: 'telepathy', strategy: 'additive' })).json();
  if (!stageRes.ok || stageRes.stage?.status !== 'staged' || stageRes.stage?.applicationMode !== 'memory-merge' || stageRes.stage?.conflicts?.length !== 0) throw new Error('hexis-hmx-stage');
  const invalidHmxDecisionResponse = await post('/api/organism/integration/hexis/hmx/decide', {
    stagingId: stageRes.stage.stagingId,
    decision: 'maybe',
  });
  const invalidHmxDecision = await invalidHmxDecisionResponse.json();
  if (invalidHmxDecisionResponse.status !== 400 || invalidHmxDecision.error !== 'hmx-invalid-decision') {
    throw new Error('hexis-hmx-invalid-decision-must-fail-closed');
  }
  // Invalid decisions must not consume/reject the valid stage; an explicit
  // follow-up accept should still drive the canonical memory apply path.
  const acceptRes = await (await post('/api/organism/integration/hexis/hmx/decide', { stagingId: stageRes.stage.stagingId, decision: 'accept' })).json();
  if (!acceptRes.ok || acceptRes.stage?.status !== 'accepted' || !['applied', 'skipped'].includes(acceptRes.stage?.importResult?.status)) throw new Error('hexis-hmx-accept-and-apply');
  for (const count of ['created', 'reused', 'skipped']) if (Number(acceptRes.stage?.importResult?.[count] ?? -1) < 0) throw new Error('hexis-hmx-import-counts');

  // Exercise the actual OrganismCore -> MemoryFabric -> MemoryOS2 write path
  // with one unique externally sourced record. Self-asserted upstream confidence
  // and "fact" metadata must not cross the NK1 evidence gate.
  const externalExportId = 'exp_fedcba9876543210';
  const externalContent = 'NK1_HEXIS_HMX_E2E_IMPORT_UNIQUE_2026-10-26';
  const externalDocument = {
    ...exportRes.document,
    export_id: externalExportId,
    export_intent: 'telepathy',
    exported_at: new Date().toISOString(),
    source: {
      ...exportRes.document.source,
      instance_id: 'hexis-e2e-peer',
      schema_version: '1.7',
      embedding_model: 'hexis-e2e-embedding',
      embedding_dimension: 2,
      hexis_lineage_id: 'hexis-e2e-lineage',
    },
    sections: {
      memories: [{
        ref: externalExportId + ':memory:e2e-unique',
        type: 'episodic',
        content: externalContent,
        importance: 0.99,
        trust_level: 1,
        created_at: '2026-10-25T12:00:00.000Z',
        updated_at: new Date().toISOString(),
        valid_from: '2026-10-25T12:00:00.000Z',
        valid_until: null,
        access_count: 0,
        last_accessed: null,
        source_attribution: { origin: 'local-e2e-mock' },
        metadata: {
          nk1_kind: 'episodic',
          nk1_confidence: 1,
          nk1_salience: 0.9,
          nk1_epistemic_status: 'fact',
          tags: ['hexis', 'e2e'],
          context: { origin: 'local-mock', ignored: { private: true } },
          entities: ['NK1'],
        },
        provenance: { acquisition_mode: 'experienced', origin_instance: 'hexis-e2e-lineage' },
      }],
    },
  };
  const importedStageResponse = await post('/api/organism/integration/hexis/hmx/stage', {
    document: externalDocument, intent: 'telepathy', strategy: 'additive',
  });
  const importedStage = await importedStageResponse.json();
  if (!importedStageResponse.ok || importedStage.stage?.applicationMode !== 'memory-merge' ||
      importedStage.stage?.conflicts?.length !== 0) throw new Error('hexis-hmx-external-stage');
  const importedResponse = await post('/api/organism/integration/hexis/hmx/decide', {
    stagingId: importedStage.stage.stagingId, decision: 'accept',
  });
  const imported = await importedResponse.json();
  if (!importedResponse.ok || imported.stage?.importResult?.status !== 'applied' ||
      imported.stage?.importResult?.created !== 1 ||
      imported.stage?.importResult?.reused !== 0 ||
      imported.stage?.importResult?.skipped !== 0) throw new Error('hexis-hmx-core-memory-apply');

  const importedIndexResponse = await fetch(base + '/api/organism/integration/hexis/memories?limit=128');
  const importedIndex = await importedIndexResponse.json();
  const importedMemory = importedIndex.memoryIndex?.find(item => item.summary === externalContent);
  if (!importedIndexResponse.ok || !importedMemory) throw new Error('hexis-hmx-imported-memory-not-retrievable');
  if (importedMemory.epistemicStatus !== 'belief' || Number(importedMemory.confidence) > 0.55 ||
      importedMemory.source !== 'hexis-hmx-import') throw new Error('hexis-hmx-external-trust-firewall');

  // Re-importing the same export must not duplicate the same kind/content row.
  const duplicateStageResponse = await post('/api/organism/integration/hexis/hmx/stage', {
    document: externalDocument, intent: 'telepathy', strategy: 'additive',
  });
  const duplicateStage = await duplicateStageResponse.json();
  if (!duplicateStageResponse.ok || duplicateStage.stage?.conflicts?.length !== 0) {
    throw new Error('hexis-hmx-duplicate-stage');
  }
  const duplicateImportResponse = await post('/api/organism/integration/hexis/hmx/decide', {
    stagingId: duplicateStage.stage.stagingId, decision: 'accept',
  });
  const duplicateImport = await duplicateImportResponse.json();
  if (!duplicateImportResponse.ok ||
      duplicateImport.stage?.importResult?.status !== 'applied' ||
      duplicateImport.stage?.importResult?.created !== 0 ||
      duplicateImport.stage?.importResult?.reused !== 1 ||
      duplicateImport.stage?.importResult?.skipped !== 0) {
    throw new Error('hexis-hmx-duplicate-reimport-idempotency');
  }
  const duplicateIndexResponse = await fetch(base + '/api/organism/integration/hexis/memories?limit=128');
  const duplicateIndex = await duplicateIndexResponse.json();
  if (duplicateIndex.memoryIndex?.filter(item => item.summary === externalContent).length !== 1) {
    throw new Error('hexis-hmx-duplicate-created-second-memory');
  }


  // A typo must not silently turn into a different retention proposal such as
  // compress; bind action choice to the API's explicit allowlist.
  const invalidRetentionResponse = await post('/api/organism/integration/hexis/retention/propose', {
    memoryId: importedMemory.id,
    action: 'forgett',
    reason: 'invalid-action-regression',
  });
  const invalidRetention = await invalidRetentionResponse.json();
  if (invalidRetentionResponse.status !== 400 ||
      invalidRetention.error !== 'hexis-retention-invalid-action') {
    throw new Error('hexis-retention-invalid-action-must-fail-closed');
  }

  // Accepting a protected/unmapped identity section must fail at the HTTP
  // boundary rather than return 200 with a misleading successful stage.
  const protectedExport = {
    ...exportRes.document,
    export_id: 'exp_abcdef0123456789',
    sections: {
      memories: [{
        ref: 'exp_abcdef0123456789:memory:protected-test',
        type: 'semantic',
        content: 'This memory is only a fixture for protected-section testing.',
      }],
      identity: [{ id: 'self', summary: 'protected identity section must not merge' }],
    },
  };
  const protectedStageResponse = await post('/api/organism/integration/hexis/hmx/stage', {
    document: protectedExport, intent: 'telepathy', strategy: 'additive',
  });
  const protectedStage = await protectedStageResponse.json();
  if (!protectedStageResponse.ok || protectedStage.stage?.status !== 'staged' ||
      !protectedStage.stage?.conflicts?.length) throw new Error('hexis-hmx-protected-stage-block');
  const protectedAcceptResponse = await post('/api/organism/integration/hexis/hmx/decide', {
    stagingId: protectedStage.stage.stagingId, decision: 'accept',
  });
  const protectedAccept = await protectedAcceptResponse.json();
  if (protectedAcceptResponse.status !== 409 || protectedAccept.ok !== false ||
      protectedAccept.error !== 'hmx-stage-has-conflicts' ||
      protectedAccept.stage?.status !== 'staged') throw new Error('hexis-hmx-protected-accept-fail-closed');


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
