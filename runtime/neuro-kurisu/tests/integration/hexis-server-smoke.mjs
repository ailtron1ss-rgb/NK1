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
    const invalidBeliefStanceResponse = await post('/api/organism/integration/hexis/belief/revise', {
      memoryId:memoryIndex.memoryIndex[0].id,stance:'support-ish',evidence:{ref:'invalid-stance',trust01:.8},
    });
    if (invalidBeliefStanceResponse.status !== 400) throw new Error('hexis-belief-stance-validation:' + invalidBeliefStanceResponse.status);
    const missingBeliefTargetResponse = await post('/api/organism/integration/hexis/belief/revise', {
      memoryId:'missing-canonical-memory',stance:'supports',evidence:{ref:'missing-target',trust01:.8},
    });
    if (missingBeliefTargetResponse.status !== 404) throw new Error('hexis-belief-missing-target-status:' + missingBeliefTargetResponse.status);
  }
  const exportRes = await (await fetch(`${base}/api/organism/integration/hexis/hmx/export`)).json();
  if (!exportRes.ok || exportRes.document?.hmx_version !== '1.7' || !Array.isArray(exportRes.document?.sections?.memories)) throw new Error('hexis-hmx-export');
  const stageRes = await (await post('/api/organism/integration/hexis/hmx/stage', { document: exportRes.document, intent: 'port', strategy: 'additive' })).json();
  if (!stageRes.ok || stageRes.stage?.status !== 'staged') throw new Error('hexis-hmx-stage');
  const acceptRes = await (await post('/api/organism/integration/hexis/hmx/decide', { stagingId: stageRes.stage.stagingId, decision: 'accept' })).json();
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
  const applyAcceptRes = await (await post('/api/organism/integration/hexis/hmx/decide', { stagingId: applyStageRes.stage.stagingId, decision: 'accept' })).json();
  if (!applyAcceptRes.ok || applyAcceptRes.stage?.status !== 'accepted') throw new Error('hexis-hmx-apply-accept');
  const applyRes = await (await post('/api/organism/integration/hexis/hmx/decide', { stagingId: applyStageRes.stage.stagingId, decision: 'apply' })).json();
  if (!applyRes.ok || applyRes.stage?.status !== 'applied' || applyRes.stage?.application?.importedCount !== 2 || applyRes.stage?.application?.projectedRelationships !== 1) {
    throw new Error('hexis-hmx-canonical-apply:' + JSON.stringify(applyRes));
  }
  const applyReplay = await (await post('/api/organism/integration/hexis/hmx/decide', { stagingId: applyStageRes.stage.stagingId, decision: 'apply' })).json();
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
  const goalAcceptRes=await (await post('/api/organism/integration/hexis/hmx/decide',{stagingId:goalStageRes.stage.stagingId,decision:'accept'})).json();
  if(!goalAcceptRes.ok||goalAcceptRes.stage?.status!=='accepted') throw new Error('hexis-goal-accept');
  const goalApplyRes=await (await post('/api/organism/integration/hexis/hmx/decide',{stagingId:goalStageRes.stage.stagingId,decision:'apply'})).json();
  if(!goalApplyRes.ok||goalApplyRes.stage?.status!=='applied') throw new Error('hexis-goal-apply:'+JSON.stringify(goalApplyRes));

  const preparedGoals=await (await post('/api/organism/integration/hexis/goals/prepare',{stagingId:goalStageRes.stage.stagingId})).json();
  if(!preparedGoals.ok||preparedGoals.created!==1||preparedGoals.proposals?.[0]?.status!=='pending') {
    throw new Error('hexis-goal-prepare:'+JSON.stringify(preparedGoals));
  }
  const proposalId=preparedGoals.proposals[0].id;
  const pendingMaterializeResponse=await post('/api/organism/integration/hexis/goals/materialize',{proposalId});
  if(pendingMaterializeResponse.status!==409) throw new Error('hexis-goal-pending-must-not-materialize:'+pendingMaterializeResponse.status);
  const goalList=await (await fetch(`${base}/api/organism/integration/hexis/goals?status=pending&limit=8`)).json();
  if(!goalList.ok||!goalList.proposals?.some(proposal=>proposal.id===proposalId)) throw new Error('hexis-goal-list');
  const invalidGoalDecisionResponse=await post('/api/organism/integration/hexis/goals/decide',{proposalId,decision:'activate'});
  if(invalidGoalDecisionResponse.status!==400) throw new Error('hexis-goal-decision-validation');

  const goalApproval=await (await post('/api/organism/integration/hexis/goals/decide',{proposalId,decision:'approve'})).json();
  if(!goalApproval.ok||goalApproval.proposal?.status!=='approved') throw new Error('hexis-goal-explicit-approval');
  const materializedGoal=await (await post('/api/organism/integration/hexis/goals/materialize',{proposalId})).json();
  if(!materializedGoal.ok||materializedGoal.project?.status!=='paused'||
     materializedGoal.project?.pauseReason!=='hexis-approved-awaiting-explicit-activation') {
    throw new Error('hexis-goal-paused-materialization:'+JSON.stringify(materializedGoal));
  }
  const activatedGoal=await (await post('/api/organism/integration/hexis/goals/activate',{proposalId})).json();
  if(!activatedGoal.ok||activatedGoal.project?.status!=='active'||activatedGoal.receipt?.projected!==1||
     activatedGoal.receipt?.deferred!==0||activatedGoal.receipt?.semanticEdgeIds?.length!==1) {
    throw new Error('hexis-goal-explicit-activation:'+JSON.stringify(activatedGoal));
  }
  const activatedGoalReplay=await (await post('/api/organism/integration/hexis/goals/activate',{proposalId})).json();
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

  // Negative ACKs and expired publishers are ambiguous unless a provider lookup
  // proves the side effect did not occur. The HTTP contract must preserve that.
  const uncertainOut = await (await post('/api/organism/integration/hexis/outbox/enqueue', {
    idempotencyKey:'server-smoke-hexis-uncertain',kind:'notify',channel:'telegram',payload:{text:'uncertain-delivery'},
  })).json();
  if (!uncertainOut.ok || !uncertainOut.result?.id) throw new Error('hexis-outbox-uncertain-enqueue');
  const uncertainClaim = await (await post('/api/organism/integration/hexis/outbox/claim', { id: uncertainOut.result.id })).json();
  if (!uncertainClaim.ok || uncertainClaim.result?.status !== 'publishing') throw new Error('hexis-outbox-uncertain-claim');
  const negativeAck = await (await post('/api/organism/integration/hexis/outbox/ack', {
    id:uncertainOut.result.id,published:false,error:'synthetic timeout after remote send',
  })).json();
  if (!negativeAck.ok || negativeAck.result?.status !== 'uncertain') throw new Error('hexis-outbox-negative-ack-must-be-uncertain');
  const blockedClaim = await (await post('/api/organism/integration/hexis/outbox/claim', { id: uncertainOut.result.id })).json();
  if (blockedClaim.ok || blockedClaim.result !== null) throw new Error('hexis-outbox-uncertain-must-not-retry');
  const missingResolutionEvidence = await post('/api/organism/integration/hexis/outbox/reconcile', {
    id:uncertainOut.result.id,resolution:'not-published',evidenceRef:'',
  });
  if (missingResolutionEvidence.status !== 400) throw new Error('hexis-outbox-reconcile-evidence-required');
  const reconciledAbsent = await (await post('/api/organism/integration/hexis/outbox/reconcile', {
    id:uncertainOut.result.id,resolution:'not-published',evidenceRef:'provider-lookup:message-absent-after-acceptance-window',
  })).json();
  if (!reconciledAbsent.ok || reconciledAbsent.result?.status !== 'pending') throw new Error('hexis-outbox-reconcile-not-published');
  const retryClaim = await (await post('/api/organism/integration/hexis/outbox/claim', { id: uncertainOut.result.id })).json();
  if (!retryClaim.ok || retryClaim.result?.status !== 'publishing' || retryClaim.result?.attempts !== 2) throw new Error('hexis-outbox-evidence-based-retry');
  const finalAck = await (await post('/api/organism/integration/hexis/outbox/ack', {
    id:uncertainOut.result.id,published:true,
  })).json();
  if (!finalAck.ok || finalAck.result?.status !== 'published') throw new Error('hexis-outbox-final-ack');
  console.log('HEXIS_SERVER_SMOKE=PASS');
} finally {
  child.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 300));
  await rm(stateDir, { recursive: true, force: true });
}
