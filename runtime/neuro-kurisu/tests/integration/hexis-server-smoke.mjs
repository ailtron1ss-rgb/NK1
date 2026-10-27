import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(process.cwd());
const stateDir = await mkdtemp(path.join(tmpdir(), 'nk-hexis-'));
const port = 35600 + Math.floor(Math.random() * 800);
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), STATE_DIR: stateDir };
const child = spawn(process.execPath, ['--experimental-transform-types', 'src/server/server.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
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
  // GET query coercion must not widen result sets or turn missing timestamps into epoch zero.
  const invalidMemoryLimit = await fetch(`${base}/api/organism/integration/hexis/memories?limit=not-a-number`);
  if (invalidMemoryLimit.status !== 400) throw new Error('hexis-memory-limit-must-be-numeric:' + invalidMemoryLimit.status);
  const invalidGoalLimit = await fetch(`${base}/api/organism/integration/hexis/goals?limit=not-a-number`);
  if (invalidGoalLimit.status !== 400) throw new Error('hexis-goal-limit-must-be-numeric:' + invalidGoalLimit.status);
  const invalidGoalStatus = await fetch(`${base}/api/organism/integration/hexis/goals?status=unrecognized`);
  if (invalidGoalStatus.status !== 400) throw new Error('hexis-goal-status-must-be-allowlisted:' + invalidGoalStatus.status);
  const missingTemporalAt = await fetch(`${base}/api/organism/integration/hexis/temporal?memoryId=smoke-memory`);
  if (missingTemporalAt.status !== 400) throw new Error('hexis-temporal-requires-time:' + missingTemporalAt.status);
  const missingTemporalDiffTo = await fetch(`${base}/api/organism/integration/hexis/temporal/diff?memoryId=smoke-memory&from=0`);
  if (missingTemporalDiffTo.status !== 400) throw new Error('hexis-temporal-diff-requires-both-times:' + missingTemporalDiffTo.status);
  // Every Hexis POST endpoint rejects JSON null before reading fields or mutating state.
  const hexisPostRoutes = [
    '/api/organism/integration/hexis/sync-memory',
    '/api/organism/integration/hexis/belief/revise',
    '/api/organism/integration/hexis/evidence/lineage',
    '/api/organism/integration/hexis/reviews/create',
    '/api/organism/integration/hexis/reviews/decide',
    '/api/organism/integration/hexis/retention/propose',
    '/api/organism/integration/hexis/retention/apply',
    '/api/organism/integration/hexis/hmx/stage',
    '/api/organism/integration/hexis/hmx/decide',
    '/api/organism/integration/hexis/goals/prepare',
    '/api/organism/integration/hexis/goals/decide',
    '/api/organism/integration/hexis/goals/materialize',
    '/api/organism/integration/hexis/goals/activate',
    '/api/organism/integration/hexis/outbox/enqueue',
    '/api/organism/integration/hexis/outbox/claim',
    '/api/organism/integration/hexis/outbox/ack',
    '/api/organism/integration/hexis/outbox/reclaim',
    '/api/organism/integration/hexis/policy',
    '/api/organism/integration/hexis/policy/evaluate',
    '/api/organism/integration/hexis/policy/revoke',
    '/api/organism/integration/hexis/execution-plan',
  ];
  for (const route of hexisPostRoutes) {
    const response = await post(route, null);
    if (response.status !== 400) {
      throw new Error('hexis-json-record-body-guard:' + route + ':' + response.status);
    }
  }
  const invalidReclaimAge = await post('/api/organism/integration/hexis/outbox/reclaim', { maxAgeMs: 'not-a-number' });
  if (invalidReclaimAge.status !== 400) {
    throw new Error('hexis-outbox-reclaim-must-reject-string-age:' + invalidReclaimAge.status);
  }
  const invalidRiskType = await post('/api/organism/integration/hexis/execution-plan', {
    actionKind: 'tool.execute', requestedPlacement: 'local', risk01: '0.9', requiresApproval: false,
  });
  if (invalidRiskType.status !== 400) {
    throw new Error('hexis-execution-risk-must-be-numeric:' + invalidRiskType.status);
  }
  const invalidApprovalType = await post('/api/organism/integration/hexis/execution-plan', {
    actionKind: 'tool.execute', requestedPlacement: 'local', risk01: 0.9, requiresApproval: 'false',
  });
  if (invalidApprovalType.status !== 400) {
    throw new Error('hexis-execution-approval-must-be-boolean:' + invalidApprovalType.status);
  }
  const invalidPlacement = await post('/api/organism/integration/hexis/execution-plan', {
    actionKind: 'tool.execute', requestedPlacement: 'admin', risk01: 0.9,
  });
  if (invalidPlacement.status !== 400) {
    throw new Error('hexis-execution-placement-must-be-allowlisted:' + invalidPlacement.status);
  }
  // Unknown retention actions must not silently become the destructive default.
  const invalidRetentionAction = await post('/api/organism/integration/hexis/retention/propose', {
    memoryId: 'missing-memory',
    action: 'unrecognized-action',
    reason: 'invalid-action-regression',
  });
  if (invalidRetentionAction.status !== 400) {
    throw new Error('hexis-retention-must-reject-unknown-action:' + invalidRetentionAction.status);
  }
  // Reject coercible-but-invalid values before they reach the canonical memory/action adapters.
  const invalidSyncLimit = await post('/api/organism/integration/hexis/sync-memory', { limit: 'not-a-number' });
  if (invalidSyncLimit.status !== 400) throw new Error('hexis-sync-limit-must-be-numeric:' + invalidSyncLimit.status);

  const invalidBeliefConfidence = await post('/api/organism/integration/hexis/belief/revise', {
    memoryId: 'invalid-input-test-memory', confidence01: '0.8', stance: 'supports', evidence: {},
  });
  if (invalidBeliefConfidence.status !== 400) throw new Error('hexis-belief-confidence-must-be-numeric:' + invalidBeliefConfidence.status);
  const invalidBeliefProtection = await post('/api/organism/integration/hexis/belief/revise', {
    memoryId: 'invalid-input-test-memory', confidence01: 0.8, stance: 'supports',
    protectedBelief: 'false', evidence: {},
  });
  if (invalidBeliefProtection.status !== 400) throw new Error('hexis-belief-protection-must-be-boolean:' + invalidBeliefProtection.status);

  const invalidOutboxKey = await post('/api/organism/integration/hexis/outbox/enqueue', {
    idempotencyKey: { key: 'object' }, payload: { text: 'should not enqueue' },
  });
  if (invalidOutboxKey.status !== 400) throw new Error('hexis-outbox-key-must-be-string:' + invalidOutboxKey.status);
  const invalidOutboxAck = await post('/api/organism/integration/hexis/outbox/ack', {
    id: 'missing-row', published: 'false',
  });
  if (invalidOutboxAck.status !== 400) throw new Error('hexis-outbox-published-must-be-boolean:' + invalidOutboxAck.status);

  const invalidPolicyEvaluation = await post('/api/organism/integration/hexis/policy/evaluate', {
    connectorId: { id: 'object' }, actionKind: 'send', autonomous: 'false',
  });
  if (invalidPolicyEvaluation.status !== 400) throw new Error('hexis-policy-evaluation-must-reject-coercion:' + invalidPolicyEvaluation.status);
  const strictInputCases = [
    ['/api/organism/integration/hexis/reviews/decide', { reviewId: {}, itemId: 'item', decision: 'approve' }, 'hexis-review-id'],
    ['/api/organism/integration/hexis/retention/propose', { memoryId: {}, action: 'archive' }, 'hexis-retention-memory-id'],
    ['/api/organism/integration/hexis/retention/apply', { proposalId: 'missing-proposal', confirmed: 'true' }, 'hexis-retention-confirmation-type'],
    ['/api/organism/integration/hexis/hmx/stage', { document: {}, intent: 'autonomous-admin', strategy: 'additive' }, 'hexis-hmx-stage-intent'],
    ['/api/organism/integration/hexis/hmx/decide', { stagingId: {}, decision: 'apply' }, 'hexis-hmx-staging-id'],
    ['/api/organism/integration/hexis/hmx/decide', { stagingId: 'smoke-stage', decision: 'accept', confirmed: 'true' }, 'hexis-hmx-confirmation-type'],
    ['/api/organism/integration/hexis/goals/prepare', { stagingId: {} }, 'hexis-goal-staging-id'],
    ['/api/organism/integration/hexis/goals/decide', { proposalId: {}, decision: 'approve' }, 'hexis-goal-proposal-id'],
    ['/api/organism/integration/hexis/goals/materialize', { confirmed: true }, 'hexis-goal-materialize-proposal-id'],
    ['/api/organism/integration/hexis/outbox/claim', { id: {} }, 'hexis-outbox-claim-id'],
    ['/api/organism/integration/hexis/policy/revoke', { id: {} }, 'hexis-policy-revoke-id'],
  ];
  for (const [route, payload, label] of strictInputCases) {
    const response = await post(route, payload);
    if (response.status !== 400) throw new Error(label + ':expected-400-got-' + response.status);
  }
  // Permission booleans must never be inferred through JavaScript truthiness.
  const coercedAutonomyGrant = await post('/api/organism/integration/hexis/policy', {
    connectorId: 'nk1-coercion-regression',
    actionKind: 'send',
    contexts: ['chat'],
    allowAutonomous: 'false',
    requiresApproval: false,
    allowedTargets: ['target-1'],
    maxPerWindow: 1,
    windowMs: 60000,
  });
  if (coercedAutonomyGrant.status !== 400) {
    throw new Error('hexis-policy-must-reject-string-boolean:' + coercedAutonomyGrant.status);
  }
  const coercedAutonomyEval = await post('/api/organism/integration/hexis/policy/evaluate', {
    connectorId: 'nk1-coercion-regression',
    actionKind: 'send',
    context: 'chat',
    target: 'target-1',
    confirmed: true,
    autonomous: true,
  });
  const coercedAutonomyEvalBody = await coercedAutonomyEval.json();
  if (coercedAutonomyEval.status !== 403 || coercedAutonomyEvalBody.result?.reason !== 'no-active-policy') {
    throw new Error('hexis-invalid-policy-must-not-be-created:' + JSON.stringify(coercedAutonomyEvalBody));
  }
  const strictFalseGrant = await post('/api/organism/integration/hexis/policy', {
    connectorId: 'nk1-strict-boolean-regression',
    actionKind: 'send',
    contexts: ['chat'],
    allowAutonomous: false,
    requiresApproval: false,
    allowedTargets: ['target-2'],
    maxPerWindow: 2,
    windowMs: 60000,
  });
  if (strictFalseGrant.status !== 200) throw new Error('hexis-policy-valid-boolean:' + strictFalseGrant.status);
  const strictFalseEval = await post('/api/organism/integration/hexis/policy/evaluate', {
    connectorId: 'nk1-strict-boolean-regression',
    actionKind: 'send',
    context: 'chat',
    target: 'target-2',
    confirmed: true,
    autonomous: true,
  });
  const strictFalseEvalBody = await strictFalseEval.json();
  if (strictFalseEval.status !== 403 || strictFalseEvalBody.result?.reason !== 'autonomous-not-allowed') {
    throw new Error('hexis-explicit-false-must-deny-autonomy:' + JSON.stringify(strictFalseEvalBody));
  }
  const sync = await (await post('/api/organism/integration/hexis/sync-memory', { limit: 16 })).json();
  if (!sync.ok || typeof sync.scanned !== 'number') throw new Error('hexis-sync');
  const memoryIndex = await (await fetch(`${base}/api/organism/integration/hexis/memories?limit=8`)).json();
  if (!memoryIndex.ok || !Array.isArray(memoryIndex.memoryIndex)) throw new Error('hexis-memory-index');
  if (memoryIndex.memoryIndex[0]?.id) {
    const memoryId = memoryIndex.memoryIndex[0].id;
    const sourceContent = 'Hexis server smoke direct source observation';
    const capturedAt = Date.now();
    const lineagePayload = {
      memoryId,
      sourceContent,
      trace: {
        id: 'hexis-server-smoke-lineage-001',
        source: 'world',
        kind: 'smoke-observation',
        confidence: .85,
        epistemicStatus: 'observation',
        at: capturedAt,
        provenance: {
          sourceId: 'smoke:source:001',
          sourceKind: 'server-smoke',
          capturedAt,
          evidenceClass: 'direct-observation',
          contentFingerprint: createHash('sha256').update(sourceContent, 'utf8').digest('hex'),
        },
      },
    };
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
    const tamperedResponse = await post('/api/organism/integration/hexis/evidence/lineage', {
      ...lineagePayload, sourceContent: sourceContent + ' tampered',
    });
    if (tamperedResponse.status !== 400) throw new Error('hexis-live-evidence-fingerprint-guard:' + tamperedResponse.status);

    // A caller cannot reuse an existing trace ID to inject a second source
    // identity. The endpoint explicitly rejects conflicting ID reuse; it must
    // not pretend the spoofed request was accepted as canonical duplicate evidence.
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
    if (conflictingTraceResponse.status !== 200 || conflictingTrace.ok ||
        conflictingTrace.result?.accepted !== false || conflictingTrace.result?.added !== false ||
        conflictingTrace.result?.reason !== 'source-trace-id-conflict') {
      throw new Error('hexis-conflicting-trace-id-must-fail-closed:' + JSON.stringify(conflictingTrace));
    }

    // The original source remains readable after the rejected spoofing attempt.
    const originalAfterConflictResponse = await post('/api/organism/integration/hexis/evidence/lineage', lineagePayload);
    const originalAfterConflict = await originalAfterConflictResponse.json();
    if (originalAfterConflictResponse.status !== 200 || !originalAfterConflict.ok ||
        !originalAfterConflict.result?.accepted || originalAfterConflict.result?.added ||
        originalAfterConflict.result?.reason !== 'duplicate-source-lineage') {
      throw new Error('hexis-original-lineage-must-survive-conflict:' + JSON.stringify(originalAfterConflict));
    }

    // Flush is part of the endpoint contract. Restart the whole server over the
    // same state directory to prove the root OrganismCore projection persisted
    // the Hexis trace as well as canonical lineage.
    await new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once('exit', resolve);
      child.kill('SIGTERM');
    });
    restartedChild = spawn(process.execPath, ['--experimental-transform-types', 'src/server/server.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
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
    const restoredReplayResponse = await post('/api/organism/integration/hexis/evidence/lineage', lineagePayload);
    const restoredReplay = await restoredReplayResponse.json();
    if (restoredReplayResponse.status !== 200 || !restoredReplay.ok ||
        !restoredReplay.result?.accepted || restoredReplay.result?.added ||
        restoredReplay.result?.reason !== 'duplicate-source-lineage') {
      throw new Error('hexis-evidence-lineage-root-persistence:' + JSON.stringify(restoredReplay));
    }
  }
  if (memoryIndex.memoryIndex[0]?.id) {
    // Replay the same valid revision request; idempotency must be tested after
    // request validation, not with a payload missing the required confidence.
    const beliefPayload = {
      memoryId: memoryIndex.memoryIndex[0].id,
      confidence01: .65,
      stance: 'supports',
      context: 'server-smoke',
      evidence: { ref: 'server-smoke-evidence', trust01: .8 },
    };
    const belief = await (await post('/api/organism/integration/hexis/belief/revise', beliefPayload)).json();
    if (!belief.ok || !belief.result?.audit) throw new Error('hexis-belief-revise');
    const duplicate = await (await post('/api/organism/integration/hexis/belief/revise', beliefPayload)).json();
    if (!duplicate.ok || duplicate.result?.audit?.applied !== false || duplicate.result?.audit?.reason !== 'duplicate_source') {
      throw new Error('hexis-belief-dedupe:' + JSON.stringify(duplicate));
    }
    const missingConfidence = await post('/api/organism/integration/hexis/belief/revise', { ...beliefPayload, confidence01: undefined });
    if (missingConfidence.status !== 400) throw new Error('hexis-belief-confidence-required:' + missingConfidence.status);
    const invalidBeliefStanceResponse = await post('/api/organism/integration/hexis/belief/revise', {
      memoryId:memoryIndex.memoryIndex[0].id,confidence01:.65,stance:'support-ish',evidence:{ref:'invalid-stance',trust01:.8},
    });
    if (invalidBeliefStanceResponse.status !== 400) throw new Error('hexis-belief-stance-validation:' + invalidBeliefStanceResponse.status);
    const missingBeliefTargetResponse = await post('/api/organism/integration/hexis/belief/revise', {
      memoryId:'missing-canonical-memory',confidence01:.65,stance:'supports',evidence:{ref:'missing-target',trust01:.8},
    });
    if (missingBeliefTargetResponse.status !== 404) throw new Error('hexis-belief-missing-target-status:' + missingBeliefTargetResponse.status);
  }
  const exportRes = await (await fetch(`${base}/api/organism/integration/hexis/hmx/export`)).json();
  if (!exportRes.ok || exportRes.document?.hmx_version !== '1.7' || !Array.isArray(exportRes.document?.sections?.memories)) throw new Error('hexis-hmx-export');
  const stageRes = await (await post('/api/organism/integration/hexis/hmx/stage', { document: exportRes.document, intent: 'port', strategy: 'additive' })).json();
  if (!stageRes.ok || stageRes.stage?.status !== 'staged') throw new Error('hexis-hmx-stage');
  const unconfirmedAcceptRes = await post('/api/organism/integration/hexis/hmx/decide', { stagingId: stageRes.stage.stagingId, decision: 'accept' });
  if (unconfirmedAcceptRes.status !== 403) throw new Error('hexis-hmx-accept-requires-explicit-confirmation:' + unconfirmedAcceptRes.status);
  const acceptRes = await (await post('/api/organism/integration/hexis/hmx/decide', { stagingId: stageRes.stage.stagingId, decision: 'accept', confirmed: true })).json();
  if (!acceptRes.ok || acceptRes.stage?.status !== 'accepted') throw new Error('hexis-hmx-accept');

  const applyExportId = 'exp_0123456789abcdea';
  const applyRefA = applyExportId + ':memory:smoke-a';
  const applyRefB = applyExportId + ':memory:smoke-b';
  const applyDocument = structuredClone(exportRes.document);
  applyDocument.export_id = applyExportId;
  applyDocument.source.hexis_lineage_id = 'nk1-server-smoke-lineage';
  applyDocument.exported_at = new Date().toISOString();
  applyDocument.sections.memories = [
    { ref: applyRefA, type: 'semantic', status: 'active', content: 'NK1_HEXIS_CANONICAL_APPLY_SMOKE_A', importance: .72, trust_level: .85, provenance: { source_id: 'smoke-source-a', confidence: .85 } },
    { ref: applyRefB, type: 'episodic', status: 'active', content: 'NK1_HEXIS_CANONICAL_APPLY_SMOKE_B', importance: .66, trust_level: .75, provenance: { source_id: 'smoke-source-b', confidence: .75 } },
  ];
  applyDocument.sections.relationships = [
    { ref: applyExportId + ':relationship:smoke-supports-a-b', source_ref: applyRefA, target_ref: applyRefB, edge_type: 'supports', properties: { weight: .8 } },
  ];
  const applyStageRes = await (await post('/api/organism/integration/hexis/hmx/stage', { document: applyDocument, intent: 'port', strategy: 'additive' })).json();
  if (!applyStageRes.ok || applyStageRes.stage?.status !== 'staged' || applyStageRes.stage?.conflicts?.length) {
    throw new Error('hexis-hmx-apply-stage:' + JSON.stringify(applyStageRes.stage?.conflicts));
  }
  const unconfirmedApplyAccept = await post('/api/organism/integration/hexis/hmx/decide', { stagingId: applyStageRes.stage.stagingId, decision: 'accept', confirmed: false });
  if (unconfirmedApplyAccept.status !== 403) throw new Error('hexis-hmx-apply-accept-confirmation:' + unconfirmedApplyAccept.status);
  const applyAcceptRes = await (await post('/api/organism/integration/hexis/hmx/decide', { stagingId: applyStageRes.stage.stagingId, decision: 'accept', confirmed: true })).json();
  if (!applyAcceptRes.ok || applyAcceptRes.stage?.status !== 'accepted') throw new Error('hexis-hmx-apply-accept');
  const unconfirmedApply = await post('/api/organism/integration/hexis/hmx/decide', { stagingId: applyStageRes.stage.stagingId, decision: 'apply' });
  if (unconfirmedApply.status !== 403) throw new Error('hexis-hmx-apply-requires-explicit-confirmation:' + unconfirmedApply.status);
  const applyRes = await (await post('/api/organism/integration/hexis/hmx/decide', { stagingId: applyStageRes.stage.stagingId, decision: 'apply', confirmed: true })).json();
  if (!applyRes.ok || applyRes.stage?.status !== 'applied' || applyRes.stage?.application?.importedCount !== 2 || applyRes.stage?.application?.projectedRelationships !== 1) {
    throw new Error('hexis-hmx-canonical-apply:' + JSON.stringify(applyRes));
  }
  const applyReplay = await (await post('/api/organism/integration/hexis/hmx/decide', { stagingId: applyStageRes.stage.stagingId, decision: 'apply', confirmed: true })).json();
  if (!applyReplay.ok || applyReplay.stage?.application?.digest !== applyRes.stage.application.digest) throw new Error('hexis-hmx-apply-replay');
  const goalExportId='exp_0123456789abcded';
  const goalMemoryRef=goalExportId+':memory:goal-evidence';
  const goalRef=goalExportId+':goal:reviewed';
  const goalDocument=structuredClone(applyDocument);
  goalDocument.export_id=goalExportId;
  goalDocument.source.hexis_lineage_id='nk1-server-smoke-goal-lineage';
  goalDocument.exported_at=new Date().toISOString();
  goalDocument.sections.memories=[
    {ref:goalMemoryRef,type:'semantic',status:'active',content:'NK1_HEXIS_GOAL_EVIDENCE_SMOKE',importance:.71,trust_level:.81,provenance:{source_id:'goal-smoke-source',confidence:.81}},
  ];
  goalDocument.sections.goals=[
    {ref:goalRef,title:'Verify an explicitly reviewed Hexis goal',description:'Use imported evidence and verify an outcome before graduation.'},
  ];
  goalDocument.sections.relationships=[
    {ref:goalExportId+':relationship:goal-evidence',source_ref:goalMemoryRef,target_ref:goalRef,edge_type:'supports',properties:{weight:.78}},
  ];
  const goalStageRes=await (await post('/api/organism/integration/hexis/hmx/stage',{document:goalDocument,intent:'port',strategy:'additive'})).json();
  if(!goalStageRes.ok||goalStageRes.stage?.status!=='staged'||goalStageRes.stage?.conflicts?.length) {
    throw new Error('hexis-goal-stage:'+JSON.stringify(goalStageRes.stage?.conflicts));
  }
  const unconfirmedGoalAccept=await post('/api/organism/integration/hexis/hmx/decide',{stagingId:goalStageRes.stage.stagingId,decision:'accept'});
  if(unconfirmedGoalAccept.status!==403) throw new Error('hexis-goal-accept-confirmation:'+unconfirmedGoalAccept.status);
  const goalAcceptRes=await (await post('/api/organism/integration/hexis/hmx/decide',{stagingId:goalStageRes.stage.stagingId,decision:'accept',confirmed:true})).json();
  if(!goalAcceptRes.ok||goalAcceptRes.stage?.status!=='accepted') throw new Error('hexis-goal-accept');
  const unconfirmedGoalApply=await post('/api/organism/integration/hexis/hmx/decide',{stagingId:goalStageRes.stage.stagingId,decision:'apply',confirmed:false});
  if(unconfirmedGoalApply.status!==403) throw new Error('hexis-goal-apply-confirmation:'+unconfirmedGoalApply.status);
  const goalApplyRes=await (await post('/api/organism/integration/hexis/hmx/decide',{stagingId:goalStageRes.stage.stagingId,decision:'apply',confirmed:true})).json();
  if(!goalApplyRes.ok||goalApplyRes.stage?.status!=='applied') throw new Error('hexis-goal-apply:'+JSON.stringify(goalApplyRes));

  const preparedGoals=await (await post('/api/organism/integration/hexis/goals/prepare',{stagingId:goalStageRes.stage.stagingId})).json();
  if(!preparedGoals.ok||preparedGoals.created!==1||preparedGoals.proposals?.[0]?.status!=='pending') {
    throw new Error('hexis-goal-prepare:'+JSON.stringify(preparedGoals));
  }
  const proposalId=preparedGoals.proposals[0].id;
  const pendingMaterializeResponse=await post('/api/organism/integration/hexis/goals/materialize',{proposalId,confirmed:true});
  if(pendingMaterializeResponse.status!==409) throw new Error('hexis-goal-pending-must-not-materialize:'+pendingMaterializeResponse.status);
  const goalList=await (await fetch(`${base}/api/organism/integration/hexis/goals?status=pending&limit=8`)).json();
  if(!goalList.ok||!goalList.proposals?.some(proposal=>proposal.id===proposalId)) throw new Error('hexis-goal-list');
  const invalidGoalDecisionResponse=await post('/api/organism/integration/hexis/goals/decide',{proposalId,decision:'activate'});
  if(invalidGoalDecisionResponse.status!==400) throw new Error('hexis-goal-decision-validation');

  const goalApproval=await (await post('/api/organism/integration/hexis/goals/decide',{proposalId,decision:'approve'})).json();
  if(!goalApproval.ok||goalApproval.proposal?.status!=='approved') throw new Error('hexis-goal-explicit-approval');
  const unconfirmedMaterialization = await post('/api/organism/integration/hexis/goals/materialize', { proposalId, confirmed: false });
  if (unconfirmedMaterialization.status !== 403) {
    throw new Error('hexis-goal-materialization-requires-explicit-confirmation:' + unconfirmedMaterialization.status);
  }
  const stillApprovedGoals = await (await fetch(`${base}/api/organism/integration/hexis/goals?status=approved&limit=8`)).json();
  if (!stillApprovedGoals.ok || !stillApprovedGoals.proposals?.some(proposal => proposal.id === proposalId && proposal.status === 'approved')) {
    throw new Error('hexis-unconfirmed-materialization-must-not-change-proposal');
  }
  const materializedGoal=await (await post('/api/organism/integration/hexis/goals/materialize',{proposalId,confirmed:true})).json();
  if(!materializedGoal.ok||materializedGoal.project?.status!=='paused'||
     materializedGoal.project?.pauseReason!=='hexis-approved-awaiting-explicit-activation') {
    throw new Error('hexis-goal-paused-materialization:'+JSON.stringify(materializedGoal));
  }
  const unconfirmedActivation = await post('/api/organism/integration/hexis/goals/activate', { proposalId, confirmed: false });
  if (unconfirmedActivation.status !== 403) {
    throw new Error('hexis-goal-activation-requires-explicit-confirmation:' + unconfirmedActivation.status);
  }
  const stillMaterializedGoals = await (await fetch(`${base}/api/organism/integration/hexis/goals?status=materialized&limit=8`)).json();
  if (!stillMaterializedGoals.ok || !stillMaterializedGoals.proposals?.some(proposal => proposal.id === proposalId && !proposal.goalRelationshipReceipt)) {
    throw new Error('hexis-unconfirmed-activation-must-not-change-proposal');
  }
  const activatedGoal=await (await post('/api/organism/integration/hexis/goals/activate',{proposalId,confirmed:true})).json();
  if(!activatedGoal.ok||activatedGoal.project?.status!=='active'||activatedGoal.receipt?.projected!==1||
     activatedGoal.receipt?.deferred!==0||activatedGoal.receipt?.semanticEdgeIds?.length!==1) {
    throw new Error('hexis-goal-explicit-activation:'+JSON.stringify(activatedGoal));
  }
  const activatedGoalReplay=await (await post('/api/organism/integration/hexis/goals/activate',{proposalId,confirmed:true})).json();
  if(!activatedGoalReplay.ok||activatedGoalReplay.receipt?.semanticEdgeIds?.[0]!==activatedGoal.receipt.semanticEdgeIds[0]) {
    throw new Error('hexis-goal-activation-replay');
  }

  const invalidDecision = await fetch(`${base}/api/organism/integration/hexis/hmx/decide`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stagingId: applyStageRes.stage.stagingId, decision: 'activate-everything' }),
  });
  if (invalidDecision.status !== 400) throw new Error('hexis-hmx-decision-validation:' + invalidDecision.status);

  const invalidReviewDecisionResponse = await post('/api/organism/integration/hexis/reviews/decide', {
    reviewId:'invalid-review',itemId:'invalid-item',decision:'approve-everything',
  });
  if (invalidReviewDecisionResponse.status !== 400) throw new Error('hexis-review-decision-validation:' + invalidReviewDecisionResponse.status);

  const reviewCreateResponse = await post('/api/organism/integration/hexis/reviews/create', {});
  const reviewCreate = await reviewCreateResponse.json();
  if (!reviewCreate.ok || !reviewCreate.review?.id || !Array.isArray(reviewCreate.review.items) || reviewCreate.review.items.length < 1) {
    throw new Error('hexis-learning-review-create');
  }
  const approvalItem = reviewCreate.review.items.find(item => item.sourceMemoryId && !/^(identity|autobiographical) memory$/i.test(String(item.title)));
  if (!approvalItem) throw new Error('hexis-learning-review-source-memory');
  const approvalResponse = await post('/api/organism/integration/hexis/reviews/decide', {
    reviewId:reviewCreate.review.id,itemId:approvalItem.id,decision:'approve',
  });
  const approval = await approvalResponse.json();
  if (approvalResponse.status !== 200 || !approval.ok || !approval.result?.ok ||
      approval.result.result?.status !== 'approved' || !approval.result.result.canonicalMemoryId ||
      approval.result.memory?.context?.hexisLearningDecision !== 'approved') {
    throw new Error('hexis-learning-review-canonical-approval:' + JSON.stringify(approval));
  }
  if (Number.isFinite(Number(approvalItem.evidence?.confidence)) &&
      approval.result.memory?.confidence !== Number(approvalItem.evidence.confidence)) {
    throw new Error('hexis-learning-review-approval-confidence-drift');
  }
  const approvalReplayResponse = await post('/api/organism/integration/hexis/reviews/decide', {
    reviewId:reviewCreate.review.id,itemId:approvalItem.id,decision:'approve',
  });
  const approvalReplay = await approvalReplayResponse.json();
  if (!approvalReplay.ok || approvalReplay.result?.disposition !== 'replayed' ||
      approvalReplay.result?.result?.canonicalMemoryId !== approval.result.result.canonicalMemoryId) {
    throw new Error('hexis-learning-review-replay');
  }

  const correctionReviewResponse = await post('/api/organism/integration/hexis/reviews/create', {});
  const correctionReview = await correctionReviewResponse.json();
  const correctionItem = correctionReview.review?.items?.find(item =>
    item.sourceMemoryId && item.sourceMemoryId !== approvalItem.sourceMemoryId &&
    !/^(identity|autobiographical) memory$/i.test(String(item.title)));
  if (!correctionItem) throw new Error('hexis-learning-review-correction-source');
  const correctedContent = 'Corrected by NK1 Hexis runtime integration smoke.';
  const correctionResponse = await post('/api/organism/integration/hexis/reviews/decide', {
    reviewId:correctionReview.review.id,itemId:correctionItem.id,decision:'correct',correction:correctedContent,
  });
  const correctionResult = await correctionResponse.json();
  if (correctionResponse.status !== 200 || !correctionResult.ok ||
      correctionResult.result?.result?.status !== 'corrected' ||
      correctionResult.result?.memory?.content !== correctedContent ||
      correctionResult.result?.memory?.id !== correctionResult.result?.result?.canonicalMemoryId) {
    throw new Error('hexis-learning-review-runtime-correction:' + JSON.stringify(correctionResult));
  }

  if (memoryIndex.memoryIndex[0]?.id) {
    const proposal = await (await post('/api/organism/integration/hexis/retention/propose', { memoryId: memoryIndex.memoryIndex[0].id, action: 'archive', reason: 'server-smoke' })).json();
    if (!proposal.ok || !proposal.proposal?.id) throw new Error('hexis-retention-propose');
    const blocked = await (await post('/api/organism/integration/hexis/retention/apply', { proposalId: proposal.proposal.id, confirmed: false })).json();
    if (blocked.ok !== false && blocked.error !== 'retention-explicit-confirmation-required') throw new Error('hexis-retention-confirmation');
    const applied = await (await post('/api/organism/integration/hexis/retention/apply', { proposalId: proposal.proposal.id, confirmed: true })).json();
    if (!applied.ok || applied.proposal?.status !== 'accepted') throw new Error('hexis-retention-apply');
  }
  const execution = await (await post('/api/organism/integration/hexis/execution-plan', {
    actionKind: 'tool.execute', requestedPlacement: 'local', risk01: .9, requiresApproval: false,
  })).json();
  if (!execution.ok || execution.plan?.resolvedPlacement !== 'sandbox' || execution.plan?.requiresApproval !== true) {
    throw new Error('hexis-high-risk-execution-must-require-approval:' + JSON.stringify(execution));
  }
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
